import { POLISH_MONTHS_SHORT } from './format';
import {
  AnalyticsMetric,
  BudgetTargets,
  Category,
  FinanceDB,
  RollingWindow,
  Transaction,
} from './types';

export interface AccountWithBalance {
  id: string;
  name: string;
  kind: FinanceDB['accounts'][number]['kind'];
  initialBalanceGrosze: number;
  currentBalanceGrosze: number;
  monthlyInflowGrosze: number;
  monthlyOutflowGrosze: number;
  txCount: number;
  color: string;
  includeInLiquid: boolean;
  note?: string;
}

export interface MonthlyBucket {
  ym: string; // YYYY-MM
  year: number;
  monthIndex: number; // 0-11
  label: string; // sty, lut, ...
  incomeGrosze: number;
  expenseGrosze: number;
  netGrosze: number;
  plannedIncomeGrosze: number;
  plannedExpenseGrosze: number;
  plannedNetGrosze: number;
  targetGrosze: number; // goal or budget limit depending on metric
  valueGrosze: number; // realized metric value
  plannedValueGrosze: number; // forecast metric value
  diffGrosze: number; // favorable vs target (positive = good)
  cumulativeDiffGrosze: number;
  hasData: boolean;
  isForecastOnly: boolean;
}

export interface AnnualSummaryRow {
  year: number;
  monthsActive: number;
  zeroMonths: number;
  isIncomplete: boolean;
  incomeGrosze: number;
  expenseGrosze: number;
  netGrosze: number;
  valueGrosze: number;
  targetGrosze: number;
  realizationPct: number;
  avgMonthlyGrosze: number;
  bestMonthGrosze: number;
  yoyPct: number | null;
  yoyDiffGrosze: number | null;
}

export interface CategoryBreakdownRow {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  totalGrosze: number;
  plannedGrosze: number;
  sharePct: number;
  budgetYearGrosze: number;
  budgetPct: number | null;
  monthlySeries: Array<{ realized: number; planned: number }>;
}

/**
 * Computes exact live balance and current-month inflow/outflow per account.
 */
export function computeAccountsSummary(
  db: FinanceDB,
  todayStr: string
): {
  accounts: AccountWithBalance[];
  cashTotalGrosze: number;
  bankTotalGrosze: number;
  liquidTotalGrosze: number;
  savingsAndInvestGrosze: number;
  liabilitiesGrosze: number;
  netWorthGrosze: number;
} {
  const currentMonth = todayStr.slice(0, 7);
  const balanceMap = new Map<string, number>();
  const inflowMap = new Map<string, number>();
  const outflowMap = new Map<string, number>();
  const countMap = new Map<string, number>();

  for (const acc of db.accounts) {
    balanceMap.set(acc.id, acc.initialBalanceGrosze);
    inflowMap.set(acc.id, 0);
    outflowMap.set(acc.id, 0);
    countMap.set(acc.id, 0);
  }

  for (const tx of db.transactions) {
    if (tx.isPlanned) continue;
    const isThisMonth = tx.date.slice(0, 7) === currentMonth;

    if (tx.type === 'income') {
      balanceMap.set(tx.accountId, (balanceMap.get(tx.accountId) ?? 0) + tx.amountGrosze);
      countMap.set(tx.accountId, (countMap.get(tx.accountId) ?? 0) + 1);
      if (isThisMonth) {
        inflowMap.set(tx.accountId, (inflowMap.get(tx.accountId) ?? 0) + tx.amountGrosze);
      }
    } else if (tx.type === 'expense') {
      balanceMap.set(tx.accountId, (balanceMap.get(tx.accountId) ?? 0) - tx.amountGrosze);
      countMap.set(tx.accountId, (countMap.get(tx.accountId) ?? 0) + 1);
      if (isThisMonth) {
        outflowMap.set(tx.accountId, (outflowMap.get(tx.accountId) ?? 0) + tx.amountGrosze);
      }
    } else if (tx.type === 'transfer') {
      balanceMap.set(tx.accountId, (balanceMap.get(tx.accountId) ?? 0) - tx.amountGrosze);
      countMap.set(tx.accountId, (countMap.get(tx.accountId) ?? 0) + 1);
      if (isThisMonth) {
        outflowMap.set(tx.accountId, (outflowMap.get(tx.accountId) ?? 0) + tx.amountGrosze);
      }
      if (tx.toAccountId) {
        balanceMap.set(tx.toAccountId, (balanceMap.get(tx.toAccountId) ?? 0) + tx.amountGrosze);
        countMap.set(tx.toAccountId, (countMap.get(tx.toAccountId) ?? 0) + 1);
        if (isThisMonth) {
          inflowMap.set(tx.toAccountId, (inflowMap.get(tx.toAccountId) ?? 0) + tx.amountGrosze);
        }
      }
    }
  }

  const accounts: AccountWithBalance[] = db.accounts.map((acc) => ({
    ...acc,
    currentBalanceGrosze: balanceMap.get(acc.id) ?? acc.initialBalanceGrosze,
    monthlyInflowGrosze: inflowMap.get(acc.id) ?? 0,
    monthlyOutflowGrosze: outflowMap.get(acc.id) ?? 0,
    txCount: countMap.get(acc.id) ?? 0,
  }));

  let cashTotalGrosze = 0;
  let bankTotalGrosze = 0;
  let liquidTotalGrosze = 0;
  let savingsAndInvestGrosze = 0;
  let liabilitiesGrosze = 0;
  let netWorthGrosze = 0;

  for (const acc of accounts) {
    netWorthGrosze += acc.currentBalanceGrosze;
    if (acc.kind === 'cash') cashTotalGrosze += acc.currentBalanceGrosze;
    if (acc.kind === 'bank') bankTotalGrosze += acc.currentBalanceGrosze;
    if (acc.includeInLiquid) liquidTotalGrosze += acc.currentBalanceGrosze;
    if (acc.kind === 'savings' || acc.kind === 'investment') {
      savingsAndInvestGrosze += acc.currentBalanceGrosze;
    }
    if (acc.kind === 'liability') {
      liabilitiesGrosze += acc.currentBalanceGrosze;
    }
  }

  return {
    accounts,
    cashTotalGrosze,
    bankTotalGrosze,
    liquidTotalGrosze,
    savingsAndInvestGrosze,
    liabilitiesGrosze,
    netWorthGrosze,
  };
}

