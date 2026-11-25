/** Growth experiments for this module. Plotted by the GrowthPanels here and by the analysis module. */
import { experimentFor } from '@core';
import { bst } from './bst';
import type { BstOperation } from './bst';
import { hashChaining } from './hashChaining';
import type { HashOperation } from './hashing';
import { hashProbing } from './hashProbing';
import { heap } from './heap';

const SIZES = [8, 16, 32, 64, 128, 256];

const inserts = (keys: readonly number[]): BstOperation[] => keys.map((key) => ({ kind: 'insert', key }));
const hashInserts = (keys: readonly number[]): HashOperation[] => keys.map((key) => ({ kind: 'insert', key }));

export const bstExperiment = experimentFor(bst, {
  id: 'structures-bst-growth',
  title: 'Binary search tree: n inserts',
  sizeMeaning: 'number of keys inserted into an empty tree',
  primaryOp: 'comparisons',
  sizes: SIZES,
  cases: [
    { id: 'random', label: 'Random insertion order', claim: { symbol: 'Θ', fn: 'n log n', when: 'expected, random order' } },
    { id: 'sorted', label: 'Sorted insertion order', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case' } },
  ],
  makeInput(n, caseId, rng) {
    const keys = Array.from({ length: n }, (_, i) => i);
    return { start: [], operations: inserts(caseId === 'sorted' ? keys : rng.shuffle(keys)) };
  },
});

export const heapExperiment = experimentFor(heap, {
  id: 'structures-heap-build-growth',
  title: 'Heap: build by sift-down against repeated insertion',
  sizeMeaning: 'number of keys in the array',
  primaryOp: 'comparisons',
  sizes: [8, 16, 32, 64, 128, 256, 512],
  cases: [
    { id: 'build-reversed', label: 'Sift-down build, keys in decreasing order (worst case for a min-heap)', claim: { symbol: 'Θ', fn: 'n', when: 'worst case' } },
    { id: 'insert-reversed', label: 'Repeated insertion, keys in decreasing order (worst case)', claim: { symbol: 'Θ', fn: 'n log n', when: 'worst case' } },
    { id: 'insert-random', label: 'Repeated insertion, random order', claim: { symbol: 'Θ', fn: 'n', when: 'on average, random order' } },
  ],
  makeInput(n, caseId, rng) {
    const decreasing = Array.from({ length: n }, (_, i) => n - i);
    const start = caseId === 'insert-random' ? rng.shuffle(decreasing) : decreasing;
    const kind = caseId === 'build-reversed' ? ('build' as const) : ('rebuild' as const);
    return { start, operations: [{ kind, key: null }] };
  },
});

/** n inserts into a table of 2n slots (load factor 1/2 at the end), against keys that all share one home. */
function hashKeys(n: number, caseId: string, rng: { shuffle<T>(items: readonly T[]): T[] }): number[] {
  if (caseId === 'same-home') return Array.from({ length: n }, (_, i) => i * 2 * n);
  return rng.shuffle(Array.from({ length: 6 * n }, (_, i) => i)).slice(0, n);
}

export const chainingExperiment = experimentFor(hashChaining, {
  id: 'structures-hash-chaining-growth',
  title: 'Chaining: total comparisons for n inserts at load factor ½',
  sizeMeaning: 'number of keys inserted into a table with 2n buckets',
  primaryOp: 'comparisons',
  sizes: SIZES,
  cases: [
    { id: 'random', label: 'Random keys', claim: { symbol: 'Θ', fn: 'n', when: 'expected, simple uniform hashing' } },
    { id: 'same-home', label: 'All keys in one bucket', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case' } },
  ],
  makeInput: (n, caseId, rng) => ({ size: 2 * n, start: [], operations: hashInserts(hashKeys(n, caseId, rng)) }),
});

export const probingExperiment = experimentFor(hashProbing, {
  id: 'structures-hash-probing-growth',
  title: 'Linear probing: total probes for n inserts at load factor ½',
  sizeMeaning: 'number of keys inserted into a table with 2n slots',
  primaryOp: 'probes',
  sizes: SIZES,
  cases: [
    { id: 'random', label: 'Random keys', claim: { symbol: 'Θ', fn: 'n', when: 'expected, uniform hashing' } },
    { id: 'same-home', label: 'All keys share one home slot', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case' } },
  ],
  makeInput: (n, caseId, rng) => ({ size: 2 * n, start: [], operations: hashInserts(hashKeys(n, caseId, rng)) }),
});

export const experiments = [bstExperiment, heapExperiment, chainingExperiment, probingExperiment];
