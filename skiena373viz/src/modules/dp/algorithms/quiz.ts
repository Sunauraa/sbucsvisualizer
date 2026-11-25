/**
 * Quiz logic, pure. A question is derived from two neighbouring frames of a finished trace: the frame where the player
 * stops (index) and the frame that holds the answer (index + 1). Nothing here is shown to the learner until they
 * answer, and nothing in a frame's state contains the answer to the question asked at that frame.
 */
import { createRng, fail, ok } from '@core';
import type { Result, Trace } from '@core';
import { candidatesAt, cellName, DIR_NAME, showChar } from './editDistance';
import type { Cell, Dir, EditResult, EditState } from './editDistance';

export type QuestionKind = 'cell' | 'value' | 'base' | 'move';
export const KIND_LABEL: Readonly<Record<QuestionKind, string>> = {
  cell: 'Which cell is written next', value: 'What value is written', base: 'Base cell value', move: 'Traceback move',
};

interface QuestionBase {
  /** The gated frame: the player stops here and the question is open. */
  readonly index: number;
  readonly prompt: string;
  /** The sentence of the frame that holds the answer; shown only once the question is answered or revealed. */
  readonly why: string;
}

export type Question =
  /** `cell` is the answer: the cell that is written next. */
  | (QuestionBase & { readonly kind: 'cell'; readonly cell: Cell })
  /** `cell` is the cell asked about; `answer` its value. */
  | (QuestionBase & { readonly kind: 'value' | 'base'; readonly cell: Cell; readonly answer: number })
  /** `cell` is the traceback position; every optimal parent is accepted, `followed` is what the tie-break takes. */
  | (QuestionBase & { readonly kind: 'move'; readonly cell: Cell; readonly accepted: readonly Dir[]; readonly followed: Dir });

export type EditTrace = Trace<EditState, EditResult>;

const valueAt = (state: EditState, [i, j]: Cell): number | null => state.table[i]?.[j] ?? null;

/**
 * The question asked while the player is held at frame `index`, read from frame `index + 1`. Null where the next frame
 * is not something a learner could predict (the traceback start, the last frame), and in a truncated trace.
 */
export function questionAt(trace: EditTrace, index: number): Question | null {
  if (trace.truncated) return null;
  const here = trace.frames[index];
  const next = trace.frames[index + 1];
  const cell = next?.state.step.cell;
  if (!here || !next || !cell) return null;
  const [i, j] = cell;
  const why = next.explanation;
  switch (next.state.step.kind) {
    case 'base': {
      const answer = valueAt(next.state, cell);
      if (answer === null) return null;
      return { kind: 'base', index, cell, answer, why, prompt: `What is ${cellName(i, j)}, and why?` };
    }
    case 'look': {
      if (here.state.step.kind !== 'base' && here.state.step.kind !== 'write') return null;
      return { kind: 'cell', index, cell, why: `${cellName(i, j)} is next: the table is filled row by row, left to right, and its three neighbours are already written.`,
        prompt: 'Which cell is written next?' };
    }
    case 'write': {
      if (here.state.step.kind !== 'look') return null;
      const answer = valueAt(next.state, cell);
      if (answer === null) return null;
      return { kind: 'value', index, cell, answer, why, prompt: `What value is written into ${cellName(i, j)}?` };
    }
    case 'trace-move': {
      const move = next.state.moves[next.state.moves.length - 1];
      if (!move || here.state.position?.[0] !== i || here.state.position?.[1] !== j) return null;
      const now = valueAt(here.state, cell);
      return {
        kind: 'move', index, cell, accepted: move.optimal, followed: move.dir, why,
        prompt: `The traceback is at ${cellName(i, j)}${now === null ? '' : ` = ${now}`}. Which move comes next?`,
      };
    }
    default:
      return null;
  }
}

export interface QuizSettings {
  /** Ask about every k-th cell, k >= 1. */
  readonly every: number;
  readonly seed: number;
}

export const DEFAULT_SETTINGS: QuizSettings = { every: 3, seed: 1 };

