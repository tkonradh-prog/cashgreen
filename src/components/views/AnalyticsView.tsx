'use client';

import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  Target,
} from 'lucide-react';
import {
  computeAnnualSummary,
  computeCategoryBreakdown,
  computeHeatmapMatrix,
  computeMonthlyBucketsForYear,
  computeRollingTrend,
  getAvailableYears,
} from '@/lib/analytics';
import {
  POLISH_MONTHS_FULL,
  POLISH_MONTHS_SHORT,
  formatCompactTys,
  formatHeatmapValue,
  formatPLN,
} from '@/lib/format';
import { AnalyticsMetric, AnalyticsScope } from '@/lib/types';
import { useFinance } from '../FinanceProvider';
import { AnimatedPLN } from '../ui/AnimatedPLN';
import { SegmentedTabs } from '../ui/SegmentedTabs';

export function AnalyticsView({
  onOpenTargets,
  onInspectMonth,
}: {
  onOpenTargets: () => void;
  onInspectMonth: (ym: string) => void;
}) {
  const { db, todayStr } = useFinance();

  const availableYears = useMemo(
    () => getAvailableYears(db.transactions, todayStr),
    [db.transactions, todayStr]
  );

  const [scope, setScope] = useState<AnalyticsScope>('year');
  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears[availableYears.length - 1] ?? Number(todayStr.slice(0, 4))
  );
  const [metric, setMetric] = useState<AnalyticsMetric>('income');

  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [hoveredYearIdx, setHoveredYearIdx] = useState<number | null>(null);
  const [hoveredDivIdx, setHoveredDivIdx] = useState<number | null>(null);
  const [hoveredStackedIdx, setHoveredStackedIdx] = useState<number | null>(null);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const activeYear = availableYears.includes(selectedYear)
    ? selectedYear
    : availableYears[availableYears.length - 1];

  const monthlyBuckets = useMemo(
    () => computeMonthlyBucketsForYear(db, activeYear, metric, todayStr),
    [db, activeYear, metric, todayStr]
  );

  const annualRows = useMemo(
    () => computeAnnualSummary(db, metric, todayStr),
    [db, metric, todayStr]
  );

  const categoryBreakdown = useMemo(
    () =>
      computeCategoryBreakdown(
        db,
        activeYear,
        metric === 'income' ? 'income' : 'expense'
      ),
    [db, activeYear, metric]
  );

  const rollingTrend = useMemo(
    () => computeRollingTrend(db, metric, 12, todayStr),
    [db, metric, todayStr]
  );

  const heatmapRows = useMemo(
    () => computeHeatmapMatrix(db, metric, todayStr),
    [db, metric, todayStr]
  );

  // Koszty i marża (Image 4)
  const marginStats = useMemo(() => {
    const currentYm = todayStr.slice(0, 7);
    let totalIncomeFullYear = 0;
    let totalExpense = 0;
    let realizedIncomeToToday = 0;

    for (const tx of db.transactions) {
      if (tx.type === 'transfer') continue;
      if (Number(tx.date.slice(0, 4)) !== activeYear) continue;

      if (tx.type === 'income') {
        totalIncomeFullYear += tx.amountGrosze;
        if (!tx.isPlanned && tx.date.slice(0, 7) <= currentYm) {
          realizedIncomeToToday += tx.amountGrosze;
        }
      } else if (tx.type === 'expense' && !tx.isPlanned) {
        totalExpense += tx.amountGrosze;
      }
    }

    const netGrosze = totalIncomeFullYear - totalExpense;
    const costRatioPct =
      totalIncomeFullYear > 0
        ? Math.round((totalExpense / totalIncomeFullYear) * 1000) / 10
        : 0;

    return {
      totalIncome: totalIncomeFullYear,
      totalExpense,
      netGrosze,
      costRatioPct,
      realizedIncomeToToday,
    };
  }, [db.transactions, activeYear, todayStr]);

  const kpiSummary = useMemo(() => {
    const realized = db.transactions.filter((tx) => {
      if (tx.isPlanned || tx.type === 'transfer') return false;
      if (scope === 'year') return Number(tx.date.slice(0, 4)) === activeYear;
      return true;
    });

    let income = 0;
    let expense = 0;
    for (const tx of realized) {
      if (tx.type === 'income') income += tx.amountGrosze;
      if (tx.type === 'expense') expense += tx.amountGrosze;
    }

    const net = income - expense;
    const monthsDenominator =
      scope === 'year'
        ? Math.max(
            1,
            monthlyBuckets.filter((b) => b.incomeGrosze > 0 || b.expenseGrosze > 0).length
          )
        : Math.max(
            1,
            annualRows.reduce((s, r) => s + r.monthsActive, 0)
          );
    const avgMonthly = Math.round(
      (metric === 'income' ? income : metric === 'expense' ? expense : net) / monthsDenominator
    );

    return { income, expense, net, avgMonthly };
  }, [db.transactions, scope, activeYear, monthlyBuckets, annualRows, metric]);

  const metricMeta = {
    expense: {
      title: 'Wydatki',
      shortLabel: 'wydatek',
      targetLabel: 'limit miesięczny',
      favorablePositive: 'poniżej limitu',
      favorableNegative: 'ponad limit',
    },
    income: {
      title: 'Przychody',
      shortLabel: 'przychód',
      targetLabel: 'cel miesięczny',
      favorablePositive: 'ponad cel',
      favorableNegative: 'poniżej celu',
    },
    net: {
      title: 'Bilans netto',
      shortLabel: 'bilans',
      targetLabel: 'cel oszczędności',
      favorablePositive: 'ponad cel',
      favorableNegative: 'poniżej celu',
    },
  }[metric];

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* HEADER CONTROLS (Finte Style: Scope + Metric + Years)               */}
      {/* =================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs<AnalyticsScope>
            size="sm"
            value={scope}
            onChange={setScope}
            items={[
              { value: 'all', label: 'Wszystko razem' },
              { value: 'year', label: 'Pojedynczy rok' },
            ]}
          />

          <SegmentedTabs<AnalyticsMetric>
            size="sm"
            value={metric}
            onChange={setMetric}
            items={[
              { value: 'income', label: 'Przychody' },
              { value: 'expense', label: 'Wydatki' },
              { value: 'net', label: 'Bilans' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {scope === 'year' && (
            <div className="inline-flex items-center p-1 rounded-2xl ios-glass-inset gap-1 shrink-0">
              {availableYears.map((yr) => {
                const active = yr === activeYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold tabular-nums transition-all duration-150 active:scale-95 cursor-pointer ${
                      active
                        ? 'bg-white/95 text-black shadow-[0_2px_10px_rgba(255,255,255,0.22)]'
                        : 'text-neutral-300/80 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenTargets}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full ios-glass-pill active:scale-95 text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer"
          >
            <Target className="w-3.5 h-3.5 text-neutral-300" />
            Ustaw cele
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4-CARD KPI STRIP                                                    */}
      {/* =================================================================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="finte-card p-3.5 sm:p-5 animate-card-in stagger-1">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Przychody {scope === 'year' ? `(${activeYear})` : '(razem)'}
          </div>
          <div className="text-lg sm:text-2xl font-extrabold tabular-nums whitespace-nowrap text-white mt-1">
            <AnimatedPLN valueGrosze={kpiSummary.income} />
          </div>
        </div>

        <div className="finte-card p-3.5 sm:p-5 animate-card-in stagger-2">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Wydatki {scope === 'year' ? `(${activeYear})` : '(razem)'}
          </div>
          <div className="text-lg sm:text-2xl font-extrabold tabular-nums whitespace-nowrap text-[#f87171] mt-1">
            <AnimatedPLN valueGrosze={kpiSummary.expense} />
          </div>
        </div>

        <div className="finte-card-elevated p-3.5 sm:p-5 animate-card-in stagger-3">
          <div className="text-[11px] font-semibold text-neutral-300/80 uppercase tracking-wider">
            Zarobek netto
          </div>
          <div className="text-lg sm:text-2xl font-black tabular-nums whitespace-nowrap mt-1 text-white">
            <AnimatedPLN valueGrosze={kpiSummary.net} showSign />
          </div>
        </div>

        <div className="finte-card p-3.5 sm:p-5 animate-card-in stagger-4">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Średnia / mies.
          </div>
          <div className="text-lg sm:text-2xl font-extrabold tabular-nums whitespace-nowrap text-white mt-1">
            <AnimatedPLN valueGrosze={kpiSummary.avgMonthly} />
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* VIEW MODE A: POJEDYNCZY ROK                                         */}
      {/* =================================================================== */}
      {scope === 'year' ? (
        <div key={`year-${activeYear}-${metric}`} className="space-y-6 animate-view-enter">
          {/* WYKRES 1: Miesiąc po miesiącu (Image 1) */}
          <section className="finte-card p-5 sm:p-7 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Miesiąc po miesiącu · {activeYear}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Słupki – realny {metricMeta.shortLabel}, przerywana linia – {metricMeta.targetLabel}. Wyszaryzone słupki to prognoza: nie wchodzi do sum ani średnich.
              </p>
            </div>

            <MonthlyBarChart
              buckets={monthlyBuckets}
              metric={metric}
              hoveredIdx={hoveredMonthIdx}
              onHover={setHoveredMonthIdx}
              onSelectMonth={(ym) => onInspectMonth(ym)}
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pt-2 border-t border-[#181d28]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#2dd4bf]" />
                {metricMeta.shortLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#f87171]" />
                {metric === 'income' ? 'miesiąc bez przychodu' : 'przekroczony limit'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#475569]" />
                prognoza
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-neutral-400" />
                {metricMeta.targetLabel}
              </span>
            </div>
          </section>

          {/* WYKRES 2: Realizacja celu (+/- Waterfall) + Tabela (Image 3) */}
          <section className="finte-card p-5 sm:p-7 space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Realizacja celu · {activeYear}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ile brakowało lub zostało ponad cel w każdym miesiącu i jak to się kumuluje przez rok.
              </p>
            </div>

            <DivergingGoalChart
              buckets={monthlyBuckets}
              hoveredIdx={hoveredDivIdx}
              onHover={setHoveredDivIdx}
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#2dd4bf]" />
                {metricMeta.favorablePositive}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#f87171]" />
                {metricMeta.favorableNegative}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-white" />
                narastająco od stycznia
              </span>
            </div>

            {/* Monthly Realization: Mobile Cards + Desktop Table */}
            <div className="sm:hidden space-y-2 pt-3 border-t border-[#181d28]">
              {monthlyBuckets.map((b) => {
                const hasActivity = b.hasData && !b.isForecastOnly;
                const diff = b.diffGrosze;
                const isPositive = diff >= 0;
                return (
                  <button
                    key={b.ym}
                    type="button"
                    onClick={() => onInspectMonth(b.ym)}
                    className="w-full rounded-xl ios-glass-inset px-3.5 py-2.5 flex items-center justify-between gap-2 text-left active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">
                        {POLISH_MONTHS_FULL[b.monthIndex]}
                      </div>
                      <div className="text-[11px] text-neutral-400 tabular-nums">
                        Cel: {formatPLN(b.targetGrosze)}
                      </div>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <div className="text-xs font-extrabold text-white">
                        {hasActivity ? formatPLN(b.valueGrosze) : '0,00 zł'}
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          !hasActivity
                            ? 'text-neutral-500'
                            : isPositive
                              ? 'text-[#2dd4bf]'
                              : 'text-[#f87171]'
                        }`}
                      >
                        {hasActivity ? formatPLN(diff, { showSign: true }) : '—'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto -mx-2 px-2 pt-2 border-t border-[#181d28]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1c2230] text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                    <th className="py-2.5 pr-3">Miesiąc</th>
                    <th className="py-2.5 px-3 text-right">Zarobek / Wynik</th>
                    <th className="py-2.5 px-3 text-right">Cel</th>
                    <th className="py-2.5 pl-3 text-right">Różnica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d28] text-xs sm:text-sm">
                  {monthlyBuckets.map((b) => {
                    const hasActivity = b.hasData && !b.isForecastOnly;
                    const diff = b.diffGrosze;
                    const isPositive = diff >= 0;

                    return (
                      <tr
                        key={b.ym}
                        onClick={() => onInspectMonth(b.ym)}
                        className="hover:bg-[#12151e] transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-semibold text-white">
                          {b.label}{' '}
                          <span className="text-[11px] font-normal text-neutral-500">
                            ({POLISH_MONTHS_FULL[b.monthIndex]})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-white whitespace-nowrap">
                          {hasActivity ? formatPLN(b.valueGrosze) : '0,00 zł'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-neutral-400 whitespace-nowrap">
                          {formatPLN(b.targetGrosze)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums font-bold whitespace-nowrap">
                          {hasActivity ? (
                            <span className={isPositive ? 'text-[#2dd4bf]' : 'text-[#f87171]'}>
                              {formatPLN(diff, { showSign: true })}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* WYKRES 3: Linie biznesowe / kategorie & Koszty i marża (Image 4) */}
          <section className="finte-card p-5 sm:p-7 space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Linie biznesowe i kategorie · {activeYear}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Struktura miesięczna wpływów i wydatków. Przygaszone słupki to plan.
              </p>
            </div>

            <StackedCategoryBarChart
              breakdown={categoryBreakdown}
              activeYear={activeYear}
              hoveredIdx={hoveredStackedIdx}
              onHover={setHoveredStackedIdx}
              onSelectMonth={(ym) => onInspectMonth(ym)}
            />

            {/* Category Breakdown: Mobile Cards + Desktop Table */}
            <div className="sm:hidden space-y-2 pt-3 border-t border-[#181d28]">
              {categoryBreakdown.rows.map((row) => (
                <div
                  key={row.categoryId}
                  className="rounded-xl ios-glass-inset px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{row.name}</div>
                      <div className="text-[11px] text-neutral-400 tabular-nums">
                        Udział: {row.sharePct}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <div className="text-xs font-bold text-[#2dd4bf]">
                      {formatPLN(row.totalGrosze)}
                    </div>
                    {row.plannedGrosze > 0 && (
                      <div className="text-[10px] text-neutral-400">
                        Rok: {formatPLN(row.totalGrosze + row.plannedGrosze)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-white/[0.06] border border-white/15 px-3.5 py-2.5 flex items-center justify-between text-xs font-black text-white">
                <span>{metric === 'income' ? 'Przychód razem' : 'Wydatki razem'}</span>
                <span className="tabular-nums text-[#2dd4bf]">
                  {formatPLN(categoryBreakdown.totalRealizedGrosze)}
                </span>
              </div>
            </div>

            <div className="hidden sm:block overflow-x-auto -mx-2 px-2 pt-2 border-t border-[#181d28]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1c2230] text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                    <th className="py-2.5 pr-3">Linia / Kategoria</th>
                    <th className="py-2.5 px-3 text-right">Cały rok</th>
                    <th className="py-2.5 px-3 text-center">Udział</th>
                    <th className="py-2.5 pl-3 text-right">Zrealizowane</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d28] text-xs sm:text-sm">
                  {categoryBreakdown.rows.map((row) => (
                    <tr key={row.categoryId} className="hover:bg-[#12151e] transition-colors">
                      <td className="py-3 pr-3 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-white whitespace-nowrap">
                        {formatPLN(row.totalGrosze + row.plannedGrosze)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold tabular-nums text-neutral-400 whitespace-nowrap">
                        {row.sharePct}%
                      </td>
                      <td className="py-3 pl-3 text-right font-bold tabular-nums text-[#2dd4bf] whitespace-nowrap">
                        {formatPLN(row.totalGrosze)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#222a3a] font-black text-white text-xs sm:text-sm">
                    <td className="py-3 pr-3">
                      {metric === 'income' ? 'Przychód razem' : 'Wydatki razem'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                      {formatPLN(categoryBreakdown.totalRealizedGrosze + categoryBreakdown.totalPlannedGrosze)}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums whitespace-nowrap">100%</td>
                    <td className="py-3 pl-3 text-right tabular-nums text-[#2dd4bf] whitespace-nowrap">
                      {formatPLN(categoryBreakdown.totalRealizedGrosze)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Koszty i marża Cards (Image 4 bottom) */}
            <div className="pt-4 border-t border-[#181d28] space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">Koszty i marża</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Przychód z linii biznesowych minus koszty firmowe (księgowa + podatki + koszty bieżące) daje zarobek netto.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <div className="rounded-2xl ios-glass-inset p-3.5">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Przychód (cały rok)
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tabular-nums text-white mt-1">
                    {formatPLN(marginStats.totalIncome)}
                  </div>
                </div>

                <div className="rounded-2xl ios-glass-inset p-3.5">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Koszty firmowe
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tabular-nums text-[#f87171] mt-1">
                    {formatPLN(marginStats.totalExpense)}
                  </div>
                </div>

                <div className="rounded-2xl finte-card-elevated p-3.5 col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold text-neutral-300/80 uppercase tracking-wider">
                    Zarobek netto
                  </div>
                  <div className="text-base sm:text-lg font-black tabular-nums text-white mt-1">
                    {formatPLN(marginStats.netGrosze, { showSign: true })}
                  </div>
                </div>

                <div className="rounded-2xl ios-glass-inset p-3.5">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Koszty / przychód
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tabular-nums text-neutral-200 mt-1">
                    {marginStats.costRatioPct}%
                  </div>
                </div>

                <div className="rounded-2xl ios-glass-inset p-3.5 col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Zrealizowane do dzisiaj
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tabular-nums text-[#2dd4bf] mt-1">
                    {formatPLN(marginStats.realizedIncomeToToday)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* =================================================================== */
        /* VIEW MODE B: WSZYSTKO RAZEM (Image 2 + Image 5)                     */
        /* =================================================================== */
        <div key={`all-${metric}`} className="space-y-6 animate-view-enter">
          {/* WYKRES 4: Rok do roku (Image 2) */}
          <section className="finte-card p-5 sm:p-7 space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Rok do roku · {metricMeta.title}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Wypełniony słupek to realny wynik, obrysowany to cel za rozliczone miesiące.
              </p>
            </div>

            <AnnualPairedChart
              rows={annualRows}
              hoveredIdx={hoveredYearIdx}
              onHover={setHoveredYearIdx}
              onSelectYear={(yr) => {
                setSelectedYear(yr);
                setScope('year');
              }}
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#2dd4bf]" />
                {metricMeta.shortLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs border border-neutral-400 bg-transparent" />
                cel za rozliczone miesiące
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs border border-dashed border-neutral-500 bg-transparent" />
                rok niepełny
              </span>
            </div>

            {/* Annual Multi-Year: Mobile Cards + Desktop Table */}
            <div className="sm:hidden space-y-2.5 pt-3 border-t border-[#181d28]">
              {annualRows.map((row) => {
                const isGood =
                  metric === 'expense'
                    ? row.realizationPct <= 100
                    : row.realizationPct >= 100;
                return (
                  <button
                    key={row.year}
                    type="button"
                    onClick={() => {
                      setSelectedYear(row.year);
                      setScope('year');
                    }}
                    className="w-full rounded-xl ios-glass-inset p-3.5 text-left space-y-2 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white tabular-nums">
                        {row.year}
                        {row.isIncomplete && (
                          <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                            ({row.monthsActive} mies.)
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {row.yoyPct !== null && (
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              row.yoyPct >= 0 ? 'text-[#2dd4bf]' : 'text-[#f87171]'
                            }`}
                          >
                            {row.yoyPct >= 0 ? `+${row.yoyPct}%` : `${row.yoyPct}%`} R/R
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                            isGood
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {row.realizationPct}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">{metricMeta.title}</span>
                        <strong className="text-white">
                          {formatPLN(row.valueGrosze, { compactZeroDecimals: true })}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-neutral-400 block text-[10px]">Średnia / mies.</span>
                        <strong className="text-neutral-200">
                          {formatPLN(row.avgMonthlyGrosze, { compactZeroDecimals: true })}
                        </strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto -mx-2 px-2 pt-2 border-t border-[#181d28]">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1c2230] text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
                    <th className="py-2.5 pr-3">Rok</th>
                    <th className="py-2.5 px-3 text-right">{metricMeta.title}</th>
                    <th className="py-2.5 px-3 text-right">Cel</th>
                    <th className="py-2.5 px-3 text-center">Realizacja</th>
                    <th className="py-2.5 px-3 text-right">Średnia/mies.</th>
                    <th className="py-2.5 px-3 text-right">Najlepszy</th>
                    <th className="py-2.5 pl-3 text-right">R/R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181d28] text-xs sm:text-sm">
                  {annualRows.map((row) => {
                    const isGood =
                      metric === 'expense'
                        ? row.realizationPct <= 100
                        : row.realizationPct >= 100;

                    return (
                      <tr
                        key={row.year}
                        onClick={() => {
                          setSelectedYear(row.year);
                          setScope('year');
                        }}
                        className="hover:bg-[#12151e] transition-colors cursor-pointer"
                      >
                        <td className="py-3 pr-3 font-bold text-white tabular-nums">
                          {row.year}
                          {row.isIncomplete && (
                            <span className="ml-1.5 text-[11px] font-normal text-neutral-500">
                              ({row.monthsActive} mies.)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums text-white whitespace-nowrap">
                          {formatPLN(row.valueGrosze, { compactZeroDecimals: true })}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-neutral-400 whitespace-nowrap">
                          {formatPLN(row.targetGrosze, { compactZeroDecimals: true })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                              isGood
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {row.realizationPct}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-neutral-300 whitespace-nowrap">
                          {formatPLN(row.avgMonthlyGrosze, { compactZeroDecimals: true })}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-white font-semibold whitespace-nowrap">
                          {formatPLN(row.bestMonthGrosze, { compactZeroDecimals: true })}
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums font-bold whitespace-nowrap">
                          {row.yoyPct !== null ? (
                            <span className={row.yoyPct >= 0 ? 'text-[#2dd4bf]' : 'text-[#f87171]'}>
                              {row.yoyPct >= 0 ? `+${row.yoyPct}%` : `${row.yoyPct}%`}
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* WYKRES 5: Trend – średnia krocząca 12 miesięcy (Image 5) */}
          <section className="finte-card p-5 sm:p-7 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Trend – średnia krocząca 12 miesięcy
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cienka linia to poszczególne miesiące (szum), gruba – średnia z ostatnich 12 miesięcy (sygnał). Średnia krocząca odsiewa jednorazowe skoki i pokazuje, gdzie naprawdę jesteś.
              </p>
            </div>

            <RollingTrendChart
              points={rollingTrend.points}
              hoveredIdx={hoveredTrendIdx}
              onHover={setHoveredTrendIdx}
            />

            {/* Trend Callout Badge Card (Image 5) */}
            <div className="rounded-2xl ios-glass-inset p-4 space-y-1 text-xs">
              <div className="font-bold text-white flex flex-wrap items-center gap-2">
                <span>
                  Obecna średnia krocząca:{' '}
                  <strong className="text-[#2dd4bf] text-sm">
                    {rollingTrend.latestAvgGrosze !== null
                      ? `${formatPLN(rollingTrend.latestAvgGrosze)}/mies.`
                      : 'Brak danych'}
                  </strong>
                </span>
                {rollingTrend.yoyChangePct !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      rollingTrend.yoyChangePct >= 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    {rollingTrend.yoyChangePct >= 0
                      ? `+${rollingTrend.yoyChangePct}%`
                      : `${rollingTrend.yoyChangePct}%`}{' '}
                    względem zeszłego roku
                  </span>
                )}
              </div>
              <div className="text-neutral-400 text-[11px] pt-1">
                {rollingTrend.peak && rollingTrend.trough ? (
                  <span>
                    Szczyt:{' '}
                    <strong className="text-neutral-200">
                      {formatPLN(rollingTrend.peak.valueGrosze)}
                    </strong>{' '}
                    ({rollingTrend.peak.label}) · Dołek:{' '}
                    <strong className="text-neutral-200">
                      {formatPLN(rollingTrend.trough.valueGrosze)}
                    </strong>{' '}
                    ({rollingTrend.trough.label}). Każdy punkt to średni miesięczny wynik z poprzednich 12 miesięcy – jeden wyjątkowy miesiąc jej nie podnosi, jeden słaby nie przewraca.
                  </span>
                ) : (
                  <span>Zbierz minimum 12 miesięcy historii, aby w pełni wygładzić wykres trendu.</span>
                )}
              </div>
            </div>
          </section>

          {/* SEKTON 6: Mapa miesięcy Heatmap (Image 5 bottom) */}
          <section className="finte-card p-5 sm:p-7 space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Mapa miesięcy
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Każda kratka to jeden miesiąc, liczby w tys. zł – im wyższa kwota, tym wyraźniejsze podświetlenie. Czerwone kratki to miesiące bez przychodu, kreskowane to prognoza.
              </p>
            </div>

            <HeatmapGrid
              rows={heatmapRows}
              metric={metric}
              onCellClick={(ym) => onInspectMonth(ym)}
            />
          </section>
        </div>
      )}
    </div>
  );
}

{/* ========================================================================= */}
{/* SUB-COMPONENTS                                                            */}
{/* ========================================================================= */}

function MonthlyBarChart({
  buckets,
  metric,
  hoveredIdx,
  onHover,
  onSelectMonth,
}: {
  buckets: ReturnType<typeof computeMonthlyBucketsForYear>;
  metric: AnalyticsMetric;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  onSelectMonth: (ym: string) => void;
}) {
  const vals = buckets.flatMap((b) => [
    b.valueGrosze,
    b.plannedValueGrosze,
    b.targetGrosze,
  ]);
  const minVal = Math.min(0, ...vals);
  const maxVal = Math.max(100000, ...vals);
  const yMax = Math.ceil((maxVal * 1.15) / 100000) * 100000;
  const yMin = minVal < 0 ? Math.floor((minVal * 1.15) / 100000) * 100000 : 0;
  const span = Math.max(100000, yMax - yMin);

  const W = 680;
  const H = 220;
  const padL = 52;
  const padR = 12;
  const padT = 30;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const yToPx = (val: number) => padT + ((yMax - val) / span) * plotH;
  const zeroY = yToPx(0);
  const colW = plotW / 12;

  const ticks = [yMin, Math.round(yMin + span * 0.33), Math.round(yMin + span * 0.66), yMax];
  const targetPoints = buckets
    .map((b, i) => `${padL + i * colW + colW / 2},${yToPx(b.targetGrosze)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  return (
    <div className="relative">
      {hovered && (
        <div className="mb-2 rounded-xl ios-glass-sheet px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
          <span className="font-bold text-white">
            {POLISH_MONTHS_FULL[hovered.monthIndex]} {hovered.year}
          </span>
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            <span className="text-white">
              Przychody: <strong>{formatPLN(hovered.incomeGrosze)}</strong>
            </span>
            <span className="text-[#f87171]">
              Wydatki: <strong>{formatPLN(hovered.expenseGrosze)}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectMonth(hovered.ym)}
              className="inline-flex items-center gap-1 text-white hover:underline font-bold cursor-pointer"
            >
              Wpisy <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => onHover(null)}
        >
          {ticks.map((t, idx) => {
            const y = yToPx(t);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="#1c2230"
                  strokeWidth={t === 0 ? 1.5 : 1}
                />
                <text
                  x={padL - 6}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                  className="tabular-nums font-mono"
                >
                  {formatCompactTys(t)}
                </text>
              </g>
            );
          })}

          {buckets.map((b, i) => {
            const cx = padL + i * colW + colW / 2;
            const barW = Math.min(34, colW * 0.58);
            const activeValue = b.isForecastOnly ? b.plannedValueGrosze : b.valueGrosze;
            const barTop = Math.min(zeroY, yToPx(activeValue));
            const barBottom = Math.max(zeroY, yToPx(activeValue));
            const barH = Math.max(activeValue === 0 ? 0 : 4, barBottom - barTop);
            const isHovered = hoveredIdx === i;

            const isZeroIncome = metric === 'income' && b.hasData && b.valueGrosze === 0;
            const isOverExpense = metric === 'expense' && b.valueGrosze > b.targetGrosze;

            const fillColor = b.isForecastOnly
              ? '#475569'
              : isZeroIncome || isOverExpense
                ? '#f87171'
                : '#2dd4bf';

            return (
              <g
                key={b.ym}
                className="cursor-pointer"
                onMouseEnter={() => onHover(i)}
                onClick={() => onSelectMonth(b.ym)}
              >
                <rect
                  x={padL + i * colW + 2}
                  y={padT - 8}
                  width={colW - 4}
                  height={plotH + 14}
                  rx={8}
                  fill={isHovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}
                />

                {barH > 0 && (
                  <rect
                    x={cx - barW / 2}
                    y={barTop}
                    width={barW}
                    height={barH}
                    rx={6}
                    fill={fillColor}
                    opacity={b.isForecastOnly ? 0.45 : isHovered ? 1 : 0.92}
                    className="animate-bar-grow transition-opacity duration-150"
                    style={{ animationDelay: `${i * 28}ms` }}
                  />
                )}

                <text
                  x={cx}
                  y={H - 9}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#64748b'}
                  fontSize="12"
                  fontWeight={isHovered ? '700' : '500'}
                >
                  {b.label}
                </text>
              </g>
            );
          })}

          {/* Cel miesięczny (dashed target line drawn below value labels) */}
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.75"
            strokeDasharray="5 5"
            opacity="0.75"
            points={targetPoints}
            className="pointer-events-none"
          />

          {/* Value labels on top of bars with dark stroke halo for legibility */}
          {buckets.map((b, i) => {
            const cx = padL + i * colW + colW / 2;
            const activeValue = b.isForecastOnly ? b.plannedValueGrosze : b.valueGrosze;
            if (activeValue <= 0) return null;
            const barTop = Math.min(zeroY, yToPx(activeValue));
            const isHovered = hoveredIdx === i;
            return (
              <text
                key={`lbl-${b.ym}`}
                x={cx}
                y={barTop - 7}
                textAnchor="middle"
                fill={isHovered ? '#ffffff' : '#e2e8f0'}
                stroke="#0c0f17"
                strokeWidth="4"
                strokeLinejoin="round"
                style={{ paintOrder: 'stroke' }}
                fontSize="10.5"
                fontWeight={isHovered ? '700' : '600'}
                className="tabular-nums pointer-events-none"
              >
                {formatCompactTys(activeValue, false)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DivergingGoalChart({
  buckets,
  hoveredIdx,
  onHover,
}: {
  buckets: ReturnType<typeof computeMonthlyBucketsForYear>;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const activeBuckets = buckets.filter((b) => b.hasData && !b.isForecastOnly);
  const vals = activeBuckets.flatMap((b) => [b.diffGrosze, b.cumulativeDiffGrosze]);
  const absMax = Math.max(100000, ...vals.map((v) => Math.abs(v)));
  const bound = Math.ceil((absMax * 1.18) / 100000) * 100000;

  const W = 680;
  const H = 210;
  const padL = 52;
  const padR = 12;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const colW = plotW / 12;

  const yToPx = (v: number) => padT + ((bound - v) / (bound * 2)) * plotH;
  const zeroY = yToPx(0);

  const cumulativePoints = activeBuckets
    .map((b) => `${padL + b.monthIndex * colW + colW / 2},${yToPx(b.cumulativeDiffGrosze)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  return (
    <div className="space-y-2">
      {hovered && hovered.hasData && !hovered.isForecastOnly && (
        <div className="rounded-xl ios-glass-sheet px-3.5 py-2 flex flex-wrap items-center justify-between gap-1 text-xs tabular-nums animate-fade-in">
          <span className="font-bold text-white">{POLISH_MONTHS_FULL[hovered.monthIndex]}</span>
          <span className={hovered.diffGrosze >= 0 ? 'text-[#2dd4bf]' : 'text-[#f87171]'}>
            {formatPLN(hovered.diffGrosze, { showSign: true })} (narastająco od stycznia:{' '}
            {formatPLN(hovered.cumulativeDiffGrosze, { showSign: true })})
          </span>
        </div>
      )}

      <div className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => onHover(null)}
        >
          {[bound, 0, -bound].map((t, idx) => {
            const y = yToPx(t);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke={t === 0 ? '#38445e' : '#1c2230'}
                  strokeWidth={t === 0 ? 1.5 : 1}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10.5"
                  className="tabular-nums font-mono"
                >
                  {formatCompactTys(t)}
                </text>
              </g>
            );
          })}

          {buckets.map((b, i) => {
            const cx = padL + i * colW + colW / 2;
            const barW = Math.min(28, colW * 0.54);
            const showBar = b.hasData && !b.isForecastOnly;
            const isPositive = b.diffGrosze >= 0;
            const topY = isPositive ? yToPx(b.diffGrosze) : zeroY;
            const barH = Math.max(3, Math.abs(yToPx(b.diffGrosze) - zeroY));

            return (
              <g
                key={b.ym}
                className="cursor-pointer"
                onMouseEnter={() => onHover(i)}
                onClick={() => onHover(i)}
              >
                {showBar && (
                  <rect
                    x={cx - barW / 2}
                    y={topY}
                    width={barW}
                    height={barH}
                    rx={5}
                    fill={isPositive ? '#2dd4bf' : '#f87171'}
                    opacity={hoveredIdx === i ? 1 : 0.88}
                    className="animate-bar-diverging transition-opacity duration-150"
                    style={{ animationDelay: `${i * 28}ms` }}
                  />
                )}
                <text x={cx} y={H - 8} textAnchor="middle" fill="#64748b" fontSize="10.5">
                  {b.label}
                </text>
              </g>
            );
          })}

          {/* Cumulative line from January */}
          {activeBuckets.length > 1 && (
            <polyline
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={cumulativePoints}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function StackedCategoryBarChart({
  breakdown,
  activeYear,
  hoveredIdx,
  onHover,
  onSelectMonth,
}: {
  breakdown: ReturnType<typeof computeCategoryBreakdown>;
  activeYear: number;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  onSelectMonth: (ym: string) => void;
}) {
  // 12 months array (0..11)
  const monthlyTotals = Array.from({ length: 12 }, (_, mIdx) => {
    let realizedSum = 0;
    let plannedSum = 0;
    for (const cat of breakdown.rows) {
      realizedSum += cat.monthlySeries[mIdx]?.realized ?? 0;
      plannedSum += cat.monthlySeries[mIdx]?.planned ?? 0;
    }
    return {
      monthIndex: mIdx,
      label: POLISH_MONTHS_SHORT[mIdx],
      ym: `${activeYear}-${String(mIdx + 1).padStart(2, '0')}`,
      realizedSum,
      plannedSum,
      totalSum: realizedSum + plannedSum,
    };
  });

  const maxTotal = Math.max(100000, ...monthlyTotals.map((m) => m.totalSum));
  const yMax = Math.ceil((maxTotal * 1.15) / 100000) * 100000;

  const W = 680;
  const H = 220;
  const padL = 52;
  const padR = 12;
  const padT = 30;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const colW = plotW / 12;

  const yToPx = (val: number) => padT + ((yMax - val) / yMax) * plotH;
  const zeroY = yToPx(0);
  const ticks = [0, Math.round(yMax * 0.5), yMax];

  const hoveredMonth = hoveredIdx !== null ? monthlyTotals[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      {hoveredMonth && (
        <div className="rounded-xl ios-glass-sheet px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
          <span className="font-bold text-white">
            {POLISH_MONTHS_FULL[hoveredMonth.monthIndex]} {activeYear}
          </span>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-white">
              Razem: <strong>{formatPLN(hoveredMonth.realizedSum)}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectMonth(hoveredMonth.ym)}
              className="inline-flex items-center gap-1 text-white hover:underline font-bold cursor-pointer"
            >
              Wpisy <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => onHover(null)}
        >
          {ticks.map((t, idx) => {
            const y = yToPx(t);
            return (
              <g key={idx}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1c2230" strokeWidth="1" />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                  className="tabular-nums font-mono"
                >
                  {formatCompactTys(t)}
                </text>
              </g>
            );
          })}

          {monthlyTotals.map((m, mIdx) => {
            const cx = padL + mIdx * colW + colW / 2;
            const barW = Math.min(34, colW * 0.58);
            const isHovered = hoveredIdx === mIdx;

            // Stack segments from zero upwards
            let currentBottomY = zeroY;
            const segments: React.ReactElement[] = [];

            for (const cat of breakdown.rows) {
              const val = cat.monthlySeries[mIdx]?.realized ?? 0;
              if (val <= 0) continue;

              const segH = Math.max(3, (val / yMax) * plotH);
              const segTopY = currentBottomY - segH;

              segments.push(
                <rect
                  key={cat.categoryId}
                  x={cx - barW / 2}
                  y={segTopY}
                  width={barW}
                  height={segH}
                  rx={2}
                  fill={cat.color}
                  opacity={isHovered ? 1 : 0.88}
                  className="animate-bar-grow transition-opacity duration-150"
                  style={{ animationDelay: `${mIdx * 28}ms` }}
                />
              );

              currentBottomY = segTopY;
            }

            return (
              <g
                key={m.ym}
                className="cursor-pointer"
                onMouseEnter={() => onHover(mIdx)}
                onClick={() => onSelectMonth(m.ym)}
              >
                <rect
                  x={padL + mIdx * colW + 2}
                  y={padT - 8}
                  width={colW - 4}
                  height={plotH + 14}
                  rx={8}
                  fill={isHovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}
                />

                {segments}

                {m.realizedSum > 0 && (
                  <text
                    x={cx}
                    y={currentBottomY - 7}
                    textAnchor="middle"
                    fill={isHovered ? '#ffffff' : '#e2e8f0'}
                    fontSize="10.5"
                    fontWeight={isHovered ? '700' : '600'}
                    className="tabular-nums"
                  >
                    {formatCompactTys(m.realizedSum, false)}
                  </text>
                )}

                <text
                  x={cx}
                  y={H - 9}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#64748b'}
                  fontSize="11.5"
                  fontWeight={isHovered ? '700' : '500'}
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Categories Legend (Image 4) */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 pt-2 border-t border-[#181d28]">
        {breakdown.rows.map((cat) => (
          <span key={cat.categoryId} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-neutral-300 font-medium">{cat.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function AnnualPairedChart({
  rows,
  hoveredIdx,
  onHover,
  onSelectYear,
}: {
  rows: ReturnType<typeof computeAnnualSummary>;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  onSelectYear: (yr: number) => void;
}) {
  if (rows.length === 0) return null;

  const maxVal = Math.max(
    100000,
    ...rows.map((r) => Math.max(r.valueGrosze, r.targetGrosze))
  );
  const yMax = Math.ceil((maxVal * 1.18) / 100000) * 100000;

  const W = 600;
  const H = 220;
  const padL = 56;
  const padR = 14;
  const padT = 26;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const groupW = plotW / rows.length;
  const yToPx = (val: number) => padT + ((yMax - Math.max(0, val)) / yMax) * plotH;
  const ticks = [0, Math.round(yMax * 0.5), yMax];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseLeave={() => onHover(null)}
      >
        {ticks.map((t, i) => {
          const y = yToPx(t);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1c2230" strokeWidth="1" />
              <text
                x={padL - 10}
                y={y + 4}
                textAnchor="end"
                fill="#64748b"
                fontSize="11"
                className="tabular-nums font-mono"
              >
                {formatCompactTys(t)}
              </text>
            </g>
          );
        })}

        {rows.map((r, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const barW = Math.min(40, groupW * 0.32);
          const gap = 6;
          const valY = yToPx(r.valueGrosze);
          const valH = Math.max(4, padT + plotH - valY);
          const tgtY = yToPx(r.targetGrosze);
          const tgtH = Math.max(4, padT + plotH - tgtY);
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={r.year}
              className="cursor-pointer"
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelectYear(r.year)}
            >
              {/* Realized bar (Image 2 style) */}
              <rect
                x={cx - barW - gap / 2}
                y={valY}
                width={barW}
                height={valH}
                rx={6}
                fill="#2dd4bf"
                opacity={r.isIncomplete ? 0.6 : 1}
                className="animate-bar-grow transition-opacity duration-150"
                style={{ animationDelay: `${i * 55}ms` }}
              />
              {/* Cel bar (stroked outline) */}
              <rect
                x={cx + gap / 2}
                y={tgtY}
                width={barW}
                height={tgtH}
                rx={6}
                fill="rgba(255, 255, 255, 0.04)"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray={r.isIncomplete ? '4 4' : undefined}
                className="animate-bar-grow"
                style={{ animationDelay: `${i * 55 + 30}ms` }}
              />
              {/* Label above realized bar */}
              <text
                x={cx - barW / 2 - gap / 2}
                y={valY - 8}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
                className="tabular-nums"
              >
                {formatCompactTys(r.valueGrosze)}
              </text>
              <text
                x={cx}
                y={H - 18}
                textAnchor="middle"
                fill={isHovered ? '#ffffff' : '#94a3b8'}
                fontSize="12"
                fontWeight="700"
              >
                {r.year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RollingTrendChart({
  points,
  hoveredIdx,
  onHover,
}: {
  points: ReturnType<typeof computeRollingTrend>['points'];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  if (points.length === 0) return null;

  const vals = points.flatMap((p) =>
    p.rollingAvgGrosze !== null
      ? [p.singleValueGrosze, p.rollingAvgGrosze]
      : [p.singleValueGrosze]
  );
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(100000, ...vals);
  const yMax = Math.ceil((maxV * 1.14) / 100000) * 100000;
  const yMin = minV < 0 ? Math.floor((minV * 1.14) / 100000) * 100000 : 0;
  const span = Math.max(100000, yMax - yMin);

  const W = 660;
  const H = 215;
  const padL = 54;
  const padR = 16;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xToPx = (i: number) =>
    points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW;
  const yToPx = (val: number) => padT + ((yMax - val) / span) * plotH;

  const noisePoints = points.map((p, i) => `${xToPx(i)},${yToPx(p.singleValueGrosze)}`).join(' ');
  const rollingPoints = points
    .map((p, i) =>
      p.rollingAvgGrosze !== null ? `${xToPx(i)},${yToPx(p.rollingAvgGrosze)}` : null
    )
    .filter(Boolean)
    .join(' ');

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="space-y-2">
      {hovered && (
        <div className="rounded-xl ios-glass-sheet px-3.5 py-2 flex flex-wrap items-center justify-between gap-1 text-xs tabular-nums animate-fade-in">
          <span className="font-bold text-white">{hovered.label}</span>
          <span className="text-white">
            Miesiąc: <strong>{formatPLN(hovered.singleValueGrosze)}</strong>
            {hovered.rollingAvgGrosze !== null && (
              <>
                {' · '}średnia 12M:{' '}
                <strong className="text-[#2dd4bf]">{formatPLN(hovered.rollingAvgGrosze)}</strong>
              </>
            )}
          </span>
        </div>
      )}

      <div className="w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => onHover(null)}
        >
          {[yMin, Math.round(yMin + span * 0.5), yMax].map((t, i) => {
            const y = yToPx(t);
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1c2230" strokeWidth="1" />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10.5"
                  className="tabular-nums font-mono"
                >
                  {formatCompactTys(t)}
                </text>
              </g>
            );
          })}

          {/* Cienka linia poszczególnych miesięcy (szum) */}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#64748b"
              strokeWidth="1.25"
              opacity="0.65"
              points={noisePoints}
            />
          )}

          {/* Gruba linia średniej kroczącej 12M (sygnał) */}
          {rollingPoints && (
            <polyline
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={rollingPoints}
            />
          )}

          {points.map((p, i) => {
            const segW = points.length > 1 ? plotW / points.length : plotW;
            return (
              <g key={p.ym}>
                {p.monthIndex === 0 && (
                  <text x={xToPx(i)} y={H - 8} textAnchor="middle" fill="#64748b" fontSize="10.5">
                    {p.year}
                  </text>
                )}
                <rect
                  x={xToPx(i) - segW / 2}
                  y={padT}
                  width={Math.max(8, segW)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onHover(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function HeatmapGrid({
  rows,
  metric,
  onCellClick,
}: {
  rows: ReturnType<typeof computeHeatmapMatrix>;
  metric: AnalyticsMetric;
  onCellClick: (ym: string) => void;
}) {
  const allPositiveVals = rows
    .flatMap((r) => r.cells.map((c) => c.valueGrosze))
    .filter((v) => v > 0);
  const maxPositive = Math.max(100000, ...allPositiveVals);

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        <div className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] sm:grid-cols-[44px_repeat(12,minmax(0,1fr))] gap-0.5 sm:gap-1 text-center pb-1">
          <div />
          {POLISH_MONTHS_SHORT.map((m) => (
            <div key={m} className="text-[9.5px] sm:text-[11px] font-semibold text-neutral-500 truncate">
              {m}
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.year}
            className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] sm:grid-cols-[44px_repeat(12,minmax(0,1fr))] gap-0.5 sm:gap-1 items-center"
          >
            <div className="text-[10.5px] sm:text-xs font-bold tabular-nums text-neutral-400">{row.year}</div>

            {row.cells.map((cell) => {
              if (cell.isEmpty) {
                return (
                  <div
                    key={cell.ym}
                    className="h-8 sm:h-9 rounded-md sm:rounded-lg bg-[#0a0c10] border border-[#181d28]"
                  />
                );
              }

              if (cell.isForecast) {
                return (
                  <button
                    key={cell.ym}
                    type="button"
                    onClick={() => onCellClick(cell.ym)}
                    title={`${cell.ym} · Prognoza: ${formatPLN(cell.plannedGrosze)}`}
                    className="h-8 sm:h-9 rounded-md sm:rounded-lg border border-dashed border-neutral-600 bg-white/5 text-[8.5px] sm:text-[10.5px] font-semibold tabular-nums text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    {formatHeatmapValue(cell.plannedGrosze)}
                  </button>
                );
              }

              const isZeroAlert =
                cell.valueGrosze <= 0 && (metric === 'net' || metric === 'income');

              let bgStyle = 'bg-white/10 text-neutral-300 border-white/10';
              if (isZeroAlert) {
                bgStyle = 'bg-red-500/25 text-red-300 border-red-500/40';
              } else {
                const ratio = Math.min(1, Math.max(0.15, cell.valueGrosze / maxPositive));
                if (ratio > 0.78) {
                  bgStyle = 'bg-[#2dd4bf] text-black font-extrabold border-[#2dd4bf]';
                } else if (ratio > 0.55) {
                  bgStyle = 'bg-[#2dd4bf]/70 text-black font-bold border-[#2dd4bf]/80';
                } else if (ratio > 0.35) {
                  bgStyle = 'bg-[#2dd4bf]/35 text-white font-semibold border-[#2dd4bf]/40';
                } else {
                  bgStyle = 'bg-white/12 text-neutral-300 border-white/15';
                }
              }

              return (
                <button
                  key={cell.ym}
                  type="button"
                  onClick={() => onCellClick(cell.ym)}
                  title={`${cell.ym} · ${formatPLN(cell.valueGrosze)}`}
                  className={`h-8 sm:h-9 rounded-md sm:rounded-lg border text-[8.5px] sm:text-[11px] font-bold tabular-nums transition-transform hover:scale-[1.04] cursor-pointer ${bgStyle}`}
                >
                  {formatHeatmapValue(cell.valueGrosze)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
