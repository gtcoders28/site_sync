const { z } = require('zod');
const { DEALER_TYPE, DEALER_SOURCE, CUSTOMER_CREATED_BY_TYPE, INFLUENCER_SOURCE } = require('../../config/constants');

const indianMobileRegex = /^[6-9]\d{9}$/;
const aadharRegex = /^\d{12}$/;

const signInSchema = z.object({
  mobileNumber: z.string().trim().min(10, 'Mobile number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['distributor', 'dealer', 'customer', 'influencer']).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const createDistributorSchema = z.object({
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  companyName: z.string().trim().min(2, 'Company name is required'),
  ownerName: z.string().trim().min(2, 'Owner name is required'),
  email: z.string().email('Valid email required').optional().nullable(),
  gstNumber: z.string().trim().optional().nullable(),
  aadharNumber: z.string().trim().regex(aadharRegex, 'Aadhar must be exactly 12 digits').optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  pincode: z.string().trim().optional().nullable(),
});

const signUpDealerSchema = z.object({
  distributorId: z.string().uuid('Valid distributor ID is required'),
  parentDealerId: z.string().uuid('Invalid parent dealer ID').optional().nullable(),
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  shopName: z.string().trim().min(2, 'Shop name is required'),
  ownerName: z.string().trim().min(2, 'Owner name is required'),
  dealerType: z.enum([DEALER_TYPE.WHOLESALER, DEALER_TYPE.RETAILER, DEALER_TYPE.BOTH]),
  aadharNumber: z.string().trim().regex(aadharRegex, 'Aadhar must be exactly 12 digits').optional().nullable(),
  gstNumber: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  pincode: z.string().trim().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  source: z.enum([DEALER_SOURCE.SELF_REGISTERED, DEALER_SOURCE.CREATED_BY_DISTRIBUTOR]).default(DEALER_SOURCE.SELF_REGISTERED),
});

const signUpCustomerSchema = z.object({
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().email('Valid email required').optional().nullable(),
  address: z.string().trim().optional().nullable(),
  aadharNumber: z.string().trim().regex(aadharRegex, 'Aadhar must be exactly 12 digits').optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  pincode: z.string().trim().optional().nullable(),
  referralCode: z.string().trim().optional().nullable(), // Code of customer who referred this user
  onboardingDealerId: z.string().uuid('Valid dealer ID is required').optional().nullable(),
  createdByType: z.enum([CUSTOMER_CREATED_BY_TYPE.DEALER, CUSTOMER_CREATED_BY_TYPE.DISTRIBUTOR, CUSTOMER_CREATED_BY_TYPE.SELF]).default(CUSTOMER_CREATED_BY_TYPE.SELF),
});

const signUpInfluencerSchema = z.object({
  dealerId: z.string().uuid('Valid dealer ID is required'),
  distributorId: z.string().uuid('Invalid distributor ID').optional().nullable(),
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Valid 10-digit mobile number required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name is required'),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  source: z.enum([INFLUENCER_SOURCE.CREATED_BY_DEALER, INFLUENCER_SOURCE.CREATED_BY_DISTRIBUTOR, INFLUENCER_SOURCE.SELF_REGISTERED]).default(INFLUENCER_SOURCE.SELF_REGISTERED),
});

module.exports = {
  signInSchema,
  refreshTokenSchema,
  createDistributorSchema,
  signUpDealerSchema,
  signUpCustomerSchema,
  signUpInfluencerSchema,
};
