import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Store, Trash2 } from 'lucide-react';
import { dataService, Dealer } from '../../services/dataService';
import { formatNumber } from '../../utils';
import { Modal } from '../ui/Modal';
import { Toast, ToastMessage } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { CustomDropdown } from '../ui/CustomDropdown';
import { StatusPillDropdown } from '../ui/StatusPillDropdown';
import { useAuth } from '../../context/AuthContext';

export default function DealerManagement() {
  const { user } = useAuth();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cityFilter, setCityFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // New Dealer Form State
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newType, setNewType] = useState<'Wholesale' | 'Retail' | 'Distributor'>('Wholesale');
  const [newLocation, setNewLocation] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newStatus, setNewStatus] = useState<'Active' | 'Pending'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDealers = () => {
    fetch('/api/sitesync/dealers')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data) && j.data.length > 0) {
          setDealers(j.data);
        } else {
          setDealers(dataService.getDealers());
        }
      })
      .catch(() => {
        setDealers(dataService.getDealers());
      });
  };

  useEffect(() => {
    loadDealers();
    const unsubscribe = dataService.subscribe(() => {
      loadDealers();
    });
    return unsubscribe;
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    dealers.forEach((d) => {
      if (d.location) {
        const cityPart = d.location.split(',')[0].trim();
        if (cityPart) set.add(cityPart);
      }
    });
    return Array.from(set);
  }, [dealers]);

  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContact = newContact.replace(/\D/g, '').slice(-10);
    if (!newShopName.trim() || !cleanContact || cleanContact.length !== 10) {
      setToast({ id: String(Date.now()), type: 'error', message: 'Firm Name and a valid 10-digit mobile number are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const distId = user?.rawId || user?.distributorId || null;
      const resp = await fetch('/api/sitesync/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: newShopName.trim(),
          ownerName: newOwnerName.trim() || 'Authorized Partner',
          type: newType,
          location: newLocation.trim() || 'Regional Center',
          contact: cleanContact,
          status: newStatus,
          distributorId: distId,
          password: 'Dealer@123',
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to create dealer in database.');
      }

      dataService.createDealer({
        shopName: newShopName.trim(),
        ownerName: newOwnerName.trim() || 'Authorized Partner',
        type: newType,
        location: newLocation.trim() || 'Regional Center',
        contact: `+91 ${cleanContact}`,
        status: newStatus,
      });

      setIsAddModalOpen(false);
      setNewShopName('');
      setNewOwnerName('');
      setNewLocation('');
      setNewContact('');
      loadDealers();

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Dealer ${newShopName} registered in database! Login Mobile: ${cleanContact}, Password: Dealer@123`,
      });
    } catch (err: any) {
      console.error('Error creating dealer:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to register dealer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDealerStatus = async (id: string, nextStatus: Dealer['status']) => {
    // Optimistic local update
    setDealers((prev) =>
      prev.map((d) => (d.id === id || (d as any).rawId === id ? { ...d, status: nextStatus } : d))
    );
    dataService.updateDealerStatus(id, nextStatus);

    try {
      const dealer = dealers.find((d) => d.id === id || (d as any).rawId === id);
      const targetId = (dealer as any)?.rawId || (dealer as any)?.mobileNumber || id;
      await fetch(`/api/sitesync/dealers/${encodeURIComponent(targetId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Dealer status updated to ${nextStatus}.`,
      });
    } catch (err: any) {
      console.error('Error updating dealer status:', err);
    }
  };

  const handleDeleteDealer = async (id: string, name: string) => {
    try {
      const dealer = dealers.find((d) => d.id === id || (d as any).rawId === id);
      const targetId = (dealer as any)?.rawId || (dealer as any)?.mobileNumber || id;
      const resp = await fetch(`/api/sitesync/dealers/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete dealer from database.');
      }

      dataService.deleteDealer(id);
      setDealers((prev) => prev.filter((d) => d.id !== id && (d as any).rawId !== id));
      loadDealers();
      setToast({
        id: String(Date.now()),
        type: 'success',
        message: `Dealer ${name} permanently removed from live database.`,
      });
    } catch (err: any) {
      console.error('Error deleting dealer:', err);
      setToast({
        id: String(Date.now()),
        type: 'error',
        message: err.message || 'Failed to delete dealer.',
      });
    }
  };

  const filteredDealers = dealers.filter((d) => {
    const matchesSearch =
      d.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchesCity = cityFilter === 'All' || d.location.toLowerCase().includes(cityFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesCity;
  });

  const activeDealersCount = dealers.filter((d) => d.status === 'Active').length;
  const wholesaleCount = dealers.filter((d) => d.type === 'Wholesale').length;
  const retailCount = dealers.filter((d) => d.type === 'Retail').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dealer Directory</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and monitor authorized wholesale dealers and stockists across your network.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-md cursor-pointer"
          >
            <Plus size={16} />
            <span>Add New Dealer</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL NETWORK</p>
          <p className="text-2xl font-black text-slate-900">{dealers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Enrolled Partners</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">ACTIVE PARTNERS</p>
          <p className="text-2xl font-black text-emerald-700">{activeDealersCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Verified & Ordering</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">WHOLESALE MERCHANTS</p>
          <p className="text-2xl font-black text-orange-700">{wholesaleCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Bulk Yards & Distributors</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">RETAIL COUNTERS</p>
          <p className="text-2xl font-black text-blue-700">{retailCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Storefront Shops</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search dealers by name, ID, owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto ml-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status:</label>
              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'All', label: 'All' },
                  { value: 'Active', label: 'Active', dotColor: 'bg-emerald-500' },
                  { value: 'Pending', label: 'Pending', dotColor: 'bg-amber-500' },
                  { value: 'Inactive', label: 'Inactive', dotColor: 'bg-rose-500' },
                ]}
                buttonClassName="w-32"
              />
            </div>

            {cities.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">City:</label>
                <CustomDropdown
                  value={cityFilter}
                  onChange={setCityFilter}
                  options={['All Cities', ...cities].map((c) => ({
                    value: c === 'All Cities' ? 'All' : c,
                    label: c,
                  }))}
                  buttonClassName="w-36"
                />
              </div>
            )}
          </div>
        </div>

        {/* Table / Empty State */}
        {dealers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Store}
              title="No Dealers in Directory"
              description="Onboard regional dealers and stockists to initiate supply chains and secondary sales tracking."
              actionLabel="Add First Dealer"
              onAction={() => setIsAddModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                  <th className="px-4 lg:px-5 py-3.5">Dealer ID</th>
                  <th className="px-4 lg:px-5 py-3.5">Shop / Firm Name</th>
                  <th className="px-4 lg:px-5 py-3.5">Owner / Contact</th>
                  <th className="px-4 lg:px-5 py-3.5">Type</th>
                  <th className="px-4 lg:px-5 py-3.5">Location</th>
                  <th className="px-4 lg:px-5 py-3.5 text-right">Orders</th>
                  <th className="px-4 lg:px-5 py-3.5">Status</th>
                  <th className="px-4 lg:px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDealers.map((dealer) => {
                  const initial = (dealer.shopName[0] || 'D').toUpperCase();
                  return (
                    <tr key={dealer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                          {dealer.id}
                        </span>
                      </td>
                      <td className="px-4 lg:px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{dealer.shopName}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">Joined {dealer.joinedDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800">{dealer.ownerName}</p>
                        <a href={`tel:${dealer.contact}`} className="text-xs text-slate-500 font-mono hover:text-orange-600 transition-colors">
                          {dealer.contact}
                        </a>
                      </td>
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${dealer.type === 'Wholesale' ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                          {dealer.type}
                        </span>
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{dealer.location}</td>
                      <td className="px-4 lg:px-5 py-4 text-sm font-extrabold text-slate-800 text-right whitespace-nowrap">
                        {formatNumber(dealer.orders)}
                      </td>
                      <td className="px-4 lg:px-5 py-4 whitespace-nowrap">
                        <StatusPillDropdown
                          status={dealer.status}
                          onChange={(newStatus) => handleUpdateDealerStatus(dealer.id, newStatus as Dealer['status'])}
                        />
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteDealer(dealer.id, dealer.shopName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete dealer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {dealers.length > 0 && (
          <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center bg-slate-50/50">
            <span>
              Showing {filteredDealers.length} of {dealers.length} dealer records
            </span>
          </div>
        )}
      </div>

      {/* Add Dealer Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Authorized Dealer" maxWidth="md">
        <form onSubmit={handleCreateDealer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Shop / Firm Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Hardware Supplies"
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Proprietor / Owner Name
            </label>
            <input
              type="text"
              placeholder="e.g. Surendra Sharma"
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contact Phone *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 98256 30003"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dealer Category
              </label>
              <CustomDropdown
                value={newType}
                onChange={(val) => setNewType(val as any)}
                options={[
                  { value: 'Wholesale', label: 'Wholesale' },
                  { value: 'Retail', label: 'Retail' },
                  { value: 'Distributor', label: 'Distributor Hub' },
                ]}
                className="w-full"
                buttonClassName="w-full py-2.5"
                menuClassName="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Location / City & State
              </label>
              <input
                type="text"
                placeholder="e.g. Phase II, New Delhi"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
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
                  { value: 'Pending', label: 'Pending Approval', dotColor: 'bg-amber-500' },
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
              {isSubmitting ? 'Registering…' : 'Register Dealer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
