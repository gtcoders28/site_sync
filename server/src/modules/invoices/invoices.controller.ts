import { Request, Response, NextFunction } from 'express';
import { invoicesService } from './invoices.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class InvoicesController {
  // Distributor Invoices
  async createDistributorInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.createDistributorInvoice(req.body, req.user as UserContext);
      APIResponse.created(res, 'Distributor invoice created with in-transit reservation', result);
    } catch (err) {
      next(err);
    }
  }

  async updateDistributorInvoiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = req.params.invoiceId as string;
      const { status } = req.body;
      const result = await invoicesService.updateDistributorInvoiceStatus(invoiceId, status, req.user as UserContext);
      APIResponse.success(res, `Distributor invoice status updated to '${result.status}'`, result);
    } catch (err) {
      next(err);
    }
  }

  async getDistributorInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.listDistributorInvoices(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Distributor invoices retrieved successfully', result.invoices, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  // Dealer Invoices
  async createDealerInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.createDealerInvoice(req.body, req.user as UserContext);
      APIResponse.created(res, 'Dealer invoice created and points credited', result);
    } catch (err) {
      next(err);
    }
  }

  async getDealerInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.listDealerInvoices(req.query, req.user as UserContext);
      APIResponse.paginated(res, 'Dealer invoices retrieved successfully', result.invoices, result.pagination);
    } catch (err) {
      next(err);
    }
  }
}

export const invoicesController = new InvoicesController();
export default invoicesController;
