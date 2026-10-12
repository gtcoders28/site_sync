import { Router } from 'express';
import { staffController } from './staff.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import {
  createStaffSchema,
  updateStaffStatusSchema,
  updateStaffPermissionsSchema,
  listStaffQuerySchema,
} from './staff.validator';

const router = Router();

// All staff endpoints require authentication
router.use(authenticate);

// Onboard new staff member under parent organization
router.post(
  '/',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  validate(createStaffSchema),
  staffController.createStaff
);

// List staff members under caller's organization
router.get(
  '/',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.STAFF),
  validate(listStaffQuerySchema, 'query'),
  staffController.getStaff
);

// Toggle staff active / inactive / suspended status
router.patch(
  '/:id/status',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  validate(updateStaffStatusSchema),
  staffController.updateStatus
);

// Update permissions (can_create_invoices, can_approve_registrations)
router.patch(
  '/:id/permissions',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  validate(updateStaffPermissionsSchema),
  staffController.updatePermissions
);

// Delete staff member
router.delete(
  '/:id',
  authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER),
  staffController.deleteStaff
);

export default router;
