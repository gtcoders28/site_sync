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
    // Direct call to live backend endpoint
    const endpoint = role && ['distributor', 'dealer', 'customer', 'influencer'].includes(role)
      ? `/auth/${role}/signin`
      : '/auth/signin';
    return apiClient.post<AuthData>(endpoint, { ...credentials, role });
  },

  signUp: async (role: Exclude<PublicRole, 'distributor'>, payload: Record<string, unknown>): Promise<AuthResult> => {
    // Regional distributors are created strictly by Platform Owner
    return apiClient.post<AuthData>(`/auth/${role}/signup`, payload);
  },

  me: () => apiClient.get<AuthenticatedUser>('/auth/me'),
  refresh: () => apiClient.post<{ accessToken: string; refreshToken?: string }>('/auth/refresh-token', {}, { skipRefresh: true }),
  logout: () => apiClient.post<null>('/auth/logout', undefined, { skipRefresh: true }),
};

export type AuthResult = ApiResult<AuthData>;
