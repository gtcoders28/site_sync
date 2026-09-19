import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Trash2, Receipt } from 'lucide-react';
import { dataService, Invoice, Product } from '../../services/dataService';
import { formatINR } from '../../utils';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';

type Mode = 'distributor' | 'dealer';
type LineItem = { productId: string; productName: string; quantity: string; unitPrice: string };

const today = () => new Date().toISOString().slice(0, 10);
const invoicePrefix = (mode: Mode) => `${mode === 'distributor' ? 'DIST' : 'DLR'}-${Math.floor(1000 + Math.random() * 9000)}`;

export default function InvoiceWorkspace({ mode }: { mode: Mode }) {
  const isDistributor = mode === 'distributor';
  const recipientLabel = isDistributor ? 'Dealer' : 'Customer';
  const invoiceTitle = isDistributor ? 'Distributor Invoices & Billing' : 'Customer Invoices & Billing';

  const [invoices, setInvoices] = useState<Invoice[]>(dataService.getInvoices());
  const [dealers, setDealers] = useState(dataService.getDealers());
  const [customers, setCustomers] = useState(dataService.getCustomers());
  const [products, setProducts] = useState<Product[]>(dataService.getProducts());

  const [recipientName, setRecipientName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(invoicePrefix(mode));
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [items, setItems] = useState<LineItem[]>([
    { productId: 'default-1', productName: 'TMT Steel Rods (Grade 550D)', quantity: '1', unitPrice: '45000' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = () => {
    setInvoices(dataService.getInvoices());
    setDealers(dataService.getDealers());
    setCustomers(dataService.getCustomers());
    setProducts(dataService.getProducts());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
    [items]
  );

  const updateItem = (index: number, patch: Partial<LineItem>) =>
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  const handleProductSelect = (index: number, prodId: string) => {
    const selected = products.find((p) => p.id === prodId);
    if (selected) {
      updateItem(index, {
        productId: selected.id,
        productName: selected.name,
        unitPrice: String(selected.price),
      });
    } else {
      updateItem(index, { productId: prodId });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      productName: item.productName || 'Standard Material Item',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    if (
      !recipientName ||
      normalizedItems.some(
        (item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0
      )
    ) {
      setError(`Please specify a valid ${recipientLabel.toLowerCase()} and valid product, quantity, and unit price.`);
      return;
    }

    try {
      const created = dataService.createInvoice({
        invoiceNumber,
        recipientName,
        recipientType: isDistributor ? 'dealer' : 'customer',
        date: invoiceDate,
        items: normalizedItems,
      });

      setSuccess(`Invoice ${created.invoiceNumber} created and recorded successfully! Total: ${formatINR(created.amount)}`);
      setInvoiceNumber(invoicePrefix(mode));
      setRecipientName('');
      setItems([{ productId: 'default-1', productName: 'TMT Steel Rods (Grade 550D)', quantity: '1', unitPrice: '45000' }]);
    } catch {
      setError('Invoice could not be created.');
    }
  };

  return (
    <section className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{invoiceTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create and manage verified {isDistributor ? 'distributor-to-dealer' : 'dealer-to-customer'} invoices and consignments.
        </p>
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
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {recipientLabel} Recipient *
            {isDistributor ? (
              dealers.length > 0 ? (
                <CustomDropdown
                  value={recipientName}
                  onChange={setRecipientName}
                  options={[
                    { value: '', label: 'Select dealer...' },
                    ...dealers.map((d) => ({
                      value: d.shopName,
                      label: `${d.shopName} (${d.id})`,
                    })),
                  ]}
                  className="mt-1.5 w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              ) : (
                <input
                  required
                  placeholder="e.g. Metro Hardware 2563"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              )
            ) : customers.length > 0 ? (
              <CustomDropdown
                value={recipientName}
                onChange={setRecipientName}
                options={[
                  { value: '', label: 'Select customer...' },
                  ...customers.map((c) => ({
                    value: c.name,
                    label: `${c.name} (${c.id})`,
                  })),
                ]}
                className="mt-1.5 w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            ) : (
              <input
                required
                placeholder="e.g. Customer Sharma 2563"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            )}
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Invoice Line Items</h2>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { productId: `item-${current.length + 1}`, productName: 'Material Supplies', quantity: '1', unitPrice: '500' },
                ])
              }
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              <Plus size={15} /> Add Line Item
            </button>
          </div>

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
                    { value: '', label: 'Select product...' },
                    ...products.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${formatINR(p.price)} / ${p.unit})`,
                    })),
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2"
                  menuClassName="w-full"
                />
              ) : (
                <input
                  required
                  placeholder="Material description"
                  value={item.productName}
                  onChange={(e) => updateItem(index, { productName: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
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
            className="rounded-xl bg-orange-600 px-6 py-2.5 font-bold text-white hover:bg-orange-700 transition-colors shadow-xs cursor-pointer"
          >
            Create & Record Invoice
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
              description="Generated invoices will appear here with item breakdown, recipient details, and settlement status."
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
                  <th className="px-5 py-3.5">PAYMENT STATUS</th>
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        {inv.status}
                      </span>
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
