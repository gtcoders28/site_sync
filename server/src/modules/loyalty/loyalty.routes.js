const express = require('express');
const router = express.Router();
const loyaltyController = require('./loyalty.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePlatformOwner } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const {
  requestRedemptionSchema,
  resolveRedemptionSchema,
  listRedemptionsQuerySchema,
  listLedgerQuerySchema,
} = require('./loyalty.validator');

router.use(authenticate);

// Profile balance & ledger
router.get('/balance', loyaltyController.getMyBalance);
router.get('/ledger', validate(listLedgerQuerySchema, 'query'), loyaltyController.getLedger);

// Redemption requests
router.post('/redeem', validate(requestRedemptionSchema), loyaltyController.requestRedemption);
router.get('/redemptions', validate(listRedemptionsQuerySchema, 'query'), loyaltyController.getRedemptions);

// Platform Owner ONLY: approve or reject redemption requests
router.post(
  '/redemptions/:redemptionId/resolve',
  requirePlatformOwner,
  validate(resolveRedemptionSchema),
  loyaltyController.resolveRedemption
);

module.exports = router;
