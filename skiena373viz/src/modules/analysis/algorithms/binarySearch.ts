/** Binary search with its own sortedness check, and the halving count that explains log n. */
import { defineAlgorithm, defineOps, definePseudocode, experimentFor } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';

export interface BinarySearchInput {
  readonly items: readonly number[];
  readonly target: number;
}

export interface BinarySearchState {
  readonly items: readonly number[];
  readonly target: number;
  /** The candidate range is lo..hi, inclusive. It is empty when lo > hi. */
  readonly lo: number;
  readonly hi: number;
  /** The position just compared, or null. */
  readonly mid: number | null;
  /** Number of candidates left after this step. */
  readonly remaining: number;
  readonly foundAt: number | null;
  /** Positions of the first out-of-order pair, when the check refused the input. */
  readonly offending: readonly number[];
  readonly phase: 'setup' | 'check' | 'search' | 'done';
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'binary-search(A[0..n-1], target)    A must be sorted'],
  ['check', 1, 'for each i: require A[i] <= A[i+1], else refuse'],
  ['init', 1, 'lo = 0;  hi = n - 1'],
  ['loop', 1, 'while lo <= hi:'],
  ['mid', 2, 'mid = ⌊(lo + hi) / 2⌋'],
  ['equal', 2, 'if A[mid] = target: return mid'],
  ['less', 2, 'else if target < A[mid]:  hi = mid - 1'],
  ['greater', 2, 'else:  lo = mid + 1'],
  ['absent', 1, 'return "absent"'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Comparisons', counts: 'One three-way comparison of A[mid] with the target (equal, smaller or larger counts once).' },
  { id: 'order-checks', label: 'Order checks', counts: 'One each time two neighbours A[i], A[i+1] are checked for order; the precondition check, not the search.' },
]);

