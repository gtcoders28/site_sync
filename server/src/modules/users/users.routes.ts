import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles, requirePlatformOwner } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import {
  changeMobileNumberSchema,
  listUsersQuerySchema,
} from './users.validator';

const router = Router();

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

// Delete Dealer (Platform Owner or Distributor)
router.delete(
  '/dealers/:dealerId',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR),
  usersController.deleteDealer
);

// Delete Customer (Platform Owner, Distributor, or Dealer)
router.delete(
  '/customers/:customerId',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  usersController.deleteCustomer
);

export default router;
