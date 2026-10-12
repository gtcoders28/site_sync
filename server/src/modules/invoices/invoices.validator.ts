import { z } from 'zod';
import { INVOICE_STATUS, INVOICE_APPROVAL_STATUS } from '../../config/constants';

export const invoiceItemSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater'),
  hsnSacCode: z.string().trim().optional().nullable(),
  gstRate: z.number().nonnegative().optional().nullable(),
});

export const createDistributorInvoiceSchema = z.object({
  dealerId: z.string().uuid('Valid dealer ID required').optional().nullable(),
  invoiceNumber: z.string().trim().min(2, 'Invoice number required'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sellerGstin: z.string().trim().optional().nullable(),
  buyerGstin: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  shippingAddress: z.string().trim().optional().nullable(),
  ewayBillNumber: z.string().trim().optional().nullable(),
  vehicleNumber: z.string().trim().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required'),
});

export const createDealerInvoiceSchema = z
  .object({
    customerId: z.string().uuid('Valid customer ID required').optional().nullable(),
    buyerDealerId: z.string().uuid('Valid downstream dealer/retailer ID required').optional().nullable(),
    influencerId: z.string().uuid('Invalid influencer ID').optional().nullable(),
    invoiceNumber: z.string().trim().min(2, 'Invoice number required'),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sellerGstin: z.string().trim().optional().nullable(),
    buyerGstin: z.string().trim().optional().nullable(),
    billingAddress: z.string().trim().optional().nullable(),
    shippingAddress: z.string().trim().optional().nullable(),
    ewayBillNumber: z.string().trim().optional().nullable(),
    vehicleNumber: z.string().trim().optional().nullable(),
    items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required'),
  })
  .refine((data) => data.customerId || data.buyerDealerId, {
    message: 'Either customerId or buyerDealerId must be specified as invoice recipient.',
    path: ['customerId'],
  });

export const updateInvoiceStatusSchema = z.object({
  status: z.enum([INVOICE_STATUS.DISPATCHED, INVOICE_STATUS.DELIVERED, INVOICE_STATUS.CANCELLED]),
});

export const rejectInvoiceSchema = z.object({
  rejectionReason: z.string().trim().optional().nullable(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      INVOICE_STATUS.DRAFT,
      INVOICE_STATUS.PENDING_APPROVAL,
      INVOICE_STATUS.APPROVED,
      INVOICE_STATUS.PENDING,
      INVOICE_STATUS.DISPATCHED,
      INVOICE_STATUS.DELIVERED,
      INVOICE_STATUS.CANCELLED,
    ])
    .optional(),
  approvalStatus: z
    .enum([
      INVOICE_APPROVAL_STATUS.PENDING_APPROVAL,
      INVOICE_APPROVAL_STATUS.APPROVED,
      INVOICE_APPROVAL_STATUS.REJECTED,
    ])
    .optional(),
  search: z.string().optional(),
  dealerId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timeframe: z.string().optional(),
});

export default {
  invoiceItemSchema,
  createDistributorInvoiceSchema,
  createDealerInvoiceSchema,
  updateInvoiceStatusSchema,
  rejectInvoiceSchema,
  listInvoicesQuerySchema,
};
