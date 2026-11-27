'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  badgeText?: string;
  badgeColor?: string;
  dotColor?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps<T extends string = string> {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  error?: string;
  className?: string;
  compact?: boolean;
}

export function CustomSelect<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Wybierz opcję...',
  searchable,
  searchPlaceholder = 'Filtruj opcje...',
  error,
  className = '',
  compact = false,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const shouldShowSearch = searchable ?? options.length > 6;

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.badgeText && o.badgeText.toLowerCase().includes(q))
    );
  }, [options, query]);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !mobileSheetRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    if (shouldShowSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, shouldShowSearch]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setQuery('');
        setOpen(true);
        const curIdx = filtered.findIndex((o) => o.value === value);
        setActiveIdx(curIdx >= 0 ? curIdx : 0);
      } else if (e.key === 'ArrowDown') {
        setActiveIdx((prev) => Math.min(filtered.length - 1, prev + 1));
      } else if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) {
        const opt = filtered[activeIdx];
        if (!opt.disabled) {
          onChange(opt.value);
          closeMenu();
        }
      }
    } else if (open && e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const renderOptionsList = () => (
    <>
      {shouldShowSearch && (
        <div className="p-2 border-b border-[#1c2230]">
          <div className="flex items-center gap-2 rounded-xl bg-[#090b0f] border border-[#202738] px-2.5 py-1.5 focus-within:border-white/50">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-base sm:text-xs text-white placeholder:text-neutral-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-neutral-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
        {filtered.length === 0 ? (
          <div className="py-6 px-3 text-center text-xs text-neutral-500">
            Brak pasujących pozycji
          </div>
        ) : (
          filtered.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === activeIdx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  closeMenu();
                }}
                className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-white/10 text-white font-medium border border-white/20'
                    : isHighlighted
                      ? 'bg-[#181d28] text-white border border-transparent'
                      : 'text-neutral-300 hover:bg-[#151922] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.dotColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/40"
                      style={{ backgroundColor: opt.dotColor }}
                    />
                  )}
                  {opt.icon && <span className="shrink-0 text-neutral-400">{opt.icon}</span>}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-neutral-400 truncate">{opt.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {opt.badgeText && (
                    <span
                      className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-[#0a0c10] border border-[#222938]"
                      style={opt.badgeColor ? { color: opt.badgeColor } : undefined}
                    >
                      {opt.badgeText}
                    </span>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold tracking-wide text-neutral-400 flex items-center justify-between"
        >
          <span>{label}</span>
          {error && <span className="text-[#f87171] font-normal">{error}</span>}
        </label>
      )}

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) closeMenu();
          else {
            setQuery('');
            setOpen(true);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between gap-2.5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border text-left transition-all duration-150 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_2px_6px_rgba(0,0,0,0.45)] ${
          compact ? 'px-3 min-h-[40px] py-2' : 'px-3.5 min-h-[46px] py-2.5'
        } ${
          error
            ? 'border-[#ef4444]/80 ring-2 ring-[#ef4444]/20'
            : open
              ? 'border-white/45 ring-2 ring-white/10 bg-white/[0.075]'
              : 'border-white/[0.1] hover:border-white/[0.2]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selected?.dotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selected.dotColor }}
            />
          )}
          {selected?.icon && <span className="shrink-0 text-neutral-400">{selected.icon}</span>}
          <span
            className={`truncate ${compact ? 'text-xs sm:text-sm' : 'text-sm'} font-medium ${
              selected ? 'text-white' : 'text-neutral-500'
            }`}
          >
            {selected ? selected.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selected?.badgeText && (
            <span
              className="text-xs font-semibold tabular-nums text-neutral-300 hidden sm:inline-block"
              style={selected.badgeColor ? { color: selected.badgeColor } : undefined}
            >
              {selected.badgeText}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform duration-150 ${
              open ? 'rotate-180 text-white' : ''
            }`}
          />
        </div>
      </button>

      {/* Desktop floating glass dropdown */}
      {open && (
        <>
          <div className="hidden sm:block absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl ios-glass-sheet overflow-hidden animate-fade-in">
            {renderOptionsList()}
          </div>

          {/* Mobile bottom iOS glass sheet drawer portaled to body */}
          {typeof document !== 'undefined' &&
            createPortal(
              <div
                onClick={closeMenu}
                className="sm:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md animate-backdrop-in"
              >
                <div
                  ref={mobileSheetRef}
                  className="w-full rounded-t-3xl ios-glass-sheet pb-safe animate-sheet-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-center pt-2.5 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/25" />
                  </div>
                  <div className="flex items-center justify-between px-5 pt-2 pb-2.5 border-b border-white/[0.09]">
                    <span className="text-sm font-semibold text-white">
                      {label ?? placeholder}
                    </span>
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="p-1.5 rounded-full ios-glass-pill text-neutral-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-2">{renderOptionsList()}</div>
                </div>
              </div>,
              document.body
            )}
        </>
      )}
    </div>
  );
}
