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
  listInvoicesQuerySchema,
} from './invoices.validator';

const router = Router();

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

export default router;
