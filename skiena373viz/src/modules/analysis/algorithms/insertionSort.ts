/** Insertion sort, kept here because its counts have three different growth rates: best, worst and random. */
import { defineAlgorithm, defineOps, definePseudocode, experimentFor } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';

export interface InsertionInput {
  readonly items: readonly number[];
}

export interface InsertionState {
  /** A null slot is the hole left by the lifted key. */
  readonly items: readonly (number | null)[];
  /** The key lifted out and waiting to be placed. */
  readonly held: number | null;
  /** Positions 0..sortedLength-1 are sorted among themselves. */
  readonly sortedLength: number;
  readonly compare: number | null;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'insertion-sort(A[0..n-1])'],
  ['loop', 1, 'for i = 1 to n - 1:'],
  ['lift', 2, 'key = A[i];  j = i - 1'],
  ['compare', 2, 'while j >= 0 and A[j] > key:'],
  ['shift', 3, 'A[j+1] = A[j];  j = j - 1'],
  ['place', 2, 'A[j+1] = key'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Comparisons', counts: 'One each time A[j] is compared with the lifted key; the j >= 0 test is not counted.' },
  { id: 'writes', label: 'Writes', counts: 'One each time an array position is given a value: every shift and every placement.' },
]);

type T = Recorder<InsertionState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const insertionSort = defineAlgorithm({
  id: 'analysis-insertion-sort',
  title: 'Insertion sort',
  summary: 'Lift each key out in turn and slide the larger keys of the sorted prefix right until it fits.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'best case (already sorted)', bound: 'Θ(n)', why: 'each key is compared once with its left neighbour and stays, n - 1 comparisons.' },
    { resource: 'time', when: 'worst case (reversed)', bound: 'Θ(n²)', why: 'key i slides past all i keys before it, n(n - 1)/2 comparisons in all.' },
    { resource: 'time', when: 'on average over random orders', bound: 'Θ(n²)', why: 'a key slides past about half of the keys before it, about n²/4 comparisons.' },
    { resource: 'space', when: 'every case', bound: 'Θ(1)', why: 'one lifted key besides the array.' },
  ],
  presets: [
    { id: 'mixed', label: 'Mixed order', input: { items: [5, 2, 4, 6, 1, 3] } },
    { id: 'sorted', label: 'Already sorted (best case)', input: { items: [1, 2, 3, 4, 5, 6] } },
    { id: 'reversed', label: 'Reversed (worst case)', input: { items: [6, 5, 4, 3, 2, 1] } },
  ],
  execute({ items: given }: InsertionInput, t: T): Finished<number[]> {
    const finite = given.every((value) => Number.isFinite(value));
    const a: (number | null)[] = finite ? given.map((value) => value + 0) : [];
    const n = a.length;
    let held: number | null = null;
    let sortedLength = Math.min(n, 1);
    let compare: number | null = null;
    const state = (): InsertionState => ({ items: a, held, sortedLength, compare });
    const sorted = (): number[] => a.map((value) => value ?? 0);

    t.step({ lines: ['signature'], say: n < 2 ? `Insertion sort ${n} ${n === 1 ? 'item' : 'items'}: nothing to move.` : `Insertion sort ${n} items: grow a sorted prefix one key at a time.`, state });
    for (let i = 1; i < n; i += 1) {
      const key = a[i] ?? 0;
      held = key;
      a[i] = null;
      compare = null;
      t.step({ lines: ['lift'], say: `Lift ${key} out of position ${i}; the sorted prefix is positions 0 to ${i - 1}.`, state });
      let j = i - 1;
      for (;;) {
        if (j < 0) break;
        const left = a[j] ?? 0;
        t.count('comparisons');
        compare = j;
        if (left <= key) {
          t.step({ lines: ['compare'], say: `${left} at position ${j} is not larger than ${key}, so ${key} belongs just to its right.`, state });
          break;
        }
        t.step({ lines: ['compare'], say: `${left} at position ${j} is larger than ${key}, so it slides one place right.`, state });
        a[j + 1] = left;
        a[j] = null;
        t.count('writes');
        compare = null;
        t.step({ lines: ['shift'], say: `Write ${left} into position ${j + 1}; the hole moves to position ${j}.`, state });
        j -= 1;
      }
      a[j + 1] = key;
      held = null;
      compare = null;
      sortedLength = i + 1;
      t.count('writes');
      t.step({ lines: ['place'], say: `Write ${key} into position ${j + 1}; positions 0 to ${i} are now sorted.`, state });
    }
    return t.finish({ lines: ['loop'], say: n < 2 ? 'There is nothing to insert, so the array is already sorted.' : 'The loop has used every position, so the array is sorted.', state, result: sorted() });
  },
});

export const insertionSortExperiment = experimentFor(insertionSort, {
  id: 'analysis-insertion-sort-growth',
  title: 'Insertion sort',
  sizeMeaning: 'number of distinct keys',
  primaryOp: 'comparisons',
  sizes: [8, 16, 32, 64, 128, 256, 512],
  cases: [
    { id: 'sorted', label: 'Best case: already sorted', claim: { symbol: 'Θ', fn: 'n', when: 'best case' } },
    { id: 'reversed', label: 'Worst case: reversed', claim: { symbol: 'Θ', fn: 'n²', when: 'worst case' } },
    { id: 'random', label: 'Random order', claim: { symbol: 'Θ', fn: 'n²', when: 'on average over random orders' } },
  ],
  makeInput(n, caseId, rng): InsertionInput {
    const ascending = Array.from({ length: n }, (_, i) => i);
    if (caseId === 'sorted') return { items: ascending };
    if (caseId === 'reversed') return { items: ascending.reverse() };
    return { items: rng.shuffle(ascending) };
  },
});
