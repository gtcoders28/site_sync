import { apiClient } from './client';

export interface RegistrationApprovalRequest {
  request_id: string;
  requester_type: 'dealer' | 'customer';
  requester_id: string;
  parent_type: string;
  parent_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  requested_at: string;
  resolved_at?: string | null;
  requester_name?: string;
  owner_name?: string;
  requester_mobile?: string;
  city?: string;
  state?: string;
  category_or_type?: string;
}

export interface ListApprovalsParams {
  page?: number | string;
  limit?: number | string;
  status?: 'pending' | 'approved' | 'rejected';
  requesterType?: 'dealer' | 'customer';
}

export const approvalsApi = {
  getRequests: (params?: ListApprovalsParams) => {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.status) queryParams.status = params.status;
    if (params?.requesterType) queryParams.requesterType = params.requesterType;

    const queryString = new URLSearchParams(queryParams).toString();
    const endpoint = queryString ? `/approvals?${queryString}` : '/approvals';
    return apiClient.get<RegistrationApprovalRequest[]>(endpoint);
  },

  resolveRequest: (
    requestId: string,
    action: 'approve' | 'reject',
    rejectionReason?: string
  ) =>
    apiClient.post<{
      requestId: string;
      requesterType: string;
      requesterId: string;
      status: string;
      resolvedAt: string;
    }>(`/approvals/${requestId}/resolve`, {
      action,
      rejectionReason: rejectionReason?.trim() || undefined,
    }),
};
