/** Heapsort: bottom-up max-heap build, then repeated extraction of the maximum. */
import { defineAlgorithm, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { badKeyIndex, labelsFor, makeItems, plural, SORT_OPS } from './common';
import type { Item, SortInput, SortResult } from './common';

export interface HeapsortState {
  readonly items: readonly Item[];
  /** Display label of each item, indexed by item id: '5', or '5a' / '5b' when keys repeat. */
  readonly labels: readonly string[];
  /** The array positions 0..heapSize-1 form the heap; the rest is the sorted suffix. */
  readonly heapSize: number;
  readonly phase: 'setup' | 'build' | 'built' | 'extract' | 'done';
  /** The position being sifted down. */
  readonly sift: number | null;
  /** The position holding the largest key seen so far in this sift step. */
  readonly big: number | null;
  readonly compare: readonly number[];
  readonly swapped: readonly number[];
  /** True when the heap property holds on the whole heap, positions 0..heapSize-1, right now. */
  readonly settled: boolean;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'heapsort(A[0..n-1])'],
  ['build-loop', 1, 'for p = ⌊n/2⌋ - 1 down to 0:'],
  ['build-call', 2, 'sift-down(p, n)'],
  ['extract-loop', 1, 'for end = n - 1 down to 1:'],
  ['swap-root', 2, 'swap A[0] and A[end]'],
  ['extract-call', 2, 'sift-down(0, end)'],
  ['sift-head', 0, 'sift-down(i, size):'],
  ['children', 1, 'big = i;  l = 2i + 1;  r = 2i + 2'],
  ['cmp-left', 1, 'if l < size and A[l] > A[big]:  big = l'],
  ['cmp-right', 1, 'if r < size and A[r] > A[big]:  big = r'],
  ['stop', 1, 'if big = i: stop'],
  ['sift-swap', 1, 'swap A[i] and A[big];  i = big;  repeat'],
  ['done', 0, 'return A'],
]);

type T = Recorder<HeapsortState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof SORT_OPS>>;

