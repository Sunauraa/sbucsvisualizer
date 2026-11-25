/**
 * Binary min-heap stored in an array (children of i are 2i+1 and 2i+2): insert (sift-up), extract-min
 * (last element to the root, sift-down), build by sift-down from the last parent, and build by
 * repeated insertion for contrast. One trace for a whole list of operations.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder, Tone } from '@core';
import { at, describeOperation, newLog, pluralize } from './operations';
import type { Operation, OperationLog } from './operations';

export type HeapOpKind = 'insert' | 'extract' | 'build' | 'rebuild';
export type HeapOperation = Operation<HeapOpKind>;

export interface HeapInput {
  /** The array exactly as given. It need not be a heap: `build` and `rebuild` are for that. */
  readonly start: readonly number[];
  readonly operations: readonly HeapOperation[];
}

export interface HeapState {
  readonly array: readonly number[];
  /** A key that is out of the array on purpose: the minimum being extracted. */
  readonly held: number | null;
  /** Keys waiting to be inserted during `rebuild`, next one first. */
  readonly pending: readonly number[];
  /** Tone of each highlighted array index (the key is the index as text). */
  readonly marks: Readonly<Record<string, Tone>>;
  /** Indices i whose key is smaller than their parent's: the heap property fails there. */
  readonly violations: readonly number[];
  /** During build: every index from here on is already the root of a heap. Null otherwise. */
  readonly heapFrom: number | null;
  readonly log: OperationLog;
}

export interface HeapResult {
  readonly array: readonly number[];
  /** Keys returned by extract operations, in order. */
  readonly extracted: readonly number[];
  readonly outcomes: readonly string[];
}

