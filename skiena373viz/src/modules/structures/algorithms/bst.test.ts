import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import type { Frame, Trace } from '@core';
import { bst, bstExtent, bstPlaces } from './bst';
import type { BstInput, BstResult, BstState } from './bst';
import { parseBstOperations } from './inputs';
import { keyChangeProblem, settledFrames } from './testHelpers';

// ---- an independent reference: an immutable recursive tree ---------------------------------------
interface Ref {
  readonly key: number;
  readonly left: Ref | null;
  readonly right: Ref | null;
}
const refInsert = (t: Ref | null, key: number): Ref =>
  t === null ? { key, left: null, right: null }
    : key < t.key ? { ...t, left: refInsert(t.left, key) }
      : key > t.key ? { ...t, right: refInsert(t.right, key) } : t;
const minKey = (t: Ref): number => (t.left === null ? t.key : minKey(t.left));
function refDelete(t: Ref | null, key: number): { tree: Ref | null; kind: 'missing' | 'leaf' | 'one-child' | 'two-children' } {
  if (t === null) return { tree: null, kind: 'missing' };
  if (key < t.key) { const r = refDelete(t.left, key); return { tree: { ...t, left: r.tree }, kind: r.kind }; }
  if (key > t.key) { const r = refDelete(t.right, key); return { tree: { ...t, right: r.tree }, kind: r.kind }; }
  if (t.left === null && t.right === null) return { tree: null, kind: 'leaf' };
  if (t.left === null || t.right === null) return { tree: t.left ?? t.right, kind: 'one-child' };
  const successor = minKey(t.right);
  return { tree: { key: successor, left: t.left, right: refDelete(t.right, successor).tree }, kind: 'two-children' };
}
const refKeys = (t: Ref | null): number[] => (t === null ? [] : [...refKeys(t.left), t.key, ...refKeys(t.right)]);
const refHeight = (t: Ref | null): number | null => (t === null ? null : Math.max(refHeight(t.left) ?? -1, refHeight(t.right) ?? -1) + 1);
const shape = (t: Ref | null): unknown => (t === null ? null : [t.key, shape(t.left), shape(t.right)]);

/** The tree of a state as nested [key, left, right]. */
function stateShape(state: BstState): unknown {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const go = (id: string | null): unknown => {
    if (id === null) return null;
    const n = byId.get(id);
    if (!n) throw new Error(`dangling ${id}`);
    return [n.key, go(n.left), go(n.right)];
  };
  return go(state.root);
}

// ---- the per-frame invariants ---------------------------------------------------------------------
function bstProblem(frame: Frame<BstState>, previous: Frame<BstState> | null): string | null {
  const s = frame.state;
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  const seen: number[] = [];
  const visit = (id: string | null, low: number, high: number): string | null => {
    if (id === null) return null;
    const n = byId.get(id);
    if (!n) return `dangling child ${id}`;
    if (!(n.key > low && n.key < high)) return `search-tree property broken at key ${n.key}`;
    const leftBad = visit(n.left, low, n.key);
    seen.push(n.key);
    return leftBad ?? visit(n.right, n.key, high);
  };
  const bad = visit(s.root, -Infinity, Infinity);
  if (bad) return bad;
  if (seen.length !== s.nodes.length) return 'some nodes are not reachable from the root';
  if (JSON.stringify(seen) !== JSON.stringify(s.nodes.map((n) => n.key))) return 'nodes are not listed in key order';
  if (s.n !== s.nodes.length) return 'n disagrees with the node list';
  const keys = (x: BstState): number[] => [...x.nodes.map((n) => n.key), ...(x.held ? [x.held.key] : [])];
  const keyProblem = keyChangeProblem(keys(s), previous ? keys(previous.state) : null, frame.events, true);
  if (keyProblem) return keyProblem;
  // A node id never changes its key.
  if (previous) {
    const p = previous.state;
    const before = new Map([...p.nodes.map((n) => [n.id, n.key] as const), ...(p.held ? [[p.held.id, p.held.key] as const] : [])]);
    for (const n of [...s.nodes, ...(s.held ? [s.held] : [])]) {
      const old = before.get(n.id);
      if (old !== undefined && old !== n.key) return `node ${n.id} changed its key from ${old} to ${n.key}`;
    }
  }
  return null;
}

