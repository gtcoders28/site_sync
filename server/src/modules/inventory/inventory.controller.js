const inventoryService = require('./inventory.service');
const { APIResponse } = require('../../utils/apiResponse');

class InventoryController {
  async getDistributorInventory(req, res, next) {
    try {
      const result = await inventoryService.getDistributorInventory(req.query, req.user);
      return APIResponse.paginated(res, 'Distributor inventory retrieved', result.inventory, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getDealerInventory(req, res, next) {
    try {
      const result = await inventoryService.getDealerInventory(req.query, req.user);
      return APIResponse.paginated(res, 'Dealer inventory retrieved', result.inventory, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req, res, next) {
    try {
      const result = await inventoryService.getInventoryMovements(req.query, req.user);
      return APIResponse.paginated(res, 'Inventory movements retrieved', result.movements, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async manualAdjustment(req, res, next) {
    try {
      const result = await inventoryService.manualAdjustment(req.body, req.user);
      return APIResponse.success(res, 'Inventory adjusted successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InventoryController();
