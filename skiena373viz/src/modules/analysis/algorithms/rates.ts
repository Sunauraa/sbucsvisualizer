/** Growth-rate arithmetic for the growth-rates view. Pure; never returns Infinity or NaN text. */
import { GROWTH_FNS, growthFn } from '@core';
import type { GrowthFnId } from '@core';

export const RATE_IDS: readonly GrowthFnId[] = GROWTH_FNS.map((fn) => fn.id);

/** Names as a student writes them. */
export const RATE_LABEL: Readonly<Record<GrowthFnId, string>> = {
  '1': '1', 'log n': 'log n', n: 'n', 'n log n': 'n log n', 'n²': 'n²', 'n³': 'n³', '2^n': '2ⁿ',
};

/** Short codes for the URL. */
export const RATE_CODE: Readonly<Record<GrowthFnId, string>> = {
  '1': 'c', 'log n': 'l', n: 'n', 'n log n': 'nl', 'n²': 'n2', 'n³': 'n3', '2^n': 'e',
};

export function ratesFromCodes(text: string | undefined, fallback: readonly GrowthFnId[]): readonly GrowthFnId[] {
  if (text === undefined) return fallback;
  const codes = new Set(text.split(','));
  return RATE_IDS.filter((id) => codes.has(RATE_CODE[id]));
}

const SUPERSCRIPT: Readonly<Record<string, string>> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const superscript = (n: number): string => String(n).split('').map((ch) => SUPERSCRIPT[ch] ?? ch).join('');

/** log10 of f(n), computed so that it never overflows. Null when f(n) is 0 or n is not a positive size. */
export function log10Of(id: GrowthFnId, n: number): number | null {
  if (!Number.isFinite(n) || n < 1) return null;
  switch (id) {
    case '1': return 0;
    case 'log n': return n <= 1 ? null : Math.log10(Math.log2(n));
    case 'n': return Math.log10(n);
    case 'n log n': return n <= 1 ? null : Math.log10(n) + Math.log10(Math.log2(n));
    case 'n²': return 2 * Math.log10(n);
    case 'n³': return 3 * Math.log10(n);
    case '2^n': return n * Math.log10(2);
  }
}

/** 1,234,567 style grouping with a thin space, so that numbers are easy to read. */
export const group = (whole: number): string => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** A count of steps in words that never overflow: "12", "1 048 576", or "1.27 × 10³⁰". */
export function formatSteps(id: GrowthFnId, n: number): string {
  const log = log10Of(id, n);
  if (!Number.isFinite(n) || n < 1) return '–';
  if (log === null) return '0';
  if (log < 6) {
    const value = growthFn(id).f(n);
    return Number.isInteger(value) ? group(value) : String(Number(value.toFixed(2)));
  }
  return scientific(log);
}

