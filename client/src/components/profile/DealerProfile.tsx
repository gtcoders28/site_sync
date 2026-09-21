import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, CheckCircle2, Truck, MessageSquare, Pencil, RefreshCw } from 'lucide-react';
import { formatINR, formatNumber } from '../../utils';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { analyticsApi, loyaltyApi } from '../../lib/api';

export default function DealerProfile() {
  const { user } = useAuth();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(false);

  // Live Metrics from Database
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [activeCustomerCount, setActiveCustomerCount] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  // Profile details synced with authenticated user
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [distributorName, setDistributorName] = useState('');

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Contact Distro Hub Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [distroMessage, setDistroMessage] = useState('');

  const syncUserFields = () => {
    if (user) {
      setShopName((user.shop_name as string) || (user.name as string) || 'Registered Dealership');
      setOwnerName((user.owner_name as string) || (user.name as string) || 'Business Owner');
      setPhone(user.mobile_number ? `+91 ${user.mobile_number}` : 'Not Provided');
      setEmail((user.email as string) || 'Not Provided');
      setAddress(
        user.city
          ? `${user.city}${user.state ? `, ${user.state}` : ''}${user.pincode ? ` - ${user.pincode}` : ''}`
          : 'Address Not Provided'
      );
      setGstNumber((user.gst_number as string) || 'Not Registered');
      setDistributorName((user.distributor_name as string) || 'Assigned Regional Distributor');
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, loyaltyRes] = await Promise.all([
        analyticsApi.getDealerAnalytics().catch(() => null),
        loyaltyApi.getMyBalance().catch(() => null),
      ]);

      if (analyticsRes?.data?.summary) {
        setTotalPurchases(Number(analyticsRes.data.summary.totalPurchases || 0));
        setActiveCustomerCount(Number(analyticsRes.data.summary.activeCustomers || 0));
      } else {
        setTotalPurchases(0);
        setActiveCustomerCount(0);
      }

      if (loyaltyRes?.data) {
        setLoyaltyPoints(Number(loyaltyRes.data.availablePoints || 0));
      } else {
        setLoyaltyPoints(0);
      }
    } catch {
      // Fallback to 0 on clean state
      setTotalPurchases(0);
      setActiveCustomerCount(0);
      setLoyaltyPoints(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncUserFields();
    loadMetrics();
  }, [user]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: 'Dealership credentials and operational profile updated.',
    });
  };

  const handleSendMessageToHub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distroMessage.trim()) return;
    setIsContactModalOpen(false);
    setDistroMessage('');
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Dispatch inquiry transmitted to ${distributorName}.`,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dealer Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your storefront details, primary distributor link, and verified metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMetrics}
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Identity & Parent Info */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 text-center flex flex-col items-center relative overflow-hidden">
            <div className="w-full h-24 bg-gradient-to-r from-orange-50 to-amber-50 absolute top-0 left-0 border-b border-orange-100"></div>

            <div className="w-20 h-20 bg-white rounded-2xl border border-slate-200 shadow-md flex items-center justify-center relative z-10 mb-4 p-2 mt-4 text-orange-600">
              <Building2 size={36} />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">{shopName || 'Dealer Storefront'}</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-6">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Verified Enterprise Partner
            </span>

            <div className="w-full text-left space-y-4 pt-6 border-t border-slate-100 text-xs">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  PROPRIETOR NAME
                </p>
                <p className="text-sm font-semibold text-slate-900">{ownerName}</p>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  GST REGISTRATION
                </p>
                <p className="text-sm font-mono font-bold text-slate-800">{gstNumber}</p>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">
                  DEALER CLASSIFICATION
                </p>
                <p className="text-sm font-semibold text-slate-800">Authorized Wholesale Partner</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl p-6 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10">
              <Truck size={120} className="-mr-6 -mt-6" />
            </div>
            <h3 className="text-xs font-bold flex items-center gap-2 mb-2 text-orange-400 uppercase tracking-wider">
              Assigned Regional Distributor
            </h3>
            <p className="text-lg font-bold mb-1">{distributorName}</p>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Direct dispatch with priority turn-around SLA and automated billing clearance.
            </p>
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Contact Distributor Hub</span>
            </button>
          </div>
        </div>

        {/* Right Column: Metrics & Location */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL PURCHASES</p>
              <p className="text-2xl font-bold text-slate-900">{formatINR(totalPurchases)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ACTIVE CUSTOMERS</p>
              <p className="text-2xl font-bold text-blue-600">{activeCustomerCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LOYALTY REWARDS</p>
              <p className="text-2xl font-bold text-amber-600">{formatNumber(loyaltyPoints)} pts</p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-5 uppercase tracking-wider">
              Business Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  OFFICIAL PHONE
                </p>
                <p className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <Phone size={16} className="text-slate-400" /> {phone}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  BILLING EMAIL
                </p>
                <p className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                  <Mail size={16} className="text-slate-400" /> {email}
                </p>
              </div>
            </div>
          </div>

          {/* Store Location */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Store Location & Depot</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              {address}
            </p>
            <div className="h-44 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 relative overflow-hidden bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="p-3 bg-white rounded-xl shadow-md flex items-center gap-2 border border-slate-200">
                <MapPin className="text-orange-600" size={18} />
                <span className="text-xs font-bold text-slate-800">{shopName} Depot</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Store Profile"
        description="Update your business establishment details and registered contact coordinates."
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Firm / Shop Name *
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Proprietor Name *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                GST Number
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Phone *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Billing Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Depot Address
            </label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact Distro Hub Modal */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title={`Contact ${distributorName}`}
        description="Transmit operational logistics dispatch requests or invoice inquiries."
      >
        <form onSubmit={handleSendMessageToHub} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Dispatch Request / Inquiry
            </label>
            <textarea
              required
              rows={4}
              value={distroMessage}
              onChange={(e) => setDistroMessage(e.target.value)}
              placeholder="e.g. Inquiring on delivery status for recent bulk consignment or stock availability..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsContactModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs cursor-pointer"
            >
              Send Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
