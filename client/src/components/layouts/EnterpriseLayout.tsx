import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Store,
  Users,
  Network,
  Package,
  Receipt,
  BarChart3,
  Award,
  UserCircle,
  Bell,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Truck,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardView from '../dashboard/DashboardView';
import DistributorNetworkView from '../directory/DistributorNetworkView';
import AnalyticsReportsView from '../analytics/AnalyticsReportsView';
import RewardsView from '../rewards/RewardsView';
import ProfileView from '../profile/ProfileView';
import CustomerManagement from '../directory/CustomerManagement';
import DealerManagement from '../directory/DealerManagement';
import OrdersManagement from '../orders/OrdersManagement';
import ProductManagement from '../inventory/ProductManagement';
import InvoiceWorkspace from '../billing/InvoiceWorkspace';
import { GlobalSearch } from '../ui/GlobalSearch';
import { dataService, UserProfile } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'CORE OPERATIONS',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', label: 'Orders & Dispatch', icon: Truck },
      { id: 'products', label: 'Products & Inventory', icon: Package },
    ],
  },
  {
    title: 'NETWORK & DIRECTORY',
    items: [
      { id: 'distributor', label: 'Distributor Network', icon: Network },
      { id: 'dealer', label: 'Dealer Directory', icon: Store },
      { id: 'customer', label: 'Customer Base', icon: Users },
      { id: 'invoices', label: 'Invoices & Billing', icon: Receipt },
    ],
  },
  {
    title: 'ANALYTICS & LOYALTY',
    items: [
      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { id: 'rewards', label: 'Rewards & Referrals', icon: Award },
      { id: 'profile', label: 'Company Profile', icon: UserCircle },
    ],
  },
];

