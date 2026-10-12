import { apiClient, type ApiResult } from './client';

export interface StaffMember {
  staff_id: string;
  employer_type: 'distributor' | 'dealer';
  distributor_id?: string | null;
  dealer_id?: string | null;
  full_name: string;
  mobile_number: string;
  email?: string | null;
  role: string;
  can_create_invoices: boolean;
  can_approve_registrations: boolean;
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_location_at?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface CreateStaffPayload {
  fullName: string;
  mobileNumber: string;
  password: string;
  email?: string;
  role?: string;
  canCreateInvoices?: boolean;
  canApproveRegistrations?: boolean;
}

export const staffApi = {
  getStaff: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    apiClient.get<StaffMember[]>('/staff', { params }),

  createStaff: (payload: CreateStaffPayload) =>
    apiClient.post<StaffMember>('/staff', payload),

  updateStatus: (staffId: string, status: 'active' | 'inactive' | 'suspended') =>
    apiClient.patch<StaffMember>(`/staff/${staffId}/status`, { status }),

  updatePermissions: (
    staffId: string,
    permissions: { canCreateInvoices?: boolean; canApproveRegistrations?: boolean }
  ) =>
    apiClient.patch<StaffMember>(`/staff/${staffId}/permissions`, permissions),

  deleteStaff: (staffId: string) =>
    apiClient.delete<{ message: string; staffId: string }>(`/staff/${staffId}`),
};
