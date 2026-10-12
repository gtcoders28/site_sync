import { Router } from 'express';
import { approvalsController } from './approvals.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import { resolveRequestSchema, listRequestsQuerySchema } from './approvals.validator';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER, ROLES.RETAILER, ROLES.STAFF));

// List registration requests under this parent / staff's employer
router.get('/', validate(listRequestsQuerySchema, 'query'), approvalsController.getRequests);
router.get('/registration-requests', validate(listRequestsQuerySchema, 'query'), approvalsController.getRequests);

// Specific approve / reject endpoints
router.post('/registration-requests/:requestId/approve', approvalsController.approveRequest);
router.post('/registration-requests/:requestId/reject', approvalsController.rejectRequest);

// Generic resolve registration request (approve or reject)
router.post('/:requestId/resolve', validate(resolveRequestSchema), approvalsController.resolveRequest);
router.post('/:requestId/approve', approvalsController.approveRequest);
router.post('/:requestId/reject', approvalsController.rejectRequest);

export default router;