type T = Recorder<BinarySearchState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const binarySearch = defineAlgorithm({
  id: 'analysis-binary-search',
  title: 'Binary search',
  summary: 'Compare the target with the middle of a sorted array and throw away the half that cannot contain it.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'best case', bound: 'Θ(1)', why: 'the target is the first middle item, so one comparison is enough.' },
    { resource: 'time', when: 'worst case', bound: 'Θ(log n)', why: 'each comparison halves the candidates, so at most ⌊lg n⌋ + 1 comparisons are needed.' },
    { resource: 'space', when: 'every case', bound: 'Θ(1)', why: 'only lo, hi and mid are kept.' },
  ],
  presets: [
    { id: 'found', label: 'Target present', input: { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 23 } },
    { id: 'first-try', label: 'Best case: target is the first middle item', input: { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 16 } },
    { id: 'missing-above', label: 'Worst case: target above everything', input: { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 100 } },
    { id: 'missing-between', label: 'Missing, between two items', input: { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 20 } },
    { id: 'missing-below', label: 'Missing, below everything', input: { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 1 } },
    { id: 'duplicates', label: 'Duplicates: any matching index', input: { items: [1, 3, 3, 3, 3, 3, 3, 9], target: 3 } },
    { id: 'single', label: 'One item', input: { items: [7], target: 7 } },
    { id: 'empty', label: 'Empty array', input: { items: [], target: 4 } },
    { id: 'unsorted', label: 'Unsorted input is refused', input: { items: [4, 9, 7, 12, 15], target: 12 } },
  ],
  execute({ items: given, target: wanted }: BinarySearchInput, t: T): Finished<number | null> {
    const finite = given.every((value) => Number.isFinite(value)) && Number.isFinite(wanted);
    const items = finite ? given.map((value) => value + 0) : [];
    const target = finite ? wanted + 0 : 0;
    const n = items.length;
    let lo = 0;
    let hi = n - 1;
    let mid: number | null = null;
    let foundAt: number | null = null;
    let offending: number[] = [];
    let phase: BinarySearchState['phase'] = 'setup';
    const state = (): BinarySearchState => ({
      items, target, lo, hi, mid, remaining: Math.max(0, hi - lo + 1), foundAt, offending, phase,
    });

    t.step({
      lines: ['signature'],
      say: finite ? `Search ${n} sorted ${n === 1 ? 'item' : 'items'} for ${target}.` : 'Something typed is not a finite number, so nothing can be searched yet.',
      state,
    });
    if (!finite) {
      return t.reject({ lines: ['check'], say: 'A key or the target is not a finite number, so the input is refused.', state, result: null });
    }

    // The precondition check: sorted means every neighbouring pair is in order. Stop at the first violation.
    phase = 'check';
    for (let i = 0; i + 1 < n; i += 1) {
      t.count('order-checks');
      if ((items[i] ?? 0) > (items[i + 1] ?? 0)) {
        offending = [i, i + 1];
        return t.reject({
          lines: ['check'],
          say: `${items[i]} at position ${i} is larger than ${items[i + 1]} at position ${i + 1}, so the array is not sorted and binary search is refused.`,
          state,
          result: null,
        });
      }
    }
    t.step({
      lines: ['check'],
      say: n < 2 ? 'With fewer than two items there is no pair to check, so the array counts as sorted.' : `All ${n - 1} neighbouring pairs are in order, so the array is sorted.`,
      state,
    });

    phase = 'search';
    t.step({ lines: ['init'], say: `The candidates are positions 0 to ${n - 1}, which is ${n} ${n === 1 ? 'item' : 'items'}.`, state });

    while (lo <= hi) {
      const m = Math.floor((lo + hi) / 2);
      const value = items[m] ?? 0;
      const before = hi - lo + 1;
      mid = m;
      t.count('comparisons');
      t.event('compare', [`A[${m}]`, 'target'], `${value} vs ${target}`);
      if (value === target) {
        foundAt = m;
        phase = 'done';
        const twin = items[m - 1] === target || items[m + 1] === target;
        return t.finish({
          lines: ['mid', 'equal'],
          say: `A[${m}] is ${value}, which equals ${target}, so the search returns ${m}${twin ? ' (equal keys sit beside it, and any matching position is a correct answer)' : ''}.`,
          state,
          result: m,
        });
      }
      if (target < value) {
        hi = m - 1;
        t.step({
          lines: ['mid', 'equal', 'less'],
          say: `A[${m}] is ${value}, which is larger than ${target}, so only positions ${lo} to ${m - 1} can hold it: ${before} candidates become ${Math.max(0, hi - lo + 1)}.`,
          state,
        });
      } else {
        lo = m + 1;
        t.step({
          lines: ['mid', 'equal', 'less', 'greater'],
          say: `A[${m}] is ${value}, which is smaller than ${target}, so only positions ${m + 1} to ${hi} can hold it: ${before} candidates become ${Math.max(0, hi - lo + 1)}.`,
          state,
        });
      }
    }
    mid = null;
    phase = 'done';
    return t.finish({
      lines: ['loop', 'absent'],
      say: `No candidates are left (lo ${lo} is past hi ${hi}), so ${target} is absent.`,
      state,
      result: null,
    });
  },
});

/** How many times n can be halved (rounding down) before it reaches 1: n, ⌊n/2⌋, ..., 1. Empty for n < 1. */
export function halvingChain(n: number): number[] {
  const chain: number[] = [];
  for (let size = Math.floor(n); size >= 1; size = Math.floor(size / 2)) chain.push(size);
  return chain;
}

/** The most comparisons binary search ever makes on n items: ⌊lg n⌋ + 1 (0 for an empty array). */
export const worstComparisons = (n: number): number => halvingChain(n).length;

export const binarySearchExperiment = experimentFor(binarySearch, {
  id: 'analysis-binary-search-growth',
  title: 'Binary search',
  sizeMeaning: 'number of sorted items',
  primaryOp: 'comparisons',
  sizes: [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384],
  cases: [
    { id: 'best', label: 'Best case: target is the first middle item', claim: { symbol: 'Θ', fn: '1', when: 'best case' } },
    { id: 'worst', label: 'Worst case: target above everything', claim: { symbol: 'Θ', fn: 'log n', when: 'worst case' } },
    { id: 'random', label: 'Target at a random position', claim: { symbol: 'Θ', fn: 'log n', when: 'on average over present targets' } },
  ],
  makeInput(n, caseId, rng): BinarySearchInput {
    const items = Array.from({ length: n }, (_, i) => 2 * i);
    if (caseId === 'best') return { items, target: items[Math.floor((n - 1) / 2)] ?? 0 };
    if (caseId === 'worst') return { items, target: 2 * n };
    return { items, target: items[rng.int(0, n - 1)] ?? 0 };
  },
});
