import { describe, expect, it } from 'vitest';
import { DIRS, editDistance } from './editDistance';
import type { Dir, EditInput } from './editDistance';
import {
  emptyQuiz, judge, parseAnswer, questionAt, quizGates, quizReducer, reveal, score,
} from './quiz';
import type { EditTrace, Question, QuestionKind } from './quiz';

const run = (pattern: string, text: string): EditTrace => editDistance.run({ pattern, text });

const INPUTS: EditInput[] = [
  { pattern: 'kitten', text: 'sitting' }, { pattern: 'ab', text: 'ba' }, { pattern: '', text: '' }, { pattern: '', text: 'abc' },
  { pattern: 'abc', text: '' }, { pattern: 'a', text: 'b' }, { pattern: 'banana', text: 'banana' }, { pattern: 'intention', text: 'execution' },
];

describe('questionAt reads frame index + 1', () => {
  it.each(INPUTS.map((i) => [`${i.pattern || '(empty)'} -> ${i.text || '(empty)'}`, i] as const))('every frame index of %s', (_name, input) => {
    const trace = run(input.pattern, input.text);
    trace.frames.forEach((frame, index) => {
      const question = questionAt(trace, index);
      const next = trace.frames[index + 1];
      if (!next) {
        expect(question, `last frame ${index}`).toBeNull();
        return;
      }
      const kind = next.state.step.kind;
      const [i, j] = next.state.step.cell ?? [-1, -1];
      switch (kind) {
        case 'base':
          expect(question?.kind).toBe('base');
          if (question?.kind === 'base') {
            expect(question.cell).toEqual([i, j]);
            expect(question.answer).toBe(next.state.table[i]?.[j]);
          }
          break;
        case 'look':
          expect(question?.kind).toBe('cell');
          expect(question?.cell).toEqual([i, j]);
          expect(frame.state.table[i]?.[j]).toBeNull();
          break;
        case 'write':
          expect(question?.kind).toBe('value');
          if (question?.kind === 'value') {
            expect(question.cell).toEqual([i, j]);
            expect(question.answer).toBe(next.state.table[i]?.[j]);
            expect(frame.state.table[i]?.[j]).toBeNull();
          }
          break;
        case 'trace-move':
          expect(question?.kind).toBe('move');
          if (question?.kind === 'move') {
            const move = next.state.moves[next.state.moves.length - 1];
            expect(question.followed).toBe(move?.dir);
            expect(question.accepted).toEqual(move?.optimal);
            expect(question.cell).toEqual(frame.state.position);
            expect(question.accepted).toContain(question.followed);
          }
          break;
        default:
          // trace-start and done are not asked about.
          expect(question, `frame ${index} before a ${kind} frame`).toBeNull();
      }
    });
  });

  it('is null outside the trace and in a truncated trace', () => {
    const trace = run('kit', 'si');
    expect(questionAt(trace, -1)).toBeNull();
    expect(questionAt(trace, trace.frames.length + 5)).toBeNull();
    const truncated = editDistance.run({ pattern: 'ab'.repeat(20), text: 'ba'.repeat(20) });
    expect(truncated.truncated).toBe(true);
    expect(truncated.frames.map((_f, i) => questionAt(truncated, i)).every((q) => q === null)).toBe(true);
    expect(quizGates(truncated, { every: 1, seed: 1 })).toEqual([]);
  });

  it('asks about every kind on a normal pair', () => {
    const trace = run('kitten', 'sitting');
    const kinds = new Set(trace.frames.map((_f, i) => questionAt(trace, i)?.kind));
    expect([...kinds].filter((k) => k !== undefined).sort()).toEqual(['base', 'cell', 'move', 'value']);
  });

  it('the gated frame never contains the answer: the cell is empty, no candidates, no move made', () => {
    const trace = run('intention', 'execution');
    trace.frames.forEach((frame, index) => {
      const q = questionAt(trace, index);
      if (!q) return;
      const { state } = frame;
      if (q.kind === 'cell') {
        expect(state.table[q.cell[0]]?.[q.cell[1]]).toBeNull();
        expect(state.active).not.toEqual(q.cell);
        expect(state.step.cell).not.toEqual(q.cell);
        expect(state.parents[q.cell[0]]?.[q.cell[1]]).toBeNull();
        // Whatever the frame still shows (the last write) is about the previous cell, which is written.
        expect(state.table[state.active?.[0] ?? 0]?.[state.active?.[1] ?? 0]).not.toBeNull();
      }
      if (q.kind === 'value' || q.kind === 'base') {
        expect(state.table[q.cell[0]]?.[q.cell[1]]).toBeNull();
        expect(state.candidates).toBeNull();
        expect(state.minimum).toBeNull();
        expect(state.chosen).toBeNull();
        expect(state.parents[q.cell[0]]?.[q.cell[1]]).toBeNull();
      }
      if (q.kind === 'move') {
        expect(state.position).toEqual(q.cell);
        expect(state.moves.every((move) => move.from[0] !== q.cell[0] || move.from[1] !== q.cell[1])).toBe(true);
        expect(['trace-start', 'trace-move']).toContain(state.step.kind);
      }
    });
  });
});

