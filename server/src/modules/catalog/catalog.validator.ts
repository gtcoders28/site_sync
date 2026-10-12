import { z } from 'zod';
import { PRODUCT_STATUS } from '../../config/constants';

export const createBrandSchema = z.object({
  brandName: z.string().trim().min(2, 'Brand name is required'),
});

export const createCategorySchema = z.object({
  categoryName: z.string().trim().min(2, 'Category name is required'),
  defaultUnit: z.string().trim().min(1, 'Default unit is required'),
});

export const createProductSchema = z.object({
  distributorId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid('Valid category ID is required'),
  brandId: z.string().uuid('Valid brand ID is required'),
  variantName: z.string().trim().min(2, 'Variant name is required'),
  unit: z.string().trim().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater'),
  hsnSacCode: z.string().trim().optional().nullable(),
  gstRate: z.number().nonnegative().optional().nullable().default(18.0),
  attributes: z.record(z.string(), z.any()).optional().default({}),
});

export const updateProductSchema = z.object({
  variantName: z.string().trim().min(2).optional(),
  unit: z.string().trim().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  hsnSacCode: z.string().trim().optional().nullable(),
  gstRate: z.number().nonnegative().optional().nullable(),
  attributes: z.record(z.string(), z.any()).optional(),
  status: z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.DISCONTINUED]).optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.DISCONTINUED]).optional(),
});

export default {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
};
