import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  X,
  Clock,
  Store,
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MapPin,
  Phone,
  ShieldCheck,
  FileText,
  Calendar,
  Filter,
  UserCheck,
} from 'lucide-react';
import { approvalsApi, RegistrationApprovalRequest } from '../../lib/api/approvals';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';

interface RegistrationApprovalsViewProps {
  initialRequesterType?: 'dealer' | 'customer';
}

const REJECTION_PRESETS = [
  'Incomplete business documentation / GST mismatch',
  'Unserviceable geographic territory / overlapping coverage',
  'Unverifiable contact details or address proof',
  'Duplicate dealer/customer registration detected',
  'Commercial credit verification failure',
  'Other / Custom reason',
];

export default function RegistrationApprovalsView({
  initialRequesterType,
}: RegistrationApprovalsViewProps) {
  const [requests, setRequests] = useState<RegistrationApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'pending' | 'rejected' | 'approved' | 'all'>('pending');
  const [profileFilter, setProfileFilter] = useState<'all' | 'dealer' | 'customer'>(
    initialRequesterType || 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationApprovalRequest | null>(null);
  const [rejectionPreset, setRejectionPreset] = useState(REJECTION_PRESETS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Action State
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await approvalsApi.getRequests();
      const list = Array.isArray(res?.data) ? res.data : [];
      setRequests(list);
    } catch (err: any) {
      console.error('Failed to load registration requests:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to fetch registration requests.',
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (req: RegistrationApprovalRequest) => {
    setApprovingId(req.request_id);
    try {
      await approvalsApi.resolveRequest(req.request_id, 'approve');
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Registration for "${req.requester_name || 'Partner'}" approved! Status set to active.`,
      });
      await fetchRequests();
    } catch (err: any) {
      console.error('Failed to approve request:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Approval failed. Please try again.',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectModal = (req: RegistrationApprovalRequest) => {
    setSelectedRequest(req);
    setRejectionPreset(REJECTION_PRESETS[0]);
    setCustomRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const finalReason =
      rejectionPreset === 'Other / Custom reason'
        ? customRejectionReason.trim()
        : customRejectionReason.trim()
        ? `${rejectionPreset}: ${customRejectionReason.trim()}`
        : rejectionPreset;

    if (!finalReason) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: 'Please provide a reason for rejecting this registration.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await approvalsApi.resolveRequest(selectedRequest.request_id, 'reject', finalReason);
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Registration for "${selectedRequest.requester_name || 'Partner'}" has been rejected.`,
      });
      setRejectModalOpen(false);
      setSelectedRequest(null);
      await fetchRequests();
    } catch (err: any) {
      console.error('Failed to reject request:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Rejection failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics counters across all fetched items
  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    return {
      pending,
      approved,
      rejected,
      all: requests.length,
    };
  }, [requests]);

  // Filtered requests based on active tab, profile type, and search
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusTab === 'all' || r.status === statusTab;
      const matchesProfile = profileFilter === 'all' || r.requester_type === profileFilter;

      const searchTarget = `
        ${r.requester_name || ''} 
        ${r.owner_name || ''} 
        ${r.requester_mobile || ''} 
        ${r.city || ''} 
        ${r.state || ''} 
        ${r.rejection_reason || ''}
      `.toLowerCase();

      const matchesSearch = !searchTerm.trim() || searchTarget.includes(searchTerm.toLowerCase());

      return matchesStatus && matchesProfile && matchesSearch;
    });
  }, [requests, statusTab, profileFilter, searchTerm]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <UserCheck size={14} />
            <span>Network Verification & Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Registration Approvals
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review onboarding requests, approve authentic partners, and audit rejected profiles with detailed reasons.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-orange-600' : 'text-slate-500'} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusTab('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTab === 'pending'
              ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{counts.pending}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Awaiting tick/cross resolution</p>
        </div>

        <div
          onClick={() => setStatusTab('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTab === 'rejected'
              ? 'bg-rose-500/10 border-rose-400 ring-2 ring-rose-400/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Rejected Requests</span>
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <XCircle size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{counts.rejected}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">View declined entries & reasons</p>
        </div>

        <div
          onClick={() => setStatusTab('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTab === 'approved'
              ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-400/20 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved Partners</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{counts.approved}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Active & verified network members</p>
        </div>

        <div
          onClick={() => setStatusTab('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200/80 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusTab === 'all' ? 'text-slate-300' : 'text-slate-600'}`}>
              Total Submissions
            </span>
            <span className={`p-1.5 rounded-lg ${statusTab === 'all' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              <FileText size={16} />
            </span>
          </div>
          <div className={`text-2xl font-black mt-2 ${statusTab === 'all' ? 'text-white' : 'text-slate-900'}`}>
            {counts.all}
          </div>
          <p className={`text-[11px] font-medium mt-0.5 ${statusTab === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
            Complete onboarding audit log
          </p>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 overflow-x-auto">
          <button
            onClick={() => setStatusTab('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusTab === 'pending'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setStatusTab('rejected')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusTab === 'rejected'
                ? 'bg-white text-rose-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected with Reasons ({counts.rejected})
          </button>
          <button
            onClick={() => setStatusTab('approved')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusTab === 'approved'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved ({counts.approved})
          </button>
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Requests ({counts.all})
          </button>
        </div>

        {/* Profile Filter + Search */}
        <div className="flex items-center gap-2.5 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, owner, phone, city, or rejection reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Profile:</span>
            <CustomDropdown
              value={profileFilter}
              onChange={(val) => setProfileFilter(val as any)}
              options={[
                { value: 'all', label: 'All Profiles' },
                { value: 'dealer', label: 'Dealers Only' },
                { value: 'customer', label: 'Customers Only' },
              ]}
              buttonClassName="w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Request Queue */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8">
          <EmptyState
            icon={statusTab === 'rejected' ? XCircle : statusTab === 'pending' ? Clock : ShieldCheck}
            title={
              statusTab === 'rejected'
                ? 'No Rejected Requests'
                : statusTab === 'pending'
                ? 'Queue Clear! No Pending Requests'
                : 'No Registration Requests Found'
            }
            description={
              statusTab === 'rejected'
                ? 'No registration requests have been rejected under this filter. All rejected entries along with their rejection reasons will be preserved here for review.'
                : statusTab === 'pending'
                ? 'All incoming registration requests have been reviewed and approved or rejected.'
                : 'No requests match your current filters. Try changing your search term or profile filter.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';
            const isDealer = req.requester_type === 'dealer';

            return (
              <div
                key={req.request_id}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 ${
                  isPending
                    ? 'border-amber-200/80 shadow-2xs hover:border-amber-300'
                    : isRejected
                    ? 'border-rose-100 bg-rose-50/10 hover:border-rose-200'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Identity & Contact Info */}
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs ${
                        isDealer
                          ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                          : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                      }`}
                    >
                      {isDealer ? <Store size={20} /> : <Users size={20} />}
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 leading-tight">
                          {req.requester_name || (isDealer ? 'Unnamed Dealership' : 'Customer Account')}
                        </span>

                        {/* Profile Type Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isDealer
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isDealer ? 'Dealer Profile' : 'Customer Profile'}
                        </span>

                        {/* Sub-category if present and not redundant */}
                        {req.category_or_type && req.category_or_type.toLowerCase() !== 'customer' && (
                          <span className="text-[11px] font-medium text-slate-500 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 capitalize">
                            {req.category_or_type}
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-amber-100 text-amber-800'
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPending && <Clock size={12} />}
                          {isApproved && <Check size={12} />}
                          {isRejected && <X size={12} />}
                          <span>
                            {isApproved
                              ? req.resolved_by_staff_name
                                ? `Approved by Staff: ${req.resolved_by_staff_name}`
                                : req.resolver_type === 'staff' || req.resolved_by_staff_id
                                ? 'Approved by Staff'
                                : 'Approved by You'
                              : req.status === 'pending'
                              ? 'Pending'
                              : 'Rejected'}
                          </span>
                        </span>
                      </div>

                      {/* Subtitle Details: Owner (for dealers), Phone, Location, Date */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-0.5">
                        {isDealer && req.owner_name && (
                          <span className="font-medium text-slate-700">
                            Owner: <strong className="text-slate-900">{req.owner_name}</strong>
                          </span>
                        )}

                        {req.requester_mobile && (
                          <a
                            href={`tel:${req.requester_mobile}`}
                            className="inline-flex items-center gap-1 font-mono text-slate-600 hover:text-orange-600"
                          >
                            <Phone size={12} className="text-slate-400" />
                            <span>+91 {req.requester_mobile}</span>
                          </a>
                        )}

                        {(req.city || req.state) && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{[req.city, req.state].filter(Boolean).join(', ')}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Calendar size={12} />
                          <span>
                            Submitted:{' '}
                            {req.requested_at
                              ? new Date(req.requested_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recent'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Controls for Pending: Tick (✓) & Cross (✕) */}
                  {isPending && (
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
                      {/* Approve Button (Tick ✓) */}
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={approvingId === req.request_id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                        title="Approve Registration (✓)"
                      >
                        <Check size={16} className="stroke-[2.5]" />
                        <span>{approvingId === req.request_id ? 'Approving…' : 'Approve'}</span>
                      </button>

                      {/* Reject Button (Cross ✕) */}
                      <button
                        onClick={() => openRejectModal(req)}
                        disabled={approvingId === req.request_id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 active:scale-95 font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        title="Reject Registration with Reason (✕)"
                      >
                        <X size={16} className="stroke-[2.5]" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {/* Right Status Details for Approved */}
                  {isApproved && (
                    <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] text-emerald-700 font-bold block">Verified & Active</span>
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          {req.resolved_by_staff_name
                            ? `Approved by Staff: ${req.resolved_by_staff_name}`
                            : req.resolver_type === 'staff' || req.resolved_by_staff_id
                            ? 'Approved by Staff'
                            : 'Approved by You'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {req.resolved_at ? new Date(req.resolved_at).toLocaleDateString('en-US') : 'Resolved'}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Prominent Section for Rejected Requests: Rejection Reason Alert Box */}
                {isRejected && (
                  <div className="mt-3.5 pt-3 border-t border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50/70 p-3 rounded-xl">
                    <div className="flex items-start gap-2 text-rose-900">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong className="font-extrabold text-rose-950 uppercase tracking-wide mr-1.5">
                          Rejection Reason:
                        </strong>
                        <span className="font-medium text-rose-800">
                          {req.rejection_reason || 'Rejected during verification without specified notes.'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-rose-600 whitespace-nowrap self-end sm:self-auto">
                      Rejected on:{' '}
                      {req.resolved_at
                        ? new Date(req.resolved_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Resolved'}
                      {req.resolved_by_staff_name
                        ? ` • by Staff: ${req.resolved_by_staff_name}`
                        : req.resolver_type === 'staff' || req.resolved_by_staff_id
                        ? ' • by Staff'
                        : ' • by You'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal with Mandatory Reason Prompt */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setRejectModalOpen(false);
            setSelectedRequest(null);
          }
        }}
        title="Reject Registration Request"
        description="Specify why this registration request is being rejected. This reason will be permanently recorded in the database and audit trail."
        maxWidth="md"
      >
        {selectedRequest && (
          <form onSubmit={handleConfirmReject} className="space-y-4">
            {/* Target Profile Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                {selectedRequest.requester_type === 'dealer' ? <Store size={18} /> : <Users size={18} />}
              </div>
              <div className="leading-tight">
                <p className="font-bold text-slate-900 text-sm">
                  {selectedRequest.requester_name || 'Registration Request'}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {selectedRequest.requester_type} Profile • +91 {selectedRequest.requester_mobile}
                </p>
              </div>
            </div>

            {/* Standard Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Select Rejection Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={rejectionPreset}
                onChange={(e) => setRejectionPreset(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {REJECTION_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            {/* Detailed Reason Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Detailed Rejection Notes / Additional Justification
              </label>
              <textarea
                rows={3}
                placeholder="Provide specific details (e.g. invalid GSTIN, document blur, territory overlap with existing dealer)..."
                value={customRejectionReason}
                onChange={(e) => setCustomRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X size={14} className="stroke-[3]" />
                <span>{isSubmitting ? 'Recording Rejection…' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Global Notification Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
