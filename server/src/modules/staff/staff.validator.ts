import { z } from 'zod';
import { STAFF_STATUS } from '../../config/constants';

const indianMobileRegex = /^\d{10}$/;

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email('Valid email required').optional().nullable(),
  role: z.string().trim().default('staff'),
  canCreateInvoices: z.boolean().default(true),
  canApproveRegistrations: z.boolean().default(false),
});

export const updateStaffStatusSchema = z.object({
  status: z.enum([STAFF_STATUS.ACTIVE, STAFF_STATUS.INACTIVE, STAFF_STATUS.SUSPENDED]),
});

export const updateStaffPermissionsSchema = z.object({
  canCreateInvoices: z.boolean().optional(),
  canApproveRegistrations: z.boolean().optional(),
});

export const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum([STAFF_STATUS.ACTIVE, STAFF_STATUS.INACTIVE, STAFF_STATUS.SUSPENDED]).optional(),
});
