import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  Layers,
  Building2,
  Truck,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi, catalogApi } from '../../lib/api';

export interface InventoryItem {
  id: string;
  rawId: string;
  name: string;
  category: 'Cement' | 'TMT Steel Rebar' | string;
  brand: string;
  unit: string;
  price: number;
  stock: number;
  inTransit: number;
  threshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  grade: string;
  attributes: Record<string, any>;
}

export default function ProductManagement() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState({ totalProducts: 0, lowStockCount: 0, healthyCount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 1. Add New Product Modal State (for Distributor)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'Cement' | 'TMT Steel Rebar'>('Cement');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdGrade, setNewProdGrade] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('Bag (50kg)');
  const [newProdPrice, setNewProdPrice] = useState('380');
  const [newProdInitialStock, setNewProdInitialStock] = useState('500');
  const [newProdThreshold, setNewProdThreshold] = useState('100');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // 2. Regular Stock Adjustment Modal State (Update quantity on regular basis)
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustOperation, setAdjustOperation] = useState<'set' | 'add' | 'subtract'>('set');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  // 3. Inbound Delivery Challan Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [inboundQuantity, setInboundQuantity] = useState('500');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [unitCost, setUnitCost] = useState('360');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const isDealer = user?.role === 'dealer' || user?.role === 'retailer';
  const isDistributor = user?.role === 'distributor' || user?.role === 'platform_owner_distributor';

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [invRes, prodsRes] = await Promise.all([
        isDealer ? inventoryApi.getDealerInventory() : inventoryApi.getDistributorInventory(),
        catalogApi.getProducts().catch(() => ({ success: true, data: [] })),
      ]);

      const rawInv = Array.isArray(invRes?.data) ? invRes.data : [];
      const mapped: InventoryItem[] = rawInv.map((item: any) => {
        const available = Number(item.quantity_available || 0);
        const inTransit = Number(item.quantity_in_transit || 0);
        const thresh = 50;
        const isOutOf = available === 0;
        const isLow = available > 0 && available < thresh;

        return {
          id: item.product_id?.slice(0, 8) || 'SKU',
          rawId: item.product_id,
          name: item.variant_name || 'Standard Material',
          category: item.category_name || 'General Materials',
          brand: item.brand_name || 'Approved Brand',
          unit: item.unit || 'units',
          price: Number(item.unit_price || 0),
          stock: available,
          inTransit,
          threshold: thresh,
          isLowStock: isLow,
          isOutOfStock: isOutOf,
          status: isOutOf ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock',
          grade: 'Commercial Grade',
          attributes: {},
        };
      });

      setInventory(mapped);
      const lowList = mapped.filter((i) => i.isLowStock || i.isOutOfStock);
      setAlerts(lowList);
      setSummary({
        totalProducts: mapped.length,
        lowStockCount: lowList.length,
        healthyCount: mapped.length - lowList.length,
      });

      if (!selectedProductId && mapped.length > 0) {
        setSelectedProductId(mapped[0].rawId);
        setUnitCost(String(mapped[0].price));
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [user?.role, user?.mobile_number]);

  // Open Add Product Modal with defaults
  const handleOpenAddProduct = () => {
    setNewProdName('');
    setNewProdCategory('Cement');
    setNewProdBrand('UltraTech');
    setNewProdGrade('OPC 53 Grade');
    setNewProdUnit('Bag (50kg)');
    setNewProdPrice('380');
    setNewProdInitialStock('500');
    setNewProdThreshold('100');
    setIsAddProductModalOpen(true);
  };

  // Create Product handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Product name is required.' });
      return;
    }
    const priceNum = parseFloat(newProdPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a valid wholesale price.' });
      return;
    }
    const initialQty = parseFloat(newProdInitialStock) || 0;

    setIsCreatingProduct(true);
    try {
      // 1. Fetch or create Brand
      const brandsRes = await catalogApi.getBrands().catch(() => ({ success: true, data: [] }));
      const brands = Array.isArray(brandsRes?.data) ? brandsRes.data : [];
      let targetBrand = brands.find((b: any) => b.brand_name.toLowerCase() === newProdBrand.trim().toLowerCase());
      if (!targetBrand) {
        const bRes = await catalogApi.createBrand(newProdBrand.trim() || 'UltraTech');
        targetBrand = bRes.data;
      }

      // 2. Fetch or create Category
      const catsRes = await catalogApi.getCategories().catch(() => ({ success: true, data: [] }));
      const categories = Array.isArray(catsRes?.data) ? catsRes.data : [];
      let targetCategory = categories.find((c: any) => c.category_name.toLowerCase() === newProdCategory.toLowerCase());
      if (!targetCategory) {
        const cRes = await catalogApi.createCategory(newProdCategory, newProdUnit.trim() || 'units');
        targetCategory = cRes.data;
      }

      // 3. Create Product
      const prodRes = await catalogApi.createProduct({
        categoryId: targetCategory.category_id,
        brandId: targetBrand.brand_id,
        variantName: newProdName.trim(),
        unit: newProdUnit.trim() || 'units',
        unitPrice: priceNum,
        attributes: { grade: newProdGrade.trim() || 'Standard Grade' },
      });

      // 4. Initial Stock Intake
      if (initialQty > 0 && prodRes?.data?.product_id) {
        await inventoryApi.adjustStock({
          productId: prodRes.data.product_id,
          quantityChange: initialQty,
          notes: 'Initial warehouse intake registration',
        });
      }

      setIsAddProductModalOpen(false);
      await loadInventory();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Product "${newProdName}" added to catalog and warehouse with ${initialQty} units!`,
      });
    } catch (err: any) {
      console.error('Error adding product:', err);
      setToast({ id: String(Date.now()), type: 'error', message: err.message || 'Failed to create product.' });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Open Adjust Stock Modal
  const handleOpenAdjustStock = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustOperation('set');
    setAdjustQuantity(String(item.stock));
    setAdjustReason('Regular physical stock verification');
    setIsAdjustStockModalOpen(true);
  };

  // Submit Stock Adjustment
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const targetQty = parseFloat(adjustQuantity);
    if (isNaN(targetQty) || targetQty < 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a valid stock quantity.' });
      return;
    }

    let diff = 0;
    if (adjustOperation === 'set') {
      diff = targetQty - adjustingItem.stock;
    } else if (adjustOperation === 'add') {
      diff = targetQty;
    } else if (adjustOperation === 'subtract') {
      diff = -targetQty;
    }

    if (diff === 0) {
      setIsAdjustStockModalOpen(false);
      return;
    }

    setIsAdjustingStock(true);
    try {
      await inventoryApi.adjustStock({
        productId: adjustingItem.rawId,
        quantityChange: diff,
        notes: adjustReason.trim() || 'Manual stock update',
      });

      setIsAdjustStockModalOpen(false);
      await loadInventory();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Stock for ${adjustingItem.name} updated in PostgreSQL database.`,
      });
    } catch (err: any) {
      console.error('Error updating stock:', err);
      setToast({ id: String(Date.now()), type: 'error', message: err.message || 'Failed to update stock.' });
    } finally {
      setIsAdjustingStock(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (item: InventoryItem) => {
    try {
      await catalogApi.updateProduct(item.rawId, { status: 'discontinued' });
      await loadInventory();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Product "${item.name}" marked as discontinued.`,
      });
    } catch (err: any) {
      console.error('Error removing product:', err);
      setToast({ id: String(Date.now()), type: 'error', message: err.message || 'Failed to discontinue product.' });
    }
  };

  // Open Log Modal
  const openLogModalForProduct = (item?: InventoryItem) => {
    if (item) {
      setSelectedProductId(item.rawId);
      setUnitCost(String(item.price));
      const isCement = item.category.toLowerCase().includes('cement');
      setInboundQuantity(isCement ? '500' : '20');
      setSupplierName(
        isDealer
          ? 'Regional Logistics Hub'
          : `${item.brand} Manufacturing Plant`
      );
    } else if (inventory.length > 0) {
      setSelectedProductId(inventory[0].rawId);
      setUnitCost(String(inventory[0].price));
      const isCement = inventory[0].category.toLowerCase().includes('cement');
      setInboundQuantity(isCement ? '500' : '20');
      setSupplierName(isDealer ? 'Regional Logistics Hub' : `${inventory[0].brand} Plant`);
    } else {
      setSupplierName('Regional Manufacturing Plant');
    }
    setInvoiceNumber(
      isDealer
        ? `DLR-REC-${Math.floor(1000 + Math.random() * 9000)}`
        : `PLANT-INV-${Math.floor(1000 + Math.random() * 9000)}`
    );
    setIsLogModalOpen(true);
  };

  // Handle Log Stock
  const handleLogStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(inboundQuantity);

    if (isNaN(qty) || qty <= 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a quantity greater than 0.' });
      return;
    }
    if (!selectedProductId) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please select a product.' });
      return;
    }

    setIsSubmittingLog(true);
    try {
      await inventoryApi.adjustStock({
        productId: selectedProductId,
        quantityChange: qty,
        notes: `Delivery Challan ${invoiceNumber} from ${supplierName}`,
      });

      setIsLogModalOpen(false);
      await loadInventory();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Inbound consignment of ${qty} units recorded into warehouse stock!`,
      });
    } catch (err: any) {
      console.error('Error logging stock:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to record inbound consignment.',
      });
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const filteredInventory = inventory.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.grade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockBadge = (status: InventoryItem['status']) => {
    switch (status) {
      case 'In Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> In Stock
          </span>
        );
      case 'Low Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <AlertTriangle size={12} /> Low Stock Alert
          </span>
        );
      case 'Out of Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={12} /> Out of Stock
          </span>
        );
      default:
        return null;
    }
  };

  const selectedItemData = inventory.find((i) => i.rawId === selectedProductId);

  const cementTotal = inventory
    .filter((i) => i.category.toLowerCase().includes('cement'))
    .reduce((sum, i) => sum + i.stock, 0);

  const steelTotal = inventory
    .filter((i) => !i.category.toLowerCase().includes('cement'))
    .reduce((sum, i) => sum + i.stock, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isDealer ? 'Store & Yard Inventory' : 'Products & Warehouse Inventory'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isDealer
                ? 'Manage your retail shop and stockyard inventory for Cement and TMT Steel Rebar (Sariya).'
                : 'Define your product catalog and manage live central warehouse stock levels.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadInventory}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Refresh Inventory"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Distributor can add new product anytime */}
          {isDistributor && (
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          )}

          {/* Log formal shipment delivery */}
          {inventory.length > 0 && (
            <button
              type="button"
              onClick={() => openLogModalForProduct()}
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Truck size={16} />
              <span>{isDealer ? 'Record Delivery' : 'Log Delivery Challan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Metric Chips (No visual clutter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL PRODUCTS</p>
          <p className="text-2xl font-bold text-slate-900">{inventory.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Catalog SKUs</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">CEMENT STOCK</p>
          <p className="text-2xl font-bold text-blue-700">
            {formatNumber(cementTotal)} <span className="text-xs font-normal text-slate-500">Bags</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">50kg Standard Bags</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">TMT STEEL STOCK</p>
          <p className="text-2xl font-bold text-orange-700">
            {formatNumber(steelTotal)} <span className="text-xs font-normal text-slate-500">MT</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">TMT Steel Rebar (Sariya)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">INVENTORY STATUS</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-900">
              {alerts.length > 0 ? alerts.length : '0'}
            </p>
            {alerts.length > 0 ? (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Low / Nil
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                All Healthy
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Items needing replenishment</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by product name, brand, or grade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setCategoryFilter('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'All' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({inventory.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('Cement')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'Cement' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cement
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('TMT Steel Rebar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'TMT Steel Rebar' ? 'bg-white text-orange-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                TMT Steel Rebar (Sariya)
              </button>
            </div>

            {/* View Mode Toggle: Table vs Cards */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-orange-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Dense Table View"
                aria-label="Table View"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-orange-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Visual Card Grid View"
                aria-label="Card Grid View"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Table View / Clean Empty State */}
        {inventory.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={Package}
              title={isDistributor ? 'No Products in Inventory Catalog' : 'Store Inventory Empty'}
              description={
                isDistributor
                  ? 'Your product catalog starts completely clean with 0 items. Click "+ Add Product" to enter your Cement and TMT Steel Rebar brands and initial warehouse stock.'
                  : 'Your store inventory starts at 0. Place a wholesale purchase order to your distributor or record received store stock to populate items.'
              }
              actionLabel={isDistributor ? '+ Add Your First Product' : undefined}
              onAction={isDistributor ? handleOpenAddProduct : undefined}
            />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No products matching &quot;{searchTerm}&quot; in category &quot;{categoryFilter}&quot;.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-5 bg-slate-50/30">
            {filteredInventory.map((item) => {
              const stockPct = Math.min(100, Math.round((item.stock / Math.max(item.threshold * 2, 1)) * 100));
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Bar: Category + SKU + Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          item.category.includes('Cement')
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.id}
                      </span>
                      {getStockBadge(item.status)}
                    </div>

                    {/* Product Title, Brand & Grade */}
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {item.brand} • <span className="text-slate-700 font-semibold">{item.grade}</span>
                    </p>

                    {/* Price & Unit */}
                    <div className="mt-3 flex items-baseline gap-1 text-slate-900">
                      <span className="text-xl font-black">{formatINR(item.price)}</span>
                      <span className="text-xs text-slate-400 font-medium">/ {item.unit}</span>
                    </div>

                    {/* Stock Level Gauge */}
                    <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-slate-500 font-medium">Available Stock:</span>
                        <span
                          className={`font-black text-sm ${
                            item.isOutOfStock
                              ? 'text-rose-600'
                              : item.isLowStock
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatNumber(item.stock)} {item.unit.split(' ')[0]}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.isOutOfStock
                              ? 'bg-rose-500'
                              : item.isLowStock
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.stock === 0 ? 0 : Math.max(5, stockPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Threshold: {item.threshold} {item.unit.split(' ')[0]}</span>
                        {item.inTransit > 0 && (
                          <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                            <Truck size={11} /> +{item.inTransit} en route
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustStock(item)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Sliders size={13} />
                      <span>Adjust Stock</span>
                    </button>
                    {isDistributor && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(item)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Product Name & SKU</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Brand & Grade</th>
                  <th className="px-6 py-4">Wholesale Price</th>
                  <th className="px-6 py-4">{isDealer ? 'Store Available Stock' : 'Warehouse Available Stock'}</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredInventory.map((item) => {
                  const stockPct = Math.min(100, Math.round((item.stock / Math.max(item.threshold * 2, 1)) * 100));
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              item.category.includes('Cement')
                                ? 'bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs'
                                : 'bg-amber-50 text-amber-700 border border-amber-100 shadow-2xs'
                            }`}
                          >
                            {item.category.includes('Cement') ? 'CEM' : 'STEEL'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <p className="mt-0.5">
                              <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.id}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.category.includes('Cement')
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{item.brand}</p>
                        <p className="text-xs text-slate-400 font-medium">{item.grade}</p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-slate-900 font-black">{formatINR(item.price)}</span>
                        <span className="text-xs text-slate-400 font-medium ml-1">/ {item.unit}</span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-36">
                          <div className="flex items-baseline justify-between text-xs">
                            <span
                              className={`text-sm font-black ${
                                item.isOutOfStock
                                  ? 'text-rose-600'
                                  : item.isLowStock
                                  ? 'text-amber-600'
                                  : 'text-slate-900'
                              }`}
                            >
                              {formatNumber(item.stock)}{' '}
                              <span className="text-[11px] font-normal text-slate-500">{item.unit.split(' ')[0]}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Min {item.threshold}</span>
                          </div>
                          {/* Mini stock progress gauge */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.isOutOfStock
                                  ? 'bg-rose-500'
                                  : item.isLowStock
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${item.stock === 0 ? 0 : Math.max(5, stockPct)}%` }}
                            />
                          </div>
                          {item.inTransit > 0 && (
                            <span className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5 font-semibold">
                              <Truck size={10} /> {item.inTransit} in transit
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">{getStockBadge(item.status)}</td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Update Quantity on Regular Basis */}
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustStock(item)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                            title="Regularly update or adjust stock quantity"
                          >
                            <Sliders size={12} /> Adjust Stock
                          </button>

                          {/* Distributor delete option */}
                          {isDistributor && (
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Product from Catalog"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/50">
          <span>Showing {filteredInventory.length} of {inventory.length} items in inventory</span>
          <span className="font-medium text-slate-600">
            Standard units: Cement in 50kg Bags, Steel Rebar in Metric Tons (MT).
          </span>
        </div>
      </div>

      {/* MODAL 1: Add New Product (Distributor defines product & initial stock) */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title="Add New Product to Catalog"
        description="Enter product name, brand, specifications, and initial stock quantity."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category *
              </label>
              <CustomDropdown
                value={newProdCategory}
                onChange={(val) => {
                  const cat = val as 'Cement' | 'TMT Steel Rebar';
                  setNewProdCategory(cat);
                  if (cat === 'Cement') {
                    setNewProdUnit('Bag (50kg)');
                    setNewProdThreshold('100');
                    setNewProdPrice('380');
                    setNewProdInitialStock('500');
                  } else {
                    setNewProdUnit('MT (Metric Ton)');
                    setNewProdThreshold('5');
                    setNewProdPrice('62000');
                    setNewProdInitialStock('25');
                  }
                }}
                options={[
                  { value: 'Cement', label: 'Cement (Bags)' },
                  { value: 'TMT Steel Rebar', label: 'TMT Steel Rebar - Sariya (Metric Tons)' },
                ]}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Brand Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UltraTech, Tata Tiscon, Ambuja, Jindal"
                value={newProdBrand}
                onChange={(e) => setNewProdBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Product Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. UltraTech Weather Pro OPC 53 Grade"
              value={newProdName}
              onChange={(e) => setNewProdName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Grade / Quality Specification
              </label>
              <input
                type="text"
                placeholder="e.g. OPC 53, PPC 43, Fe 550D, Fe 500"
                value={newProdGrade}
                onChange={(e) => setNewProdGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                value={newProdUnit}
                onChange={(e) => setNewProdUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Wholesale Base Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                placeholder="380"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                placeholder="500"
                value={newProdInitialStock}
                onChange={(e) => setNewProdInitialStock(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Low Stock Threshold *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="100"
                value={newProdThreshold}
                onChange={(e) => setNewProdThreshold(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddProductModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingProduct}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              {isCreatingProduct ? 'Adding Product...' : 'Save Product & Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Regular Stock Quantity Adjustment */}
      <Modal
        isOpen={isAdjustStockModalOpen}
        onClose={() => setIsAdjustStockModalOpen(false)}
        title={adjustingItem ? `Update Stock: ${adjustingItem.name}` : 'Adjust Stock'}
        description="Update your current physical stock holding on a regular basis."
      >
        {adjustingItem && (
          <form onSubmit={handleAdjustStock} className="space-y-4">
            {/* Current Stock Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs sm:text-sm">
              <div>
                <span className="text-slate-500">Current Recorded Stock:</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {formatNumber(adjustingItem.stock)} {adjustingItem.unit}
                </p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Material SKU:</span>
                <p className="font-mono font-bold text-slate-700 mt-0.5">{adjustingItem.id}</p>
              </div>
            </div>

            {/* Adjustment Mode Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Adjustment Action
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustOperation('set');
                    setAdjustQuantity(String(adjustingItem.stock));
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    adjustOperation === 'set'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Set Exact Count
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustOperation('add');
                    setAdjustQuantity('100');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    adjustOperation === 'add'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight size={13} /> Add Stock (+)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustOperation('subtract');
                    setAdjustQuantity('50');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    adjustOperation === 'subtract'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownRight size={13} /> Deduct Stock (-)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {adjustOperation === 'set'
                  ? `New Exact Quantity (${adjustingItem.unit}) *`
                  : adjustOperation === 'add'
                  ? `Quantity to Add (${adjustingItem.unit}) *`
                  : `Quantity to Deduct (${adjustingItem.unit}) *`}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Audit Note / Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Physical inventory reconciliation, regular stock count"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdjustStockModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdjustingStock}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                {isAdjustingStock ? 'Updating Stock...' : 'Save Stock Update'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: Inbound Delivery Challan Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={isDealer ? 'Log Inbound Store Stock Entry' : 'Log Plant Delivery Challan'}
        maxWidth="lg"
      >
        <form onSubmit={handleLogStock} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Material Variant *
            </label>
            <CustomDropdown
              value={selectedProductId}
              onChange={(newId) => {
                setSelectedProductId(newId);
                const item = inventory.find((i) => i.rawId === newId);
                if (item) {
                  setUnitCost(String(item.price));
                  const isCement = item.category.toLowerCase().includes('cement');
                  setInboundQuantity(isCement ? '500' : '20');
                  setSupplierName(
                    isDealer ? 'North Zone Logistics Ltd' : `${item.brand} Regional Plant`
                  );
                }
              }}
              options={inventory.map((i) => ({
                value: i.rawId,
                label: `${i.name} (${i.brand} - ${i.grade})`,
              }))}
              className="w-full"
              buttonClassName="w-full py-2.5"
              menuClassName="w-full"
            />
          </div>

          {selectedItemData && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs border border-slate-200/60">
              <div>
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-slate-800 ml-1.5">
                  {formatNumber(selectedItemData.stock)} {selectedItemData.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Alert Threshold:</span>
                <span className="font-bold text-amber-700 ml-1.5">
                  {selectedItemData.threshold} {selectedItemData.unit}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Inbound Quantity ({selectedItemData?.unit || 'Units'}) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="500"
                value={inboundQuantity}
                onChange={(e) => setInboundQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Unit Purchase Cost (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="380"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Supplier / Manufacturing Plant *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UltraTech Kotputli Plant"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Challan / Invoice Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CHAL-8821"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingLog}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              {isSubmittingLog ? 'Recording...' : 'Record Inbound Delivery'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
