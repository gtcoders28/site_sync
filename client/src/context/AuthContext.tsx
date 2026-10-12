import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { ApiError, apiClient } from '../lib/api/client';
import { authApi, type AuthResult, type AuthenticatedUser, type PublicRole } from '../lib/api/auth';
import { dataService } from '../services/dataService';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  signIn: (role: PublicRole, credentials: { mobileNumber: string; password: string }) => Promise<void>;
  loginDirect: (user: AuthenticatedUser) => void;
  acceptAuthentication: (result: AuthResult) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = 'sitesync_current_user';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dataService.syncWithAuthenticatedUser(parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    apiClient.setAccessToken(null);
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('sitesync_refresh_token');
    } catch {}
  }, []);

  const loginDirect = useCallback((directUser: AuthenticatedUser) => {
    setUser(directUser);
    dataService.syncWithAuthenticatedUser(directUser);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(directUser));
    } catch {}
  }, []);

  useEffect(() => {
    apiClient.setSessionExpiredHandler(clearSession);
    return () => {
      apiClient.setSessionExpiredHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        let currentToken: string | null = null;
        try {
          currentToken = localStorage.getItem('sitesync_access_token');
        } catch {}

        if (currentToken) {
          apiClient.setAccessToken(currentToken);
          try {
            const profile = await authApi.me();
            if (active) {
              setUser(profile.data);
              dataService.syncWithAuthenticatedUser(profile.data);
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile.data));
              return;
            }
          } catch {
            // Access token might be expired, proceed to refresh
          }
        }

        // Attempt token refresh
        const refresh = await authApi.refresh();
        if (refresh?.data?.accessToken) {
          apiClient.setAccessToken(refresh.data.accessToken);
          const profile = await authApi.me();
          if (active) {
            setUser(profile.data);
            dataService.syncWithAuthenticatedUser(profile.data);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile.data));
            return;
          }
        }
      } catch (err) {
        // Refresh failed and cannot authenticate
        if (active) {
          clearSession();
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [clearSession]);

  const acceptAuthentication = useCallback((result: AuthResult) => {
    const tokens = result.data.tokens;
    if (tokens?.accessToken) {
      apiClient.setAccessToken(tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      try {
        localStorage.setItem('sitesync_refresh_token', tokens.refreshToken);
      } catch {}
    }
    setUser(result.data.user);
    dataService.syncWithAuthenticatedUser(result.data.user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.data.user));
    } catch {}
  }, []);

  const signIn = useCallback(
    async (role: PublicRole, credentials: { mobileNumber: string; password: string }) => {
      try {
        const result = await authApi.signIn(role, credentials);
        acceptAuthentication(result);
      } catch (error) {
        // Safe developer logging, never exposed raw to user
        console.warn('Backend signIn error:', error);
        throw error;
      }
    },
    [acceptAuthentication]
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, isLoading, signIn, loginDirect, acceptAuthentication, signOut }),
    [user, isLoading, signIn, loginDirect, acceptAuthentication, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
};
