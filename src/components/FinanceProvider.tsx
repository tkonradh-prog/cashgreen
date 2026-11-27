'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearFinanceDBCookies,
  getBrowserCookies,
  getCookieStorageStats,
  parseFinanceDBFromCookies,
  saveFinanceDBToCookies,
} from '@/lib/cookieDb';
import { normalizeLogin } from '@/lib/auth';
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
  username,
  serverLoadedForUsername,
  initialDb,
  todayStr,
  hadExistingCookies,
  supabaseInitialConfig,
  children,
}: {
  username: string;
  serverLoadedForUsername?: string;
  initialDb: FinanceDB;
  todayStr: string;
  hadExistingCookies: boolean;
  supabaseInitialConfig?: SupabaseConfigInfo;
  children: React.ReactNode;
}) {
  const normalizedUser = normalizeLogin(username);
  const serverMatched =
    Boolean(normalizedUser) &&
    normalizeLogin(serverLoadedForUsername ?? '') === normalizedUser;

  const startingDb = useMemo(
    () => (serverMatched ? initialDb : createCleanDatabase(todayStr)),
    // Intentionally evaluated for this mounted user instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalizedUser]
  );

  const [db, setDb] = useState<FinanceDB>(startingDb);
  const [undoStack, setUndoStack] = useState<FinanceDB[]>([]);
  const dbRef = useRef<FinanceDB>(startingDb);
  const undoStackRef = useRef<FinanceDB[]>([]);
  const [storageStats, setStorageStats] = useState<CookieStorageStats>(() =>
    getCookieStorageStats(startingDb)
  );
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigInfo>(
    serverMatched && supabaseInitialConfig
      ? supabaseInitialConfig
      : {
          isConfigured: true,
          tablesReady: false,
          source: 'default',
          status: 'syncing',
        }
  );

  const supabase = useMemo(() => createClient(), []);

  // Load this user's own data from Supabase (or seed their fresh 0 zl DB if new user)
  useEffect(() => {
    let isMounted = true;

    const initUserStore = async () => {
      if (!normalizedUser) return;

      // If client just logged in / registered, fetch user-specific data from Supabase
      if (!serverMatched) {
        const res = await fetchFinanceDBFromSupabase(supabase, normalizedUser);
        if (!isMounted) return;

        if (res.db) {
          dbRef.current = res.db;
          setDb(res.db);
          setStorageStats(saveFinanceDBToCookies(res.db, normalizedUser));
        } else {
          const cookieFallback = parseFinanceDBFromCookies(
            getBrowserCookies(),
            normalizedUser
          );
          const cleanDb = cookieFallback ?? createCleanDatabase(todayStr);
          dbRef.current = cleanDb;
          setDb(cleanDb);
          setStorageStats(saveFinanceDBToCookies(cleanDb, normalizedUser));
          if (res.tablesReady) {
            await saveFinanceDBToSupabase(supabase, cleanDb, normalizedUser);
          }
        }

        if (!isMounted) return;
        setSupabaseConfig({
          isConfigured: true,
          tablesReady: res.tablesReady,
          source: res.db ? 'supabase' : 'default',
          status: res.tablesReady ? 'connected' : 'needs_migration',
          error: res.error,
        });
        return;
      }

      // Server already loaded for this exact user: confirm connection & initialize row if empty
      const conn = await checkSupabaseConnection(supabase);
      if (!isMounted) return;
      if (conn.tablesReady && supabaseInitialConfig?.source !== 'supabase') {
        await saveFinanceDBToSupabase(supabase, startingDb, normalizedUser);
      }
      if (!isMounted) return;
      setSupabaseConfig((prev) => ({
        ...prev,
        isConfigured: true,
        tablesReady: conn.tablesReady,
        source: conn.tablesReady ? 'supabase' : prev.source,
        status: conn.tablesReady
          ? 'connected'
          : conn.ok
            ? 'needs_migration'
            : 'error',
        error: conn.error,
      }));
    };

    void initUserStore();
    return () => {
      isMounted = false;
    };
  }, [supabase, normalizedUser, serverMatched, startingDb, supabaseInitialConfig?.source, todayStr]);

  // Persist user-scoped cookies on mount when needed
  useEffect(() => {
    if (serverMatched && !hadExistingCookies) {
      saveFinanceDBToCookies(startingDb, normalizedUser);
    }
  }, [serverMatched, hadExistingCookies, startingDb, normalizedUser]);

  const pushToSupabase = useCallback(
    async (targetDb: FinanceDB): Promise<boolean> => {
      try {
        const res = await saveFinanceDBToSupabase(supabase, targetDb, normalizedUser);
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
    [supabase, normalizedUser]
  );

  const commitDb = useCallback(
    (updater: (prev: FinanceDB) => FinanceDB, recordUndo = true) => {
      const prev = dbRef.current;
      const next: FinanceDB = {
        ...updater(prev),
        updatedAt: todayStr,
      };
      dbRef.current = next;
      setDb(next);
      if (recordUndo) {
        const nextStack = [...undoStackRef.current.slice(-9), prev];
        undoStackRef.current = nextStack;
        setUndoStack(nextStack);
      }
      const stats = saveFinanceDBToCookies(next, normalizedUser);
      setStorageStats(stats);
      void pushToSupabase(next);
    },
    [todayStr, pushToSupabase, normalizedUser]
  );

  const undoLast = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;
    const previous = stack[stack.length - 1];
    const nextStack = stack.slice(0, -1);
    undoStackRef.current = nextStack;
    setUndoStack(nextStack);
    dbRef.current = previous;
    setDb(previous);
    const stats = saveFinanceDBToCookies(previous, normalizedUser);
    setStorageStats(stats);
    void pushToSupabase(previous);
    return true;
  }, [pushToSupabase, normalizedUser]);

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
      if (dbRef.current.accounts.length <= 1) return false;
      commitDb((prev) => {
        if (prev.accounts.length <= 1) return prev;
        return {
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          transactions: prev.transactions.filter(
            (t) => t.accountId !== id && t.toAccountId !== id
          ),
        };
      });
      return true;
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
    dbRef.current = clean;
    setDb(clean);
    undoStackRef.current = [];
    setUndoStack([]);
    setStorageStats(saveFinanceDBToCookies(clean, normalizedUser));
    void pushToSupabase(clean);
  }, [todayStr, pushToSupabase, normalizedUser]);

  const restoreDemo = useCallback(() => {
    clearFinanceDBCookies();
    const demo = createDemoDatabase(todayStr);
    dbRef.current = demo;
    setDb(demo);
    undoStackRef.current = [];
    setUndoStack([]);
    setStorageStats(saveFinanceDBToCookies(demo, normalizedUser));
    void pushToSupabase(demo);
  }, [todayStr, pushToSupabase, normalizedUser]);

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
      const res = await fetchFinanceDBFromSupabase(supabase, normalizedUser);
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
  }, [commitDb, supabase, normalizedUser]);

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
