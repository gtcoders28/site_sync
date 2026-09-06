const purchasesService = require('./purchases.service');
const { APIResponse } = require('../../utils/apiResponse');

class PurchasesController {
  async createPurchase(req, res, next) {
    try {
      const result = await purchasesService.createPurchase(req.body, req.user);
      return APIResponse.created(res, 'Purchase order created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getPurchases(req, res, next) {
    try {
      const result = await purchasesService.listPurchases(req.query, req.user);
      return APIResponse.paginated(res, 'Purchases retrieved successfully', result.purchases, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseById(req, res, next) {
    try {
      const { purchaseId } = req.params;
      const result = await purchasesService.getPurchaseById(purchaseId, req.user);
      return APIResponse.success(res, 'Purchase retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { purchaseId } = req.params;
      const { status } = req.body;
      const result = await purchasesService.updatePurchaseStatus(purchaseId, status, req.user);
      return APIResponse.success(res, `Purchase order status updated to '${result.status}'`, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PurchasesController();
