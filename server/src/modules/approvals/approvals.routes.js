const express = require('express');
const router = express.Router();
const approvalsController = require('./approvals.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { ROLES } = require('../../config/constants');
const { resolveRequestSchema, listRequestsQuerySchema } = require('./approvals.validator');

router.use(authenticate);
router.use(authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER));

// List registration requests under this parent
router.get('/', validate(listRequestsQuerySchema, 'query'), approvalsController.getRequests);

// Resolve registration request
router.post('/:requestId/resolve', validate(resolveRequestSchema), approvalsController.resolveRequest);

module.exports = router;
