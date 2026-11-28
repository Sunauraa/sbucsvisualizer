/** Growth experiments for the three sorts. The analysis module finds these through useModules(). */
import { experimentFor } from '@core';
import type { GrowthCase, GrowthExperiment, Rng } from '@core';
import { heapsort } from './heapsort';
import { mergesort } from './mergesort';
import { quicksort } from './quicksort';
import type { PivotRule, SortInput } from './common';

const SIZES = [8, 16, 32, 64, 128, 256, 512];

/**
 * THE shared input: all three experiments call this with the same (n, case, rng), so on a given
 * seed and size the three sorts see exactly the same list. Keys are distinct.
 */
export function sortInputFor(n: number, caseId: string, rng: Rng): number[] {
  const ascending = Array.from({ length: n }, (_, i) => i);
  if (caseId === 'reversed') return ascending.reverse();
  if (caseId === 'random') return rng.shuffle(ascending);
  return ascending;
}

const COMMON_CASES: readonly (readonly [string, string])[] = [
  ['random', 'Random order'],
  ['sorted', 'Already sorted'],
  ['reversed', 'Reversed'],
];

const nlogn = (when: string): GrowthCase['claim'] => ({ symbol: 'Θ', fn: 'n log n', when });

export const heapsortExperiment = experimentFor(heapsort, {
  id: 'sorting-heapsort-growth',
  title: 'Heapsort',
  sizeMeaning: 'number of distinct keys',
  primaryOp: 'comparisons',
  sizes: SIZES,
  cases: COMMON_CASES.map(([id, label]): GrowthCase => ({ id, label, claim: nlogn('worst case, and for any order of distinct keys') })),
  makeInput: (n, caseId, rng): SortInput => ({ items: sortInputFor(n, caseId, rng) }),
});

export const mergesortExperiment = experimentFor(mergesort, {
  id: 'sorting-mergesort-growth',
  title: 'Mergesort',
  sizeMeaning: 'number of distinct keys',
  primaryOp: 'comparisons',
  sizes: SIZES,
  cases: COMMON_CASES.map(([id, label]): GrowthCase => ({ id, label, claim: nlogn('every case') })),
  makeInput: (n, caseId, rng): SortInput => ({ items: sortInputFor(n, caseId, rng) }),
});

const QUICK_RULE: Readonly<Record<string, PivotRule>> = { 'sorted-random-pivot': 'random', 'sorted-median': 'median-of-three' };

export const quicksortExperiment = experimentFor(quicksort, {
  id: 'sorting-quicksort-growth',
  title: 'Quicksort (last-item pivot unless stated)',
  sizeMeaning: 'number of distinct keys',
  primaryOp: 'comparisons',
  sizes: SIZES,
  cases: [
    { id: 'random', label: 'Random order', claim: nlogn('on average over random orders') },
    { id: 'sorted', label: 'Already sorted', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case: the last item is always the largest, so one side is always empty' } },
    { id: 'reversed', label: 'Reversed', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case: every pivot is the smallest or largest key of its range, so one side is always empty' } },
    { id: 'sorted-random-pivot', label: 'Already sorted, random pivot', claim: nlogn('expected, random pivot') },
    { id: 'sorted-median', label: 'Already sorted, median of three', claim: nlogn('for this sorted input (other inputs can still defeat median of three)') },
  ],
  makeInput: (n, caseId, rng): SortInput => {
    const pivot = QUICK_RULE[caseId];
    // The sort's own random pivots come from the same generator, after the input has been drawn.
    return { items: sortInputFor(n, caseId.startsWith('sorted') ? 'sorted' : caseId, rng), ...(pivot ? { pivot, seed: rng.int(0, 1_000_000) } : {}) };
  },
});

export const experiments: readonly GrowthExperiment[] = [heapsortExperiment, mergesortExperiment, quicksortExperiment];
