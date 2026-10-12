import React, { useState, useEffect } from 'react';
import {
  Award,
  Gift,
  Percent,
  Banknote,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Truck,
  Wrench,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { dataService, Reward, Redemption, UserProfile } from '../../services/dataService';
import { formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { CustomDropdown } from '../ui/CustomDropdown';
import { useAuth } from '../../context/AuthContext';
import { loyaltyApi } from '../../lib/api';

interface PartnerRedemptionRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerRole: 'dealer' | 'customer' | 'influencer' | string;
  rewardId: string;
  rewardTitle: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  notes?: string;
}

export default function RewardsView({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const { user } = useAuth();
  const isDistributor = user?.role === 'distributor' || user?.role === 'platform_owner_distributor';

  const [profile, setProfile] = useState<UserProfile>(dataService.getUserProfile());
  const [rewards, setRewards] = useState<Reward[]>(dataService.getRewards());
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRedemptionRequest[]>([]);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Distributor Tier Creation Modal state
  const [isAddTierOpen, setIsAddTierOpen] = useState(false);
  const [tierTitle, setTierTitle] = useState('');
  const [tierCategory, setTierCategory] = useState<'voucher' | 'cashback' | 'materials' | 'discount'>('voucher');
  const [tierPoints, setTierPoints] = useState('1000');
  const [tierDescription, setTierDescription] = useState('');
  const [tierIsPremium, setTierIsPremium] = useState(false);
  const [isSubmittingTier, setIsSubmittingTier] = useState(false);

  const loadData = async () => {
    try {
      const [balRes, redRes] = await Promise.all([
        loyaltyApi.getMyBalance().catch(() => null),
        loyaltyApi.getRedemptions().catch(() => ({ success: true, data: [] })),
      ]);

      const balance = balRes?.data?.balance ?? 0;
      setProfile((prev) => ({ ...prev, pointsBalance: balance }));

      const rawRedemptions = Array.isArray(redRes?.data) ? redRes.data : [];
      const mappedRedemptions: Redemption[] = rawRedemptions.map((r: any) => ({
        id: r.redemption_id?.slice(0, 8) || 'RED',
        title: `Redemption Request (${formatNumber(r.points_requested || 0)} Pts)`,
        points: Number(r.points_requested || 0),
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        note: r.status ? `Status: ${r.status.toUpperCase()}` : 'Pending review',
      }));
      setRedemptions(mappedRedemptions);
      setRewards(dataService.getRewards());
    } catch (err) {
      console.error('Failed to load loyalty data:', err);
    }
  };

  const loadPartnerRequests = async () => {
    try {
      const res = await loyaltyApi.getRedemptions();
      const raw = Array.isArray(res?.data) ? res.data : [];
      const mapped: PartnerRedemptionRequest[] = raw.map((r: any) => ({
        id: r.redemption_id,
        partnerId: r.profile_id?.slice(0, 8) || 'PARTNER',
        partnerName: r.profile_type ? `Partner (${r.profile_type})` : 'Authorized Partner',
        partnerRole: r.profile_type || 'dealer',
        rewardId: r.payment_details?.rewardId || 'REW-DEFAULT',
        rewardTitle: r.payment_details?.title || `Redemption for ${r.points_requested} Pts`,
        points: Number(r.points_requested || 0),
        status: (r.status === 'approved' || r.status === 'fulfilled' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'),
        requestDate: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        notes: r.rejection_reason,
      }));
      setPartnerRequests(mapped);
    } catch (err) {
      console.error('Failed to load partner requests:', err);
    }
  };

  useEffect(() => {
    loadData();
    if (isDistributor) {
      loadPartnerRequests();
    }
  }, [isDistributor, user?.role]);

  const handleOpenRedeem = (reward: Reward) => {
    if (isDistributor) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: 'Distributors manage the reward ecosystem for dealers/customers and cannot redeem vouchers for themselves.',
      });
      return;
    }
    setSelectedReward(reward);
    setIsConfirmOpen(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    if (isDistributor) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: 'Distributors manage partner rewards and cannot redeem vouchers directly.',
      });
      setIsConfirmOpen(false);
      return;
    }

    try {
      await loyaltyApi.requestRedemption({
        pointsRequested: selectedReward.points,
        paymentDetails: {
          rewardId: selectedReward.id,
          title: selectedReward.title,
          category: selectedReward.category,
        },
      });

      setIsConfirmOpen(false);
      await loadData();

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Redemption request for ${selectedReward.title} submitted! Awaiting administrator approval.`,
      });
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to redeem reward. Check available points balance.',
      });
    }
  };

  const handleResolveRequest = async (id: string, action: 'approve' | 'reject') => {
    setActionLoadingId(id);
    setPartnerRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r))
    );

    try {
      await loyaltyApi.resolveRedemption(id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        rejectionReason: action === 'reject' ? 'Denied by administrator' : undefined,
      });

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Partner request ${action === 'approve' ? 'Approved' : 'Rejected'}!`,
      });
      await loadPartnerRequests();
      await loadData();
    } catch (err: any) {
      console.error('Error resolving request:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to update request.',
      });
      loadPartnerRequests();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierTitle.trim()) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter a reward title.' });
      return;
    }
    const pointsNum = Number(tierPoints);
    if (!pointsNum || pointsNum <= 0) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Please enter valid points (> 0).' });
      return;
    }

    setIsSubmittingTier(true);
    try {
      const newReward: Reward = {
        id: `REW-${Date.now()}`,
        title: tierTitle.trim(),
        category: tierCategory,
        points: pointsNum,
        description: tierDescription.trim() || `${tierCategory} incentive tier for authorized partners.`,
        isPremium: tierIsPremium,
      };
      dataService.createReward(newReward);
      setRewards(dataService.getRewards());
      setIsAddTierOpen(false);
      setTierTitle('');
      setTierPoints('1000');
      setTierDescription('');
      setTierIsPremium(false);
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Reward tier "${newReward.title}" successfully listed in partner catalog!`,
      });
    } catch (err: any) {
      setToast({ id: String(Date.now()), type: 'error', message: err.message || 'Error creating reward.' });
    } finally {
      setIsSubmittingTier(false);
    }
  };

  const handleDeleteTier = (rewardId: string, title: string) => {
    dataService.deleteReward(rewardId);
    setRewards(dataService.getRewards());
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Reward tier "${title}" removed from catalog.`,
    });
  };

  const getRewardIcon = (category: Reward['category']) => {
    switch (category) {
      case 'cashback':
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Banknote size={20} />
          </div>
        );
      case 'discount':
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Percent size={18} />
          </div>
        );
      case 'voucher':
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Gift size={20} />
          </div>
        );
      case 'materials':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
            <Sparkles size={20} />
          </div>
        );
    }
  };

  const hasEnoughPoints = selectedReward
    ? (profile?.pointsBalance || 0) >= selectedReward.points
    : false;

  const pendingRequestsCount = partnerRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header Banner with Role-Aware Overview Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {isDistributor ? 'Partner Rewards & Approvals' : 'Redeem Rewards'}
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 leading-relaxed max-w-xl">
            {isDistributor
              ? 'Manage partner incentive reward tiers and review, approve, or reject redemption claims submitted by authorized dealers, contractors, and retail partners.'
              : 'Turn your earned points into valuable discounts, cashback, and exclusive partner vouchers. Select a reward below to claim.'}
          </p>
        </div>

        {/* Overview Metric Card */}
        <div className="bg-slate-950 text-white px-6 py-5 rounded-2xl border border-slate-800 shadow-xl min-w-[220px]">
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              {isDistributor ? 'PENDING APPROVALS' : 'CURRENT BALANCE'}
            </span>
            <Award className="text-orange-400" size={16} />
          </div>
          <div className="text-3xl font-bold tracking-tight text-white flex items-baseline gap-1.5">
            {isDistributor ? (
              <>
                <span>{pendingRequestsCount}</span>
                <span className="text-sm font-semibold text-amber-400">claims</span>
              </>
            ) : (
              <>
                <span>{formatNumber(profile?.pointsBalance || 0)}</span>
                <span className="text-sm font-semibold text-orange-400">pts</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DISTRIBUTOR: PARTNER REDEMPTION APPROVALS QUEUE */}
      {isDistributor && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold shadow-2xs">
                <Award size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Partner Redemption Requests Queue</h2>
                <p className="text-xs text-slate-500">
                  Review and approve or reject reward claims submitted by downstream dealers and customers.
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {pendingRequestsCount} Pending Approval
            </span>
          </div>

          {partnerRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No partner redemption claims recorded yet. When dealers or customers submit point redemptions, they will appear here for your review.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">REQUEST ID</th>
                    <th className="px-6 py-3.5">PARTNER NAME & ROLE</th>
                    <th className="px-6 py-3.5">REWARD ITEM</th>
                    <th className="px-6 py-3.5">POINTS COST</th>
                    <th className="px-6 py-3.5">DATE</th>
                    <th className="px-6 py-3.5">STATUS</th>
                    <th className="px-6 py-3.5 text-center">DISTRIBUTOR ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {partnerRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 text-xs">{req.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{req.partnerName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {req.partnerRole}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{req.rewardTitle}</td>
                      <td className="px-6 py-4 font-bold text-orange-600">{formatNumber(req.points)} pts</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{req.requestDate}</td>
                      <td className="px-6 py-4">
                        {req.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} /> Pending Approval
                          </span>
                        ) : req.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              disabled={actionLoadingId === req.id}
                              onClick={() => handleResolveRequest(req.id, 'approve')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Approve Reward"
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === req.id}
                              onClick={() => handleResolveRequest(req.id, 'reject')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                              title="Reject Reward"
                            >
                              <X size={13} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Content: Catalog (Left 2 cols) + Recent & Earning (Right col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Reward Catalog */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {isDistributor ? 'Partner Reward Program Catalog' : 'Reward Catalog'}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {isDistributor
                  ? `${rewards.length} active partner reward tiers configured`
                  : `Showing ${rewards.length} available redemption vouchers`}
              </span>
            </div>
            {isDistributor && (
              <button
                type="button"
                onClick={() => setIsAddTierOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus size={15} />
                <span>Add Reward Tier</span>
              </button>
            )}
          </div>

          {/* Standard Rewards Grid */}
          {rewards.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                <Gift size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Reward Tiers Configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isDistributor
                  ? 'Click "Add Reward Tier" above to create cashback, discounts, or voucher programs for your network.'
                  : 'Reward tiers configured by your regional distributor will appear here for redemption.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {rewards
                .filter((r) => !r.isPremium)
                .map((reward) => {
                  const canAfford = (profile?.pointsBalance || 0) >= reward.points;
                  return (
                    <div
                      key={reward.id}
                      className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-6"
                    >
                      <div className="space-y-4">
                        {getRewardIcon(reward.category)}
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{reward.title}</h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{reward.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div>
                          <span className="text-xl font-bold text-slate-900">
                            {formatNumber(reward.points)}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 ml-1">pts</span>
                        </div>

                        {isDistributor ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Partner Tier
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTier(reward.id, reward.title)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Reward Tier"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRedeem(reward)}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-[0.98] ${
                              canAfford
                                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-pointer'
                            }`}
                          >
                            Redeem
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Featured / Premium Reward Card */}
          {rewards
            .filter((r) => r.isPremium)
            .map((premium) => {
              const canAfford = (profile?.pointsBalance || 0) >= premium.points;
              return (
                <div
                  key={premium.id}
                  className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 tracking-wider uppercase mb-2">
                    <Sparkles size={15} />
                    <span>PREMIUM PARTNER REWARD</span>
                  </div>

                  <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                    {premium.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed mb-6">
                    {premium.description}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-white">
                        {formatNumber(premium.points)}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">pts</span>
                    </div>

                    {isDistributor ? (
                      <div className="flex items-center gap-2">
                        <span className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-amber-400 border border-amber-500/30">
                          Partner Premium Tier
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(premium.id, premium.title)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                          title="Delete Premium Tier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenRedeem(premium)}
                        className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-[0.98] ${
                          canAfford
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 cursor-pointer'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        Claim Premium Reward
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Col: Recent Redemptions & Earning More Points */}
        <div className="space-y-6">
          {/* Recent Redemptions Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock className="text-slate-400" size={17} />
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Redemptions</h3>
              </div>
            </div>

            <div className="space-y-4">
              {redemptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No redemptions yet. Redeem vouchers below when you accumulate points.
                </div>
              ) : (
                redemptions.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-400">
                        {item.date} • {item.note}
                      </p>
                    </div>
                    <span className="font-bold text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100 whitespace-nowrap">
                      -{item.points} pts
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-5 border-t border-slate-100 mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors"
              >
                View All History →
              </button>
            </div>
          </div>

          {/* Earning More Points Banner */}
          <div className="bg-gradient-to-br from-slate-50 to-orange-50/50 rounded-2xl border border-orange-200/60 p-6 space-y-4">
            <div className="flex items-center gap-2 text-orange-700 font-bold text-sm">
              <Gift size={18} />
              <span>Earning More Points</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Refer new contractors and dealers to the Structura network to earn continuous bonus points. Get{' '}
              <span className="font-bold text-slate-900">500 pts</span> for every successful registration.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab?.('referral')}
              className="inline-flex items-center gap-2 text-xs font-bold text-orange-700 hover:text-orange-800 transition-colors"
            >
              <span>Go to Referral Network</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Redeem Reward */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={selectedReward ? `Redeem ${selectedReward.title}?` : 'Redeem Reward'}
        description="Verify your points deduction and confirm instant reward voucher claiming."
      >
        {selectedReward && (
          <div className="space-y-5">
            {/* Calculation summary */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Current Balance</span>
                <span className="font-semibold text-slate-900">
                  {formatNumber(profile.pointsBalance)} pts
                </span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>Cost to Redeem</span>
                <span className="font-bold">-{formatNumber(selectedReward.points)} pts</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                <span>Remaining Balance</span>
                <span className={hasEnoughPoints ? 'text-slate-900' : 'text-rose-600'}>
                  {formatNumber(profile.pointsBalance - selectedReward.points)} pts
                </span>
              </div>
            </div>

            {!hasEnoughPoints ? (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Not enough points: </span>
                  You need {formatNumber(selectedReward.points - profile.pointsBalance)} more points to
                  redeem this reward. Refer dealers or place orders to accumulate points.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Upon confirmation, this voucher will be credited immediately to your account and emailed to{' '}
                <span className="font-semibold text-slate-700">{profile.email}</span>.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasEnoughPoints}
                onClick={handleConfirmRedeem}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold shadow-xs hover:shadow transition-all disabled:cursor-not-allowed"
              >
                Confirm Redemption
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Full Redemption History */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Redemption History"
        description="Comprehensive record of your claimed vouchers and discounts."
        maxWidth="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {redemptions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No voucher redemption transactions recorded yet.
            </div>
          ) : (
            redemptions.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
              >
                <div>
                  <h5 className="text-sm font-bold text-slate-900">{item.title}</h5>
                  <p className="text-xs text-slate-500">
                    {item.date} • {item.note}
                  </p>
                </div>
                <span className="text-xs font-bold text-orange-600 bg-orange-100/60 px-2.5 py-1 rounded-md">
                  -{item.points} pts
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* MODAL: Distributor List New Reward Tier */}
      <Modal
        isOpen={isAddTierOpen}
        onClose={() => setIsAddTierOpen(false)}
        title="List New Reward Tier"
        description="Configure an incentive tier for Dealers, Customers, and Partners to redeem with their points."
      >
        <form onSubmit={handleCreateTier} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Reward Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., ₹1,000 Direct Bill Credit Voucher"
              value={tierTitle}
              onChange={(e) => setTierTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Category
              </label>
              <CustomDropdown
                value={tierCategory}
                onChange={(val) => setTierCategory(val as any)}
                options={[
                  { value: 'voucher', label: 'Voucher' },
                  { value: 'cashback', label: 'Cashback Rebate' },
                  { value: 'materials', label: 'Free Freight / Materials' },
                  { value: 'discount', label: 'Tooling / Equipment Discount' },
                ]}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Points Required *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="1000"
                value={tierPoints}
                onChange={(e) => setTierPoints(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Description & Terms
            </label>
            <textarea
              rows={3}
              placeholder="Provide eligibility guidelines, discount terms, or redemption conditions..."
              value={tierDescription}
              onChange={(e) => setTierDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/60">
            <input
              type="checkbox"
              id="premiumTierToggle"
              checked={tierIsPremium}
              onChange={(e) => setTierIsPremium(e.target.checked)}
              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
            />
            <label htmlFor="premiumTierToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
              Feature as Premium Partner Reward (Large highlight banner)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddTierOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingTier}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              {isSubmittingTier ? 'Listing Tier...' : 'Publish Reward Tier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
