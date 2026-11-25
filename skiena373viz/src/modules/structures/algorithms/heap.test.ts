import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import type { Frame, Trace } from '@core';
import { firstViolation, heap, heapExtent, heapPlace } from './heap';
import type { HeapInput, HeapResult, HeapState } from './heap';
import { parseHeapOperations } from './inputs';
import { keyChangeProblem, multisetMinus, settledFrames } from './testHelpers';

// ---- independent reference implementations of the same rules -------------------------------------
function refSiftDown(a: number[], from: number): void {
  let i = from;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let c = i;
    if (l < a.length && a[l]! < a[c]!) c = l;
    if (r < a.length && a[r]! < a[c]!) c = r;
    if (c === i) return;
    [a[i], a[c]] = [a[c]!, a[i]!];
    i = c;
  }
}
function refInsert(a: number[], key: number): void {
  a.push(key);
  let i = a.length - 1;
  while (i > 0 && a[i]! < a[(i - 1) >> 1]!) {
    [a[i], a[(i - 1) >> 1]] = [a[(i - 1) >> 1]!, a[i]!];
    i = (i - 1) >> 1;
  }
}
function refExtract(a: number[]): number | null {
  if (a.length === 0) return null;
  const min = a[0]!;
  const last = a.pop()!;
  if (a.length > 0) {
    a[0] = last;
    refSiftDown(a, 0);
  }
  return min;
}
const refBuild = (a: number[]): void => {
  for (let i = (a.length >> 1) - 1; i >= 0; i -= 1) refSiftDown(a, i);
};

const keysOf = (s: HeapState): number[] => [...s.array, ...(s.held === null ? [] : [s.held]), ...s.pending];

function heapProblem(frame: Frame<HeapState>, previous: Frame<HeapState> | null): string | null {
  const s = frame.state;
  const expectViolations = firstViolation(s.array) >= 0;
  if ((s.violations.length > 0) !== expectViolations) return 'violations list disagrees with the array';
  return keyChangeProblem(keysOf(s), previous ? keysOf(previous.state) : null, frame.events, false);
}

function run(start: number[], text: string): Trace<HeapState, HeapResult> {
  const ops = parseHeapOperations(text);
  if (!ops.ok) throw new Error(ops.message);
  return checkAlgorithm(heap, { start, operations: ops.value }, { invariant: heapProblem });
}
const lastState = (trace: Trace<HeapState, HeapResult>): HeapState => trace.frames[trace.frames.length - 1]!.state;

