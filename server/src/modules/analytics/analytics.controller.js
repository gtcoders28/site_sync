const analyticsService = require('./analytics.service');
const { APIResponse } = require('../../utils/apiResponse');

class AnalyticsController {
  async getDealerAnalytics(req, res, next) {
    try {
      const result = await analyticsService.getDealerAnalytics(req.query, req.user);
      return APIResponse.success(res, 'Dealer analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getDistributorAnalytics(req, res, next) {
    try {
      const result = await analyticsService.getDistributorAnalytics(req.query, req.user);
      return APIResponse.success(res, 'Distributor analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getPlatformOwnerAnalytics(req, res, next) {
    try {
      const result = await analyticsService.getPlatformOwnerAnalytics(req.query, req.user);
      return APIResponse.success(res, 'Platform-wide analytics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
