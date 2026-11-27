'use client';

import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function ModalDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'sm:max-w-lg',
}: ModalDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  const titleId = useId();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }

  useEffect(() => {
    if (!open && mounted) {
      const timer = setTimeout(() => setMounted(false), 210);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  const isClosing = !open;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/82 backdrop-blur-lg sm:p-4 ${
        isClosing ? 'animate-backdrop-out pointer-events-none' : 'animate-backdrop-in'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl ios-glass-sheet overflow-hidden pb-safe sm:pb-0 ${
          isClosing ? 'animate-sheet-out' : 'animate-sheet-in'
        }`}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>

        <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4 border-b border-white/[0.09]">
          <div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-white tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-neutral-300/80 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Zamknij okno"
            onClick={onClose}
            className="p-2 rounded-full ios-glass-pill text-neutral-300 hover:text-white active:scale-90 transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
