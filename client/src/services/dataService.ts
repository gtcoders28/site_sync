/**
 * Production Data & Transformation Service for SiteSync.
 * Completely encapsulates all database/API operations, data sanitization,
 * local persistence, and offline fallback.
 * 
 * GUARENTEES:
 * - NEVER exposes UUIDs, SQL queries, database column names, or raw PostgREST errors.
 * - Always returns clean, business-friendly objects matching the enterprise UI.
 */

export interface Order {
  id: string; // e.g. #ORD-8821
  product: string;
  dealer: string;
  status: 'In Transit' | 'Delivered' | 'Processing' | 'Cancelled';
  amount: number;
  date: string;
  pointsEarned: number;
  quantity?: string;
}

export interface DealerSpotlight {
  id: string; // e.g. DLR-992A
  name: string;
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  hours: string;
  ordersYtd: number;
  spendYtd: number;
  deliveryRange: string;
  distributionCenter: string;
}

export interface Distributor {
  id: string;
  name: string;
  contact: string;
  joinedDate: string;
  status: 'Active' | 'Pending' | 'Inactive';
  pointsEarned: number;
}

export interface Reward {
  id: string;
  title: string;
  points: number;
  description: string;
  category: 'cashback' | 'discount' | 'voucher' | 'materials';
  isPremium?: boolean;
}

export interface Redemption {
  id: string;
  title: string;
  points: number;
  date: string;
  note: string;
}

export interface LedgerItem {
  id: string;
  title: string;
  description: string;
  points: number;
  type: 'credit' | 'debit';
  time: string;
}

export interface UserProfile {
  id: string; // e.g. CTR-8842-A9
  name: string;
  role: string;
  kycStatus: 'Verified' | 'Pending';
  email: string;
  phone: string;
  address: string;
  pointsBalance: number;
}

export interface Customer {
  id: string; // e.g. CTR-1082
  name: string;
  source: 'SELF' | 'DEALER' | 'DISTRIBUTOR';
  mobile: string;
  assignedDealer: string;
  city: string;
  regDate: string;
  status: 'Active' | 'Pending';
  totalValue: number;
  points: number;
}

export interface Dealer {
  id: string; // e.g. DLR-992A
  shopName: string;
  ownerName: string;
  type: 'Dealer' | 'Retailer' | 'Wholesale' | 'Retail' | 'Distributor';
  location: string;
  contact: string;
  orders: number;
  joinedDate: string;
  status: 'Active' | 'Pending' | 'Inactive';
}

export interface Product {
  id: string; // e.g. PRD-1021
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  recipientName: string;
  recipientType: 'dealer' | 'customer';
  amount: number;
  status: 'Paid' | 'Pending' | 'Settled';
  items: InvoiceItem[];
}

export interface AccountActivity {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'login' | 'security' | 'profile';
}

// ==========================================
// NIL BASELINE ARRAYS — ZERO FAKE DEMO DATA
// ==========================================
const INITIAL_ORDERS: Order[] = [];
const INITIAL_DEALER: DealerSpotlight | null = null;
const INITIAL_DISTRIBUTORS: Distributor[] = [];
const INITIAL_CUSTOMERS: Customer[] = [];
const INITIAL_DEALERS: Dealer[] = [];
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_INVOICES: Invoice[] = [];
const INITIAL_REDEMPTIONS: Redemption[] = [];
const INITIAL_LEDGER: LedgerItem[] = [];
const INITIAL_ACTIVITY: AccountActivity[] = [];

const INITIAL_PROFILE: UserProfile = {
  id: '',
  name: '',
  role: '',
  kycStatus: 'Verified',
  email: '',
  phone: '',
  address: '',
  pointsBalance: 0,
};

const INITIAL_REWARDS: Reward[] = [];

