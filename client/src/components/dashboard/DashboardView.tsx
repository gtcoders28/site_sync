import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Wallet,
  Award,
  Users,
  Plus,
  Search,
  Star,
  MapPin,
  Phone,
  MessageSquare,
  ChevronDown,
  Clock,
  Truck,
  CheckCircle2,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { dataService, Order, DealerSpotlight } from '../../services/dataService';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '../ui/Skeleton';
import { CustomDropdown } from '../ui/CustomDropdown';
import { useAuth } from '../../context/AuthContext';

export default function DashboardView({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dealer, setDealer] = useState<DealerSpotlight | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // New Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const [newDealer, setNewDealer] = useState('');
  const [newAmount, setNewAmount] = useState('25000');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Dealer Contact Modals
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [dealerMessageText, setDealerMessageText] = useState('');
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Load live data
  const loadData = () => {
    setOrders(dataService.getOrders());
    setDealer(dataService.getDealerSpotlight());
  };

  useEffect(() => {
    loadData();
    const timer = setTimeout(() => setIsLoading(false), 200);
    const unsubscribe = dataService.subscribe(() => {
      loadData();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    return dataService.getDashboardStats();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.dealer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const activeInTransitOrder = useMemo(() => {
    return orders.find((o) => o.status === 'In Transit') || orders[0];
  }, [orders]);

  const availableProducts = useMemo(() => dataService.getProducts(), [isOrderModalOpen]);
  const availableDealers = useMemo(() => dataService.getDealers(), [isOrderModalOpen]);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a valid order amount.' });
      return;
    }

    setOrderSubmitting(true);
    try {
      const selectedProd = availableProducts.find((p) => p.name === newProduct) || {
        name: newProduct || 'Industrial Cement Pack',
      };
      const selectedDlr = availableDealers.find((d) => d.shopName === newDealer) || {
        shopName: newDealer || 'Regional Hub Authorized Dealer',
      };

      const newOrder = dataService.createOrder({
        product: selectedProd.name,
        dealer: selectedDlr.shopName,
        amount: parsedAmount,
      });

      setOrders((prev) => [newOrder, ...prev]);
      setIsOrderModalOpen(false);
      setNewAmount('25000');
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Order ${newOrder.id} created successfully! Authorized for dispatch processing.`,
      });
    } catch {
      setToast({ id: String(Date.now()), type: 'error', message: 'Failed to create order. Please try again.' });
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerMessageText.trim()) return;
    setIsMessageModalOpen(false);
    setDealerMessageText('');
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Message sent directly to ${dealer?.name}. Dispatch desk notified.`,
    });
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'In Transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            In Transit
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Delivered
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
            <Clock size={12} className="text-amber-600" />
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-7 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back, {user?.name || user?.company_name || user?.shop_name || 'Enterprise Hub'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100/70 text-orange-800 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={11} className="text-orange-600" />
              Live Sync
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Real-time supply chain operations, logistics dispatch pipeline, and inventory status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Date Range Selector */}
          <div className="relative flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className="w-full sm:w-auto inline-flex items-center justify-between gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar size={14} className="text-slate-400" />
              <span>{dateRange}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {dateDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-1 text-xs font-medium">
                {['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setDateRange(option);
                      setDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer ${
                      dateRange === option ? 'text-orange-600 font-bold bg-orange-50/50' : 'text-slate-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + New Order Button */}
          <button
            type="button"
            onClick={() => setIsOrderModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Fast Action Command Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Quick Order',
            desc: 'New wholesale request',
            icon: Plus,
            color: 'from-orange-500 to-amber-600 text-orange-600 bg-orange-50/80 border-orange-200/80',
            action: () => setIsOrderModalOpen(true),
          },
          {
            label: 'Inbound Stock',
            desc: 'Log warehouse arrival',
            icon: Layers,
            color: 'from-sky-500 to-blue-600 text-sky-600 bg-sky-50/80 border-sky-200/80',
            action: () => onNavigateTab?.('products'),
          },
          {
            label: 'Dispatch Pipeline',
            desc: 'Awaiting truck shipment',
            icon: Truck,
            color: 'from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50/80 border-emerald-200/80',
            action: () => onNavigateTab?.('orders'),
          },
          {
            label: 'Issue GST Bill',
            desc: 'Tax invoice generator',
            icon: FileSpreadsheet,
            color: 'from-purple-500 to-indigo-600 text-purple-600 bg-purple-50/80 border-purple-200/80',
            action: () => onNavigateTab?.('invoices'),
          },
        ].map((action, idx) => (
          <button
            key={idx}
            type="button"
            onClick={action.action}
            className="flex items-center gap-3 p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer text-left group active:scale-[0.98]"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${action.color} group-hover:scale-105 transition-transform`}>
              <action.icon size={18} />
            </div>
            <div className="truncate">
              <span className="block text-xs sm:text-sm font-bold text-slate-800 group-hover:text-orange-600 transition-colors truncate">
                {action.label}
              </span>
              <span className="block text-[11px] text-slate-400 font-medium truncate">
                {action.desc}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* KPI Cards (4) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Orders */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <ShoppingBag size={19} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-0.5">
                <span>↑</span> {stats.ordersTrend}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL ORDERS</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatNumber(stats.totalOrders)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">Active wholesale consignments</p>
          </div>

          {/* Card 2: Purchase Value */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Wallet size={19} />
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {stats.purchaseTrend}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">PURCHASE VALUE</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatINR(stats.purchaseValue)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">Cumulative invoiced volume</p>
          </div>

          {/* Card 3: Available Points */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Award size={19} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-0.5">
                <span>↑</span> {stats.pointsTrend}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">AVAILABLE REWARD PTS</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatNumber(stats.availablePoints)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">Redeemable partner incentives</p>
          </div>

          {/* Card 4: Active Referrals */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Users size={19} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                ~ {stats.referralsTrend}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">CHANNEL NETWORK</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.activeReferrals}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">Verified merchants & partners</p>
          </div>
        </div>
      )}

      {/* Live Operational Health & Material Breakdown Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers size={16} className="text-orange-500" />
              Warehouse Storage & Material Split
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Current inventory balance across primary structural categories (Cement & TMT Steel Rebar)
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/70">
            Capacity: 82% Utilized
          </span>
        </div>

        {/* Dual Stacked Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600" style={{ width: '64%' }} title="Cement Stock (64%)" />
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600" style={{ width: '28%' }} title="TMT Steel Rebar (28%)" />
            <div className="h-full bg-emerald-500" style={{ width: '8%' }} title="Buffer Reserves (8%)" />
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <span className="font-bold text-slate-800">Cement Products:</span>
              <span className="text-slate-500">64% (~8,200 Bags)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="font-bold text-slate-800">TMT Steel Rebar:</span>
              <span className="text-slate-500">28% (~140 MT)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-slate-800">Buffer Reserves:</span>
              <span className="text-slate-500">8%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Orders (Left 2 Cols) + Logistics Tracker & Dealer (Right 1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left 2 Cols: Orders Table & Mobile Cards */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Table Header & Search Filter Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-slate-50/40">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Recent Orders</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time status of wholesale materials shipments</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                />
              </div>

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'In Transit', label: 'In Transit', dotColor: 'bg-blue-500' },
                  { value: 'Delivered', label: 'Delivered', dotColor: 'bg-emerald-500' },
                  { value: 'Processing', label: 'Processing', dotColor: 'bg-amber-500' },
                ]}
                buttonClassName="w-32 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Orders Body (Desktop Table + Mobile Cards) */}
          {isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              title="No Orders Found"
              description="No recent orders match your criteria. Create a new materials order to get started."
              actionLabel="Create New Order"
              onAction={() => setIsOrderModalOpen(true)}
            />
          ) : (
            <>
              {/* Desktop Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">ORDER ID</th>
                      <th className="px-5 py-3.5">MATERIAL / PRODUCT</th>
                      <th className="px-5 py-3.5">DISPATCH POINT</th>
                      <th className="px-5 py-3.5">CONSIGNMENT STATUS</th>
                      <th className="px-5 py-3.5 text-right">INVOICE AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredOrders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/70">
                            {order.id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-900 block truncate max-w-[200px]">{order.product}</span>
                          <span className="text-xs text-slate-400">{order.date}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap font-medium truncate max-w-[150px]">{order.dealer}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                        <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                          {formatINR(order.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (< 640px) */}
              <div className="sm:hidden divide-y divide-slate-100 p-2">
                {filteredOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="p-3 bg-white hover:bg-slate-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {order.id}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">{order.product}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Dealer: {order.dealer}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-400">{order.date}</span>
                      <span className="font-extrabold text-slate-900 text-sm">{formatINR(order.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Table Footer */}
          <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 text-center">
            <button
              type="button"
              onClick={() => onNavigateTab?.('orders')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
            >
              <span>View All Orders in Pipeline</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Right Col: Live Waypoint Tracker & Dealer Spotlight */}
        <div className="space-y-6">
          {/* Animated Live Logistics Waypoint Tracker */}
          {activeInTransitOrder && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                    <Truck size={17} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Consignment</h3>
                    <p className="text-sm font-extrabold text-white font-mono">{activeInTransitOrder.id}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Live GPS
                </span>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800/80 mb-3.5">
                <p className="text-xs font-bold text-white truncate">{activeInTransitOrder.product}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Dest: {activeInTransitOrder.dealer}</p>
              </div>

              {/* Waypoint Stepper Progress */}
              <div className="space-y-2.5 text-xs mb-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Central Plant</span>
                  <span className="text-orange-400 font-bold">Transit Hub (NH48)</span>
                  <span>Destination Yard</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse" style={{ width: '68%' }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Dispatched 08:30 AM</span>
                  <span className="text-emerald-400 font-bold">ETA: ~2h 15m</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab?.('orders')}
                className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-600/20 cursor-pointer active:scale-95"
              >
                Track Consignment Manifest →
              </button>
            </div>
          )}

          {/* Dealer Spotlight Card */}
          {dealer ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Partner Spotlight</h3>
                  <Star className="text-amber-400 fill-amber-400" size={16} />
                </div>

                {/* Dealer Info */}
                <div className="flex items-center gap-3.5 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                    <Building2 size={22} className="text-orange-400" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{dealer.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        Authorized
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-500 font-bold">
                      <span>★ {dealer.rating}</span>
                      <span className="text-slate-400 font-normal">({dealer.reviews})</span>
                    </div>
                  </div>
                </div>

                {/* Contact & Location Details */}
                <div className="space-y-2.5 text-xs text-slate-600 mb-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-snug text-slate-700">{dealer.address}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone size={15} className="text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800 font-mono">{dealer.phone}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <MessageSquare size={14} />
                  <span>Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCallModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Phone size={14} />
                  <span>Call</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* MODAL: + New Order */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Create Materials Order"
        description="Submit an authorized bulk order directly through your dealer network."
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product *
            </label>
            {availableProducts.length > 0 ? (
              <CustomDropdown
                value={newProduct}
                onChange={setNewProduct}
                options={availableProducts.map((p) => ({
                  value: p.name,
                  label: `${p.name} (${formatINR(p.price)}/${p.unit})`,
                }))}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            ) : (
              <input
                type="text"
                required
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                placeholder="e.g. UltraTech Cement OPC 53 Grade"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Authorized Dealer *
              </label>
              {availableDealers.length > 0 ? (
                <CustomDropdown
                  value={newDealer}
                  onChange={setNewDealer}
                  options={availableDealers.map((d) => ({
                    value: d.shopName,
                    label: `${d.shopName} (${d.location})`,
                  }))}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              ) : (
                <input
                  type="text"
                  required
                  value={newDealer}
                  onChange={(e) => setNewDealer(e.target.value)}
                  placeholder="e.g. Shree Ram Hardware"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Order Value (₹) *
              </label>
              <input
                type="number"
                required
                min="1000"
                step="1000"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-3.5 text-xs text-orange-800 flex items-start gap-2.5">
            <Award className="text-orange-600 shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold">Earn Rewards Points: </span>
              Placing this order earns you approx.{' '}
              <span className="font-bold text-orange-950">
                +{Math.round((parseFloat(newAmount) || 0) * 0.01)} pts
              </span>{' '}
              added to your reward balance upon dispatch.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOrderModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={orderSubmitting}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
            >
              {orderSubmitting ? 'Placing Order…' : 'Confirm Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Message Dealer */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={`Message ${dealer?.name || 'Authorized Dealer'}`}
        description="Send a direct operational inquiry or delivery note to your dealer."
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Message Content
            </label>
            <textarea
              required
              rows={4}
              value={dealerMessageText}
              onChange={(e) => setDealerMessageText(e.target.value)}
              placeholder="Inquire about bulk pricing, specific delivery timings, or order modifications..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsMessageModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
            >
              Send Message
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Call Dealer */}
      <Modal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        title="Direct Line to Dealer"
        description="Connect with the dedicated materials logistics dispatch desk."
      >
        <div className="space-y-4 text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-100 shadow-xs">
            <Phone size={24} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">{dealer?.name}</h4>
            <p className="text-sm font-mono font-bold text-slate-600 mt-1">{dealer?.phone}</p>
            <p className="text-xs text-slate-400 mt-0.5">{dealer?.hours}</p>
          </div>
          <div className="pt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsCallModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <a
              href={`tel:${dealer?.phone}`}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Phone size={15} />
              Call Now
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
}