/** Frame indexes where the player stops. Deterministic for a trace and settings; every one has a question. */
export function quizGates(trace: EditTrace, settings: QuizSettings): readonly number[] {
  if (trace.truncated) return [];
  const every = Math.max(1, Math.round(settings.every));
  const gates: number[] = [];
  let base = 0;
  let inner = 0;
  let moves = 0;
  trace.frames.forEach((frame, f) => {
    const { kind, cell } = frame.state.step;
    if (kind === 'base' && !(cell?.[0] === 0 && cell?.[1] === 0)) {
      if (base % every === 0) gates.push(f - 1);
      base += 1;
    } else if (kind === 'look') {
      if (inner % every === 0) {
        // The same cell is asked in one of two ways, chosen from the seed and the cell's position.
        const asCell = createRng(settings.seed * 7919 + inner).next() < 0.5;
        gates.push(asCell ? f - 1 : f);
      }
      inner += 1;
    } else if (kind === 'trace-move') {
      if (moves % every === 0) gates.push(f - 1);
      moves += 1;
    }
  });
  return gates.filter((g) => questionAt(trace, g) !== null);
}

// --- answers and feedback --------------------------------------------------------------------------------------------

export type Guess =
  | { readonly kind: 'cell'; readonly cell: Cell }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'move'; readonly dir: Dir };

export interface Verdict {
  readonly correct: boolean;
  readonly message: string;
}

/** A typed number. A bad entry is not a wrong answer: it costs nothing and says what to type. */
export function parseAnswer(text: string): Result<number> {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return fail('Type a whole number from 0 up, such as 4.');
  return ok(Number(trimmed));
}

const tone = (wrongBefore: number): 'first' | 'second' => (wrongBefore === 0 ? 'first' : 'second');

/**
 * Judges a guess. `wrongBefore` is how many wrong answers this question has had already: the first miss gets the first
 * hint, later misses the second.
 */
export function judge(trace: EditTrace, question: Question, guess: Guess, wrongBefore: number): Verdict {
  const frame = trace.frames[question.index];
  if (!frame) return { correct: false, message: 'This question no longer matches the trace.' };
  const state = frame.state;
  const level = tone(wrongBefore);

  if (question.kind === 'cell' && guess.kind === 'cell') return judgeCell(state, question, guess.cell, level);
  if ((question.kind === 'value' || question.kind === 'base') && guess.kind === 'number') {
    if (guess.value === question.answer) return { correct: true, message: `Correct: ${question.why}` };
    return { correct: false, message: question.kind === 'value' ? valueHint(state, question.cell, guess.value, level) : baseHint(question.cell, guess.value, level) };
  }
  if (question.kind === 'move' && guess.kind === 'move') return judgeMove(state, question, guess.dir, level);
  return { correct: false, message: 'That answer does not fit this question.' };
}

/** What "Show me" says. */
export function reveal(question: Question): string {
  switch (question.kind) {
    case 'cell':
      return `The next cell is ${cellName(question.cell[0], question.cell[1])}. ${question.why}`;
    case 'value':
    case 'base':
      return question.why;
    case 'move':
      return `${question.why} ${tieNote(question)}`.trim();
  }
}

function tieNote(question: Extract<Question, { kind: 'move' }>): string {
  return question.accepted.length > 1
    ? `${question.accepted.map((d) => DIR_NAME[d]).join(' and ')} are all optimal here; the tie-break takes ${DIR_NAME[question.followed]}.`
    : '';
}

function judgeCell(state: EditState, question: Extract<Question, { kind: 'cell' }>, guess: Cell, level: 'first' | 'second'): Verdict {
  const [gi, gj] = guess;
  const [ai, aj] = question.cell;
  if (gi === ai && gj === aj) return { correct: true, message: `Correct: ${question.why}` };
  const rows = state.table.length - 1;
  const cols = (state.table[0]?.length ?? 1) - 1;
  const name = cellName(gi, gj);
  let message: string;
  const held = valueAt(state, guess);
  if (gi < 0 || gj < 0 || gi > rows || gj > cols) {
    message = `There is no ${name}: rows run from 0 to ${rows} and columns from 0 to ${cols}.`;
  } else if (held !== null) {
    message = `${name} is already written (it holds ${held}). The next cell is still empty.`;
  } else if (gi === 0 || gj === 0) {
    message = `${name} is a base cell, and every base cell is written before any inner cell.`;
  } else {
    const missing = ([['diagonal', gi - 1, gj - 1], ['left', gi, gj - 1], ['up', gi - 1, gj]] as const)
      .filter(([, r, c]) => valueAt(state, [r, c]) === null)
      .map(([label, r, c]) => `${cellName(r, c)} (${label})`);
    message = missing.length === 0
      ? `${name} could be computed right now, because its diagonal, left and up neighbours are all written; but this pseudocode goes row by row, left to right, so another cell comes first.`
      : `${name} cannot be computed yet: it needs ${missing.join(' and ')}, which ${missing.length === 1 ? 'is' : 'are'} still empty.`;
  }
  if (level === 'second') message += ` The pseudocode fills one row at a time from left to right, and the next cell is in row ${ai}.`;
  return { correct: false, message };
}