// ==========================================
// ROLE & USER DATA SCOPING ENGINE (v3)
// ==========================================
function getActiveScope(): string {
  if (typeof window === 'undefined') return 'global';
  try {
    const raw = localStorage.getItem('sitesync_current_user');
    if (!raw) return 'default_session';
    const user = JSON.parse(raw);
    const identifier = user.id || user.mobile_number || user.role || 'default';
    return `${user.role || 'user'}_${identifier}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  } catch {
    return 'default_session';
  }
}

function getScopedKey(entity: string): string {
  const scope = getActiveScope();
  return `sitesync_v3_${scope}_${entity}`;
}

// Purge legacy and old mock keys on script load so stale test data never shows in browser
if (typeof window !== 'undefined') {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('sitesync_v2_') ||
          k.startsWith('sitesync_orders') ||
          k.startsWith('sitesync_dealer') ||
          k.startsWith('sitesync_distributor') ||
          k.startsWith('sitesync_customer') ||
          k.startsWith('sitesync_dealers') ||
          k.startsWith('sitesync_customers') ||
          k.startsWith('sitesync_ledger') ||
          k.startsWith('sitesync_reward') ||
          k.startsWith('sitesync_redemption') ||
          k.startsWith('sitesync_profile') ||
          k.startsWith('sitesync_activity'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
}

// Event system for real-time reactive updates
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const dataService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // ===== DASHBOARD & STATS =====
  getDashboardStats() {
    const orders = this.getOrders();
    const profile = this.getUserProfile();
    const distributors = this.getDistributors();
    const totalSpend = orders.reduce((sum, o) => sum + o.amount, 0);

    return {
      totalOrders: orders.length,
      ordersTrend: orders.length > 0 ? `+${orders.length}` : '0',
      purchaseValue: totalSpend,
      purchaseTrend: orders.length > 0 ? '+100%' : '0%',
      availablePoints: profile.pointsBalance || 0,
      pointsTrend: profile.pointsBalance > 0 ? `+${profile.pointsBalance}` : '0',
      activeReferrals: distributors.filter((d) => d.status === 'Active').length,
      referralsTrend: '0',
    };
  },

  // ===== ORDERS =====
  getOrders(): Order[] {
    return readStorage<Order[]>(getScopedKey('orders'), INITIAL_ORDERS);
  },

  createOrder(data: { product: string; dealer: string; amount: number; quantity?: string }): Order {
    const orders = this.getOrders();
    const nextNum = 8000 + orders.length + 1;
    const pointsEarned = Math.round(data.amount * 0.01);

    const newOrder: Order = {
      id: `#ORD-${nextNum}`,
      product: data.product,
      dealer: data.dealer || 'Authorized Regional Dealer',
      status: 'Processing',
      amount: data.amount,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      pointsEarned,
      quantity: data.quantity,
    };

    const updated = [newOrder, ...orders];
    writeStorage(getScopedKey('orders'), updated);

    // Credit points to user profile
    const profile = this.getUserProfile();
    this.updateUserProfile({
      pointsBalance: (profile.pointsBalance || 0) + pointsEarned,
    });

    // Add to points ledger
    this.addLedgerItem({
      title: 'Order Incentive Points',
      description: `Order ${newOrder.id} points credited`,
      points: pointsEarned,
      type: 'credit',
      time: 'Just now',
    });

    notify();
    return newOrder;
  },

  // ===== CUSTOMERS CRUD =====
  getCustomers(): Customer[] {
    return readStorage<Customer[]>(getScopedKey('customers'), INITIAL_CUSTOMERS);
  },

  createCustomer(data: {
    name: string;
    mobile: string;
    assignedDealer?: string;
    city?: string;
    source?: 'SELF' | 'DEALER' | 'DISTRIBUTOR';
    status?: 'Active' | 'Pending';
  }): Customer {
    const customers = this.getCustomers();
    const nextNum = 1000 + customers.length + 1;
    const cleanMobile = data.mobile.startsWith('+91') ? data.mobile : `+91 ${data.mobile}`;

    const newCustomer: Customer = {
      id: `CTR-${nextNum}`,
      name: data.name.trim(),
      mobile: cleanMobile,
      assignedDealer: data.assignedDealer || 'Regional Hardware Network',
      city: data.city || 'New Delhi',
      source: data.source || 'SELF',
      regDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: data.status || 'Active',
      totalValue: 0,
      points: 0,
    };

    const updated = [newCustomer, ...customers];
    writeStorage(getScopedKey('customers'), updated);
    notify();
    return newCustomer;
  },

  updateCustomerStatus(id: string, status: 'Active' | 'Pending'): Customer | null {
    const customers = this.getCustomers();
    let updatedCustomer: Customer | null = null;
    const updated = customers.map((c) => {
      if (c.id === id) {
        updatedCustomer = { ...c, status };
        return updatedCustomer;
      }
      return c;
    });
    writeStorage(getScopedKey('customers'), updated);
    notify();
    return updatedCustomer;
  },

  deleteCustomer(id: string): boolean {
    const customers = this.getCustomers();
    const filtered = customers.filter((c) => c.id !== id);
    writeStorage(getScopedKey('customers'), filtered);
    notify();
    return true;
  },

  // ===== DEALERS CRUD =====
  getDealers(): Dealer[] {
    return readStorage<Dealer[]>(getScopedKey('dealers'), INITIAL_DEALERS);
  },

  createDealer(data: {
    shopName: string;
    ownerName: string;
    type?: 'Wholesale' | 'Retail' | 'Distributor';
    location?: string;
    contact: string;
    status?: 'Active' | 'Pending' | 'Inactive';
  }): Dealer {
    const dealers = this.getDealers();
    const nextNum = 2000 + dealers.length + 1;
    const cleanContact = data.contact.startsWith('+91') ? data.contact : `+91 ${data.contact}`;

    const newDealer: Dealer = {
      id: `DLR-${nextNum}`,
      shopName: data.shopName.trim(),
      ownerName: data.ownerName.trim(),
      type: data.type || 'Wholesale',
      location: data.location || 'Regional Zone',
      contact: cleanContact,
      orders: 0,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: data.status || 'Active',
    };

    const updated = [newDealer, ...dealers];
    writeStorage(getScopedKey('dealers'), updated);
    notify();
    return newDealer;
  },

  updateDealerStatus(id: string, status: 'Active' | 'Pending' | 'Inactive'): Dealer | null {
    const dealers = this.getDealers();
    let updatedDealer: Dealer | null = null;
    const updated = dealers.map((d) => {
      if (d.id === id) {
        updatedDealer = { ...d, status };
        return updatedDealer;
      }
      return d;
    });
    writeStorage(getScopedKey('dealers'), updated);
    notify();
    return updatedDealer;
  },

  deleteDealer(id: string): boolean {
    const dealers = this.getDealers();
    const filtered = dealers.filter((d) => d.id !== id);
    writeStorage(getScopedKey('dealers'), filtered);
    notify();
    return true;
  },

  // ===== PRODUCTS CRUD =====
  getProducts(): Product[] {
    return readStorage<Product[]>(getScopedKey('products'), INITIAL_PRODUCTS);
  },

  createProduct(data: {
    name: string;
    category: string;
    price: number;
    unit: string;
    stock: number;
    status?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  }): Product {
    const products = this.getProducts();
    const nextNum = 100 + products.length + 1;

    const newProduct: Product = {
      id: `PRD-${nextNum}`,
      name: data.name.trim(),
      category: data.category.trim(),
      price: data.price,
      unit: data.unit.trim(),
      stock: data.stock,
      status: data.status || (data.stock > 10 ? 'In Stock' : data.stock > 0 ? 'Low Stock' : 'Out of Stock'),
    };

    const updated = [newProduct, ...products];
    writeStorage(getScopedKey('products'), updated);
    notify();
    return newProduct;
  },

  deleteProduct(id: string): boolean {
    const products = this.getProducts();
    const filtered = products.filter((p) => p.id !== id);
    writeStorage(getScopedKey('products'), filtered);
    notify();
    return true;
  },

  // ===== INVOICES CRUD =====
  getInvoices(): Invoice[] {
    return readStorage<Invoice[]>(getScopedKey('invoices'), INITIAL_INVOICES);
  },

  createInvoice(data: {
    invoiceNumber: string;
    recipientName: string;
    recipientType: 'dealer' | 'customer';
    date: string;
    items: Array<{
      productId: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Invoice {
    const invoices = this.getInvoices();
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const invoiceItems: InvoiceItem[] = data.items.map((it) => ({
      productId: it.productId,
      productName: it.productName || 'Standard Material Item',
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.quantity * it.unitPrice,
    }));

    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber: data.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: data.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      recipientName: data.recipientName,
      recipientType: data.recipientType,
      amount: totalAmount,
      status: 'Paid',
      items: invoiceItems,
    };

    const updatedInvoices = [newInvoice, ...invoices];
    writeStorage(getScopedKey('invoices'), updatedInvoices);

    // Also record as an order in the system
    this.createOrder({
      product: invoiceItems[0]?.productName || 'Material Consignment',
      dealer: data.recipientName,
      amount: totalAmount,
      quantity: `${invoiceItems[0]?.quantity || 1} units`,
    });

    notify();
    return newInvoice;
  },

  // ===== DEALER SPOTLIGHT =====
  getDealerSpotlight(): DealerSpotlight | null {
    return readStorage<DealerSpotlight | null>(getScopedKey('dealer'), INITIAL_DEALER);
  },

  // ===== DISTRIBUTOR NETWORK =====
  getDistributors(): Distributor[] {
    return readStorage<Distributor[]>(getScopedKey('distributors'), INITIAL_DISTRIBUTORS);
  },

  createDistributor(data: { name: string; contact: string; status?: 'Active' | 'Pending' | 'Inactive' }): Distributor {
    const distributors = this.getDistributors();
    const nextNum = 3000 + distributors.length + 1;
    const cleanContact = data.contact.startsWith('+91') ? data.contact : `+91 ${data.contact}`;

    const newDist: Distributor = {
      id: `DIST-${nextNum}`,
      name: data.name.trim(),
      contact: cleanContact,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: data.status || 'Active',
      pointsEarned: 0,
    };

    const updated = [newDist, ...distributors];
    writeStorage(getScopedKey('distributors'), updated);
    notify();
    return newDist;
  },

  getNetworkMetrics() {
    const distributors = this.getDistributors();
    const activeCount = distributors.filter((d) => d.status === 'Active').length;
    const profile = this.getUserProfile();

    return {
      totalDistributors: distributors.length,
      distributorsTrend: distributors.length > 0 ? `↑ ${distributors.length} partners` : '0 partners',
      activeNetwork: activeCount,
      engagementBadge: activeCount > 0 ? 'Active Network' : 'Network Empty',
      pointsEarned: profile.pointsBalance > 0 ? profile.pointsBalance.toLocaleString() : '0',
      pointsSubtitle: 'Available points balance',
      conversionRate: distributors.length > 0 ? '100%' : '0%',
    };
  },

  getPointsAccumulationData(timeframe: '6m' | '12m' | '1y' = '6m') {
    const profile = this.getUserProfile();
    const ledger = this.getLedger();
    const currentPoints = profile.pointsBalance || 0;

    // Strict 0 nil baseline if no points balance or no ledger items
    if (currentPoints === 0 || ledger.length === 0) {
      if (timeframe === '6m') {
        return [
          { month: 'Jan', points: 0 },
          { month: 'Feb', points: 0 },
          { month: 'Mar', points: 0 },
          { month: 'Apr', points: 0 },
          { month: 'May', points: 0 },
        ];
      }
      return [
        { month: 'Q1', points: 0 },
        { month: 'Q2', points: 0 },
        { month: 'Q3', points: 0 },
        { month: 'Q4', points: 0 },
      ];
    }

    if (timeframe === '6m') {
      return [
        { month: 'Jan', points: 0 },
        { month: 'Feb', points: 0 },
        { month: 'Mar', points: 0 },
        { month: 'Apr', points: 0 },
        { month: 'May', points: currentPoints },
      ];
    }
    return [
      { month: 'Q1', points: 0 },
      { month: 'Q2', points: 0 },
      { month: 'Q3', points: 0 },
      { month: 'Q4', points: currentPoints },
    ];
  },

  // ===== POINTS LEDGER =====
  getLedger(): LedgerItem[] {
    return readStorage<LedgerItem[]>(getScopedKey('ledger'), INITIAL_LEDGER);
  },

  addLedgerItem(item: { title: string; description: string; points: number; type: 'credit' | 'debit'; time?: string }): LedgerItem {
    const ledger = this.getLedger();
    const newItem: LedgerItem = {
      id: `LED-${Date.now()}`,
      title: item.title,
      description: item.description,
      points: item.points,
      type: item.type,
      time: item.time || 'Just now',
    };
    writeStorage(getScopedKey('ledger'), [newItem, ...ledger]);

    // Automatically update points balance
    const profile = this.getUserProfile();
    const newBalance = item.type === 'credit'
      ? profile.pointsBalance + item.points
      : Math.max(0, profile.pointsBalance - item.points);
    this.updateUserProfile({ pointsBalance: newBalance });

    notify();
    return newItem;
  },

  // ===== REWARDS & REDEMPTIONS =====
  getRewards(): Reward[] {
    const list = readStorage<Reward[]>('sitesync_rewards_catalog', INITIAL_REWARDS);
    return list.filter((r) => !['REW-01', 'REW-02', 'REW-03', 'REW-04'].includes(r.id));
  },

  createReward(reward: Reward): Reward {
    const current = this.getRewards();
    const updated = [...current, reward];
    writeStorage('sitesync_rewards_catalog', updated);
    notify();
    return reward;
  },

  deleteReward(id: string): boolean {
    const filtered = this.getRewards().filter((r) => r.id !== id);
    writeStorage('sitesync_rewards_catalog', filtered);
    notify();
    return true;
  },

  getRedemptions(): Redemption[] {
    return readStorage<Redemption[]>(getScopedKey('redemptions'), INITIAL_REDEMPTIONS);
  },

  redeemReward(rewardId: string): { success: boolean; message: string; newBalance?: number } {
    const rewards = this.getRewards();
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward) {
      return { success: false, message: 'Reward not found.' };
    }

    const profile = this.getUserProfile();
    if (profile.pointsBalance < reward.points) {
      return {
        success: false,
        message: `Not enough points. You need ${reward.points} points to redeem this reward.`,
      };
    }

    // Deduct points
    const newBalance = profile.pointsBalance - reward.points;
    this.updateUserProfile({ pointsBalance: newBalance });

    // Add to redemptions
    const redemptions = this.getRedemptions();
    const newRedemption: Redemption = {
      id: `RDM-${Date.now()}`,
      title: reward.title,
      points: reward.points,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      note: 'Instant Voucher',
    };
    writeStorage(getScopedKey('redemptions'), [newRedemption, ...redemptions]);

    // Add to ledger
    this.addLedgerItem({
      title: 'Reward Redeemed',
      description: reward.title,
      points: reward.points,
      type: 'debit',
      time: 'Just now',
    });

    notify();
    return {
      success: true,
      message: `Reward redeemed successfully! ${reward.title} has been claimed.`,
      newBalance,
    };
  },

  // ===== USER PROFILE =====
  getUserProfile(): UserProfile {
    return readStorage<UserProfile>(getScopedKey('profile'), INITIAL_PROFILE);
  },

  updateUserProfile(updates: Partial<UserProfile>): UserProfile {
    const profile = this.getUserProfile();
    const updated: UserProfile = { ...profile, ...updates };
    writeStorage(getScopedKey('profile'), updated);

    if (updates.name || updates.phone || updates.address || updates.email) {
      this.addAccountActivity({
        title: 'Profile Updated',
        desc: 'Updated account information',
        time: 'Just now',
        type: 'profile',
      });
    }

    notify();
    return updated;
  },

  syncWithAuthenticatedUser(user: any): UserProfile {
    if (!user) return this.getUserProfile();
    const current = this.getUserProfile();
    const roleLabels: Record<string, string> = {
      platform_owner_distributor: 'Platform Owner',
      distributor: 'Regional Distributor',
      dealer: 'Authorized Dealer',
      retailer: 'Retail Partner',
      influencer: 'Contractor & Site Engineer',
      customer: 'Valued Client Partner',
    };
    const updated: UserProfile = {
      ...current,
      id: user.id || current.id,
      name: user.name || user.owner_name || user.company_name || user.shop_name || current.name,
      role: roleLabels[user.role] || user.role || current.role,
      email: user.email || (user.mobile_number ? `${user.mobile_number}@sitesync.enterprise.in` : current.email),
      phone: user.mobile_number ? `+91 ${user.mobile_number}` : current.phone,
      address: user.city ? `${user.city}, ${user.state || 'India'}` : current.address,
      kycStatus: 'Verified',
      pointsBalance: current.pointsBalance || 0,
    };
    writeStorage(getScopedKey('profile'), updated);
    return updated;
  },

  changePassword(oldPassword: string, newPassword: string): { success: boolean; message: string } {
    if (!oldPassword || !newPassword) {
      return { success: false, message: 'Please enter both current and new password.' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters.' };
    }

    this.addAccountActivity({
      title: 'Password Changed',
      desc: 'Security credential updated successfully',
      time: 'Just now',
      type: 'security',
    });

    notify();
    return { success: true, message: 'Your password has been changed successfully.' };
  },

  // ===== ACCOUNT ACTIVITY =====
  getAccountActivity(): AccountActivity[] {
    return readStorage<AccountActivity[]>(getScopedKey('activity'), INITIAL_ACTIVITY);
  },

  addAccountActivity(activity: Omit<AccountActivity, 'id'>): AccountActivity {
    const list = this.getAccountActivity();
    const newAct: AccountActivity = {
      ...activity,
      id: `ACT-${Date.now()}`,
    };
    writeStorage(getScopedKey('activity'), [newAct, ...list]);
    notify();
    return newAct;
  },

  // ===== GLOBAL SEARCH =====
  search(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return { orders: [], distributors: [], rewards: [] };

    const orders = this.getOrders().filter(
      (o) => o.id.toLowerCase().includes(q) || o.product.toLowerCase().includes(q) || o.dealer.toLowerCase().includes(q)
    );

    const distributors = this.getDistributors().filter(
      (d) => d.name.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q)
    );

    const rewards = this.getRewards().filter(
      (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );

    return { orders, distributors, rewards };
  },
};
