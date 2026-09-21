import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class UsersController {
  async getDistributors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.listDistributors(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Distributors retrieved successfully', result.distributors, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getDealers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.listDealers(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Dealers retrieved successfully', result.dealers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.listCustomers(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Customers retrieved successfully', result.customers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getInfluencers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.listInfluencers(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Influencers retrieved successfully', result.influencers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async changeMobile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.changeMobileNumber(req.user as UserContext, req.body);
      APIResponse.success(res, result.message, { newMobileNumber: result.newMobileNumber });
    } catch (err) {
      next(err);
    }
  }

  async deleteDealer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dealerId = req.params.dealerId as string;
      const result = await usersService.deleteDealer(dealerId, req.user as UserContext);
      APIResponse.success(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.params.customerId as string;
      const result = await usersService.deleteCustomer(customerId, req.user as UserContext);
      APIResponse.success(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
export default usersController;
