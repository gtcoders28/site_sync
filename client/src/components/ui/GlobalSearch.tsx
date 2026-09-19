import React, { useState, useRef, useEffect } from 'react';
import { Search, Package, Users, Award, X } from 'lucide-react';
import { dataService, Order, Distributor, Reward } from '../../services/dataService';
import { formatINR } from '../../utils';

interface GlobalSearchProps {
  onSelectTab?: (tabId: string) => void;
  className?: string;
}

export function GlobalSearch({ onSelectTab, className = '' }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<{
    orders: Order[];
    distributors: Distributor[];
    rewards: Reward[];
  }>({ orders: [], distributors: [], rewards: [] });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ orders: [], distributors: [], rewards: [] });
      return;
    }
    const res = dataService.search(query);
    setResults(res);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults =
    results.orders.length > 0 ||
    results.distributors.length > 0 ||
    results.rewards.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search
          className="absolute left-3.5 text-slate-400 pointer-events-none"
          size={16}
          strokeWidth={2}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search orders, dealers or rewards..."
          className="w-full sm:w-80 md:w-96 pl-10 pr-9 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 text-sm rounded-xl border border-slate-200/80 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 focus:outline-none transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xl z-50 max-h-96 overflow-y-auto p-2 divide-y divide-slate-100">
          {!hasResults ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No matching records found for "{query}"
            </div>
          ) : (
            <>
              {results.orders.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Package size={13} />
                    Orders ({results.orders.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.orders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        onClick={() => {
                          setIsOpen(false);
                          setQuery('');
                          onSelectTab?.('orders');
                        }}
                        className="px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {order.id} • {order.product}
                          </p>
                          <p className="text-xs text-slate-500">{order.dealer}</p>
                        </div>
                        <span className="text-xs font-bold text-slate-900">
                          {formatINR(order.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.distributors.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Users size={13} />
                    Distributors ({results.distributors.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.distributors.slice(0, 3).map((dist) => (
                      <div
                        key={dist.id}
                        onClick={() => {
                          setIsOpen(false);
                          setQuery('');
                          onSelectTab?.('distributor');
                        }}
                        className="px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{dist.name}</p>
                          <p className="text-xs text-slate-500">{dist.contact}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {dist.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.rewards.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Award size={13} />
                    Rewards ({results.rewards.length})
                  </div>
                  <div className="space-y-1 mt-1">
                    {results.rewards.slice(0, 3).map((rew) => (
                      <div
                        key={rew.id}
                        onClick={() => {
                          setIsOpen(false);
                          setQuery('');
                          onSelectTab?.('rewards');
                        }}
                        className="px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{rew.title}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">
                            {rew.description}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                          {rew.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
