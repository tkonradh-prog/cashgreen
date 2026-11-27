'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const [desktopRect, setDesktopRect] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    minWidth: number;
  }>({ left: 0, minWidth: 200 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const updateDesktopRect = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') return;
    const minWidth = Math.max(rect.width, 230);
    const maxWidth = Math.min(340, window.innerWidth - 24);
    const width = Math.min(minWidth, maxWidth);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const openUpward = rect.bottom + 280 > window.innerHeight && rect.top > 280;
    if (openUpward) {
      setDesktopRect({
        left,
        bottom: window.innerHeight - rect.top + 6,
        minWidth: rect.width,
      });
    } else {
      setDesktopRect({
        left,
        top: rect.bottom + 6,
        minWidth: rect.width,
      });
    }
  }, []);

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
    updateDesktopRect();

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !desktopMenuRef.current?.contains(target) &&
        !mobileSheetRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onReposition = () => updateDesktopRect();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    if (shouldShowSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, shouldShowSearch, updateDesktopRect]);

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
    <div ref={containerRef} className={`min-w-0 relative flex flex-col gap-1.5 ${className}`}>
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
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) closeMenu();
          else {
            setQuery('');
            updateDesktopRect();
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

      {/* Desktop floating glass dropdown portaled to body */}
      {open && typeof document !== 'undefined' && (
        <>
          {createPortal(
            <div
              ref={desktopMenuRef}
              style={{
                left: `${desktopRect.left}px`,
                top: desktopRect.top !== undefined ? `${desktopRect.top}px` : undefined,
                bottom: desktopRect.bottom !== undefined ? `${desktopRect.bottom}px` : undefined,
                minWidth: `${Math.max(desktopRect.minWidth, 230)}px`,
                maxWidth: 'min(340px, calc(100vw - 24px))',
              }}
              className="hidden sm:block fixed z-[80] rounded-2xl ios-glass-sheet overflow-hidden animate-fade-in"
            >
              {renderOptionsList()}
            </div>,
            document.body
          )}

          {/* Mobile bottom iOS glass sheet drawer portaled to body */}
          {createPortal(
            <div
              onClick={closeMenu}
              className="sm:hidden fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-md animate-backdrop-in"
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
                    aria-label="Zamknij listę"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeMenu();
                    }}
                    className="p-2 rounded-full ios-glass-pill text-neutral-300 hover:text-white active:scale-90 transition-all cursor-pointer"
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
