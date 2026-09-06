const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requirePlatformOwner } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const { analyticsQuerySchema } = require('./analytics.validator');

router.use(authenticate);

// Dealer analytics (own metrics or accessed by parent distributor)
router.get(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getDealerAnalytics
);

// Distributor analytics (dealers strictly under this distributor)
router.get(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR),
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getDistributorAnalytics
);

// Platform Owner cross-network analytics
router.get(
  '/platform-owner',
  requirePlatformOwner,
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getPlatformOwnerAnalytics
);

module.exports = router;
