import { describe, expect, it } from 'vitest';
import { defineAlgorithm, defineOps, definePseudocode, distAdd, distLess, formatDist, NotJsonSafeError, OpCounter, snapshot } from '.';
import type { Frame, Recorder, Trace } from '.';
import { checkAlgorithm, isDeepFrozen, jsonProblems, sentenceProblem, validateTrace } from './testing';

const CODE = definePseudocode([['start', 0, 'sum(A)'], ['add', 1, 'total = total + x'], ['done', 1, 'return total']]);
const OPS = defineOps([{ id: 'additions', label: 'Additions', counts: 'One per addition.' }]);
interface S { readonly items: readonly number[]; readonly total: number }
type T = Recorder<S, 'start' | 'add' | 'done', 'additions'>;

const sum = defineAlgorithm({
  id: 'test-sum', title: 'Sum', summary: 'Adds.', pseudocode: CODE, ops: OPS, complexity: [], presets: [],
  execute(items: readonly number[], t: T) {
    const live = { items: [...items], total: 0 }; // deliberately one mutable object for the whole run
    t.step({ lines: ['start'], say: 'Begin with a total of 0.', state: () => live });
    for (const item of items) {
      if (item < 0) return t.reject({ lines: ['start'], say: `${item} is negative, so this sum refuses it.`, state: () => live, result: null as number | null });
      live.total += item;
      t.count('additions');
      t.event('write', ['total']);
      t.step({ lines: ['add'], say: `Add ${item} to get ${live.total}.`, state: () => live });
    }
    return t.finish({ lines: ['done'], say: `Return ${live.total}.`, state: () => live, result: live.total as number | null });
  },
});

describe('recorder', () => {
  it('snapshots state, so later mutation cannot rewrite history', () => {
    const trace = checkAlgorithm(sum, [1, 2, 3]);
    expect(trace.frames.map((f) => f.state.total)).toEqual([0, 1, 3, 6, 6]);
    expect(trace.frames.map((f) => f.ops['additions'])).toEqual([0, 1, 2, 3, 3]);
    expect(trace.frames[1]?.events).toEqual([{ kind: 'write', targets: ['total'] }]);
    expect(isDeepFrozen(trace.frames)).toBe(true);
  });

  it('records rejection as a normal trace', () => {
    const trace = checkAlgorithm(sum, [1, -4, 3]);
    expect(trace.status).toBe('rejected');
    expect(trace.result).toBeNull();
    expect(trace.frames.at(-1)?.explanation).toContain('-4');
  });

  it('truncates loudly, keeping the first frames, the last frame and exact totals', () => {
    const trace = checkAlgorithm(sum, Array.from({ length: 50 }, () => 1), { run: { maxFrames: 10 } });
    expect(trace.frames).toHaveLength(10);
    expect([trace.truncated, trace.droppedFrames]).toEqual([true, 42]);
    expect(trace.frames.at(-1)?.lines).toEqual(['done']);
    expect(trace.totals['additions']).toBe(50);
  });

  it("evaluates nothing in 'counts' mode", () => {
    const trace = sum.run([1, 2], { mode: 'counts' });
    expect(trace.frames).toEqual([]);
    expect([trace.result, trace.totals['additions']]).toEqual([3, 2]);
  });

  it('refuses unknown anchors, use after finish, and results that did not come from finish()', () => {
    const build = (execute: (n: number, t: Recorder<number, 'start' | 'add' | 'done', 'additions'>) => never | { status: 'completed'; result: number }) =>
      defineAlgorithm({ id: 'test-bad', title: 'Bad', summary: 'Bad.', pseudocode: CODE, ops: OPS, complexity: [], presets: [], execute });
    expect(() => build((n, t) => t.finish({ lines: ['nope' as 'done'], say: 'x.', state: () => n, result: n }) as never).run(1)).toThrow(/anchor "nope"/);
    expect(() => build((n, t) => {
      const end = t.finish({ lines: ['done'], say: 'Done.', state: () => n, result: n });
      t.count('additions');
      return end as never;
    }).run(1)).toThrow(/after finish/);
    expect(() => build((n) => ({ status: 'completed', result: n })).run(1)).toThrow(/must return/);
    expect(() => build((_n, t) => t.finish({ lines: ['done'], say: 'x.', state: () => Infinity, result: 1 }) as never).run(1)).toThrow(NotJsonSafeError);
  });
});

