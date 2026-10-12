import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export const INDIAN_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  inputClassName = '',
  required = false,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Normalize options to { value, label }
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  }, [options]);

  // Keep search term synced with value when closed
  useEffect(() => {
    if (!isOpen) {
      const match = normalizedOptions.find(
        (o) => o.value.toLowerCase() === (value || '').toLowerCase()
      );
      setSearchTerm(match ? match.label : value || '');
    }
  }, [value, isOpen, normalizedOptions]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim() || !isOpen) return normalizedOptions;
    const query = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query)
    );
  }, [normalizedOptions, searchTerm, isOpen]);

  const updatePosition = () => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 245;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    const calculatedWidth = Math.max(rect.width, 220);
    const calculatedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - calculatedWidth - 8));

    const nextCoords = {
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: calculatedLeft,
      width: calculatedWidth,
      openUp,
    };
    setCoords(nextCoords);
    return nextCoords;
  };

  const openMenu = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    updatePosition();
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
        setCoords(null);
        // If current search term matches an option, keep it, otherwise revert or keep
        const match = normalizedOptions.find(
          (o) => o.label.toLowerCase() === searchTerm.toLowerCase()
        );
        if (match) {
          onChange(match.value);
        } else if (!searchTerm.trim()) {
          onChange('');
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchTerm, normalizedOptions, onChange]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    setCoords(null);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        openMenu();
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setCoords(null);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          required={required && !value}
          disabled={disabled}
          value={searchTerm}
          onChange={(e) => {
            const nextVal = e.target.value;
            setSearchTerm(nextVal);
            onChange(nextVal);
            if (!isOpen) openMenu();
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            openMenu();
            setHighlightedIndex(-1);
          }}
          onClick={() => {
            if (!isOpen) openMenu();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all ${
            disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''
          } ${inputClassName}`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchTerm && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setSearchTerm('');
                onChange('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="Clear"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setCoords(null);
              } else {
                openMenu();
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            title="Toggle list"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-orange-500' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu via Portal to prevent clipping */}
      {isOpen &&
        !disabled &&
        coords &&
        coords.width > 0 &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              transform: coords.openUp ? 'translateY(-100%)' : 'none',
              zIndex: 9999,
            }}
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xl overflow-hidden py-1 max-h-60 flex flex-col animate-in fade-in duration-100"
          >
            <ul
              ref={listRef}
              role="listbox"
              className="overflow-y-auto custom-scrollbar flex-1 max-h-56 divide-y divide-slate-50"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3.5 py-3 text-xs text-slate-400 text-center font-medium">
                  No matching states found
                </li>
              ) : (
                filteredOptions.map((opt, index) => {
                  const isSelected =
                    opt.value.toLowerCase() === (value || '').toLowerCase() ||
                    opt.label.toLowerCase() === (value || '').toLowerCase();
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3.5 py-2 text-xs sm:text-sm font-medium cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-orange-50 text-orange-700 font-semibold'
                          : isHighlighted
                          ? 'bg-slate-100/80 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-orange-600 shrink-0 ml-2" />}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
