/** Quicksort with Lomuto partitioning (pivot parked at the end) and a selectable pivot rule. */
import { createRng, defineAlgorithm, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { badKeyIndex, labelsFor, makeItems, plural, SORT_OPS } from './common';
import type { CallNode, Item, Mutable, PivotRule, SortInput, SortResult } from './common';

export interface QuicksortState {
  readonly items: readonly Item[];
  readonly labels: readonly string[];
  /** The partition in progress works on positions [lo, hi). Null between calls. */
  readonly range: readonly [number, number] | null;
  /**
   * Lomuto zones inside the range. Positions lo..store-1 hold keys less than the pivot, store..j-1 hold keys
   * not less than it, j..hi-2 are unseen, and the pivot is parked at hi-1 until it is placed.
   */
  readonly store: number | null;
  readonly j: number | null;
  readonly pivotPos: number | null;
  /** Item id of the pivot. */
  readonly pivot: number | null;
  readonly phase: 'setup' | 'choose' | 'scan' | 'place' | 'return' | 'done';
  readonly compare: readonly number[];
  readonly swapped: readonly number[];
  /** Positions the median-of-three rule looked at. */
  readonly candidates: readonly number[];
  /** Positions that already hold their final item. */
  readonly settled: readonly boolean[];
  readonly nodes: readonly CallNode[];
  readonly stack: readonly number[];
  readonly rule: PivotRule;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'quicksort(A, lo, hi)          sorts A[lo..hi-1]'],
  ['base', 1, 'if hi - lo <= 1: return'],
  ['choose', 1, 'pick a pivot position, swap it to A[hi-1]'],
  ['init', 1, 'pivot = A[hi-1];  store = lo'],
  ['loop', 1, 'for j = lo to hi - 2:'],
  ['compare', 2, 'if A[j] < pivot:'],
  ['swap', 3, 'swap A[store] and A[j];  store = store + 1'],
  ['place', 1, 'swap A[store] and A[hi-1]      (the pivot is now final)'],
  ['left', 1, 'quicksort(A, lo, store)'],
  ['right', 1, 'quicksort(A, store + 1, hi)'],
  ['return', 1, 'return   (A[lo..hi-1] is sorted)'],
]);

type T = Recorder<QuicksortState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof SORT_OPS>>;

export const PIVOT_LABELS: Readonly<Record<PivotRule, string>> = {
  last: 'last item',
  random: 'random (seeded)',
  'median-of-three': 'median of three',
};

