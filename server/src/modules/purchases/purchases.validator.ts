import { z } from 'zod';
import { PURCHASE_STATUS } from '../../config/constants';

export const purchaseItemSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater'),
});

export const createPurchaseSchema = z.object({
  supplierName: z.string().trim().min(2, 'Supplier name is required'),
  invoiceNumber: z.string().trim().min(2, 'Invoice number is required'),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one purchase item is required'),
});

export const updatePurchaseStatusSchema = z.object({
  status: z.enum([PURCHASE_STATUS.RECEIVED, PURCHASE_STATUS.CANCELLED]),
});

export const listPurchasesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum([PURCHASE_STATUS.PENDING, PURCHASE_STATUS.RECEIVED, PURCHASE_STATUS.CANCELLED]).optional(),
  search: z.string().optional(),
  distributorId: z.string().uuid().optional(),
});

export default {
  createPurchaseSchema,
  updatePurchaseStatusSchema,
  listPurchasesQuerySchema,
};