export const heapsort = defineAlgorithm({
  id: 'sorting-heapsort',
  title: 'Heapsort',
  summary: 'Build a max-heap in the array, then swap the maximum to the end and repair the heap, again and again.',
  pseudocode: PSEUDOCODE,
  ops: SORT_OPS,
  complexity: [
    { resource: 'time', when: 'worst case', bound: 'Θ(n log n)', why: 'n - 1 extractions, each sifting down at most about log n levels.' },
    { resource: 'time', when: 'building the heap, every case', bound: 'O(n)', why: 'most nodes are near the leaves and sift down only a level or two, at most 2n comparisons in all.' },
    { resource: 'space', when: 'every case', bound: 'Θ(1)', why: 'the heap lives in the input array; only a few indexes are extra.' },
  ],
  presets: [
    { id: 'mixed', label: 'Mixed order', input: { items: [5, 2, 9, 1, 7, 3, 8, 4, 6] } },
    { id: 'duplicates', label: 'Duplicates (equal keys can swap order)', input: { items: [2, 2, 1] } },
    { id: 'reversed', label: 'Reversed', input: { items: [8, 7, 6, 5, 4, 3, 2, 1] } },
    { id: 'sorted', label: 'Already sorted', input: { items: [1, 2, 3, 4, 5, 6, 7] } },
    { id: 'single', label: 'One item', input: { items: [4] } },
  ],
  execute({ items: keys }: SortInput, t: T): Finished<SortResult> {
    const bad = badKeyIndex(keys);
    const a: Item[] = bad >= 0 ? [] : makeItems(keys);
    const n = a.length;
    const labels = labelsFor(a);
    const label = (position: number): string => labels[a[position]?.id ?? -1] ?? '?';
    const key = (position: number): number => a[position]?.key ?? 0;
    let heapSize = n;
    let phase: HeapsortState['phase'] = 'setup';
    let sift: number | null = null;
    let big: number | null = null;
    let compare: number[] = [];
    let swapped: number[] = [];
    let settled = n < 2;
    const state = (): HeapsortState => ({ items: a, labels, heapSize, phase, sift, big, compare, swapped, settled });

    t.step({
      lines: ['signature'],
      say: bad >= 0
        ? `Item ${bad + 1} is not a finite number, so there is nothing sensible to sort.`
        : n === 0 ? 'The array is empty, so there is nothing to sort.' : `Heapsort ${plural(n, 'item')}: build a max-heap, then repeatedly move the maximum to the end.`,
      state,
    });
    if (bad >= 0) {
      return t.reject({ lines: ['signature'], say: `Item ${bad + 1} is not a finite number, so the input is rejected.`, state, result: [] });
    }
    if (n < 2) {
      phase = 'done';
      heapSize = 0;
      return t.finish({ lines: ['done'], say: n === 0 ? 'An empty array is already sorted.' : 'One item is already sorted.', state, result: a });
    }

    const swap = (x: number, y: number): void => {
      const held = a[x] as Item;
      a[x] = a[y] as Item;
      a[y] = held;
      t.count('swaps');
      t.count('writes', 2);
      t.event('swap', [`A[${x}]`, `A[${y}]`]);
    };

    /** Sift the item at `start` down inside positions 0..size-1. */
    const siftDown = (start: number, size: number): void => {
      let i = start;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        big = i;
        sift = i;
        compare = [];
        swapped = [];
        if (l >= size) {
          settled = phase !== 'build';
          big = null;
          t.step({ lines: ['cmp-left'], say: `Position ${i} has no child inside the heap of ${plural(size, 'item')}, so it stays and the sift-down ends.`, state });
          sift = null;
          return;
        }
        t.count('comparisons');
        t.event('compare', [`A[${l}]`, `A[${big}]`]);
        compare = [l, big];
        const bigBefore = big;
        const larger = key(l) > key(big);
        if (larger) big = l;
        t.step({
          lines: ['cmp-left'],
          say: larger
            ? `Left child ${label(l)} at position ${l} is larger than ${label(bigBefore)} at position ${bigBefore}, so position ${l} is the largest so far.`
            : key(l) === key(bigBefore)
              ? `Left child ${label(l)} at position ${l} equals ${label(bigBefore)}, and a tie does not count as larger, so position ${bigBefore} stays the largest.`
              : `Left child ${label(l)} at position ${l} is smaller than ${label(bigBefore)} at position ${bigBefore}, so position ${bigBefore} stays the largest.`,
          state,
        });
        if (r < size) {
          t.count('comparisons');
          t.event('compare', [`A[${r}]`, `A[${big}]`]);
          compare = [r, big];
          const rivalBefore = big;
          const rightLarger = key(r) > key(big);
          if (rightLarger) big = r;
          t.step({
            lines: ['cmp-right'],
            say: rightLarger
              ? `Right child ${label(r)} at position ${r} is larger than ${label(rivalBefore)} at position ${rivalBefore}, so position ${r} is the largest so far.`
              : key(r) === key(rivalBefore)
                ? `Right child ${label(r)} at position ${r} equals ${label(rivalBefore)}, and a tie does not count as larger, so position ${rivalBefore} stays the largest.`
                : `Right child ${label(r)} at position ${r} is smaller than ${label(rivalBefore)} at position ${rivalBefore}, so position ${rivalBefore} stays the largest.`,
            state,
          });
        }
        compare = [];
        if (big === i) {
          settled = phase !== 'build';
          const note = r < size ? 'both children' : 'its only child';
          big = null;
          t.step({ lines: ['stop'], say: `${label(i)} at position ${i} is at least as large as ${note}, so it is in place and the sift-down stops.`, state });
          sift = null;
          return;
        }
        const target = big;
        swap(i, target);
        swapped = [i, target];
        settled = false;
        t.step({ lines: ['sift-swap'], say: `Swap ${label(target)} up into position ${i} and ${label(i)} down into position ${target}; the sift continues from position ${target}.`, state });
        i = target;
      }
    };

    phase = 'build';
    for (let p = Math.floor(n / 2) - 1; p >= 0; p -= 1) {
      sift = p;
      big = null;
      compare = [];
      swapped = [];
      settled = false;
      t.step({ lines: ['build-call'], say: `Build step: sift ${label(p)} at position ${p} down, so that the subtree rooted there becomes a heap.`, state });
      siftDown(p, n);
    }
    phase = 'built';
    sift = null;
    big = null;
    compare = [];
    swapped = [];
    settled = true;
    t.step({ lines: ['build-loop'], say: `Every parent has been sifted down, so the array is a max-heap with ${label(0)} at the root.`, state });

    phase = 'extract';
    for (let end = n - 1; end >= 1; end -= 1) {
      const root = label(0);
      const last = label(end);
      swap(0, end);
      heapSize = end;
      swapped = [0, end];
      settled = false;
      sift = null;
      t.step({
        lines: ['swap-root'],
        say: `Swap the maximum ${root} with ${last} at position ${end}: ${root} is final, and the heap shrinks to ${plural(end, 'item')}.`,
        state,
      });
      swapped = [];
      sift = 0;
      t.step({ lines: ['extract-call'], say: `Sift the new root ${label(0)} down through the heap of ${plural(end, 'item')}.`, state });
      siftDown(0, end);
    }
    phase = 'done';
    heapSize = 0;
    sift = null;
    settled = true;
    return t.finish({ lines: ['done'], say: `The heap is empty and the array is sorted, from ${label(0)} up to ${label(n - 1)}.`, state, result: a });
  },
});