describe('validateTrace', () => {
  const good = sum.run([1, 2]);
  const broken = (patch: Partial<Frame<S>>, index = 1): string[] => {
    const frames = good.frames.map((f, i) => (i === index ? { ...f, ...patch } : f));
    return validateTrace(sum, { ...good, frames } as Trace<S, number | null>);
  };
  it.each([
    ['index', { index: 7 }, /index is 7/],
    ['anchor', { lines: ['gone'] }, /unknown anchor "gone"/],
    ['no line', { lines: [] }, /no pseudocode line/],
    ['decrease', { ops: { additions: 5 } }, /decreased/],
    ['ops keys', { ops: {} }, /ops keys differ/],
    ['two sentences', { explanation: 'One thing. Another thing.' }, /exactly one sentence/],
    ['empty', { explanation: '' }, /empty/],
    ['mutable', { state: { items: [], total: 1 } }, /not deeply frozen/],
    ['NaN', { state: { items: [], total: NaN } }, /NaN is not JSON/],
    ['undefined', { state: { items: [], total: undefined as unknown as number } }, /undefined is not JSON/],
    ['Set', { state: { items: new Set([1]) as unknown as number[], total: 1 } }, /Set is not a plain object/],
  ] as const)('catches %s', (_name, patch, message) => {
    expect(broken(patch as Partial<Frame<S>>).join('\n')).toMatch(message);
  });
  it('catches work in frame 0, vanished values and custom invariants', () => {
    expect(broken({ ops: { additions: 1 } }, 0).join()).toMatch(/frame 0 must show the setup/);
    expect(validateTrace(sum, good, { conserved: (s) => [s.total] }).join()).toMatch(/vanished/);
    expect(validateTrace(sum, good, { invariant: ({ state }) => (state.total > 2 ? 'too big' : null) }).join()).toMatch(/too big/);
  });
  it('checkAlgorithm catches mutation and nondeterminism', () => {
    let calls = 0;
    const impure = { ...sum, run: (input: readonly number[]) => sum.run([...input, (calls += 1)]) };
    expect(() => checkAlgorithm(impure, [1])).toThrow(/not deterministic/);
    const rude = { ...sum, run: (input: readonly number[]) => ((input as number[]).push(1), sum.run(input)) };
    expect(() => checkAlgorithm(rude, [1])).toThrow();
  });
});

describe('small helpers', () => {
  it('sentenceProblem accepts ordinary explanations', () => {
    for (const text of ['A[2] = 3.5 is smaller.', 'Is 3 < 5?', 'Pop B (distance 4).', 'The key "x" moves down!']) expect(sentenceProblem(text)).toBeNull();
    expect(sentenceProblem('No stop')).toMatch(/end with/);
    expect(sentenceProblem('Distance is undefined.')).toMatch(/raw value/);
  });
  it('snapshot copies, freezes and names the bad path', () => {
    const source = { a: [{ b: 1 }] };
    const copy = snapshot(source);
    source.a[0]!.b = 2;
    expect(copy).toEqual({ a: [{ b: 1 }] });
    expect(() => snapshot({ a: [1, () => 1] })).toThrow('$.a[1]: function');
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(jsonProblems(loop)).toEqual(['$.self: circular reference']);
    const shared = { v: 1 };
    expect(jsonProblems([shared, shared])).toEqual([]);
  });
  it('counters only grow and only count declared operations', () => {
    const counter = new OpCounter(OPS);
    counter.add('additions', 2);
    expect(counter.snapshot()).toEqual({ additions: 2 });
    expect(() => counter.add('additions', -1)).toThrow(/only grow/);
    expect(() => counter.add('swaps' as 'additions')).toThrow(/not declared/);
  });
  it('null distances behave as infinity', () => {
    expect([distLess(3, null), distLess(null, 3), distLess(null, null), distLess(2, 2)]).toEqual([true, false, false, false]);
    expect([distAdd(null, 1), distAdd(2, 3), formatDist(null)]).toEqual([null, 5, '∞']);
  });
  it('definePseudocode rejects bad anchors', () => {
    expect(() => definePseudocode([['a', 0, 'x'], ['a', 0, 'y']])).toThrow(/twice/);
    expect(() => definePseudocode([['Not Kebab', 0, 'x']])).toThrow(/kebab/);
  });
});
