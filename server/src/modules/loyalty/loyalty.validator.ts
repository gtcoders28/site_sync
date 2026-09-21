import { z } from 'zod';

export const requestRedemptionSchema = z.object({
  pointsRedeemed: z.number().int().positive('Points redeemed must be an integer greater than 0'),
  rewardDescription: z.string().trim().min(3, 'Reward description is required'),
});

export const resolveRedemptionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().optional(),
});

export const listRedemptionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['pending', 'approved', 'fulfilled', 'rejected']).optional(),
  profileType: z.enum(['dealer', 'customer', 'influencer']).optional(),
  profileId: z.string().uuid().optional(),
});

export const listLedgerQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  profileType: z.enum(['dealer', 'customer', 'influencer']).optional(),
  profileId: z.string().uuid().optional(),
});

export default {
  requestRedemptionSchema,
  resolveRedemptionSchema,
  listRedemptionsQuerySchema,
  listLedgerQuerySchema,
};
