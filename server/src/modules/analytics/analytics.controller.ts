import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { APIResponse } from '../../utils/apiResponse';
import { AnalyticsQueryInput } from './analytics.validator';

export class AnalyticsController {
  async getDealerAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getDealerAnalytics(req.query as unknown as AnalyticsQueryInput, req.user!);
      return APIResponse.success(res, 'Dealer analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getDistributorAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getDistributorAnalytics(req.query as unknown as AnalyticsQueryInput, req.user!);
      return APIResponse.success(res, 'Distributor analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getPlatformOwnerAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getPlatformOwnerAnalytics(req.query as unknown as AnalyticsQueryInput, req.user!);
      return APIResponse.success(res, 'Platform-wide analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
