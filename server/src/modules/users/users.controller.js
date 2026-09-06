const usersService = require('./users.service');
const { APIResponse } = require('../../utils/apiResponse');

class UsersController {
  async getDistributors(req, res, next) {
    try {
      const result = await usersService.listDistributors(req.query, req.user);
      return APIResponse.paginated(res, 'Distributors retrieved successfully', result.distributors, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getDealers(req, res, next) {
    try {
      const result = await usersService.listDealers(req.query, req.user);
      return APIResponse.paginated(res, 'Dealers retrieved successfully', result.dealers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getCustomers(req, res, next) {
    try {
      const result = await usersService.listCustomers(req.query, req.user);
      return APIResponse.paginated(res, 'Customers retrieved successfully', result.customers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getInfluencers(req, res, next) {
    try {
      const result = await usersService.listInfluencers(req.query, req.user);
      return APIResponse.paginated(res, 'Influencers retrieved successfully', result.influencers, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async changeMobile(req, res, next) {
    try {
      const result = await usersService.changeMobileNumber(req.user, req.body);
      return APIResponse.success(res, result.message, { newMobileNumber: result.newMobileNumber });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UsersController();
