import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  KeyRound,
  MessageSquare,
  LogIn,
  Key,
  UserCog,
  Star,
  Truck,
  Store,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  Navigation,
} from 'lucide-react';
import {
  dataService,
  UserProfile,
  DealerSpotlight,
  AccountActivity,
} from '../../services/dataService';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';

export default function ProfileView({ mode = 'all' }: { mode?: 'all' | 'profile' | 'dealer' }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => dataService.getUserProfile());
  const [dealer, setDealer] = useState<DealerSpotlight | null>(() => dataService.getDealerSpotlight());
  const [activities, setActivities] = useState<AccountActivity[]>(() => dataService.getAccountActivity());

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editEmail, setEditEmail] = useState(profile?.email || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [editAddress, setEditAddress] = useState(profile?.address || '');

  // Change Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Contact Dealer Modal
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

  // Directions Modal
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);

  // Full History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (user) {
      dataService.syncWithAuthenticatedUser(user);
    }
    const load = () => {
      const p = dataService.getUserProfile();
      setProfile(p);
      setEditName(p?.name || '');
      setEditEmail(p?.email || '');
      setEditPhone(p?.phone || '');
      setEditAddress(p?.address || '');
      setDealer(dataService.getDealerSpotlight());
      setActivities(dataService.getAccountActivity());
    };
    load();
    const unsubscribe = dataService.subscribe(() => {
      load();
    });
    return unsubscribe;
  }, [user]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = dataService.updateUserProfile({
      name: editName,
      email: editEmail,
      phone: editPhone,
      address: editAddress,
    });
    setProfile(updated);
    setIsEditModalOpen(false);
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: 'Profile information updated successfully.',
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    const res = dataService.changePassword(currentPassword, newPassword);
    if (!res.success) {
      setPasswordError(res.message);
      return;
    }

    setIsPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: res.message,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setIsMessageOpen(false);
    setMessageText('');
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Message dispatched to ${dealer?.name || 'Assigned Dealer'}.`,
    });
  };

  const getActivityIcon = (type: AccountActivity['type']) => {
    switch (type) {
      case 'login':
        return <LogIn size={18} className="text-slate-500" />;
      case 'security':
        return <Key size={18} className="text-amber-500" />;
      case 'profile':
        return <UserCog size={18} className="text-blue-500" />;
    }
  };

  const initials = (profile?.name || user?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const renderDealerCard = () => (
    dealer ? (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <Store className="text-orange-600" size={22} />
            <span>Assigned Dealer</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMessageOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98]"
          >
            <MessageSquare size={15} />
            <span>Message Dealer</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Dealer Stats & Meta */}
          <div className="flex-1 space-y-5">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{dealer.name}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-amber-500">
                <span>★★★★★ {dealer.rating}</span>
                <span className="text-xs font-normal text-slate-400">({dealer.reviews} Reviews)</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    DISTRIBUTION CENTER
                  </p>
                  <p className="text-slate-800 font-semibold mt-0.5">{dealer.distributionCenter}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Truck size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    DELIVERY RANGE
                  </p>
                  <p className="text-slate-800 font-semibold mt-0.5">{dealer.deliveryRange}</p>
                </div>
              </div>
            </div>

            {/* YTD Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <h4 className="text-3xl font-bold text-slate-900 tracking-tight">{dealer.ordersYtd}</h4>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  ORDERS YTD
                </p>
              </div>
              <div>
                <h4 className="text-3xl font-bold text-slate-900 tracking-tight">{formatINR(dealer.spendYtd)}</h4>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  SPEND YTD
                </p>
              </div>
            </div>
          </div>

          {/* Map & Location Snippet */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-slate-100 rounded-t-2xl min-h-[160px] relative overflow-hidden border border-slate-200 border-b-0 flex items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="p-3 bg-white rounded-2xl shadow-lg flex items-center gap-2 border border-slate-200">
                <MapPin className="text-orange-600 animate-bounce" size={20} />
                <span className="text-xs font-bold text-slate-900">{dealer.name}</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-b-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{dealer.hours}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectionsOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
              >
                <span>Directions</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Store size={26} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">No Assigned Dealer Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Your account currently operates directly. An authorized dealer can be assigned to provide same-day localized dispatches.
          </p>
        </div>
      </div>
    )
  );

  const renderProfileCard = () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start">
      {/* User Avatar with Verification Badge */}
      <div className="flex flex-col items-center shrink-0 mx-auto md:mx-0">
        <div className="relative">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-3xl">
            {initials}
          </div>
          <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-xs">
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>

      {/* Profile Information Details */}
      <div className="flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {profile?.name || 'Partner Account'}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                KYC Verified
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1">Verified Member • Active Status</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0 border border-slate-200/60">
              <Mail size={16} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                EMAIL ADDRESS
              </p>
              <p className="text-sm font-semibold text-slate-800 break-all">{profile?.email || 'Not Provided'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0 border border-slate-200/60">
              <Phone size={16} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                PHONE NUMBER
              </p>
              <p className="text-sm font-semibold text-slate-800">{profile?.phone || 'Not Provided'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:col-span-2">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0 border border-slate-200/60">
              <MapPin size={16} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                PRIMARY ADDRESS
              </p>
              <p className="text-sm font-semibold text-slate-800 leading-relaxed">{profile?.address || 'Address Not Specified'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Edit Profile & Change Password */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-xs hover:shadow transition-all active:scale-[0.98]"
          >
            <Pencil size={15} />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold shadow-2xs transition-colors"
          >
            <KeyRound size={15} className="text-slate-400" />
            <span>Change Password</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header based on mode */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            {mode === 'dealer' ? (
              <>
                <Store className="text-orange-600" />
                <span>Assigned Dealer Information</span>
              </>
            ) : (
              <>
                <UserCog className="text-orange-600" />
                <span>Account Profile & Verification</span>
              </>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {mode === 'dealer'
              ? 'Connect directly with your authorized dealer for local dispatches and technical assistance.'
              : 'Manage your verified business credentials, delivery addresses, and account security.'}
          </p>
        </div>

        {mode !== 'dealer' && (
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
          >
            <Pencil size={15} />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {mode === 'dealer' ? (
        /* Standalone Dealer View for "Dealer Information" tab */
        <div className="space-y-6">
          {renderDealerCard()}
        </div>
      ) : (
        /* Profile View for "Profile Details" tab */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          <div className="xl:col-span-2 space-y-8">
            {renderProfileCard()}
            {mode === 'all' && renderDealerCard()}
          </div>

          {/* Right Column: Account Activity Vertical Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                  <UserCog size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Account Activity</h3>
              </div>

              {/* Vertical Timeline */}
              {activities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No recent activity logged. Account events and security log updates will appear here.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100">
                  {activities.slice(0, 4).map((activity) => (
                    <div key={activity.id} className="relative">
                      {/* Dot */}
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                      </div>

                      <div className="bg-slate-50/75 border border-slate-100 rounded-xl p-3.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{activity.title}</span>
                          <span className="text-[10px] text-slate-400">{activity.time}</span>
                        </div>
                        <p className="text-slate-600 font-normal">{activity.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                View Full History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Profile */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Account Profile"
        description="Update your verified operational and contact details."
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Primary Business Address
            </label>
            <textarea
              required
              rows={3}
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-xs hover:shadow transition-all"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Change Password */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Account Password"
        description="Ensure your new password contains at least 6 characters."
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {passwordError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-xs hover:shadow transition-all"
            >
              Update Password
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Message Dealer */}
      <Modal
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        title={`Message ${dealer?.name || 'Assigned Dealer'}`}
        description="Direct messaging line for dispatch inquiries and inventory checks."
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Your Message
            </label>
            <textarea
              required
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Inquire regarding order logistics, distribution center pickup or custom specifications..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsMessageOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
            >
              Send Direct Message
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Directions */}
      <Modal
        isOpen={isDirectionsOpen}
        onClose={() => setIsDirectionsOpen(false)}
        title="Distribution Center Location"
        description="Transit guidance to the primary materials depot."
      >
        <div className="space-y-4 text-center py-4">
          <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 mx-auto flex items-center justify-center border border-orange-100 shadow-xs">
            <Navigation size={24} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">{dealer?.name || 'Authorized Distribution Center'}</h4>
            <p className="text-sm font-semibold text-slate-700 mt-1">{dealer?.distributionCenter || 'Regional Hub'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{dealer?.deliveryRange || 'Regional'} coverage</p>
          </div>
          <div className="pt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsDirectionsOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              Close
            </button>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(dealer?.distributionCenter || 'Regional Materials Depot')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <span>Open in Google Maps</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </Modal>

      {/* MODAL: Full Activity History */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Complete Account Activity"
        description="Comprehensive audit log of security events and account modifications."
        maxWidth="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No activity logs recorded yet.
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{activity.title}</h5>
                    <p className="text-xs text-slate-500">{activity.desc}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400">{activity.time}</span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
