import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles, requirePlatformOwner } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import { analyticsQuerySchema } from './analytics.validator';

const router = Router();

router.use(authenticate);

// Dealer analytics (own metrics or accessed by parent distributor)
router.get(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
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

export default router;
