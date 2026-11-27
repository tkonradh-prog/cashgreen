'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearFinanceDBCookies,
  getCookieStorageStats,
  saveFinanceDBToCookies,
} from '@/lib/cookieDb';
import { computeAccountsSummary } from '@/lib/analytics';
import { createId, getCurrentTimeHHMM } from '@/lib/format';
import {
  SYSTEM_CATEGORY_ADJUSTMENT,
  SYSTEM_CATEGORY_TRANSFER,
  createCleanDatabase,
  createDemoDatabase,
} from '@/lib/seedData';
import {
  Account,
  BudgetTargets,
  Category,
  CookieStorageStats,
  FinanceDB,
  SupabaseConfigInfo,
  Transaction,
} from '@/lib/types';
import { createClient } from '@/utils/supabase/client';
import {
  checkSupabaseConnection,
  fetchFinanceDBFromSupabase,
  saveFinanceDBToSupabase,
} from '@/lib/supabaseDb';

interface FinanceContextValue {
  db: FinanceDB;
  todayStr: string;
  storageStats: CookieStorageStats;
  accountsSummary: ReturnType<typeof computeAccountsSummary>;
  canUndo: boolean;
  undoLast: () => boolean;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  realizePlannedTransaction: (id: string) => void;
  addAccount: (acc: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => boolean;
  reconcileAccountBalance: (accountId: string, actualBalanceGrosze: number) => {
    deltaGrosze: number;
    logged: boolean;
  };
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateTargets: (targets: BudgetTargets) => void;
  resetToClean: () => void;
  restoreDemo: () => void;
  importDatabase: (nextDb: FinanceDB) => void;
  supabaseConfig: SupabaseConfigInfo;
  syncWithSupabase: () => Promise<boolean>;
  exportToSupabase: () => Promise<boolean>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({
  initialDb,
  todayStr,
  hadExistingCookies,
  supabaseInitialConfig,
  children,
}: {
  initialDb: FinanceDB;
  todayStr: string;
  hadExistingCookies: boolean;
  supabaseInitialConfig?: SupabaseConfigInfo;
  children: React.ReactNode;
}) {
  const [db, setDb] = useState<FinanceDB>(initialDb);
  const [undoStack, setUndoStack] = useState<FinanceDB[]>([]);
  const [storageStats, setStorageStats] = useState<CookieStorageStats>(() =>
    getCookieStorageStats(initialDb)
  );
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigInfo>(
    supabaseInitialConfig ?? {
      isConfigured: true,
      tablesReady: false,
      source: 'cookies',
      status: 'offline_cookies',
    }
  );

  const supabase = useMemo(() => createClient(), []);

  // Check connection on mount & bootstrap Supabase if tables are ready but empty
  useEffect(() => {
    let isMounted = true;
    checkSupabaseConnection(supabase).then(async (res) => {
      if (!isMounted) return;
      if (res.tablesReady && supabaseInitialConfig?.source !== 'supabase') {
        await saveFinanceDBToSupabase(supabase, initialDb);
      }
      if (!isMounted) return;
      setSupabaseConfig((prev) => ({
        ...prev,
        isConfigured: true,
        tablesReady: res.tablesReady,
        source: res.tablesReady ? 'supabase' : prev.source,
        status: res.tablesReady
          ? 'connected'
          : res.ok
            ? 'needs_migration'
            : 'error',
        error: res.error,
      }));
    });
    return () => {
      isMounted = false;
    };
  }, [supabase, initialDb, supabaseInitialConfig?.source]);

  // Persist initial seed on first visit so cookies immediately act as active local DB
  useEffect(() => {
    if (!hadExistingCookies) {
      saveFinanceDBToCookies(initialDb);
    }
  }, [hadExistingCookies, initialDb]);

  const pushToSupabase = useCallback(
    async (targetDb: FinanceDB): Promise<boolean> => {
      try {
        const res = await saveFinanceDBToSupabase(supabase, targetDb);
        if (res.ok) {
          setSupabaseConfig((c) => ({
            ...c,
            tablesReady: true,
            status: 'connected',
            error: undefined,
          }));
          return true;
        }
        if (res.tablesMissing) {
          setSupabaseConfig((c) => ({
            ...c,
            tablesReady: false,
            status: 'needs_migration',
            error: res.error,
          }));
          return false;
        }
        setSupabaseConfig((c) => ({
          ...c,
          status: 'error',
          error: res.error,
        }));
        return false;
      } catch (err) {
        setSupabaseConfig((c) => ({
          ...c,
          status: 'error',
          error: err instanceof Error ? err.message : 'Błąd synchronizacji',
        }));
        return false;
      }
    },
    [supabase]
  );

  const commitDb = useCallback(
    (updater: (prev: FinanceDB) => FinanceDB, recordUndo = true) => {
      setDb((prev) => {
        const next = {
          ...updater(prev),
          updatedAt: todayStr,
        };
        if (recordUndo) {
          setUndoStack((stack) => [...stack.slice(-9), prev]);
        }
        const stats = saveFinanceDBToCookies(next);
        setStorageStats(stats);
        void pushToSupabase(next);
        return next;
      });
    },
    [todayStr, pushToSupabase]
  );

  const undoLast = useCallback(() => {
    let restored = false;
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      restored = true;
      setDb(previous);
      const stats = saveFinanceDBToCookies(previous);
      setStorageStats(stats);
      void pushToSupabase(previous);
      return stack.slice(0, -1);
    });
    return restored;
  }, [pushToSupabase]);