export default function EnterpriseLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(dataService.getUserProfile());

  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Consignment In Transit',
      desc: 'Order ORD-13284 en route to Shree Ram Hardware',
      time: '12m ago',
      unread: true,
      type: 'truck',
    },
    {
      id: '2',
      title: 'Warehouse Stock Synced',
      desc: 'UltraTech Super Cement balance updated in central log',
      time: '45m ago',
      unread: true,
      type: 'package',
    },
    {
      id: '3',
      title: 'New Dealer Onboarded',
      desc: 'Metro Hardware Central Depot verified under regional hub',
      time: '2h ago',
      unread: false,
      type: 'user',
    },
  ]);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    let p = dataService.getUserProfile();
    if (user) {
      p = dataService.syncWithAuthenticatedUser(user);
    }
    setProfile(p);
    const unsubscribe = dataService.subscribe(() => {
      setProfile(dataService.getUserProfile());
    });
    return unsubscribe;
  }, [user]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const currentTabItem = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeTab);
  const CurrentIcon = currentTabItem?.icon || LayoutDashboard;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'distributor':
      case 'referral':
      case 'referrals':
        return <DistributorNetworkView />;
      case 'reports':
        return <AnalyticsReportsView />;
      case 'dealer':
        return <DealerManagement />;
      case 'customer':
        return <CustomerManagement />;
      case 'orders':
        return <OrdersManagement />;
      case 'products':
        return <ProductManagement />;
      case 'invoices':
        return <InvoiceWorkspace mode="distributor" />;
      case 'rewards':
        return <RewardsView onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'profile':
      default:
        return <ProfileView mode="profile" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-slate-950 border-r border-slate-900 text-slate-300 transition-all duration-300 ease-in-out shrink-0 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white text-base font-black shadow-lg shadow-orange-500/20 ring-1 ring-orange-400/30 shrink-0">
              S
            </div>
            {!sidebarCollapsed && (
              <div className="leading-tight truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-white">
                    Site<span className="text-orange-500">Sync</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                    PRO
                  </span>
                </div>
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                  Distributor Hub
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer hidden md:block"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-4 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    } py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer relative group ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent text-white border-l-2 border-orange-500 font-bold shadow-xs'
                        : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <IconComponent
                        size={18}
                        className={isActive ? 'text-orange-400 shrink-0' : 'text-slate-400 group-hover:text-slate-200 shrink-0'}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                        {item.badge}
                      </span>
                    )}

                    {/* Floating Tooltip when collapsed */}
                    {sidebarCollapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Status Bar in Sidebar */}
        <div className="p-3 border-t border-slate-900 m-2 bg-slate-900/70 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-xs border border-slate-700 shadow-2xs">
                  {(profile?.name?.[0] || user?.name?.[0] || 'E').toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
              </div>
              {!sidebarCollapsed && (
                <div className="text-left leading-tight truncate">
                  <p className="text-xs font-bold text-white truncate max-w-[100px]">
                    {profile?.name || user?.name || 'Enterprise Admin'}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck size={10} className="text-orange-400 shrink-0" />
                    <p className="text-[10px] text-slate-400 truncate">Regional Hub</p>
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 transform transition-transform duration-200 ease-in-out flex flex-col justify-between shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="p-5 flex items-center justify-between border-b border-slate-900">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-sm font-black shadow-md shadow-orange-600/30">
                S
              </div>
              <span className="text-base font-bold">SiteSync Enterprise</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:bg-slate-900 rounded-xl"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activeTab === item.id
                        ? 'bg-slate-900 text-white border-l-2 border-orange-500 font-bold'
                        : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'
                    }`}
                  >
                    <item.icon
                      size={18}
                      className={activeTab === item.id ? 'text-orange-400' : 'text-slate-500'}
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-900">
          <button
            onClick={onLogout}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden pb-14 md:pb-0">
        {/* Top Header */}
        <header className="bg-white/85 backdrop-blur-xl border-b border-slate-200/80 h-16 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-20 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb / Active Context Indicator */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400 shrink-0">
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                Enterprise Hub
              </span>
              <ChevronRight size={13} className="text-slate-300" />
              <div className="flex items-center gap-1.5 text-slate-900 font-bold bg-slate-100/90 px-3 py-1 rounded-lg border border-slate-200/70 shadow-2xs">
                <CurrentIcon size={14} className="text-orange-500" />
                <span>{currentTabItem?.label}</span>
              </div>
            </div>

            {/* Global Search Bar */}
            <div className="flex-1 max-w-md ml-0 lg:ml-4">
              <GlobalSearch onSelectTab={(tab) => setActiveTab(tab)} />
            </div>
          </div>

          {/* Right Top Header Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-2">
            {/* Live Operational Health Pill */}
            <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Node: Central Hub</span>
              <span className="text-emerald-300">•</span>
              <span className="font-mono text-emerald-600 text-[11px]">18ms</span>
            </div>

            {/* Notification Bell with Popover */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 rounded-xl transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-3"
                  >
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Operational Alerts
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border transition-colors ${
                            n.unread
                              ? 'bg-orange-50/40 border-orange-100 text-slate-800'
                              : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
                              <span>{n.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed pl-3">{n.desc}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Role Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold shadow-2xs">
              <ShieldCheck size={14} className="text-orange-600" />
              <span>Distributor Hub</span>
            </div>

            {/* User Avatar + Nav */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-2.5 sm:pl-4">
              <div
                onClick={() => setActiveTab('profile')}
                className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer hover:ring-2 hover:ring-orange-500 hover:scale-105 transition-all"
                title="View Company Profile"
              >
                {(profile?.name?.[0] || user?.name?.[0] || 'E').toUpperCase()}
              </div>

              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                  {profile?.name || user?.name || 'Enterprise Admin'}
                </p>
                <p className="text-[10px] font-medium text-slate-400">Admin Console</p>
              </div>

              <button
                onClick={onLogout}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 ml-1 hidden xl:block p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content with Framer Motion transitions */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="min-h-full"
            >
              <ErrorBoundary key={activeTab}>
                {renderContent()}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Quick Navigation Bar (< 768px) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 z-30 flex items-center justify-around py-1.5 px-2 shadow-2xl">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'orders', label: 'Orders', icon: Truck },
            { id: 'products', label: 'Inventory', icon: Package },
            { id: 'dealer', label: 'Dealers', icon: Store },
            { id: 'profile', label: 'Profile', icon: UserCircle },
          ].map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-orange-600' : 'text-slate-400'} />
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
