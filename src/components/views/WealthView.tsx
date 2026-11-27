'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { computeNetWorthHistory } from '@/lib/analytics';
import { formatCompactTys, formatPLN } from '@/lib/format';
import { Account } from '@/lib/types';
import { useFinance } from '../FinanceProvider';
import { AnimatedPLN } from '../ui/AnimatedPLN';
import { ACCOUNT_KIND_META, AccountKindIcon } from '../ui/IconMap';

export function WealthView({
  onAddAccount,
  onEditAccount,
  onOpenReconcile,
  onQuickAddForAccount,
}: {
  onAddAccount: () => void;
  onEditAccount: (acc: Account) => void;
  onOpenReconcile: (accountId: string) => void;
  onQuickAddForAccount: (accountId: string) => void;
}) {
  const { db, todayStr, accountsSummary } = useFinance();
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  const netWorthSeries = useMemo(
    () => computeNetWorthHistory(db, todayStr, 12),
    [db, todayStr]
  );

  const positiveTotal = Math.max(
    1,
    accountsSummary.accounts
      .filter((a) => a.currentBalanceGrosze > 0)
      .reduce((s, a) => s + a.currentBalanceGrosze, 0)
  );

  const firstMonthNw = netWorthSeries[0]?.netWorthGrosze ?? 0;
  const lastMonthNw = netWorthSeries[netWorthSeries.length - 1]?.netWorthGrosze ?? 0;
  const yearlyDelta = lastMonthNw - firstMonthNw;

  return (
    <div className="space-y-6">
      {/* Net Worth Hero + Breakdown Strip */}
      <section className="finte-card p-4 sm:p-7 space-y-5 animate-card-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Majątek i konta
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Pełny bilans Twoich finansów: gotówka, konta osobiste, oszczędności i inwestycje.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddAccount}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 active:scale-[0.97] text-black text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-[0_4px_18px_rgba(255,255,255,0.18)]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Dodaj konto / majątek
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Hero iOS Glass Net Worth Card */}
          <div className="relative overflow-hidden col-span-2 lg:col-span-1 rounded-2xl finte-card-elevated text-white p-4 sm:p-5 flex flex-col justify-between animate-card-in">
            <div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent pointer-events-none animate-sheen" />
            <div className="relative z-10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-300/80">
                Majątek netto
              </div>
              <div className="text-2xl sm:text-3xl font-black tabular-nums mt-1 text-white">
                <AnimatedPLN valueGrosze={accountsSummary.netWorthGrosze} />
              </div>
            </div>
            <div className="relative z-10 text-[11px] font-medium text-neutral-400 mt-2 tabular-nums">
              12 mies.: <span className="text-white font-bold">{formatPLN(yearlyDelta, { showSign: true })}</span>
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4.5 animate-card-in stagger-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
              <Banknote className="w-4 h-4 text-white" />
              Gotówka fizyczna
            </div>
            <div className="text-lg sm:text-xl font-extrabold tabular-nums text-white mt-1.5">
              {formatPLN(accountsSummary.cashTotalGrosze)}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4.5 animate-card-in stagger-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
              <Landmark className="w-4 h-4 text-white" />
              Konta bieżące
            </div>
            <div className="text-lg sm:text-xl font-extrabold tabular-nums text-white mt-1.5">
              {formatPLN(accountsSummary.bankTotalGrosze)}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4.5 animate-card-in stagger-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
              <PiggyBank className="w-4 h-4 text-blue-400" />
              Oszczędności & ETF
            </div>
            <div className="text-lg sm:text-xl font-extrabold tabular-nums text-white mt-1.5">
              {formatPLN(accountsSummary.savingsAndInvestGrosze)}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4.5 animate-card-in stagger-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
              <TrendingUp className="w-4 h-4 text-[#f87171]" />
              Zobowiązania
            </div>
            <div
              className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1.5 ${
                accountsSummary.liabilitiesGrosze < 0 ? 'text-[#f87171]' : 'text-neutral-500'
              }`}
            >
              {formatPLN(accountsSummary.liabilitiesGrosze)}
            </div>
          </div>
        </div>

        {/* Allocation Proportion Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Struktura aktywów</span>
            <span className="tabular-nums font-semibold text-white">
              Razem: {formatPLN(positiveTotal)}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#090b10] border border-[#1e2330] overflow-hidden flex">
            {accountsSummary.accounts
              .filter((a) => a.currentBalanceGrosze > 0)
              .map((acc) => {
                const pct = (acc.currentBalanceGrosze / positiveTotal) * 100;
                return (
                  <div
                    key={acc.id}
                    title={`${acc.name}: ${formatPLN(acc.currentBalanceGrosze)} (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, backgroundColor: acc.color }}
                    className="h-full border-r border-black/40 last:border-r-0 transition-all duration-300"
                  />
                );
              })}
          </div>
        </div>
      </section>

      {/* Accounts & Wallets Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accountsSummary.accounts.map((acc) => {
          const sharePct =
            acc.currentBalanceGrosze > 0
              ? Math.round((acc.currentBalanceGrosze / positiveTotal) * 1000) / 10
              : 0;

          return (
            <div
              key={acc.id}
              className="finte-card p-4 sm:p-6 flex flex-col justify-between gap-4 hover:border-[#2b3548] transition-all duration-200 animate-card-in"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${acc.color}18`,
                      color: acc.color,
                      border: `1px solid ${acc.color}35`,
                    }}
                  >
                    <AccountKindIcon kind={acc.kind} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white truncate">
                        {acc.name}
                      </h2>
                      {acc.includeInLiquid && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 shrink-0">
                          Płynne
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {ACCOUNT_KIND_META[acc.kind].label} · {acc.txCount} operacji
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEditAccount(acc)}
                  title="Edytuj konto"
                  className="p-2 rounded-xl bg-[#141822] hover:bg-[#1c2230] border border-[#222938] text-neutral-400 hover:text-white cursor-pointer shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400">Aktualne saldo</div>
                  <div
                    className={`text-2xl sm:text-3xl font-black tabular-nums mt-0.5 ${
                      acc.currentBalanceGrosze < 0 ? 'text-[#f87171]' : 'text-white'
                    }`}
                  >
                    {formatPLN(acc.currentBalanceGrosze)}
                  </div>
                </div>

                {sharePct > 0 && (
                  <span className="text-xs font-bold tabular-nums text-neutral-300 bg-[#090b10] border border-[#1e2330] px-3 py-1 rounded-xl">
                    {sharePct.toLocaleString('pl-PL')}% aktywów
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl ios-glass-inset p-3 text-xs">
                <div className="flex items-center gap-1.5 text-white tabular-nums">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" />
                  <span className="truncate">Wpływy m-c: {formatPLN(acc.monthlyInflowGrosze)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-300 tabular-nums justify-end">
                  <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">Wypływy: {formatPLN(acc.monthlyOutflowGrosze)}</span>
                </div>
              </div>

              {acc.note && <p className="text-[11px] text-neutral-400/80 -mt-1">{acc.note}</p>}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onQuickAddForAccount(acc.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white/95 hover:bg-white active:scale-[0.97] py-2.5 px-3 text-xs font-bold text-black transition-all cursor-pointer shadow-[0_4px_16px_rgba(255,255,255,0.2)]"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Dodaj operację
                </button>
                <button
                  type="button"
                  onClick={() => onOpenReconcile(acc.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl ios-glass-pill active:scale-[0.97] py-2.5 px-3 text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  Wyrównaj saldo
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Net Worth 12M Growth Chart */}
      <section className="finte-card p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Dynamika majątku netto (12 miesięcy)
            </h2>
            <p className="text-xs text-neutral-400">
              Wycena Twoich aktywów na koniec każdego miesiąca.
            </p>
          </div>
          {hoveredMonthIdx !== null && netWorthSeries[hoveredMonthIdx] && (
            <div className="rounded-xl bg-[#141822] border border-[#242c3d] px-3.5 py-1.5 text-xs tabular-nums">
              <span className="text-neutral-400 mr-2">{netWorthSeries[hoveredMonthIdx].label}:</span>
              <strong className="text-white font-bold">
                {formatPLN(netWorthSeries[hoveredMonthIdx].netWorthGrosze)}
              </strong>
            </div>
          )}
        </div>

        <NetWorthAreaChart
          series={netWorthSeries}
          hoveredIdx={hoveredMonthIdx}
          onHover={setHoveredMonthIdx}
        />
      </section>
    </div>
  );
}

