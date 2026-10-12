import { Request, Response, NextFunction } from 'express';
import { staffService } from './staff.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class StaffController {
  async createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await staffService.createStaff(req.body, req.user as UserContext);
      APIResponse.created(res, 'Staff member onboarded successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await staffService.listStaff(req.user as UserContext, req.query);
      APIResponse.paginated(res, 'Staff directory retrieved successfully', result.staff, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = req.params.id as string;
      const result = await staffService.updateStaffStatus(staffId, req.body.status, req.user as UserContext);
      APIResponse.success(res, `Staff status changed to ${req.body.status}`, result);
    } catch (err) {
      next(err);
    }
  }

  async updatePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = req.params.id as string;
      const result = await staffService.updateStaffPermissions(staffId, req.body, req.user as UserContext);
      APIResponse.success(res, 'Staff operational permissions updated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async deleteStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffId = req.params.id as string;
      const result = await staffService.deleteStaff(staffId, req.user as UserContext);
      APIResponse.success(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }
}

export const staffController = new StaffController();
export default staffController;
