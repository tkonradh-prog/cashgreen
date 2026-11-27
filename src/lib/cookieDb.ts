import LZString from 'lz-string';
import {
  Account,
  AccountKind,
  Category,
  CategoryType,
  CookieStorageStats,
  FinanceDB,
  Transaction,
  TransactionType,
} from './types';

export const COOKIE_META_KEY = 'finte_db_m';
export const COOKIE_CHUNK_PREFIX = 'finte_db_';
export const CURRENT_DB_VERSION = 3;
const CHUNK_SIZE = 3600; // Safe margin below 4096-byte per-cookie limit
const MAX_CHUNKS = 4; // Cap total Cookie header well below Node/proxy 16 KB (16384B) HTTP 431 limit
const MAX_SAFE_TOTAL_BYTES = 12000;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieMeta {
  v: number;
  c: number;
  t: string;
}

export interface CookiePair {
  name: string;
  value: string;
}

const KIND_TO_CODE: Record<AccountKind, number> = {
  cash: 0,
  bank: 1,
  savings: 2,
  investment: 3,
  liability: 4,
};
const CODE_TO_KIND: AccountKind[] = ['cash', 'bank', 'savings', 'investment', 'liability'];

const CAT_TYPE_TO_CODE: Record<CategoryType, number> = { expense: 0, income: 1 };
const CODE_TO_CAT_TYPE: CategoryType[] = ['expense', 'income'];

const TX_TYPE_TO_CODE: Record<TransactionType, number> = {
  expense: 0,
  income: 1,
  transfer: 2,
};
const CODE_TO_TX_TYPE: TransactionType[] = ['expense', 'income', 'transfer'];

type PackedAccount = [string, string, number, number, string, number, string?];
type PackedCategory = [string, string, number, string, string, number?];
type PackedTx = [
  string, // id
  number, // type code
  number, // amountGrosze
  string, // date YYYY-MM-DD (or YYMMDD)
  string, // time
  number, // account index
  number, // toAccount index (-1 if none)
  number | string, // category index or string id
  string, // title
  string, // note
  number, // bitflags: 1=isPlanned, 2=isAdjustment
];

interface PackedPayload {
  m: 0 | 1; // 0=demo, 1=custom
  u: string; // updatedAt
  a: PackedAccount[];
  c: PackedCategory[];
  x: PackedTx[];
  g: [number, number, Record<string, [number?, number?]>?];
}

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64u: string): string {
  let b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

function packDate(date: string): string {
  // 2026-11-26 -> 261126 (saves 4 chars per tx)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith('20')) {
    return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
  }
  return date;
}

function unpackDate(raw: string): string {
  if (/^\d{6}$/.test(raw)) {
    return `20${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`;
  }
  return raw;
}

function packFinanceDB(db: FinanceDB): PackedPayload {
  const accIdxMap = new Map(db.accounts.map((a, idx) => [a.id, idx]));
  const catIdxMap = new Map(db.categories.map((c, idx) => [c.id, idx]));

  const a: PackedAccount[] = db.accounts.map((acc) => {
    const tuple: PackedAccount = [
      acc.id,
      acc.name,
      KIND_TO_CODE[acc.kind] ?? 1,
      acc.initialBalanceGrosze,
      acc.color,
      acc.includeInLiquid ? 1 : 0,
    ];
    if (acc.note) tuple.push(acc.note);
    return tuple;
  });

  const c: PackedCategory[] = db.categories.map((cat) => {
    const tuple: PackedCategory = [
      cat.id,
      cat.name,
      CAT_TYPE_TO_CODE[cat.type] ?? 0,
      cat.icon,
      cat.color,
    ];
    if (cat.monthlyBudgetGrosze !== undefined) tuple.push(cat.monthlyBudgetGrosze);
    return tuple;
  });

  const x: PackedTx[] = db.transactions.map((tx) => {
    const accIdx = accIdxMap.get(tx.accountId) ?? 0;
    const toIdx = tx.toAccountId ? (accIdxMap.get(tx.toAccountId) ?? -1) : -1;
    const catRef = catIdxMap.has(tx.categoryId) ? catIdxMap.get(tx.categoryId)! : tx.categoryId;
    const flags = (tx.isPlanned ? 1 : 0) | (tx.isAdjustment ? 2 : 0);

    return [
      tx.id,
      TX_TYPE_TO_CODE[tx.type] ?? 0,
      tx.amountGrosze,
      packDate(tx.date),
      tx.time ?? '',
      accIdx,
      toIdx,
      catRef,
      tx.title,
      tx.note ?? '',
      flags,
    ];
  });

  const overrides: Record<string, [number?, number?]> | undefined = db.targets.yearlyOverrides
    ? Object.fromEntries(
        Object.entries(db.targets.yearlyOverrides).map(([yr, val]) => [
          yr,
          [val.monthlyExpenseLimitGrosze, val.monthlyIncomeGoalGrosze],
        ])
      )
    : undefined;

  return {
    m: db.mode === 'demo' ? 0 : 1,
    u: db.updatedAt,
    a,
    c,
    x,
    g: overrides
      ? [db.targets.monthlyExpenseLimitGrosze, db.targets.monthlyIncomeGoalGrosze, overrides]
      : [db.targets.monthlyExpenseLimitGrosze, db.targets.monthlyIncomeGoalGrosze],
  };
}

