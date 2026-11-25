/** "New random input": seeded, so the seed in the URL gives the same input again. */
import { createRng } from '@core';
import type { Rng } from '@core';
import type { Operation } from './operations';
import { formatKeys, formatOperations } from './operations';
import type { HeapOpKind } from './heap';

export interface RandomInput {
  /** Starting keys as text, ready for the URL. */
  readonly start: string;
  readonly operations: string;
  /** Table size, for the hash tables. */
  readonly size?: number;
}

function distinctKeys(rng: Rng, count: number, low: number, high: number): number[] {
  const pool = rng.shuffle(Array.from({ length: high - low + 1 }, (_, i) => low + i));
  return pool.slice(0, count);
}

/** Sifts every parent down, so a random array becomes a valid heap before the operations begin. */
function heapify(array: number[]): number[] {
  const a = [...array];
  for (let p = Math.floor(a.length / 2) - 1; p >= 0; p -= 1) {
    let i = p;
    for (;;) {
      const l = 2 * i + 1;
      let c = i;
      if (l < a.length && (a[l] ?? 0) < (a[c] ?? 0)) c = l;
      if (l + 1 < a.length && (a[l + 1] ?? 0) < (a[c] ?? 0)) c = l + 1;
      if (c === i) break;
      [a[i], a[c]] = [a[c] ?? 0, a[i] ?? 0];
      i = c;
    }
  }
  return a;
}

export function randomBst(seed: number): RandomInput {
  const rng = createRng(seed);
  const start = distinctKeys(rng, rng.int(4, 8), 1, 99);
  const operations: Operation[] = [];
  for (let i = 0; i < 7; i += 1) {
    const roll = rng.next();
    const existing = rng.pick(start);
    if (roll < 0.4) operations.push({ kind: 'insert', key: rng.int(1, 99) });
    else if (roll < 0.8) operations.push({ kind: 'delete', key: rng.next() < 0.8 ? existing : rng.int(1, 99) });
    else operations.push({ kind: 'search', key: rng.next() < 0.5 ? existing : rng.int(1, 99) });
  }
  return { start: formatKeys(start), operations: formatOperations(operations) };
}

export function randomHeap(seed: number): RandomInput {
  const rng = createRng(seed);
  const start = heapify(distinctKeys(rng, rng.int(5, 9), 1, 60));
  const operations: Operation<HeapOpKind>[] = [];
  for (let i = 0; i < 5; i += 1) operations.push(rng.next() < 0.6 ? { kind: 'insert', key: rng.int(1, 60) } : { kind: 'extract', key: null });
  return { start: formatKeys(start), operations: formatOperations(operations) };
}

export function randomHash(seed: number): RandomInput {
  const rng = createRng(seed);
  const size = rng.int(5, 9);
  const start = distinctKeys(rng, rng.int(2, 4), 0, 60);
  const operations: Operation[] = [];
  for (let i = 0; i < 8; i += 1) {
    const roll = rng.next();
    const key = roll < 0.5 || start.length === 0 ? rng.int(0, 60) : rng.pick(start);
    operations.push({ kind: roll < 0.5 ? 'insert' : roll < 0.8 ? 'search' : 'delete', key });
  }
  return { start: formatKeys(start), operations: formatOperations(operations), size };
}
