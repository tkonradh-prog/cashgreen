'use client';

import React, { useState } from 'react';
import { Check, Scale } from 'lucide-react';
import { AccountWithBalance } from '@/lib/analytics';
import { formatPLN, groszeToInputString, parsePLNInput } from '@/lib/format';
import { useFinance } from '../FinanceProvider';
import { AmountInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { AccountKindIcon } from '../ui/IconMap';
import { ModalDrawer } from '../ui/ModalDrawer';
import { useToast } from '../ui/ToastProvider';

export function ReconcileModal({
  open,
  onClose,
  initialAccountId,
}: {
  open: boolean;
  onClose: () => void;
  initialAccountId?: string;
}) {
  return (
    <ModalDrawer
      open={open}
      onClose={onClose}
      title="Wyrównaj stan konta"
      subtitle="Zsynchronizuj saldo aplikacji z rzeczywistym stanem gotówki lub konta bankowego."
    >
      {open && (
        <ReconcileModalForm
          key={initialAccountId ?? 'default'}
          onClose={onClose}
          initialAccountId={initialAccountId}
        />
      )}
    </ModalDrawer>
  );
}

function ReconcileModalForm({
  onClose,
  initialAccountId,
}: {
  onClose: () => void;
  initialAccountId?: string;
}) {
  const { accountsSummary, reconcileAccountBalance, undoLast } = useFinance();
  const { pushToast } = useToast();

  const defaultId = initialAccountId ?? accountsSummary.accounts[0]?.id ?? '';
  const initialAcc = accountsSummary.accounts.find((a) => a.id === defaultId);

  const [selectedId, setSelectedId] = useState(defaultId);
  const [countedStr, setCountedStr] = useState(
    initialAcc ? groszeToInputString(initialAcc.currentBalanceGrosze) : ''
  );
  const [error, setError] = useState('');

  const currentAccount: AccountWithBalance | undefined = accountsSummary.accounts.find(
    (a) => a.id === selectedId
  );

  const parsedGrosze = parsePLNInput(countedStr, {
    allowZero: true,
    allowNegative: currentAccount?.kind === 'liability',
  });
  const deltaGrosze =
    currentAccount && parsedGrosze !== null
      ? parsedGrosze - currentAccount.currentBalanceGrosze
      : null;

  const handleAccountSwitch = (id: string) => {
    setSelectedId(id);
    const nextAcc = accountsSummary.accounts.find((a) => a.id === id);
    setCountedStr(nextAcc ? groszeToInputString(nextAcc.currentBalanceGrosze) : '');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    if (parsedGrosze === null) {
      setError('Podaj prawidłową kwotę');
      return;
    }

    const res = reconcileAccountBalance(currentAccount.id, parsedGrosze);
    if (!res.logged) {
      pushToast({
        message: 'Stan konta jest już zgodny',
        tone: 'info',
      });
      onClose();
      return;
    }

    pushToast({
      message: `Wyrównano: ${currentAccount.name}`,
      detail: `Korekta ${formatPLN(res.deltaGrosze, { showSign: true })}`,
      tone: res.deltaGrosze >= 0 ? 'info' : 'coral',
      onUndo: undoLast,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CustomSelect
        label="Konto lub portfel"
        value={selectedId}
        onChange={handleAccountSwitch}
        options={accountsSummary.accounts.map((acc) => ({
          value: acc.id,
          label: acc.name,
          badgeText: formatPLN(acc.currentBalanceGrosze),
          dotColor: acc.color,
          icon: <AccountKindIcon kind={acc.kind} className="w-4 h-4" />,
        }))}
      />

      {currentAccount && (
        <div className="rounded-2xl ios-glass-inset px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-neutral-400">Dotychczasowy stan w aplikacji</span>
          <span className="text-sm font-bold tabular-nums text-white">
            {formatPLN(currentAccount.currentBalanceGrosze)}
          </span>
        </div>
      )}

      <AmountInput
        label="Rzeczywisty stan po przeliczeniu"
        value={countedStr}
        onChange={(v) => {
          setCountedStr(v);
          setError('');
        }}
        error={error}
        quickAmountsZloty={[5, 10, 20, 50, 100]}
        previewNode={
          deltaGrosze !== null && (
            <div
              className={`rounded-2xl px-4 py-3 border text-xs flex items-center justify-between ${
                deltaGrosze === 0
                  ? 'bg-white/5 border-white/10 text-neutral-400'
                  : deltaGrosze > 0
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-red-500/10 border-red-500/25 text-[#f87171]'
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Scale className="w-3.5 h-3.5" />
                Różnica do zaksięgowania
              </span>
              <span className="font-extrabold tabular-nums">
                {deltaGrosze === 0
                  ? '0,00 zł (zgodne)'
                  : formatPLN(deltaGrosze, { showSign: true })}
              </span>
            </div>
          )
        }
      />

      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1a1e28]">
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
          Wyrównaj stan
        </button>
      </div>
    </form>
  );
}
