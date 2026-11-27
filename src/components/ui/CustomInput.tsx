'use client';

import React, { useId } from 'react';
import { Search, X } from 'lucide-react';
import { groszeToInputString, parsePLNInput } from '@/lib/format';

interface CustomInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightBadge?: React.ReactNode;
  onClear?: () => void;
  containerClassName?: string;
}

export function CustomInput({
  label,
  helperText,
  error,
  leftIcon,
  rightBadge,
  onClear,
  value,
  className = '',
  containerClassName = '',
  id: providedId,
  ...rest
}: CustomInputProps) {
  const autoId = useId();
  const id = providedId ?? autoId;
  const hasValue = value !== undefined && value !== null && String(value).length > 0;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold tracking-wide text-neutral-400 flex items-center justify-between"
        >
          <span>{label}</span>
          {error && <span className="text-[#f87171] font-normal">{error}</span>}
        </label>
      )}

      <div
        className={`group relative flex items-center gap-2.5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border transition-all duration-150 px-3.5 min-h-[46px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_2px_6px_rgba(0,0,0,0.45)] ${
          error
            ? 'border-[#ef4444]/70 ring-2 ring-[#ef4444]/15'
            : 'border-white/[0.1] hover:border-white/[0.2] focus-within:border-white/45 focus-within:ring-2 focus-within:ring-white/10 focus-within:bg-white/[0.07]'
        }`}
      >
        {leftIcon && (
          <span className="text-neutral-500 group-focus-within:text-white transition-colors shrink-0">
            {leftIcon}
          </span>
        )}

        <input
          id={id}
          value={value}
          className={`w-full bg-transparent text-base sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none py-2.5 ${className}`}
          {...rest}
        />

        {onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Wyczyść pole"
            className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {rightBadge && (
          <span className="text-xs font-semibold text-neutral-400 bg-[#161a24] border border-[#262c3d] px-2 py-0.5 rounded-md shrink-0">
            {rightBadge}
          </span>
        )}
      </div>

      {helperText && !error && <p className="text-[11px] text-neutral-500">{helperText}</p>}
    </div>
  );
}

interface AmountInputProps {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  accent?: 'mint' | 'coral' | 'neutral';
  quickAmountsZloty?: number[];
  previewNode?: React.ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
}

export function AmountInput({
  label = 'Kwota',
  value,
  onChange,
  error,
  accent = 'neutral',
  quickAmountsZloty = [10, 20, 50, 100, 200],
  previewNode,
  placeholder = '0,00',
  autoFocus = false,
}: AmountInputProps) {
  const id = useId();

  const handleSanitizedChange = (raw: string) => {
    const normalized = raw.replace(/\./g, ',').replace(/[^\d,\s]/g, '');
    const parts = normalized.split(',');
    const sanitized =
      parts.length > 1 ? `${parts[0]},${parts.slice(1).join('').slice(0, 2)}` : normalized;
    onChange(sanitized);
  };

  const addQuick = (zl: number) => {
    const currentGrosze = parsePLNInput(value, { allowZero: true }) ?? 0;
    const nextGrosze = currentGrosze + zl * 100;
    onChange(groszeToInputString(nextGrosze));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-neutral-400">
          {label}
        </label>
        {error && <span className="text-xs text-[#f87171] font-medium">{error}</span>}
      </div>

      <div
        className={`relative flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] backdrop-blur-xl border transition-all duration-150 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_2px_8px_rgba(0,0,0,0.45)] ${
          error
            ? 'border-[#ef4444]/80 ring-2 ring-[#ef4444]/20'
            : accent === 'coral'
              ? 'border-white/[0.11] hover:border-white/[0.22] focus-within:border-[#f87171]/60 focus-within:ring-2 focus-within:ring-[#f87171]/15 focus-within:bg-white/[0.07]'
              : 'border-white/[0.11] hover:border-white/[0.22] focus-within:border-white/45 focus-within:ring-2 focus-within:ring-white/10 focus-within:bg-white/[0.07]'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => handleSanitizedChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-white placeholder:text-white/20 focus:outline-none"
        />

        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Wyzeruj kwotę"
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-bold tracking-wider px-2.5 py-1.5 rounded-xl ios-glass-pill text-white">
            PLN
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {quickAmountsZloty.map((zl) => (
          <button
            key={zl}
            type="button"
            onClick={() => addQuick(zl)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold tabular-nums ios-glass-pill active:scale-95 text-neutral-200 hover:text-white transition-all cursor-pointer"
          >
            +{zl} zł
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-[#f87171] hover:bg-white/5 transition-colors cursor-pointer ml-auto"
          >
            Wyczyść
          </button>
        )}
      </div>

      {previewNode}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Szukaj operacji, kwoty lub notatki...',
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <CustomInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClear={() => onChange('')}
      placeholder={placeholder}
      leftIcon={<Search className="w-4 h-4" />}
      containerClassName={className}
    />
  );
}
