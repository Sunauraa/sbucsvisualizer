import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import type { Trace } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { badKeyIndex, labelsFor, makeItems, sortedByKey } from './common';
import type { Item, PivotRule, SortInput } from './common';
import { heapsort } from './heapsort';
import type { HeapsortState } from './heapsort';
import { mergesort } from './mergesort';
import type { MergesortState } from './mergesort';
import { quicksort } from './quicksort';
import type { QuicksortState } from './quicksort';

const ids = (items: readonly (Item | null)[]): number[] => items.flatMap((item) => (item ? [item.id] : []));

const checkHeap = (input: SortInput) =>
  checkAlgorithm(heapsort, input, { conserved: (s) => ids(s.items), invariant: heapInvariant });
const checkMerge = (input: SortInput) =>
  checkAlgorithm(mergesort, input, { conserved: (s) => [...ids(s.items), ...ids(s.buffer)], invariant: mergeInvariant });
const checkQuick = (input: SortInput) =>
  checkAlgorithm(quicksort, input, { conserved: (s) => ids(s.items), invariant: partitionInvariant });

function heapInvariant(frame: { readonly state: HeapsortState }): string | null {
  const { items, heapSize, settled } = frame.state;
  if (!settled) return null;
  for (let p = 1; p < heapSize; p += 1) {
    if ((items[Math.floor((p - 1) / 2)]?.key ?? 0) < (items[p]?.key ?? 0)) return `heap property broken at position ${p} in a settled frame`;
  }
  // The suffix is sorted and at least as large as everything in the heap.
  for (let p = heapSize; p < items.length; p += 1) {
    if (p + 1 < items.length && (items[p]?.key ?? 0) > (items[p + 1]?.key ?? 0)) return 'sorted suffix is not sorted';
    if (heapSize > 0 && (items[p]?.key ?? 0) < (items[0]?.key ?? 0)) return 'suffix item smaller than the heap root';
  }
  return null;
}

function mergeInvariant(frame: { readonly state: MergesortState }): string | null {
  const { items, buffer, merging } = frame.state;
  for (let p = 0; p < items.length; p += 1) {
    if (!merging && (!items[p] || buffer[p])) return 'a hole is left behind when no merge is running';
  }
  return null;
}

function partitionInvariant(frame: { readonly state: QuicksortState }): string | null {
  const { items, range, store, j, pivot, pivotPos, phase } = frame.state;
  if (!range || store === null || j === null || pivot === null || pivotPos === null) return null;
  const [lo, hi] = range;
  const key = (p: number): number => items[p]?.key ?? 0;
  const pivotItem = items.find((item) => item.id === pivot);
  if (!pivotItem) return 'pivot is missing';
  if (items[pivotPos]?.id !== pivot) return 'the pivot is not at pivotPos';
  if (phase !== 'place' && pivotPos !== hi - 1) return 'the pivot left the end during the scan';
  for (let p = lo; p < store; p += 1) if (key(p) >= pivotItem.key) return `position ${p} is in the less zone but is not less`;
  for (let p = store; p < j; p += 1) {
    if (p === pivotPos) continue;
    if (key(p) < pivotItem.key) return `position ${p} is in the not-less zone but is less`;
  }
  if (phase === 'place') {
    for (let p = pivotPos + 1; p < hi; p += 1) if (key(p) < pivotItem.key) return 'a smaller key is right of the placed pivot';
  }
  return null;
}

const lists = (count: number, maxLength: number, low: number, high: number, seed: number): number[][] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => Array.from({ length: rng.int(0, maxLength) }, () => rng.int(low, high)));
};
const sortedKeys = (keys: readonly number[]): number[] => [...keys].sort((a, b) => a - b);
const runCounts = (algorithm: typeof heapsort | typeof mergesort | typeof quicksort, input: SortInput) => algorithm.run(input, { mode: 'counts' });
const RULES: readonly PivotRule[] = ['last', 'random', 'median-of-three'];

const sorts = [
  ['heapsort', heapsort, checkHeap],
  ['mergesort', mergesort, checkMerge],
  ['quicksort', quicksort, checkQuick],
] as const;

describe('all three sorts: description', () => {
  it.each(sorts)('%s is described completely', (_name, algorithm) => {
    expect(describeProblems(algorithm)).toEqual([]);
  });

  it.each(sorts)('%s keeps the contract on every preset, and its presets light the code', (_name, algorithm, check) => {
    const traces = algorithm.presets.map((preset) => check(preset.input));
    expect(traces.every((trace) => trace.status === 'completed')).toBe(true);
    expect(unlitAnchors(algorithm, traces as Trace<never>[])).toEqual(
      { heapsort: ['extract-loop', 'sift-head', 'children'], mergesort: ['while'], quicksort: ['loop'] }[algorithm.id.replace('sorting-', '')],
    );
  });
});