const PSEUDOCODE = definePseudocode([
  ['dispatch', 0, 'for each operation: insert, extract, build or rebuild'],
  ['refuse', 1, 'insert or extract while the array is not a heap: refuse'],
  ['insert-append', 1, 'insert k: A[n] = k, i = n'],
  ['up-check', 2, 'while i > 0 and A[i] < A[parent(i)]   (parent(i) = ⌊(i-1)/2⌋)'],
  ['up-swap', 3, 'swap A[i] with A[parent(i)], i = parent(i)'],
  ['extract-empty', 1, 'extract, n = 0: report that the heap is empty'],
  ['extract-take', 1, 'extract: the minimum is A[0]'],
  ['extract-move', 2, 'A[0] = A[n-1], n = n - 1, i = 0'],
  ['down-pick', 3, 'c = the smaller child of i (the left one if they are equal)'],
  ['down-check', 3, 'while i has a child c with A[c] < A[i]   (children 2i+1, 2i+2)'],
  ['down-swap', 4, 'swap A[i] with A[c], i = c'],
  ['extract-return', 2, 'return the minimum'],
  ['build-loop', 1, 'build: for i = ⌊n/2⌋-1 down to 0, sift down from i'],
  ['rebuild-start', 1, 'rebuild: move every key to a waiting list, empty the heap'],
  ['rebuild-next', 1, 'for each waiting key, in order: A[n] = key, then sift up'],
  ['done', 0, 'every operation has run'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Key comparisons', counts: 'One each time two keys are compared: a key with its parent, a child with the other child, or a child with its parent. The "is it a heap" check before insert or extract is not counted.' },
  { id: 'swaps', label: 'Swaps', counts: 'One each time two array elements exchange places.' },
]);

type T = Recorder<HeapState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const parentOf = (i: number): number => Math.floor((i - 1) / 2);

/** The first index whose key is below its parent's, or -1 when the array is a heap. */
export function firstViolation(array: readonly number[]): number {
  for (let i = 1; i < array.length; i += 1) if (at(array, i) < at(array, parentOf(i))) return i;
  return -1;
}

const describeArray = (array: readonly number[]): string => (array.length === 0 ? 'empty' : array.join(', '));

export const heap = defineAlgorithm({
  id: 'structures-heap',
  title: 'Binary min-heap',
  summary: 'Insert with sift-up, extract-min with sift-down, and two ways to build a heap from an array.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'worst case, insert', bound: 'Θ(log n)', why: 'the new key can rise one level at a time all the way to the root, and a heap with n keys has ⌊lg n⌋ + 1 levels.' },
    { resource: 'time', when: 'worst case, extract-min', bound: 'Θ(log n)', why: 'the key moved to the root can sink to a leaf, two comparisons per level.' },
    { resource: 'time', when: 'worst case, build by sift-down from the last parent', bound: 'Θ(n)', why: 'half the keys are leaves and only one key can sink the full height, so the work per level shrinks as the keys per level grow.' },
    { resource: 'time', when: 'worst case, build by repeated insertion', bound: 'Θ(n log n)', why: 'on decreasing input every inserted key rises to the root, and half the keys sit at the bottom levels, where the climb is longest.' },
    { resource: 'space', when: 'every case', bound: 'Θ(n)', why: 'the array itself; sifting uses a few indices.' },
  ],
  presets: [
    { id: 'insert', label: 'Insert with sift-up', input: { start: [4, 8, 6, 9, 12, 7], operations: [{ kind: 'insert', key: 3 }, { kind: 'insert', key: 10 }] } },
    { id: 'extract', label: 'Extract the minimum, twice', input: { start: [2, 5, 3, 9, 6, 4, 8], operations: [{ kind: 'extract', key: null }, { kind: 'extract', key: null }] } },
    { id: 'build', label: 'Build by sift-down from the last parent', input: { start: [9, 4, 7, 1, 8, 2, 6, 3, 5], operations: [{ kind: 'build', key: null }] } },
    { id: 'rebuild', label: 'Build by repeated insertion, same keys', input: { start: [9, 4, 7, 1, 8, 2, 6, 3, 5], operations: [{ kind: 'rebuild', key: null }] } },
    { id: 'reversed', label: 'Reversed keys: the worst case for building a min-heap', input: { start: [9, 8, 7, 6, 5, 4, 3, 2, 1], operations: [{ kind: 'build', key: null }] } },
    { id: 'ties', label: 'Equal keys: ties go left', input: { start: [5, 5, 5, 5, 5], operations: [{ kind: 'insert', key: 5 }, { kind: 'extract', key: null }, { kind: 'insert', key: 2 }] } },
    { id: 'empty', label: 'Empty heap', input: { start: [], operations: [{ kind: 'extract', key: null }, { kind: 'insert', key: 7 }, { kind: 'extract', key: null }, { kind: 'extract', key: null }] } },
  ],
  execute({ start, operations }: HeapInput, t: T): Finished<HeapResult> {
    const a: number[] = [...start];
    let pending: number[] = [];
    let held: number | null = null;
    let heapFrom: number | null = null;
    let current: number | null = null;
    let marked: readonly (readonly [number, Tone])[] = [];
    const extracted: number[] = [];
    const { texts, outcomes } = newLog(operations);

    const state = (): HeapState => {
      const marks: Record<string, Tone> = {};
      for (const [index, tone] of marked) marks[String(index)] = tone;
      const violations: number[] = [];
      for (let i = 1; i < a.length; i += 1) if (at(a, i) < at(a, parentOf(i))) violations.push(i);
      return { array: [...a], held, pending: [...pending], marks, violations, heapFrom, log: { texts, outcomes: [...outcomes], current } };
    };
    const frame = (lines: readonly AnchorOf<typeof PSEUDOCODE>[], say: () => string, focus: readonly (readonly [number, Tone])[] = []): void => {
      marked = focus;
      t.step({ lines, say, state });
    };

    // Moves the key at `from` up while it is smaller than its parent.
    const siftUp = (from: number): void => {
      let i = from;
      while (i > 0) {
        const p = parentOf(i);
        const child = at(a, i);
        const above = at(a, p);
        t.count('comparisons');
        t.event('compare', [`slot:${i}`, `slot:${p}`], `${child} < ${above}`);
        if (!(child < above)) {
          frame(['up-check'], () => `${child} is not less than its parent ${above}, so sift-up stops and ${child} stays at index ${i}.`, [[i, 'done'], [p, 'visited']]);
          return;
        }
        frame(['up-check'], () => `${child} is less than its parent ${above}, so the two swap.`, [[i, 'compare'], [p, 'compare']]);
        a[i] = above;
        a[p] = child;
        t.count('swaps');
        t.event('swap', [`slot:${i}`, `slot:${p}`]);
        const from = i;
        i = p;
        frame(
          ['up-swap'],
          () => (p === 0 ? `${child} moves up to index 0, the root, so sift-up stops.` : `${child} moves up to index ${p}.`),
          [[p, p === 0 ? 'done' : 'active'], [from, 'swap']],
        );
      }
    };

    // Moves the key at `from` down while a child is smaller.
    const siftDown = (from: number): void => {
      let i = from;
      for (;;) {
        const size = a.length;
        const left = 2 * i + 1;
        const right = left + 1;
        const key = at(a, i);
        if (left >= size) {
          frame(['down-check'], () => `Index ${i} holds ${key} and has no children, so sift-down stops.`, [[i, 'done']]);
          return;
        }
        let c = left;
        let prefix = `Index ${i} has only a left child, so `;
        if (right < size) {
          const l = at(a, left);
          const r = at(a, right);
          t.count('comparisons');
          t.event('compare', [`slot:${left}`, `slot:${right}`], `${l} vs ${r}`);
          c = r < l ? right : left;
          prefix = '';
          frame(
            ['down-pick'],
            () => (l === r
              ? `The children of ${key} are ${l} and ${r}, equal, so the tie goes left to index ${left}.`
              : `The children of ${key} are ${l} (left) and ${r} (right), so the smaller one, ${Math.min(l, r)} at index ${c}, is the candidate.`),
            [[i, 'active'], [left, c === left ? 'target' : 'compare'], [right, c === right ? 'target' : 'compare']],
          );
        }
        const child = at(a, c);
        t.count('comparisons');
        t.event('compare', [`slot:${c}`, `slot:${i}`], `${child} < ${key}`);
        if (!(child < key)) {
          frame(['down-check'], () => `${prefix}${child} is not less than ${key}, so ${key} stays at index ${i} and sift-down stops.`, [[i, 'done'], [c, 'visited']]);
          return;
        }
        frame(['down-check'], () => `${prefix}${child} is less than ${key}, so the two swap.`, [[i, 'compare'], [c, 'compare']]);
        a[i] = child;
        a[c] = key;
        t.count('swaps');
        t.event('swap', [`slot:${i}`, `slot:${c}`]);
        const was = i;
        i = c;
        frame(['down-swap'], () => `${key} moves down to index ${c}.`, [[c, 'active'], [was, 'swap']]);
      }
    };

    const total = operations.length;
    const initial = firstViolation(a);
    t.step({
      lines: ['dispatch'],
      say: () => `The array starts as ${describeArray(a)}${a.length > 0 && initial >= 0 ? ' (not a heap yet)' : ''}, and ${total === 0 ? 'there are no operations to run' : `then ${pluralize(total, 'operation')} run`}.`,
      state,
    });

    for (let i = 0; i < total; i += 1) {
      const op = operations[i];
      if (!op) continue;
      current = i;
      held = null;
      heapFrom = null;
      pending = [];
      marked = [];
      const label = describeOperation(op);
      t.step({ lines: ['dispatch'], say: () => `Operation ${i + 1} of ${total} is ${label}.`, state });

      if (op.kind === 'insert' || op.kind === 'extract') {
        const bad = firstViolation(a);
        if (bad >= 0) {
          outcomes[i] = 'refused: not a heap';
          frame(
            ['refuse'],
            () => `${label} is refused: index ${bad} holds ${at(a, bad)}, below its parent ${at(a, parentOf(bad))}, so the array is not a heap yet and build must run first.`,
            [[bad, 'swap'], [parentOf(bad), 'compare']],
          );
          continue;
        }
      }

      if (op.kind === 'insert') {
        const key = op.key ?? 0;
        const index = a.length;
        a.push(key);
        t.event('insert', [`key:${key}`]);
        outcomes[i] = 'inserted';
        frame(
          ['insert-append'],
          () => (index === 0
            ? `Insert ${key}: the heap is empty, so ${key} becomes the root at index 0.`
            : `Insert ${key}: put it in the first free place, index ${index}, below its parent ${at(a, parentOf(index))}.`),
          [[index, 'active']],
        );
        siftUp(index);
      } else if (op.kind === 'extract') {
        if (a.length === 0) {
          outcomes[i] = 'empty: nothing to extract';
          frame(['extract-empty'], () => 'The heap is empty, so there is no minimum to extract and nothing changes.');
          continue;
        }
        const min = at(a, 0);
        frame(['extract-take'], () => `The minimum is the root, ${min}, so ${min} is the key to extract.`, [[0, 'target']]);
        const last = at(a, a.length - 1);
        held = min;
        if (a.length === 1) {
          a.pop();
          frame(['extract-move'], () => `The root is the only key, so removing it leaves an empty heap, and ${min} waits in transit.`);
        } else {
          a[0] = last;
          a.pop();
          frame(['extract-move'], () => `The last key, ${last}, moves to the root and the heap shrinks by one, while ${min} waits in transit.`, [[0, 'active']]);
          siftDown(0);
        }
        held = null;
        extracted.push(min);
        t.event('remove', [`key:${min}`]);
        outcomes[i] = `extracted ${min}`;
        frame(['extract-return'], () => `Extract returns ${min}, and the heap now holds ${pluralize(a.length, 'key')}.`);
      } else if (op.kind === 'build') {
        const n = a.length;
        outcomes[i] = 'built by sift-down';
        if (n <= 1) {
          frame(['build-loop'], () => `The array has ${pluralize(n, 'key')}, so it is already a heap and there is nothing to sift.`);
          continue;
        }
        const leaves = Math.floor(n / 2);
        heapFrom = leaves;
        frame(['build-loop'], () => `Indices ${leaves} to ${n - 1} are leaves, so each is already a heap of one key, and the loop starts at the last parent, index ${leaves - 1}.`);
        for (let p = Math.floor(n / 2) - 1; p >= 0; p -= 1) {
          heapFrom = p + 1;
          frame(['build-loop'], () => `Sift down from index ${p}, which holds ${at(a, p)}; everything below it is already heap-ordered.`, [[p, 'active']]);
          siftDown(p);
        }
        heapFrom = 0;
        frame(['build-loop'], () => `The loop is finished, so every index is the root of a heap and the whole array is a heap.`);
      } else {
        const n = a.length;
        outcomes[i] = 'rebuilt by repeated insertion';
        pending = [...a];
        a.length = 0;
        frame(['rebuild-start'], () => (n === 0 ? 'The heap is empty, so there is nothing to rebuild.' : `All ${pluralize(n, 'key')} move to the waiting list, in array order, and the heap is empty.`));
        while (pending.length > 0) {
          const key = pending.shift() ?? 0;
          const index = a.length;
          a.push(key);
          frame(['rebuild-next'], () => `Take ${key} from the waiting list and put it at index ${index}.`, [[index, 'active']]);
          siftUp(index);
        }
      }
    }

    current = null;
    held = null;
    heapFrom = null;
    marked = [];
    return t.finish({
      lines: ['done'],
      say: () => (total === 0
        ? 'There were no operations, so the array is unchanged.'
        : `All ${total} operations are done, and the array holds ${pluralize(a.length, 'key')}${firstViolation(a) >= 0 ? ' but is not a heap' : ''}.`),
      state,
      result: { array: [...a], extracted, outcomes: outcomes.map((o) => o ?? '') },
    });
  },
});

/** Positions of a complete binary tree stored by index: depth of index i and slot within its level. */
export function heapPlace(index: number): { readonly depth: number; readonly offset: number } {
  const depth = Math.floor(Math.log2(index + 1));
  return { depth, offset: index + 1 - 2 ** depth };
}

/** The largest array any frame of a trace shows (the stage is sized from it). */
export function heapExtent(frames: readonly { readonly state: HeapState }[]): number {
  let size = 1;
  for (const { state } of frames) size = Math.max(size, state.array.length + (state.held === null ? 0 : 1));
  return size;
}
