import { Account, Category, FinanceDB, Transaction } from './types';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc-cash',
    name: 'Gotówka w portfelu',
    kind: 'cash',
    initialBalanceGrosze: 38000,
    color: '#d4af37',
    includeInLiquid: true,
    note: 'Codzienne drobne wydatki bez ciągłego liczenia',
  },
  {
    id: 'acc-bank',
    name: 'Konto główne',
    kind: 'bank',
    initialBalanceGrosze: 420000,
    color: '#ffffff',
    includeInLiquid: true,
    note: 'Wpływy, przelewy, płatności kartą i BLIK',
  },
  {
    id: 'acc-savings',
    name: 'Poduszka finansowa',
    kind: 'savings',
    initialBalanceGrosze: 850000,
    color: '#3b82f6',
    includeInLiquid: false,
    note: 'Konto oszczędnościowe na nieprzewidziane wydatki',
  },
  {
    id: 'acc-invest',
    name: 'Obligacje & ETF',
    kind: 'investment',
    initialBalanceGrosze: 600000,
    color: '#818cf8',
    includeInLiquid: false,
    note: 'Długoterminowa rezerwa kapitału',
  },
];

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-food',
    name: 'Zakupy & jedzenie',
    type: 'expense',
    icon: 'shopping-bag',
    color: '#f59e0b',
    monthlyBudgetGrosze: 180000,
  },
  {
    id: 'cat-home',
    name: 'Mieszkanie & rachunki',
    type: 'expense',
    icon: 'home',
    color: '#60a5fa',
    monthlyBudgetGrosze: 240000,
  },
  {
    id: 'cat-transport',
    name: 'Transport & paliwo',
    type: 'expense',
    icon: 'car',
    color: '#94a3b8',
    monthlyBudgetGrosze: 75000,
  },
  {
    id: 'cat-coffee',
    name: 'Kawa & miasto',
    type: 'expense',
    icon: 'coffee',
    color: '#e5c07b',
    monthlyBudgetGrosze: 60000,
  },
  {
    id: 'cat-health',
    name: 'Zdrowie & sport',
    type: 'expense',
    icon: 'heart-pulse',
    color: '#f87171',
    monthlyBudgetGrosze: 45000,
  },
  {
    id: 'cat-tech',
    name: 'Subskrypcje & sprzęt',
    type: 'expense',
    icon: 'laptop',
    color: '#38bdf8',
    monthlyBudgetGrosze: 50000,
  },
  {
    id: 'cat-fun',
    name: 'Rozrywka & wyjazdy',
    type: 'expense',
    icon: 'plane',
    color: '#c084fc',
    monthlyBudgetGrosze: 70000,
  },
  {
    id: 'cat-salary',
    name: 'Wynagrodzenie / B2B',
    type: 'income',
    icon: 'briefcase',
    color: '#ffffff',
  },
  {
    id: 'cat-freelance',
    name: 'Projekty dodatkowe',
    type: 'income',
    icon: 'sparkles',
    color: '#60a5fa',
  },
  {
    id: 'cat-invest-inc',
    name: 'Odsetki & zwroty',
    type: 'income',
    icon: 'trending-up',
    color: '#d4af37',
  },
];

export const SYSTEM_CATEGORY_TRANSFER = 'cat-transfer';
export const SYSTEM_CATEGORY_ADJUSTMENT = 'cat-adjustment';

export function createCleanDatabase(todayStr: string): FinanceDB {
  return {
    version: 3,
    mode: 'custom',
    updatedAt: todayStr,
    accounts: [
      {
        id: 'acc-cash',
        name: 'Gotówka w portfelu',
        kind: 'cash',
        initialBalanceGrosze: 0,
        color: '#d4af37',
        includeInLiquid: true,
      },
      {
        id: 'acc-bank',
        name: 'Konto główne',
        kind: 'bank',
        initialBalanceGrosze: 0,
        color: '#ffffff',
        includeInLiquid: true,
      },
      {
        id: 'acc-savings',
        name: 'Oszczędności',
        kind: 'savings',
        initialBalanceGrosze: 0,
        color: '#3b82f6',
        includeInLiquid: false,
      },
    ],
    categories: DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      monthlyBudgetGrosze: undefined,
    })),
    transactions: [],
    targets: {
      monthlyExpenseLimitGrosze: 0,
      monthlyIncomeGoalGrosze: 0,
    },
  };
}