describe('binary min-heap', () => {
  it('is described completely', () => {
    expect(describeProblems(heap)).toEqual([]);
  });

  it.each(heap.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract and loses no key', (_id, input) => {
    checkAlgorithm(heap, input, { invariant: heapProblem });
  });

  it('presets light every pseudocode line', () => {
    expect(unlitAnchors(heap, heap.presets.map((p) => heap.run(p.input)))).toEqual([]);
  });

  it('insert into an empty heap', () => {
    const trace = run([], 'insert 7');
    expect(trace.result.array).toEqual([7]);
    expect(trace.totals).toEqual({ comparisons: 0, swaps: 0 });
  });

  it('extract from an empty heap is explained and the sequence continues', () => {
    const trace = run([], 'extract, insert 7, extract, extract');
    expect(trace.result.outcomes).toEqual(['empty: nothing to extract', 'inserted', 'extracted 7', 'empty: nothing to extract']);
    expect(trace.result.extracted).toEqual([7]);
    expect(trace.frames.some((f) => /heap is empty, so there is no minimum/.test(f.explanation))).toBe(true);
  });

  it('a single-key heap: extract leaves it empty, with the key in transit', () => {
    const trace = run([4], 'extract');
    expect(trace.result.array).toEqual([]);
    expect(trace.frames.some((f) => f.state.held === 4 && f.state.array.length === 0)).toBe(true);
    expect(trace.totals).toEqual({ comparisons: 0, swaps: 0 });
  });

  it('a two-key heap: extract moves the last key to the root without comparing', () => {
    const trace = run([1, 2], 'extract');
    expect(trace.result.array).toEqual([2]);
    expect(trace.totals).toEqual({ comparisons: 0, swaps: 0 });
  });

  it('sift-up stops at the first parent that is not larger', () => {
    const trace = run([2, 5, 3], 'insert 4');
    // 4 goes to index 3, below 5: one swap, then 4 vs the root 2 stops.
    expect(trace.result.array).toEqual([2, 4, 3, 5]);
    expect(trace.totals).toEqual({ comparisons: 2, swaps: 1 });
  });

  it('a new minimum rises to the root', () => {
    const trace = run([2, 5, 3, 9], 'insert 1');
    expect(trace.result.array).toEqual([1, 2, 3, 9, 5]);
    expect(trace.totals).toEqual({ comparisons: 2, swaps: 2 });
    expect(trace.frames.some((f) => /moves up to index 0, the root/.test(f.explanation))).toBe(true);
  });

  it('duplicates: an equal key does not move above its equal parent', () => {
    const trace = run([5, 5, 5], 'insert 5');
    expect(trace.result.array).toEqual([5, 5, 5, 5]);
    expect(trace.totals).toEqual({ comparisons: 1, swaps: 0 });
  });

  it('equal children: the tie goes left, and the trace says so', () => {
    const trace = run([1, 3, 3, 9], 'extract');
    // 9 moves to the root; children 3 and 3 are equal, so 9 swaps with the LEFT one.
    expect(trace.result.array).toEqual([3, 9, 3]);
    expect(trace.frames.some((f) => /equal, so the tie goes left to index 1/.test(f.explanation))).toBe(true);
  });

  it('only a left child: sift-down needs one comparison and says so', () => {
    const trace = run([1, 2, 3], 'extract');
    expect(trace.result.array).toEqual([2, 3]);
    expect(trace.frames.some((f) => /only a left child/.test(f.explanation))).toBe(true);
    expect(trace.totals).toEqual({ comparisons: 1, swaps: 1 });
  });

  it('building an array that is already a heap makes no swaps', () => {
    const trace = run([1, 2, 3, 4, 5, 6, 7], 'build');
    expect(trace.result.array).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(trace.totals['swaps']).toBe(0);
  });

  it('build on reversed input: a heap, within 2n comparisons', () => {
    const trace = run([9, 8, 7, 6, 5, 4, 3, 2, 1], 'build');
    expect(firstViolation(trace.result.array)).toBe(-1);
    expect(trace.totals['comparisons']).toBeLessThanOrEqual(18);
    expect([...trace.result.array].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('repeated insertion on reversed input does more work than sift-down build', () => {
    const start = Array.from({ length: 31 }, (_, i) => 31 - i);
    const built = run(start, 'build');
    const inserted = run(start, 'rebuild');
    expect(firstViolation(inserted.result.array)).toBe(-1);
    expect(inserted.totals['comparisons']!).toBeGreaterThan(built.totals['comparisons']!);
    expect(inserted.totals['swaps']!).toBeGreaterThan(built.totals['swaps']!);
  });

  it('build of an empty or one-key array does nothing', () => {
    expect(run([], 'build').result.array).toEqual([]);
    expect(run([5], 'build').result.array).toEqual([5]);
    expect(run([5], 'rebuild').result.array).toEqual([5]);
  });

  it('insert and extract are refused on an array that is not a heap yet, then build fixes it', () => {
    const trace = run([3, 1, 2], 'insert 9, extract, build, insert 0');
    expect(trace.result.outcomes).toEqual(['refused: not a heap', 'refused: not a heap', 'built by sift-down', 'inserted']);
    expect([...trace.result.array].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(firstViolation(trace.result.array)).toBe(-1);
    expect(trace.frames.some((f) => /not a heap yet and build must run first/.test(f.explanation))).toBe(true);
  });

  it('shows the extracted minimum in transit and the key waiting list during rebuild', () => {
    const trace = run([1, 3, 2], 'extract');
    expect(trace.frames.filter((f) => f.state.held !== null).length).toBeGreaterThan(0);
    const rebuilt = run([4, 2, 3], 'rebuild');
    expect(rebuilt.frames.some((f) => f.state.pending.length === 2 && f.state.array.length === 1)).toBe(true);
  });

  it('heap property after every completed operation, and extraction order is sorted', () => {
    const rng = createRng(11);
    for (let round = 0; round < 60; round += 1) {
      const start = [...Array.from({ length: rng.int(0, 10) }, () => rng.int(0, 20))].sort((a, b) => a - b); // ascending is a heap
      const operations = Array.from({ length: rng.int(1, 14) }, () => {
        const kind = rng.pick(['insert', 'insert', 'extract', 'build', 'rebuild'] as const);
        return { kind, key: kind === 'insert' ? rng.int(0, 20) : null };
      });
      const trace = checkAlgorithm(heap, { start, operations }, { invariant: heapProblem });
      for (const frame of settledFrames(trace.frames)) expect(firstViolation(frame.state.array)).toBe(-1);
    }
    const keys = Array.from({ length: 20 }, () => rng.int(0, 30));
    const extracted = run(keys, 'build' + ', extract'.repeat(keys.length)).result.extracted;
    expect(extracted).toEqual([...keys].sort((a, b) => a - b));
  });

  it('matches independent insert, extract and build routines on 200 seeded random sequences', () => {
    const rng = createRng(99);
    for (let round = 0; round < 200; round += 1) {
      const raw = Array.from({ length: rng.int(0, 12) }, () => rng.int(-5, 15));
      const operations = [{ kind: 'build', key: null } as const, ...Array.from({ length: rng.int(1, 12) }, () => {
        const kind = rng.pick(['insert', 'extract', 'rebuild'] as const);
        return { kind, key: kind === 'insert' ? rng.int(-5, 15) : null };
      })];
      const input: HeapInput = { start: raw, operations };
      const trace = heap.run(input);
      const a = [...raw];
      refBuild(a);
      const states: number[][] = [[...a]];
      const extracted: number[] = [];
      for (const op of operations.slice(1)) {
        if (op.kind === 'insert') refInsert(a, op.key ?? 0);
        else if (op.kind === 'extract') {
          const min = refExtract(a);
          if (min !== null) extracted.push(min);
        } else {
          const keys = [...a];
          a.length = 0;
          for (const key of keys) refInsert(a, key);
        }
        states.push([...a]);
      }
      expect(trace.result.array).toEqual(a);
      expect(trace.result.extracted).toEqual(extracted);
      // After each operation the first frame of the next one (or the last frame) shows the same array.
      const settled = settledFrames(trace.frames);
      settled.slice(1).forEach((frame, i) => expect(frame.state.array).toEqual(states[i]));
    }
  });

  it('build never uses more than 2n comparisons', () => {
    const rng = createRng(5);
    for (let round = 0; round < 100; round += 1) {
      const n = rng.int(0, 40);
      const start = Array.from({ length: n }, () => rng.int(0, 50));
      expect(heap.run({ start, operations: [{ kind: 'build', key: null }] }, { mode: 'counts' }).totals['comparisons']!).toBeLessThanOrEqual(2 * n);
    }
  });

  it('no key is lost or doubled in any frame of a long sequence', () => {
    // run() applies the per-frame key invariant; the survivors are 3, 4, 5, 6, 7 and the final insert 9.
    const trace = run([1, 3, 2, 7, 4, 6, 5], 'extract, insert 0, extract, extract, rebuild, build, insert 9');
    expect(trace.result.extracted).toEqual([1, 0, 2]);
    expect(multisetMinus(keysOf(lastState(trace)), [3, 4, 5, 6, 7, 9])).toEqual([]);
    expect(multisetMinus([3, 4, 5, 6, 7, 9], keysOf(lastState(trace)))).toEqual([]);
  });

  it('places tree nodes by index and sizes the stage from the whole trace', () => {
    expect([0, 1, 2, 3, 6, 7].map(heapPlace)).toEqual([
      { depth: 0, offset: 0 }, { depth: 1, offset: 0 }, { depth: 1, offset: 1 },
      { depth: 2, offset: 0 }, { depth: 2, offset: 3 }, { depth: 3, offset: 0 },
    ]);
    const trace = run([1, 2], 'insert 3, insert 4, insert 5');
    expect(heapExtent(trace.frames)).toBe(5);
  });

  it('stays within the frame cap at the interface limits', () => {
    const start = Array.from({ length: 16 }, (_, i) => 100 - i);
    const operations = [{ kind: 'build', key: null }, ...Array.from({ length: 23 }, (_, i) => (i % 2 === 0 ? { kind: 'insert', key: i } : { kind: 'extract', key: null }))] as HeapInput['operations'];
    expect(heap.run({ start, operations }).truncated).toBe(false);
  });
});
