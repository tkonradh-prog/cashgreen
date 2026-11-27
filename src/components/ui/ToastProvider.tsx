'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, RotateCcw, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  tone?: 'mint' | 'coral' | 'info';
  onUndo?: () => void;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl ios-glass-sheet px-4 py-3 animate-sheet-in"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {t.tone === 'info' ? (
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              ) : t.tone === 'coral' ? (
                <CheckCircle2 className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">
                  {t.message}
                </div>
                {t.detail && (
                  <div className="text-[11px] text-neutral-400 truncate">{t.detail}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {t.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    t.onUndo?.();
                    removeToast(t.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Cofnij
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
