export type AccountKind = 'cash' | 'bank' | 'savings' | 'investment' | 'liability';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  initialBalanceGrosze: number;
  color: string;
  includeInLiquid: boolean;
  note?: string;
}

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  monthlyBudgetGrosze?: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amountGrosze: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  title: string;
  note?: string;
  isPlanned?: boolean;
  isAdjustment?: boolean;
}

export interface BudgetTargets {
  monthlyExpenseLimitGrosze: number;
  monthlyIncomeGoalGrosze: number;
  yearlyOverrides?: Record<
    string,
    {
      monthlyExpenseLimitGrosze?: number;
      monthlyIncomeGoalGrosze?: number;
    }
  >;
}

export interface FinanceDB {
  version: number;
  mode: 'demo' | 'custom';
  updatedAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  targets: BudgetTargets;
}

export type AppTab = 'add' | 'history' | 'analytics' | 'wealth';
export type AnalyticsScope = 'all' | 'year';
export type AnalyticsMetric = 'net' | 'expense' | 'income';
export type RollingWindow = 3 | 6 | 12;

export type SupabaseStatus = 'connected' | 'needs_migration' | 'syncing' | 'offline_cookies' | 'error';

export interface SupabaseConfigInfo {
  isConfigured: boolean;
  tablesReady: boolean;
  source: 'supabase' | 'cookies' | 'default';
  status: SupabaseStatus;
  error?: string;
}

export interface CookieStorageStats {
  chunkCount: number;
  encodedBytes: number;
  rawJsonBytes: number;
  maxRecommendedBytes: number;
  usagePercent: number;
}
