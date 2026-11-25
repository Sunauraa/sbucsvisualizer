/** Shared by the three sorts: items, the common op set, labels and the call-tree node. */
import { defineOps } from '@core';

/** One key with its original position. Equal keys stay distinguishable through `id`. */
export interface Item {
  readonly key: number;
  readonly id: number;
}

export type PivotRule = 'last' | 'random' | 'median-of-three';
export const PIVOT_RULES: readonly PivotRule[] = ['last', 'random', 'median-of-three'];

export interface SortInput {
  readonly items: readonly number[];
  /** Quicksort only. Default 'last'. */
  readonly pivot?: PivotRule;
  /** Quicksort with a random pivot only. Default 373. */
  readonly seed?: number;
}

/** The same ids and meanings in all three sorts, so that a race is fair. */
export const SORT_OPS = defineOps([
  { id: 'comparisons', label: 'Comparisons', counts: 'One each time two keys are compared with < or >; indexes and loop tests are not counted.' },
  { id: 'swaps', label: 'Swaps', counts: 'One each time two array positions exchange their items.' },
  { id: 'writes', label: 'Writes', counts: 'One each time an array or buffer position is given an item; a swap is two writes.' },
]);

/** Where a call-tree node is in its life. Calls that have not started yet are not in the tree. */
export interface CallNode {
  readonly id: number;
  readonly parent: number | null;
  readonly depth: number;
  /** The call works on positions lo to hi - 1. */
  readonly lo: number;
  readonly hi: number;
  readonly status: 'open' | 'done';
  /** Item ids in positions lo..hi-1 when the call started. */
  readonly ids: readonly number[];
  /** Item ids in positions lo..hi-1 when the call returned; null while open. */
  readonly out: readonly number[] | null;
  /** Key comparisons made by this call's own work (a merge or a partition), not by its children. */
  readonly cost: number;
  /** Quicksort: the pivot item's id once chosen. */
  readonly pivot: number | null;
}

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** The keys of an input, as items. -0 becomes 0 so that frames stay JSON-safe. */
export function makeItems(keys: readonly number[]): Item[] {
  return keys.map((key, id) => ({ key: key + 0, id }));
}

/** Index of the first key that is not a finite number, or -1. */
export function badKeyIndex(keys: readonly number[]): number {
  return keys.findIndex((key) => typeof key !== 'number' || !Number.isFinite(key));
}

/** Labels by item id: the key itself, or the key plus a, b, c ... in original order when keys repeat. */
export function labelsFor(items: readonly Item[]): string[] {
  const seen = new Map<number, number>();
  for (const { key } of items) seen.set(key, (seen.get(key) ?? 0) + 1);
  const next = new Map<number, number>();
  const labels: string[] = [];
  for (const { key, id } of items) {
    if ((seen.get(key) ?? 0) < 2) {
      labels[id] = String(key);
      continue;
    }
    const rank = next.get(key) ?? 0;
    next.set(key, rank + 1);
    labels[id] = `${key}${rank < 26 ? String.fromCharCode(97 + rank) : `.${rank + 1}`}`;
  }
  return labels;
}

/** The result type of every sort: the items in sorted order. */
export type SortResult = readonly Item[];

export const sortedByKey = (items: readonly Item[]): Item[] => [...items].sort((a, b) => a.key - b.key || a.id - b.id);

/** '1 item', '3 items'. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
