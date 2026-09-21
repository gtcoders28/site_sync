import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import {
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  manualAdjustmentSchema,
} from './inventory.validator';

const router = Router();

router.use(authenticate);

// Distributor inventory
router.get(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR),
  validate(listInventoryQuerySchema, 'query'),
  inventoryController.getDistributorInventory
);

// Dealer inventory
router.get(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(listInventoryQuerySchema, 'query'),
  inventoryController.getDealerInventory
);

// Inventory movements audit trail
router.get(
  '/movements',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(listMovementsQuerySchema, 'query'),
  inventoryController.getMovements
);

// Manual stock adjustment
router.post(
  '/adjust',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(manualAdjustmentSchema),
  inventoryController.manualAdjustment
);

export default router;
