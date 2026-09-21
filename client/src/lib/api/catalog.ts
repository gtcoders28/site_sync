import { apiClient } from './client';

export interface Brand {
  brand_id: string;
  brand_name: string;
  created_at?: string;
}

export interface Category {
  category_id: string;
  category_name: string;
  default_unit: string;
  created_at?: string;
}

export interface Product {
  product_id: string;
  distributor_id: string;
  category_id: string;
  brand_id: string;
  variant_name: string;
  unit: string;
  unit_price: number;
  attributes?: Record<string, any>;
  status: 'active' | 'discontinued';
  brand_name?: string;
  category_name?: string;
}

export interface CreateProductPayload {
  categoryId: string;
  brandId: string;
  variantName: string;
  unit: string;
  unitPrice: number;
  attributes?: Record<string, any>;
}

export interface UpdateProductPayload {
  variantName?: string;
  unit?: string;
  unitPrice?: number;
  attributes?: Record<string, any>;
  status?: 'active' | 'discontinued';
}

export const catalogApi = {
  getBrands: () => apiClient.get<Brand[]>('/catalog/brands'),
  createBrand: (brandName: string) => apiClient.post<Brand>('/catalog/brands', { brandName }),
  getCategories: () => apiClient.get<Category[]>('/catalog/categories'),
  createCategory: (categoryName: string, defaultUnit: string) =>
    apiClient.post<Category>('/catalog/categories', { categoryName, defaultUnit }),
  getProducts: (params?: Record<string, any>) => apiClient.get<Product[]>('/catalog/products', { ...params }),
  getProductById: (productId: string) => apiClient.get<Product>(`/catalog/products/${productId}`),
  createProduct: (data: CreateProductPayload) => apiClient.post<Product>('/catalog/products', data),
  updateProduct: (productId: string, data: UpdateProductPayload) =>
    apiClient.patch<Product>(`/catalog/products/${productId}`, data),
};
