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
  AlertCircle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Order, DealerSpotlight } from '../../services/dataService';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '../ui/Skeleton';
import { CustomDropdown } from '../ui/CustomDropdown';
import { useAuth } from '../../context/AuthContext';
import {
  analyticsApi,
  ordersApi,
  inventoryApi,
  catalogApi,
  usersApi,
  loyaltyApi,
  InventoryItem,
  Product as CatalogProduct,
} from '../../lib/api';

export default function DashboardView({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dealer, setDealer] = useState<DealerSpotlight | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Live KPI stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    ordersTrend: '0',
    purchaseValue: 0,
    purchaseTrend: '₹0',
    availablePoints: 0,
    pointsTrend: '0 Pts',
    activeReferrals: 0,
    referralsTrend: '0',
  });

  // New Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<CatalogProduct[]>([]);
  const [availableDealers, setAvailableDealers] = useState<any[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newDealerId, setNewDealerId] = useState('');
  const [newAmount, setNewAmount] = useState('25000');
  const [orderQuantity, setOrderQuantity] = useState('10');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Dealer Contact Modals
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [dealerMessageText, setDealerMessageText] = useState('');
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Load live data from PostgreSQL via /api/v1/*
  const loadData = async () => {
    try {
      setIsLoading(true);
      const isDealer = user?.role === 'dealer' || user?.role === 'retailer';
      const isDistributor = user?.role === 'distributor' || user?.role === 'platform_owner_distributor';

      // 1. Fetch live analytics, points balance, invoices, inventory, and dealers
      const [analyticsRes, pointsRes, invoicesRes, invRes, dealersRes, prodsRes] = await Promise.all([
        isDistributor
          ? analyticsApi.getDistributorAnalytics().catch(() => null)
          : isDealer
          ? analyticsApi.getDealerAnalytics().catch(() => null)
          : Promise.resolve(null),
        loyaltyApi.getMyBalance().catch(() => null),
        isDistributor
          ? ordersApi.getDistributorInvoices().catch(() => ({ success: true, data: [] }))
          : ordersApi.getDealerInvoices().catch(() => ({ success: true, data: [] })),
        isDealer
          ? inventoryApi.getDealerInventory().catch(() => ({ success: true, data: [] }))
          : inventoryApi.getDistributorInventory().catch(() => ({ success: true, data: [] })),
        usersApi.getDealers().catch(() => ({ success: true, data: [] })),
        catalogApi.getProducts().catch(() => ({ success: true, data: [] })),
      ]);

      // Map live invoices to UI Orders
      const rawInvoices = Array.isArray(invoicesRes?.data) ? invoicesRes.data : [];
      const mappedOrders: Order[] = rawInvoices.map((inv: any) => {
        const rawStatus = (inv.status || 'pending').toLowerCase();
        let uiStatus: Order['status'] = 'Processing';
        if (rawStatus === 'delivered') uiStatus = 'Delivered';
        else if (rawStatus === 'cancelled') uiStatus = 'Cancelled';
        else if (rawStatus === 'dispatched' || rawStatus === 'in transit') uiStatus = 'In Transit';

        return {
          id: inv.invoice_number || inv.invoice_id?.slice(0, 8) || '#ORD',
          product: inv.dealer_name || inv.customer_name ? `Consignment: ${inv.dealer_name || inv.customer_name}` : 'Wholesale Material Consignment',
          dealer: inv.dealer_name || inv.distributor_name || 'Authorized Regional Partner',
          status: uiStatus,
          amount: Number(inv.total_amount || 0),
          date: inv.invoice_date
            ? new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recent',
          pointsEarned: Math.round(Number(inv.total_amount || 0) * 0.01),
        };
      });
      setOrders(mappedOrders);

      // Inventory
      const invItems = Array.isArray(invRes?.data) ? invRes.data : [];
      setInventory(invItems);

      // Dealers & Products for modal
      const rawDealers = Array.isArray(dealersRes?.data) ? dealersRes.data : [];
      setAvailableDealers(rawDealers);
      if (rawDealers.length > 0 && !newDealerId) {
        setNewDealerId(rawDealers[0].dealer_id);
      }

      const rawProducts = Array.isArray(prodsRes?.data) ? prodsRes.data : [];
      setAvailableProducts(rawProducts);
      if (rawProducts.length > 0 && !newProductId) {
        setNewProductId(rawProducts[0].product_id);
      }

      // Compute Real Stats
      const totalSpend = mappedOrders.reduce((sum, o) => sum + o.amount, 0);
      const pointsBalance = pointsRes?.data?.balance ?? 0;
      const activeDealersCount = rawDealers.filter((d: any) => d.status === 'active' || d.status === 'Active').length;

      let ordersCount = mappedOrders.length;
      let purchaseVal = totalSpend;

      if (analyticsRes?.data) {
        const d = analyticsRes.data;
        if (isDistributor && d.b2bSalesToDealers) {
          ordersCount = d.b2bSalesToDealers.invoiceCount ?? ordersCount;
          purchaseVal = d.b2bSalesToDealers.totalAmount ?? purchaseVal;
        } else if (isDealer && d.purchases) {
          ordersCount = d.purchases.invoiceCount ?? ordersCount;
          purchaseVal = d.purchases.totalAmount ?? purchaseVal;
        }
      }

      setStats({
        totalOrders: ordersCount,
        ordersTrend: ordersCount > 0 ? `${ordersCount} recorded` : '0',
        purchaseValue: purchaseVal,
        purchaseTrend: purchaseVal > 0 ? formatINR(purchaseVal) : '₹0',
        availablePoints: pointsBalance,
        pointsTrend: pointsBalance > 0 ? `${formatNumber(pointsBalance)} Pts` : '0 Pts',
        activeReferrals: activeDealersCount,
        referralsTrend: activeDealersCount > 0 ? `${activeDealersCount} active` : '0',
      });

      // Spotlight Dealer
      if (rawDealers.length > 0) {
        const d = rawDealers[0];
        setDealer({
          id: d.dealer_id?.slice(0, 8) || 'DLR-901',
          name: d.shop_name || d.owner_name || 'Regional Partner Dealership',
          rating: 5.0,
          reviews: 1,
          address: `${d.city || 'Regional Center'}, ${d.state || 'India'}`,
          phone: d.mobile_number ? `+91 ${d.mobile_number}` : 'Verified Contact',
          hours: '09:00 AM - 08:00 PM',
          ordersYtd: 0,
          spendYtd: 0,
          deliveryRange: '35 km Local Delivery Zone',
          distributionCenter: 'Central Logistics Hub',
        });
      } else {
        setDealer(null);
      }
    } catch (err) {
      console.error('Failed to load dashboard live data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role, user?.mobile_number]);

  // Inventory breakdown calculation
  const inventorySummary = useMemo(() => {
    const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity_available || 0), 0);
    if (totalUnits === 0 || inventory.length === 0) {
      return { isEmpty: true, totalUnits: 0, categories: [] };
    }

    const catMap = new Map<string, number>();
    inventory.forEach((item) => {
      const cat = item.category_name || 'General Materials';
      catMap.set(cat, (catMap.get(cat) || 0) + Number(item.quantity_available || 0));
    });

    const categories = Array.from(catMap.entries()).map(([name, units]) => ({
      name,
      units,
      percentage: Math.max(1, Math.round((units / totalUnits) * 100)),
    }));

    return {
      isEmpty: false,
      totalUnits,
      categories,
    };
  }, [inventory]);

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

  // Real Active in-transit consignment (strictly genuine status)
  const activeInTransitOrder = useMemo(() => {
    return orders.find((o) => o.status === 'In Transit') || null;
  }, [orders]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount);
    const qty = parseInt(orderQuantity, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a valid order amount.' });
      return;
    }
    if (!newDealerId) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please select a registered dealer.' });
      return;
    }

    setOrderSubmitting(true);
    try {
      const invNumber = `DIST-${Math.floor(100000 + Math.random() * 900000)}`;
      const prod = availableProducts.find((p) => p.product_id === newProductId);
      const unitPrice = prod ? Number(prod.unit_price) : Math.round(parsedAmount / (qty || 1));

      await ordersApi.createDistributorInvoice({
        dealerId: newDealerId,
        invoiceNumber: invNumber,
        items: [
          {
            productId: newProductId || (prod?.product_id as string),
            quantity: qty || 1,
            unitPrice,
          },
        ],
      });

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Invoice ${invNumber} issued successfully! Recorded to live database.`,
      });
      setIsOrderModalOpen(false);
      await loadData();
    } catch (err: any) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to create invoice. Ensure sufficient inventory exists.',
      });
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
      message: `Direct message dispatched to ${dealer?.name || 'Authorized Partner'}.`,
    });
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'In Transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            In Transit
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Delivered
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock size={12} className="text-amber-600" />
            Processing
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Top Banner / Welcome Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Operational Hub
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Authorized regional consignment dispatch & verified dealer ecosystem
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Date Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Calendar size={14} className="text-slate-500" />
              <span>{dateRange}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {dateDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                {['Today', 'Last 7 Days', 'Last 30 Days', 'This Quarter', 'All Time'].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setDateRange(range);
                      setDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      dateRange === range ? 'bg-orange-50 text-orange-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsOrderModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 hover:shadow-lg hover:shadow-orange-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
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
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {stats.ordersTrend}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL ORDERS</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatNumber(stats.totalOrders)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
              {stats.totalOrders > 0 ? 'Verified consignment orders' : 'No dispatches recorded yet'}
            </p>
          </div>

          {/* Card 2: Purchase Value */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Wallet size={19} />
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {stats.purchaseValue > 0 ? 'Live B2B' : '₹0'}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">PURCHASE VALUE</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatINR(stats.purchaseValue)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
              {stats.purchaseValue > 0 ? 'Cumulative invoiced volume' : 'Zero transaction volume'}
            </p>
          </div>

          {/* Card 3: Available Points */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Award size={19} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                {stats.availablePoints > 0 ? 'Redeemable' : '0 Pts'}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">AVAILABLE REWARD PTS</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatNumber(stats.availablePoints)}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
              {stats.availablePoints > 0 ? 'Redeemable partner incentives' : 'No reward points accumulated'}
            </p>
          </div>

          {/* Card 4: Active Referrals */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Users size={19} />
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {stats.activeReferrals} Active
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">CHANNEL NETWORK</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stats.activeReferrals}</h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
              {stats.activeReferrals > 0 ? 'Verified network merchants' : 'No network dealers onboarded'}
            </p>
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
              Live inventory distribution across structural categories from PostgreSQL warehouse storage
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/70">
            {inventorySummary.isEmpty ? '0 Units in Stock' : `Total Stock: ${formatNumber(inventorySummary.totalUnits)} Units`}
          </span>
        </div>

        {inventorySummary.isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-slate-50/50 border border-dashed border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <Layers size={20} />
            </div>
            <p className="text-xs font-bold text-slate-700">No Inventory Records in Warehouse</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-md">
              Warehouse stock balance will reflect live here once initial material catalog items and intake consignments are recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {inventorySummary.categories.map((cat, idx) => {
                const colors = [
                  'bg-gradient-to-r from-sky-500 to-blue-600',
                  'bg-gradient-to-r from-amber-500 to-orange-600',
                  'bg-emerald-500',
                  'bg-purple-500',
                  'bg-teal-500',
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={cat.name}
                    className={`h-full ${color}`}
                    style={{ width: `${Math.max(5, cat.percentage)}%` }}
                    title={`${cat.name}: ${cat.percentage}% (${formatNumber(cat.units)} Units)`}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 gap-2">
              {inventorySummary.categories.map((cat, idx) => {
                const dotColors = ['bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500', 'bg-teal-500'];
                const dotColor = dotColors[idx % dotColors.length];
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                    <span className="font-bold text-slate-800">{cat.name}:</span>
                    <span className="text-slate-500">
                      {cat.percentage}% ({formatNumber(cat.units)} Units)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                className="w-36"
                buttonClassName="py-1.5 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Table Content with Empty State */}
          {isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No Orders Found"
              description={
                searchQuery || statusFilter !== 'All'
                  ? 'Try adjusting your search criteria or status filter.'
                  : 'You have not placed or received any wholesale orders yet.'
              }
              actionLabel="Create First Order"
              onAction={() => setIsOrderModalOpen(true)}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/60 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Order ID</th>
                      <th className="px-5 py-3">Product Manifest</th>
                      <th className="px-5 py-3">Recipient Partner</th>
                      <th className="px-5 py-3">Total Value</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {filteredOrders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold font-mono text-slate-800">{order.id}</td>
                        <td className="px-5 py-3.5 text-slate-900 font-semibold">{order.product}</td>
                        <td className="px-5 py-3.5 text-slate-600">{order.dealer}</td>
                        <td className="px-5 py-3.5 font-extrabold text-slate-900">{formatINR(order.amount)}</td>
                        <td className="px-5 py-3.5">{getStatusBadge(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filteredOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-xs text-slate-900">{order.id}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-xs font-bold text-slate-800">{order.product}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span>{order.dealer}</span>
                      <span className="font-extrabold text-slate-900">{formatINR(order.amount)}</span>
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
          {activeInTransitOrder ? (
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
                  <span className="text-orange-400 font-bold">Transit Hub</span>
                  <span>Destination Yard</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse" style={{ width: '68%' }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>In Route</span>
                  <span className="text-emerald-400 font-bold">Status: En Route</span>
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
          ) : (
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800 text-center py-6">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-400 mb-2">
                <Truck size={20} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Consignment Dispatch</h3>
              <p className="text-xs text-slate-300 font-semibold mt-1">No active dispatches in transit</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                When dispatches are in transit, live waypoint progress will appear here.
              </p>
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
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Building2 size={22} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">No Partner Spotlight</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Registered authorized dealers in your regional network will be featured here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab?.('dealers')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
              >
                <span>Explore Dealer Directory</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
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
              Select Product Material *
            </label>
            {availableProducts.length > 0 ? (
              <CustomDropdown
                value={newProductId}
                onChange={setNewProductId}
                options={availableProducts.map((p) => ({
                  value: p.product_id,
                  label: `${p.variant_name} (${formatINR(Number(p.unit_price))}/${p.unit})`,
                }))}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>No products found in catalog. Create products under Inventory first.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Dealer *
              </label>
              {availableDealers.length > 0 ? (
                <CustomDropdown
                  value={newDealerId}
                  onChange={setNewDealerId}
                  options={availableDealers.map((d) => ({
                    value: d.dealer_id,
                    label: `${d.shop_name || d.owner_name} (${d.city || 'Regional'})`,
                  }))}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>No registered dealers found. Onboard dealers first.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantity Units *
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
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
              disabled={orderSubmitting || availableDealers.length === 0}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs hover:shadow transition-all disabled:opacity-60 cursor-pointer"
            >
              {orderSubmitting ? 'Issuing Invoice…' : 'Issue Invoice & Reserve Stock'}
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
