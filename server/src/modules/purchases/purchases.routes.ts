import { Router } from 'express';
import { purchasesController } from './purchases.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import {
  createPurchaseSchema,
  updatePurchaseStatusSchema,
  listPurchasesQuerySchema,
} from './purchases.validator';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR));

router.post('/', validate(createPurchaseSchema), purchasesController.createPurchase);
router.get('/', validate(listPurchasesQuerySchema, 'query'), purchasesController.getPurchases);
router.get('/:purchaseId', purchasesController.getPurchaseById);
router.patch('/:purchaseId/status', validate(updatePurchaseStatusSchema), purchasesController.updateStatus);

export default router;
