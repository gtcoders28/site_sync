import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentConfig = DEFAULT_CONFIGS[status] || {
    value: status,
    label: status,
    dotColor: 'bg-slate-500',
    pillBg: 'bg-slate-50',
    pillText: 'text-slate-700',
    pillBorder: 'border-slate-200',
    hoverBg: 'hover:bg-slate-100',
  };

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = 120;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 15 && rect.top > menuHeight + 15;

    const top = openUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 145));

    setCoords({ top, left, openUp });
  }, []);

  const toggleDropdown = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    function handleScrollOrResize() {
      if (!buttonRef.current) {
        setIsOpen(false);
        return;
      }
      const rect = buttonRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
      } else {
        updatePosition();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
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

      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
            }}
            className={`min-w-[130px] bg-white rounded-xl border border-slate-200/90 shadow-2xl py-1 text-xs font-semibold animate-in fade-in duration-150 ${
              coords.openUp ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
            }`}
          >
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
          </div>,
          document.body
        )}
    </div>
  );
}
