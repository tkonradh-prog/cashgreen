'use client';

import React, { useId } from 'react';

interface CashFlowLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CashFlowLogoProps['size']>, string> = {
  xs: 'w-6 h-6',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

/**
 * Bespoke CashFlow obsidian emblem with kinetic dual capital-flow wave ribbons.
 * Uses unique gradient IDs per instance so hidden responsive mounts never break SVG defs.
 */
export function CashFlowLogo({ size = 'md', className = '' }: CashFlowLogoProps) {
  const rawId = useId().replace(/:/g, '');
  const bgId = `cf-bg-${rawId}`;
  const borderId = `cf-border-${rawId}`;
  const topId = `cf-top-${rawId}`;
  const bottomId = `cf-bottom-${rawId}`;

  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${SIZE_CLASSES[size]} shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E2433" />
          <stop offset="55%" stopColor="#0E1118" />
          <stop offset="100%" stopColor="#050608" />
        </linearGradient>
        <linearGradient id={borderId} x1="18" y1="1" x2="18" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={topId} x1="8" y1="19" x2="28" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id={bottomId} x1="8" y1="25" x2="27" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="34" height="34" rx="10" fill={`url(#${bgId})`} />
      <rect x="1" y="1" width="34" height="34" rx="10" stroke={`url(#${borderId})`} strokeWidth="1.2" />
      <path
        d="M8.5 24.5C12.8 24.5 14.5 18.2 19.2 18.2C22.4 18.2 24 20 27.5 16.5"
        stroke={`url(#${bottomId})`}
        strokeWidth="2.9"
        strokeLinecap="round"
      />
      <path
        d="M8.5 18.2C13 18.2 15 11.2 20 11.2C23.2 11.2 24.8 13.4 27.5 10.5"
        stroke={`url(#${topId})`}
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="27.5" cy="10.5" r="2" fill="#FFFFFF" />
    </svg>
  );
}