export const quicksort = defineAlgorithm({
  id: 'sorting-quicksort',
  title: 'Quicksort',
  summary: 'Partition around a pivot so that smaller keys come first, then sort the two sides recursively.',
  pseudocode: PSEUDOCODE,
  ops: SORT_OPS,
  complexity: [
    { resource: 'time', when: 'worst case', bound: 'Θ(n²)', why: 'a pivot that is always the smallest or largest leaves one side empty, so the partitions cost n - 1, n - 2, ..., 1 comparisons.' },
    { resource: 'time', when: 'expected, random pivot', bound: 'Θ(n log n)', why: 'a random pivot splits well often enough that the expected depth is Θ(log n), with about n comparisons per level.' },
    { resource: 'space', when: 'worst case', bound: 'Θ(n)', why: 'the recursion stack can be n deep when every split is lopsided; the sort itself is in place.' },
    { resource: 'space', when: 'expected, random pivot', bound: 'Θ(log n)', why: 'the expected recursion depth is logarithmic.' },
  ],
  presets: [
    { id: 'mixed', label: 'Mixed order, last pivot', input: { items: [5, 2, 9, 1, 7, 3, 8, 4, 6] } },
    { id: 'sorted', label: 'Already sorted, last pivot (worst case)', input: { items: [1, 2, 3, 4, 5, 6, 7, 8] } },
    { id: 'sorted-random', label: 'Already sorted, random pivot', input: { items: [1, 2, 3, 4, 5, 6, 7, 8], pivot: 'random', seed: 373 } },
    { id: 'median', label: 'Already sorted, median of three', input: { items: [1, 2, 3, 4, 5, 6, 7, 8], pivot: 'median-of-three' } },
    { id: 'duplicates', label: 'Duplicates (equal keys can swap order)', input: { items: [2, 1, 1] } },
    { id: 'single', label: 'One item', input: { items: [4] } },
  ],
  execute({ items: keys, pivot: rule = 'last', seed = 373 }: SortInput, t: T): Finished<SortResult> {
    const bad = badKeyIndex(keys);
    const a: Item[] = bad >= 0 ? [] : makeItems(keys);
    const n = a.length;
    const labels = labelsFor(a);
    const rng = createRng(seed);
    const nodes: Mutable<CallNode>[] = [];
    const stack: number[] = [];
    const settled: boolean[] = a.map(() => false);
    let range: [number, number] | null = null;
    let store: number | null = null;
    let j: number | null = null;
    let pivotPos: number | null = null;
    let pivot: number | null = null;
    let phase: QuicksortState['phase'] = 'setup';
    let compare: number[] = [];
    let swapped: number[] = [];
    let candidates: number[] = [];
    const lab = (position: number): string => labels[a[position]?.id ?? -1] ?? '?';
    const key = (position: number): number => a[position]?.key ?? 0;
    const state = (): QuicksortState => ({
      items: a, labels, range, store, j, pivotPos, pivot, phase, compare, swapped, candidates, settled, nodes, stack, rule,
    });

    t.step({
      lines: ['signature'],
      say: bad >= 0
        ? `Item ${bad + 1} is not a finite number, so there is nothing sensible to sort.`
        : n === 0 ? 'The array is empty, so there is nothing to sort.' : `Quicksort ${plural(n, 'item')} with the ${PIVOT_LABELS[rule]} as pivot: partition, then sort each side.`,
      state,
    });
    if (bad >= 0) {
      return t.reject({ lines: ['signature'], say: `Item ${bad + 1} is not a finite number, so the input is rejected.`, state, result: [] });
    }
    if (n < 2) {
      phase = 'done';
      if (n === 1) settled[0] = true;
      return t.finish({ lines: ['return'], say: n === 0 ? 'An empty array is already sorted.' : 'One item is already sorted.', state, result: a });
    }

    const swap = (x: number, y: number): void => {
      const held = a[x] as Item;
      a[x] = a[y] as Item;
      a[y] = held;
      t.count('swaps');
      t.count('writes', 2);
      t.event('swap', [`A[${x}]`, `A[${y}]`]);
    };

    /** Median of three positions by key; ties go to the earlier position. Counts every key comparison. */
    const medianOfThree = (x: number, y: number, z: number, node: Mutable<CallNode>): number => {
      const count = (): void => {
        t.count('comparisons');
        node.cost += 1;
      };
      count();
      const xy = key(x) <= key(y);
      count();
      const yz = key(y) <= key(z);
      if (xy === yz) return y;
      count();
      const xz = key(x) <= key(z);
      return xy ? (xz ? z : x) : (xz ? x : z);
    };

    const call = (lo: number, hi: number, parent: Mutable<CallNode> | null, side: 'left' | 'right' | null): void => {
      if (hi - lo <= 0) return;
      const node: Mutable<CallNode> = {
        id: nodes.length, parent: parent ? parent.id : null, depth: parent ? parent.depth + 1 : 0, lo, hi,
        status: 'open', ids: a.slice(lo, hi).map((item) => item.id), out: null, cost: 0, pivot: null,
      };
      nodes.push(node);
      stack.push(node.id);
      const entry = side === null ? [] : [side];
      range = [lo, hi];
      compare = []; swapped = []; candidates = []; store = null; j = null; pivotPos = null; pivot = null;
      if (hi - lo === 1) {
        node.status = 'done';
        node.out = node.ids;
        settled[lo] = true;
        phase = 'return';
        t.step({ lines: [...entry, 'base'], say: `Call on position ${lo}: ${lab(lo)} is one item, which is already in its final place, so the call returns.`, state });
        stack.pop();
        return;
      }

      // Choose the pivot and park it at hi - 1.
      const size = hi - lo;
      let chosen = hi - 1;
      let how: string;
      if (rule === 'random') {
        chosen = lo + rng.int(0, size - 1);
        how = `the random rule picks position ${chosen}`;
      } else if (rule === 'median-of-three' && size >= 3) {
        const middle = lo + Math.floor((size - 1) / 2);
        candidates = [lo, middle, hi - 1];
        chosen = medianOfThree(lo, middle, hi - 1, node);
        how = `the median of ${lab(lo)}, ${lab(middle)} and ${lab(hi - 1)} is ${lab(chosen)} at position ${chosen}`;
      } else if (rule === 'median-of-three') {
        how = 'with fewer than three items the last item is used';
      } else {
        how = 'the last item is the pivot';
      }
      const picked = a[chosen] as Item;
      const moved = chosen !== hi - 1;
      if (moved) {
        swap(chosen, hi - 1);
        swapped = [chosen, hi - 1];
      }
      pivot = picked.id;
      node.pivot = picked.id;
      pivotPos = hi - 1;
      store = lo;
      j = lo;
      phase = 'choose';
      t.step({
        lines: [...entry, 'choose', 'init'],
        say: `Call on positions ${lo}..${hi - 1}: ${how}, so ${lab(hi - 1)} is parked at position ${hi - 1}${moved ? ' by a swap' : ''} and store starts at ${lo}.`,
        state,
      });
      swapped = [];
      candidates = [];

      phase = 'scan';
      const pivotKey = picked.key;
      for (let scan = lo; scan < hi - 1; scan += 1) {
        t.count('comparisons');
        node.cost += 1;
        t.event('compare', [`A[${scan}]`, `A[${hi - 1}]`]);
        const less = key(scan) < pivotKey;
        compare = [scan, hi - 1];
        // A key that is not less joins the "not less" zone at once; a smaller key waits for its swap frame.
        j = less ? scan : scan + 1;
        t.step({
          lines: ['compare'],
          say: less
            ? `${lab(scan)} is less than the pivot ${lab(hi - 1)}, so it must move into the less zone.`
            : key(scan) === pivotKey
              ? `${lab(scan)} equals the pivot ${lab(hi - 1)} and a tie is not less, so it stays in the not-less zone.`
              : `${lab(scan)} is not less than the pivot ${lab(hi - 1)}, so it stays in the not-less zone.`,
          state,
        });
        if (!less) continue;
        const at = store as number;
        compare = [];
        if (at !== scan) {
          swap(at, scan);
          swapped = [at, scan];
        }
        store = at + 1;
        j = scan + 1;
        t.step({
          lines: ['swap'],
          say: at === scan
            ? `${lab(scan)} already sits at position ${scan}, the edge of the less zone, so only store moves on to ${at + 1}.`
            : `Swap ${lab(at)} (position ${at}) with ${lab(scan)} (position ${scan}), so the less zone grows and store moves on to ${at + 1}.`,
          state,
        });
        swapped = [];
      }

      // Place the pivot.
      const finalAt = store as number;
      compare = [];
      const pivotLabel = lab(hi - 1);
      if (finalAt !== hi - 1) {
        swap(finalAt, hi - 1);
        swapped = [finalAt, hi - 1];
      }
      pivotPos = finalAt;
      j = hi - 1;
      settled[finalAt] = true;
      phase = 'place';
      t.step({
        lines: ['place'],
        say: finalAt === hi - 1
          ? `Every key was less than the pivot, so ${pivotLabel} is already at position ${finalAt}, its final place.`
          : `Swap the pivot ${pivotLabel} into position ${finalAt}: everything left of it is less, and it is in its final place.`,
        state,
      });
      swapped = [];

      call(lo, finalAt, node, 'left');
      call(finalAt + 1, hi, node, 'right');

      node.status = 'done';
      node.out = a.slice(lo, hi).map((item) => item.id);
      range = [lo, hi];
      store = null; j = null; pivotPos = null; pivot = null; compare = []; swapped = [];
      phase = 'return';
      t.step({ lines: ['return'], say: `Both sides of the pivot are sorted, so positions ${lo}..${hi - 1} are sorted and the call returns.`, state });
      stack.pop();
    };

    call(0, n, null, null);
    phase = 'done';
    range = null;
    return t.finish({ lines: ['return'], say: `The top-level call has returned, so all ${plural(n, 'item')} are sorted.`, state, result: a });
  },
});
