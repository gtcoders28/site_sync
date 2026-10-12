import { Request, Response, NextFunction } from 'express';
import { invoicesService } from './invoices.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class InvoicesController {
  // Distributor Invoices
  async createDistributorInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.createDistributorInvoice(req.body, req.user as UserContext);
      const msg =
        result.approval_status === 'pending_approval'
          ? 'Draft distributor invoice submitted for approval'
          : 'Distributor invoice created with in-transit reservation';
      APIResponse.created(res, msg, result);
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
      const msg =
        result.approval_status === 'pending_approval'
          ? 'Draft sales invoice submitted for approval'
          : 'Dealer invoice created and processed';
      APIResponse.created(res, msg, result);
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

  // Pending Approvals & Drafts
  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.listPendingApprovals(req.user as UserContext);
      APIResponse.success(res, 'Pending draft invoices retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getMyDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoicesService.listMyDrafts(req.user as UserContext);
      APIResponse.success(res, 'My drafted invoices retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async approveInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = req.params.invoiceId as string;
      const result = await invoicesService.approveInvoice(invoiceId, req.user as UserContext);
      APIResponse.success(res, 'Invoice approved and stock updated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async rejectInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = req.params.invoiceId as string;
      const rejectionReason = req.body?.rejectionReason || null;
      const result = await invoicesService.rejectInvoice(invoiceId, rejectionReason, req.user as UserContext);
      APIResponse.success(res, 'Draft invoice rejected', result);
    } catch (err) {
      next(err);
    }
  }
}

export const invoicesController = new InvoicesController();
export default invoicesController;
