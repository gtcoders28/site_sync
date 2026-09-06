const express = require('express');
const router = express.Router();

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const approvalsRoutes = require('./modules/approvals/approvals.routes');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const purchasesRoutes = require('./modules/purchases/purchases.routes');
const invoicesRoutes = require('./modules/invoices/invoices.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const loyaltyRoutes = require('./modules/loyalty/loyalty.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');

// Mount module routes under /api/v1
router.use('/auth', authRoutes);

// Optional top-level aliases (allowing /api/v1/distributor/signup, /api/v1/dealer/signup, etc.)
router.use('/', authRoutes);

router.use('/users', usersRoutes);
router.use('/approvals', approvalsRoutes);
router.use('/catalog', catalogRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