describe('quizGates', () => {
  const trace = run('kitten', 'sitting');
  const gates = (every: number, seed = 1): readonly number[] => quizGates(trace, { every, seed });

  it('every gate has a question, gates are sorted and unique', () => {
    for (const every of [1, 2, 3, 5]) {
      const list = gates(every);
      expect(list.length).toBeGreaterThan(0);
      expect([...new Set(list)].sort((a, b) => a - b)).toEqual(list);
      for (const g of list) expect(questionAt(trace, g), `gate ${g}`).not.toBeNull();
    }
  });

  it('asks about every k-th cell: k = 1 covers every inner cell once, larger k covers about 1/k', () => {
    const inner = (list: readonly number[]): number => list.filter((g) => {
      const q = questionAt(trace, g);
      return q?.kind === 'cell' || q?.kind === 'value';
    }).length;
    expect(inner(gates(1))).toBe(42);
    expect(inner(gates(3))).toBe(14);
    expect(inner(gates(5))).toBe(9);
  });

  it('the first inner cell is asked, and asking never covers the same cell twice', () => {
    const cells = gates(1).map((g) => questionAt(trace, g)).filter((q): q is Question => q !== null && (q.kind === 'cell' || q.kind === 'value'))
      .map((q) => q.cell.join(','));
    expect(cells[0]).toBe('1,1');
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('is deterministic, and the seed changes which kind a cell is asked as', () => {
    expect(gates(2, 5)).toEqual(gates(2, 5));
    const kinds = (seed: number): QuestionKind[] => gates(1, seed).map((g) => questionAt(trace, g)?.kind).filter((k): k is QuestionKind => k !== undefined);
    expect(kinds(1)).not.toEqual(kinds(2));
    expect(kinds(1).filter((k) => k === 'cell').length).toBeGreaterThan(5);
    expect(kinds(1).filter((k) => k === 'value').length).toBeGreaterThan(5);
  });

  it('no gate on frame 0 only when nothing is asked; tiny and empty tables still make sense', () => {
    for (const { pattern, text } of INPUTS) {
      const t = run(pattern, text);
      const list = quizGates(t, { every: 1, seed: 3 });
      for (const g of list) expect(questionAt(t, g)).not.toBeNull();
    }
    expect(quizGates(run('', ''), { every: 1, seed: 1 })).toEqual([]);
  });

  it('a gate never sits on the traceback start question or the last frame', () => {
    const list = gates(1);
    expect(list.every((g) => g < trace.frames.length - 1)).toBe(true);
  });
});

type Of<K extends QuestionKind> = Question & { readonly kind: K };

function find<K extends QuestionKind>(trace: EditTrace, kind: K, accept: (q: Of<K>) => boolean = () => true): Of<K> {
  for (let i = 0; i < trace.frames.length; i += 1) {
    const q = questionAt(trace, i);
    if (q && q.kind === kind && accept(q as Of<K>)) return q as Of<K>;
  }
  throw new Error(`no ${kind} question`);
}

describe('judging answers', () => {
  const trace = run('kitten', 'sitting');

  it('value: the right number is right, a wrong number gets the recurrence with this cell numbers, then the candidates', () => {
    const q = find(trace, 'value', (x) => x.cell[0] === 2 && x.cell[1] === 3);
    expect(judge(trace, q, { kind: 'number', value: q.answer }, 0).correct).toBe(true);
    const first = judge(trace, q, { kind: 'number', value: q.answer + 5 }, 0);
    expect(first.correct).toBe(false);
    expect(first.message).toContain('D[i][j] = min(D[i-1][j-1] + c');
    expect(first.message).toContain('D[1][2]');
    expect(first.message).toContain('‘i’');
    expect(first.message).not.toContain('smallest');
    const second = judge(trace, q, { kind: 'number', value: q.answer + 5 }, 1);
    expect(second.message).toMatch(/diagonal \d+ \+ [01] = \d+, left \d+ \+ 1 = \d+, up \d+ \+ 1 = \d+/);
    expect(second.message).toContain('smallest');
  });

  it('value: names the candidate a wrong number came from, and a wrong c', () => {
    // Over every value question, a guess equal to a non-minimal candidate is called out on the second hint.
    let named = 0;
    for (let i = 0; i < trace.frames.length; i += 1) {
      const q = questionAt(trace, i);
      if (q?.kind !== 'value') continue;
      const next = trace.frames[i + 1];
      for (const c of next?.state.candidates ?? []) {
        if (c.total === q.answer) continue;
        const text = judge(trace, q, { kind: 'number', value: c.total }, 1).message;
        if (text.includes('candidate, but a smaller candidate exists')) named += 1;
      }
    }
    expect(named).toBeGreaterThan(10);
  });

  it('base: right and wrong, with the reason (insertions in row 0, deletions in column 0)', () => {
    const column = find(trace, 'base', (x) => x.cell[0] === 4 && x.cell[1] === 0);
    expect(judge(trace, column, { kind: 'number', value: 4 }, 0).correct).toBe(true);
    const wrong = judge(trace, column, { kind: 'number', value: 5 }, 0);
    expect(wrong.correct).toBe(false);
    expect(wrong.message).toContain('first 4 pattern characters into the empty string');
    expect(judge(trace, column, { kind: 'number', value: 5 }, 1).message).toContain('deleted');
    const row = find(trace, 'base', (x) => x.cell[0] === 0 && x.cell[1] === 3);
    expect(judge(trace, row, { kind: 'number', value: 3 }, 0).correct).toBe(true);
    expect(judge(trace, row, { kind: 'number', value: 2 }, 1).message).toContain('inserted');
  });

  it('base prompt asks for a value, not a why (R22)', () => {
    const base = find(trace, 'base', (x) => x.cell[0] === 4 && x.cell[1] === 0);
    expect(base.prompt).toBe('What value goes into D[4][0]?');
    for (let i = 0; i < trace.frames.length; i += 1) expect(questionAt(trace, i)?.prompt ?? '').not.toContain('and why');
  });

  it('base hints use singular and plural correctly: "the first 1 text character", never "1 characters" (R22)', () => {
    const one = run('a', 'b');
    const row = find(one, 'base', (x) => x.cell[0] === 0 && x.cell[1] === 1);
    const column = find(one, 'base', (x) => x.cell[0] === 1 && x.cell[1] === 0);
    const hint = (q: Question, level: 0 | 1): string => judge(one, q, { kind: 'number', value: 9 }, level).message;
    expect(hint(row, 0)).toContain('into the first 1 text character.');
    expect(hint(column, 0)).toContain('turning the first 1 pattern character into the empty string');
    expect(hint(row, 1)).toContain('that character has to be inserted');
    expect(hint(column, 1)).toContain('that character has to be deleted');
    // Longer prefixes keep the plural.
    const many = run('abc', 'abc');
    const row3 = find(many, 'base', (x) => x.cell[0] === 0 && x.cell[1] === 3);
    expect(judge(many, row3, { kind: 'number', value: 9 }, 0).message).toContain('the first 3 text characters.');
    expect(judge(many, row3, { kind: 'number', value: 9 }, 1).message).toContain('every one of those 3 characters has to be inserted');
    for (const message of [hint(row, 0), hint(row, 1), hint(column, 0), hint(column, 1)]) expect(message).not.toMatch(/\b1 (text |pattern )?characters/);
  });

  it('cell: the right cell passes; each wrong kind of cell gets its own feedback', () => {
    // Gate in the middle of row 2, after D[2][2] was written: the next cell is D[2][3].
    const q = find(trace, 'cell', (x) => x.cell[0] === 2 && x.cell[1] === 3);
    expect(judge(trace, q, { kind: 'cell', cell: [2, 3] }, 0).correct).toBe(true);
    const filled = judge(trace, q, { kind: 'cell', cell: [1, 1] }, 0);
    expect(filled.correct).toBe(false);
    expect(filled.message).toContain('already written');
    const ready = judge(trace, q, { kind: 'cell', cell: [3, 1] }, 0);
    expect(ready.message).toContain('could be computed right now');
    expect(ready.message).toContain('row by row');
    const missing = judge(trace, q, { kind: 'cell', cell: [3, 3] }, 0);
    expect(missing.message).toContain('cannot be computed yet');
    expect(missing.message).toContain('D[3][2] (left)');
    expect(missing.message).toContain('D[2][3] (up)');
    expect(missing.message).not.toContain('(diagonal)');
    const allMissing = judge(trace, q, { kind: 'cell', cell: [4, 4] }, 0);
    expect(allMissing.message).toContain('D[3][3] (diagonal)');
    const outside = judge(trace, q, { kind: 'cell', cell: [9, 9] }, 0);
    expect(outside.message).toContain('no D[9][9]');
    expect(judge(trace, q, { kind: 'cell', cell: [3, 1] }, 1).message).toContain('next cell is in row 2');
    expect(judge(trace, q, { kind: 'cell', cell: [3, 1] }, 0).message).not.toContain('next cell is in row 2');
  });

  it('cell: at the start of the table, the missing neighbour is named (left, then up)', () => {
    const q = find(trace, 'cell', (x) => x.cell[0] === 1 && x.cell[1] === 1);
    expect(judge(trace, q, { kind: 'cell', cell: [1, 2] }, 0).message).toContain('D[1][1] (left)');
    expect(judge(trace, q, { kind: 'cell', cell: [2, 1] }, 0).message).toContain('D[1][1] (up)');
  });

  it('move: every optimal parent is accepted, a tie names the tie-break, and a non-parent is explained', () => {
    const tie = run('ab', 'ba');
    let checked = 0;
    for (let i = 0; i < tie.frames.length; i += 1) {
      const q = questionAt(tie, i);
      if (q?.kind !== 'move') continue;
      for (const dir of DIRS) {
        const verdict = judge(tie, q, { kind: 'move', dir }, 0);
        expect(verdict.correct, `${q.cell} ${dir}`).toBe(q.accepted.includes(dir));
        if (verdict.correct && q.accepted.length > 1) expect(verdict.message).toContain('tie-break takes');
        if (!verdict.correct) expect(verdict.message.length).toBeGreaterThan(10);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
    expect(tie.frames.some((_f, i) => { const q = questionAt(tie, i); return q?.kind === 'move' && q.accepted.length > 1; })).toBe(true);
  });

  it('move: at the edges only one move exists, and the wrong choices say so', () => {
    const t = run('abc', '');
    const q = find(t, 'move');
    expect(judge(t, q, { kind: 'move', dir: 'up' }, 0).correct).toBe(true);
    const wrong = judge(t, q, { kind: 'move', dir: 'diag' }, 0);
    expect(wrong.message).toContain('only move is up');
    const ins = run('', 'ab');
    const qi = find(ins, 'move');
    expect(judge(ins, qi, { kind: 'move', dir: 'up' }, 0).message).toContain('only move is left');
  });

  it('move: a wrong choice shows the arithmetic, and the second hint lists all three', () => {
    const t = run('kitten', 'sitting');
    let tried = 0;
    for (let i = 0; i < t.frames.length; i += 1) {
      const q = questionAt(t, i);
      if (q?.kind !== 'move' || q.cell[0] === 0 || q.cell[1] === 0) continue;
      const wrongDir = DIRS.find((d: Dir) => !q.accepted.includes(d));
      if (!wrongDir) continue;
      const first = judge(t, q, { kind: 'move', dir: wrongDir }, 0).message;
      expect(first).toContain('does not explain');
      expect(judge(t, q, { kind: 'move', dir: wrongDir }, 1).message).toContain('Check all three');
      tried += 1;
    }
    expect(tried).toBeGreaterThan(3);
  });

  it('a guess of the wrong shape is refused without crashing', () => {
    const q = find(trace, 'value');
    expect(judge(trace, q, { kind: 'move', dir: 'diag' }, 0).correct).toBe(false);
    expect(judge(trace, q, { kind: 'cell', cell: [1, 1] }, 0).correct).toBe(false);
  });

  it('reveal says the answer, including ties for a move', () => {
    const cellQ = find(trace, 'cell', (x) => x.cell[0] === 2 && x.cell[1] === 2);
    expect(reveal(cellQ)).toContain('The next cell is D[2][2]');
    const valueQ = find(trace, 'value', (x) => x.cell[0] === 1 && x.cell[1] === 1);
    expect(reveal(valueQ)).toContain(`D[1][1] = ${valueQ.answer}`);
    const tie = run('ab', 'ba');
    const moveQ = find(tie, 'move', (x) => x.accepted.length > 1);
    expect(reveal(moveQ)).toContain('tie-break takes');
  });

  it('parseAnswer accepts whole numbers only and says what to type otherwise', () => {
    expect(parseAnswer(' 7 ')).toEqual({ ok: true, value: 7 });
    expect(parseAnswer('0')).toEqual({ ok: true, value: 0 });
    for (const bad of ['', 'x', '-1', '2.5', '1e2', '1000', '3 4']) {
      const r = parseAnswer(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.message).toContain('whole number');
    }
  });
});

describe('score keeping', () => {
  it('counts first-try answers, streaks, per-kind accuracy, shown answers as misses, and resets on retake', () => {
    let s = emptyQuiz;
    s = quizReducer(s, { type: 'correct', index: 4, kind: 'cell' });
    s = quizReducer(s, { type: 'correct', index: 9, kind: 'value' });
    expect(s.streak).toBe(2);
    s = quizReducer(s, { type: 'wrong', index: 12 });
    expect(s.streak).toBe(0);
    s = quizReducer(s, { type: 'wrong', index: 12 });
    s = quizReducer(s, { type: 'correct', index: 12, kind: 'value' });
    s = quizReducer(s, { type: 'shown', index: 15, kind: 'move' });
    s = quizReducer(s, { type: 'correct', index: 18, kind: 'base' });
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(score(s)).toEqual({
      answered: 5, firstTry: 3,
      byKind: { cell: { answered: 1, firstTry: 1 }, value: { answered: 2, firstTry: 1 }, base: { answered: 1, firstTry: 1 }, move: { answered: 1, firstTry: 0 } },
    });
    expect(quizReducer(s, { type: 'retake' })).toEqual(emptyQuiz);
  });

  it('an answered question is not counted twice', () => {
    let s = quizReducer(emptyQuiz, { type: 'correct', index: 3, kind: 'cell' });
    s = quizReducer(s, { type: 'correct', index: 3, kind: 'cell' });
    s = quizReducer(s, { type: 'wrong', index: 3 });
    s = quizReducer(s, { type: 'shown', index: 3, kind: 'cell' });
    expect(score(s).answered).toBe(1);
    expect(s.streak).toBe(1);
  });
});