function neighbours(state: EditState, [i, j]: Cell): { diag: number; left: number; up: number; pc: string; tc: string; cost: number } | null {
  const diag = valueAt(state, [i - 1, j - 1]);
  const left = valueAt(state, [i, j - 1]);
  const up = valueAt(state, [i - 1, j]);
  const pc = state.pattern[i - 1];
  const tc = state.text[j - 1];
  if (diag === null || left === null || up === null || pc === undefined || tc === undefined) return null;
  return { diag, left, up, pc, tc, cost: pc === tc ? 0 : 1 };
}

function valueHint(state: EditState, cell: Cell, guess: number, level: 'first' | 'second'): string {
  const [i, j] = cell;
  const n = neighbours(state, cell);
  if (n === null) return 'Not quite.';
  const q = (ch: string): string => `‘${showChar(ch)}’`;
  const totals = [n.diag + n.cost, n.left + 1, n.up + 1];
  const best = Math.min(...totals);
  const recurrence = `D[i][j] = min(D[i-1][j-1] + c, D[i][j-1] + 1, D[i-1][j] + 1), where c is 0 when the two characters are equal and 1 when they differ`;
  const numbers = `Here i = ${i} and j = ${j}: the characters are ${q(n.pc)} and ${q(n.tc)}, D[${i - 1}][${j - 1}] = ${n.diag} (diagonal), D[${i}][${j - 1}] = ${n.left} (left) and D[${i - 1}][${j}] = ${n.up} (up)`;
  const first = `${guess} is not right. Use ${recurrence}. ${numbers}.`;
  if (level === 'first') return first;
  const named = ([['diagonal', totals[0] ?? 0], ['left', totals[1] ?? 0], ['up', totals[2] ?? 0]] as const)
    .filter(([, total]) => total === guess && total !== best).map(([label]) => label);
  const slip = named.length > 0 ? ` ${guess} is the ${named.join(' and ')} candidate, but a smaller candidate exists.` : '';
  const wrongC = guess === n.diag + (1 - n.cost) ? ` Check c: ${q(n.pc)} and ${q(n.tc)} ${n.cost === 0 ? 'are equal, so c = 0' : 'differ, so c = 1'}.` : '';
  return `Still not it. The three candidates are diagonal ${n.diag} + ${n.cost} = ${totals[0]}, left ${n.left} + 1 = ${totals[1]}, up ${n.up} + 1 = ${totals[2]}; the cell takes the smallest.${slip}${wrongC}`;
}

function baseHint(cell: Cell, guess: number, level: 'first' | 'second'): string {
  const [i, j] = cell;
  if (i === 0 && j === 0) return `${guess} is not right. Turning the empty prefix into the empty prefix needs no edits at all.`;
  const row = i === 0;
  const first = row
    ? `${guess} is not right. ${cellName(i, j)} is the cost of turning the empty pattern prefix into the first ${j} text characters.`
    : `${guess} is not right. ${cellName(i, j)} is the cost of turning the first ${i} pattern characters into the empty string.`;
  if (level === 'first') return first;
  return row
    ? `${first} With nothing to match, every one of those ${j} characters has to be inserted, and an insertion costs 1.`
    : `${first} With nothing to match, every one of those ${i} characters has to be deleted, and a deletion costs 1.`;
}

