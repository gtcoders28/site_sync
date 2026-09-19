import React, { useState, useEffect, useMemo } from 'react';
import { Search, Eye, Clock, CheckCircle2, Truck, XCircle, Package, Plus, Send, AlertCircle, RefreshCw } from 'lucide-react';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { useAuth } from '../../context/AuthContext';

export interface WholesaleOrder {
  id: string;
  rawId: string;
  product: string;
  quantity: string;
  dealer: string;
  dealerId?: string;
  distributorId?: string;
  amount: number;
  status: 'Processing' | 'In Transit' | 'Delivered' | 'Cancelled';
  dbStatus: 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  date: string;
  dispatchedAt?: string;
  pointsEarned: number;
  canAccept?: boolean;
  canConfirmDelivery?: boolean;
  deliveredAt?: string;
}

export interface CatalogProduct {
  id: string;
  rawId: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  price: number;
  grade: string;
}

export default function OrdersManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'awaiting' | 'dispatched' | 'delivered' | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<WholesaleOrder | null>(null);
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Wholesale Order Form State (for Dealer)
  const [orderCategory, setOrderCategory] = useState<'Cement' | 'TMT Steel Rebar'>('Cement');
  const [selectedProductRawId, setSelectedProductRawId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('100');
  const [orderNotes, setOrderNotes] = useState('Immediate site requirement');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null);

  const isDistributor = user?.role === 'distributor' || user?.role === 'platform_owner_distributor';
  const isDealer = user?.role === 'dealer' || user?.role === 'retailer';

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, prodsRes] = await Promise.all([
        fetch('/api/sitesync/orders'),
        fetch('/api/sitesync/products'),
      ]);

      const [ordersJson, prodsJson] = await Promise.all([ordersRes.json(), prodsRes.json()]);

      if (ordersJson.success && Array.isArray(ordersJson.data)) {
        setOrders(ordersJson.data);
      }
      if (prodsJson.success && Array.isArray(prodsJson.data)) {
        setCatalogProducts(prodsJson.data);
        if (!selectedProductRawId && prodsJson.data.length > 0) {
          const firstCement = prodsJson.data.find((p: CatalogProduct) => p.category.includes('Cement')) || prodsJson.data[0];
          setSelectedProductRawId(firstCement.rawId);
        }
      }
    } catch (err) {
      console.error('Failed to load orders or products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlaceWholesaleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(orderQuantity);
    if (isNaN(qty) || qty <= 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a valid order quantity.' });
      return;
    }

    const prod = catalogProducts.find((p) => p.rawId === selectedProductRawId);
    if (!prod) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please select a valid material.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/sitesync/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId: user?.rawId || user?.dealerId || null,
          distributorId: user?.distributorId || null,
          productId: prod.rawId,
          quantity: qty,
          unitPrice: prod.price,
          notes: orderNotes.trim(),
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to place wholesale order.');
      }

      setIsPlaceOrderModalOpen(false);
      await loadData();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: json.message || `Order ${json.data?.id} submitted to distributor successfully!`,
      });
    } catch (err: any) {
      console.error('Error placing order:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to submit order.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptOrder = async (order: WholesaleOrder) => {
    setAcceptingOrderId(order.id);
    const dispatchTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistic reactive update: transition order immediately to Dispatched / In Transit
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: 'In Transit',
              dbStatus: 'dispatched',
              canAccept: false,
              canConfirmDelivery: true,
              dispatchedAt: dispatchTime,
            }
          : o
      )
    );

    try {
      const resp = await fetch(`/api/sitesync/orders/${order.id}/accept`, {
        method: 'POST',
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to accept order.');
      }

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Order ${order.id} accepted & dispatched at ${dispatchTime}! Stock subtracted from warehouse; awaiting recipient delivery confirmation.`,
      });
      // Switch active tab to 'dispatched' so user sees it right away!
      setActiveTab('dispatched');
    } catch (err: any) {
      console.error('Error accepting order:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to accept order.',
      });
      await loadData();
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const handleConfirmDelivery = async (order: WholesaleOrder) => {
    setDeliveringOrderId(order.id);
    const deliveredTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistic reactive update: transition order to Delivered and credit inventory
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: 'Delivered',
              dbStatus: 'delivered',
              canConfirmDelivery: false,
              deliveredAt: deliveredTime,
            }
          : o
      )
    );

    try {
      const resp = await fetch(`/api/sitesync/orders/${order.id}/deliver`, {
        method: 'POST',
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to confirm delivery.');
      }

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Consignment for Order ${order.id} confirmed received! Stock has been added to your Store Inventory.`,
      });
      setActiveTab('delivered');
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: 'Delivered', dbStatus: 'delivered', canConfirmDelivery: false, deliveredAt: deliveredTime } : null
        );
      }
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to confirm delivery.',
      });
      await loadData();
    } finally {
      setDeliveringOrderId(null);
    }
  };

  const pendingCount = orders.filter((o) => o.canAccept || o.dbStatus === 'pending').length;
  const dispatchedCount = orders.filter((o) => o.status === 'In Transit' || o.dbStatus === 'dispatched').length;
  const deliveredCount = orders.filter((o) => o.status === 'Delivered' || o.dbStatus === 'delivered').length;

  const ordersForTab = useMemo(() => {
    if (activeTab === 'awaiting') {
      return orders.filter((o) => o.canAccept || o.dbStatus === 'pending');
    }
    if (activeTab === 'dispatched') {
      return orders.filter((o) => o.status === 'In Transit' || o.dbStatus === 'dispatched');
    }
    if (activeTab === 'delivered') {
      return orders.filter((o) => o.status === 'Delivered' || o.dbStatus === 'delivered');
    }
    return orders;
  }, [orders, activeTab]);

  const filteredOrders = ordersForTab.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.dealer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  const getStatusBadge = (order: WholesaleOrder) => {
    if (order.canAccept || order.dbStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} /> Pending Acceptance
        </span>
      );
    }
    if (order.status === 'In Transit' || order.dbStatus === 'dispatched') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Truck size={12} /> Dispatched / In Transit
        </span>
      );
    }
    if (order.status === 'Delivered' || order.dbStatus === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} /> Delivered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle size={12} /> Cancelled
      </span>
    );
  };

  const selectedProduct = catalogProducts.find((p) => p.rawId === selectedProductRawId);
  const calculatedTotal = selectedProduct ? (parseFloat(orderQuantity) || 0) * selectedProduct.price : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
              <Package size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isDistributor
                  ? 'Incoming Dealer Wholesale Orders'
                  : isDealer
                  ? 'Wholesale Orders to Distributor'
                  : 'Material Orders & Transactions'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isDistributor
                  ? 'Review, approve, and dispatch wholesale purchase orders submitted by regional dealers. Accepting deducts from warehouse inventory.'
                  : isDealer
                  ? 'Order bulk Cement and TMT Steel Rebar (Sariya) directly from your assigned regional distributor.'
                  : 'Track your material purchases and invoice history.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {isDealer && (
            <button
              type="button"
              onClick={() => setIsPlaceOrderModalOpen(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              Place Wholesale Order
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL ORDER VOLUME</p>
          <p className="text-2xl font-bold text-slate-900">{formatINR(totalRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">{orders.length} order{orders.length === 1 ? '' : 's'} recorded</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            {isDistributor ? 'AWAITING DISPATCH' : 'PENDING ACCEPTANCE'}
          </p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-slate-500 mt-1">
            {isDistributor ? 'Requires Distributor stock approval' : 'Awaiting distributor review'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">DISPATCHED / IN TRANSIT</p>
          <p className="text-2xl font-bold text-blue-600">{dispatchedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Stock deducted and en route to dealer</p>
        </div>
      </div>

      {/* Segmented Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 border border-slate-200/80 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>All Transactions</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('awaiting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'awaiting'
              ? 'bg-white text-amber-900 shadow-xs'
              : 'text-slate-600 hover:text-amber-800'
          }`}
        >
          <Clock size={14} className="text-amber-500" />
          <span>Awaiting Dispatch</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dispatched')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'dispatched'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-blue-800'
          }`}
        >
          <Truck size={14} className="text-blue-500" />
          <span>Dispatched / In Transit</span>
          {dispatchedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {dispatchedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delivered')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'delivered'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-emerald-800'
          }`}
        >
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>Delivered</span>
          {deliveredCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {deliveredCount}
            </span>
          )}
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by order ID, dealer, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Processing', label: 'Pending / Processing', dotColor: 'bg-amber-500' },
                { value: 'In Transit', label: 'In Transit', dotColor: 'bg-blue-500' },
                { value: 'Delivered', label: 'Delivered', dotColor: 'bg-emerald-500' },
              ]}
              buttonClassName="w-full sm:w-52"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Package}
              title={
                activeTab === 'awaiting'
                  ? 'No Orders Awaiting Dispatch'
                  : activeTab === 'dispatched'
                  ? 'No Orders In Transit'
                  : activeTab === 'delivered'
                  ? 'No Delivered Orders'
                  : isDistributor
                  ? 'No Dealer Orders Received Yet'
                  : 'No Wholesale Orders Placed'
              }
              description={
                activeTab === 'awaiting'
                  ? 'All pending orders have been processed and dispatched.'
                  : activeTab === 'dispatched'
                  ? 'There are currently no active material consignments en route.'
                  : isDistributor
                  ? 'Orders placed by your downstream dealers for Cement and TMT Steel Rebar will appear here for review and inventory dispatch.'
                  : 'Place your first bulk wholesale purchase order to your assigned regional distributor.'
              }
              actionLabel={isDealer ? 'Place Wholesale Order' : undefined}
              onAction={isDealer ? () => setIsPlaceOrderModalOpen(true) : undefined}
            />
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 lg:px-5 py-3.5 whitespace-nowrap">ORDER ID</th>
                    <th className="px-4 lg:px-5 py-3.5 whitespace-nowrap">DATE</th>
                    <th className="px-4 lg:px-5 py-3.5 min-w-[160px]">MATERIAL & GRADE</th>
                    <th className="px-4 lg:px-5 py-3.5 whitespace-nowrap">ORDER QUANTITY</th>
                    <th className="px-4 lg:px-5 py-3.5 min-w-[140px]">AUTHORIZED DEALER</th>
                    <th className="px-4 lg:px-5 py-3.5 whitespace-nowrap">TOTAL VALUE</th>
                    <th className="px-4 lg:px-5 py-3.5 whitespace-nowrap">STATUS</th>
                    <th className="px-4 lg:px-5 py-3.5 text-center whitespace-nowrap">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOrders.map((order) => {
                    const isCement = order.product.toLowerCase().includes('cement');
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                            {order.id}
                          </span>
                        </td>
                        <td className="px-4 lg:px-5 py-4 text-slate-500 text-xs whitespace-nowrap">{order.date}</td>
                        <td className="px-4 lg:px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isCement ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                              {isCement ? 'Cement' : 'TMT Steel'}
                            </span>
                            <span className="text-slate-900 font-bold">{order.product}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-5 py-4 text-slate-700 font-bold whitespace-nowrap">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-800 font-semibold">
                            {order.quantity}
                          </span>
                        </td>
                        <td className="px-4 lg:px-5 py-4 text-slate-700 whitespace-nowrap font-medium">{order.dealer}</td>
                        <td className="px-4 lg:px-5 py-4 text-slate-900 font-extrabold whitespace-nowrap">{formatINR(order.amount)}</td>
                        <td className="px-4 lg:px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            {getStatusBadge(order)}
                            {order.dispatchedAt && (
                              <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                <Truck size={10} /> Out for delivery {order.dispatchedAt}
                              </span>
                            )}
                            {order.deliveredAt && (
                              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                                <CheckCircle2 size={10} /> Confirmed {order.deliveredAt}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 lg:px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {isDistributor && order.canAccept && (
                              <button
                                type="button"
                                disabled={acceptingOrderId === order.id}
                                onClick={() => handleAcceptOrder(order)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                                title="Accept order and subtract stock from warehouse inventory"
                              >
                                <Truck size={13} />
                                {acceptingOrderId === order.id ? 'Deducting…' : 'Dispatch'}
                              </button>
                            )}
                            {(order.status === 'In Transit' || order.dbStatus === 'dispatched') && (
                              <button
                                type="button"
                                disabled={deliveringOrderId === order.id}
                                onClick={() => handleConfirmDelivery(order)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                                title="Confirm order consignment received at store"
                              >
                                <CheckCircle2 size={13} />
                                {deliveringOrderId === order.id ? 'Confirming…' : 'Mark Received'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="View Manifest Details"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {filteredOrders.map((order) => {
                const isCement = order.product.toLowerCase().includes('cement');
                return (
                  <div key={order.id} className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl space-y-2.5 border border-slate-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {order.id}
                      </span>
                      {getStatusBadge(order)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isCement ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                          {isCement ? 'Cement' : 'TMT Steel'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{order.product}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Dealer: <span className="font-semibold text-slate-700">{order.dealer}</span> • Qty: <span className="font-bold text-slate-900">{order.quantity}</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">{order.date}</span>
                      <span className="text-sm font-black text-slate-900">{formatINR(order.amount)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {isDistributor && order.canAccept && (
                        <button
                          type="button"
                          disabled={acceptingOrderId === order.id}
                          onClick={() => handleAcceptOrder(order)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Truck size={12} /> Dispatch
                        </button>
                      )}
                      {(order.status === 'In Transit' || order.dbStatus === 'dispatched') && (
                        <button
                          type="button"
                          disabled={deliveringOrderId === order.id}
                          onClick={() => handleConfirmDelivery(order)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> Mark Received
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 bg-slate-50/50">
          <span>Showing {filteredOrders.length} of {orders.length} wholesale transactions</span>
          <span className="font-medium text-slate-600">
            {isDistributor
              ? 'Accepting an order triggers automatic live stock subtraction in Products & Inventory.'
              : 'Orders are fulfilled from Distributor central warehouse stock.'}
          </span>
        </div>
      </div>

      {/* Order Manifest Modal */}
      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Wholesale Consignment Manifest: ${selectedOrder.id}` : 'Order Manifest'}
        description="Official B2B dispatch note with verified consignment trace and live inventory log."
      >
        {selectedOrder && (
          <div className="space-y-4 text-sm">
            {/* Timeline Progress */}
            <div className="bg-slate-950 p-4 rounded-xl text-white">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Consignment Lifecycle</div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">✓</span>
                  <div>
                    <div className="font-bold">Placed</div>
                    <div className="text-[10px] text-slate-400">{selectedOrder.date}</div>
                  </div>
                </div>
                <div className={`h-0.5 flex-1 mx-3 ${selectedOrder.status !== 'Processing' ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedOrder.status !== 'Processing' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {selectedOrder.status !== 'Processing' ? '✓' : '2'}
                  </span>
                  <div>
                    <div className="font-bold">Dispatched</div>
                    <div className="text-[10px] text-slate-400">{selectedOrder.dispatchedAt || 'Pending'}</div>
                  </div>
                </div>
                <div className={`h-0.5 flex-1 mx-3 ${selectedOrder.status === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedOrder.status === 'Delivered' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {selectedOrder.status === 'Delivered' ? '✓' : '3'}
                  </span>
                  <div>
                    <div className="font-bold">Delivered</div>
                    <div className="text-[10px] text-slate-400">{selectedOrder.deliveredAt || 'Pending'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-200/70 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Material Variant:</span>
                <span className="font-bold text-slate-900">{selectedOrder.product}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Consignment Volume:</span>
                <span className="font-extrabold text-orange-600">{selectedOrder.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Authorized Dealer:</span>
                <span className="font-semibold text-slate-800">{selectedOrder.dealer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Submission Timestamp:</span>
                <span className="font-medium text-slate-700">{selectedOrder.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span>{getStatusBadge(selectedOrder)}</span>
              </div>
              {selectedOrder.dispatchedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Dispatch Confirmed:</span>
                  <span className="font-medium text-blue-700">{selectedOrder.dispatchedAt}</span>
                </div>
              )}
              {selectedOrder.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Receipt Confirmed:</span>
                  <span className="font-medium text-emerald-700">{selectedOrder.deliveredAt}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-bold">
                <span>Total Invoice Value:</span>
                <span className="text-slate-900 font-black">{formatINR(selectedOrder.amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {(selectedOrder.status === 'In Transit' || selectedOrder.dbStatus === 'dispatched') && (
                <button
                  type="button"
                  disabled={deliveringOrderId === selectedOrder.id}
                  onClick={() => {
                    const ord = selectedOrder;
                    handleConfirmDelivery(ord);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 size={14} /> Confirm Order Received
                </button>
              )}
              {isDistributor && selectedOrder.canAccept && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = selectedOrder;
                    setSelectedOrder(null);
                    handleAcceptOrder(ord);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Truck size={14} /> Accept & Deduct Stock
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-sm cursor-pointer"
              >
                Close Manifest
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Place Wholesale Order Modal (Dealer -> Distributor) */}
      <Modal
        isOpen={isPlaceOrderModalOpen}
        onClose={() => setIsPlaceOrderModalOpen(false)}
        title="Place Wholesale Order with Distributor"
        description="Submit a wholesale purchase order for Cement or TMT Steel Rebar to your assigned Regional Distributor."
        maxWidth="lg"
      >
        <form onSubmit={handlePlaceWholesaleOrder} className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200/80 rounded-xl text-xs text-orange-800">
            Select material specifications from your Distributor's active catalog. Once submitted, your order will appear in the Distributor's queue for inventory allocation and dispatch.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Material Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOrderCategory('Cement');
                  const firstCement = catalogProducts.find((p) => p.category.includes('Cement'));
                  if (firstCement) setSelectedProductRawId(firstCement.rawId);
                  setOrderQuantity('100');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  orderCategory === 'Cement'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-sm">Cement (Bags)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">50kg Standard Packaging (OPC / PPC)</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderCategory('TMT Steel Rebar');
                  const firstSteel = catalogProducts.find((p) => !p.category.includes('Cement'));
                  if (firstSteel) setSelectedProductRawId(firstSteel.rawId);
                  setOrderQuantity('5');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  orderCategory === 'TMT Steel Rebar'
                    ? 'border-orange-600 bg-orange-50/50 text-orange-900 ring-2 ring-orange-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-sm">TMT Steel Rebar (Sariya)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Fe 550D High Ductility (MT)</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Product Variant & Grade *
            </label>
            <CustomDropdown
              value={selectedProductRawId}
              onChange={setSelectedProductRawId}
              options={catalogProducts
                .filter((p) => (orderCategory === 'Cement' ? p.category.includes('Cement') : !p.category.includes('Cement')))
                .map((p) => ({
                  value: p.rawId,
                  label: `${p.name} (${p.brand} - ${p.grade}) — ${formatINR(p.price)} / ${p.unit}`,
                }))}
              className="w-full"
              buttonClassName="w-full py-2.5"
              menuClassName="w-full"
            />
          </div>

          {selectedProduct && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-400">Unit Wholesale Rate:</span>
                <span className="font-bold text-slate-800 ml-1.5">{formatINR(selectedProduct.price)} / {selectedProduct.unit}</span>
              </div>
              <div>
                <span className="text-slate-400">Brand:</span>
                <span className="font-bold text-slate-800 ml-1.5">{selectedProduct.brand}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity ({selectedProduct?.unit || 'Units'}) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              placeholder={orderCategory === 'Cement' ? 'e.g. 100 bags' : 'e.g. 5 MT'}
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Delivery Site Notes & Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Unload at main warehouse counter, Jaipur"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>

          {/* Live Total */}
          <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-xs text-orange-900 font-semibold">Total Order Amount</span>
              <p className="text-[11px] text-orange-700 mt-0.5">Calculated based on distributor catalog rate</p>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatINR(calculatedTotal)}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPlaceOrderModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Send size={15} />
              {isSubmitting ? 'Submitting Order…' : 'Submit Wholesale Order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
