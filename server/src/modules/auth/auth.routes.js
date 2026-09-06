const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate, optionalAuthenticate } = require('../../middlewares/auth.middleware');
const { requirePlatformOwner } = require('../../middlewares/rbac.middleware');
const { authRateLimiter } = require('../../middlewares/rateLimiter.middleware');
const {
  signInSchema,
  refreshTokenSchema,
  createDistributorSchema,
  signUpDealerSchema,
  signUpCustomerSchema,
  signUpInfluencerSchema,
} = require('./auth.validator');

// Universal Sign In
router.post('/signin', authRateLimiter, validate(signInSchema), authController.signIn);

// Role-Specific Sign In
router.post('/distributor/signin', authRateLimiter, validate(signInSchema), authController.signInDistributor);
router.post('/dealer/signin', authRateLimiter, validate(signInSchema), authController.signInDealer);
router.post('/customer/signin', authRateLimiter, validate(signInSchema), authController.signInCustomer);
router.post('/influencer/signin', authRateLimiter, validate(signInSchema), authController.signInInfluencer);

// Platform Owner ONLY: Create Regional Distributor (no public self-registration)
router.post('/distributor/create', authenticate, requirePlatformOwner, validate(createDistributorSchema), authController.createDistributor);

// Role-Specific Sign Up (supports both authenticated creator and public self-registration)
router.post('/dealer/signup', authRateLimiter, optionalAuthenticate, validate(signUpDealerSchema), authController.registerDealer);
router.post('/customer/signup', authRateLimiter, optionalAuthenticate, validate(signUpCustomerSchema), authController.registerCustomer);
router.post('/influencer/signup', authRateLimiter, optionalAuthenticate, validate(signUpInfluencerSchema), authController.registerInfluencer);

// Token management
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authController.logout);

// Authenticated user profile
router.get('/me', authenticate, authController.getMe);

module.exports = router;
