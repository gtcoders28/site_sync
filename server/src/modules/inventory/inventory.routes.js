const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const {
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  manualAdjustmentSchema,
} = require('./inventory.validator');

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

module.exports = router;
