'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, Check, Clock, Trash2 } from 'lucide-react';
import { formatPLN, groszeToInputString, parsePLNInput } from '@/lib/format';
import { Transaction, TransactionType } from '@/lib/types';
import { SYSTEM_CATEGORY_TRANSFER, useFinance } from '../FinanceProvider';
import { CategoryPicker } from '../ui/CategoryPicker';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { AmountInput, CustomInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { AccountKindIcon } from '../ui/IconMap';
import { ModalDrawer } from '../ui/ModalDrawer';
import { SegmentedTabs } from '../ui/SegmentedTabs';
import { useToast } from '../ui/ToastProvider';

export function TransactionEditModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  return (
    <ModalDrawer
      open={Boolean(transaction)}
      onClose={onClose}
      title="Edytuj operację"
      subtitle="Zmiany natychmiast zaktualizują stan kont i analitykę."
    >
      {transaction && (
        <TransactionEditForm
          key={transaction.id}
          transaction={transaction}
          onClose={onClose}
        />
      )}
    </ModalDrawer>
  );
}

function TransactionEditForm({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const {
    db,
    todayStr,
    accountsSummary,
    updateTransaction,
    deleteTransaction,
    addCategory,
    undoLast,
  } = useFinance();
  const { pushToast } = useToast();

  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amountStr, setAmountStr] = useState(groszeToInputString(transaction.amountGrosze));
  const [title, setTitle] = useState(transaction.title);
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [toAccountId, setToAccountId] = useState(
    transaction.toAccountId ??
      accountsSummary.accounts.find((a) => a.id !== transaction.accountId)?.id ??
      ''
  );
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note ?? '');
  const [isPlanned, setIsPlanned] = useState(Boolean(transaction.isPlanned));
  const [error, setError] = useState('');

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    if (nextType !== 'transfer') {
      const firstMatch = db.categories.find((c) => c.type === nextType);
      if (firstMatch) setCategoryId(firstMatch.id);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountGrosze = parsePLNInput(amountStr);
    if (!amountGrosze) {
      setError('Podaj poprawną kwotę');
      return;
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError('Wybierz dwa różne konta');
      return;
    }

    updateTransaction(transaction.id, {
      type,
      amountGrosze,
      title: title.trim() || (type === 'transfer' ? 'Transfer środków' : 'Operacja'),
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? SYSTEM_CATEGORY_TRANSFER : categoryId,
      date,
      note: note.trim() || undefined,
      isPlanned,
    });

    pushToast({
      message: 'Zaktualizowano wpis',
      detail: `${title.trim() || 'Operacja'} · ${formatPLN(amountGrosze)}`,
      tone: 'info',
      onUndo: undoLast,
    });
    onClose();
  };

  const handleDelete = () => {
    deleteTransaction(transaction.id);
    pushToast({
      message: 'Usunięto wpis',
      detail: transaction.title,
      tone: 'coral',
      onUndo: undoLast,
    });
    onClose();
  };

  const accountOptions = accountsSummary.accounts.map((acc) => ({
    value: acc.id,
    label: acc.name,
    badgeText: formatPLN(acc.currentBalanceGrosze),
    dotColor: acc.color,
    icon: <AccountKindIcon kind={acc.kind} className="w-4 h-4" />,
  }));

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <SegmentedTabs<TransactionType>
        fullWidth
        value={type}
        onChange={handleTypeChange}
        items={[
          { value: 'expense', label: 'Wydatek' },
          { value: 'income', label: 'Przychód' },
          { value: 'transfer', label: 'Przelew' },
        ]}
      />

      <AmountInput
        label="Kwota"
        value={amountStr}
        onChange={(v) => {
          setAmountStr(v);
          setError('');
        }}
        error={error}
        accent={type === 'expense' ? 'coral' : 'neutral'}
        quickAmountsZloty={[10, 20, 50, 100, 200]}
      />

      {type === 'transfer' ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <CustomSelect
            label="Z konta"
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
          />
          <button
            type="button"
            onClick={() => {
              const prevSrc = accountId;
              setAccountId(toAccountId);
              setToAccountId(prevSrc);
            }}
            title="Zamień konta"
            className="h-[46px] px-3 rounded-2xl bg-[#12151e] border border-[#202636] text-white hover:bg-[#181d28] flex items-center justify-center cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <CustomSelect
            label="Na konto"
            value={toAccountId}
            onChange={setToAccountId}
            options={accountOptions}
          />
        </div>
      ) : (
        <CustomSelect
          label="Konto lub portfel"
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
        />
      )}

      {type !== 'transfer' && (
        <CategoryPicker
          categories={db.categories}
          type={type}
          value={categoryId}
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

      <CustomInput
        label="Tytuł / Opis"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Np. Zakupy, paliwo, kawa..."
      />

      <CustomDatePicker label="Data operacji" value={date} todayStr={todayStr} onChange={setDate} />

      <CustomInput
        label="Notatka (opcjonalnie)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Opcjonalny komentarz..."
      />

      <button
        type="button"
        onClick={() => setIsPlanned((p) => !p)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[#090b10] border border-[#1e2330] px-4 py-3 text-left cursor-pointer hover:border-[#2b3548] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-neutral-400" />
          <div>
            <div className="text-sm font-semibold text-white">
              Oznacz jako planowane (prognoza)
            </div>
            <div className="text-[11px] text-neutral-400">
              Nie zmienia salda kont dopóki nie zostanie zrealizowana
            </div>
          </div>
        </div>
        <span
          className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
            isPlanned ? 'bg-white' : 'bg-[#1e2330]'
          }`}
        >
          <span
            className={`block w-5 h-5 rounded-full transition-transform ${
              isPlanned ? 'bg-black translate-x-5' : 'bg-neutral-500 translate-x-0'
            }`}
          />
        </span>
      </button>

      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#1a1e28]">
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-[#f87171] text-xs font-bold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Usuń
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-black transition-all cursor-pointer shadow-sm"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Zapisz zmiany
          </button>
        </div>
      </div>
    </form>
  );
}
