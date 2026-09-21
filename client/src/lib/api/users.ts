import { apiClient } from './client';

export interface RegistrationRequest {
  request_id: string;
  requester_type: 'dealer' | 'customer';
  requester_id: string;
  parent_type: string;
  parent_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  shop_name?: string;
  owner_name?: string;
  name?: string;
  mobile_number?: string;
  city?: string;
}

export const usersApi = {
  getDealers: () => apiClient.get<any[]>('/users/dealers'),
  getCustomers: () => apiClient.get<any[]>('/users/customers'),
  getDistributors: () => apiClient.get<any[]>('/users/distributors'),
  deleteDealer: (dealerId: string) => apiClient.delete<any>(`/users/dealers/${dealerId}`),
  deleteCustomer: (customerId: string) => apiClient.delete<any>(`/users/customers/${customerId}`),
  
  // Registration requests & approvals
  getApprovalRequests: (params?: any) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiClient.get<any[]>(`/approvals${query}`);
  },
  resolveApprovalRequest: (requestId: string, status: 'approved' | 'rejected', rejectionReason?: string) =>
    apiClient.post<any>(`/approvals/${requestId}/resolve`, {
      action: status === 'approved' ? 'approve' : 'reject',
      rejectionReason: rejectionReason?.trim() || undefined,
    }),
};
