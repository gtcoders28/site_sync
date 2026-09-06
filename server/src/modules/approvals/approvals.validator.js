const { z } = require('zod');

const resolveRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().trim().optional(),
});

const listRequestsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  requesterType: z.enum(['dealer', 'customer']).optional(),
});

module.exports = {
  resolveRequestSchema,
  listRequestsQuerySchema,
};