function sanitizeColor(color: string, kind?: AccountKind): string {
  // Strip old green palette
  if (color === '#5ad7a4' || color === '#9ae8c8' || color === '#3a9d78' || color === '#d3f5e6' || color === '#2d7a5c') {
    if (kind === 'cash') return '#d4af37';
    if (kind === 'bank') return '#ffffff';
    if (kind === 'savings') return '#3b82f6';
    if (kind === 'investment') return '#818cf8';
    return '#ffffff';
  }
  return color;
}

function unpackFinanceDB(p: PackedPayload): FinanceDB {
  const accounts: Account[] = p.a.map((item) => {
    const kind = CODE_TO_KIND[item[2]] ?? 'bank';
    return {
      id: item[0],
      name: item[1],
      kind,
      initialBalanceGrosze: item[3],
      color: sanitizeColor(item[4], kind),
      includeInLiquid: item[5] === 1,
      note: item[6] || undefined,
    };
  });

  const categories: Category[] = p.c.map((item) => ({
    id: item[0],
    name: item[1],
    type: CODE_TO_CAT_TYPE[item[2]] ?? 'expense',
    icon: item[3],
    color: sanitizeColor(item[4]),
    monthlyBudgetGrosze: item[5],
  }));

  const transactions: Transaction[] = p.x.map((item) => {
    const acc = accounts[item[5]] ?? accounts[0];
    const toAcc = item[6] >= 0 ? accounts[item[6]] : undefined;
    const catId =
      typeof item[7] === 'number'
        ? (categories[item[7]]?.id ?? 'cat-food')
        : item[7];
    const flags = item[10] ?? 0;

    return {
      id: item[0],
      type: CODE_TO_TX_TYPE[item[1]] ?? 'expense',
      amountGrosze: item[2],
      date: unpackDate(item[3]),
      time: item[4] || undefined,
      accountId: acc?.id ?? 'acc-cash',
      toAccountId: toAcc?.id,
      categoryId: catId,
      title: item[8],
      note: item[9] || undefined,
      isPlanned: (flags & 1) !== 0 ? true : undefined,
      isAdjustment: (flags & 2) !== 0 ? true : undefined,
    };
  });

  const yearlyOverrides = p.g[2]
    ? Object.fromEntries(
        Object.entries(p.g[2]).map(([yr, pair]) => [
          yr,
          {
            monthlyExpenseLimitGrosze: pair[0],
            monthlyIncomeGoalGrosze: pair[1],
          },
        ])
      )
    : undefined;

    return {
    version: CURRENT_DB_VERSION,
    mode: p.m === 0 ? 'demo' : 'custom',
    updatedAt: p.u,
    accounts,
    categories,
    transactions,
    targets: {
      monthlyExpenseLimitGrosze: p.g[0],
      monthlyIncomeGoalGrosze: p.g[1],
      yearlyOverrides,
    },
  };
}

function encodeDatabase(db: FinanceDB): { rawJson: string; compressed: string } {
  const packed = packFinanceDB(db);
  const rawJson = JSON.stringify(packed);
  const compressed = toBase64Url(LZString.compressToBase64(rawJson));
  return { rawJson, compressed };
}

/**
 * Reconstructs FinanceDB from an array of { name, value } cookie pairs (works on SSR & Client).
 */
