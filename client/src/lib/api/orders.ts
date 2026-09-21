import { apiClient } from './client';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
}

export interface DistributorInvoice {
  invoice_id: string;
  distributor_id: string;
  dealer_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: 'pending' | 'delivered' | 'cancelled';
  dealer_name?: string;
  distributor_name?: string;
  created_at?: string;
}

export interface DealerInvoice {
  invoice_id: string;
  dealer_id: string;
  customer_id: string;
  influencer_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: 'pending' | 'delivered' | 'cancelled';
  customer_name?: string;
  dealer_name?: string;
  created_at?: string;
}

export const ordersApi = {
  // Distributor B2B Invoices
  getDistributorInvoices: (params?: Record<string, any>) =>
    apiClient.get<DistributorInvoice[]>('/invoices/distributor', { ...params }),
  createDistributorInvoice: (data: { dealerId: string; invoiceNumber: string; items: OrderItem[] }) =>
    apiClient.post<DistributorInvoice>('/invoices/distributor', data),
  updateDistributorInvoiceStatus: (invoiceId: string, status: 'delivered' | 'cancelled') =>
    apiClient.patch<DistributorInvoice>(`/invoices/distributor/${invoiceId}/status`, { status }),

  // Dealer B2C Invoices
  getDealerInvoices: (params?: Record<string, any>) =>
    apiClient.get<DealerInvoice[]>('/invoices/dealer', { ...params }),
  createDealerInvoice: (data: {
    customerId: string;
    influencerId?: string | null;
    invoiceNumber: string;
    items: OrderItem[];
  }) => apiClient.post<DealerInvoice>('/invoices/dealer', data),
};
