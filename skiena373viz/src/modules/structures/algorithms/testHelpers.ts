/** Shared by the tests of this module only. */
import type { Frame, TraceEvent } from '@core';

/** Elements of `a` not matched in `b`, as a multiset difference. */
export function multisetMinus(a: readonly number[], b: readonly number[]): number[] {
  const remaining = [...b];
  const out: number[] = [];
  for (const x of a) {
    const at = remaining.indexOf(x);
    if (at >= 0) remaining.splice(at, 1);
    else out.push(x);
  }
  return out;
}

/**
 * Section 2.2, rule 8: the keys in the structure plus the keys in transit may change only in a frame
 * whose events say `insert` or `remove` of exactly that key. Also flags a key stored twice.
 */
export function keyChangeProblem(
  now: readonly number[],
  before: readonly number[] | null,
  events: readonly TraceEvent[],
  unique: boolean,
): string | null {
  if (unique && new Set(now).size !== now.length) return `a key is stored twice: ${now.join(', ')}`;
  if (before === null) return null;
  const added = multisetMinus(now, before);
  const removed = multisetMinus(before, now);
  if (added.length === 0 && removed.length === 0) return null;
  const has = (kind: string, key: number): boolean => events.some((e) => e.kind === kind && e.targets.includes(`key:${key}`));
  if (added.length === 1 && removed.length === 0 && has('insert', added[0] ?? NaN)) return null;
  if (removed.length === 1 && added.length === 0 && has('remove', removed[0] ?? NaN)) return null;
  return `keys changed (added ${added.join(',')}; removed ${removed.join(',')}) without a matching insert/remove event`;
}

/** Frames at which each operation starts, plus the final frame: the settled states between operations. */
export function settledFrames<S extends { readonly log: { readonly current: number | null } }>(frames: readonly Frame<S>[]): Frame<S>[] {
  const out: Frame<S>[] = [];
  let seen = -1;
  for (const frame of frames) {
    const current = frame.state.log.current;
    if (current !== null && current !== seen) {
      seen = current;
      out.push(frame);
    }
  }
  const last = frames[frames.length - 1];
  if (last) out.push(last);
  return out;
}
