const express = require('express');
const router = express.Router();
const purchasesController = require('./purchases.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const {
  createPurchaseSchema,
  updatePurchaseStatusSchema,
  listPurchasesQuerySchema,
} = require('./purchases.validator');

router.use(authenticate);
router.use(authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR));

router.post('/', validate(createPurchaseSchema), purchasesController.createPurchase);
router.get('/', validate(listPurchasesQuerySchema, 'query'), purchasesController.getPurchases);
router.get('/:purchaseId', purchasesController.getPurchaseById);
router.patch('/:purchaseId/status', validate(updatePurchaseStatusSchema), purchasesController.updateStatus);

module.exports = router;
