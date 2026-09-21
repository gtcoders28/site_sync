import { Router } from 'express';
import { loyaltyController } from './loyalty.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePlatformOwner } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  requestRedemptionSchema,
  resolveRedemptionSchema,
  listRedemptionsQuerySchema,
  listLedgerQuerySchema,
} from './loyalty.validator';

const router = Router();

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

export default router;