function run(start: number[], text: string): Trace<BstState, BstResult> {
  const ops = parseBstOperations(text);
  if (!ops.ok) throw new Error(ops.message);
  return checkAlgorithm(bst, { start, operations: ops.value }, { invariant: bstProblem });
}
const finalShape = (trace: Trace<BstState, BstResult>): unknown => stateShape(trace.frames[trace.frames.length - 1]!.state);

describe('binary search tree', () => {
  it('is described completely', () => {
    expect(describeProblems(bst)).toEqual([]);
  });

  it.each(bst.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract and the tree invariants', (_id, input) => {
    checkAlgorithm(bst, input, { invariant: bstProblem });
  });

  it('presets light every pseudocode line', () => {
    expect(unlitAnchors(bst, bst.presets.map((p) => bst.run(p.input)))).toEqual([]);
  });

  it('insert into an empty tree makes the root', () => {
    const trace = run([], 'insert 5');
    expect(trace.result.keys).toEqual([5]);
    expect(trace.result.outcomes).toEqual(['inserted']);
    expect(trace.result.height).toBe(0);
    expect(trace.totals).toEqual({ comparisons: 0, 'link-changes': 1 });
  });

  it('delete from an empty tree is explained and changes nothing', () => {
    const trace = run([], 'delete 5, insert 2');
    expect(trace.result.outcomes).toEqual(['not found, unchanged', 'inserted']);
    expect(trace.frames.some((f) => /empty, so 5 is not in the tree and there is nothing to delete/.test(f.explanation))).toBe(true);
    expect(trace.result.keys).toEqual([2]);
  });

  it('delete of a missing key is explained and changes nothing', () => {
    const trace = run([5, 3, 8], 'delete 4');
    expect(trace.result.outcomes).toEqual(['not found, unchanged']);
    expect(trace.result.keys).toEqual([3, 5, 8]);
    expect(trace.totals['comparisons']).toBe(2);
    expect(trace.totals['link-changes']).toBe(0);
  });

  it('delete a leaf', () => {
    const trace = run([5, 3, 8], 'delete 3');
    expect(trace.result.outcomes).toEqual(['deleted (leaf)']);
    expect(finalShape(trace)).toEqual([5, null, [8, null, null]]);
    expect(trace.totals['link-changes']).toBe(1);
  });

  it('delete a node with only a left child', () => {
    const trace = run([5, 3, 2], 'delete 3');
    expect(trace.result.outcomes).toEqual(['deleted (one child)']);
    expect(finalShape(trace)).toEqual([5, [2, null, null], null]);
  });

  it('delete a node with only a right child', () => {
    const trace = run([5, 3, 4], 'delete 3');
    expect(trace.result.outcomes).toEqual(['deleted (one child)']);
    expect(finalShape(trace)).toEqual([5, [4, null, null], null]);
  });

  it('delete a node with two children whose successor is its right child', () => {
    const trace = run([5, 3, 8, 2, 4, 9], 'delete 5');
    expect(trace.result.outcomes).toEqual(['deleted (two children)']);
    expect(finalShape(trace)).toEqual([8, [3, [2, null, null], [4, null, null]], [9, null, null]]);
    expect(trace.totals['link-changes']).toBe(4);
  });

  it('delete a node with two children whose successor is deeper', () => {
    const trace = run([5, 3, 10, 2, 4, 8, 12, 7], 'delete 5');
    expect(finalShape(trace)).toEqual([7, [3, [2, null, null], [4, null, null]], [10, [8, null, null], [12, null, null]]]);
  });

  it('delete a node with two children whose successor has a right child', () => {
    const trace = run([50, 30, 100, 20, 40, 80, 120, 70, 75], 'delete 50');
    // 70 is lifted out, its right child 75 takes its place under 80, and 70 becomes the root.
    expect(finalShape(trace)).toEqual([70, [30, [20, null, null], [40, null, null]], [100, [80, [75, null, null], null], [120, null, null]]]);
    expect(trace.result.keys).toEqual([20, 30, 40, 70, 75, 80, 100, 120]);
  });

  it('shows the successor in transit while it is out of the tree', () => {
    const trace = run([50, 30, 100, 20, 40, 80, 120, 70, 75], 'delete 50');
    const lifted = trace.frames.filter((f) => f.state.held !== null);
    expect(lifted).toHaveLength(1);
    const frame = lifted[0]!;
    expect(frame.state.held?.key).toBe(70);
    expect(frame.state.nodes.map((n) => n.key)).not.toContain(70);
    expect(frame.state.nodes.map((n) => n.key)).toContain(50);
    expect(frame.events).toEqual([]);
    const next = trace.frames[frame.index + 1]!;
    expect(next.events).toEqual([{ kind: 'remove', targets: ['key:50'] }]);
    expect(next.state.held).toBeNull();
  });

  it('the successor keeps its node id when it takes the place of the deleted node', () => {
    const trace = run([50, 30, 100, 20, 40, 80, 120, 70, 75], 'delete 50');
    const before = trace.frames[0]!.state.nodes.find((n) => n.key === 70)!;
    const last = trace.frames[trace.frames.length - 1]!.state;
    expect(last.nodes.find((n) => n.key === 70)?.id).toBe(before.id);
    expect(last.root).toBe(before.id);
  });

  it('delete the root when it is a leaf, then the tree is empty', () => {
    const trace = run([5], 'delete 5');
    expect(trace.result.keys).toEqual([]);
    expect(trace.result.height).toBeNull();
    expect(trace.frames[trace.frames.length - 1]!.explanation).toBe('All 1 operations are done, and the tree is empty.');
  });

  it('delete the root with only a left child', () => {
    const trace = run([5, 3], 'delete 5');
    expect(finalShape(trace)).toEqual([3, null, null]);
    expect(trace.result.outcomes).toEqual(['deleted (one child)']);
  });

  it('delete the root with only a right child', () => {
    const trace = run([5, 8], 'delete 5');
    expect(finalShape(trace)).toEqual([8, null, null]);
  });

  it('delete the root with two children', () => {
    const trace = run([5, 3, 8], 'delete 5');
    expect(finalShape(trace)).toEqual([8, [3, null, null], null]);
  });

  it('a duplicate insert changes nothing and says so', () => {
    const trace = run([5, 3, 8], 'insert 3');
    expect(trace.result.outcomes).toEqual(['duplicate, unchanged']);
    expect(trace.result.keys).toEqual([3, 5, 8]);
    expect(trace.totals['link-changes']).toBe(0);
    expect(trace.frames[trace.frames.length - 2]!.explanation).toMatch(/changes nothing/);
    expect(JSON.stringify(trace.frames[1]!.state.nodes)).toBe(JSON.stringify(trace.frames[trace.frames.length - 1]!.state.nodes));
  });

  it('duplicates among the starting keys are ignored and mentioned', () => {
    const trace = run([4, 4, 2], 'search 2');
    expect(trace.frames[0]!.explanation).toContain('duplicates ignored: 4');
    expect(trace.result.keys).toEqual([2, 4]);
  });

  it('counts one three-way comparison per visited node', () => {
    const trace = run([50, 30, 70, 20, 40], 'search 40, search 45, search 50');
    expect(trace.result.outcomes).toEqual(['found', 'not found', 'found']);
    // 50, 30, 40 | 50, 30, 40 | 50
    expect(trace.totals['comparisons']).toBe(3 + 3 + 1);
  });

  it('sorted insertions give height n - 1', () => {
    for (const n of [1, 2, 5, 12]) {
      const text = Array.from({ length: n }, (_, i) => `insert ${i + 1}`).join(', ');
      const trace = run([], text);
      expect(trace.result.height).toBe(n - 1);
      expect(trace.totals['comparisons']).toBe((n * (n - 1)) / 2);
    }
  });

  it('height of a balanced insertion order is the floor of lg n', () => {
    const trace = run([], 'insert 4, insert 2, insert 6, insert 1, insert 3, insert 5, insert 7');
    expect(trace.result.height).toBe(2);
  });

  it('matches an independent recursive tree on 200 seeded random sequences', () => {
    const rng = createRng(2026);
    for (let round = 0; round < 200; round += 1) {
      const start = Array.from({ length: rng.int(0, 8) }, () => rng.int(0, 24));
      const operations = Array.from({ length: rng.int(1, 14) }, () => ({ kind: rng.pick(['insert', 'insert', 'delete', 'search'] as const), key: rng.int(0, 24) }));
      const input: BstInput = { start, operations };
      const trace = bst.run(input);
      let tree: Ref | null = null;
      for (const key of start) tree = refInsert(tree, key);
      const afterEach: (Ref | null)[] = [tree];
      const expectedOutcomes: string[] = [];
      for (const { kind, key } of operations) {
        const present = refKeys(tree).includes(key);
        if (kind === 'insert') {
          expectedOutcomes.push(present ? 'duplicate, unchanged' : 'inserted');
          tree = refInsert(tree, key);
        } else if (kind === 'search') {
          expectedOutcomes.push(present ? 'found' : 'not found');
        } else {
          const r = refDelete(tree, key);
          expectedOutcomes.push(r.kind === 'missing' ? 'not found, unchanged' : `deleted (${r.kind === 'leaf' ? 'leaf' : r.kind === 'one-child' ? 'one child' : 'two children'})`);
          tree = r.tree;
        }
        afterEach.push(tree);
      }
      expect(trace.result.outcomes).toEqual(expectedOutcomes);
      expect(trace.result.keys).toEqual(refKeys(tree));
      expect(trace.result.height).toBe(refHeight(tree));
      // The settled tree after every operation has the same shape as the reference's.
      const settled = settledFrames(trace.frames);
      expect(settled).toHaveLength(operations.length + 1);
      settled.forEach((frame, i) => {
        // The first frame of operation i shows the tree after operation i - 1; the last frame, after the last one.
        expect(stateShape(frame.state)).toEqual(shape(afterEach[i] ?? null));
      });
      expect(stateShape(trace.frames[trace.frames.length - 1]!.state)).toEqual(shape(tree));
      // The same input checked against the whole contract and the per-frame invariants.
      if (round < 40) checkAlgorithm(bst, input, { invariant: bstProblem });
    }
  });

  it('the in-order listing is sorted after every operation', () => {
    const rng = createRng(7);
    for (let round = 0; round < 50; round += 1) {
      const operations = Array.from({ length: 12 }, () => ({ kind: rng.pick(['insert', 'delete'] as const), key: rng.int(0, 15) }));
      const trace = bst.run({ start: [], operations });
      for (const frame of trace.frames) {
        const keys = frame.state.nodes.map((n) => n.key);
        expect(keys).toEqual([...keys].sort((a, b) => a - b));
      }
    }
  });

  it('lays nodes out by in-order position, with the extent fixed by the whole trace', () => {
    const trace = run([], 'insert 3, insert 1, insert 2');
    const last = trace.frames[trace.frames.length - 1]!.state;
    const places = bstPlaces(last);
    const keyOf = (id: string): number => last.nodes.find((n) => n.id === id)!.key;
    expect(Object.entries(places).map(([id, p]) => [keyOf(id), p.slot, p.depth]).sort()).toEqual([[1, 0, 1], [2, 1, 2], [3, 2, 0]]);
    expect(bstExtent(trace.frames)).toEqual({ slots: 3, levels: 3 });
  });

  it('stays within the frame cap at the interface limits (16 start keys, 24 operations)', () => {
    const start = Array.from({ length: 16 }, (_, i) => i);
    const operations = Array.from({ length: 24 }, (_, i) => ({ kind: i % 3 === 0 ? 'delete' : 'insert', key: 16 + i }) as const);
    const trace = bst.run({ start, operations });
    expect(trace.truncated).toBe(false);
  });
});
