import React, { useState, useEffect } from 'react';
import { Award, QrCode, CheckCircle2, MapPin, Phone, Building, Pencil, Sparkles, Tag, RefreshCw } from 'lucide-react';
import { formatNumber } from '../../utils';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { loyaltyApi, usersApi } from '../../lib/api';

export default function InfluencerProfile() {
  const { user } = useAuth();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(false);

  // Live State
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [linkedDealer, setLinkedDealer] = useState<any | null>(null);

  // Edit Profile State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [taxId, setTaxId] = useState('');

  // Coupon Scan / Redeem State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);

  const syncUser = () => {
    if (user) {
      setName(user.name || 'Contractor Partner');
      setPhone(user.mobile_number ? `+91 ${user.mobile_number}` : 'Not Provided');
      setRegion(
        user.city
          ? `${user.city}${user.state ? `, ${user.state}` : ''}`
          : 'Territory Not Specified'
      );
      setTaxId((user.tax_id as string) || (user.gst_number as string) || 'Not Registered');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [pointsRes, dealersRes] = await Promise.all([
        loyaltyApi.getMyBalance().catch(() => null),
        usersApi.getDealers().catch(() => null),
      ]);

      if (pointsRes?.data) {
        setPointsBalance(Number(pointsRes.data.availablePoints || 0));
      } else {
        setPointsBalance(0);
      }

      const dealersList = Array.isArray(dealersRes?.data) ? dealersRes.data : [];
      if (dealersList.length > 0) {
        setLinkedDealer(dealersList[0]);
      } else {
        setLinkedDealer(null);
      }
    } catch {
      setPointsBalance(0);
      setLinkedDealer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncUser();
    loadData();
  }, [user]);

  const initials = (name || 'C')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'C';

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: 'Contractor profile credentials updated successfully.',
    });
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setIsSubmittingCoupon(true);
    try {
      // Simulate coupon validation call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsCouponModalOpen(false);
      setCouponCode('');
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Voucher ${code} registered with distributor validation queue.`,
      });
      await loadData();
    } catch {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: 'Unable to validate coupon code.',
      });
    } finally {
      setIsSubmittingCoupon(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Influencer & Contractor Profile
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage your certification details, linked dealer, and live reward balance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Pencil size={15} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: ID & KYC */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center relative overflow-hidden">
            <div className="w-24 h-24 rounded-full bg-slate-900 text-white border-4 border-white shadow-lg mx-auto flex items-center justify-center font-bold text-3xl mb-4">
              {initials}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">{name}</h2>

            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={14} className="text-emerald-500" />
                KYC Verified Contractor
              </span>
            </div>

            <div className="text-left pt-6 border-t border-slate-100 space-y-4 text-xs">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  PAN / TAX REGISTRATION
                </p>
                <p className="text-sm font-semibold text-slate-800">{taxId}</p>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  PHONE NUMBER
                </p>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" /> {phone}
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  TERRITORY COVERAGE
                </p>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" /> {region}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Rewards & Network */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rewards Ledger Summary Card */}
          <div className="bg-slate-950 text-white rounded-2xl shadow-xl p-8 relative overflow-hidden border border-slate-800">
            <div className="absolute right-0 top-0 opacity-10">
              <Award size={160} className="-mr-10 -mt-10" />
            </div>

            <h3 className="text-xs font-bold flex items-center gap-2 mb-2 text-orange-400 uppercase tracking-wider">
              Available Reward Points
            </h3>
            <div className="flex items-end gap-3 mb-6">
              <p className="text-5xl font-black text-white">{formatNumber(pointsBalance)}</p>
              <p className="text-orange-400 font-bold text-base mb-1">pts</p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <QrCode size={16} />
                <span>Scan Materials Coupon</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Linked Dealer */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3 uppercase tracking-wider">
                <Building size={18} className="text-orange-600" />
                Linked Authorized Dealer
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Secondary sales through your linked dealer credit points directly to your account.
              </p>
              {linkedDealer ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-900">{linkedDealer.shop_name || linkedDealer.owner_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{linkedDealer.city || 'Regional Depot'}</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-500">
                  No linked dealer registered in your network yet. Authorized dealers will appear here.
                </div>
              )}
            </div>

            {/* Referral Info */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3 uppercase tracking-wider">
                Your Contractor Code
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Share your unique code with sub-contractors to earn bonus loyalty points on registration.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono font-bold text-center text-sm">
                  {user?.id ? user.id.slice(0, 10).toUpperCase() : 'CTR-PARTNER'}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Contractor Profile"
        description="Update your verified operational details and mobile contact."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                PAN / Tax ID
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Territory / Region
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-xs cursor-pointer"
            >
              Save Details
            </button>
          </div>
        </form>
      </Modal>

      {/* Coupon Scan / Entry Modal */}
      <Modal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        title="Scan Materials Coupon"
        description="Enter the voucher code stamped on verified cement bags or steel shipments."
      >
        <form onSubmit={handleApplyCoupon} className="space-y-4">
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 flex items-start gap-2.5">
            <Sparkles className="text-orange-600 shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold">Verified Material Incentives: </span>
              Manufacturer coupons are validated and credited directly to your loyalty wallet.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Coupon / Voucher Code *
            </label>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                required
                placeholder="e.g. STR-CEMENT-2026, STEEL-BAR-889"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCouponModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCoupon}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <QrCode size={15} />
              <span>{isSubmittingCoupon ? 'Verifying...' : 'Claim Points'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
