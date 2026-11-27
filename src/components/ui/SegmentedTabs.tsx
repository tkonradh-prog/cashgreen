'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SegmentedTabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  variant?: 'white' | 'surface' | 'coral-aware' | 'mint';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'white',
  size = 'md',
  fullWidth = false,
  className = '',
}: SegmentedTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const activeIndex = items.findIndex((i) => i.value === value);

  const measurePill = useCallback(() => {
    const activeBtn = btnRefs.current[activeIndex];
    if (!activeBtn) return;
    setPill({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
      ready: true,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, items.length]);

  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => measurePill());
    obs.observe(listEl);
    return () => obs.disconnect();
  }, [measurePill]);

  const indicatorSurface =
    variant === 'surface'
      ? 'bg-white/[0.14] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
      : 'bg-white/95 shadow-[0_3px_14px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]';

  return (
    <div
      ref={listRef}
      role="tablist"
      className={`relative inline-flex items-center p-1 rounded-2xl ios-glass-inset gap-1 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {/* Animated Sliding iOS Pill */}
      {pill.ready && (
        <span
          aria-hidden="true"
          className={`absolute top-1 bottom-1 left-0 rounded-xl pointer-events-none ios-spring-glide ${indicatorSurface}`}
          style={{
            width: `${pill.width}px`,
            transform: `translateX(${pill.left}px)`,
          }}
        />
      )}

      {items.map((item, idx) => {
        const active = item.value === value;
        const sizeClasses =
          size === 'sm'
            ? 'px-3 py-1.5 text-xs'
            : size === 'lg'
              ? 'px-4 py-2.5 text-sm font-semibold'
              : 'px-3.5 py-2 text-xs sm:text-sm';

        const activeTextClass = variant === 'surface' ? 'text-white font-semibold' : 'text-black font-bold';
        const ssrFallbackBg = !pill.ready && active ? indicatorSurface : '';

        return (
          <button
            key={item.value}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl transition-colors duration-200 active:scale-[0.96] cursor-pointer whitespace-nowrap ${
              fullWidth ? 'flex-1' : ''
            } ${sizeClasses} ${ssrFallbackBg} ${
              active
                ? activeTextClass
                : 'text-neutral-300/80 hover:text-white'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold transition-colors ${
                  active && variant !== 'surface'
                    ? 'bg-black/15 text-black'
                    : 'bg-[#181d28] text-neutral-400'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