/** 10^log as "m × 10^e", from the logarithm alone. */
export function scientific(log: number): string {
  let exponent = Math.floor(log);
  let mantissa = 10 ** (log - exponent);
  if (Number(mantissa.toFixed(2)) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(2)} × 10${superscript(exponent)}`;
}

export const STEPS_PER_SECOND = 1e9;

export interface TimeBudget {
  readonly id: string;
  readonly label: string;
  readonly seconds: number;
}

export const BUDGETS: readonly TimeBudget[] = [
  { id: 'ms', label: 'one millisecond', seconds: 1e-3 },
  { id: 's', label: 'one second', seconds: 1 },
  { id: 'min', label: 'one minute', seconds: 60 },
  { id: 'h', label: 'one hour', seconds: 3600 },
  { id: 'd', label: 'one day', seconds: 86_400 },
  { id: 'y', label: 'one year', seconds: 31_536_000 },
];

export type MaxSize =
  | { readonly kind: 'any' }
  | { readonly kind: 'exponent'; readonly exponent: number }
  | { readonly kind: 'size'; readonly n: number };

/** The largest n whose f(n) steps fit in the budget, at STEPS_PER_SECOND. */
export function maxSizeWithin(id: GrowthFnId, seconds: number, rate = STEPS_PER_SECOND): MaxSize {
  const steps = Math.floor(seconds * rate);
  if (steps < 1) return { kind: 'size', n: 0 };
  if (id === '1') return { kind: 'any' };
  if (id === 'log n') return { kind: 'exponent', exponent: steps };
  if (id === '2^n') return { kind: 'size', n: Math.floor(Math.log2(steps)) };
  const { f } = growthFn(id);
  let low = 1;
  let high = steps;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (f(middle) <= steps) low = middle;
    else high = middle - 1;
  }
  return { kind: 'size', n: low };
}

export function describeMaxSize(size: MaxSize): string {
  switch (size.kind) {
    case 'any': return 'any n: the cost never grows';
    case 'exponent': return `n up to 2^${group(size.exponent)}, far beyond any array`;
    case 'size': return size.n < 1 ? 'not even n = 1' : `n up to ${group(size.n)}`;
  }
}

/** Seconds as a duration in a sensible unit, from a logarithm of the number of seconds. */
export function formatDuration(log10Seconds: number | null): string {
  if (log10Seconds === null) return '0';
  const seconds = log10Seconds;
  const units: readonly [number, string][] = [
    [-9, 'ns'], [-6, 'µs'], [-3, 'ms'], [0, 'seconds'],
  ];
  if (seconds < -9) return 'under a nanosecond';
  if (seconds < 0) {
    const [exp, name] = [...units].reverse().find(([e]) => seconds >= e) ?? units[0] as [number, string];
    return `${trimNumber(10 ** (seconds - exp))} ${name}`;
  }
  const value = 10 ** Math.min(seconds, 300);
  if (seconds > 300) return `${scientific(seconds - Math.log10(31_536_000))} years`;
  if (value < 60) return plural(value, 'second');
  if (value < 3600) return plural(value / 60, 'minute');
  if (value < 86_400) return plural(value / 3600, 'hour');
  if (value < 31_536_000) return plural(value / 86_400, 'day');
  const years = seconds - Math.log10(31_536_000);
  return years < 6 ? `${group(Math.round(10 ** years))} years` : `${scientific(years)} years`;
}

function plural(value: number, unit: string): string {
  const text = trimNumber(value);
  return `${text} ${text === '1' ? unit : `${unit}s`}`;
}

const trimNumber = (value: number): string => String(Number(value.toPrecision(3)));

/** How long f(n) steps take at STEPS_PER_SECOND. */
export function timeAt(id: GrowthFnId, n: number): string {
  const log = log10Of(id, n);
  return formatDuration(log === null ? null : log - Math.log10(STEPS_PER_SECOND));
}

/** The smallest n from which `higher` stays strictly above `lower` for every n up to `limit`. Null if never. */
export function overtakesFrom(lower: GrowthFnId, higher: GrowthFnId, limit = 2000): number | null {
  const f = growthFn(lower).f;
  const g = growthFn(higher).f;
  let from: number | null = null;
  for (let n = limit; n >= 1; n -= 1) {
    if (g(n) > f(n)) from = n;
    else break;
  }
  return from;
}

/** One sentence per neighbouring pair: from which n the faster-growing curve stays above the slower. */
export function dominanceLines(ids: readonly GrowthFnId[] = RATE_IDS): string[] {
  const lines: string[] = [];
  for (let i = 0; i + 1 < ids.length; i += 1) {
    const lower = ids[i];
    const higher = ids[i + 1];
    if (lower === undefined || higher === undefined) continue;
    const from = overtakesFrom(lower, higher);
    lines.push(from === null
      ? `${RATE_LABEL[higher]} does not stay above ${RATE_LABEL[lower]}.`
      : `${RATE_LABEL[higher]} is above ${RATE_LABEL[lower]} from n = ${from} on, and for good.`);
  }
  return lines;
}

export const DOMINANCE_WORDS = 'In order of growth: 1, log n, n, n log n, n², n³, 2ⁿ. Each one grows strictly slower than every one to its right, so for large enough n the right-hand one is larger, whatever constant is put in front of the left-hand one.';

/** Where a curve leaves the chart: the first integer n at which it is above `ceiling`, or null if it stays below up to `maxN`. */
export function leavesAt(id: GrowthFnId, ceiling: number, maxN: number): number | null {
  const { f } = growthFn(id);
  for (let n = 1; n <= maxN; n += 1) if (f(n) > ceiling) return n;
  return null;
}
