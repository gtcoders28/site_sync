const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requirePlatformOwner } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const {
  updateProfileSchema,
  changeMobileNumberSchema,
  listUsersQuerySchema,
} = require('./users.validator');

// All users routes require authentication
router.use(authenticate);

// Distributor routes (Platform owner only for full list)
router.get('/distributors', requirePlatformOwner, validate(listUsersQuerySchema, 'query'), usersController.getDistributors);

// Dealers list (Platform owner or Distributor for their dealers, or Dealer for self)
router.get(
  '/dealers',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(listUsersQuerySchema, 'query'),
  usersController.getDealers
);

// Customers list
router.get(
  '/customers',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.CUSTOMER),
  validate(listUsersQuerySchema, 'query'),
  usersController.getCustomers
);

// Influencers list
router.get(
  '/influencers',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.INFLUENCER),
  validate(listUsersQuerySchema, 'query'),
  usersController.getInfluencers
);

// Change mobile number via Aadhar verification
router.patch('/change-mobile', validate(changeMobileNumberSchema), usersController.changeMobile);

module.exports = router;
