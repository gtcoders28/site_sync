import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  FileCheck2,
  AlertCircle,
  RefreshCw,
  Search,
  Eye,
  User,
  Building,
  Calendar,
  Receipt,
  FileText,
  DollarSign,
  Info,
} from 'lucide-react';
import { formatINR } from '../../utils';
import { ordersApi, type DistributorInvoice, type DealerInvoice } from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';

type InvoiceRecord = DistributorInvoice | DealerInvoice;

export default function PendingInvoiceApprovals({
  mode = 'distributor',
}: {
  mode?: 'distributor' | 'dealer';
}) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected for inspection
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadPendingInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ordersApi.getPendingApprovals();
      const list = Array.isArray(res?.data) ? res.data : [];
      setInvoices(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pending invoices awaiting review.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingInvoices();
  }, [mode]);

  const handleApprove = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to approve this invoice? Inventory stock will be deducted immediately.')) {
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setSuccess(null);
      const res = await ordersApi.approveInvoice(invoiceId);
      setSuccess(res.message || 'Invoice approved successfully and inventory updated.');
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice(null);
      }
      await loadPendingInvoices();
    } catch (err: any) {
      setError(err?.message || 'Failed to approve invoice.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;

    try {
      setIsProcessing(true);
      setError(null);
      setSuccess(null);
      const res = await ordersApi.rejectInvoice(rejectingId, rejectionReason);
      setSuccess(res.message || 'Invoice draft was rejected.');
      setRejectingId(null);
      setRejectionReason('');
      if (selectedInvoice?.invoice_id === rejectingId) {
        setSelectedInvoice(null);
      }
      await loadPendingInvoices();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject invoice.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered invoices
  const filtered = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const invNum = (inv.invoice_number || '').toLowerCase();
    const staff = (inv.staff_name || '').toLowerCase();
    const recipient = (
      (inv as any).dealer_name ||
      (inv as any).customer_name ||
      (inv as any).buyer_dealer_name ||
      ''
    ).toLowerCase();
    return invNum.includes(term) || staff.includes(term) || recipient.includes(term);
  });

  // Aggregated KPIs
  const totalPendingAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const totalTaxable = invoices.reduce((sum, inv) => sum + Number(inv.taxable_amount || 0), 0);
  const totalGst = invoices.reduce(
    (sum, inv) =>
      sum +
      Number(inv.cgst_amount || 0) +
      Number(inv.sgst_amount || 0) +
      Number(inv.igst_amount || 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Pending Invoice Approvals
            </h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              {invoices.length} Waiting Review
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review invoices submitted by staff members before inventory is deducted and billing is finalized.
          </p>
        </div>

        <button
          onClick={loadPendingInvoices}
          disabled={loading || isProcessing}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Pipeline
        </button>
      </div>

      {/* Status Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Awaiting Approval
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileCheck2 size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{invoices.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Staff-drafted invoices requiring sign-off</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Invoiced Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatINR(totalPendingAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Taxable: {formatINR(totalTaxable)}
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              GST / Tax Snapshot
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{formatINR(totalGst)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Aggregated CGST + SGST + IGST</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by invoice number, staff name, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Invoices List / Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <RefreshCw size={24} className="mx-auto animate-spin text-orange-500 mb-2" />
            Loading pending approvals…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="No Invoices Pending Approval"
              description={
                searchTerm
                  ? 'No drafts match your search filter.'
                  : 'All staff invoices have been reviewed and approved. Great job!'
              }
              icon={FileCheck2}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Drafted By (Staff)</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => {
                  const recipientName =
                    (inv as any).dealer_name ||
                    (inv as any).customer_name ||
                    (inv as any).buyer_dealer_name ||
                    'Customer';
                  const gstSum =
                    Number(inv.cgst_amount || 0) +
                    Number(inv.sgst_amount || 0) +
                    Number(inv.igst_amount || 0);

                  return (
                    <tr
                      key={inv.invoice_id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Receipt size={14} className="text-orange-500" />
                          <span>{inv.invoice_number || inv.invoice_id.slice(0, 8)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block pl-5">
                          {inv.invoice_date || (inv.created_at || '').slice(0, 10)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <User size={13} className="text-slate-400" />
                          <span>{inv.staff_name || 'Staff Member'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block pl-4">
                          Staff ID: {(inv.created_by_staff_id || '').slice(0, 8) || 'N/A'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Building size={13} className="text-slate-400" />
                          <span>{recipientName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatINR(Number(inv.taxable_amount || inv.total_amount || 0))}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatINR(gstSum)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                        {formatINR(Number(inv.total_amount || 0))}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending Approval
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => handleApprove(inv.invoice_id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            title="Approve & Deduct Stock"
                          >
                            <CheckCircle2 size={13} />
                            Approve
                          </button>

                          <button
                            onClick={() => setRejectingId(inv.invoice_id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            title="Reject Draft"
                          >
                            <XCircle size={13} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Invoice Breakdown: {selectedInvoice.invoice_number}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drafted by {selectedInvoice.staff_name || 'Staff'} on{' '}
                  {selectedInvoice.invoice_date || (selectedInvoice.created_at || '').slice(0, 10)}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ×
              </button>
            </div>

            {/* Recipient / Address Snapshot */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="font-bold text-slate-700 block">Recipient Information:</span>
                <p className="text-slate-600 mt-1">
                  {(selectedInvoice as any).dealer_name ||
                    (selectedInvoice as any).customer_name ||
                    (selectedInvoice as any).buyer_dealer_name ||
                    'Customer'}
                </p>
                {selectedInvoice.buyer_gstin && (
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    GSTIN: {selectedInvoice.buyer_gstin}
                  </p>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Addresses:</span>
                <p className="text-slate-600 mt-1">
                  Billing: {selectedInvoice.billing_address || 'Same as profile'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Shipping: {selectedInvoice.shipping_address || 'Same as profile'}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Line Items
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3 text-center">HSN/SAC</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">GST %</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 ? (
                      selectedInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.product_name || item.productName || item.product_id || 'Item'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {item.hsn_sac_code || item.hsnSacCode || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {formatINR(Number(item.unit_price || item.unitPrice || 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {Number(item.gst_rate || item.gstRate || 0)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatINR(
                              Number(
                                item.total_amount ||
                                  item.totalAmount ||
                                  Number(item.quantity) * Number(item.unit_price || item.unitPrice || 0)
                              )
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400">
                          Line items preview not available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-semibold">{formatINR(Number(selectedInvoice.taxable_amount || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST:</span>
                <span className="font-semibold">{formatINR(Number(selectedInvoice.cgst_amount || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST:</span>
                <span className="font-semibold">{formatINR(Number(selectedInvoice.sgst_amount || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IGST:</span>
                <span className="font-semibold">{formatINR(Number(selectedInvoice.igst_amount || 0))}</span>
              </div>
              {selectedInvoice.round_off_amount !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Round-off:</span>
                  <span className="font-semibold">{formatINR(Number(selectedInvoice.round_off_amount || 0))}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
                <span>Grand Total:</span>
                <span className="text-orange-600">{formatINR(Number(selectedInvoice.total_amount || 0))}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setRejectingId(selectedInvoice.invoice_id);
                }}
                className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200"
              >
                Reject Draft
              </button>
              <button
                onClick={() => handleApprove(selectedInvoice.invoice_id)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
              >
                Approve & Deduct Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">Reject Invoice Draft</h3>
            <p className="text-xs text-slate-500">
              Provide a clear reason for rejecting this staff invoice so they can review and make corrections.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Incorrect quantity requested or customer billing address mismatch"
              rows={3}
              className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
