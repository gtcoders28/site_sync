const { z } = require('zod');

const requestRedemptionSchema = z.object({
  pointsRedeemed: z.number().int().positive('Points redeemed must be an integer greater than 0'),
  rewardDescription: z.string().trim().min(3, 'Reward description is required'),
});

const resolveRedemptionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().optional(),
});

const listRedemptionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['pending', 'approved', 'fulfilled', 'rejected']).optional(),
  profileType: z.enum(['dealer', 'customer', 'influencer']).optional(),
  profileId: z.string().uuid().optional(),
});

const listLedgerQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  profileType: z.enum(['dealer', 'customer', 'influencer']).optional(),
  profileId: z.string().uuid().optional(),
});

module.exports = {
  requestRedemptionSchema,
  resolveRedemptionSchema,
  listRedemptionsQuerySchema,
  listLedgerQuerySchema,
};