function judgeMove(state: EditState, question: Extract<Question, { kind: 'move' }>, guess: Dir, level: 'first' | 'second'): Verdict {
  if (question.accepted.includes(guess)) {
    const extra = tieNote(question);
    return { correct: true, message: `Correct: ${question.why}${extra === '' ? '' : ` ${extra}`}` };
  }
  const [i, j] = question.cell;
  const here = valueAt(state, question.cell) ?? 0;
  let message: string;
  if ((i === 0 && guess !== 'left') || (j === 0 && guess !== 'up')) {
    message = i === 0
      ? `In row 0 no pattern characters are left, so the only move is left (insert a text character).`
      : `In column 0 no text characters are left, so the only move is up (delete a pattern character).`;
  } else {
    const found = candidatesAt(state.table, state.pattern, state.text, i, j);
    const mine = found?.find((c) => c.dir === guess);
    message = mine
      ? `Moving ${DIR_NAME[guess]} comes from ${cellName(mine.from[0], mine.from[1])} = ${mine.total - mine.cost}; ${mine.total - mine.cost} + ${mine.cost} = ${mine.total}, but ${cellName(i, j)} = ${here}, so that move does not explain this cell.`
      : `That move does not explain ${cellName(i, j)} = ${here}.`;
    if (level === 'second' && found) {
      message += ` Check all three: ${found.map((c) => `${DIR_NAME[c.dir]} ${c.total - c.cost} + ${c.cost} = ${c.total}`).join(', ')}; a move is optimal when its total equals ${here}.`;
    }
  }
  return { correct: false, message };
}

// --- score keeping ---------------------------------------------------------------------------------------------------

export interface Outcome {
  readonly kind: QuestionKind;
  /** Wrong answers given before this question was resolved. */
  readonly wrong: number;
  /** True when the learner pressed "Show me". */
  readonly shown: boolean;
}

export interface QuizState {
  /** Resolved questions by gate index. */
  readonly outcomes: Readonly<Record<number, Outcome>>;
  /** Wrong answers so far for the question that is still open, by gate index. */
  readonly open: Readonly<Record<number, number>>;
  readonly streak: number;
  readonly bestStreak: number;
}

export const emptyQuiz: QuizState = { outcomes: {}, open: {}, streak: 0, bestStreak: 0 };

export type QuizAction =
  | { readonly type: 'wrong'; readonly index: number }
  | { readonly type: 'correct'; readonly index: number; readonly kind: QuestionKind }
  | { readonly type: 'shown'; readonly index: number; readonly kind: QuestionKind }
  | { readonly type: 'retake' };

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'wrong':
      if (state.outcomes[action.index]) return state;
      return { ...state, open: { ...state.open, [action.index]: (state.open[action.index] ?? 0) + 1 }, streak: 0 };
    case 'correct':
    case 'shown': {
      if (state.outcomes[action.index]) return state;
      const wrong = state.open[action.index] ?? 0;
      const shown = action.type === 'shown';
      const firstTry = !shown && wrong === 0;
      const streak = firstTry ? state.streak + 1 : 0;
      return {
        outcomes: { ...state.outcomes, [action.index]: { kind: action.kind, wrong, shown } },
        open: state.open,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      };
    }
    case 'retake':
      return emptyQuiz;
  }
}

export interface KindScore {
  readonly answered: number;
  readonly firstTry: number;
}

export interface Score {
  readonly answered: number;
  readonly firstTry: number;
  readonly byKind: Readonly<Record<QuestionKind, KindScore>>;
}

export function score(state: QuizState): Score {
  const byKind: Record<QuestionKind, { answered: number; firstTry: number }> = {
    cell: { answered: 0, firstTry: 0 }, value: { answered: 0, firstTry: 0 }, base: { answered: 0, firstTry: 0 }, move: { answered: 0, firstTry: 0 },
  };
  let answered = 0;
  let firstTry = 0;
  for (const outcome of Object.values(state.outcomes)) {
    const good = !outcome.shown && outcome.wrong === 0;
    byKind[outcome.kind].answered += 1;
    if (good) byKind[outcome.kind].firstTry += 1;
    answered += 1;
    if (good) firstTry += 1;
  }
  return { answered, firstTry, byKind };
}
