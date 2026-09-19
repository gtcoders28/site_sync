import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type StatusType = 'Active' | 'Pending' | 'Inactive' | string;

export interface StatusPillConfig {
  value: StatusType;
  label: string;
  dotColor: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  hoverBg: string;
}

const DEFAULT_CONFIGS: Record<string, StatusPillConfig> = {
  Active: {
    value: 'Active',
    label: 'Active',
    dotColor: 'bg-emerald-500',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-700',
    pillBorder: 'border-emerald-200/90',
    hoverBg: 'hover:bg-emerald-100/80',
  },
  Pending: {
    value: 'Pending',
    label: 'Pending',
    dotColor: 'bg-amber-500',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-700',
    pillBorder: 'border-amber-200/90',
    hoverBg: 'hover:bg-amber-100/80',
  },
  Inactive: {
    value: 'Inactive',
    label: 'Inactive',
    dotColor: 'bg-rose-500',
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200/90',
    hoverBg: 'hover:bg-rose-100/80',
  },
};

interface StatusPillDropdownProps {
  status: StatusType;
  onChange: (status: any) => void;
  disabled?: boolean;
  options?: StatusType[];
  className?: string;
  title?: string;
}

export function StatusPillDropdown({
  status,
  onChange,
  disabled = false,
  options = ['Active', 'Pending', 'Inactive'],
  className = '',
  title = 'Click to update partner status',
}: StatusPillDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentConfig = DEFAULT_CONFIGS[status] || {
    value: status,
    label: status,
    dotColor: 'bg-slate-500',
    pillBg: 'bg-slate-50',
    pillText: 'text-slate-700',
    pillBorder: 'border-slate-200',
    hoverBg: 'hover:bg-slate-100',
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        title={title}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${currentConfig.pillBg} ${currentConfig.pillText} ${currentConfig.pillBorder} ${currentConfig.hoverBg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentConfig.dotColor}`} />
        <span>{currentConfig.label}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180 opacity-100' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 min-w-[130px] bg-white rounded-xl border border-slate-200/90 shadow-xl py-1 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-0.5">
            Set Status
          </div>
          {options.map((opt) => {
            const config = DEFAULT_CONFIGS[opt] || {
              value: opt,
              label: opt,
              dotColor: 'bg-slate-500',
              pillBg: '',
              pillText: '',
              pillBorder: '',
              hoverBg: '',
            };
            const isSelected = opt === status;

            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-50 text-slate-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`} />
                  <span>{config.label}</span>
                </div>
                {isSelected && <Check size={13} className="text-orange-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
