import { apiClient, type ApiResult } from './client';

export type UserRole = 'platform_owner_distributor' | 'distributor' | 'dealer' | 'retailer' | 'customer' | 'influencer';
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: string;
  isPlatformOwner?: boolean;
  distributorId?: string | null;
  dealerId?: string | null;
  customerId?: string | null;
  influencerId?: string | null;
  company_name?: string;
  shop_name?: string;
  owner_name?: string;
  name?: string;
  mobile_number?: string;
  [key: string]: unknown;
}
export interface AuthData {
  user: AuthenticatedUser;
  tokens: { accessToken: string; refreshToken?: string } | null;
  requiresApproval?: boolean;
}
export type PublicRole = Exclude<UserRole, 'platform_owner_distributor'>;
export const authApi = {
  signIn: async (role: string, credentials: { mobileNumber: string; password: string }): Promise<AuthResult> => {
    try {
      const resp = await fetch('/api/sitesync/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, role }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          return {
            success: true,
            statusCode: 200,
            message: json.message || 'Sign in successful',
            data: json.data,
          };
        }
      }
    } catch {
      // Graceful fallback to client if bridge not active
    }

    return apiClient.post<AuthData>(`/auth/${role}/signin`, credentials);
  },
  signUp: async (role: Exclude<PublicRole, 'distributor'>, payload: Record<string, unknown>): Promise<AuthResult> => {
    try {
      const resp = await fetch('/api/sitesync/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, role }),
      });
      const json = await resp.json();
      if (resp.ok && json.success) {
        return {
          success: true,
          statusCode: 200,
          message: json.message || 'Registration successful',
          data: json.data,
        };
      }
      if (!resp.ok) {
        throw new Error(json.message || 'Registration failed');
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
    }

    return apiClient.post<AuthData>(`/auth/${role}/signup`, payload);
  },
  me: () => apiClient.get<AuthenticatedUser>('/auth/me'),
  refresh: () => apiClient.post<{ accessToken: string; refreshToken?: string }>('/auth/refresh-token', {}, { skipRefresh: true }),
  logout: () => apiClient.post<null>('/auth/logout', undefined, { skipRefresh: true }),
};
export type AuthResult = ApiResult<AuthData>;