export function parseFinanceDBFromCookies(cookieList: CookiePair[]): FinanceDB | null {
  try {
    const map = new Map<string, string>();
    for (const c of cookieList) {
      map.set(c.name, c.value);
    }

    const metaRaw = map.get(COOKIE_META_KEY);
    if (!metaRaw) return null;

    const meta = JSON.parse(decodeURIComponent(metaRaw)) as CookieMeta;
    if (!meta || meta.v !== CURRENT_DB_VERSION || typeof meta.c !== 'number' || meta.c <= 0 || meta.c > 24) {
      return null;
    }

    let compressed = '';
    for (let i = 0; i < meta.c; i++) {
      const part = map.get(`${COOKIE_CHUNK_PREFIX}${i}`);
      if (part === undefined) return null;
      compressed += part;
    }

    const jsonStr = LZString.decompressFromBase64(fromBase64Url(compressed));
    if (!jsonStr) return null;
    const packed = JSON.parse(jsonStr) as PackedPayload;
    if (!packed || !Array.isArray(packed.a) || !Array.isArray(packed.x)) return null;
    return unpackFinanceDB(packed);
  } catch {
    return null;
  }
}

export function getBrowserCookies(): CookiePair[] {
  if (typeof document === 'undefined' || !document.cookie) return [];
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) return { name: part, value: '' };
      return {
        name: part.slice(0, eqIdx).trim(),
        value: part.slice(eqIdx + 1).trim(),
      };
    });
}

/**
 * Serializes and writes FinanceDB into compact chunked browser cookies,
 * keeping total Cookie header size safely below Node's 16 KB HTTP 431 limit.
 */
export function saveFinanceDBToCookies(db: FinanceDB): CookieStorageStats {
  const { rawJson, compressed } = encodeDatabase(db);

  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + CHUNK_SIZE));
  }
  if (chunks.length === 0) {
    chunks.push('');
  }

  // Prevent writing cookies that would breach Node's 16 KB HTTP header limit (HTTP 431)
  const totalHeaderEstimate =
    compressed.length + chunks.length * 16 + 80;
  const canWriteSafely =
    chunks.length <= MAX_CHUNKS && totalHeaderEstimate <= MAX_SAFE_TOTAL_BYTES;

  if (typeof document !== 'undefined' && canWriteSafely) {
    const attrs = `Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;

    const existing = getBrowserCookies();
    for (const c of existing) {
      if (c.name.startsWith(COOKIE_CHUNK_PREFIX) && c.name !== COOKIE_META_KEY) {
        const suffix = c.name.slice(COOKIE_CHUNK_PREFIX.length);
        const idx = Number(suffix);
        if (Number.isInteger(idx) && idx >= chunks.length) {
          document.cookie = `${c.name}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
      }
    }

    chunks.forEach((chunk, index) => {
      document.cookie = `${COOKIE_CHUNK_PREFIX}${index}=${chunk}; ${attrs}`;
    });

    const meta: CookieMeta = {
      v: CURRENT_DB_VERSION,
      c: chunks.length,
      t: db.updatedAt,
    };
    document.cookie = `${COOKIE_META_KEY}=${encodeURIComponent(JSON.stringify(meta))}; ${attrs}`;
  }

  return computeStorageStats(rawJson, compressed, chunks.length);
}

export function clearFinanceDBCookies(): void {
  if (typeof document === 'undefined') return;
  const existing = getBrowserCookies();
  for (const c of existing) {
    if (c.name === COOKIE_META_KEY || c.name.startsWith(COOKIE_CHUNK_PREFIX)) {
      document.cookie = `${c.name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
}

export function getCookieStorageStats(db: FinanceDB): CookieStorageStats {
  const { rawJson, compressed } = encodeDatabase(db);
  const chunkCount = Math.max(1, Math.ceil(compressed.length / CHUNK_SIZE));
  return computeStorageStats(rawJson, compressed, chunkCount);
}

function computeStorageStats(
  rawJson: string,
  compressed: string,
  chunkCount: number
): CookieStorageStats {
  const maxRecommendedBytes = MAX_SAFE_TOTAL_BYTES;
  const encodedBytes = compressed.length;
  const rawJsonBytes = rawJson.length;
  const usagePercent = Math.min(100, Math.round((encodedBytes / maxRecommendedBytes) * 100));
  return {
    chunkCount,
    encodedBytes,
    rawJsonBytes,
    maxRecommendedBytes,
    usagePercent,
  };
}
