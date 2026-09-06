const invoicesService = require('./invoices.service');
const { APIResponse } = require('../../utils/apiResponse');

class InvoicesController {
  // Distributor Invoices
  async createDistributorInvoice(req, res, next) {
    try {
      const result = await invoicesService.createDistributorInvoice(req.body, req.user);
      return APIResponse.created(res, 'Distributor invoice created with in-transit reservation', result);
    } catch (err) {
      next(err);
    }
  }

  async updateDistributorInvoiceStatus(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const { status } = req.body;
      const result = await invoicesService.updateDistributorInvoiceStatus(invoiceId, status, req.user);
      return APIResponse.success(res, `Distributor invoice status updated to '${result.status}'`, result);
    } catch (err) {
      next(err);
    }
  }

  async getDistributorInvoices(req, res, next) {
    try {
      const result = await invoicesService.listDistributorInvoices(req.query, req.user);
      return APIResponse.paginated(res, 'Distributor invoices retrieved successfully', result.invoices, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  // Dealer Invoices
  async createDealerInvoice(req, res, next) {
    try {
      const result = await invoicesService.createDealerInvoice(req.body, req.user);
      return APIResponse.created(res, 'Dealer invoice created and points credited', result);
    } catch (err) {
      next(err);
    }
  }

  async getDealerInvoices(req, res, next) {
    try {
      const result = await invoicesService.listDealerInvoices(req.query, req.user);
      return APIResponse.paginated(res, 'Dealer invoices retrieved successfully', result.invoices, result.pagination);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InvoicesController();
