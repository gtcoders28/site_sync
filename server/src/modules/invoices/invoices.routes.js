const express = require('express');
const router = express.Router();
const invoicesController = require('./invoices.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const {
  createDistributorInvoiceSchema,
  createDealerInvoiceSchema,
  updateInvoiceStatusSchema,
  listInvoicesQuerySchema,
} = require('./invoices.validator');

router.use(authenticate);

// Distributor Invoices (B2B)
router.post(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR),
  validate(createDistributorInvoiceSchema),
  invoicesController.createDistributorInvoice
);
router.patch(
  '/distributor/:invoiceId/status',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR),
  validate(updateInvoiceStatusSchema),
  invoicesController.updateDistributorInvoiceStatus
);
router.get(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER),
  validate(listInvoicesQuerySchema, 'query'),
  invoicesController.getDistributorInvoices
);

// Dealer Invoices (B2C)
router.post(
  '/dealer',
  authorizeRoles(ROLES.DEALER),
  validate(createDealerInvoiceSchema),
  invoicesController.createDealerInvoice
);
router.get(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.CUSTOMER, ROLES.INFLUENCER),
  validate(listInvoicesQuerySchema, 'query'),
  invoicesController.getDealerInvoices
);

module.exports = router;