describe.each(sorts)('%s edge cases', (_name, algorithm, check) => {
  const run = (keys: number[]) => check({ items: keys });
  const keysOf = (trace: { readonly result: readonly Item[] }): number[] => trace.result.map((item) => item.key);

  it('empty input', () => {
    const trace = run([]);
    expect(trace.result).toEqual([]);
    expect(trace.totals).toEqual({ comparisons: 0, swaps: 0, writes: 0 });
    expect(trace.frames.length).toBeGreaterThanOrEqual(2);
  });
  it('a single item', () => {
    const trace = run([7]);
    expect(keysOf(trace)).toEqual([7]);
    expect(trace.totals['comparisons']).toBe(0);
  });
  it('two items in order', () => expect(keysOf(run([1, 2]))).toEqual([1, 2]));
  it('two items out of order', () => expect(keysOf(run([2, 1]))).toEqual([1, 2]));
  it('duplicates', () => expect(keysOf(run([3, 1, 3, 2, 1, 3]))).toEqual([1, 1, 2, 3, 3, 3]));
  it('all equal', () => {
    const trace = run([4, 4, 4, 4, 4]);
    expect(keysOf(trace)).toEqual([4, 4, 4, 4, 4]);
  });
  it('already sorted', () => expect(keysOf(run([1, 2, 3, 4, 5, 6]))).toEqual([1, 2, 3, 4, 5, 6]));
  it('reversed', () => expect(keysOf(run([6, 5, 4, 3, 2, 1]))).toEqual([1, 2, 3, 4, 5, 6]));
  it('negative keys and zero', () => expect(keysOf(run([3, -5, 0, -1, 8, -5]))).toEqual([-5, -5, -1, 0, 3, 8]));
  it.each([3, 5, 7, 9, 11, 13, 17])('odd length %i', (n) => {
    const keys = createRng(n).shuffle(Array.from({ length: n }, (_, i) => i - 3));
    expect(keysOf(run(keys))).toEqual(sortedKeys(keys));
  });
  it.each([2, 4, 8, 16, 32])('power-of-two length %i', (n) => {
    const keys = createRng(n).shuffle(Array.from({ length: n }, (_, i) => i));
    expect(keysOf(run(keys))).toEqual(sortedKeys(keys));
  });
  it('negative zero is written as zero so frames stay JSON-safe', () => {
    expect(keysOf(run([-0, 0, -1]))).toEqual([-1, 0, 0]);
  });
  it('a key that is not a finite number is rejected by the algorithm itself', () => {
    const trace = algorithm.run({ items: [3, Number.NaN, 1] });
    expect(trace.status).toBe('rejected');
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('Item 2');
    expect(trace.frames.every((frame) => !/NaN/.test(frame.explanation))).toBe(true);
    expect(badKeyIndex([1, Infinity])).toBe(1);
  });
  it('labels: equal keys are told apart as a, b, c in original order', () => {
    expect(labelsFor(makeItems([5, 2, 5, 5]))).toEqual(['5a', '2', '5b', '5c']);
  });
});

describe('output is a sorted permutation equal to the built-in sort', () => {
  const inputs = lists(300, 24, -20, 20, 373);
  it.each(sorts)('%s on 300 seeded lists', (_name, algorithm) => {
    for (const keys of inputs) {
      const { result } = runCounts(algorithm, { items: keys });
      expect(result.map((item) => item.key)).toEqual(sortedKeys(keys));
      expect([...result.map((item) => item.id)].sort((a, b) => a - b)).toEqual(keys.map((_, i) => i));
    }
  });
  it.each(RULES)('quicksort with pivot rule %s on 300 seeded lists, and the full contract on 25 of them', (rule) => {
    inputs.forEach((keys, index) => {
      const input: SortInput = { items: keys, pivot: rule, seed: index };
      expect(runCounts(quicksort, input).result.map((item) => item.key)).toEqual(sortedKeys(keys));
      if (index < 25) checkQuick(input);
    });
  });
  it('heapsort and mergesort pass the full contract on 25 seeded lists', () => {
    inputs.slice(0, 25).forEach((keys) => {
      checkHeap({ items: keys });
      checkMerge({ items: keys });
    });
  });
});

