import { apiClient } from './client';

export interface InventoryItem {
  product_id: string;
  variant_name: string;
  unit: string;
  unit_price: number;
  quantity_available: number;
  quantity_in_transit?: number;
  brand_name?: string;
  category_name?: string;
  updated_at?: string;
}

export const inventoryApi = {
  getDistributorInventory: (params?: Record<string, any>) =>
    apiClient.get<InventoryItem[]>('/inventory/distributor', { ...params }),
  getDealerInventory: (params?: Record<string, any>) =>
    apiClient.get<InventoryItem[]>('/inventory/dealer', { ...params }),
  getInventory: (role: string = 'distributor', params?: Record<string, any>) => {
    const isDealer = role === 'dealer' || role === 'retailer';
    return isDealer
      ? inventoryApi.getDealerInventory(params)
      : inventoryApi.getDistributorInventory(params);
  },
  adjustStock: (data: { productId: string; quantityChange: number; notes: string }) =>
    apiClient.post<any>('/inventory/adjust', data),
  getMovements: (params?: Record<string, any>) =>
    apiClient.get<any[]>('/inventory/movements', { ...params }),
};