export function createDemoDatabase(todayStr: string): FinanceDB {
  const transactions: Transaction[] = [];
  let seq = 1;
  const pushTx = (tx: Omit<Transaction, 'id'>) => {
    transactions.push({ ...tx, id: `t${seq++}` });
  };

  // Concise monthly history (2024-01 through 2026-10) keeping cookie footprint super light (~2.5 KB)
  const monthlySeries: Array<{
    ym: string;
    income: number;
    incomeCat: string;
    home: number;
    food: number;
    cashAmt: number;
    cashCat: string;
  }> = [
    // 2024
    { ym: '2024-01', income: 880000, incomeCat: 'cat-salary', home: 225000, food: 162000, cashAmt: 52000, cashCat: 'cat-tech' },
    { ym: '2024-02', income: 840000, incomeCat: 'cat-salary', home: 228000, food: 158000, cashAmt: 45000, cashCat: 'cat-health' },
    { ym: '2024-03', income: 1085000, incomeCat: 'cat-salary', home: 220000, food: 171000, cashAmt: 58000, cashCat: 'cat-coffee' },
    { ym: '2024-04', income: 930000, incomeCat: 'cat-salary', home: 218000, food: 165000, cashAmt: 86000, cashCat: 'cat-fun' },
    { ym: '2024-05', income: 1045000, incomeCat: 'cat-salary', home: 215000, food: 174000, cashAmt: 62000, cashCat: 'cat-coffee' },
    { ym: '2024-06', income: 1170000, incomeCat: 'cat-freelance', home: 212000, food: 182000, cashAmt: 145000, cashCat: 'cat-fun' },
    { ym: '2024-07', income: 980000, incomeCat: 'cat-salary', home: 210000, food: 194000, cashAmt: 210000, cashCat: 'cat-fun' },
    { ym: '2024-08', income: 0, incomeCat: 'cat-salary', home: 214000, food: 179000, cashAmt: 64000, cashCat: 'cat-coffee' },
    { ym: '2024-09', income: 1050000, incomeCat: 'cat-salary', home: 221000, food: 168000, cashAmt: 92000, cashCat: 'cat-tech' },
    { ym: '2024-10', income: 1100000, incomeCat: 'cat-salary', home: 229000, food: 172000, cashAmt: 51000, cashCat: 'cat-health' },
    { ym: '2024-11', income: 985000, incomeCat: 'cat-salary', home: 235000, food: 169000, cashAmt: 89000, cashCat: 'cat-transport' },
    { ym: '2024-12', income: 1220000, incomeCat: 'cat-freelance', home: 242000, food: 224000, cashAmt: 185000, cashCat: 'cat-fun' },
    // 2025
    { ym: '2025-01', income: 1070000, incomeCat: 'cat-salary', home: 238000, food: 175000, cashAmt: 59000, cashCat: 'cat-health' },
    { ym: '2025-02', income: 960000, incomeCat: 'cat-salary', home: 241000, food: 162000, cashAmt: 44000, cashCat: 'cat-coffee' },
    { ym: '2025-03', income: 1300000, incomeCat: 'cat-freelance', home: 234000, food: 179000, cashAmt: 66000, cashCat: 'cat-tech' },
    { ym: '2025-04', income: 1155000, incomeCat: 'cat-salary', home: 229000, food: 172000, cashAmt: 118000, cashCat: 'cat-fun' },
    { ym: '2025-05', income: 1250000, incomeCat: 'cat-salary', home: 226000, food: 185000, cashAmt: 72000, cashCat: 'cat-coffee' },
    { ym: '2025-06', income: 1470000, incomeCat: 'cat-freelance', home: 224000, food: 188000, cashAmt: 135000, cashCat: 'cat-fun' },
    { ym: '2025-07', income: 1205000, incomeCat: 'cat-salary', home: 222000, food: 205000, cashAmt: 260000, cashCat: 'cat-fun' },
    { ym: '2025-08', income: 1135000, incomeCat: 'cat-salary', home: 225000, food: 189000, cashAmt: 68000, cashCat: 'cat-transport' },
    { ym: '2025-09', income: 1310000, incomeCat: 'cat-salary', home: 232000, food: 176000, cashAmt: 112000, cashCat: 'cat-tech' },
    { ym: '2025-10', income: 1200000, incomeCat: 'cat-salary', home: 239000, food: 181000, cashAmt: 55000, cashCat: 'cat-coffee' },
    { ym: '2025-11', income: 1340000, incomeCat: 'cat-freelance', home: 245000, food: 179000, cashAmt: 94000, cashCat: 'cat-tech' },
    { ym: '2025-12', income: 1480000, incomeCat: 'cat-salary', home: 251000, food: 232000, cashAmt: 215000, cashCat: 'cat-fun' },
    // 2026 Jan-Oct
    { ym: '2026-01', income: 1220000, incomeCat: 'cat-salary', home: 248000, food: 184000, cashAmt: 62000, cashCat: 'cat-health' },
    { ym: '2026-02', income: 1175000, incomeCat: 'cat-salary', home: 249000, food: 171000, cashAmt: 56000, cashCat: 'cat-coffee' },
    { ym: '2026-03', income: 1600000, incomeCat: 'cat-freelance', home: 244000, food: 189000, cashAmt: 78000, cashCat: 'cat-tech' },
    { ym: '2026-04', income: 1290000, incomeCat: 'cat-salary', home: 239000, food: 178000, cashAmt: 132000, cashCat: 'cat-fun' },
    { ym: '2026-05', income: 1500000, incomeCat: 'cat-salary', home: 236000, food: 192000, cashAmt: 69000, cashCat: 'cat-transport' },
    { ym: '2026-06', income: 1860000, incomeCat: 'cat-freelance', home: 234000, food: 196000, cashAmt: 164000, cashCat: 'cat-fun' },
    { ym: '2026-07', income: 1530000, incomeCat: 'cat-salary', home: 231000, food: 211000, cashAmt: 245000, cashCat: 'cat-fun' },
    { ym: '2026-08', income: 1315000, incomeCat: 'cat-salary', home: 235000, food: 194000, cashAmt: 54000, cashCat: 'cat-health' },
    { ym: '2026-09', income: 1490000, incomeCat: 'cat-salary', home: 242000, food: 185000, cashAmt: 118000, cashCat: 'cat-tech' },
    { ym: '2026-10', income: 1370000, incomeCat: 'cat-salary', home: 247000, food: 189000, cashAmt: 68000, cashCat: 'cat-coffee' },
  ];

  monthlySeries.forEach((m, idx) => {
    if (m.income > 0) {
      pushTx({
        type: 'income',
        amountGrosze: m.income,
        date: `${m.ym}-10`,
        time: '09:15',
        accountId: 'acc-bank',
        categoryId: m.incomeCat,
        title: m.incomeCat === 'cat-freelance' ? 'Wypłata + projekt' : 'Wynagrodzenie',
      });
    }
    pushTx({
      type: 'expense',
      amountGrosze: m.home,
      date: `${m.ym}-05`,
      time: '10:00',
      accountId: 'acc-bank',
      categoryId: 'cat-home',
      title: 'Czynsz i media',
    });
    pushTx({
      type: 'expense',
      amountGrosze: m.food + 48000,
      date: `${m.ym}-14`,
      time: '17:30',
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      title: 'Zakupy i paliwo',
    });
    pushTx({
      type: 'expense',
      amountGrosze: m.cashAmt,
      date: `${m.ym}-21`,
      time: '18:10',
      accountId: 'acc-cash',
      categoryId: m.cashCat,
      title: 'Wydatki gotówkowe',
    });
    pushTx({
      type: 'transfer',
      amountGrosze: m.cashAmt,
      date: `${m.ym}-02`,
      time: '12:00',
      accountId: 'acc-bank',
      toAccountId: 'acc-cash',
      categoryId: SYSTEM_CATEGORY_TRANSFER,
      title: 'Bankomat → portfel',
    });

    // Keep realistic everyday checking & savings balances instead of accumulating 180k+
    if (m.income > 0) {
      const surplus = Math.max(150000, m.income - (m.home + m.food + 48000 + m.cashAmt) - 18000);
      pushTx({
        type: 'transfer',
        amountGrosze: Math.round(surplus * 0.55),
        date: `${m.ym}-16`,
        time: '11:20',
        accountId: 'acc-bank',
        toAccountId: idx % 2 === 0 ? 'acc-savings' : 'acc-invest',
        categoryId: SYSTEM_CATEGORY_TRANSFER,
        title: idx % 2 === 0 ? 'Zasilenie poduszki' : 'Zakup obligacji',
      });
      pushTx({
        type: 'expense',
        amountGrosze: Math.round(surplus * 0.42),
        date: `${m.ym}-24`,
        time: '15:40',
        accountId: 'acc-bank',
        categoryId: 'cat-fun',
        title: 'Wydatki bieżące i styl życia',
      });
    }
  });

  // Detailed current month (2026-11) transactions
  const novTransactions: Array<Omit<Transaction, 'id'>> = [
    {
      type: 'expense',
      amountGrosze: 249000,
      date: '2026-11-03',
      time: '09:30',
      accountId: 'acc-bank',
      categoryId: 'cat-home',
      title: 'Czynsz i media — listopad',
    },
    {
      type: 'transfer',
      amountGrosze: 60000,
      date: '2026-11-05',
      time: '13:15',
      accountId: 'acc-bank',
      toAccountId: 'acc-cash',
      categoryId: SYSTEM_CATEGORY_TRANSFER,
      title: 'Wypłata gotówki — bankomat',
    },
    {
      type: 'income',
      amountGrosze: 1150000,
      date: '2026-11-10',
      time: '08:50',
      accountId: 'acc-bank',
      categoryId: 'cat-salary',
      title: 'Wynagrodzenie — listopad',
    },
    {
      type: 'transfer',
      amountGrosze: 300000,
      date: '2026-11-11',
      time: '10:05',
      accountId: 'acc-bank',
      toAccountId: 'acc-invest',
      categoryId: SYSTEM_CATEGORY_TRANSFER,
      title: 'Dokupienie obligacji skarbowych',
    },
    {
      type: 'expense',
      amountGrosze: 32450,
      date: '2026-11-14',
      time: '18:20',
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      title: 'Duże zakupy — Lidl',
    },
    {
      type: 'expense',
      amountGrosze: 28000,
      date: '2026-11-17',
      time: '16:40',
      accountId: 'acc-bank',
      categoryId: 'cat-transport',
      title: 'Tankowanie Orlen',
    },
    {
      type: 'income',
      amountGrosze: 285000,
      date: '2026-11-19',
      time: '15:12',
      accountId: 'acc-bank',
      categoryId: 'cat-freelance',
      title: 'Konsultacja techniczna B2B',
    },
    {
      type: 'expense',
      amountGrosze: 14500,
      date: '2026-11-21',
      time: '12:05',
      accountId: 'acc-cash',
      categoryId: 'cat-food',
      title: 'Warzywniak i piekarnia (gotówka)',
    },
    {
      type: 'expense',
      amountGrosze: 4890,
      date: '2026-11-24',
      time: '08:40',
      accountId: 'acc-cash',
      categoryId: 'cat-coffee',
      title: 'Kawa i bajgiel na mieście',
    },
    {
      type: 'expense',
      amountGrosze: 18640,
      date: '2026-11-25',
      time: '19:15',
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      title: 'Kolacja i zakupy Biedronka',
    },
    {
      type: 'expense',
      amountGrosze: 3400,
      date: '2026-11-26',
      time: '09:10',
      accountId: 'acc-cash',
      categoryId: 'cat-coffee',
      title: 'Espresso i woda — gotówka',
    },
    {
      type: 'expense',
      amountGrosze: 6900,
      date: '2026-11-26',
      time: '13:45',
      accountId: 'acc-bank',
      categoryId: 'cat-tech',
      title: 'Subskrypcja chmury + narzędzia',
    },
    // Planned December 2026 items
    {
      type: 'income',
      amountGrosze: 1150000,
      date: '2026-12-10',
      time: '09:00',
      accountId: 'acc-bank',
      categoryId: 'cat-salary',
      title: 'Planowane wynagrodzenie — grudzień',
      isPlanned: true,
    },
    {
      type: 'expense',
      amountGrosze: 250000,
      date: '2026-12-05',
      time: '10:00',
      accountId: 'acc-bank',
      categoryId: 'cat-home',
      title: 'Planowany czynsz — grudzień',
      isPlanned: true,
    },
    {
      type: 'expense',
      amountGrosze: 180000,
      date: '2026-12-20',
      time: '15:00',
      accountId: 'acc-bank',
      categoryId: 'cat-fun',
      title: 'Budżet świąteczny (prognoza)',
      isPlanned: true,
    },
  ];

  for (const tx of novTransactions) {
    pushTx(tx);
  }

  return {
    version: 3,
    mode: 'demo',
    updatedAt: todayStr,
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions,
    targets: {
      monthlyExpenseLimitGrosze: 680000,
      monthlyIncomeGoalGrosze: 1250000,
      yearlyOverrides: {
        '2024': { monthlyExpenseLimitGrosze: 620000, monthlyIncomeGoalGrosze: 1000000 },
        '2025': { monthlyExpenseLimitGrosze: 650000, monthlyIncomeGoalGrosze: 1150000 },
        '2026': { monthlyExpenseLimitGrosze: 680000, monthlyIncomeGoalGrosze: 1250000 },
      },
    },
  };
}
