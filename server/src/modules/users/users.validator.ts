import { z } from 'zod';

const indianMobileRegex = /^[6-9]\d{9}$/;
const aadharRegex = /^\d{12}$/;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  ownerName: z.string().trim().min(2).optional(),
  companyName: z.string().trim().min(2).optional(),
  shopName: z.string().trim().min(2).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  pincode: z.string().trim().optional().nullable(),
  gstNumber: z.string().trim().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export const changeMobileNumberSchema = z.object({
  aadharNumber: z.string().trim().regex(aadharRegex, 'Aadhar must be exactly 12 digits'),
  newMobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  distributorId: z.string().uuid().optional(),
  dealerId: z.string().uuid().optional(),
});

export default {
  updateProfileSchema,
  changeMobileNumberSchema,
  listUsersQuerySchema,
};
