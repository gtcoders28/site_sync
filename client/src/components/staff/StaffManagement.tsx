import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { staffApi, type StaffMember, type CreateStaffPayload } from '../../lib/api/staff';
import { useAuth } from '../../context/AuthContext';
import { Toast, type ToastMessage } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

export default function StaffManagement() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Add Staff Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [roleTitle, setRoleTitle] = useState('Operations Executive');
  const [canCreateInvoices, setCanCreateInvoices] = useState(true);
  const [canApproveRegistrations, setCanApproveRegistrations] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await staffApi.getStaff();
      setStaffList(res.data || []);
    } catch (err: any) {
      console.error('Failed to load staff list:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to retrieve staff directory.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      setModalError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 6) {
      setModalError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateStaffPayload = {
        fullName: fullName.trim(),
        mobileNumber: cleanMobile,
        password,
        email: email.trim() || undefined,
        role: roleTitle.trim() || 'staff',
        canCreateInvoices,
        canApproveRegistrations,
      };

      await staffApi.createStaff(payload);
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Staff member "${fullName}" onboarded successfully!`,
      });

      setIsAddModalOpen(false);
      setFullName('');
      setMobileNumber('');
      setPassword('');
      setEmail('');
      setRoleTitle('Operations Executive');
      setCanCreateInvoices(true);
      setCanApproveRegistrations(false);
      await loadStaff();
    } catch (err: any) {
      console.error('Failed to onboard staff:', err);
      setModalError(err?.message || 'Failed to onboard staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePermission = async (
    staffId: string,
    key: 'canCreateInvoices' | 'canApproveRegistrations',
    currentVal: boolean
  ) => {
    try {
      await staffApi.updatePermissions(staffId, { [key]: !currentVal });
      setStaffList((prev) =>
        prev.map((s) => {
          if (s.staff_id === staffId) {
            return {
              ...s,
              [key === 'canCreateInvoices' ? 'can_create_invoices' : 'can_approve_registrations']: !currentVal,
            };
          }
          return s;
        })
      );
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: 'Operational permission updated successfully.',
      });
    } catch (err: any) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to update permission.',
      });
    }
  };

  const handleStatusChange = async (staffId: string, nextStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      await staffApi.updateStatus(staffId, nextStatus);
      setStaffList((prev) =>
        prev.map((s) => (s.staff_id === staffId ? { ...s, status: nextStatus } : s))
      );
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Staff status updated to ${nextStatus}.`,
      });
    } catch (err: any) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to update status.',
      });
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);
    try {
      await staffApi.deleteStaff(staffToDelete.staff_id);
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Staff member "${staffToDelete.full_name}" removed.`,
      });
      setStaffToDelete(null);
      await loadStaff();
    } catch (err: any) {
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to delete staff member.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.mobile_number.includes(searchTerm) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.status === 'active').length;
  const invoiceIssuersCount = staffList.filter((s) => s.can_create_invoices && s.status === 'active').length;
  const registrationApproversCount = staffList.filter((s) => s.can_approve_registrations && s.status === 'active').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users size={22} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Staff Management</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Delegate operational duties, grant invoicing privileges, and control registration approval access.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => void loadStaff()}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-md cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Onboard Staff</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL STAFF</p>
          <p className="text-2xl font-black text-slate-900">{totalCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Assigned Workers</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">ACTIVE OPERATORS</p>
          <p className="text-2xl font-black text-emerald-700">{activeCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Logged In & Working</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">INVOICE DRAFTERS</p>
          <p className="text-2xl font-black text-indigo-700">{invoiceIssuersCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Can Draft Invoices</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1">APPROVAL OFFICERS</p>
          <p className="text-2xl font-black text-purple-700">{registrationApproversCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Can Approve KYC</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'active', 'inactive', 'suspended'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Users}
              title="No Staff Members Found"
              description={
                searchTerm
                  ? 'No staff member matches your search filter.'
                  : 'You have not onboarded any staff members yet. Click "Onboard Staff" to delegate invoicing and registration review.'
              }
              actionLabel={!searchTerm ? 'Add First Staff Member' : undefined}
              onAction={!searchTerm ? () => setIsAddModalOpen(true) : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Designation</th>
                  <th className="py-3.5 px-4">Mobile Contact</th>
                  <th className="py-3.5 px-4 text-center">Invoicing Privilege</th>
                  <th className="py-3.5 px-4 text-center">Registration Approval</th>
                  <th className="py-3.5 px-4 text-center">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStaff.map((member) => (
                  <tr key={member.staff_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{member.full_name}</div>
                      {member.email && <div className="text-xs text-slate-400">{member.email}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                        {member.role || 'Staff'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-700">
                      +91 {member.mobile_number}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePermission(member.staff_id, 'canCreateInvoices', member.can_create_invoices)
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                          member.can_create_invoices
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title="Click to toggle invoicing privilege"
                      >
                        {member.can_create_invoices ? <Check size={12} /> : <X size={12} />}
                        <span>{member.can_create_invoices ? 'Allowed' : 'Restricted'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePermission(
                            member.staff_id,
                            'canApproveRegistrations',
                            member.can_approve_registrations
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                          member.can_approve_registrations
                            ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title="Click to toggle registration approval privilege"
                      >
                        {member.can_approve_registrations ? <Check size={12} /> : <X size={12} />}
                        <span>{member.can_approve_registrations ? 'Authorized' : 'Disabled'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={member.status}
                        onChange={(e) => handleStatusChange(member.staff_id, e.target.value as any)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1 border outline-none cursor-pointer ${
                          member.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : member.status === 'inactive'
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setStaffToDelete(member)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove staff member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Onboard New Operational Staff">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Verma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Staff Login Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Min. 6 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="staff@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Role / Title
              </label>
              <input
                type="text"
                placeholder="e.g. Billing Executive"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
              />
            </div>
          </div>

          {/* Permissions Group */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Operational Privileges</p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canCreateInvoices}
                onChange={(e) => setCanCreateInvoices(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Can Draft Sales Invoices</span>
                <span className="text-[11px] text-slate-500 block">
                  Allows staff to draft customer and B2B invoices which you can approve.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canApproveRegistrations}
                onChange={(e) => setCanApproveRegistrations(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Can Approve Registrations</span>
                <span className="text-[11px] text-slate-500 block">
                  Allows senior staff to approve customer registration requests directly.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Onboarding...' : 'Onboard Staff'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {staffToDelete && (
        <Modal
          isOpen={!!staffToDelete}
          onClose={() => setStaffToDelete(null)}
          title="Confirm Staff Removal"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to remove staff member{' '}
              <strong className="text-slate-900">{staffToDelete.full_name}</strong> (
              <span className="font-mono text-xs">+91 {staffToDelete.mobile_number}</span>)?
            </p>
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              They will immediately lose access to sign into the system and manage records.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteStaff}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Removing...' : 'Delete Staff Member'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
