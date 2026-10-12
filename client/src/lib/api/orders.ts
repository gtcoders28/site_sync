import { apiClient } from './client';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
  hsnSacCode?: string;
  gstRate?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount?: number;
}

export interface DistributorInvoice {
  invoice_id: string;
  distributor_id: string;
  dealer_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  approval_status?: 'pending_approval' | 'approved' | 'rejected';
  created_by_staff_id?: string | null;
  staff_name?: string | null;
  dealer_name?: string;
  distributor_name?: string;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  round_off_amount?: number;
  seller_gstin?: string | null;
  buyer_gstin?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  eway_bill_number?: string | null;
  vehicle_number?: string | null;
  items?: any[];
  created_at?: string;
}

export interface DealerInvoice {
  invoice_id: string;
  dealer_id: string;
  customer_id?: string | null;
  buyer_dealer_id?: string | null;
  influencer_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  approval_status?: 'pending_approval' | 'approved' | 'rejected';
  created_by_staff_id?: string | null;
  staff_name?: string | null;
  customer_name?: string;
  dealer_name?: string;
  buyer_dealer_name?: string;
  influencer_name?: string;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  round_off_amount?: number;
  seller_gstin?: string | null;
  buyer_gstin?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  eway_bill_number?: string | null;
  vehicle_number?: string | null;
  items?: any[];
  created_at?: string;
}

export const ordersApi = {
  // Distributor B2B Invoices
  getDistributorInvoices: (params?: Record<string, any>) =>
    apiClient.get<DistributorInvoice[]>('/invoices/distributor', { params }),
  createDistributorInvoice: (data: {
    dealerId: string;
    invoiceNumber: string;
    invoiceDate?: string;
    sellerGstin?: string | null;
    buyerGstin?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    ewayBillNumber?: string | null;
    vehicleNumber?: string | null;
    items: OrderItem[];
  }) => apiClient.post<DistributorInvoice>('/invoices/distributor', data),
  updateDistributorInvoiceStatus: (invoiceId: string, status: 'delivered' | 'cancelled') =>
    apiClient.patch<DistributorInvoice>(`/invoices/distributor/${invoiceId}/status`, { status }),

  // Dealer B2C and Dealer-to-Retailer Invoices
  getDealerInvoices: (params?: Record<string, any>) =>
    apiClient.get<DealerInvoice[]>('/invoices/dealer', { params }),
  createDealerInvoice: (data: {
    customerId?: string | null;
    buyerDealerId?: string | null;
    influencerId?: string | null;
    invoiceNumber: string;
    invoiceDate?: string;
    sellerGstin?: string | null;
    buyerGstin?: string | null;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    ewayBillNumber?: string | null;
    vehicleNumber?: string | null;
    items: OrderItem[];
  }) => apiClient.post<DealerInvoice>('/invoices/dealer', data),

  // Pending Approvals & Draft Pipeline
  getPendingApprovals: () =>
    apiClient.get<Array<DistributorInvoice | DealerInvoice>>('/invoices/pending-approvals'),
  getMyDrafts: () =>
    apiClient.get<Array<DistributorInvoice | DealerInvoice>>('/invoices/my-drafts'),
  approveInvoice: (invoiceId: string) =>
    apiClient.post<{ success: boolean; message: string; invoiceId: string }>(`/invoices/${invoiceId}/approve`),
  rejectInvoice: (invoiceId: string, rejectionReason?: string) =>
    apiClient.post<{ success: boolean; message: string; invoiceId: string }>(`/invoices/${invoiceId}/reject`, {
      rejectionReason,
    }),
};
