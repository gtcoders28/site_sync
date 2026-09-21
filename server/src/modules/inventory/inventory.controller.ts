import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class InventoryController {
  async getDistributorInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inventoryService.getDistributorInventory(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Distributor inventory retrieved', result.inventory, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getDealerInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inventoryService.getDealerInventory(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Dealer inventory retrieved', result.inventory, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inventoryService.getInventoryMovements(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Inventory movements retrieved', result.movements, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async manualAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inventoryService.manualAdjustment(req.body, req.user as UserContext);
      APIResponse.success(res, 'Inventory adjusted successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
export default inventoryController;
