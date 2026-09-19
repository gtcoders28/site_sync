import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Users, Trash2, CheckCircle2, UserCheck, Eye } from 'lucide-react';
import { dataService, Customer } from '../../services/dataService';
import { formatINR, formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { StatusPillDropdown } from '../ui/StatusPillDropdown';
import { useAuth } from '../../context/AuthContext';

export default function CustomerManagement() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dealerFilter, setDealerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newAssignedDealer, setNewAssignedDealer] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newSource, setNewSource] = useState<'SELF' | 'DEALER' | 'DISTRIBUTOR'>('DEALER');
  const [newStatus, setNewStatus] = useState<'Active' | 'Pending'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = () => {
    fetch('/api/sitesync/customers')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data) && j.data.length > 0) {
          setCustomers(j.data);
        } else {
          setCustomers(dataService.getCustomers());
        }
      })
      .catch(() => {
        setCustomers(dataService.getCustomers());
      });
  };

  useEffect(() => {
    loadCustomers();
    const unsubscribe = dataService.subscribe(() => {
      loadCustomers();
    });
    return unsubscribe;
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = newMobile.replace(/\D/g, '').slice(-10);
    if (!newName.trim() || !cleanMobile || cleanMobile.length !== 10) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Name and a valid 10-digit mobile number are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const dealerId = user?.rawId || user?.dealerId || null;
      const resp = await fetch('/api/sitesync/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          mobileNumber: cleanMobile,
          city: newCity.trim() || 'Regional Center',
          assignedDealerId: dealerId,
          password: 'Customer@123',
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to create customer in database.');
      }

      dataService.createCustomer({
        name: newName.trim(),
        mobile: `+91 ${cleanMobile}`,
        assignedDealer: newAssignedDealer || 'Authorized Regional Dealer',
        city: newCity.trim() || 'New Delhi',
        source: newSource,
        status: newStatus,
      });

      setIsAddModalOpen(false);
      setNewName('');
      setNewMobile('');
      setNewAssignedDealer('');
      setNewCity('');
      loadCustomers();

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Customer ${newName} registered in database! Login Mobile: ${cleanMobile}, Password: Customer@123`,
      });
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to register customer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCustomerStatus = async (id: string, nextStatus: 'Active' | 'Pending' | 'Inactive') => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id || (c as any).rawId === id ? { ...c, status: nextStatus as any } : c))
    );
    dataService.updateCustomerStatus(id, nextStatus as any);

    try {
      const cust = customers.find((c) => c.id === id || (c as any).rawId === id);
      const targetId = (cust as any)?.rawId || (cust as any)?.mobileNumber || id;
      await fetch(`/api/sitesync/customers/${encodeURIComponent(targetId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Customer status updated to ${nextStatus}.`,
      });
    } catch (err: any) {
      console.error('Error updating customer status:', err);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    try {
      const cust = customers.find((c) => c.id === id || (c as any).rawId === id);
      const targetId = (cust as any)?.rawId || (cust as any)?.mobileNumber || id;
      const resp = await fetch(`/api/sitesync/customers/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete customer from database.');
      }

      dataService.deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id && (c as any).rawId !== id));
      loadCustomers();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Customer ${name} permanently removed from live database.`,
      });
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to delete customer.',
      });
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
                  <th className="px-4 lg:px-5 py-3.5">Assigned Dealer</th>
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
                      <td className="px-4 lg:px-5 py-4 text-sm text-slate-700 font-medium whitespace-nowrap">{customer.assignedDealer}</td>
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
                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
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
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Customer" maxWidth="md">
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Number *
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 98112 34567"
              value={newMobile}
              onChange={(e) => setNewMobile(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assigned Dealer
              </label>
              <input
                type="text"
                placeholder="e.g. Metro Hardware 2563"
                value={newAssignedDealer}
                onChange={(e) => setNewAssignedDealer(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                City / Region
              </label>
              <input
                type="text"
                placeholder="e.g. New Delhi"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Registration Source
              </label>
              <CustomDropdown
                value={newSource}
                onChange={(val) => setNewSource(val as any)}
                options={[
                  { value: 'DEALER', label: 'Dealer', dotColor: 'bg-emerald-500' },
                  { value: 'SELF', label: 'Self Registered', dotColor: 'bg-blue-500' },
                  { value: 'DISTRIBUTOR', label: 'Distributor', dotColor: 'bg-purple-500' },
                ]}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors shadow-xs"
            >
              {isSubmitting ? 'Registering…' : 'Register Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
