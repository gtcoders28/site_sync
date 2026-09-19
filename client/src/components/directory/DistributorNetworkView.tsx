import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Copy,
  Check,
  Mail,
  MessageSquare,
  Share2,
  TrendingUp,
  Search,
  Filter,
  ArrowUpRight,
  ChevronDown,
  Building2,
  Calendar,
  Gift,
  PlusCircle,
  Plus,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { dataService, Distributor, LedgerItem } from '../../services/dataService';
import { formatNumber } from '../../utils';
import { Toast, ToastMessage } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '../ui/Skeleton';
import { CustomDropdown } from '../ui/CustomDropdown';

export default function DistributorNetworkView() {
  const [isLoading, setIsLoading] = useState(true);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [timeframe, setTimeframe] = useState<'6m' | '12m' | '1y'>('6m');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isAllLedgerOpen, setIsAllLedgerOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Add Partner Modal State
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerContact, setNewPartnerContact] = useState('');
  const [newPartnerStatus, setNewPartnerStatus] = useState<'Active' | 'Pending'>('Active');
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);

  const profile = useMemo(() => dataService.getUserProfile(), [distributors]);
  const referralLink = `sitesync.in/ref/${profile.id || 'distributor'}`;

  const loadData = () => {
    setDistributors(dataService.getDistributors());
    setLedger(dataService.getLedger());
  };

  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim() || !newPartnerContact.trim()) return;

    setPartnerSubmitting(true);
    const created = dataService.createDistributor({
      name: newPartnerName.trim(),
      contact: newPartnerContact.trim(),
      status: newPartnerStatus,
    });
    setPartnerSubmitting(false);
    setIsAddPartnerModalOpen(false);
    setNewPartnerName('');
    setNewPartnerContact('');
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Partner ${created.name} (${created.id}) registered into distribution network!`,
    });
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

  const metrics = useMemo(() => {
    return dataService.getNetworkMetrics();
  }, [distributors]);

  const chartData = useMemo(() => {
    return dataService.getPointsAccumulationData(timeframe);
  }, [timeframe]);

  const filteredDistributors = useMemo(() => {
    return distributors.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contact.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [distributors, searchQuery, statusFilter]);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`https://${referralLink}`);
    setCopied(true);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: 'Referral link copied to clipboard!',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const getStatusBadge = (status: Distributor['status']) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Active
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending
          </span>
        );
      case 'Inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Inactive
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getInitials = (name: string) => {
    return (name || 'P')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'P';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Top Header & Expand Network Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Header Left */}
        <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Distributor Network
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 leading-relaxed max-w-xl">
              Manage your active distributors, track their progress, and monitor the performance of your network.
            </p>
          </div>

          {/* KPI Cards (4) */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {/* Total Distributors */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  TOTAL DISTRIBUTORS
                </p>
                <h3 className="text-2xl font-bold text-slate-900">{metrics.totalDistributors}</h3>
                <p className="text-[11px] font-semibold text-emerald-600 mt-1">{metrics.distributorsTrend}</p>
              </div>

              {/* Active Network */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  ACTIVE NETWORK
                </p>
                <h3 className="text-2xl font-bold text-slate-900">{metrics.activeNetwork}</h3>
                <span className="inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full mt-1 border border-blue-100">
                  {metrics.engagementBadge}
                </span>
              </div>

              {/* Points Earned */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  POINTS EARNED
                </p>
                <h3 className="text-2xl font-bold text-slate-900">{metrics.pointsEarned}</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-1">{metrics.pointsSubtitle}</p>
              </div>

              {/* Conversion */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  CONVERSION
                </p>
                <h3 className="text-2xl font-bold text-slate-900">{metrics.conversionRate}</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-1">Dealer onboarding</p>
              </div>
            </div>
          )}
        </div>

        {/* Expand Your Network Banner (Dark Card from PDF) */}
        <div className="bg-slate-950 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-orange-400 font-bold text-sm mb-1">
              <Share2 size={16} />
              <span>Expand Your Network</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              Share your unique referral link to earn{' '}
              <span className="text-orange-300 font-semibold">500 bonus points</span> for every new dealer that
              completes onboarding.
            </p>
          </div>

          {/* Referral Link Box */}
          <div>
            <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="font-mono text-slate-300 truncate">{referralLink}</span>
              <button
                type="button"
                onClick={copyReferralLink}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors ml-2"
                title="Copy link"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Share via buttons */}
            <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>SHARE VIA</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    window.open(`mailto:?subject=Join our construction distributor network&body=Sign up here: https://${referralLink}`);
                  }}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Share via Email"
                >
                  <Mail size={15} />
                </button>
                <button
                  type="button"
                  onClick={copyReferralLink}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Share via Message"
                >
                  <MessageSquare size={15} />
                </button>
                <button
                  type="button"
                  onClick={copyReferralLink}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Copy link"
                >
                  <Share2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Points Accumulation Chart (Left) + Points Ledger (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Points Accumulation</h2>
              <p className="text-xs text-slate-500">Cumulative reward points generated across your network</p>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {(['6m', '12m', '1y'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTimeframe(key)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    timeframe === key ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  {key === '6m' ? 'Last 6 Months' : key === '12m' ? 'Last 12 Months' : 'This Year'}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-64 sm:h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip
                  formatter={(val: any) => [`${formatNumber(Number(val))} pts`, 'Accumulated']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: '#fb923c' }}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPoints)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Col: Points Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Points Ledger</h3>
              <button
                type="button"
                onClick={() => setIsAllLedgerOpen(true)}
                className="text-xs font-bold text-slate-500 hover:text-orange-600 uppercase tracking-wider transition-colors"
              >
                VIEW ALL
              </button>
            </div>

            {/* Ledger Items List */}
            <div className="space-y-4">
              {ledger.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No ledger activity yet. Referral points and ledger rewards will appear here.
                </div>
              ) : (
                ledger.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          item.type === 'credit'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}
                      >
                        {item.type === 'credit' ? <PlusCircle size={17} /> : <Gift size={17} />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-snug">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.description}</p>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">{item.time}</span>
                      </div>
                    </div>
                    <span
                      className={`font-bold text-sm whitespace-nowrap ${
                        item.type === 'credit' ? 'text-emerald-600' : 'text-orange-600'
                      }`}
                    >
                      {item.type === 'credit' ? `+${item.points}` : `-${item.points}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsAllLedgerOpen(true)}
              className="text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors"
            >
              View complete transaction audit →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Network Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header & Search */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-slate-50/40">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Network Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">Authorized business partners and their activity</p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search partners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Active', label: 'Active', dotColor: 'bg-emerald-500' },
                { value: 'Pending', label: 'Pending', dotColor: 'bg-amber-500' },
                { value: 'Inactive', label: 'Inactive', dotColor: 'bg-rose-500' },
              ]}
              buttonClassName="w-36 py-1.5"
            />

            <button
              type="button"
              onClick={() => setIsAddPartnerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus size={15} />
              <span>Add Partner</span>
            </button>
          </div>
        </div>

        {/* Directory Table */}
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filteredDistributors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No Distributors Found"
            description="No network partners match your current filter criteria."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setStatusFilter('All');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">PARTNER NAME</th>
                  <th className="px-5 py-3.5">CONTACT</th>
                  <th className="px-5 py-3.5">JOINED DATE</th>
                  <th className="px-5 py-3.5">STATUS</th>
                  <th className="px-5 py-3.5 text-right">POINTS EARNED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredDistributors.slice(0, 5).map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200 shrink-0">
                          {getInitials(dist.name)}
                        </div>
                        <span className="font-bold text-slate-900">{dist.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-normal">{dist.contact}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{dist.joinedDate}</td>
                    <td className="px-5 py-4">{getStatusBadge(dist.status)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {formatNumber(dist.pointsEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Directory Footer with Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <span>
            {filteredDistributors.length === 0
              ? 'Showing 0 of 0 partners'
              : `Showing 1 to ${filteredDistributors.length} of ${filteredDistributors.length} partners`}
          </span>

          {filteredDistributors.length > 5 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700"
              >
                Previous
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Full Points Ledger */}
      <Modal
        isOpen={isAllLedgerOpen}
        onClose={() => setIsAllLedgerOpen(false)}
        title="Points Ledger History"
        description="Comprehensive audit of all network credit and debit transactions."
        maxWidth="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {ledger.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No transactions recorded in points ledger.
            </div>
          ) : (
            ledger.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      item.type === 'credit'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {item.type === 'credit' ? '+' : '-'}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{item.title}</h5>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-bold ${
                      item.type === 'credit' ? 'text-emerald-600' : 'text-orange-600'
                    }`}
                  >
                    {item.type === 'credit' ? `+${item.points}` : `-${item.points}`} pts
                  </span>
                  <p className="text-[11px] text-slate-400">{item.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* MODAL: Add Partner */}
      <Modal
        isOpen={isAddPartnerModalOpen}
        onClose={() => setIsAddPartnerModalOpen(false)}
        title="Add Distribution Partner"
        description="Onboard an authorized regional supply partner or wholesaler."
      >
        <form onSubmit={handleCreatePartner} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Partner Entity Name *
            </label>
            <input
              type="text"
              required
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
              placeholder="e.g. Apex Regional Building Supplies"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Official Contact Phone *
            </label>
            <input
              type="tel"
              required
              value={newPartnerContact}
              onChange={(e) => setNewPartnerContact(e.target.value)}
              placeholder="e.g. 98100 12345"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Status
            </label>
            <CustomDropdown
              value={newPartnerStatus}
              onChange={(val) => setNewPartnerStatus(val as any)}
              options={[
                { value: 'Active', label: 'Active Partner', dotColor: 'bg-emerald-500' },
                { value: 'Pending', label: 'Pending Verification', dotColor: 'bg-amber-500' },
              ]}
              className="w-full"
              buttonClassName="w-full py-2.5"
              menuClassName="w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddPartnerModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={partnerSubmitting}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs"
            >
              {partnerSubmitting ? 'Registering...' : 'Register Partner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
