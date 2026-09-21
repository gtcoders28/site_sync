import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Trash2, Receipt, AlertCircle, RefreshCw, Clock, XCircle } from 'lucide-react';
import { formatINR } from '../../utils';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { ordersApi, catalogApi, usersApi } from '../../lib/api';
import type { Product as CatalogProduct } from '../../lib/api/catalog';

type Mode = 'distributor' | 'dealer';
type LineItem = { productId: string; productName: string; quantity: string; unitPrice: string };

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  recipientName: string;
  recipientType: 'dealer' | 'customer';
  amount: number;
  status: 'pending' | 'delivered' | 'cancelled';
}

const today = () => new Date().toISOString().slice(0, 10);
const invoicePrefix = (mode: Mode) => `${mode === 'distributor' ? 'DIST' : 'DLR'}-${Math.floor(1000 + Math.random() * 9000)}`;

export default function InvoiceWorkspace({ mode }: { mode: Mode }) {
  const isDistributor = mode === 'distributor';
  const recipientLabel = isDistributor ? 'Dealer' : 'Customer';
  const invoiceTitle = isDistributor ? 'Distributor Invoices & Billing' : 'Customer Invoices & Billing';

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipientId, setRecipientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(invoicePrefix(mode));
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invoicesRes, prodsRes, recipientsRes] = await Promise.all([
        isDistributor ? ordersApi.getDistributorInvoices() : ordersApi.getDealerInvoices(),
        catalogApi.getProducts().catch(() => ({ success: true, data: [] })),
        isDistributor
          ? usersApi.getDealers().catch(() => ({ success: true, data: [] }))
          : usersApi.getCustomers().catch(() => ({ success: true, data: [] })),
      ]);

      const rawInvoices = Array.isArray(invoicesRes?.data) ? invoicesRes.data : [];
      const mappedInvoices: InvoiceRecord[] = rawInvoices.map((inv: any) => ({
        id: inv.invoice_id,
        invoiceNumber: inv.invoice_number || inv.invoice_id?.slice(0, 8) || '#INV',
        date: (inv.invoice_date || inv.created_at || today()).slice(0, 10),
        recipientName: isDistributor
          ? inv.dealer_name || 'Dealer'
          : inv.customer_name || 'Customer',
        recipientType: (isDistributor ? 'dealer' : 'customer') as 'dealer' | 'customer',
        amount: Number(inv.total_amount || 0),
        status: inv.status || 'pending',
      }));

      setInvoices(mappedInvoices);

      const prodsList = Array.isArray(prodsRes?.data) ? prodsRes.data : [];
      setProducts(prodsList);

      if (isDistributor) {
        const dList = Array.isArray(recipientsRes?.data) ? recipientsRes.data : [];
        setDealers(dList);
      } else {
        const cList = Array.isArray(recipientsRes?.data) ? recipientsRes.data : [];
        setCustomers(cList);
      }

      // Initialize line items with one entry if products exist and items currently empty
      if (items.length === 0 && prodsList.length > 0) {
        setItems([
          {
            productId: prodsList[0].product_id,
            productName: prodsList[0].variant_name,
            quantity: '1',
            unitPrice: String(prodsList[0].unit_price || '0'),
          },
        ]);
      } else if (items.length === 0) {
        setItems([{ productId: '', productName: '', quantity: '1', unitPrice: '0' }]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load billing records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
    [items]
  );

  const updateItem = (index: number, patch: Partial<LineItem>) =>
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  const handleProductSelect = (index: number, prodId: string) => {
    const selected = products.find((p) => p.product_id === prodId);
    if (selected) {
      updateItem(index, {
        productId: selected.product_id,
        productName: selected.variant_name,
        unitPrice: String(selected.unit_price),
      });
    } else {
      updateItem(index, { productId: prodId });
    }
  };

  const handleAddLineItem = () => {
    if (products.length > 0) {
      setItems((current) => [
        ...current,
        {
          productId: products[0].product_id,
          productName: products[0].variant_name,
          quantity: '1',
          unitPrice: String(products[0].unit_price || '0'),
        },
      ]);
    } else {
      setItems((current) => [
        ...current,
        { productId: '', productName: '', quantity: '1', unitPrice: '0' },
      ]);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!recipientId) {
      setError(`Please select a registered ${recipientLabel.toLowerCase()}.`);
      return;
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      productName: item.productName || 'Material Item',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    if (
      normalizedItems.length === 0 ||
      normalizedItems.some(
        (item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0
      )
    ) {
      setError(`Please select valid products with positive quantity and non-negative unit price.`);
      return;
    }

    try {
      setIsSubmitting(true);
      if (isDistributor) {
        await ordersApi.createDistributorInvoice({
          dealerId: recipientId,
          invoiceNumber,
          items: normalizedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        });
      } else {
        await ordersApi.createDealerInvoice({
          customerId: recipientId,
          invoiceNumber,
          items: normalizedItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        });
      }

      setSuccess(`Invoice ${invoiceNumber} created and recorded successfully! Total: ${formatINR(total)}`);
      setInvoiceNumber(invoicePrefix(mode));
      setRecipientId('');
      if (products.length > 0) {
        setItems([
          {
            productId: products[0].product_id,
            productName: products[0].variant_name,
            quantity: '1',
            unitPrice: String(products[0].unit_price || '0'),
          },
        ]);
      } else {
        setItems([{ productId: '', productName: '', quantity: '1', unitPrice: '0' }]);
      }
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Invoice could not be created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{invoiceTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and record verified {isDistributor ? 'distributor-to-dealer' : 'dealer-to-customer'} invoices directly in PostgreSQL.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-orange-600' : 'text-slate-500'} />
          <span>Refresh Data</span>
        </button>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Invoice Number *
            <input
              required
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Invoice Date *
            <input
              required
              type="date"
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              {recipientLabel} Recipient *
            </label>
            {isDistributor ? (
              dealers.length > 0 ? (
                <CustomDropdown
                  value={recipientId}
                  onChange={setRecipientId}
                  options={[
                    { value: '', label: 'Select registered dealer...' },
                    ...dealers.map((d) => ({
                      value: d.dealer_id,
                      label: `${d.shop_name || d.owner_name} (${d.city || 'Depot'})`,
                    })),
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-2.5 text-xs text-amber-800">
                  No dealers registered in network yet. Add a dealer via Dealer Directory first.
                </div>
              )
            ) : customers.length > 0 ? (
              <CustomDropdown
                value={recipientId}
                onChange={setRecipientId}
                options={[
                  { value: '', label: 'Select registered customer...' },
                  ...customers.map((c) => ({
                    value: c.customer_id,
                    label: `${c.name || c.mobile_number} (${c.city || 'Local'})`,
                  })),
                ]}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-2.5 text-xs text-amber-800">
                No customers registered in directory yet. Add a customer via Customer Directory first.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Invoice Line Items</h2>
            <button
              type="button"
              onClick={handleAddLineItem}
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              <Plus size={15} /> Add Line Item
            </button>
          </div>

          {products.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                No products found in the catalog. Add material products in <strong>Inventory & Catalog</strong> before creating invoices.
              </span>
            </div>
          )}

          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/60 md:grid-cols-[minmax(0,1fr)_120px_140px_auto]"
            >
              {products.length > 0 ? (
                <CustomDropdown
                  value={item.productId}
                  onChange={(val) => handleProductSelect(index, val)}
                  options={[
                    { value: '', label: 'Select catalog product...' },
                    ...products.map((p) => ({
                      value: p.product_id,
                      label: `${p.variant_name} (${formatINR(p.unit_price)} / ${p.unit})`,
                    })),
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2"
                  menuClassName="w-full"
                />
              ) : (
                <input
                  disabled
                  placeholder="No catalog products available"
                  value={item.productName}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
                />
              )}

              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                placeholder="Qty"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              />

              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                placeholder="Unit Price"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              />

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="justify-self-end rounded-xl p-2 text-red-500 hover:bg-red-50 cursor-pointer"
                  aria-label="Remove invoice item"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xl font-black text-slate-900">Total: {formatINR(total)}</span>
          <button
            type="submit"
            disabled={isSubmitting || products.length === 0 || (isDistributor ? dealers.length === 0 : customers.length === 0)}
            className="rounded-xl bg-orange-600 px-6 py-2.5 font-bold text-white hover:bg-orange-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording Invoice...' : 'Create & Record Invoice'}
          </button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">{error}</p>}
        {success && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={16} /> {success}
          </p>
        )}
      </form>

      {/* Invoices History Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">{invoiceTitle} History</h2>

        {invoices.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={Receipt}
              title="No Invoices Issued Yet"
              description="Generated invoices recorded in PostgreSQL will appear here with item breakdown, recipient details, and settlement status."
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">INVOICE NUMBER</th>
                  <th className="px-5 py-3.5">DATE</th>
                  <th className="px-5 py-3.5">RECIPIENT ENTITY</th>
                  <th className="px-5 py-3.5">INVOICE TOTAL</th>
                  <th className="px-5 py-3.5">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">{inv.date}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-bold">{inv.recipientName}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {inv.recipientType}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-900 whitespace-nowrap">{formatINR(inv.amount)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {inv.status === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Delivered
                        </span>
                      ) : inv.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={12} className="text-rose-600" />
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={12} className="text-amber-600" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
