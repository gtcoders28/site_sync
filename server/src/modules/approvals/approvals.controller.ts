import { Request, Response, NextFunction } from 'express';
import { approvalsService } from './approvals.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class ApprovalsController {
  async getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalsService.listRequests(req.user as UserContext, req.query);
      APIResponse.paginated(res, 'Registration requests retrieved', result.requests, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async resolveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.params.requestId as string;
      const result = await approvalsService.resolveRequest(requestId, req.body, req.user as UserContext);
      APIResponse.success(res, `Registration request ${result.status} successfully`, result);
    } catch (err) {
      next(err);
    }
  }
}

export const approvalsController = new ApprovalsController();
export default approvalsController;
