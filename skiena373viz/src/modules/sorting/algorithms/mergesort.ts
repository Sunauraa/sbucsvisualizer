/** Top-down mergesort with an explicit buffer. A key is in the array or in the buffer, never both. */
import { defineAlgorithm, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { badKeyIndex, labelsFor, makeItems, plural, SORT_OPS } from './common';
import type { CallNode, Item, Mutable, SortInput, SortResult } from './common';

export interface MergesortState {
  /** Array positions; null is a hole: the item there has been moved into the buffer. */
  readonly items: readonly (Item | null)[];
  /** Buffer slots, same positions as the array; null is a hole: the item has been written back. */
  readonly buffer: readonly (Item | null)[];
  readonly labels: readonly string[];
  /** The positions of the merge in progress: [lo, hi). Null when no merge is running. */
  readonly merging: readonly [number, number] | null;
  readonly mid: number | null;
  /** Next unread slot of the left run and of the right run (buffer positions), and the next array position to write. */
  readonly i: number | null;
  readonly j: number | null;
  readonly k: number | null;
  /** Buffer positions just compared. */
  readonly compare: readonly number[];
  /** The array position just written. */
  readonly taken: number | null;
  /** Maximal sorted runs, as [lo, hi) pairs, left to right. */
  readonly runs: readonly (readonly [number, number])[];
  readonly nodes: readonly CallNode[];
  /** Ids of the calls that are running now, outermost first. */
  readonly stack: readonly number[];
  readonly phase: 'setup' | 'split' | 'merge' | 'done';
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'mergesort(A, lo, hi)'],
  ['base', 1, 'if hi - lo <= 1: return'],
  ['split', 1, 'mid = ⌊(lo + hi) / 2⌋'],
  ['left', 1, 'mergesort(A, lo, mid)'],
  ['right', 1, 'mergesort(A, mid, hi)'],
  ['copy', 1, 'copy A[lo..hi-1] into buffer B;  i = lo, j = mid, k = lo'],
  ['while', 1, 'while i < mid and j < hi:'],
  ['compare', 2, 'if B[j] < B[i]   (a tie takes the left item)'],
  ['take-right', 3, 'A[k] = B[j];  j = j + 1;  k = k + 1'],
  ['take-left', 3, 'else  A[k] = B[i];  i = i + 1;  k = k + 1'],
  ['rest', 1, 'move what is left of either run into A'],
  ['return', 1, 'return'],
]);

type T = Recorder<MergesortState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof SORT_OPS>>;

