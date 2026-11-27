'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatPLN } from '@/lib/format';

/**
 * Smoothly animates PLN currency amounts with an iOS-style ease-out roll
 * whenever `valueGrosze` changes, with zero hydration mismatch.
 */
export function AnimatedPLN({
  valueGrosze,
  showSign = false,
  compactZeroDecimals = false,
  durationMs = 420,
}: {
  valueGrosze: number;
  showSign?: boolean;
  compactZeroDecimals?: boolean;
  durationMs?: number;
}) {
  const [displayGrosze, setDisplayGrosze] = useState(valueGrosze);
  const currentRef = useRef(valueGrosze);

  useEffect(() => {
    const startVal = currentRef.current;
    const endVal = valueGrosze;
    if (startVal === endVal) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || durationMs <= 0) {
      currentRef.current = endVal;
      const id = requestAnimationFrame(() => setDisplayGrosze(endVal));
      return () => cancelAnimationFrame(id);
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out matching Apple deceleration curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const interpolated = Math.round(startVal + (endVal - startVal) * eased);
      currentRef.current = interpolated;
      setDisplayGrosze(interpolated);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        currentRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [valueGrosze, durationMs]);

  return <>{formatPLN(displayGrosze, { showSign, compactZeroDecimals })}</>;
}
