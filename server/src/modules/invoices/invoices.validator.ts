import { z } from 'zod';
import { INVOICE_STATUS } from '../../config/constants';

export const invoiceItemSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater'),
});

export const createDistributorInvoiceSchema = z.object({
  dealerId: z.string().uuid('Valid dealer ID required'),
  invoiceNumber: z.string().trim().min(2, 'Invoice number required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required'),
});

export const createDealerInvoiceSchema = z.object({
  customerId: z.string().uuid('Valid customer ID required'),
  influencerId: z.string().uuid('Invalid influencer ID').optional().nullable(),
  invoiceNumber: z.string().trim().min(2, 'Invoice number required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required'),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum([INVOICE_STATUS.DELIVERED, INVOICE_STATUS.CANCELLED]),
});

export const listInvoicesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum([INVOICE_STATUS.PENDING, INVOICE_STATUS.DELIVERED, INVOICE_STATUS.CANCELLED]).optional(),
  search: z.string().optional(),
  dealerId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeframe: z.string().optional(),
});

export default {
  createDistributorInvoiceSchema,
  createDealerInvoiceSchema,
  updateInvoiceStatusSchema,
  listInvoicesQuerySchema,
};
