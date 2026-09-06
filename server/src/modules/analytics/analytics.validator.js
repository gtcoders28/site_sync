const { z } = require('zod');

const analyticsQuerySchema = z.object({
  timeframe: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'this_year']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dealerId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
});

module.exports = {
  analyticsQuerySchema,
};
