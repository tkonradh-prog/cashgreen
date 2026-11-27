export const POLISH_MONTHS_SHORT = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
] as const;

export const POLISH_MONTHS_FULL = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const;

export const POLISH_WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] as const;

/**
 * Formats integer grosze as Polish PLN string, e.g. 401040 -> "4 010,40 zł"
 */
export function formatPLN(
  grosze: number,
  options?: {
    showSign?: boolean;
    decimals?: boolean;
    compactZeroDecimals?: boolean;
  }
): string {
  const showSign = options?.showSign ?? false;
  const decimals = options?.decimals ?? true;
  const compactZeroDecimals = options?.compactZeroDecimals ?? false;

  const isNegative = grosze < 0;
  const absVal = Math.abs(grosze) / 100;

  const hasFraction = Math.abs(grosze) % 100 !== 0;
  const useDecimals = decimals && !(compactZeroDecimals && !hasFraction);

  const formattedNumber = absVal.toLocaleString('pl-PL', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  });

  const prefix = isNegative ? '−' : showSign && grosze > 0 ? '+' : '';
  return `${prefix}${formattedNumber} zł`;
}

/**
 * Formats integer grosze compactly in thousands like in Finte screenshots: "26,8 tys." or "4 tys."
 */
export function formatCompactTys(grosze: number, withUnit = true): string {
  const zloty = grosze / 100;
  const abs = Math.abs(zloty);
  const sign = zloty < 0 ? '−' : '';

  if (abs === 0) return withUnit ? '0' : '0';

  if (abs >= 1000) {
    const tys = abs / 1000;
    const rounded = Math.round(tys * 10) / 10;
    const str = rounded.toLocaleString('pl-PL', {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
    return withUnit ? `${sign}${str} tys.` : `${sign}${str}`;
  }

  const rounded = Math.round(abs);
  return `${sign}${rounded.toLocaleString('pl-PL')}${withUnit ? ' zł' : ''}`;
}

/**
 * Formats heatmap cell number in thousands (like Screenshot 5: "3,9", "10,9", "0")
 */
export function formatHeatmapValue(grosze: number): string {
  if (grosze === 0) return '0';
  const zloty = grosze / 100;
  const abs = Math.abs(zloty);
  const sign = zloty < 0 ? '−' : '';

  if (abs >= 100) {
    const tys = Math.round((abs / 1000) * 10) / 10;
    return `${sign}${tys.toLocaleString('pl-PL', {
      minimumFractionDigits: tys % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    })}`;
  }
  return `${sign}0,1`;
}

/**
 * Parses a user-entered PLN string ("45,50", "1 200.99", "45") into integer grosze.
 * Returns null if invalid or <= 0 (unless allowZeroOrNegative).
 */
export function parsePLNInput(
  raw: string,
  options?: { allowNegative?: boolean; allowZero?: boolean }
): number | null {
  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/zł|pln/gi, '')
    .replace(',', '.');

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) {
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric)) return null;
    const grosze = Math.round(numeric * 100);
    if (!options?.allowNegative && grosze < 0) return null;
    if (!options?.allowZero && grosze === 0) return null;
    return grosze;
  }

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  const grosze = Math.round(numeric * 100);
  if (!options?.allowNegative && grosze < 0) return null;
  if (!options?.allowZero && grosze === 0) return null;
  return grosze;
}

export function groszeToInputString(grosze: number): string {
  const zloty = grosze / 100;
  return zloty.toFixed(2).replace('.', ',');
}

export function formatDateGroupLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) {
    const [, m, d] = dateStr.split('-').map(Number);
    return `Dzisiaj · ${d} ${POLISH_MONTHS_SHORT[m - 1]}`;
  }

  const yesterday = addDays(todayStr, -1);
  if (dateStr === yesterday) {
    const [, m, d] = dateStr.split('-').map(Number);
    return `Wczoraj · ${d} ${POLISH_MONTHS_SHORT[m - 1]}`;
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekdayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const wd = weekdayNames[dt.getUTCDay()];
  return `${wd}, ${d} ${POLISH_MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${POLISH_MONTHS_SHORT[m - 1]} ${y}`;
}

export function addDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function getWarsawToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getCurrentTimeHHMM(): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