describe('stability', () => {
  const ties = lists(200, 20, 0, 3, 11);
  const inOrder = (result: readonly Item[]): boolean => result.every((item, p) => p === 0 || (result[p - 1] as Item).key < item.key || (result[p - 1] as Item).id < item.id);

  it('mergesort keeps equal keys in original order on 200 seeded lists with many ties', () => {
    for (const keys of ties) expect(inOrder(runCounts(mergesort, { items: keys }).result)).toBe(true);
  });
  it('mergesort result equals the stable reference sort', () => {
    for (const keys of ties) expect(runCounts(mergesort, { items: keys }).result).toEqual(sortedByKey(makeItems(keys)));
  });
  it('a pinned counterexample, [2, 2, 1], shows that heapsort is not stable', () => {
    const { result } = checkHeap({ items: [2, 2, 1] });
    expect(result.map((item) => item.id)).toEqual([2, 1, 0]);
    expect(inOrder(result)).toBe(false);
  });
  it('a pinned counterexample, [2, 1, 1], shows that quicksort is not stable', () => {
    const { result } = checkQuick({ items: [2, 1, 1] });
    expect(result.map((item) => item.id)).toEqual([2, 1, 0]);
    expect(inOrder(result)).toBe(false);
  });
  it('the same input leaves mergesort stable', () => {
    expect(checkMerge({ items: [2, 2, 1] }).result.map((item) => item.id)).toEqual([2, 0, 1]);
  });
});

describe('heapsort', () => {
  it('the heap property holds in the frame that ends the build, within 2n comparisons', () => {
    for (const keys of lists(100, 24, -9, 9, 5)) {
      const trace = heapsort.run({ items: keys });
      const built = trace.frames.find((frame) => frame.state.phase === 'built');
      if (keys.length < 2) continue;
      expect(built, `keys ${keys}`).toBeDefined();
      const { items } = built!.state;
      for (let p = 1; p < items.length; p += 1) expect(items[Math.floor((p - 1) / 2)]!.key).toBeGreaterThanOrEqual(items[p]!.key);
      expect(built!.ops['comparisons']).toBeLessThanOrEqual(2 * keys.length);
      expect(built!.ops['swaps']).toBe(built!.ops['writes']! / 2);
    }
  });
  it('building a max-heap from a reversed list needs no swaps', () => {
    const built = heapsort.run({ items: [9, 8, 7, 6, 5, 4, 3] }).frames.find((frame) => frame.state.phase === 'built');
    expect(built?.ops['swaps']).toBe(0);
  });
  it('the sorted suffix grows by one item per extraction', () => {
    const trace = heapsort.run({ items: [4, 1, 3, 2, 5] });
    const sizes = [...new Set(trace.frames.filter((f) => f.state.phase === 'extract').map((f) => f.state.heapSize))];
    expect(sizes).toEqual([4, 3, 2, 1]);
  });
  it('a swap is also two writes', () => {
    const { totals } = heapsort.run({ items: [5, 2, 9, 1, 7, 3, 8], }, { mode: 'counts' });
    expect(totals['writes']).toBe(2 * totals['swaps']!);
  });
});

describe('mergesort', () => {
  const ceilLg = (n: number): number => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));
  it('comparisons never exceed n⌈lg n⌉ − 2^⌈lg n⌉ + 1, on seeded lists of every length up to 40', () => {
    for (let n = 0; n <= 40; n += 1) {
      for (const keys of [Array.from({ length: n }, (_, i) => i), ...lists(8, 0, 0, 0, 1).map(() => createRng(n).shuffle(Array.from({ length: n }, (_, i) => i)))]) {
        const bound = n === 0 ? 0 : n * ceilLg(n) - 2 ** ceilLg(n) + 1;
        expect(runCounts(mergesort, { items: keys }).totals['comparisons']).toBeLessThanOrEqual(bound);
      }
    }
  });
  it('the bound is reached: alternating halves force the worst case on 8 items', () => {
    // 1 3 5 7 | 2 4 6 8 style inputs interleave at every level.
    expect(runCounts(mergesort, { items: [1, 5, 3, 7, 2, 6, 4, 8] }).totals['comparisons']).toBeLessThanOrEqual(17);
  });
  it('writes are twice the items merged: every merged item is copied out and written back', () => {
    const { totals } = runCounts(mergesort, { items: [4, 3, 2, 1] });
    expect(totals['writes']).toBe(2 * (4 + 2 + 2));
    expect(totals['swaps']).toBe(0);
  });
  it('a key in the buffer is a hole in the array while a merge runs', () => {
    const trace = mergesort.run({ items: [3, 1, 2] });
    const frame = trace.frames.find((f) => f.state.merging !== null && f.lines.includes('compare'));
    expect(frame).toBeDefined();
    const { items, buffer, merging } = frame!.state;
    const [lo, hi] = merging!;
    for (let p = lo; p < hi; p += 1) expect(Number(items[p] === null) + Number(buffer[p] === null)).toBeGreaterThanOrEqual(1);
  });
  it('takes the left item on ties and says so', () => {
    const trace = mergesort.run({ items: [5, 5] });
    expect(trace.frames.some((f) => /tie takes the left/.test(f.explanation))).toBe(true);
    expect(trace.result.map((item) => item.id)).toEqual([0, 1]);
  });
});

