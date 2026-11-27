'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  Copy,
  MessageSquarePlus,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatDateGroupLabel, formatPLN, groszeToInputString, parsePLNInput } from '@/lib/format';
import { AppTab, Transaction, TransactionType } from '@/lib/types';
import { SYSTEM_CATEGORY_TRANSFER, useFinance } from '../FinanceProvider';
import { AnimatedPLN } from '../ui/AnimatedPLN';
import { CategoryPicker } from '../ui/CategoryPicker';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { AmountInput, CustomInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { ACCOUNT_KIND_META, AccountKindIcon, CategoryIcon } from '../ui/IconMap';
import { SegmentedTabs } from '../ui/SegmentedTabs';
import { useToast } from '../ui/ToastProvider';

const QUICK_PRESETS: Record<
  TransactionType,
  Array<{ title: string; categoryId?: string }>
> = {
  expense: [
    { title: 'Zakupy spożywcze', categoryId: 'cat-food' },
    { title: 'Kawa / Lunch', categoryId: 'cat-coffee' },
    { title: 'Paliwo', categoryId: 'cat-transport' },
    { title: 'Zdrowie', categoryId: 'cat-health' },
  ],
  income: [
    { title: 'Wynagrodzenie', categoryId: 'cat-salary' },
    { title: 'Zlecenie', categoryId: 'cat-freelance' },
    { title: 'Zwrot', categoryId: 'cat-invest-inc' },
  ],
  transfer: [
    { title: 'Bankomat → gotówka' },
    { title: 'Na oszczędności' },
  ],
};

export function AddTransactionView({
  preselectedAccountId,
  onClearPreselectedAccount,
  onOpenReconcile,
  onEditTransaction,
  onNavigateTab,
}: {
  preselectedAccountId?: string | null;
  onClearPreselectedAccount?: () => void;
  onOpenReconcile: (accountId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onNavigateTab: (tab: AppTab) => void;
}) {
  const {
    db,
    todayStr,
    accountsSummary,
    addTransaction,
    deleteTransaction,
    addCategory,
    undoLast,
  } = useFinance();
  const { pushToast } = useToast();

  const defaultCashId =
    accountsSummary.accounts.find((a) => a.kind === 'cash')?.id ??
    accountsSummary.accounts[0]?.id ??
    '';
  const defaultBankId =
    accountsSummary.accounts.find((a) => a.kind === 'bank')?.id ??
    accountsSummary.accounts[1]?.id ??
    defaultCashId;

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [title, setTitle] = useState('');
  const [accountId, setAccountId] = useState(preselectedAccountId || defaultCashId);
  const [toAccountId, setToAccountId] = useState(
    defaultCashId === defaultBankId ? '' : defaultBankId
  );
  const [categoryId, setCategoryId] = useState(
    db.categories.find((c) => c.type === 'expense')?.id ?? ''
  );
  const [date, setDate] = useState(todayStr);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [isPlanned, setIsPlanned] = useState(false);
  const [error, setError] = useState('');

  const effectiveAccountId = preselectedAccountId || accountId;
  const resolvedAccountId = accountsSummary.accounts.some((a) => a.id === effectiveAccountId)
    ? effectiveAccountId
    : accountsSummary.accounts[0]?.id ?? '';

  const resolvedCategoryId = useMemo(() => {
    if (type === 'transfer') return SYSTEM_CATEGORY_TRANSFER;
    if (db.categories.some((c) => c.id === categoryId && c.type === type)) {
      return categoryId;
    }
    return db.categories.find((c) => c.type === type)?.id ?? '';
  }, [db.categories, categoryId, type]);

  const resolvedToAccountId = useMemo(() => {
    if (
      toAccountId &&
      toAccountId !== resolvedAccountId &&
      accountsSummary.accounts.some((a) => a.id === toAccountId)
    ) {
      return toAccountId;
    }
    return (
      accountsSummary.accounts.find((a) => a.id !== resolvedAccountId)?.id ?? resolvedAccountId
    );
  }, [toAccountId, resolvedAccountId, accountsSummary.accounts]);

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    setError('');
    if (next === 'expense' || next === 'income') {
      const cat = db.categories.find((c) => c.type === next);
      if (cat) setCategoryId(cat.id);
    }
    if (next === 'transfer' && !preselectedAccountId) {
      setAccountId(defaultBankId);
      setToAccountId(defaultCashId);
    }
  };

  const parsedAmount = parsePLNInput(amountStr);
  const sourceAcc = accountsSummary.accounts.find((a) => a.id === resolvedAccountId);
  const destAcc = accountsSummary.accounts.find((a) => a.id === resolvedToAccountId);

  const previewNode = useMemo(() => {
    if (!sourceAcc || !parsedAmount) return null;

    if (type === 'expense') {
      const after = sourceAcc.currentBalanceGrosze - parsedAmount;
      return (
        <div className="rounded-xl bg-[#090b0f] border border-[#1e2330] px-4 py-2.5 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-neutral-400">
            Po zapisie <strong className="text-white">{sourceAcc.name}</strong>:
          </span>
          <span className="tabular-nums font-semibold">
            <span className="text-neutral-500 line-through mr-2">
              {formatPLN(sourceAcc.currentBalanceGrosze)}
            </span>
            <span className={after < 0 ? 'text-[#f87171]' : 'text-white'}>
              {formatPLN(after)}
            </span>
          </span>
        </div>
      );
    }

    if (type === 'income') {
      const after = sourceAcc.currentBalanceGrosze + parsedAmount;
      return (
        <div className="rounded-xl bg-[#090b0f] border border-[#1e2330] px-4 py-2.5 flex items-center justify-between text-xs animate-fade-in">
          <span className="text-neutral-400">
            Po wpływie <strong className="text-white">{sourceAcc.name}</strong>:
          </span>
          <span className="tabular-nums font-semibold text-white">{formatPLN(after)}</span>
        </div>
      );
    }

    if (type === 'transfer' && destAcc && destAcc.id !== sourceAcc.id) {
      return (
        <div className="rounded-xl bg-[#090b0f] border border-[#1e2330] px-4 py-2.5 space-y-1 text-xs animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">{sourceAcc.name}:</span>
            <span className="tabular-nums font-semibold text-[#f87171]">
              {formatPLN(sourceAcc.currentBalanceGrosze - parsedAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">{destAcc.name}:</span>
            <span className="tabular-nums font-semibold text-white">
              {formatPLN(destAcc.currentBalanceGrosze + parsedAmount)}
            </span>
          </div>
        </div>
      );
    }

    return null;
  }, [sourceAcc, destAcc, parsedAmount, type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountGrosze = parsePLNInput(amountStr);
    if (!amountGrosze) {
      setError('Wpisz kwotę większą od 0,00 zł');
      return;
    }
    if (!resolvedAccountId) {
      setError('Wybierz konto lub portfel');
      return;
    }
    if (type === 'transfer' && resolvedAccountId === resolvedToAccountId) {
      setError('Konto źródłowe i docelowe muszą być różne');
      return;
    }

    const fallbackTitle =
      type === 'transfer'
        ? `Przelew: ${sourceAcc?.name ?? ''} → ${destAcc?.name ?? ''}`
        : db.categories.find((c) => c.id === resolvedCategoryId)?.name ?? 'Operacja';

    const created = addTransaction({
      type,
      amountGrosze,
      date,
      accountId: resolvedAccountId,
      toAccountId: type === 'transfer' ? resolvedToAccountId : undefined,
      categoryId: type === 'transfer' ? SYSTEM_CATEGORY_TRANSFER : resolvedCategoryId,
      title: title.trim() || fallbackTitle,
      note: note.trim() || undefined,
      isPlanned: isPlanned || undefined,
    });

    pushToast({
      message: isPlanned
        ? 'Zapisano planowaną operację'
        : type === 'expense'
          ? 'Zapisano wydatek'
          : type === 'income'
            ? 'Zapisano przychód'
            : 'Wykonano przelew',
      detail: `${created.title} · ${formatPLN(created.amountGrosze)}`,
      tone: type === 'expense' ? 'coral' : 'info',
      onUndo: undoLast,
    });

    setAmountStr('');
    setTitle('');
    setNote('');
    setShowNote(false);
    setIsPlanned(false);
    setError('');
    onClearPreselectedAccount?.();
  };

  const handleRepeatTx = (tx: Transaction) => {
    setType(tx.type);
    setAmountStr(groszeToInputString(tx.amountGrosze));
    setTitle(tx.title);
    setAccountId(tx.accountId);
    if (tx.toAccountId) setToAccountId(tx.toAccountId);
    if (tx.type !== 'transfer') setCategoryId(tx.categoryId);
    setIsPlanned(Boolean(tx.isPlanned));
    setDate(todayStr);
    onClearPreselectedAccount?.();
    pushToast({
      message: 'Wczytano do formularza',
      tone: 'info',
    });
  };

  const recentTransactions = useMemo(() => {
    return [...db.transactions]
      .filter((t) => !t.isPlanned)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time ?? '00:00').localeCompare(a.time ?? '00:00');
      })
      .slice(0, 5);
  }, [db.transactions]);

  const accountOptions = accountsSummary.accounts.map((acc) => ({
    value: acc.id,
    label: acc.name,
    description: ACCOUNT_KIND_META[acc.kind].shortLabel,
    badgeText: formatPLN(acc.currentBalanceGrosze),
    badgeColor: acc.currentBalanceGrosze < 0 ? '#f87171' : '#ffffff',
    dotColor: acc.color,
    icon: <AccountKindIcon kind={acc.kind} className="w-4 h-4" />,
  }));

  const categoryMap = useMemo(
    () => new Map(db.categories.map((c) => [c.id, c])),
    [db.categories]
  );
  const accountMap = useMemo(
    () => new Map(accountsSummary.accounts.map((a) => [a.id, a])),
    [accountsSummary.accounts]
  );

  return (
    <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
      {/* Luxury iOS Frosted Glass Balance Hero (Mobile & Tablet < lg) */}
      <div className="lg:hidden space-y-3.5 animate-card-in">
        <div className="relative overflow-hidden rounded-3xl finte-card-elevated p-5">
          {/* Subtle animated sheen & crystal top reflection */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-sky-400/[0.08] blur-2xl pointer-events-none" />
          <div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent pointer-events-none animate-sheen" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-neutral-300/80 tracking-widest uppercase">
                Dostępne środki
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums mt-1">
                <AnimatedPLN valueGrosze={accountsSummary.liquidTotalGrosze} />
              </div>
            </div>

            {resolvedAccountId && (
              <button
                type="button"
                onClick={() => onOpenReconcile(resolvedAccountId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ios-glass-pill active:scale-95 text-[11px] font-bold text-white transition-all cursor-pointer shrink-0"
              >
                <Scale className="w-3 h-3" />
                Wyrównaj
              </button>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-neutral-300/80 font-medium tabular-nums pt-3.5 mt-3.5 border-t border-white/[0.1]">
            <span className="flex-1 rounded-xl ios-glass-inset px-3 py-1.5 flex items-center justify-between">
              <span className="text-[11px]">Gotówka</span>
              <strong className="text-white font-bold">{formatPLN(accountsSummary.cashTotalGrosze)}</strong>
            </span>
            <span className="flex-1 rounded-xl ios-glass-inset px-3 py-1.5 flex items-center justify-between">
              <span className="text-[11px]">Konta</span>
              <strong className="text-white font-bold">{formatPLN(accountsSummary.bankTotalGrosze)}</strong>
            </span>
          </div>
        </div>

        {/* Responsive Account Selector Grid (No right-edge clipping on phones) */}
        <div
          className={`grid gap-2 ${
            accountsSummary.accounts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {accountsSummary.accounts.map((acc) => {
            const active = acc.id === resolvedAccountId;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onClearPreselectedAccount?.();
                  setAccountId(acc.id);
                }}
                className={`min-w-0 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 border transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                  active
                    ? 'bg-white/95 text-black border-white shadow-[0_6px_20px_rgba(255,255,255,0.24),inset_0_1px_0_rgba(255,255,255,0.9)]'
                    : 'ios-glass-inset hover:bg-white/[0.08] hover:border-white/20 text-neutral-200'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                  }`}
                >
                  <AccountKindIcon kind={acc.kind} className="w-3.5 h-3.5" />
                </span>
                <div className="text-left min-w-0 flex-1">
                  <div
                    className={`text-[11px] font-medium leading-tight truncate ${
                      active ? 'text-black/75' : 'text-neutral-400'
                    }`}
                  >
                    {acc.name}
                  </div>
                  <div className="text-xs font-black tabular-nums mt-0.5 truncate">
                    {formatPLN(acc.currentBalanceGrosze)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Entry Card */}
      <section className="lg:col-span-7 finte-card p-4 sm:p-6 xl:p-7 space-y-5 sm:space-y-6 animate-card-in stagger-1 min-w-0">
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Nowa operacja</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Wpisz kwotę — saldo zaktualizuje się automatycznie.
            </p>
          </div>
          <SegmentedTabs<TransactionType>
            size="sm"
            fullWidth
            className="w-full sm:w-auto lg:w-full xl:w-auto"
            value={type}
            onChange={handleTypeChange}
            items={[
              { value: 'expense', label: 'Wydatek' },
              { value: 'income', label: 'Przychód' },
              { value: 'transfer', label: 'Przelew' },
            ]}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AmountInput
            label={
              type === 'expense'
                ? 'Kwota wydatku'
                : type === 'income'
                  ? 'Kwota wpływu'
                  : 'Kwota przesunięcia'
            }
            value={amountStr}
            onChange={(val) => {
              setAmountStr(val);
              setError('');
            }}
            error={error}
            accent={type === 'expense' ? 'coral' : 'neutral'}
            quickAmountsZloty={[10, 20, 50, 100, 200]}
            previewNode={previewNode}
          />

          {type === 'transfer' ? (
            accountsSummary.accounts.length < 2 ? (
              <div className="rounded-2xl ios-glass-inset p-4 text-xs text-neutral-300 flex items-center justify-between gap-3">
                <span>Potrzebujesz co najmniej dwóch kont, aby wykonać przelew między nimi.</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('wealth')}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-black font-bold cursor-pointer"
                >
                  Dodaj konto
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2.5 items-end">
                <CustomSelect
                  label="Z konta"
                  value={resolvedAccountId}
                  onChange={(id) => {
                    onClearPreselectedAccount?.();
                    setAccountId(id);
                  }}
                  options={accountOptions}
                />
                <button
                  type="button"
                  onClick={() => {
                    onClearPreselectedAccount?.();
                    setAccountId(resolvedToAccountId);
                    setToAccountId(resolvedAccountId);
                  }}
                  title="Zamień konta miejscami"
                  aria-label="Zamień konta miejscami"
                  className="h-[46px] px-3.5 rounded-2xl bg-[#141822] hover:bg-[#1c2230] border border-[#242c3d] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <CustomSelect
                  label="Na konto"
                  value={resolvedToAccountId}
                  onChange={setToAccountId}
                  options={accountOptions}
                />
              </div>
            )
          ) : (
            <CustomSelect
              label={type === 'expense' ? 'Czym zapłacono?' : 'Na jakie konto?'}
              value={resolvedAccountId}
              onChange={(id) => {
                onClearPreselectedAccount?.();
                setAccountId(id);
              }}
              options={accountOptions}
            />
          )}

          {type !== 'transfer' && (
            <CategoryPicker
              categories={db.categories}
              type={type}
              value={resolvedCategoryId}
              onChange={setCategoryId}
              onCreateCategory={(cat) => {
                const created = addCategory(cat);
                pushToast({
                  message: `Dodano kategorię: ${created.name}`,
                  tone: 'info',
                });
                return created;
              }}
            />
          )}

          <div className="space-y-2">
            <CustomInput
              label="Opis (opcjonalnie)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClear={() => setTitle('')}
              placeholder={
                type === 'expense'
                  ? 'Np. Zakupy, kawa, paliwo...'
                  : type === 'income'
                    ? 'Np. Wypłata, zlecenie...'
                    : 'Np. Bankomat → portfel'
              }
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_PRESETS[type].map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => {
                    setTitle(preset.title);
                    if (preset.categoryId) setCategoryId(preset.categoryId);
                  }}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold ios-glass-pill text-neutral-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <CustomDatePicker value={date} todayStr={todayStr} onChange={setDate} />

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsPlanned((p) => !p)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isPlanned
                    ? 'bg-white/95 text-black shadow-[0_2px_10px_rgba(255,255,255,0.2)]'
                    : 'ios-glass-pill text-neutral-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {isPlanned ? 'Planowane' : 'Zaplanuj'}
              </button>

              {!showNote && (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white py-2 px-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  Dodaj notatkę
                </button>
              )}
            </div>
          </div>

          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showNote
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none !mt-0'
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <CustomInput
                label="Notatka"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onClear={() => setNote('')}
                placeholder="Opcjonalny komentarz..."
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-full bg-white/95 hover:bg-white active:scale-[0.98] text-black font-black text-sm sm:text-base transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-[0_6px_28px_rgba(255,255,255,0.24),inset_0_1px_0_rgba(255,255,255,0.9)] mt-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>
              {type === 'expense'
                ? 'Zapisz wydatek'
                : type === 'income'
                  ? 'Zapisz przychód'
                  : 'Wykonaj przelew'}
            </span>
          </button>
        </form>
      </section>

      {/* Right Column: Desktop Accounts + Recent Activity */}
      <aside className="lg:col-span-5 space-y-6 min-w-0">
        {/* Desktop-only Accounts Card */}
        <div className="hidden lg:block finte-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Stan kont i gotówki
              </div>
              <div className="text-3xl font-extrabold tabular-nums text-white mt-1 whitespace-nowrap">
                <AnimatedPLN valueGrosze={accountsSummary.liquidTotalGrosze} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-400 mt-1">
                <span className="whitespace-nowrap">
                  Gotówka:{' '}
                  <span className="text-white font-semibold tabular-nums">
                    {formatPLN(accountsSummary.cashTotalGrosze)}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  Konta:{' '}
                  <span className="text-white font-semibold tabular-nums">
                    {formatPLN(accountsSummary.bankTotalGrosze)}
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('wealth')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl ios-glass-pill text-xs font-semibold text-neutral-200 hover:text-white active:scale-95 transition-all cursor-pointer shrink-0"
            >
              Majątek
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {accountsSummary.accounts.map((acc) => {
              const isSelected = acc.id === resolvedAccountId;
              return (
                <div
                  key={acc.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 border transition-all ${
                    isSelected
                      ? 'bg-white/[0.11] border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'ios-glass-inset hover:bg-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClearPreselectedAccount?.();
                      setAccountId(acc.id);
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-white"
                      style={{
                        backgroundColor: `${acc.color}20`,
                        color: acc.color,
                        border: `1px solid ${acc.color}40`,
                      }}
                    >
                      <AccountKindIcon kind={acc.kind} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {ACCOUNT_KIND_META[acc.kind].shortLabel}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        acc.currentBalanceGrosze < 0 ? 'text-[#f87171]' : 'text-white'
                      }`}
                    >
                      {formatPLN(acc.currentBalanceGrosze)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenReconcile(acc.id)}
                      title="Wyrównaj stan"
                      className="p-2 rounded-xl ios-glass-pill text-neutral-300 hover:text-white active:scale-90 transition-all cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="finte-card p-4 sm:p-6 space-y-4 animate-card-in stagger-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">Ostatnie operacje</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-xs font-semibold text-neutral-400 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              Wszystkie →
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="rounded-2xl ios-glass-inset border-dashed py-8 px-4 text-center space-y-2">
              <Sparkles className="w-5 h-5 text-neutral-400 mx-auto" />
              <div className="text-xs font-semibold text-white">Brak zapisanych operacji</div>
              <div className="text-[11px] text-neutral-400">
                Wpisz pierwszą transakcję, aby zobaczyć historię.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const cat = categoryMap.get(tx.categoryId);
                const acc = accountMap.get(tx.accountId);
                const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
                const amountSign =
                  tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '⇄ ';
                const amountColor =
                  tx.type === 'income'
                    ? 'text-[#2dd4bf]'
                    : tx.type === 'expense'
                      ? 'text-white'
                      : 'text-neutral-400';

                return (
                  <div
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="group rounded-2xl px-3.5 py-3 ios-glass-inset hover:bg-white/[0.075] hover:border-white/20 active:scale-[0.99] transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-white"
                        style={{
                          backgroundColor: `${cat?.color ?? '#ffffff'}15`,
                          color: cat?.color ?? '#ffffff',
                          border: `1px solid ${cat?.color ?? '#ffffff'}30`,
                        }}
                      >
                        {tx.type === 'transfer' ? (
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        ) : (
                          <CategoryIcon name={cat?.icon} className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white line-clamp-1">
                          {tx.title}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {formatDateGroupLabel(tx.date, todayStr)} ·{' '}
                          {tx.type === 'transfer'
                            ? `${acc?.name ?? ''} → ${toAcc?.name ?? ''}`
                            : acc?.name ?? ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${amountColor}`}>
                        {amountSign}
                        {formatPLN(tx.amountGrosze)}
                      </span>

                      <div
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Powtórz"
                          onClick={() => handleRepeatTx(tx)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Edytuj"
                          onClick={() => onEditTransaction(tx)}
                          className="hidden sm:inline-flex p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
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
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/15 active:scale-90 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
