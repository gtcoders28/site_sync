import { Request, Response, NextFunction } from 'express';
import { purchasesService } from './purchases.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class PurchasesController {
  async createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchasesService.createPurchase(req.body, req.user as UserContext);
      APIResponse.created(res, 'Purchase order created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getPurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchasesService.listPurchases(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Purchases retrieved successfully', result.purchases, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purchaseId = req.params.purchaseId as string;
      const result = await purchasesService.getPurchaseById(purchaseId, req.user as UserContext);
      APIResponse.success(res, 'Purchase retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const purchaseId = req.params.purchaseId as string;
      const { status } = req.body;
      const result = await purchasesService.updatePurchaseStatus(purchaseId, status, req.user as UserContext);
      APIResponse.success(res, `Purchase order status updated to '${result.status}'`, result);
    } catch (err) {
      next(err);
    }
  }
}

export const purchasesController = new PurchasesController();
export default purchasesController;
