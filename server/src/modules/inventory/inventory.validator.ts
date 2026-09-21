import { z } from 'zod';

export const listInventoryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  productId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  dealerId: z.string().uuid().optional(),
});

export const listMovementsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  productId: z.string().uuid().optional(),
  reason: z.string().optional(),
  ownerType: z.enum(['distributor', 'dealer']).optional(),
  ownerId: z.string().uuid().optional(),
});

export const manualAdjustmentSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantityChange: z.number().refine((val) => val !== 0, 'Quantity change cannot be 0'),
  notes: z.string().trim().min(3, 'Adjustment reason/notes required'),
});

export default {
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  manualAdjustmentSchema,
};
