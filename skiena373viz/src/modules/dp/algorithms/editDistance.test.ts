import { describe, expect, it } from 'vitest';
import { createRng, experimentProblems, measureAt } from '@core';
import type { Frame, Trace } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import {
  applyOperations, candidatesAt, codePoints, DIRS, editDistance, experiments, operationsCost, parseEditInput, parentCell, showChar,
} from './editDistance';
import type { Dir, EditInput, EditOp, EditResult, EditState } from './editDistance';

type EditFrame = Frame<EditState>;
type EditTrace = Trace<EditState, EditResult>;

/** Independent reference: recursion on suffixes with a memo, taking the minimum of all three moves every time. */
function referenceDistance(a: string, b: string): number {
  const P = codePoints(a);
  const T = codePoints(b);
  const memo = new Map<string, number>();
  const f = (x: number, y: number): number => {
    if (x === P.length) return T.length - y;
    if (y === T.length) return P.length - x;
    const key = `${x},${y}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const value = Math.min(f(x + 1, y + 1) + (P[x] === T[y] ? 0 : 1), f(x, y + 1) + 1, f(x + 1, y) + 1);
    memo.set(key, value);
    return value;
  };
  return f(0, 0);
}

/** Checks the whole contract plus the module's own invariants on every frame. */
function check(pattern: string, text: string): EditTrace {
  const P = codePoints(pattern);
  const T = codePoints(text);
  return checkAlgorithm(editDistance, { pattern, text }, {
    conserved: (state) => [...state.pattern, ...state.text],
    invariant: (frame, previous) => stateProblem(frame, previous, P.length, T.length),
  });
}

function count(table: readonly (readonly (number | null)[])[]): number {
  return table.reduce((sum, row) => sum + row.filter((v) => v !== null).length, 0);
}

function stateProblem(frame: EditFrame, previous: EditFrame | null, m: number, n: number): string | null {
  const { state } = frame;
  if (state.table.length !== m + 1 || state.table.some((row) => row.length !== n + 1)) return 'table has the wrong size';
  if (state.parents.length !== m + 1 || state.parents.some((row) => row.length !== n + 1)) return 'parents have the wrong size';
  const filled = count(state.table);
  const before = previous ? count(previous.state.table) : 0;
  const writes = state.step.kind === 'base' || state.step.kind === 'write' ? 1 : 0;
  if (filled !== before + writes) return `${filled - before} cells were written in a ${state.step.kind} frame`;
  if (previous) {
    for (let i = 0; i <= m; i += 1) {
      for (let j = 0; j <= n; j += 1) {
        const was = previous.state.table[i]?.[j];
        if (was !== null && was !== undefined && was !== state.table[i]?.[j]) return `D[${i}][${j}] changed after it was written`;
      }
    }
  }
  const corner = state.table[m]?.[n];
  if (['trace-start', 'trace-move', 'done'].includes(state.step.kind) && corner == null) return 'the traceback starts before the corner is written';
  if (state.step.kind === 'setup' && filled !== 0) return 'the setup frame shows values';
  const cell = state.step.cell;
  if (state.step.kind === 'look' && cell) {
    if (state.table[cell[0]]?.[cell[1]] !== null) return 'a look frame shows the cell already filled';
    if (state.candidates !== null || state.minimum !== null || state.chosen !== null) return 'a look frame leaks candidates';
    if (state.deps.length !== 3 || state.deps.some((d) => state.table[d.cell[0]]?.[d.cell[1]] == null)) return 'a dependency is not ready';
    if (state.parents[cell[0]]?.[cell[1]] !== null) return 'a look frame already has parents';
  }
  if (state.step.kind === 'write' && cell) {
    const value = state.table[cell[0]]?.[cell[1]];
    const totals = (state.candidates ?? []).map((c) => c.total);
    if (totals.length !== 3 || value !== Math.min(...totals) || value !== state.minimum) return 'write frame candidates disagree with the value';
    const parents = state.parents[cell[0]]?.[cell[1]] ?? [];
    if (parents[0] !== state.chosen) return 'the chosen parent is not the first optimal parent';
    if (state.tie !== parents.length > 1) return 'tie flag disagrees with the parents';
  }
  if (state.step.kind === 'trace-move' && state.moves.length !== (previous?.state.moves.length ?? 0) + 1) return 'a traceback frame must add exactly one move';
  return null;
}

const frameKinds = (trace: EditTrace): string[] => trace.frames.map((f) => f.state.step.kind);

describe('edit distance: description and presets', () => {
  it('is described completely', () => {
    expect(describeProblems(editDistance)).toEqual([]);
  });

  it.each(editDistance.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract', (_id, input) => {
    check(input.pattern, input.text);
  });

  it('presets light every pseudocode line', () => {
    const traces = editDistance.presets.map((p) => editDistance.run(p.input));
    expect(unlitAnchors(editDistance, traces)).toEqual([]);
  });

  it('the first preset is kitten to sitting', () => {
    expect(editDistance.presets[0]?.input).toEqual({ pattern: 'kitten', text: 'sitting' });
  });
});

describe('edit distance: edge cases', () => {
  it.each([
    ['both empty', '', '', 0],
    ['empty pattern: only insertions', '', 'abc', 3],
    ['empty text: only deletions', 'abc', '', 3],
    ['equal strings', 'banana', 'banana', 0],
    ['single characters, equal', 'a', 'a', 0],
    ['single characters, different', 'a', 'b', 1],
    ['complete mismatch', 'abc', 'xyz', 3],
    ['repeated letters', 'aaa', 'aa', 1],
    ['kitten to sitting', 'kitten', 'sitting', 3],
    ['intention to execution', 'intention', 'execution', 5],
    ['a single insertion in the middle', 'ac', 'abc', 1],
  ])('%s', (_name, pattern, text, distance) => {
    const trace = check(pattern, text);
    expect(trace.status).toBe('completed');
    expect(trace.result.distance).toBe(distance);
    expect(trace.result.distance).toBe(referenceDistance(pattern, text));
    expect(operationsCost(trace.result.operations)).toBe(distance);
    expect(applyOperations(codePoints(pattern), trace.result.operations)?.join('')).toBe(text);
  });

  it('both empty: a 1 by 1 table, no moves, no edits', () => {
    const trace = check('', '');
    expect(trace.result).toEqual({ distance: 0, operations: [] });
    expect(frameKinds(trace)).toEqual(['setup', 'base', 'trace-start', 'done']);
    expect(trace.totals).toEqual({ cells: 1, comparisons: 0, 'traceback-steps': 0 });
  });

  it('empty one way and the other: a pure run of insertions or deletions', () => {
    const insertions = check('', 'abc').result.operations;
    expect(insertions.map((op) => op.kind)).toEqual(['insert', 'insert', 'insert']);
    expect(insertions.map((op) => op.textChar).join('')).toBe('abc');
    const deletions = check('abc', '').result.operations;
    expect(deletions.map((op) => op.kind)).toEqual(['delete', 'delete', 'delete']);
    expect(deletions.map((op) => op.patternIndex)).toEqual([0, 1, 2]);
  });

  it('equal strings: distance 0 and an all-match traceback along the diagonal', () => {
    const trace = check('banana', 'banana');
    expect(trace.result.operations.every((op) => op.kind === 'match')).toBe(true);
    expect(trace.result.operations).toHaveLength(6);
    const moves = trace.frames[trace.frames.length - 1]?.state.moves ?? [];
    expect(moves.every((move) => move.dir === 'diag' && move.kind === 'match')).toBe(true);
    expect(trace.totals['traceback-steps']).toBe(6);
  });

  it('complete mismatch of equal length: three substitutions', () => {
    const trace = check('abc', 'xyz');
    expect(trace.result.operations.map((op) => op.kind)).toEqual(['substitute', 'substitute', 'substitute']);
  });

  it('repeated letters "aaa" to "aa": one deletion, the leftover letters match', () => {
    const trace = check('aaa', 'aa');
    expect(trace.result.distance).toBe(1);
    expect(trace.result.operations.filter((op) => op.kind === 'delete')).toHaveLength(1);
    expect(trace.result.operations.filter((op) => op.kind === 'match')).toHaveLength(2);
  });

  it('spaces are ordinary characters, shown as a visible mark', () => {
    const trace = check('a b', 'ab');
    expect(trace.result.distance).toBe(1);
    expect(showChar(' ')).toBe('␣');
    const text = trace.frames.map((f) => f.explanation).join(' ');
    expect(text).toContain('‘␣’');
    expect(trace.result.operations.find((op) => op.kind === 'delete')?.patternChar).toBe(' ');
  });

  it('accented letters: a precomposed é is one character, e plus a combining accent is two', () => {
    expect(check('café', 'cafe').result.distance).toBe(1);
    expect(check('é', 'é').result.distance).toBe(2);
    expect(check('é', 'é').result.distance).toBe(0);
  });

  it('an emoji is one code point, not two UTF-16 halves', () => {
    const trace = check('a😀b', 'a😎b');
    expect(trace.result.distance).toBe(1);
    expect(trace.frames[0]?.state.pattern).toEqual(['a', '😀', 'b']);
    expect(trace.frames[0]?.state.table).toHaveLength(4);
    expect(trace.totals['comparisons']).toBe(9);
    const sub = trace.result.operations.find((op) => op.kind === 'substitute');
    expect(sub).toMatchObject({ patternChar: '😀', textChar: '😎', patternIndex: 1, textIndex: 1 });
    expect(check('😀', '😀').result.distance).toBe(0);
  });

  it('control characters are shown with a visible name', () => {
    expect(showChar('\t')).toBe('⇥');
    expect(showChar('\u0007')).toBe('U+0007');
    check('\t', '\u0007');
  });

  it('over-long input gives a message instead of a run', () => {
    expect(parseEditInput('a'.repeat(12), 'b'.repeat(12)).ok).toBe(true);
    const long = parseEditInput('a'.repeat(13), 'b');
    expect(long).toEqual({ ok: false, message: 'The pattern has 13 characters; the limit here is 12.' });
    const longText = parseEditInput('a', '😀'.repeat(13));
    expect(longText).toEqual({ ok: false, message: 'The text has 13 characters; the limit here is 12.' });
    expect(parseEditInput('😀'.repeat(12), '').ok).toBe(true);
  });

  it('the algorithm itself does not throw on a long input; it truncates the trace and keeps exact counts', () => {
    const trace = editDistance.run({ pattern: 'ab'.repeat(20), text: 'ba'.repeat(20) });
    expect(trace.truncated).toBe(true);
    expect(trace.totals['cells']).toBe(41 * 41);
    expect(trace.result.distance).toBe(referenceDistance('ab'.repeat(20), 'ba'.repeat(20)));
  });
});

describe('edit distance: frame sequence', () => {
  it('has the documented order: setup, base row, base column, two frames per inner cell, traceback, done', () => {
    const trace = check('kitten', 'sitting');
    const m = 6;
    const n = 7;
    const kinds = frameKinds(trace);
    const expected = ['setup', ...Array(n + 1 + m).fill('base'), ...Array.from({ length: m * n }, () => ['look', 'write']).flat(),
      'trace-start', ...Array(trace.totals['traceback-steps']).fill('trace-move'), 'done'];
    expect(kinds).toEqual(expected);
  });

  it('visits base cells D[0][0], row 0, then column 0, and inner cells row by row', () => {
    const trace = check('abc', 'ab');
    const base = trace.frames.filter((f) => f.state.step.kind === 'base').map((f) => f.state.step.cell);
    expect(base).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [3, 0]]);
    const writes = trace.frames.filter((f) => f.state.step.kind === 'write').map((f) => f.state.step.cell);
    expect(writes).toEqual([[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]]);
  });

  it('each inner cell takes exactly two frames: look (empty, no candidates) then write', () => {
    const trace = check('sunday', 'saturday');
    trace.frames.forEach((frame, index) => {
      if (frame.state.step.kind !== 'look') return;
      const next = trace.frames[index + 1];
      expect(next?.state.step.kind).toBe('write');
      expect(next?.state.step.cell).toEqual(frame.state.step.cell);
      expect(frame.state.candidates).toBeNull();
      const [i, j] = frame.state.step.cell ?? [0, 0];
      expect(frame.state.table[i]?.[j]).toBeNull();
      expect(next?.state.table[i]?.[j]).not.toBeNull();
      expect(frame.state.deps.map((d) => d.dir)).toEqual(['diag', 'left', 'up']);
      expect(frame.state.deps.map((d) => d.cell)).toEqual([[i - 1, j - 1], [i, j - 1], [i - 1, j]]);
      expect(frame.state.comparing).toEqual({ pattern: i - 1, text: j - 1 });
    });
  });

  it('counts: cells = (m+1)(n+1), comparisons = mn, and frame 0 is all zeros', () => {
    const trace = check('abcd', 'xy');
    expect(trace.frames[0]?.ops).toEqual({ cells: 0, comparisons: 0, 'traceback-steps': 0 });
    expect(trace.totals['cells']).toBe(15);
    expect(trace.totals['comparisons']).toBe(8);
    expect(trace.totals['traceback-steps']).toBe(trace.result.operations.length);
  });

  it('the last frame carries the script, forward; only the last frame does', () => {
    const trace = check('kitten', 'sitting');
    const last = trace.frames[trace.frames.length - 1];
    expect(last?.state.script).toEqual(trace.result.operations);
    expect(trace.frames.slice(0, -1).every((f) => f.state.script === null)).toBe(true);
    expect(last?.state.alignment).toHaveLength(trace.result.operations.length);
    expect(last?.state.alignment.map((c) => c.kind)).toEqual(trace.result.operations.map((op) => op.kind));
  });

  it('the alignment grows from the right end, one column per traceback frame', () => {
    const trace = check('ab', 'ba');
    const lengths = trace.frames.filter((f) => f.state.step.kind === 'trace-move').map((f) => f.state.alignment.length);
    expect(lengths).toEqual(lengths.map((_l, k) => k + 1));
  });

  it('presets are complete traces on the same table (frames and counts modes agree)', () => {
    for (const { input } of editDistance.presets) {
      expect(editDistance.run(input, { mode: 'counts' }).result).toEqual(editDistance.run(input).result);
    }
  });
});

describe('edit distance: ties', () => {
  /** All pairs over {a, b} up to length 4. */
  const pairs: EditInput[] = [];
  const words = ['', 'a', 'b', 'aa', 'ab', 'ba', 'bb', 'aab', 'aba', 'abb', 'baa', 'bab', 'abab', 'baba', 'aabb', 'bbaa'];
  for (const pattern of words) for (const text of words) pairs.push({ pattern, text });

  const writesOf = (trace: EditTrace): EditFrame[] => trace.frames.filter((f) => f.state.step.kind === 'write');

  it('a tie in the fill: the diagonal wins over left and left over up, and every optimal parent is recorded', () => {
    let diagLeft = 0;
    let leftUp = 0;
    let all = 0;
    for (const input of pairs) {
      for (const frame of writesOf(editDistance.run(input))) {
        const [i, j] = frame.state.step.cell ?? [0, 0];
        const parents = frame.state.parents[i]?.[j] ?? [];
        if (frame.state.tie) {
          expect(parents.length).toBeGreaterThan(1);
          expect(frame.state.chosen).toBe(parents[0]);
          expect(parents).toEqual(DIRS.filter((d) => parents.includes(d)));
        }
        const key = parents.join(',');
        if (key === 'diag,left') diagLeft += 1;
        if (key === 'left,up') leftUp += 1;
        if (key === 'diag,left,up') all += 1;
      }
    }
    expect(diagLeft).toBeGreaterThan(0);
    expect(leftUp).toBeGreaterThan(0);
    expect(all).toBeGreaterThan(0);
  });

  it('parents of every cell are exactly the neighbours that reach its value (checked against the final table)', () => {
    const rng = createRng(11);
    for (let round = 0; round < 60; round += 1) {
      const input = { pattern: randomWord(rng, 'abc', 0, 6), text: randomWord(rng, 'abc', 0, 6) };
      const trace = check(input.pattern, input.text);
      const last = trace.frames[trace.frames.length - 1];
      if (!last) throw new Error('no frames');
      const { table, parents, pattern, text } = last.state;
      for (let i = 1; i < table.length; i += 1) {
        for (let j = 1; j < (table[0]?.length ?? 0); j += 1) {
          const cands = candidatesAt(table, pattern, text, i, j);
          const expected: Dir[] = (cands ?? []).filter((c) => c.total === table[i]?.[j]).map((c) => c.dir);
          expect(parents[i]?.[j]).toEqual(expected);
        }
      }
    }
  });

  it('a tie in the traceback: the move taken is the first optimal parent, and the others are recorded', () => {
    let seen = 0;
    for (const input of pairs) {
      const trace = editDistance.run(input);
      const last = trace.frames[trace.frames.length - 1];
      for (const move of last?.state.moves ?? []) {
        if (move.optimal.length < 2) continue;
        seen += 1;
        expect(move.dir).toBe(move.optimal[0]);
        expect(move.optimal).toEqual(DIRS.filter((d) => move.optimal.includes(d)));
        const [i, j] = move.from;
        expect(last?.state.parents[i]?.[j]).toEqual(move.optimal);
        expect(move.to).toEqual(parentCell(i, j, move.dir));
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('a traceback frame with a tie names the other parents and the tie-break in its sentence', () => {
    const trace = check('ab', 'ba');
    const tied = trace.frames.filter((f) => f.state.step.kind === 'trace-move' && f.state.tie);
    expect(tied.length).toBeGreaterThan(0);
    for (const frame of tied) {
      expect(frame.explanation).toContain('also optimal');
      expect(frame.explanation).toContain('diagonal, left, up');
      expect(frame.lines).toContain('tie');
    }
  });

  it('a fill frame with a tie lights the tie line and names the tie-break; one without does not', () => {
    const trace = check('ab', 'ba');
    for (const frame of writesOf(trace)) {
      expect(frame.lines.includes('tie')).toBe(frame.state.tie);
      expect(frame.explanation.includes('tie-break')).toBe(frame.state.tie);
    }
    expect(writesOf(trace).some((f) => f.state.tie)).toBe(true);
  });
});

function randomWord(rng: ReturnType<typeof createRng>, alphabet: string, min: number, max: number): string {
  return Array.from({ length: rng.int(min, max) }, () => alphabet.charAt(rng.int(0, alphabet.length - 1))).join('');
}

describe('edit distance: random inputs against an independent reference', () => {
  const rng = createRng(373);
  const inputs: EditInput[] = Array.from({ length: 300 }, () => ({ pattern: randomWord(rng, 'abc', 0, 9), text: randomWord(rng, 'abc', 0, 9) }));

  it('distance equals a memoised recursion on 300 seeded pairs', () => {
    for (const input of inputs) {
      const result = editDistance.run(input, { mode: 'counts' }).result;
      expect(result.distance, `${input.pattern} -> ${input.text}`).toBe(referenceDistance(input.pattern, input.text));
    }
  });

  it('applying the script to the pattern yields the text and costs exactly the distance, on 300 seeded pairs', () => {
    for (const input of inputs) {
      const { distance, operations } = editDistance.run(input, { mode: 'counts' }).result;
      expect(operationsCost(operations), `${input.pattern} -> ${input.text}`).toBe(distance);
      expect(applyOperations(codePoints(input.pattern), operations)?.join(''), `${input.pattern} -> ${input.text}`).toBe(input.text);
      // The script covers both strings completely and in order.
      const kept = (op: EditOp): boolean => op.patternIndex !== null;
      expect(operations.filter(kept).map((op) => op.patternIndex)).toEqual(Array.from({ length: input.pattern.length }, (_x, k) => k));
      expect(operations.filter((op) => op.textIndex !== null).map((op) => op.textIndex)).toEqual(Array.from({ length: input.text.length }, (_x, k) => k));
    }
  });

  it('is symmetric in its arguments, and the reverse script has the same cost', () => {
    for (const input of inputs) {
      const forward = editDistance.run(input, { mode: 'counts' }).result.distance;
      const backward = editDistance.run({ pattern: input.text, text: input.pattern }, { mode: 'counts' }).result.distance;
      expect(backward, `${input.pattern} <-> ${input.text}`).toBe(forward);
    }
  });

  it('applyOperations refuses a wrong script', () => {
    const { operations } = editDistance.run({ pattern: 'abc', text: 'axc' }, { mode: 'counts' }).result;
    expect(applyOperations(['a', 'b', 'c'], operations)?.join('')).toBe('axc');
    expect(applyOperations(['a', 'b'], operations)).toBeNull();
    expect(applyOperations(['a', 'b', 'c'], operations.slice(1))).toBeNull();
  });
});

describe('edit distance: growth experiments', () => {
  it('are valid and theory-shaped', () => {
    for (const experiment of experiments) expect(experimentProblems(experiment)).toEqual([]);
    const [square, fixed] = experiments;
    if (!square || !fixed) throw new Error('two experiments expected');
    for (const { id } of square.cases) {
      expect(measureAt(square, id, 16, 1)['cells']).toBe(17 * 17);
      expect(measureAt(square, id, 16, 1)['comparisons']).toBe(16 * 16);
      expect(measureAt(fixed, id, 32, 1)['cells']).toBe(9 * 33);
    }
  });

  it('a whole sweep is fast enough to plot', () => {
    const started = Date.now();
    for (const experiment of experiments) for (const { id } of experiment.cases) for (const n of experiment.sizes) measureAt(experiment, id, n, 1);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
