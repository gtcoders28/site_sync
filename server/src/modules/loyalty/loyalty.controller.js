const loyaltyService = require('./loyalty.service');
const { APIResponse } = require('../../utils/apiResponse');

class LoyaltyController {
  async getMyBalance(req, res, next) {
    try {
      const profileType = req.user.role === 'dealer' ? 'dealer' : req.user.role;
      const profileId = req.user.entityId || req.user.id;
      const result = await loyaltyService.getBalance(profileType, profileId);
      return APIResponse.success(res, 'Points balance retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req, res, next) {
    try {
      const result = await loyaltyService.getLedger(req.query, req.user);
      return APIResponse.paginated(res, 'Points ledger history retrieved', result.entries, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async requestRedemption(req, res, next) {
    try {
      const result = await loyaltyService.requestRedemption(req.body, req.user);
      return APIResponse.created(res, 'Redemption request submitted to Platform Owner for review', result);
    } catch (err) {
      next(err);
    }
  }

  async getRedemptions(req, res, next) {
    try {
      const result = await loyaltyService.listRedemptions(req.query, req.user);
      return APIResponse.paginated(res, 'Points redemptions retrieved', result.redemptions, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async resolveRedemption(req, res, next) {
    try {
      const { redemptionId } = req.params;
      const result = await loyaltyService.resolveRedemption(redemptionId, req.body, req.user);
      return APIResponse.success(res, `Points redemption request ${result.status}`, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LoyaltyController();
