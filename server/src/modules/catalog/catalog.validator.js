const { z } = require('zod');
const { PRODUCT_STATUS } = require('../../config/constants');

const createBrandSchema = z.object({
  brandName: z.string().trim().min(2, 'Brand name is required'),
});

const createCategorySchema = z.object({
  categoryName: z.string().trim().min(2, 'Category name is required'),
  defaultUnit: z.string().trim().min(1, 'Default unit is required'),
});

const createProductSchema = z.object({
  categoryId: z.string().uuid('Valid category ID is required'),
  brandId: z.string().uuid('Valid brand ID is required'),
  variantName: z.string().trim().min(2, 'Variant name is required'),
  unit: z.string().trim().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater'),
  attributes: z.record(z.any()).optional().default({}),
});

const updateProductSchema = z.object({
  variantName: z.string().trim().min(2).optional(),
  unit: z.string().trim().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  attributes: z.record(z.any()).optional(),
  status: z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.DISCONTINUED]).optional(),
});

const listProductsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.DISCONTINUED]).optional(),
});

module.exports = {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
};