function NetWorthAreaChart({
  series,
  hoveredIdx,
  onHover,
}: {
  series: Array<{ ym: string; label: string; netWorthGrosze: number }>;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const vals = series.map((s) => s.netWorthGrosze);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const padRange = Math.max(100000, Math.round((maxVal - minVal) * 0.25));
  const yMin = Math.floor((minVal - padRange * 0.5) / 100000) * 100000;
  const yMax = Math.ceil((maxVal + padRange * 0.5) / 100000) * 100000;
  const span = Math.max(100000, yMax - yMin);

  const W = 760;
  const H = 210;
  const padL = 68;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xToPx = (i: number) =>
    series.length <= 1 ? padL + plotW / 2 : padL + (i / (series.length - 1)) * plotW;
  const yToPx = (val: number) => padT + ((yMax - val) / span) * plotH;

  const linePts = series.map((s, i) => `${xToPx(i)},${yToPx(s.netWorthGrosze)}`).join(' ');
  const areaPts = `${xToPx(0)},${padT + plotH} ${linePts} ${xToPx(series.length - 1)},${padT + plotH}`;

  const ticks = [yMin, Math.round(yMin + span * 0.5), yMax];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px] h-auto select-none"
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => {
          const y = yToPx(t);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1f2533" strokeWidth="1" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#64748b"
                fontSize="11"
                className="tabular-nums"
              >
                {formatCompactTys(t)}
              </text>
            </g>
          );
        })}

        <polygon points={areaPts} fill="url(#nwGrad)" />
        <polyline
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePts}
        />

        {series.map((s, i) => {
          const cx = xToPx(i);
          const cy = yToPx(s.netWorthGrosze);
          const isHovered = hoveredIdx === i;
          return (
            <g key={s.ym} onMouseEnter={() => onHover(i)}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3.5}
                fill={isHovered ? '#ffffff' : '#94a3b8'}
                stroke="#000000"
                strokeWidth="2"
              />
              {i % 2 === 0 || i === series.length - 1 ? (
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#64748b'}
                  fontSize="10.5"
                >
                  {s.label}
                </text>
              ) : null}
              <rect
                x={cx - plotW / Math.max(1, series.length * 2)}
                y={padT}
                width={plotW / Math.max(1, series.length)}
                height={plotH}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
