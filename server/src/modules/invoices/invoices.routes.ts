import { Router } from 'express';
import { invoicesController } from './invoices.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import {
  createDistributorInvoiceSchema,
  createDealerInvoiceSchema,
  updateInvoiceStatusSchema,
  rejectInvoiceSchema,
  listInvoicesQuerySchema,
} from './invoices.validator';

const router = Router();

router.use(authenticate);

// Pending invoice approvals awaiting parent review
router.get(
  '/pending-approvals',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  invoicesController.getPendingApprovals
);

// My drafts (for staff)
router.get(
  '/my-drafts',
  authorizeRoles(ROLES.STAFF),
  invoicesController.getMyDrafts
);

// Approve draft invoice (calls stored procedure for dealer invoice / locks inventory for distributor invoice)
router.post(
  '/:invoiceId/approve',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  invoicesController.approveInvoice
);

// Reject draft invoice
router.post(
  '/:invoiceId/reject',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  validate(rejectInvoiceSchema),
  invoicesController.rejectInvoice
);

// Distributor Invoices (B2B)
router.post(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.STAFF),
  validate(createDistributorInvoiceSchema),
  invoicesController.createDistributorInvoice
);
router.patch(
  '/distributor/:invoiceId/status',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  validate(updateInvoiceStatusSchema),
  invoicesController.updateDistributorInvoiceStatus
);
router.get(
  '/distributor',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.STAFF),
  validate(listInvoicesQuerySchema, 'query'),
  invoicesController.getDistributorInvoices
);

// Dealer Invoices (B2C and Dealer-to-Retailer)
router.post(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.STAFF),
  validate(createDealerInvoiceSchema),
  invoicesController.createDealerInvoice
);
router.get(
  '/dealer',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.CUSTOMER, ROLES.INFLUENCER, ROLES.STAFF),
  validate(listInvoicesQuerySchema, 'query'),
  invoicesController.getDealerInvoices
);

export default router;
