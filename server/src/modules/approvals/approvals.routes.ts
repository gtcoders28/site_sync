import { Router } from 'express';
import { approvalsController } from './approvals.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ROLES } from '../../config/constants';
import { resolveRequestSchema, listRequestsQuerySchema } from './approvals.validator';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.PLATFORM_OWNER_DISTRIBUTOR, ROLES.DISTRIBUTOR, ROLES.DEALER));

// List registration requests under this parent
router.get('/', validate(listRequestsQuerySchema, 'query'), approvalsController.getRequests);

// Resolve registration request
router.post('/:requestId/resolve', validate(resolveRequestSchema), approvalsController.resolveRequest);

export default router;
