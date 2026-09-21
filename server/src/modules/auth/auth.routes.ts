import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { requirePlatformOwner } from '../../middlewares/rbac.middleware';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware';
import {
  signInSchema,
  refreshTokenSchema,
  createDistributorSchema,
  signUpDealerSchema,
  signUpCustomerSchema,
  signUpInfluencerSchema,
} from './auth.validator';

const router = Router();

// Universal Sign In / Login
router.post('/signin', authRateLimiter, validate(signInSchema), authController.signIn);
router.post('/login', authRateLimiter, validate(signInSchema), authController.signIn);

// Role-Specific Sign In
router.post('/distributor/signin', authRateLimiter, validate(signInSchema), authController.signInDistributor);
router.post('/dealer/signin', authRateLimiter, validate(signInSchema), authController.signInDealer);
router.post('/customer/signin', authRateLimiter, validate(signInSchema), authController.signInCustomer);
router.post('/influencer/signin', authRateLimiter, validate(signInSchema), authController.signInInfluencer);

// Platform Owner ONLY: Create Regional Distributor (no public self-registration)
router.post(
  '/distributor/create',
  authenticate,
  requirePlatformOwner,
  validate(createDistributorSchema),
  authController.createDistributor
);

// Role-Specific Sign Up (supports both authenticated creator and public self-registration)
router.post('/dealer/signup', authRateLimiter, optionalAuthenticate, validate(signUpDealerSchema), authController.registerDealer);
router.post('/customer/signup', authRateLimiter, optionalAuthenticate, validate(signUpCustomerSchema), authController.registerCustomer);
router.post('/influencer/signup', authRateLimiter, optionalAuthenticate, validate(signUpInfluencerSchema), authController.registerInfluencer);

// Token management
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authController.logout);

// Public directory lookups for onboarding dropdowns
router.get('/public-distributors', authController.getPublicDistributors);
router.get('/public-dealers', authController.getPublicDealers);

// Authenticated user profile
router.get('/me', authenticate, authController.getMe);

export default router;
