'use client';

import React, { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { formatPLN, groszeToInputString, parsePLNInput } from '@/lib/format';
import { Account, AccountKind } from '@/lib/types';
import { useFinance } from '../FinanceProvider';
import { AmountInput, CustomInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { ACCOUNT_KIND_META, AccountKindIcon } from '../ui/IconMap';
import { ModalDrawer } from '../ui/ModalDrawer';
import { useToast } from '../ui/ToastProvider';

const ACCOUNT_COLORS = ['#ffffff', '#94a3b8', '#d4af37', '#3b82f6', '#818cf8', '#38bdf8', '#f87171'];

export function AccountModal({
  open,
  onClose,
  editingAccount,
}: {
  open: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
}) {
  return (
    <ModalDrawer
      open={open}
      onClose={onClose}
      title={editingAccount ? 'Edytuj konto / składnik' : 'Nowe konto lub portfel'}
      subtitle="Zarządzaj gotówką, rachunkami bankowymi, oszczędnościami i inwestycjami."
    >
      {open && (
        <AccountModalForm
          key={editingAccount?.id ?? 'new'}
          onClose={onClose}
          editingAccount={editingAccount}
        />
      )}
    </ModalDrawer>
  );
}

function AccountModalForm({
  onClose,
  editingAccount,
}: {
  onClose: () => void;
  editingAccount?: Account | null;
}) {
  const { db, addAccount, updateAccount, deleteAccount, undoLast } = useFinance();
  const { pushToast } = useToast();

  const [name, setName] = useState(editingAccount?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(editingAccount?.kind ?? 'cash');
  const [initialStr, setInitialStr] = useState(
    editingAccount
      ? groszeToInputString(Math.abs(editingAccount.initialBalanceGrosze))
      : '0,00'
  );
  const [color, setColor] = useState(editingAccount?.color ?? '#ffffff');
  const [includeInLiquid, setIncludeInLiquid] = useState(
    editingAccount?.includeInLiquid ?? true
  );
  const [note, setNote] = useState(editingAccount?.note ?? '');
  const [error, setError] = useState('');

  const handleKindChange = (nextKind: AccountKind) => {
    setKind(nextKind);
    if (!editingAccount) {
      setColor(ACCOUNT_KIND_META[nextKind].defaultColor);
      setIncludeInLiquid(nextKind === 'cash' || nextKind === 'bank');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Podaj nazwę konta');
      return;
    }

    const parsed = parsePLNInput(initialStr, { allowZero: true }) ?? 0;
    const signedInitial = kind === 'liability' ? -Math.abs(parsed) : Math.abs(parsed);

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        name: trimmed,
        kind,
        initialBalanceGrosze: signedInitial,
        color,
        includeInLiquid: kind === 'liability' ? false : includeInLiquid,
        note: note.trim() || undefined,
      });
      pushToast({
        message: `Zaktualizowano: ${trimmed}`,
        tone: 'info',
        onUndo: undoLast,
      });
    } else {
      addAccount({
        name: trimmed,
        kind,
        initialBalanceGrosze: signedInitial,
        color,
        includeInLiquid: kind === 'liability' ? false : includeInLiquid,
        note: note.trim() || undefined,
      });
      pushToast({
        message: `Dodano konto: ${trimmed}`,
        detail: `Stan początkowy: ${formatPLN(signedInitial)}`,
        tone: 'info',
        onUndo: undoLast,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingAccount) return;
    if (db.accounts.length <= 1) {
      setError('Musi pozostać co najmniej jedno aktywne konto.');
      return;
    }
    const ok = deleteAccount(editingAccount.id);
    if (ok) {
      pushToast({
        message: `Usunięto konto: ${editingAccount.name}`,
        tone: 'coral',
        onUndo: undoLast,
      });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CustomInput
        label="Nazwa"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        placeholder="Np. Gotówka w portfelu, Revolut, Konto główne"
        error={error}
      />

      <CustomSelect<AccountKind>
        label="Typ składnika"
        value={kind}
        onChange={handleKindChange}
        options={(['cash', 'bank', 'savings', 'investment', 'liability'] as AccountKind[]).map(
          (k) => ({
            value: k,
            label: ACCOUNT_KIND_META[k].label,
            dotColor: ACCOUNT_KIND_META[k].defaultColor,
            icon: <AccountKindIcon kind={k} className="w-4 h-4" />,
          })
        )}
      />

      <AmountInput
        label={
          kind === 'liability'
            ? 'Początkowa kwota zadłużenia'
            : editingAccount
              ? 'Saldo początkowe'
              : 'Aktualny stan początkowy'
        }
        value={initialStr}
        onChange={setInitialStr}
        accent={kind === 'liability' ? 'coral' : 'neutral'}
        quickAmountsZloty={[50, 100, 500, 1000]}
      />

      {kind !== 'liability' && (
        <button
          type="button"
          onClick={() => setIncludeInLiquid((v) => !v)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[#090b10] border border-[#1e2330] px-4 py-3 text-left cursor-pointer hover:border-[#2b3548] transition-colors"
        >
          <div>
            <div className="text-sm font-semibold text-white">
              Wliczaj do „Dostępne na co dzień”
            </div>
            <div className="text-[11px] text-neutral-400">
              Główny pasek bieżącej gotówki i kont
            </div>
          </div>
          <span
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
              includeInLiquid ? 'bg-white' : 'bg-[#1e2330]'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full transition-transform ${
                includeInLiquid ? 'bg-black translate-x-5' : 'bg-neutral-500 translate-x-0'
              }`}
            />
          </span>
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-neutral-400">Kolor akcentu</span>
        <div className="flex items-center gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                color === c ? 'scale-110 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <CustomInput
        label="Notatka (opcjonalnie)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Np. Bankomat bez prowizji, cel..."
      />

      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#1a1e28]">
        {editingAccount ? (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-[#f87171] text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Usuń konto
          </button>
        ) : (
          <div />
        )}

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
            {editingAccount ? 'Zapisz zmiany' : 'Dodaj konto'}
          </button>
        </div>
      </div>
    </form>
  );
}
