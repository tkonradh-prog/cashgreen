'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { addDays, formatDateGroupLabel, formatPLN } from '@/lib/format';
import { AppTab, Transaction } from '@/lib/types';
import { useFinance } from '../FinanceProvider';
import { AnimatedPLN } from '../ui/AnimatedPLN';
import { SearchInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { AccountKindIcon, CategoryIcon } from '../ui/IconMap';
import { useToast } from '../ui/ToastProvider';

type TypeFilter = 'all' | 'expense' | 'income' | 'transfer' | 'planned';
type PeriodFilter = 'this_month' | 'last_30' | 'last_90' | 'this_year' | 'all';

export function HistoryView({
  onEditTransaction,
  onNavigateTab,
  initialMonthFilter,
  onClearInitialMonthFilter,
}: {
  onEditTransaction: (tx: Transaction) => void;
  onNavigateTab: (tab: AppTab) => void;
  initialMonthFilter?: string | null;
  onClearInitialMonthFilter?: () => void;
}) {
  const {
    db,
    todayStr,
    accountsSummary,
    deleteTransaction,
    realizePlannedTransaction,
    undoLast,
  } = useFinance();
  const { pushToast } = useToast();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    initialMonthFilter ? 'all' : 'this_month'
  );
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount_desc'>('newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(db.categories.map((c) => [c.id, c])),
    [db.categories]
  );
  const accountMap = useMemo(
    () => new Map(accountsSummary.accounts.map((a) => [a.id, a])),
    [accountsSummary.accounts]
  );

  const filteredTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const curYm = todayStr.slice(0, 7);
    const curYear = todayStr.slice(0, 4);
    const d30 = addDays(todayStr, -30);
    const d90 = addDays(todayStr, -90);

    return db.transactions
      .filter((tx) => {
        if (initialMonthFilter && tx.date.slice(0, 7) !== initialMonthFilter) {
          return false;
        }
        if (typeFilter === 'planned') {
          if (!tx.isPlanned) return false;
        } else if (typeFilter !== 'all') {
          if (tx.type !== typeFilter) return false;
        }

        if (accountFilter !== 'all') {
          if (tx.accountId !== accountFilter && tx.toAccountId !== accountFilter) return false;
        }

        if (categoryFilter !== 'all') {
          if (tx.categoryId !== categoryFilter) return false;
        }

        if (!initialMonthFilter) {
          if (periodFilter === 'this_month' && tx.date.slice(0, 7) !== curYm) return false;
          if (periodFilter === 'last_30' && tx.date < d30) return false;
          if (periodFilter === 'last_90' && tx.date < d90) return false;
          if (periodFilter === 'this_year' && tx.date.slice(0, 4) !== curYear) return false;
        }

        if (q) {
          const catName = categoryMap.get(tx.categoryId)?.name.toLowerCase() ?? '';
          const accName = accountMap.get(tx.accountId)?.name.toLowerCase() ?? '';
          const amtText = formatPLN(tx.amountGrosze).toLowerCase();
          const haystack = `${tx.title} ${tx.note ?? ''} ${catName} ${accName} ${amtText}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'amount_desc') return b.amountGrosze - a.amountGrosze;
        if (sortOrder === 'oldest') {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return (a.time ?? '00:00').localeCompare(b.time ?? '00:00');
        }
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time ?? '00:00').localeCompare(a.time ?? '00:00');
      });
  }, [
    db.transactions,
    query,
    typeFilter,
    accountFilter,
    categoryFilter,
    periodFilter,
    sortOrder,
    todayStr,
    initialMonthFilter,
    categoryMap,
    accountMap,
  ]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filteredTransactions) {
      if (tx.isPlanned) continue;
      if (tx.type === 'income') income += tx.amountGrosze;
      if (tx.type === 'expense') expense += tx.amountGrosze;
    }
    return {
      count: filteredTransactions.length,
      income,
      expense,
      net: income - expense,
    };
  }, [filteredTransactions]);

  const groupedByDate = useMemo(() => {
    if (sortOrder === 'amount_desc') {
      return [{ date: 'all', items: filteredTransactions, netGrosze: stats.net }];
    }
    const groups: Array<{ date: string; items: Transaction[]; netGrosze: number }> = [];
    const indexMap = new Map<string, number>();

    for (const tx of filteredTransactions) {
      let idx = indexMap.get(tx.date);
      if (idx === undefined) {
        idx = groups.length;
        indexMap.set(tx.date, idx);
        groups.push({ date: tx.date, items: [], netGrosze: 0 });
      }
      groups[idx].items.push(tx);
      if (!tx.isPlanned) {
        if (tx.type === 'income') groups[idx].netGrosze += tx.amountGrosze;
        if (tx.type === 'expense') groups[idx].netGrosze -= tx.amountGrosze;
      }
    }
    return groups;
  }, [filteredTransactions, sortOrder, stats.net]);

  const hasActiveFilters =
    query !== '' ||
    typeFilter !== 'all' ||
    accountFilter !== 'all' ||
    categoryFilter !== 'all' ||
    periodFilter !== 'this_month' ||
    Boolean(initialMonthFilter);

  const resetFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
    setPeriodFilter('this_month');
    onClearInitialMonthFilter?.();
  };

  const activeFiltersCount = [
    typeFilter !== 'all',
    accountFilter !== 'all',
    categoryFilter !== 'all',
    periodFilter !== 'this_month',
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* KPI Summary Strip */}
      <div className="finte-card p-4 sm:p-7 space-y-4 animate-card-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Historia operacji
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {initialMonthFilter
                ? `Podgląd miesiąca: ${initialMonthFilter}`
                : 'Przeglądaj, filtruj i wyszukuj wpisy w swoim portfelu.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141822] hover:bg-[#1a202c] active:scale-95 border border-[#222938] text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resetuj filtry
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('add')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 active:scale-[0.97] text-black text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-[0_4px_18px_rgba(255,255,255,0.18)]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Nowy wpis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4 animate-card-in stagger-1">
            <div className="text-[11px] font-semibold text-neutral-400">Liczba operacji</div>
            <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-white mt-1">
              {stats.count}
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4 animate-card-in stagger-2">
            <div className="text-[11px] font-semibold text-neutral-400">Przychody</div>
            <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#2dd4bf] mt-1">
              <AnimatedPLN valueGrosze={stats.income} />
            </div>
          </div>

          <div className="rounded-2xl ios-glass-inset p-3.5 sm:p-4 animate-card-in stagger-3">
            <div className="text-[11px] font-semibold text-neutral-400">Wydatki</div>
            <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#f87171] mt-1">
              <AnimatedPLN valueGrosze={stats.expense} />
            </div>
          </div>

          <div className="rounded-2xl finte-card-elevated p-3.5 sm:p-4 animate-card-in stagger-4">
            <div className="text-[11px] font-semibold text-neutral-400">Bilans widoku</div>
            <div
              className={`text-xl sm:text-2xl font-extrabold tabular-nums mt-1 ${
                stats.net < 0 ? 'text-[#f87171]' : 'text-white'
              }`}
            >
              <AnimatedPLN valueGrosze={stats.net} showSign />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Mobile Collapsible for Fast Scanning) */}
      <div className="finte-card p-3.5 sm:p-5 space-y-3 animate-card-in stagger-2">
        <div className="flex items-center gap-2 sm:hidden">
          <SearchInput
            value={query}
            onChange={setQuery}
            className="flex-1"
            placeholder="Szukaj operacji..."
          />
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((o) => !o)}
            className={`h-[46px] px-3.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer ${
              mobileFiltersOpen || activeFiltersCount > 0
                ? 'bg-white/95 text-black border border-white shadow-[0_4px_14px_rgba(255,255,255,0.2)]'
                : 'ios-glass-pill text-neutral-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtry</span>
            {activeFiltersCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                  mobileFiltersOpen || activeFiltersCount > 0
                    ? 'bg-black/15 text-black'
                    : 'bg-white/10 text-white'
                }`}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:grid-rows-[1fr] sm:opacity-100 sm:pointer-events-auto sm:overflow-visible ${
            mobileFiltersOpen
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0 pointer-events-none !mt-0 sm:!mt-3'
          }`}
        >
          <div className="overflow-hidden min-h-0 sm:overflow-visible">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-0.5">
          <SearchInput
            value={query}
            onChange={setQuery}
            className="hidden sm:flex lg:col-span-4"
            placeholder="Szukaj operacji, kwoty, notatki..."
          />

          <div className="lg:col-span-2">
            <CustomSelect<TypeFilter>
              compact
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'Wszystkie typy' },
                { value: 'expense', label: 'Tylko wydatki', dotColor: '#f87171' },
                { value: 'income', label: 'Tylko przychody', dotColor: '#ffffff' },
                { value: 'transfer', label: 'Transfery', dotColor: '#3b82f6' },
                { value: 'planned', label: 'Planowane', dotColor: '#e5c07b' },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <CustomSelect
              compact
              value={accountFilter}
              onChange={setAccountFilter}
              options={[
                { value: 'all', label: 'Wszystkie konta' },
                ...accountsSummary.accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  dotColor: a.color,
                  icon: <AccountKindIcon kind={a.kind} className="w-3.5 h-3.5" />,
                })),
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <CustomSelect
              compact
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'all', label: 'Wszystkie kategorie' },
                ...db.categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  dotColor: c.color,
                  icon: <CategoryIcon name={c.icon} className="w-3.5 h-3.5" />,
                })),
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <CustomSelect<PeriodFilter>
              compact
              value={periodFilter}
              onChange={(val) => {
                onClearInitialMonthFilter?.();
                setPeriodFilter(val);
              }}
                options={[
                  { value: 'this_month', label: 'Bieżący miesiąc' },
                  { value: 'last_30', label: 'Ostatnie 30 dni' },
                  { value: 'last_90', label: 'Ostatnie 90 dni' },
                  { value: 'this_year', label: `Cały rok ${todayStr.slice(0, 4)}` },
                  { value: 'all', label: 'Wszystkie' },
                ]}
              />
            </div>
          </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-neutral-400 pt-1">
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <span>Pozycji w widoku:</span> <strong className="text-white">{filteredTransactions.length}</strong>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-neutral-500 shrink-0 mr-1">Sortuj:</span>
            {[
              { id: 'newest' as const, label: 'Najnowsze' },
              { id: 'oldest' as const, label: 'Najstarsze' },
              { id: 'amount_desc' as const, label: 'Kwota' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortOrder(s.id)}
                className={`px-3 py-1 rounded-xl transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap shrink-0 ${
                  sortOrder === s.id
                    ? 'bg-white text-black shadow-xs'
                    : 'text-neutral-400 hover:text-white bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped Transaction Ledger */}
      {filteredTransactions.length === 0 ? (
        <div className="finte-card p-12 text-center space-y-3">
          <div className="text-sm font-bold text-white">
            Brak operacji spełniających wybrane kryteria
          </div>
          <p className="text-xs text-neutral-500">
            Zmień zakres czasu, wyczyść wyszukiwarkę lub dodaj nowy wydatek.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#141822] border border-[#222938] text-xs font-semibold text-white cursor-pointer"
            >
              Pokaż bieżący miesiąc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <div key={group.date} className="finte-card overflow-hidden">
              {group.date !== 'all' && (
                <div className="px-4 sm:px-5 py-3 bg-white/[0.035] border-b border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide text-neutral-200">
                    {formatDateGroupLabel(group.date, todayStr)}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      group.netGrosze > 0
                        ? 'text-white'
                        : group.netGrosze < 0
                          ? 'text-[#f87171]'
                          : 'text-neutral-500'
                    }`}
                  >
                    {group.netGrosze === 0
                      ? '0,00 zł'
                      : formatPLN(group.netGrosze, { showSign: true })}
                  </span>
                </div>
              )}

              <div className="divide-y divide-white/[0.06]">
                {group.items.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
                  const amountColor =
                    tx.type === 'income'
                      ? 'text-white'
                      : tx.type === 'expense'
                        ? 'text-neutral-300'
                        : 'text-neutral-400';
                  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '⇄ ';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors cursor-pointer ${
                        tx.isPlanned ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-white"
                          style={{
                            backgroundColor: `${cat?.color ?? '#ffffff'}15`,
                            color: cat?.color ?? '#ffffff',
                            border: `1px solid ${cat?.color ?? '#ffffff'}30`,
                          }}
                        >
                          {tx.type === 'transfer' ? (
                            <ArrowLeftRight className="w-4 h-4" />
                          ) : (
                            <CategoryIcon name={cat?.icon} className="w-4 h-4" />
                          )}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-white truncate">
                              {tx.title}
                            </span>
                            {tx.isPlanned && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                                Planowane
                              </span>
                            )}
                            {tx.isAdjustment && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Korekta
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] sm:text-xs text-neutral-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span>
                              {tx.type === 'transfer'
                                ? `${acc?.name ?? ''} → ${toAcc?.name ?? ''}`
                                : `${cat?.name ?? (tx.isAdjustment ? 'Wyrównanie' : 'Inne')} · ${acc?.name ?? ''}`}
                            </span>
                            {group.date === 'all' && <span>• {tx.date}</span>}
                            {tx.time && <span className="hidden sm:inline">• {tx.time}</span>}
                            {tx.note && <span className="text-neutral-500 truncate">({tx.note})</span>}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 sm:gap-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className={`text-sm sm:text-base font-bold tabular-nums ${
                            tx.type === 'income' ? 'text-[#2dd4bf]' : amountColor
                          }`}
                        >
                          {sign}
                          {formatPLN(tx.amountGrosze)}
                        </span>

                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {tx.isPlanned && (
                            <button
                              type="button"
                              title="Rozlicz teraz"
                              onClick={() => {
                                realizePlannedTransaction(tx.id);
                                pushToast({
                                  message: 'Zrealizowano planowany wpis',
                                  detail: tx.title,
                                  tone: 'info',
                                  onUndo: undoLast,
                                });
                              }}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 text-white transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Edytuj"
                            onClick={() => onEditTransaction(tx)}
                            className="hidden sm:inline-flex p-2 rounded-lg hover:bg-white/10 active:scale-90 text-neutral-400 hover:text-white transition-all cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Usuń"
                            onClick={() => {
                              deleteTransaction(tx.id);
                              pushToast({
                                message: 'Usunięto operację',
                                detail: tx.title,
                                tone: 'coral',
                                onUndo: undoLast,
                              });
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/15 active:scale-90 text-neutral-400 hover:text-red-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
