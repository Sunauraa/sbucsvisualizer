/**
 * THE WORKED EXAMPLE. Copy this file's shape for every algorithm:
 *   1. Input and State types, plain JSON
 *   2. PSEUDOCODE with named anchors
 *   3. OPS, each saying exactly what it counts
 *   4. defineAlgorithm({ ..., execute })
 *   5. optionally, a growth experiment
 */
import { defineAlgorithm, defineOps, definePseudocode, experimentFor } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';

export interface LinearSearchInput {
  readonly items: readonly number[];
  readonly target: number;
}

/** Everything the renderer needs. Highlights are data: the renderer never re-derives them. */
export interface LinearSearchState {
  readonly items: readonly number[];
  readonly target: number;
  /** The position being looked at, or null before the loop and after a failed search. */
  readonly cursor: number | null;
  /** How many leading items are already ruled out. */
  readonly ruledOut: number;
  readonly foundAt: number | null;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'linear-search(A[0..n-1], target)'],
  ['loop', 1, 'for i = 0, 1, ..., n-1'],
  ['compare', 2, 'if A[i] = target'],
  ['found', 3, 'return i'],
  ['not-found', 1, 'return "absent"'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Comparisons', counts: 'One each time A[i] is compared with the target; loop bookkeeping is not counted.' },
]);

type T = Recorder<LinearSearchState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const linearSearch = defineAlgorithm({
  id: 'example-linear-search',
  title: 'Linear search',
  summary: 'Look at each item in turn until the target appears or the items run out.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'best case', bound: 'Θ(1)', why: 'the target is the first item, so one comparison is enough.' },
    { resource: 'time', when: 'worst case', bound: 'Θ(n)', why: 'a missing target forces a comparison with all n items.' },
    { resource: 'space', when: 'every case', bound: 'Θ(1)', why: 'only the index i is kept besides the input.' },
  ],
  presets: [
    { id: 'middle', label: 'Target in the middle', input: { items: [7, 3, 9, 4, 1, 8], target: 4 } },
    { id: 'missing', label: 'Target missing (worst case)', input: { items: [7, 3, 9, 4, 1, 8], target: 5 } },
    { id: 'duplicates', label: 'Duplicates: first match wins', input: { items: [5, 2, 2, 2], target: 2 } },
    { id: 'empty', label: 'Empty array', input: { items: [], target: 3 } },
  ],
  // Annotate the return type: it fixes the result type R for every path.
  execute({ items, target }: LinearSearchInput, t: T): Finished<number | null> {
    let cursor: number | null = null;
    let ruledOut = 0;
    let foundAt: number | null = null;
    // One function builds the whole state. The recorder copies and freezes what it returns.
    const state = (): LinearSearchState => ({ items, target, cursor, ruledOut, foundAt });

    // Frame 0: setup, no work counted yet.
    t.step({ lines: ['signature'], say: `Search ${items.length} items for ${target}, starting from the left.`, state });

    for (let i = 0; i < items.length; i += 1) {
      cursor = i;
      // Count first, then record the step that shows the work.
      t.count('comparisons');
      t.event('compare', [`A[${i}]`, 'target'], `${items[i]} = ${target}?`);
      if (items[i] === target) {
        t.step({ lines: ['compare'], say: `A[${i}] is ${items[i]}, which equals the target ${target}.`, state });
        foundAt = i;
        t.event('return', [`A[${i}]`]);
        return t.finish({ lines: ['found'], say: `The search stops and returns index ${i}.`, state, result: i });
      }
      // A failed condition lights only the condition line.
      ruledOut = i + 1;
      t.step({ lines: ['compare'], say: () => `A[${i}] is ${items[i]}, not ${target}, so position ${i} is ruled out.`, state });
    }

    cursor = null;
    t.event('return', []);
    return t.finish({
      lines: ['not-found'],
      say: `All ${items.length} positions are ruled out, so ${target} is absent.`,
      state,
      result: null,
    });
  },
});

export const experiments = [
  experimentFor(linearSearch, {
    id: 'example-linear-search-growth',
    title: 'Linear search',
    sizeMeaning: 'number of items',
    primaryOp: 'comparisons',
    sizes: [8, 16, 32, 64, 128, 256, 512],
    cases: [
      { id: 'missing', label: 'Target missing', claim: { symbol: 'Θ', fn: 'n', when: 'worst case' } },
      { id: 'random', label: 'Target at a random position', claim: { symbol: 'Θ', fn: 'n', when: 'on average' } },
      { id: 'first', label: 'Target first', claim: { symbol: 'Θ', fn: '1', when: 'best case' } },
    ],
    makeInput(n, caseId, rng) {
      const items = rng.shuffle(Array.from({ length: n }, (_, i) => i));
      const at = caseId === 'first' ? 0 : rng.int(0, n - 1);
      return { items, target: caseId === 'missing' ? -1 : (items[at] ?? -1) };
    },
  }),
];