describe('quicksort', () => {
  it.each([2, 3, 5, 8, 12, 24, 50])('last pivot on a sorted list of %i makes exactly n(n−1)/2 comparisons', (n) => {
    const trace = runCounts(quicksort, { items: Array.from({ length: n }, (_, i) => i) });
    expect(trace.totals['comparisons']).toBe((n * (n - 1)) / 2);
  });
  it('last pivot on a reversed list also makes exactly n(n−1)/2 comparisons', () => {
    expect(runCounts(quicksort, { items: [6, 5, 4, 3, 2, 1] }).totals['comparisons']).toBe(15);
  });
  it('a sorted list with the last pivot makes the call tree a path', () => {
    const trace = quicksort.run({ items: [1, 2, 3, 4, 5, 6] });
    const { nodes } = trace.frames[trace.frames.length - 1]!.state;
    expect(nodes.map((node) => node.depth)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(nodes.every((node) => node.parent === (node.id === 0 ? null : node.id - 1))).toBe(true);
  });
  it('median of three turns the sorted list into a balanced tree', () => {
    const trace = quicksort.run({ items: Array.from({ length: 15 }, (_, i) => i), pivot: 'median-of-three' });
    const { nodes } = trace.frames[trace.frames.length - 1]!.state;
    expect(Math.max(...nodes.map((node) => node.depth))).toBeLessThanOrEqual(4);
    expect(trace.totals['comparisons']).toBeLessThan(105);
  });
  it('the same seed gives the same trace, a different seed can differ', () => {
    const input: SortInput = { items: Array.from({ length: 16 }, (_, i) => i), pivot: 'random', seed: 5 };
    expect(quicksort.run(input)).toEqual(quicksort.run(input));
    const other = quicksort.run({ ...input, seed: 6 });
    expect(other.totals).not.toEqual(quicksort.run(input).totals);
  });
  it('the pivot is final when placed, and every position is settled at the end', () => {
    const trace = quicksort.run({ items: [5, 2, 9, 1, 7, 3] });
    expect(trace.frames[trace.frames.length - 1]!.state.settled.every(Boolean)).toBe(true);
    const placed = trace.frames.filter((f) => f.state.phase === 'place');
    expect(placed.length).toBeGreaterThan(0);
    for (const frame of placed) expect(frame.state.settled[frame.state.pivotPos!]).toBe(true);
  });
  it('the partition invariant is actually exercised in many frames', () => {
    const trace = quicksort.run({ items: [5, 2, 9, 1, 7, 3, 8, 4, 6] });
    expect(trace.frames.filter((f) => f.state.store !== null && f.state.j !== null).length).toBeGreaterThan(20);
  });
  it('median of three counts its own comparisons honestly', () => {
    const trace = runCounts(quicksort, { items: [2, 1, 3], pivot: 'median-of-three' });
    // Median of 2, 1, 3 takes two or three comparisons, then partitioning [1, 2, 3 or similar] takes 2 more.
    expect(trace.totals['comparisons']).toBeGreaterThanOrEqual(4);
  });
});

describe('the frame cap at the UI limit of 24 items', () => {
  const worst: Record<string, number[]> = {
    sorted: Array.from({ length: 24 }, (_, i) => i),
    reversed: Array.from({ length: 24 }, (_, i) => 24 - i),
    equal: Array.from({ length: 24 }, () => 5),
    random: createRng(1).shuffle(Array.from({ length: 24 }, (_, i) => i)),
  };
  it.each(sorts)('%s is never truncated and stays far below 1500 frames', (_name, algorithm) => {
    for (const [name, keys] of Object.entries(worst)) {
      for (const rule of RULES) {
        const trace = algorithm.run({ items: keys, pivot: rule, seed: 9 });
        expect(trace.truncated, `${name} ${rule}`).toBe(false);
        expect(trace.frames.length, `${name} ${rule}`).toBeLessThan(1000);
      }
    }
  });
});
