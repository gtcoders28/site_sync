import { Request, Response, NextFunction } from 'express';
import { loyaltyService } from './loyalty.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class LoyaltyController {
  async getMyBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as UserContext;
      const profileType = user.role === 'dealer' ? 'dealer' : user.role;
      const profileId = user.entityId || user.id;
      const result = await loyaltyService.getBalance(profileType, profileId);
      APIResponse.success(res, 'Points balance retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await loyaltyService.getLedger(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Points ledger history retrieved', result.entries, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async requestRedemption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await loyaltyService.requestRedemption(req.body, req.user as UserContext);
      APIResponse.created(res, 'Redemption request submitted to Platform Owner for review', result);
    } catch (err) {
      next(err);
    }
  }

  async getRedemptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await loyaltyService.listRedemptions(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Points redemptions retrieved', result.redemptions, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async resolveRedemption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const redemptionId = req.params.redemptionId as string;
      const result = await loyaltyService.resolveRedemption(redemptionId, req.body, req.user as UserContext);
      APIResponse.success(res, `Points redemption request ${result.status}`, result);
    } catch (err) {
      next(err);
    }
  }
}

export const loyaltyController = new LoyaltyController();
export default loyaltyController;
