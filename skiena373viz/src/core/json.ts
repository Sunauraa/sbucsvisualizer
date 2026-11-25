/**
 * JSON safety. Frames must survive JSON.parse(JSON.stringify(frame)) unchanged, so that a trace can
 * be stored, replayed and compared, and so that no frame can reach back into live algorithm state.
 */

/** A distance or cost that may be infinite. Infinity is not JSON, so null means "infinity". */
export type Dist = number | null;

export const formatDist = (d: Dist): string => (d === null ? '∞' : String(d));

/** a < b where null is +infinity. */
export const distLess = (a: Dist, b: Dist): boolean => a !== null && (b === null || a < b);

/** a + b where null is +infinity. */
export const distAdd = (a: Dist, b: Dist): Dist => (a === null || b === null ? null : a + b);

export class NotJsonSafeError extends Error {
  override readonly name = 'NotJsonSafeError';
  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
  }
}

/** Walks a value and returns every reason it is not JSON-safe. Empty array means safe. */
export function jsonProblems(value: unknown, path = '$'): string[] {
  const problems: string[] = [];
  walk(value, path, [], (p, problem) => problems.push(`${p}: ${problem}`));
  return problems;
}

/**
 * Deep copy + deep freeze of a plain JSON value. Throws NotJsonSafeError with the exact path when it
 * meets undefined, NaN, Infinity, -0, a Set, Map, Date, class instance, function, symbol or a cycle.
 * The recorder calls this on every frame, so contract violations fail at the step that caused them.
 */
export function snapshot<T>(value: T, path = '$'): T {
  walk(value, path, [], (p, problem) => {
    throw new NotJsonSafeError(p, problem);
  });
  return copyFrozen(value) as T;
}

/** Deep-freezes in place (used by tests to prove that run() does not mutate its input). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

export function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

type Report = (path: string, problem: string) => void;

function walk(value: unknown, path: string, ancestors: object[], report: Report): void {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return;
    case 'number':
      if (!Number.isFinite(value)) report(path, `${String(value)} is not JSON (use null for infinity)`);
      else if (Object.is(value, -0)) report(path, '-0 does not survive JSON (write 0)');
      return;
    case 'object':
      break;
    default:
      report(path, `${typeof value} is not JSON (use null, or leave the key out)`);
      return;
  }
  if (value === null) return;
  if (ancestors.includes(value)) {
    report(path, 'circular reference');
    return;
  }
  const next = [...ancestors, value];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) walk(value[i], `${path}[${i}]`, next, report);
    return;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    report(path, `${value.constructor?.name ?? 'class instance'} is not a plain object`);
    return;
  }
  for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, next, report);
}

function copyFrozen(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(copyFrozen));
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = copyFrozen(child);
  return Object.freeze(copy);
}
