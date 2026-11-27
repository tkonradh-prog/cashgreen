'use client';

import React, { useState } from 'react';
import { Check, Target } from 'lucide-react';
import { groszeToInputString, parsePLNInput } from '@/lib/format';
import { useFinance } from '../FinanceProvider';
import { AmountInput } from '../ui/CustomInput';
import { ModalDrawer } from '../ui/ModalDrawer';
import { useToast } from '../ui/ToastProvider';

export function TargetsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ModalDrawer
      open={open}
      onClose={onClose}
      title="Cele i limity miesięczne"
      subtitle="Te wartości wyznaczają linie odniesienia w analityce i wykresach."
    >
      {open && <TargetsModalForm onClose={onClose} />}
    </ModalDrawer>
  );
}

function TargetsModalForm({ onClose }: { onClose: () => void }) {
  const { db, updateTargets, undoLast } = useFinance();
  const { pushToast } = useToast();

  const [expenseLimitStr, setExpenseLimitStr] = useState(
    groszeToInputString(db.targets.monthlyExpenseLimitGrosze)
  );
  const [incomeGoalStr, setIncomeGoalStr] = useState(
    groszeToInputString(db.targets.monthlyIncomeGoalGrosze)
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const exp =
      parsePLNInput(expenseLimitStr, { allowZero: true }) ??
      db.targets.monthlyExpenseLimitGrosze;
    const inc =
      parsePLNInput(incomeGoalStr, { allowZero: true }) ??
      db.targets.monthlyIncomeGoalGrosze;
    updateTargets({
      ...db.targets,
      monthlyExpenseLimitGrosze: exp,
      monthlyIncomeGoalGrosze: inc,
    });
    pushToast({
      message: 'Zaktualizowano limity i cele',
      tone: 'info',
      onUndo: undoLast,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <AmountInput
        label="Miesięczny limit wydatków"
        value={expenseLimitStr}
        onChange={setExpenseLimitStr}
        accent="coral"
        quickAmountsZloty={[500, 1000, 2000]}
      />

      <AmountInput
        label="Miesięczny cel przychodów"
        value={incomeGoalStr}
        onChange={setIncomeGoalStr}
        accent="neutral"
        quickAmountsZloty={[500, 1000, 2000]}
      />

      <div className="rounded-2xl bg-[#090b10] border border-[#1e2330] p-4 text-xs text-neutral-400 flex items-start gap-2.5">
        <Target className="w-4 h-4 text-white shrink-0 mt-0.5" />
        <span>
          Cel oszczędności netto (dla widoku <strong>Bilans</strong>) wyliczany jest automatycznie jako różnica między celem przychodów a limitem wydatków.
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-[#1a1e28]">
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
          Zapisz cele
        </button>
      </div>
    </form>
  );
}