export function getTargetForYear(
  targets: BudgetTargets,
  year: number,
  metric: AnalyticsMetric
): number {
  const override = targets.yearlyOverrides?.[String(year)];
  const expLimit = override?.monthlyExpenseLimitGrosze ?? targets.monthlyExpenseLimitGrosze;
  const incGoal = override?.monthlyIncomeGoalGrosze ?? targets.monthlyIncomeGoalGrosze;

  if (metric === 'expense') return expLimit;
  if (metric === 'income') return incGoal;
  return Math.max(100000, incGoal - expLimit);
}

export function getAvailableYears(transactions: Transaction[], todayStr: string): number[] {
  const currentYear = Number(todayStr.slice(0, 4));
  const years = new Set<number>([currentYear]);
  for (const tx of transactions) {
    const yr = Number(tx.date.slice(0, 4));
    if (Number.isInteger(yr) && yr > 1990 && yr < 2100) {
      years.add(yr);
    }
  }
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * Computes 12 monthly buckets for a selected year & metric.
 */
export function computeMonthlyBucketsForYear(
  db: FinanceDB,
  year: number,
  metric: AnalyticsMetric,
  todayStr: string
): MonthlyBucket[] {
  const targetMonthly = getTargetForYear(db.targets, year, metric);
  const currentYm = todayStr.slice(0, 7);

  const rawMonths = Array.from({ length: 12 }, (_, mIdx) => {
    const mm = String(mIdx + 1).padStart(2, '0');
    const ym = `${year}-${mm}`;
    return {
      ym,
      year,
      monthIndex: mIdx,
      label: POLISH_MONTHS_SHORT[mIdx],
      incomeGrosze: 0,
      expenseGrosze: 0,
      plannedIncomeGrosze: 0,
      plannedExpenseGrosze: 0,
      hasRealizedTx: false,
      hasPlannedTx: false,
    };
  });

  for (const tx of db.transactions) {
    if (tx.type === 'transfer') continue;
    const txYear = Number(tx.date.slice(0, 4));
    if (txYear !== year) continue;
    const mIdx = Number(tx.date.slice(5, 7)) - 1;
    if (mIdx < 0 || mIdx > 11) continue;

    const bucket = rawMonths[mIdx];
    if (tx.isPlanned) {
      bucket.hasPlannedTx = true;
      if (tx.type === 'income') bucket.plannedIncomeGrosze += tx.amountGrosze;
      if (tx.type === 'expense') bucket.plannedExpenseGrosze += tx.amountGrosze;
    } else {
      bucket.hasRealizedTx = true;
      if (tx.type === 'income') bucket.incomeGrosze += tx.amountGrosze;
      if (tx.type === 'expense') bucket.expenseGrosze += tx.amountGrosze;
    }
  }

  let cumulativeDiff = 0;

  return rawMonths.map((b) => {
    const netGrosze = b.incomeGrosze - b.expenseGrosze;
    const plannedNetGrosze = b.plannedIncomeGrosze - b.plannedExpenseGrosze;

    const valueGrosze =
      metric === 'income' ? b.incomeGrosze : metric === 'expense' ? b.expenseGrosze : netGrosze;

    const plannedValueGrosze =
      metric === 'income'
        ? b.plannedIncomeGrosze
        : metric === 'expense'
          ? b.plannedExpenseGrosze
          : plannedNetGrosze;

    const isFutureOrEmptyForecast =
      (b.ym > currentYm || (!b.hasRealizedTx && b.hasPlannedTx)) && b.hasPlannedTx;

    // Favorable diff: for income & net, higher than target is positive; for expense, lower than limit is positive!
    const hasActivity = b.hasRealizedTx || b.ym <= currentYm;
    let diffGrosze = 0;
    if (b.hasRealizedTx || (b.ym <= currentYm && !isFutureOrEmptyForecast)) {
      if (metric === 'expense') {
        diffGrosze = targetMonthly - valueGrosze;
      } else {
        diffGrosze = valueGrosze - targetMonthly;
      }
      cumulativeDiff += diffGrosze;
    }

    return {
      ym: b.ym,
      year: b.year,
      monthIndex: b.monthIndex,
      label: b.label,
      incomeGrosze: b.incomeGrosze,
      expenseGrosze: b.expenseGrosze,
      netGrosze,
      plannedIncomeGrosze: b.plannedIncomeGrosze,
      plannedExpenseGrosze: b.plannedExpenseGrosze,
      plannedNetGrosze,
      targetGrosze: targetMonthly,
      valueGrosze,
      plannedValueGrosze,
      diffGrosze,
      cumulativeDiffGrosze: cumulativeDiff,
      hasData: hasActivity,
      isForecastOnly: isFutureOrEmptyForecast,
    };
  });
}

/**
 * Computes annual paired comparison rows for "Wszystko razem" view.
 */
export function computeAnnualSummary(
  db: FinanceDB,
  metric: AnalyticsMetric,
  todayStr: string
): AnnualSummaryRow[] {
  const years = getAvailableYears(db.transactions, todayStr);
  const currentYear = Number(todayStr.slice(0, 4));
  const currentMonthIdx = Number(todayStr.slice(5, 7)) - 1;

  const rows: AnnualSummaryRow[] = [];

  for (let i = 0; i < years.length; i++) {
    const yr = years[i];
    const buckets = computeMonthlyBucketsForYear(db, yr, metric, todayStr);

    // Settled months: months with realized tx or elapsed up to current month (excluding forecast-only future months)
    const activeBuckets = buckets.filter((b) => {
      if (yr < currentYear) return b.incomeGrosze > 0 || b.expenseGrosze > 0 || true;
      return b.monthIndex <= currentMonthIdx && !b.isForecastOnly;
    });

    const settledBuckets = buckets.filter((b) =>
      yr < currentYear ? !b.isForecastOnly : b.monthIndex <= currentMonthIdx && !b.isForecastOnly
    );

    const monthsWithAnyActivity = settledBuckets.filter(
      (b) => b.incomeGrosze > 0 || b.expenseGrosze > 0
    );

    // If year has no transactions at all and isn't currentYear, skip
    if (monthsWithAnyActivity.length === 0 && yr !== currentYear) continue;

    const firstActiveIdx =
      monthsWithAnyActivity.length > 0 ? monthsWithAnyActivity[0].monthIndex : 0;
    const lastActiveIdx =
      yr === currentYear
        ? Math.max(currentMonthIdx, monthsWithAnyActivity[monthsWithAnyActivity.length - 1]?.monthIndex ?? 0)
        : 11;

    const spanCount = Math.max(1, lastActiveIdx - firstActiveIdx + 1);
    const spannedBuckets = settledBuckets.filter(
      (b) => b.monthIndex >= firstActiveIdx && b.monthIndex <= lastActiveIdx
    );

    const incomeGrosze = spannedBuckets.reduce((acc, b) => acc + b.incomeGrosze, 0);
    const expenseGrosze = spannedBuckets.reduce((acc, b) => acc + b.expenseGrosze, 0);
    const netGrosze = incomeGrosze - expenseGrosze;
    const valueGrosze =
      metric === 'income' ? incomeGrosze : metric === 'expense' ? expenseGrosze : netGrosze;

    const monthlyTarget = getTargetForYear(db.targets, yr, metric);
    const targetGrosze = monthlyTarget * spanCount;

    const zeroMonths = spannedBuckets.filter((b) =>
      metric === 'income' ? b.incomeGrosze === 0 : metric === 'expense' ? b.expenseGrosze === 0 : false
    ).length;

    const realizationPct =
      targetGrosze > 0
        ? metric === 'expense'
          ? Math.round((valueGrosze / targetGrosze) * 100)
          : Math.round((valueGrosze / targetGrosze) * 100)
        : 0;

    const avgMonthlyGrosze = Math.round(valueGrosze / spanCount);
    const bestMonthGrosze =
      spannedBuckets.length > 0
        ? metric === 'expense'
          ? Math.min(...spannedBuckets.map((b) => b.valueGrosze))
          : Math.max(...spannedBuckets.map((b) => b.valueGrosze))
        : 0;

    const prev = rows[rows.length - 1];
    let yoyPct: number | null = null;
    let yoyDiffGrosze: number | null = null;
    if (prev && Math.abs(prev.valueGrosze) > 0) {
      yoyDiffGrosze = valueGrosze - prev.valueGrosze;
      yoyPct = Math.round(((valueGrosze - prev.valueGrosze) / Math.abs(prev.valueGrosze)) * 1000) / 10;
    }

    rows.push({
      year: yr,
      monthsActive: spanCount,
      zeroMonths,
      isIncomplete: spanCount < 12,
      incomeGrosze,
      expenseGrosze,
      netGrosze,
      valueGrosze,
      targetGrosze,
      realizationPct,
      avgMonthlyGrosze,
      bestMonthGrosze,
      yoyPct,
      yoyDiffGrosze,
    });
    void activeBuckets;
  }

  return rows;
}

/**
 * Computes stacked category series and breakdown table for a specific year.
 */
export function computeCategoryBreakdown(
  db: FinanceDB,
  year: number,
  mode: 'expense' | 'income'
): {
  rows: CategoryBreakdownRow[];
  totalRealizedGrosze: number;
  totalPlannedGrosze: number;
} {
  const categories = db.categories.filter((c) => c.type === mode);
  const map = new Map<
    string,
    {
      cat: Category;
      realized: number;
      planned: number;
      monthly: Array<{ realized: number; planned: number }>;
    }
  >();

  for (const c of categories) {
    map.set(c.id, {
      cat: c,
      realized: 0,
      planned: 0,
      monthly: Array.from({ length: 12 }, () => ({ realized: 0, planned: 0 })),
    });
  }

  // Ensure fallback bucket for adjustments/other
  const otherId = `__other_${mode}`;

  for (const tx of db.transactions) {
    if (tx.type !== mode) continue;
    if (Number(tx.date.slice(0, 4)) !== year) continue;
    const mIdx = Number(tx.date.slice(5, 7)) - 1;
    if (mIdx < 0 || mIdx > 11) continue;

    let entry = map.get(tx.categoryId);
    if (!entry) {
      if (!map.has(otherId)) {
        map.set(otherId, {
          cat: {
            id: otherId,
            name: tx.isAdjustment ? 'Korekta gotówki' : 'Inne',
            type: mode,
            icon: 'sliders-horizontal',
            color: '#6b8278',
          },
          realized: 0,
          planned: 0,
          monthly: Array.from({ length: 12 }, () => ({ realized: 0, planned: 0 })),
        });
      }
      entry = map.get(otherId)!;
    }

    if (tx.isPlanned) {
      entry.planned += tx.amountGrosze;
      entry.monthly[mIdx].planned += tx.amountGrosze;
    } else {
      entry.realized += tx.amountGrosze;
      entry.monthly[mIdx].realized += tx.amountGrosze;
    }
  }

  let totalRealizedGrosze = 0;
  let totalPlannedGrosze = 0;
  for (const item of map.values()) {
    totalRealizedGrosze += item.realized;
    totalPlannedGrosze += item.planned;
  }

  const rows: CategoryBreakdownRow[] = Array.from(map.values())
    .filter((item) => item.realized > 0 || item.planned > 0)
    .sort((a, b) => b.realized + b.planned - (a.realized + a.planned))
    .map((item) => {
      const budgetYearGrosze = item.cat.monthlyBudgetGrosze
        ? item.cat.monthlyBudgetGrosze * 12
        : 0;
      return {
        categoryId: item.cat.id,
        name: item.cat.name,
        color: item.cat.color,
        icon: item.cat.icon,
        totalGrosze: item.realized,
        plannedGrosze: item.planned,
        sharePct:
          totalRealizedGrosze > 0
            ? Math.round((item.realized / totalRealizedGrosze) * 1000) / 10
            : 0,
        budgetYearGrosze,
        budgetPct:
          budgetYearGrosze > 0 ? Math.round((item.realized / budgetYearGrosze) * 100) : null,
        monthlySeries: item.monthly,
      };
    });

  return { rows, totalRealizedGrosze, totalPlannedGrosze };
}

export interface RollingPoint {
  ym: string;
  label: string;
  year: number;
  monthIndex: number;
  singleValueGrosze: number;
  rollingAvgGrosze: number | null;
}

/**
 * Computes continuous monthly series across all active years + rolling average (3M, 6M, or 12M).
 */
export function computeRollingTrend(
  db: FinanceDB,
  metric: AnalyticsMetric,
  windowSize: RollingWindow,
  todayStr: string
): {
  points: RollingPoint[];
  latestAvgGrosze: number | null;
  yoyChangePct: number | null;
  peak: { valueGrosze: number; label: string } | null;
  trough: { valueGrosze: number; label: string } | null;
} {
  const years = getAvailableYears(db.transactions, todayStr);
  const currentYm = todayStr.slice(0, 7);

  const flatMonths: Array<{
    ym: string;
    label: string;
    year: number;
    monthIndex: number;
    value: number;
  }> = [];

  for (const yr of years) {
    const buckets = computeMonthlyBucketsForYear(db, yr, metric, todayStr);
    for (const b of buckets) {
      if (b.ym > currentYm) continue;
      if (b.isForecastOnly) continue;
      const hasTx = b.incomeGrosze > 0 || b.expenseGrosze > 0;
      if (flatMonths.length === 0 && !hasTx) continue; // trim leading empty months
      flatMonths.push({
        ym: b.ym,
        label: `${b.label} ${b.year}`,
        year: b.year,
        monthIndex: b.monthIndex,
        value: b.valueGrosze,
      });
    }
  }

  const points: RollingPoint[] = flatMonths.map((item, idx) => {
    let rollingAvgGrosze: number | null = null;
    if (idx + 1 >= windowSize) {
      let sum = 0;
      for (let j = idx - windowSize + 1; j <= idx; j++) {
        sum += flatMonths[j].value;
      }
      rollingAvgGrosze = Math.round(sum / windowSize);
    }
    return {
      ym: item.ym,
      label: item.label,
      year: item.year,
      monthIndex: item.monthIndex,
      singleValueGrosze: item.value,
      rollingAvgGrosze,
    };
  });

  const withRolling = points.filter((p) => p.rollingAvgGrosze !== null);
  const latestPoint = withRolling[withRolling.length - 1] ?? null;
  const latestAvgGrosze = latestPoint?.rollingAvgGrosze ?? null;

  let yoyChangePct: number | null = null;
  if (latestPoint && withRolling.length > 12) {
    const yearAgoPoint = withRolling[withRolling.length - 13];
    if (yearAgoPoint?.rollingAvgGrosze && Math.abs(yearAgoPoint.rollingAvgGrosze) > 0) {
      yoyChangePct =
        Math.round(
          (((latestPoint.rollingAvgGrosze ?? 0) - yearAgoPoint.rollingAvgGrosze) /
            Math.abs(yearAgoPoint.rollingAvgGrosze)) *
            1000
        ) / 10;
    }
  }

  let peak: { valueGrosze: number; label: string } | null = null;
  let trough: { valueGrosze: number; label: string } | null = null;
  for (const p of withRolling) {
    const val = p.rollingAvgGrosze!;
    if (!peak || val > peak.valueGrosze) {
      peak = { valueGrosze: val, label: p.label };
    }
    if (!trough || val < trough.valueGrosze) {
      trough = { valueGrosze: val, label: p.label };
    }
  }

  return {
    points,
    latestAvgGrosze,
    yoyChangePct,
    peak,
    trough,
  };
}

export interface HeatmapRow {
  year: number;
  cells: Array<{
    ym: string;
    monthIndex: number;
    valueGrosze: number;
    plannedGrosze: number;
    incomeGrosze: number;
    expenseGrosze: number;
    isEmpty: boolean;
    isForecast: boolean;
  }>;
}

export function computeHeatmapMatrix(
  db: FinanceDB,
  metric: AnalyticsMetric,
  todayStr: string
): HeatmapRow[] {
  const years = getAvailableYears(db.transactions, todayStr);
  const currentYm = todayStr.slice(0, 7);

  return years
    .map((yr) => {
      const buckets = computeMonthlyBucketsForYear(db, yr, metric, todayStr);
      const hasAnyYearData = buckets.some(
        (b) => b.incomeGrosze > 0 || b.expenseGrosze > 0 || b.plannedIncomeGrosze > 0 || b.plannedExpenseGrosze > 0
      );
      if (!hasAnyYearData && yr !== Number(todayStr.slice(0, 4))) return null;

      return {
        year: yr,
        cells: buckets.map((b) => {
          const isFuture = b.ym > currentYm;
          const hasRealized = b.incomeGrosze > 0 || b.expenseGrosze > 0;
          const hasPlanned = b.plannedIncomeGrosze > 0 || b.plannedExpenseGrosze > 0;
          return {
            ym: b.ym,
            monthIndex: b.monthIndex,
            valueGrosze: b.valueGrosze,
            plannedGrosze: b.plannedValueGrosze,
            incomeGrosze: b.incomeGrosze,
            expenseGrosze: b.expenseGrosze,
            isEmpty: !hasRealized && !hasPlanned && isFuture,
            isForecast: !hasRealized && hasPlanned,
          };
        }),
      };
    })
    .filter((r): r is HeatmapRow => r !== null);
}

/**
 * Computes monthly net worth trajectory across the last N months by walking backwards from current netWorth.
 */
export function computeNetWorthHistory(
  db: FinanceDB,
  todayStr: string,
  monthsCount = 12
): Array<{ ym: string; label: string; netWorthGrosze: number }> {
  const { netWorthGrosze } = computeAccountsSummary(db, todayStr);
  const [curY, curM] = todayStr.split('-').map(Number);

  // Build ordered list of last N months ending at current month
  const months: Array<{ ym: string; label: string }> = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(curY, curM - 1 - i, 1));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    months.push({ ym, label: `${POLISH_MONTHS_SHORT[m]} ${String(y).slice(2)}` });
  }

  // Net change per month from realized non-transfer transactions
  const monthlyDelta = new Map<string, number>();
  for (const tx of db.transactions) {
    if (tx.isPlanned || tx.type === 'transfer') continue;
    const ym = tx.date.slice(0, 7);
    const delta = tx.type === 'income' ? tx.amountGrosze : -tx.amountGrosze;
    monthlyDelta.set(ym, (monthlyDelta.get(ym) ?? 0) + delta);
  }

  // Walk backwards from current month end
  const results: Array<{ ym: string; label: string; netWorthGrosze: number }> = [];
  let running = netWorthGrosze;

  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    results.unshift({
      ym: m.ym,
      label: m.label,
      netWorthGrosze: running,
    });
    running -= monthlyDelta.get(m.ym) ?? 0;
  }

  return results;
}
