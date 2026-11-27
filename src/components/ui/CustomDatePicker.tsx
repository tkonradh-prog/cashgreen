'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  POLISH_MONTHS_FULL,
  POLISH_WEEKDAYS_SHORT,
  addDays,
  formatDateShort,
} from '@/lib/format';

interface CustomDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  todayStr: string;
  onChange: (nextDate: string) => void;
  className?: string;
}

export function CustomDatePicker({
  label = 'Data operacji',
  value,
  todayStr,
  onChange,
  className = '',
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewYm, setViewYm] = useState(() => value.slice(0, 7));
  const rootRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !mobileSheetRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const yesterdayStr = useMemo(() => addDays(todayStr, -1), [todayStr]);
  const twoDaysAgoStr = useMemo(() => addDays(todayStr, -2), [todayStr]);

  const calendarDays = useMemo(() => {
    const [yr, mo] = viewYm.split('-').map(Number);
    const firstDay = new Date(Date.UTC(yr, mo - 1, 1));
    const daysInMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const startOffset = (firstDay.getUTCDay() + 6) % 7;

    const cells: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
      });
    }
    return cells;
  }, [viewYm]);

  const shiftMonth = (delta: number) => {
    const [yr, mo] = viewYm.split('-').map(Number);
    const dt = new Date(Date.UTC(yr, mo - 1 + delta, 1));
    setViewYm(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    );
  };

  const [viewYear, viewMonthNum] = viewYm.split('-').map(Number);

  const renderCalendar = () => (
    <div className="p-3.5">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="p-1.5 rounded-xl bg-[#181d28] hover:bg-[#222938] text-neutral-300 hover:text-white cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-white">
          {POLISH_MONTHS_FULL[viewMonthNum - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="p-1.5 rounded-xl bg-[#181d28] hover:bg-[#222938] text-neutral-300 hover:text-white cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
        {POLISH_WEEKDAYS_SHORT.map((wd) => (
          <div key={wd} className="text-[11px] font-semibold text-neutral-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const isSelected = cell.dateStr === value;
          const isToday = cell.dateStr === todayStr;
          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => {
                onChange(cell.dateStr);
                setOpen(false);
              }}
              className={`h-9 rounded-xl text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white text-black font-extrabold shadow-[0_2px_12px_rgba(255,255,255,0.25)]'
                  : isToday
                    ? 'border border-white/40 text-white hover:bg-white/10'
                    : 'text-neutral-300 hover:bg-[#181d28]'
              }`}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs font-semibold tracking-wide text-neutral-400">{label}</span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() =>
            setOpen((o) => {
              if (!o) {
                setViewYm(value.slice(0, 7));
                const rect = triggerRef.current?.getBoundingClientRect();
                setOpenUpward(Boolean(rect && rect.bottom + 320 > window.innerHeight));
              }
              return !o;
            })
          }
          className={`flex items-center gap-2.5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border px-3.5 min-h-[44px] text-sm font-medium transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_2px_6px_rgba(0,0,0,0.45)] ${
            open
              ? 'border-white/45 ring-2 ring-white/10 bg-white/[0.075] text-white'
              : 'border-white/[0.1] hover:border-white/[0.2] text-white'
          }`}
        >
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="tabular-nums">
            {value === todayStr
              ? `Dziś · ${formatDateShort(value)}`
              : value === yesterdayStr
                ? `Wczoraj · ${formatDateShort(value)}`
                : formatDateShort(value)}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {[
            { label: 'Dziś', val: todayStr },
            { label: 'Wczoraj', val: yesterdayStr },
            { label: 'Przedwczoraj', val: twoDaysAgoStr },
          ].map((preset) => {
            const active = value === preset.val;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange(preset.val);
                  setOpen(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  active
                    ? 'bg-white/95 text-black border border-white shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                    : 'ios-glass-pill text-neutral-300 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <>
          <div
            className={`hidden sm:block absolute left-0 z-50 w-76 rounded-2xl ios-glass-sheet animate-fade-in ${
              openUpward ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
            }`}
          >
            {renderCalendar()}
          </div>

          {typeof document !== 'undefined' &&
            createPortal(
              <div
                onClick={() => setOpen(false)}
                className="sm:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md animate-backdrop-in"
              >
                <div
                  ref={mobileSheetRef}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-t-3xl ios-glass-sheet pb-safe animate-sheet-in"
                >
                  <div className="flex justify-center pt-2.5 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/25" />
                  </div>
                  <div className="flex items-center justify-between px-5 pt-2 pb-2.5 border-b border-white/[0.09]">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-full ios-glass-pill text-neutral-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {renderCalendar()}
                </div>
              </div>,
              document.body
            )}
        </>
      )}
    </div>
  );
}
