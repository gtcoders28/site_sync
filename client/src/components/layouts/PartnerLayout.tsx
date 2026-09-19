import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Award,
  Gift,
  Store,
  UserCircle,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Check,
  Package,
} from 'lucide-react';
import DashboardView from '../dashboard/DashboardView';
import RewardsView from '../rewards/RewardsView';
import ProfileView from '../profile/ProfileView';
import OrdersManagement from '../orders/OrdersManagement';
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

const PARTNER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'PURCHASE & ORDERS',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', label: 'My Orders', icon: Receipt },
    ],
  },
  {
    title: 'ACCOUNT & REWARDS',
    items: [
      { id: 'rewards', label: 'Rewards & Points', icon: Award },
      { id: 'dealer', label: 'Dealer Information', icon: Store },
      { id: 'profile', label: 'Profile Details', icon: UserCircle },
    ],
  },
];

export default function PartnerLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(dataService.getUserProfile());

  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Order Status Update',
      desc: 'Your recent construction materials order has been confirmed',
      time: '18m ago',
      unread: true,
    },
    {
      id: '2',
      title: 'Points Earned',
      desc: '150 loyalty points added from your last verified invoice',
      time: '2h ago',
      unread: false,
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

  const currentTabItem = PARTNER_NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeTab);
  const CurrentIcon = currentTabItem?.icon || LayoutDashboard;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'orders':
        return <OrdersManagement />;
      case 'rewards':
        return <RewardsView onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'dealer':
        return <ProfileView mode="dealer" />;
      case 'profile':
      default:
        return <ProfileView mode="profile" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-950 border-r border-slate-900 text-slate-300">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
              S
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Site<span className="text-blue-400">Sync</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  CLIENT
                </span>
              </div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                Customer Portal
              </span>
            </div>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
          {PARTNER_NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent text-white border-l-2 border-blue-500 font-bold'
                        : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComponent
                        size={17}
                        className={isActive ? 'text-blue-400 shrink-0' : 'text-slate-500 shrink-0'}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Pill Bottom Sidebar */}
        <div className="p-3 border-t border-slate-900 m-2 bg-slate-900/50 rounded-2xl border border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-xs border border-white/10 shadow-xs shrink-0">
                  {(profile?.name?.[0] || user?.name?.[0] || 'P').toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
              </div>
              <div className="text-left leading-tight truncate">
                <p className="text-xs font-bold text-white truncate max-w-[100px]">
                  {profile?.name || user?.name || 'Customer Account'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={10} className="text-blue-400 shrink-0" />
                  <p className="text-[10px] text-slate-400 truncate">Verified Client</p>
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition-colors"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 transform transition-transform duration-200 ease-in-out flex flex-col justify-between ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="p-5 flex items-center justify-between border-b border-slate-900">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-xs font-black shadow-md">
                S
              </div>
              <span className="text-lg font-bold">SiteSync Client</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="p-3 space-y-4">
            {PARTNER_NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-900">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 text-sm font-bold transition-colors"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Sticky Glassmorphic Header */}
        <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile menu"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb Trail */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                Customer Hub
              </span>
              <ChevronRight size={13} className="text-slate-300" />
              <div className="flex items-center gap-1.5 text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                <CurrentIcon size={14} className="text-blue-600" />
                <span>{currentTabItem?.label || 'Dashboard'}</span>
              </div>
            </div>

            <div className="sm:hidden flex items-center gap-1.5 text-slate-800 font-bold text-sm">
              <CurrentIcon size={16} className="text-blue-600" />
              <span>{currentTabItem?.label || 'Dashboard'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearch onSelectTab={(tab) => setActiveTab(tab)} />

            {/* Notifications Popover */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Check size={12} /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-left hover:bg-slate-50 transition-colors ${
                          n.unread ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 leading-tight">{n.title}</p>
                          <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {(profile?.name?.[0] || user?.name?.[0] || 'P').toUpperCase()}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                  {profile?.name || user?.name || 'Customer Account'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Verified Client</p>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic View Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <ErrorBoundary key={activeTab}>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