export const mergesort = defineAlgorithm({
  id: 'sorting-mergesort',
  title: 'Mergesort',
  summary: 'Sort each half recursively, then merge the two sorted halves through a buffer, left item first on ties.',
  pseudocode: PSEUDOCODE,
  ops: SORT_OPS,
  complexity: [
    { resource: 'time', when: 'every case', bound: 'Θ(n log n)', why: 'about log n levels of merging, and each level handles n items with about one comparison per item.' },
    { resource: 'space', when: 'every case', bound: 'Θ(n)', why: 'the buffer holds up to n items while a merge runs; recursion adds only Θ(log n).' },
  ],
  presets: [
    { id: 'mixed', label: 'Mixed order', input: { items: [5, 2, 9, 1, 7, 3, 8, 4, 6] } },
    { id: 'duplicates', label: 'Duplicates (stable: equal keys keep their order)', input: { items: [3, 1, 3, 2, 1, 3] } },
    { id: 'reversed', label: 'Reversed', input: { items: [8, 7, 6, 5, 4, 3, 2, 1] } },
    { id: 'sorted', label: 'Already sorted', input: { items: [1, 2, 3, 4, 5, 6, 7] } },
    { id: 'single', label: 'One item', input: { items: [4] } },
  ],
  execute({ items: keys }: SortInput, t: T): Finished<SortResult> {
    const bad = badKeyIndex(keys);
    const all: Item[] = bad >= 0 ? [] : makeItems(keys);
    const n = all.length;
    const labels = labelsFor(all);
    const array: (Item | null)[] = [...all];
    const buffer: (Item | null)[] = all.map(() => null);
    const nodes: Mutable<CallNode>[] = [];
    const stack: number[] = [];
    let runs: [number, number][] = [];
    let merging: [number, number] | null = null;
    let mid: number | null = null;
    let i: number | null = null;
    let j: number | null = null;
    let k: number | null = null;
    let compare: number[] = [];
    let taken: number | null = null;
    let phase: MergesortState['phase'] = 'setup';
    const lab = (item: Item | null | undefined): string => (item ? (labels[item.id] ?? '?') : 'a hole');
    const state = (): MergesortState => ({
      items: array, buffer, labels, merging, mid, i, j, k, compare, taken, runs, nodes, stack, phase,
    });
    const idsIn = (lo: number, hi: number): number[] => array.slice(lo, hi).map((item) => item?.id ?? -1);

    t.step({
      lines: ['signature'],
      say: bad >= 0
        ? `Item ${bad + 1} is not a finite number, so there is nothing sensible to sort.`
        : n === 0 ? 'The array is empty, so there is nothing to sort.' : `Mergesort ${plural(n, 'item')}: sort the halves, then merge them through a buffer.`,
      state,
    });
    if (bad >= 0) {
      return t.reject({ lines: ['signature'], say: `Item ${bad + 1} is not a finite number, so the input is rejected.`, state, result: [] });
    }
    if (n < 2) {
      phase = 'done';
      return t.finish({ lines: ['return'], say: n === 0 ? 'An empty array is already sorted.' : 'One item is already sorted.', state, result: all });
    }

    const call = (lo: number, hi: number, parent: Mutable<CallNode> | null, side: 'left' | 'right' | null): void => {
      const node: Mutable<CallNode> = {
        id: nodes.length, parent: parent ? parent.id : null, depth: parent ? parent.depth + 1 : 0, lo, hi,
        status: 'open', ids: idsIn(lo, hi), out: null, cost: 0, pivot: null,
      };
      nodes.push(node);
      stack.push(node.id);
      const entry = side === null ? [] : [side];
      const where = `positions ${lo}..${hi - 1}`;
      if (hi - lo <= 1) {
        node.status = 'done';
        node.out = node.ids;
        runs = [...runs, [lo, hi]];
        phase = 'split';
        t.step({ lines: [...entry, 'base'], say: `Call on position ${lo}: ${lab(array[lo] ?? null)} is one item, which is already sorted, so the call returns.`, state });
        stack.pop();
        return;
      }
      const middle = Math.floor((lo + hi) / 2);
      mid = middle;
      phase = 'split';
      t.step({
        lines: [...entry, 'split'],
        say: `Call on ${where} (${plural(hi - lo, 'item')}): split at ${middle} into ${lo}..${middle - 1} and ${middle}..${hi - 1}.`,
        state,
      });
      call(lo, middle, node, 'left');
      call(middle, hi, node, 'right');
      merge(node, lo, middle, hi);
      stack.pop();
    };

    const merge = (node: Mutable<CallNode>, lo: number, middle: number, hi: number): void => {
      merging = [lo, hi];
      mid = middle;
      phase = 'merge';
      for (let p = lo; p < hi; p += 1) {
        buffer[p] = array[p] ?? null;
        array[p] = null;
      }
      t.count('writes', hi - lo);
      t.event('move', [`A[${lo}..${hi - 1}]`, `B[${lo}..${hi - 1}]`]);
      let left = lo;
      let right = middle;
      let out = lo;
      i = left; j = right; k = out; compare = []; taken = null;
      t.step({
        lines: ['copy'],
        say: `Copy the ${plural(hi - lo, 'item')} of positions ${lo}..${hi - 1} into the buffer, leaving holes in the array (${hi - lo} writes).`,
        state,
      });
      const place = (from: number): void => {
        array[out] = buffer[from] ?? null;
        buffer[from] = null;
        t.count('writes');
        t.event('write', [`A[${out}]`], `from B[${from}]`);
      };
      while (left < middle && right < hi) {
        const l = buffer[left] ?? null;
        const r = buffer[right] ?? null;
        t.count('comparisons');
        node.cost += 1;
        t.event('compare', [`B[${left}]`, `B[${right}]`]);
        const takeRight = (r?.key ?? 0) < (l?.key ?? 0);
        compare = [left, right];
        taken = null;
        t.step({
          lines: ['compare'],
          say: takeRight
            ? `Compare ${lab(l)} in slot ${left} with ${lab(r)} in slot ${right}: ${lab(r)} is smaller, so it goes next.`
            : l?.key === r?.key
              ? `Compare ${lab(l)} in slot ${left} with ${lab(r)} in slot ${right}: they are equal, and a tie takes the left item, so ${lab(l)} goes next.`
              : `Compare ${lab(l)} in slot ${left} with ${lab(r)} in slot ${right}: ${lab(l)} is smaller, so it goes next.`,
          state,
        });
        const from = takeRight ? right : left;
        place(from);
        taken = out;
        if (takeRight) right += 1; else left += 1;
        out += 1;
        i = left; j = right; k = out;
        t.step({
          lines: [takeRight ? 'take-right' : 'take-left'],
          say: `Write ${lab(array[taken])} from buffer slot ${from} into array position ${taken}.`,
          state,
        });
      }
      compare = [];
      while (left < middle || right < hi) {
        const from = left < middle ? left : right;
        place(from);
        taken = out;
        if (left < middle) left += 1; else right += 1;
        out += 1;
        i = left; j = right; k = out;
        t.step({
          lines: ['rest'],
          say: `One run is used up, so ${lab(array[taken])} from buffer slot ${from} moves into array position ${taken} with no comparison.`,
          state,
        });
      }
      node.status = 'done';
      node.out = idsIn(lo, hi);
      runs = [...runs.filter(([a]) => a < lo || a >= hi), [lo, hi] as [number, number]].sort((x, y) => x[0] - y[0]);
      merging = null; i = null; j = null; k = null; taken = null; compare = [];
      t.step({ lines: ['return'], say: `Positions ${lo}..${hi - 1} now hold one sorted run, and the call returns.`, state });
    };

    call(0, n, null, null);
    phase = 'done';
    mid = null;
    return t.finish({
      lines: ['return'],
      say: `The top-level merge is finished, so all ${plural(n, 'item')} are sorted.`,
      state,
      result: array.map((item) => item as Item),
    });
  },
});
