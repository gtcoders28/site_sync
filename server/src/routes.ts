import { Router } from 'express';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import approvalsRoutes from './modules/approvals/approvals.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import purchasesRoutes from './modules/purchases/purchases.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import loyaltyRoutes from './modules/loyalty/loyalty.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';

const router = Router();

// Mount module routes under /api/v1
router.use('/auth', authRoutes);

// Top-level aliases (e.g., /api/v1/distributor/signup, /api/v1/dealer/signup)
router.use('/', authRoutes);

router.use('/users', usersRoutes);
router.use('/approvals', approvalsRoutes);
router.use('/catalog', catalogRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
