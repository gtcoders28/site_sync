import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, Users, Trash2, CheckCircle2, UserCheck, Eye, EyeOff } from 'lucide-react';
import { Customer } from '../../services/dataService';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { StatusPillDropdown } from '../ui/StatusPillDropdown';
import { SearchableSelect, INDIAN_STATES_AND_UTS } from '../ui/SearchableSelect';
import { useAuth } from '../../context/AuthContext';
import { usersApi, authApi } from '../../lib/api';

export default function CustomerManagement() {
  const { user } = useAuth();
  const isDealerOrRetailer =
    user?.role === 'dealer' ||
    user?.role === 'retailer' ||
    (user?.role === 'staff' && user?.employerType === 'dealer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dealerFilter, setDealerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newAssignedDealer, setNewAssignedDealer] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newSource, setNewSource] = useState<'SELF' | 'DEALER' | 'DISTRIBUTOR'>('DEALER');
  const [newStatus, setNewStatus] = useState<'Active' | 'Pending'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Customer State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCustomers = async () => {
    try {
      const res = await usersApi.getCustomers();
      const raw = Array.isArray(res?.data) ? res.data : [];
      const mapped: Customer[] = raw.map((c: any) => ({
        id: c.customer_id?.slice(0, 8) || 'CTR',
        rawId: c.customer_id,
        name: c.name || 'Registered Customer',
        source: (c.source || 'SELF') as any,
        mobile: c.mobile_number ? `+91 ${c.mobile_number}` : 'Unlisted',
        assignedDealer: c.onboarding_dealer_name || 'Regional Dealer',
        city: c.city || 'Regional Center',
        regDate: c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        status: (c.status === 'active' || c.status === 'Active' ? 'Active' : 'Pending') as any,
        totalValue: 0,
        points: 0,
      }));
      setCustomers(mapped);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    return Array.from(set);
  }, [customers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const cleanMobile = newMobile.replace(/\D/g, '');
    if (!newName.trim()) {
      setModalError('Customer Name is required.');
      return;
    }
    if (cleanMobile.length !== 10) {
      setModalError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!newCity.trim()) {
      setModalError('City is required.');
      return;
    }
    if (!newState.trim()) {
      setModalError('Please select a State from the list.');
      return;
    }
    const finalPassword = newPassword.trim() || 'Customer@123';
    if (finalPassword.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dealerId = user?.dealerId || (user?.role === 'dealer' ? user?.id : null);
      await authApi.signUp('customer', {
        name: newName.trim(),
        mobileNumber: cleanMobile,
        city: newCity.trim(),
        state: newState.trim(),
        onboardingDealerId: dealerId,
        password: finalPassword,
      });

      setIsAddModalOpen(false);
      setNewName('');
      setNewMobile('');
      setNewPassword('');
      setShowPassword(false);
      setNewAssignedDealer('');
      setNewCity('');
      setNewState('');
      setModalError(null);
      await loadCustomers();

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Customer "${newName.trim()}" registered in database! Mobile: ${cleanMobile}`,
      });
    } catch (err: any) {
      console.error('Error creating customer:', err);
      const errMsg = err?.message || 'Failed to register customer.';
      setModalError(errMsg);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomerStatus = async (id: string, nextStatus: 'Active' | 'Pending' | 'Inactive') => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id || (c as any).rawId === id ? { ...c, status: nextStatus as any } : c))
    );
    setToast({
      id: String(Date.now()),
      type: 'success',
      message: `Customer status updated to ${nextStatus}.`,
    });
  };

  const confirmDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const executeDeleteCustomer = async () => {
    if (!customerToDelete) return;
    const targetId = (customerToDelete as any).rawId || customerToDelete.id;
    setIsDeleting(true);
    try {
      await usersApi.deleteCustomer(targetId);
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Customer "${customerToDelete.name}" deleted successfully from database.`,
      });
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      await loadCustomers();
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err?.message || 'Failed to delete customer from database.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm);
    const matchesDealer = !dealerFilter || c.assignedDealer.toLowerCase().includes(dealerFilter.toLowerCase());
    const matchesSource = !sourceFilter || c.source === sourceFilter;
    return matchesSearch && matchesDealer && matchesSource;
  });

  const totalPurchases = customers.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  const totalPoints = customers.reduce((sum, c) => sum + (c.points || 0), 0);
  const activeCustomers = customers.filter((c) => c.status === 'Active').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track your regional customer base, loyalty tiers, and purchase history.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-xs hover:shadow-md cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL CUSTOMERS</p>
          <p className="text-2xl font-black text-slate-900">{customers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Registered Accounts</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">ACTIVE BUYERS</p>
          <p className="text-2xl font-black text-emerald-700">{activeCustomers}</p>
          <p className="text-xs text-slate-500 mt-0.5">Verified & Purchasing</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">TOTAL PURCHASES</p>
          <p className="text-2xl font-black text-orange-700">{formatINR(totalPurchases)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Cumulative Volume</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1">REWARD POINTS</p>
          <p className="text-2xl font-black text-purple-700">{formatNumber(totalPoints)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Earned Incentives</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by ID, Name, Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm placeholder-slate-400"
            />
          </div>

          <div className="flex-1 w-full md:max-w-xs">
            <CustomDropdown
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: '', label: 'Registration Source: All' },
                { value: 'SELF', label: 'Self Registered', dotColor: 'bg-blue-500' },
                { value: 'DEALER', label: 'Dealer Onboarded', dotColor: 'bg-emerald-500' },
                { value: 'DISTRIBUTOR', label: 'Distributor Onboarded', dotColor: 'bg-purple-500' },
              ]}
              buttonClassName="w-full"
            />
          </div>
        </div>

        {/* Table / Empty State */}
        {customers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No Customers Registered Yet"
              description="Start onboarding customers to build your regional retail and distribution network."
              actionLabel="Add First Customer"
              onAction={() => setIsAddModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                  <th className="px-4 lg:px-5 py-3.5">Customer ID</th>
                  <th className="px-4 lg:px-5 py-3.5">Customer Name</th>
                  <th className="px-4 lg:px-5 py-3.5">Mobile</th>
                  {!isDealerOrRetailer && <th className="px-4 lg:px-5 py-3.5">Assigned Dealer</th>}
                  <th className="px-4 lg:px-5 py-3.5">City</th>
                  <th className="px-4 lg:px-5 py-3.5">Status</th>
                  <th className="px-4 lg:px-5 py-3.5 text-right">Total Value</th>
                  <th className="px-4 lg:px-5 py-3.5 text-right">Points</th>
                  <th className="px-4 lg:px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCustomers.map((customer) => {
                  const initial = (customer.name[0] || 'C').toUpperCase();
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                          {customer.id}
                        </span>
                      </td>
                      <td className="px-4 lg:px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900 leading-tight">{customer.name}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wide ${
                                  customer.source === 'SELF'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : customer.source === 'DEALER'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {customer.source}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Registered {customer.regDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <a href={`tel:${customer.mobile}`} className="text-xs text-slate-600 font-mono font-medium hover:text-orange-600 transition-colors">
                          {customer.mobile}
                        </a>
                      </td>
                      {!isDealerOrRetailer && (
                        <td className="px-4 lg:px-5 py-4 text-sm text-slate-700 font-medium whitespace-nowrap">{customer.assignedDealer}</td>
                      )}
                      <td className="px-4 lg:px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{customer.city}</td>
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <StatusPillDropdown
                          status={customer.status}
                          onChange={(newStatus) => handleUpdateCustomerStatus(customer.id, newStatus as any)}
                        />
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-sm font-black text-slate-900 text-right whitespace-nowrap">
                        {formatINR(customer.totalValue)}
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-right whitespace-nowrap">
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {formatNumber(customer.points)} pts
                        </span>
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => confirmDeleteCustomer(customer)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete customer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {customers.length > 0 && (
          <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center bg-slate-50/50">
            <span>
              Showing {filteredCustomers.length} of {customers.length} customer records
            </span>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setModalError(null); }} title="Add New Customer" maxWidth="md">
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          {modalError && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Customer Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Chandra"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
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
                placeholder="e.g. 98112 34567"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Login Password (Optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  placeholder="Set password (optional)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                City *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Indore"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State *
              </label>
              <SearchableSelect
                value={newState}
                onChange={setNewState}
                options={INDIAN_STATES_AND_UTS}
                placeholder="Select State..."
                required
              />
            </div>
          </div>

          {isDealerOrRetailer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registration Source
                </label>
                <CustomDropdown
                  value={newSource}
                  onChange={(val) => setNewSource(val as any)}
                  options={[
                    { value: 'DEALER', label: 'Dealer Onboarded', dotColor: 'bg-emerald-500' },
                    { value: 'SELF', label: 'Self Registered', dotColor: 'bg-blue-500' },
                    { value: 'DISTRIBUTOR', label: 'Distributor Hub', dotColor: 'bg-purple-500' },
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Status
                </label>
                <CustomDropdown
                  value={newStatus}
                  onChange={(val) => setNewStatus(val as any)}
                  options={[
                    { value: 'Active', label: 'Active', dotColor: 'bg-emerald-500' },
                    { value: 'Pending', label: 'Pending', dotColor: 'bg-amber-500' },
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Assigned Dealer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Hardware"
                    value={newAssignedDealer}
                    onChange={(e) => setNewAssignedDealer(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Registration Source
                  </label>
                  <CustomDropdown
                    value={newSource}
                    onChange={(val) => setNewSource(val as any)}
                    options={[
                      { value: 'DEALER', label: 'Dealer Onboarded', dotColor: 'bg-emerald-500' },
                      { value: 'SELF', label: 'Self Registered', dotColor: 'bg-blue-500' },
                      { value: 'DISTRIBUTOR', label: 'Distributor Hub', dotColor: 'bg-purple-500' },
                    ]}
                    className="w-full"
                    buttonClassName="w-full py-2.5"
                    menuClassName="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Status
                </label>
                <CustomDropdown
                  value={newStatus}
                  onChange={(val) => setNewStatus(val as any)}
                  options={[
                    { value: 'Active', label: 'Active', dotColor: 'bg-emerald-500' },
                    { value: 'Pending', label: 'Pending', dotColor: 'bg-amber-500' },
                  ]}
                  className="w-full"
                  buttonClassName="w-full py-2.5"
                  menuClassName="w-full"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? 'Registering…' : 'Register Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setCustomerToDelete(null);
          }
        }}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This will permanently delete the customer record from PostgreSQL."
        maxWidth="sm"
      >
        {customerToDelete && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-slate-900 text-sm truncate">{customerToDelete.name}</p>
                <p className="text-xs text-slate-500 font-medium">
                  {customerToDelete.mobile} • {customerToDelete.city}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This action permanently removes the customer from the database and revokes associated loyalty access.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setCustomerToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteCustomer}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <Trash2 size={14} />
                <span>{isDeleting ? 'Deleting…' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