  const addTransaction = useCallback(
    (tx: Omit<Transaction, 'id'>): Transaction => {
      const created: Transaction = {
        ...tx,
        id: createId('tx'),
        time: tx.time ?? getCurrentTimeHHMM(),
      };
      commitDb((prev) => ({
        ...prev,
        transactions: [created, ...prev.transactions],
      }));
      return created;
    },
    [commitDb]
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      commitDb((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    [commitDb]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
    },
    [commitDb]
  );

  const realizePlannedTransaction = useCallback(
    (id: string) => {
      commitDb((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, isPlanned: false, date: t.date > todayStr ? todayStr : t.date } : t
        ),
      }));
    },
    [commitDb, todayStr]
  );

  const addAccount = useCallback(
    (acc: Omit<Account, 'id'>): Account => {
      const created: Account = { ...acc, id: createId('acc') };
      commitDb((prev) => ({
        ...prev,
        accounts: [...prev.accounts, created],
      }));
      return created;
    },
    [commitDb]
  );

  const updateAccount = useCallback(
    (id: string, patch: Partial<Account>) => {
      commitDb((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
    },
    [commitDb]
  );

  const deleteAccount = useCallback(
    (id: string) => {
      let deleted = false;
      commitDb((prev) => {
        if (prev.accounts.length <= 1) return prev;
        deleted = true;
        return {
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          transactions: prev.transactions.filter(
            (t) => t.accountId !== id && t.toAccountId !== id
          ),
        };
      });
      return deleted;
    },
    [commitDb]
  );

  const accountsSummary = useMemo(
    () => computeAccountsSummary(db, todayStr),
    [db, todayStr]
  );

  const reconcileAccountBalance = useCallback(
    (accountId: string, actualBalanceGrosze: number) => {
      const currentAcc = accountsSummary.accounts.find((a) => a.id === accountId);
      if (!currentAcc) return { deltaGrosze: 0, logged: false };
      const deltaGrosze = actualBalanceGrosze - currentAcc.currentBalanceGrosze;
      if (deltaGrosze === 0) return { deltaGrosze: 0, logged: false };

      const tx: Transaction = {
        id: createId('tx'),
        type: deltaGrosze > 0 ? 'income' : 'expense',
        amountGrosze: Math.abs(deltaGrosze),
        date: todayStr,
        time: getCurrentTimeHHMM(),
        accountId,
        categoryId: SYSTEM_CATEGORY_ADJUSTMENT,
        title: `Wyrównanie stanu (${currentAcc.name})`,
        note: 'Automatyczna korekta po przeliczeniu środków',
        isAdjustment: true,
      };

      commitDb((prev) => ({
        ...prev,
        transactions: [tx, ...prev.transactions],
      }));
      return { deltaGrosze, logged: true };
    },
    [accountsSummary.accounts, commitDb, todayStr]
  );

  const addCategory = useCallback(
    (cat: Omit<Category, 'id'>): Category => {
      const created: Category = { ...cat, id: createId('cat') };
      commitDb((prev) => ({
        ...prev,
        categories: [...prev.categories, created],
      }));
      return created;
    },
    [commitDb]
  );

  const updateTargets = useCallback(
    (targets: BudgetTargets) => {
      commitDb((prev) => ({
        ...prev,
        targets,
      }));
    },
    [commitDb]
  );

  const resetToClean = useCallback(() => {
    clearFinanceDBCookies();
    const clean = createCleanDatabase(todayStr);
    setDb(clean);
    setUndoStack([]);
    setStorageStats(saveFinanceDBToCookies(clean));
    void pushToSupabase(clean);
  }, [todayStr, pushToSupabase]);

  const restoreDemo = useCallback(() => {
    clearFinanceDBCookies();
    const demo = createDemoDatabase(todayStr);
    setDb(demo);
    setUndoStack([]);
    setStorageStats(saveFinanceDBToCookies(demo));
    void pushToSupabase(demo);
  }, [todayStr, pushToSupabase]);

  const importDatabase = useCallback(
    (nextDb: FinanceDB) => {
      const sanitized: FinanceDB = {
        ...nextDb,
        version: 3,
        mode: 'custom',
        updatedAt: todayStr,
      };
      commitDb(() => sanitized);
    },
    [commitDb, todayStr]
  );

  const syncWithSupabase = useCallback(async () => {
    setSupabaseConfig((prev) => ({ ...prev, status: 'syncing' }));
    try {
      const res = await fetchFinanceDBFromSupabase(supabase);
      if (res.db) {
        commitDb(() => res.db!, false);
        setSupabaseConfig({
          isConfigured: true,
          tablesReady: true,
          source: 'supabase',
          status: 'connected',
        });
        return true;
      }
      setSupabaseConfig((prev) => ({
        ...prev,
        tablesReady: res.tablesReady,
        status: res.tablesReady ? 'connected' : 'needs_migration',
        error: res.error,
      }));
      return false;
    } catch {
      setSupabaseConfig((prev) => ({ ...prev, status: 'error' }));
      return false;
    }
  }, [commitDb, supabase]);

  const exportToSupabase = useCallback(async () => {
    setSupabaseConfig((prev) => ({ ...prev, status: 'syncing' }));
    return pushToSupabase(db);
  }, [db, pushToSupabase]);

  return (
    <FinanceContext.Provider
      value={{
        db,
        todayStr,
        storageStats,
        accountsSummary,
        canUndo: undoStack.length > 0,
        undoLast,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        realizePlannedTransaction,
        addAccount,
        updateAccount,
        deleteAccount,
        reconcileAccountBalance,
        addCategory,
        updateTargets,
        resetToClean,
        restoreDemo,
        importDatabase,
        supabaseConfig,
        syncWithSupabase,
        exportToSupabase,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}

export { SYSTEM_CATEGORY_ADJUSTMENT, SYSTEM_CATEGORY_TRANSFER };
