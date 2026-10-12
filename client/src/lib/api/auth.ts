import { apiClient, type ApiResult } from './client';

export type UserRole =
  | 'platform_owner_distributor'
  | 'distributor'
  | 'dealer'
  | 'retailer'
  | 'customer'
  | 'influencer'
  | 'staff';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: string;
  isPlatformOwner?: boolean;
  distributorId?: string | null;
  dealerId?: string | null;
  customerId?: string | null;
  influencerId?: string | null;
  employerType?: 'distributor' | 'dealer' | null;
  employerId?: string | null;
  permissions?: {
    canCreateInvoices: boolean;
    canApproveRegistrations: boolean;
  };
  can_create_invoices?: boolean;
  can_approve_registrations?: boolean;
  company_name?: string;
  shop_name?: string;
  owner_name?: string;
  full_name?: string;
  name?: string;
  mobile_number?: string;
  email?: string;
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
    const endpoint =
      role && ['distributor', 'dealer', 'retailer', 'customer', 'influencer', 'staff'].includes(role)
        ? `/auth/${role}/signin`
        : '/auth/signin';
    return apiClient.post<AuthData>(endpoint, { ...credentials, role });
  },

  signUp: async (role: Exclude<PublicRole, 'distributor' | 'staff'>, payload: Record<string, unknown>): Promise<AuthResult> => {
    // Regional distributors are created strictly by Platform Owner; staff onboarded by parent
    return apiClient.post<AuthData>(`/auth/${role}/signup`, payload);
  },

  me: () => apiClient.get<AuthenticatedUser>('/auth/me'),

  refresh: () => {
    let storedRefresh: string | null = null;
    try {
      storedRefresh = localStorage.getItem('sitesync_refresh_token');
    } catch {}
    return apiClient.post<{ accessToken: string; refreshToken?: string }>(
      '/auth/refresh-token',
      { refreshToken: storedRefresh || undefined },
      { skipRefresh: true }
    );
  },
  logout: () => apiClient.post<null>('/auth/logout', undefined, { skipRefresh: true }),
};

export type AuthResult = ApiResult<AuthData>;
