import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Receipt,
  FileCheck2,
  UserCircle,
  LogOut,
  ShieldCheck,
  Building,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Package,
  Layers,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi, ordersApi, catalogApi, usersApi, type OrderItem } from '../../lib/api';
import type { Product as CatalogProduct } from '../../lib/api/catalog';
import { formatINR } from '../../utils';
import { INDIAN_STATES_AND_UTS, SearchableSelect } from '../ui/SearchableSelect';
import RegistrationApprovalsView from '../approvals/RegistrationApprovalsView';
import { EmptyState } from '../ui/EmptyState';

export default function StaffLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'onboarding' | 'invoices' | 'approvals' | 'profile'>('onboarding');

  // Customer Onboarding Form State
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custState, setCustState] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPassword, setCustPassword] = useState('Customer@123');
  const [showCustPassword, setShowCustPassword] = useState(false);
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custError, setCustError] = useState<string | null>(null);
  const [custSuccess, setCustSuccess] = useState<string | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Invoice Drafting State
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [recipientOptions, setRecipientOptions] = useState<any[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`DFT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [lineItems, setLineItems] = useState<
    Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      gstRate: number;
      hsnSacCode: string;
    }>
  >([]);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);

  // My Drafts List
  const [myDrafts, setMyDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const canCreateInvoices = Boolean(user?.permissions?.canCreateInvoices);
  const canApproveRegistrations = Boolean(user?.permissions?.canApproveRegistrations);

  // Load Customers & Products on mount
  useEffect(() => {
    loadCustomersList();
    if (canCreateInvoices) {
      loadCatalogAndRecipients();
      loadMyDrafts();
    }
  }, [user]);

  const loadCustomersList = async () => {
    try {
      setLoadingCustomers(true);
      const res = await usersApi.getCustomers();
      const list = Array.isArray(res?.data) ? res.data : [];
      setRecentCustomers(list);
    } catch {
      setRecentCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadCatalogAndRecipients = async () => {
    try {
      const [prodRes, custRes, dealerRes] = await Promise.all([
        catalogApi.getProducts().catch(() => ({ success: true, data: [] })),
        usersApi.getCustomers().catch(() => ({ success: true, data: [] })),
        usersApi.getDealers().catch(() => ({ success: true, data: [] })),
      ]);
      const pList = Array.isArray(prodRes?.data) ? prodRes.data : [];
      setProducts(pList);

      const isDistributorStaff = user?.employerType === 'distributor';
      if (isDistributorStaff) {
        const dList = Array.isArray(dealerRes?.data) ? dealerRes.data : [];
        setRecipientOptions(dList.map((d: any) => ({ id: d.dealer_id, name: d.shop_name || d.owner_name })));
      } else {
        const cList = Array.isArray(custRes?.data) ? custRes.data : [];
        setRecipientOptions(cList.map((c: any) => ({ id: c.customer_id, name: c.name })));
      }
    } catch {
      // Ignore
    }
  };

  const loadMyDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const res = await ordersApi.getMyDrafts();
      const list = Array.isArray(res?.data) ? res.data : [];
      setMyDrafts(list);
    } catch {
      setMyDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Handle Customer Submission
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = custMobile.replace(/\D/g, '');
    if (!custName.trim()) {
      setCustError('Customer Name is required.');
      return;
    }
    if (cleanMobile.length !== 10) {
      setCustError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!custCity.trim()) {
      setCustError('City is required.');
      return;
    }
    if (!custState.trim()) {
      setCustError('State is required.');
      return;
    }

    try {
      setCustSubmitting(true);
      setCustError(null);
      setCustSuccess(null);

      await authApi.signUp('customer', {
        name: custName.trim(),
        mobileNumber: cleanMobile,
        city: custCity.trim(),
        state: custState.trim(),
        address: custAddress.trim() || undefined,
        password: custPassword.trim() || 'Customer@123',
        onboardingDealerId: user?.dealerId || (user?.employerType === 'dealer' ? user?.employerId : undefined),
      });

      setCustSuccess(`Customer "${custName.trim()}" onboarded! Queued for administrator approval.`);
      setCustName('');
      setCustMobile('');
      setCustCity('');
      setCustState('');
      setCustAddress('');
      await loadCustomersList();
    } catch (err: any) {
      setCustError(err?.message || 'Failed to onboard customer.');
    } finally {
      setCustSubmitting(false);
    }
  };

  // Line Items Helper
  const addLineItem = () => {
    if (products.length === 0) return;
    const first = products[0];
    setLineItems((prev) => [
      ...prev,
      {
        productId: first.productId,
        productName: first.name,
        quantity: 1,
        unitPrice: Number(first.price || 0),
        gstRate: Number(first.gstRate || 18),
        hsnSacCode: first.hsnSacCode || '6810',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'productId') {
          const selected = products.find((p) => p.productId === value);
          return {
            ...item,
            productId: value,
            productName: selected?.name || item.productName,
            unitPrice: Number(selected?.price || item.unitPrice),
            gstRate: Number(selected?.gstRate || item.gstRate),
            hsnSacCode: selected?.hsnSacCode || item.hsnSacCode,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Compute Draft Financials
  const computedFinancials = lineItems.reduce(
    (acc, item) => {
      const taxable = item.quantity * item.unitPrice;
      const gst = (taxable * item.gstRate) / 100;
      const cgst = gst / 2;
      const sgst = gst / 2;
      return {
        taxable: acc.taxable + taxable,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        total: acc.total + taxable + gst,
      };
    },
    { taxable: 0, cgst: 0, sgst: 0, total: 0 }
  );

  // Submit Draft Invoice
  const handleSubmitDraftInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientId) {
      setDraftError('Please select a recipient for the invoice.');
      return;
    }
    if (lineItems.length === 0) {
      setDraftError('Please add at least one line item.');
      return;
    }

    try {
      setDraftSubmitting(true);
      setDraftError(null);
      setDraftSuccess(null);

      const itemsPayload: OrderItem[] = lineItems.map((item) => {
        const taxable = item.quantity * item.unitPrice;
        const gst = (taxable * item.gstRate) / 100;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          hsnSacCode: item.hsnSacCode,
          gstRate: item.gstRate,
          taxableAmount: taxable,
          cgstAmount: gst / 2,
          sgstAmount: gst / 2,
          igstAmount: 0,
          totalAmount: taxable + gst,
        };
      });

      const isDistributor = user?.employerType === 'distributor';
      if (isDistributor) {
        await ordersApi.createDistributorInvoice({
          dealerId: selectedRecipientId,
          invoiceNumber: invoiceNumber.trim(),
          billingAddress: billingAddress.trim() || undefined,
          shippingAddress: shippingAddress.trim() || undefined,
          items: itemsPayload,
        });
      } else {
        await ordersApi.createDealerInvoice({
          customerId: selectedRecipientId,
          invoiceNumber: invoiceNumber.trim(),
          billingAddress: billingAddress.trim() || undefined,
          shippingAddress: shippingAddress.trim() || undefined,
          items: itemsPayload,
        });
      }

      setDraftSuccess('Invoice draft submitted successfully! It is now pending owner approval.');
      setLineItems([]);
      setInvoiceNumber(`DFT-${Math.floor(1000 + Math.random() * 9000)}`);
      await loadMyDrafts();
    } catch (err: any) {
      setDraftError(err?.message || 'Failed to submit invoice draft.');
    } finally {
      setDraftSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center font-black text-white shadow-xs">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base">SiteSync</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Staff Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Employer: <span className="text-slate-300 font-semibold capitalize">{user?.employerType || 'Organization'}</span>
              </p>
            </div>
          </div>

          {/* User & Permissions Status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  canCreateInvoices
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {canCreateInvoices ? <Check size={12} /> : <X size={12} />}
                Invoicing
              </span>

              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  canApproveRegistrations
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {canApproveRegistrations ? <Check size={12} /> : <X size={12} />}
                Approvals
              </span>
            </div>

            <div className="text-right hidden sm:block border-l border-slate-800 pl-3">
              <p className="text-xs font-bold text-white truncate max-w-[140px]">{user?.name || 'Staff'}</p>
              <p className="text-[10px] text-slate-400 font-mono">{user?.mobile_number || ''}</p>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-900 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'onboarding'
                ? 'border-orange-500 text-orange-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus size={15} />
            Customer Onboarding
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'border-orange-500 text-orange-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt size={15} />
            Draft Invoices {myDrafts.length > 0 && `(${myDrafts.length})`}
          </button>

          {canApproveRegistrations && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'approvals'
                  ? 'border-orange-500 text-orange-400 bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck2 size={15} />
              Registration Approvals
            </button>
          )}

          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-orange-500 text-orange-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCircle size={15} />
            Staff Profile
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* TAB 1: CUSTOMER ONBOARDING */}
        {activeTab === 'onboarding' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Onboard New Customer</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Register a new customer under your organization. Customers submitted by staff are queued for administrator review.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <UserPlus size={20} />
                </div>
              </div>

              {custError && (
                <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                    <span>{custError}</span>
                  </div>
                  <button onClick={() => setCustError(null)} className="text-red-600 hover:text-red-900 font-bold">
                    ×
                  </button>
                </div>
              )}

              {custSuccess && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{custSuccess}</span>
                  </div>
                  <button onClick={() => setCustSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
                    ×
                  </button>
                </div>
              )}

              <form onSubmit={handleRegisterCustomer} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={custMobile}
                      onChange={(e) => setCustMobile(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jaipur"
                      value={custCity}
                      onChange={(e) => setCustCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      State *
                    </label>
                    <SearchableSelect
                      options={INDIAN_STATES_AND_UTS}
                      value={custState}
                      onChange={setCustState}
                      placeholder="Select State..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Delivery / Site Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Plot 42, Industrial Area, Sector 5"
                      value={custAddress}
                      onChange={(e) => setCustAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Default Sign-In Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCustPassword ? 'text' : 'password'}
                        value={custPassword}
                        onChange={(e) => setCustPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustPassword(!showCustPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCustPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={custSubmitting}
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {custSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Submit Customer for Approval
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Customers Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <h3 className="text-base font-black text-slate-900 mb-4">Customer Directory</h3>
              {loadingCustomers ? (
                <div className="py-8 text-center text-slate-400 text-xs">Loading customer directory…</div>
              ) : recentCustomers.length === 0 ? (
                <EmptyState title="No Customers Found" description="Customers onboarded will appear here." icon={UserPlus} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Mobile</th>
                        <th className="py-2.5 px-3">City / State</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentCustomers.slice(0, 10).map((c: any) => (
                        <tr key={c.customer_id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{c.name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{c.mobile_number}</td>
                          <td className="py-2.5 px-3 text-slate-500">{c.city || '—'}, {c.state || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DRAFT INVOICES */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {!canCreateInvoices ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs">
                <Receipt size={32} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-base font-bold text-slate-800">Invoicing Permission Restricted</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Your staff account does not currently have permission to draft invoices. Please contact your organization owner to grant the "Invoices" permission.
                </p>
              </div>
            ) : (
              <>
                {/* Draft Creation Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Create Invoice Draft</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Draft an invoice for customer or partner review. Stock is deducted only after administrator sign-off.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                      Draft Mode
                    </span>
                  </div>

                  {draftError && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600 shrink-0" />
                        <span>{draftError}</span>
                      </div>
                      <button onClick={() => setDraftError(null)} className="text-red-600 hover:text-red-900 font-bold">
                        ×
                      </button>
                    </div>
                  )}

                  {draftSuccess && (
                    <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>{draftSuccess}</span>
                      </div>
                      <button onClick={() => setDraftSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
                        ×
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSubmitDraftInvoice} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Select Recipient *
                        </label>
                        <select
                          value={selectedRecipientId}
                          onChange={(e) => setSelectedRecipientId(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                        >
                          <option value="">-- Choose Recipient --</option>
                          {recipientOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Draft Invoice Number
                        </label>
                        <input
                          type="text"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Billing Address
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Registered address"
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50"
                        />
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items</span>
                        <button
                          type="button"
                          onClick={addLineItem}
                          className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 font-bold text-xs rounded-lg border border-orange-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} /> Add Item
                        </button>
                      </div>

                      {lineItems.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                          No line items added yet. Click "+ Add Item" to select products.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                              <tr>
                                <th className="py-2 px-3">Product</th>
                                <th className="py-2 px-3">HSN</th>
                                <th className="py-2 px-3 w-20 text-right">Qty</th>
                                <th className="py-2 px-3 w-28 text-right">Unit Price</th>
                                <th className="py-2 px-3 w-20 text-right">GST %</th>
                                <th className="py-2 px-3 text-right">Total</th>
                                <th className="py-2 px-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lineItems.map((item, idx) => {
                                const taxable = item.quantity * item.unitPrice;
                                const gst = (taxable * item.gstRate) / 100;
                                const total = taxable + gst;
                                return (
                                  <tr key={idx}>
                                    <td className="py-2 px-3">
                                      <select
                                        value={item.productId}
                                        onChange={(e) => updateLineItem(idx, 'productId', e.target.value)}
                                        className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                                      >
                                        {products.map((p) => (
                                          <option key={p.productId} value={p.productId}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                      {item.hsnSacCode}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                                        className="w-16 p-1.5 border border-slate-200 rounded-lg text-right text-xs"
                                      />
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <input
                                        type="number"
                                        min={0}
                                        value={item.unitPrice}
                                        onChange={(e) => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                                        className="w-24 p-1.5 border border-slate-200 rounded-lg text-right text-xs"
                                      />
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600">{item.gstRate}%</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-900">{formatINR(total)}</td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeLineItem(idx)}
                                        className="text-slate-400 hover:text-red-600 p-1"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Tax & Total Summary */}
                    {lineItems.length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-600">
                            Taxable: <span className="font-bold">{formatINR(computedFinancials.taxable)}</span>
                          </p>
                          <p className="text-slate-600">
                            GST (CGST + SGST):{' '}
                            <span className="font-bold">{formatINR(computedFinancials.cgst + computedFinancials.sgst)}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Grand Total</span>
                          <span className="text-xl font-black text-slate-900">{formatINR(computedFinancials.total)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={draftSubmitting || lineItems.length === 0}
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        {draftSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
                        Submit Invoice Draft for Review
                      </button>
                    </div>
                  </form>
                </div>

                {/* My Submitted Drafts Table */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black text-slate-900">My Submitted Drafts</h3>
                    <button
                      onClick={loadMyDrafts}
                      disabled={loadingDrafts}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} className={loadingDrafts ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>

                  {loadingDrafts ? (
                    <div className="py-8 text-center text-slate-400 text-xs">Loading drafts…</div>
                  ) : myDrafts.length === 0 ? (
                    <EmptyState title="No Drafts Yet" description="Invoices submitted by you will be listed here." icon={Receipt} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                            <th className="py-2.5 px-3">Invoice #</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center">Review Status</th>
                            <th className="py-2.5 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {myDrafts.map((d: any) => (
                            <tr key={d.invoice_id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{d.invoice_number}</td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {(d.invoice_date || d.created_at || '').slice(0, 10)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                {formatINR(Number(d.total_amount || 0))}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    d.approval_status === 'approved'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : d.approval_status === 'rejected'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {d.approval_status === 'approved'
                                    ? 'Approved & Stock Deducted'
                                    : d.approval_status === 'rejected'
                                    ? 'Rejected'
                                    : 'Pending Review'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {d.rejection_reason || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: REGISTRATION APPROVALS */}
        {activeTab === 'approvals' && (
          <div>
            {!canApproveRegistrations ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs">
                <FileCheck2 size={32} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-base font-bold text-slate-800">Approvals Permission Restricted</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Your staff account does not have permission to review customer registrations. Contact your organization owner.
                </p>
              </div>
            ) : (
              <RegistrationApprovalsView />
            )}
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-2xl shadow-md">
                {(user?.name?.[0] || 'S').toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">{user?.name}</h2>
                <p className="text-xs text-slate-500">Staff Account • {user?.mobile_number}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Status: Active
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500 font-bold">Employer Type</span>
                <span className="text-slate-900 font-semibold capitalize">{user?.employerType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500 font-bold">Employer ID</span>
                <span className="text-slate-900 font-mono">{user?.employerId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500 font-bold">Invoice Creation Permission</span>
                <span className={canCreateInvoices ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>
                  {canCreateInvoices ? 'Allowed' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500 font-bold">Registration Approval Permission</span>
                <span className={canApproveRegistrations ? 'text-emerald-600 font-bold' : 'text-slate-400 font-bold'}>
                  {canApproveRegistrations ? 'Allowed' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
