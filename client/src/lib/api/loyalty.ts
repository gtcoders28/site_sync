import { apiClient } from './client';

export interface PointsBalance {
  profileType: string;
  profileId: string;
  balance: number;
}

export interface PointsLedgerEntry {
  ledger_id: string;
  profile_type: string;
  profile_id: string;
  points: number;
  reason: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface RedemptionRequest {
  redemption_id: string;
  profile_type: string;
  profile_id: string;
  points_requested: number;
  monetary_value: number;
  payment_details: Record<string, any>;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

export const loyaltyApi = {
  getMyBalance: () => apiClient.get<PointsBalance>('/loyalty/balance'),
  getLedger: (params?: Record<string, any>) =>
    apiClient.get<PointsLedgerEntry[]>('/loyalty/ledger', { ...params }),
  requestRedemption: (data: { pointsRequested: number; paymentDetails: Record<string, any> }) =>
    apiClient.post<RedemptionRequest>('/loyalty/redeem', data),
  getRedemptions: (params?: Record<string, any>) =>
    apiClient.get<RedemptionRequest[]>('/loyalty/redemptions', { ...params }),
  resolveRedemption: (
    redemptionId: string,
    data: { status: 'approved' | 'fulfilled' | 'rejected'; rejectionReason?: string }
  ) => apiClient.patch<RedemptionRequest>(`/loyalty/redemptions/${redemptionId}`, data),
};
