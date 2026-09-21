import React, { useState } from 'react';
import {
  Megaphone,
  Menu,
  Bell,
  Award,
  QrCode,
  LogOut,
  UserCircle2,
  Users,
  Copy,
  Check,
  Share2,
  X,
  BellOff,
} from 'lucide-react';
import InfluencerProfile from '../profile/InfluencerProfile';
import RewardsView from '../rewards/RewardsView';
import { useAuth } from '../../context/AuthContext';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const NAV_ITEMS = [
  { id: 'profile', label: 'My Profile', icon: UserCircle2 },
  { id: 'rewards', label: 'Rewards & Redemption', icon: Award },
  { id: 'referrals', label: 'Contractor Referrals', icon: Users },
];

function ContractorReferralsView({ userCode }: { userCode: string }) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const referralLink = `sitesync.in/join?ref=${userCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: 'Contractor referral link copied to clipboard!',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-purple-600" />
            Contractor Referrals
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Invite fellow site engineers and sub-contractors to earn 500 bonus reward points.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="bg-slate-950 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-1">
              <Share2 size={16} />
              <span>Your Unique Referral Link</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              Share your verified link. When a contractor registers, 500 points credit directly to your ledger.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="font-mono text-slate-300 truncate">{referralLink}</span>
              <button
                type="button"
                onClick={copyCode}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors ml-2 shrink-0"
                title="Copy link"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUB-CONTRACTORS REFERRED</p>
          <h3 className="text-4xl font-black text-slate-900 my-2">0</h3>
          <p className="text-xs font-semibold text-slate-400">Strictly nil baseline (no mock data)</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">REFERRAL BONUS POINTS</p>
          <h3 className="text-4xl font-black text-slate-900 my-2">0 <span className="text-sm font-semibold text-purple-600">pts</span></h3>
          <p className="text-xs font-semibold text-slate-400">500 pts per verified contractor</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        <EmptyState
          icon={Users}
          title="No Referrals Recorded Yet"
          description="Your referral ledger is currently empty. Share your contractor referral code on construction sites to start earning incentive points."
        />
      </div>
    </div>
  );
}

export default function InfluencerLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  interface NotificationItem {
    id: string;
    title: string;
    desc: string;
    time: string;
    unread: boolean;
  }

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const currentTabItem = NAV_ITEMS.find((i) => i.id === activeTab);
  const CurrentIcon = currentTabItem?.icon || UserCircle2;

  const renderContent = () => {
    switch (activeTab) {
      case 'rewards':
        return <RewardsView onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'referral':
      case 'referrals':
        return <ContractorReferralsView userCode={user?.id || 'INF-UAZJ39'} />;
      case 'profile':
      default:
        return <InfluencerProfile />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-950 border-r border-slate-900 text-slate-300">
        <div className="p-5 border-b border-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-purple-500/20 ring-1 ring-purple-400/30">
              <Megaphone size={18} />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Site<span className="text-purple-400">Sync</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  INFLUENCER
                </span>
              </div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                Contractor Rewards Hub
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-2">
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            CONTRACTOR SUITE
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent text-white border-l-2 border-purple-500 font-bold'
                    : 'text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
                }`}
              >
                <Icon
                  size={17}
                  className={isActive ? 'text-purple-400 shrink-0' : 'text-slate-500 shrink-0'}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card in Sidebar */}
        <div className="p-3 border-t border-slate-900 m-2 bg-slate-900/50 rounded-2xl border border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-800 to-indigo-900 text-white flex items-center justify-center font-bold text-xs border border-white/10 shadow-xs shrink-0">
                  {((user?.name || 'R')[0] || 'R').toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
              </div>
              <div className="text-left leading-tight truncate">
                <p className="text-xs font-bold text-white truncate max-w-[100px]">
                  {user?.name || 'Er. Contractor'}
                </p>
                <p className="text-[10px] text-purple-400 font-medium">Verified Partner</p>
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

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 transform transition-transform duration-200 ease-in-out flex flex-col justify-between ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="p-5 flex items-center justify-between border-b border-slate-900">
            <div className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-xs font-black shadow-md">
                <Megaphone size={18} />
              </div>
              <span className="text-lg font-bold">SiteSync Influencer</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="p-3 space-y-2">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CONTRACTOR SUITE
            </div>
            {NAV_ITEMS.map((item) => {
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
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
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
              <span className="text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setActiveTab('profile')}>
                Influencer Hub
              </span>
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-1.5 text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                <CurrentIcon size={14} className="text-purple-600" />
                <span>{currentTabItem?.label || 'Profile'}</span>
              </div>
            </div>

            <div className="sm:hidden flex items-center gap-1.5 text-slate-800 font-bold text-sm">
              <CurrentIcon size={16} className="text-purple-600" />
              <span>{currentTabItem?.label || 'Profile'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications Popover */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        <Check size={12} /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-7 text-center px-4">
                        <BellOff size={22} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-700">No New Notifications</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Referral milestone and incentive alerts will appear here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-left hover:bg-slate-50 transition-colors ${
                            n.unread ? 'bg-purple-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-800 leading-tight">{n.title}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.desc}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {((user?.name || 'R')[0] || 'R').toUpperCase()}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                  {user?.name || 'Er. Contractor'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Active Partner</p>
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

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <ErrorBoundary key={activeTab}>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
