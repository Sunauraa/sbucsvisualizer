/**
 * Edit distance (Levenshtein) as a trace.
 *
 * Table D has (m+1) rows and (n+1) columns. D[i][j] is the cheapest way to turn the first i characters of the
 * pattern into the first j characters of the text, with unit cost for a substitution, an insertion and a
 * deletion, and cost 0 for keeping a matching character.
 *
 * Frame plan (the quiz in quiz.ts relies on it):
 *   setup, base cells (one frame each: D[0][0], D[0][1..n], D[1..m][0]), then for every inner cell in row-major
 *   order exactly TWO frames (look, then write), then trace-start, one frame per traceback move, done.
 */
import { defineAlgorithm, defineOps, definePseudocode, experimentFor, fail, ok } from '@core';
import type { AnchorOf, Finished, GrowthExperiment, OpOf, Recorder, Result } from '@core';

export interface EditInput {
  readonly pattern: string;
  readonly text: string;
}

/** The three neighbours a cell depends on. Tie-break order is exactly this order. */
export type Dir = 'diag' | 'left' | 'up';
export const DIRS: readonly Dir[] = ['diag', 'left', 'up'];
export type Cell = readonly [row: number, col: number];
export type OpKind = 'match' | 'substitute' | 'insert' | 'delete';

export interface EditOp {
  readonly kind: OpKind;
  /** 0-based position in the pattern, or null for an insertion. */
  readonly patternIndex: number | null;
  /** 0-based position in the text, or null for a deletion. */
  readonly textIndex: number | null;
  readonly patternChar: string | null;
  readonly textChar: string | null;
}

export interface EditResult {
  readonly distance: number;
  /** Forward order: applying them from the first to the last turns the pattern into the text. Matches are included. */
  readonly operations: readonly EditOp[];
}

export type StepKind = 'setup' | 'base' | 'look' | 'write' | 'trace-start' | 'trace-move' | 'done';

export interface Dependency {
  readonly dir: Dir;
  readonly cell: Cell;
}

export interface Candidate {
  readonly dir: Dir;
  /** The neighbour the candidate is built from. */
  readonly from: Cell;
  /** Cost of the move itself: 0 or 1 on the diagonal, always 1 left and up. */
  readonly cost: number;
  /** D[from] + cost. */
  readonly total: number;
}

export interface Move {
  readonly from: Cell;
  readonly to: Cell;
  readonly dir: Dir;
  readonly kind: OpKind;
  /** Every optimal parent of `from`, in tie-break order. `dir` is the first. */
  readonly optimal: readonly Dir[];
}

export interface AlignColumn {
  readonly kind: OpKind;
  readonly pattern: string | null;
  readonly text: string | null;
}

export interface EditState {
  /** Code points. */
  readonly pattern: readonly string[];
  readonly text: readonly string[];
  /** null = not written yet. */
  readonly table: readonly (readonly (number | null)[])[];
  /** All optimal parents of each written cell in tie-break order (first = chosen); null = not written yet. */
  readonly parents: readonly (readonly (readonly Dir[] | null)[])[];
  readonly step: { readonly kind: StepKind; readonly cell: Cell | null };
  /** The cell being looked at or written, or the traceback position. */
  readonly active: Cell | null;
  /** The three neighbours marked in look and write frames. */
  readonly deps: readonly Dependency[];
  /** 0-based indexes of the pattern and text characters being compared. */
  readonly comparing: { readonly pattern: number; readonly text: number } | null;
  /** Only in write frames: the three candidate totals. */
  readonly candidates: readonly Candidate[] | null;
  readonly minimum: number | null;
  /** True when at least two candidates reach the minimum. */
  readonly tie: boolean;
  readonly chosen: Dir | null;
  /** Traceback: cells visited so far, the position now, and the moves made (from the corner backwards). */
  readonly path: readonly Cell[];
  readonly position: Cell | null;
  readonly moves: readonly Move[];
  /** The end of the alignment found so far, in left-to-right order. */
  readonly alignment: readonly AlignColumn[];
  /** Only in the last frame: the whole edit script, forward. */
  readonly script: readonly EditOp[] | null;
}

// --- pure helpers (also used by the quiz and the view) ---------------------------------------------------------------

export const codePoints = (text: string): string[] => Array.from(text);

/** A character as a student sees it: spaces and control characters become visible. */
export function showChar(ch: string): string {
  if (ch === ' ') return '␣';
  if (ch === '\t') return '⇥';
  if (/^\p{C}$/u.test(ch)) return `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
  return ch;
}

export const cellName = (i: number, j: number): string => `D[${i}][${j}]`;
const quote = (ch: string): string => `‘${showChar(ch)}’`;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const DIR_NAME: Readonly<Record<Dir, string>> = { diag: 'diagonal', left: 'left', up: 'up' };
export const DIR_MARK: Readonly<Record<Dir, string>> = { diag: '↖', left: '←', up: '↑' };

/** The neighbour a move arrives from, as a cell. */
export const parentCell = (i: number, j: number, dir: Dir): Cell =>
  (dir === 'diag' ? [i - 1, j - 1] : dir === 'left' ? [i, j - 1] : [i - 1, j]);

export const moveKind = (dir: Dir, patternChar: string | undefined, textChar: string | undefined): OpKind =>
  (dir === 'diag' ? (patternChar === textChar ? 'match' : 'substitute') : dir === 'left' ? 'insert' : 'delete');

/** The three candidates for an inner cell (i >= 1, j >= 1), from the neighbours already in the table. */
export function candidatesAt(
  table: readonly (readonly (number | null)[])[], pattern: readonly string[], text: readonly string[], i: number, j: number,
): Candidate[] | null {
  const diag = table[i - 1]?.[j - 1];
  const left = table[i]?.[j - 1];
  const up = table[i - 1]?.[j];
  if (diag == null || left == null || up == null) return null;
  const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
  return [
    { dir: 'diag', from: [i - 1, j - 1], cost, total: diag + cost },
    { dir: 'left', from: [i, j - 1], cost: 1, total: left + 1 },
    { dir: 'up', from: [i - 1, j], cost: 1, total: up + 1 },
  ];
}

/** Optimal parents of a candidate set, in tie-break order. */
export const optimalOf = (candidates: readonly Candidate[]): Dir[] => {
  const best = Math.min(...candidates.map((c) => c.total));
  return candidates.filter((c) => c.total === best).map((c) => c.dir);
};

/** Parents of a base cell: the only way to get there. */
export const baseParents = (i: number, j: number): Dir[] => (i === 0 && j === 0 ? [] : i === 0 ? ['left'] : ['up']);

/** Applies a script to the pattern. Returns null when the script is inconsistent with the pattern. */
export function applyOperations(pattern: readonly string[], operations: readonly EditOp[]): string[] | null {
  const out: string[] = [];
  let p = 0;
  for (const op of operations) {
    if (op.kind === 'insert') {
      if (op.textChar === null) return null;
      out.push(op.textChar);
      continue;
    }
    const ch = pattern[p];
    if (ch === undefined || op.patternChar !== ch || op.patternIndex !== p) return null;
    p += 1;
    if (op.kind === 'match') {
      if (op.textChar !== ch) return null;
      out.push(ch);
    } else if (op.kind === 'substitute') {
      if (op.textChar === null || op.textChar === ch) return null;
      out.push(op.textChar);
    }
  }
  return p === pattern.length ? out : null;
}

export const operationsCost = (operations: readonly EditOp[]): number => operations.filter((op) => op.kind !== 'match').length;

export const MAX_CHARS = 12;

/** Parses the two fields. Characters are code points, so an emoji is one character. */
export function parseEditInput(pattern: string, text: string): Result<EditInput> {
  const checks = [['pattern', pattern], ['text', text]] as const;
  for (const [name, value] of checks) {
    const length = codePoints(value).length;
    if (length > MAX_CHARS) return fail(`The ${name} has ${length} characters; the limit here is ${MAX_CHARS}.`);
  }
  return ok({ pattern, text });
}

// --- the algorithm ---------------------------------------------------------------------------------------------------

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'edit-distance(P[1..m], T[1..n])'],
  ['base-row', 1, 'D[0][j] = j, for j = 0..n'],
  ['base-col', 1, 'D[i][0] = i, for i = 1..m'],
  ['loop', 1, 'for i = 1..m, for j = 1..n'],
  ['look', 2, 'c = 0 if P[i] = T[j], else 1'],
  ['write', 2, 'D[i][j] = min( D[i-1][j-1] + c,  # diagonal'],
  ['write-left', 2, '               D[i][j-1] + 1,  # left'],
  ['write-up', 2, '               D[i-1][j] + 1 ) # up'],
  ['tie', 2, 'tie: diagonal, then left, then up'],
  ['trace-start', 1, '(i, j) = (m, n)'],
  ['trace-step', 1, 'until (0, 0): move to the parent'],
  ['done', 1, 'return D[m][n] and the edits'],
]);

const OPS = defineOps([
  { id: 'cells', label: 'Cells written', counts: 'One each time a value is written into the table, base cells included: (m+1)(n+1) in total.' },
  { id: 'comparisons', label: 'Character comparisons', counts: 'One each time P[i] is compared with T[j] for an inner cell: m·n in total.' },
  { id: 'traceback-steps', label: 'Traceback steps', counts: 'One for each move from a cell to its parent while recovering the edits.' },
]);

type T = Recorder<EditState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const editDistance = defineAlgorithm({
  id: 'dp-edit-distance',
  title: 'Edit distance',
  summary: 'The cheapest sequence of substitutions, insertions and deletions that turns the pattern into the text.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case', bound: 'Θ(mn)', why: 'each of the (m+1)(n+1) cells takes a constant number of steps: three lookups and a minimum.' },
    { resource: 'time', when: 'traceback, every case', bound: 'Θ(m + n)', why: 'every move goes left, up or diagonally, so the path from the corner to D[0][0] has between max(m, n) and m + n steps.' },
    { resource: 'space', when: 'with traceback', bound: 'Θ(mn)', why: 'the whole table is kept, because the traceback follows parents from the bottom-right corner back to D[0][0].' },
    { resource: 'space', when: 'distance only, no traceback', bound: 'Θ(min(m, n))', why: 'row i needs only row i-1, so two rows as long as the shorter string are enough; the path cannot be recovered from them.' },
  ],
  presets: [
    { id: 'kitten-sitting', label: 'kitten → sitting (distance 3)', input: { pattern: 'kitten', text: 'sitting' } },
    { id: 'intention-execution', label: 'intention → execution (distance 5)', input: { pattern: 'intention', text: 'execution' } },
    { id: 'kit-si', label: 'kit → si (small)', input: { pattern: 'kit', text: 'si' } },
    { id: 'repeats', label: 'Repeated letters: aaa → aa', input: { pattern: 'aaa', text: 'aa' } },
    { id: 'ties', label: 'Ties in the table: ab → ba', input: { pattern: 'ab', text: 'ba' } },
    { id: 'equal', label: 'Equal strings: banana → banana', input: { pattern: 'banana', text: 'banana' } },
    { id: 'empty-pattern', label: 'Empty pattern: only insertions', input: { pattern: '', text: 'abc' } },
    { id: 'mismatch', label: 'Nothing in common: abc → xyz', input: { pattern: 'abc', text: 'xyz' } },
  ],
  execute({ pattern, text }: EditInput, t: T): Finished<EditResult> {
    const P = codePoints(pattern);
    const Q = codePoints(text);
    const m = P.length;
    const n = Q.length;
    const table: (number | null)[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => null));
    const parents: (Dir[] | null)[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => null));

    let step: EditState['step'] = { kind: 'setup', cell: null };
    let active: Cell | null = null;
    let deps: Dependency[] = [];
    let comparing: EditState['comparing'] = null;
    let candidates: Candidate[] | null = null;
    let minimum: number | null = null;
    let tie = false;
    let chosen: Dir | null = null;
    let path: Cell[] = [];
    let position: Cell | null = null;
    const moves: Move[] = [];
    let alignment: AlignColumn[] = [];
    let script: EditOp[] | null = null;

    const state = (): EditState => ({
      pattern: P, text: Q, table, parents, step, active, deps, comparing, candidates, minimum, tie, chosen,
      path, position, moves, alignment, script,
    });
    const at = (i: number, j: number): number => table[i]?.[j] ?? 0;
    const put = (i: number, j: number, value: number, optimal: Dir[]): void => {
      const row = table[i];
      const parentRow = parents[i];
      if (!row || !parentRow) throw new Error(`${cellName(i, j)} is outside the table`);
      row[j] = value;
      parentRow[j] = optimal;
    };

    t.step({
      lines: ['signature'],
      say: `Fill a table with ${plural(m + 1, 'row')} and ${plural(n + 1, 'column')}: row i stands for the first i pattern characters, column j for the first j text characters.`,
      state,
    });

    // Base cells: D[0][0], then the rest of row 0, then the rest of column 0.
    const writeBase = (i: number, j: number, value: number, anchor: 'base-row' | 'base-col', why: string): void => {
      put(i, j, value, baseParents(i, j));
      step = { kind: 'base', cell: [i, j] };
      active = [i, j];
      t.count('cells');
      t.event('write', [`cell:${i},${j}`], String(value));
      t.step({ lines: [anchor], say: () => `${cellName(i, j)} = ${value}: ${why}.`, state });
    };
    writeBase(0, 0, 0, 'base-row', 'the empty prefix already equals the empty prefix, so no edit is needed');
    for (let j = 1; j <= n; j += 1) {
      writeBase(0, j, j, 'base-row', `turning the empty pattern prefix into the first ${plural(j, 'text character')} takes ${plural(j, 'insertion')}`);
    }
    for (let i = 1; i <= m; i += 1) {
      writeBase(i, 0, i, 'base-col', `turning the first ${plural(i, 'pattern character')} into nothing takes ${plural(i, 'deletion')}`);
    }

    // Inner cells: look, then write.
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const pc = P[i - 1] ?? '';
        const tc = Q[j - 1] ?? '';
        step = { kind: 'look', cell: [i, j] };
        active = [i, j];
        deps = DIRS.map((dir) => ({ dir, cell: parentCell(i, j, dir) }));
        comparing = { pattern: i - 1, text: j - 1 };
        candidates = null;
        minimum = null;
        tie = false;
        chosen = null;
        t.count('comparisons');
        t.event('compare', [`pattern:${i - 1}`, `text:${j - 1}`]);
        t.step({
          lines: ['loop', 'look'],
          say: () => `Next cell is ${cellName(i, j)}: compare pattern character ${quote(pc)} (position ${i}) with text character ${quote(tc)} (position ${j}) and read the diagonal, left and up neighbours.`,
          state,
        });

        const found = candidatesAt(table, P, Q, i, j);
        if (found === null) throw new Error(`${cellName(i, j)} was reached before its neighbours were written`);
        candidates = found;
        const best = Math.min(...found.map((c) => c.total));
        const optimal = optimalOf(found);
        minimum = best;
        tie = optimal.length > 1;
        chosen = optimal[0] ?? 'diag';
        put(i, j, best, optimal);
        step = { kind: 'write', cell: [i, j] };
        t.count('cells');
        t.event('write', [`cell:${i},${j}`], String(best));
        const sums = found.map((c) => `${DIR_NAME[c.dir]} ${at(c.from[0], c.from[1])} + ${c.cost} = ${c.total}`).join(', ');
        const verdict = tie
          ? `${optimal.map((d) => DIR_NAME[d]).join(' and ')} tie at ${best} and the tie-break takes ${DIR_NAME[chosen]}`
          : `the smallest is ${best} (${DIR_NAME[chosen]})`;
        t.step({
          lines: tie ? ['write', 'write-left', 'write-up', 'tie'] : ['write', 'write-left', 'write-up'],
          say: () => `${cellName(i, j)}: ${sums}; ${verdict}, so ${cellName(i, j)} = ${best}.`,
          state,
        });
      }
    }

    // Traceback.
    deps = [];
    comparing = null;
    candidates = null;
    minimum = null;
    tie = false;
    chosen = null;
    const distance = at(m, n);
    position = [m, n];
    path = [[m, n]];
    active = [m, n];
    step = { kind: 'trace-start', cell: [m, n] };
    t.step({
      lines: ['trace-start'],
      say: `The distance is ${cellName(m, n)} = ${distance}; trace back from this corner to ${cellName(0, 0)} to recover the edits.`,
      state,
    });

    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      const optimal = parents[i]?.[j] ?? [];
      const dir: Dir = optimal[0] ?? 'up';
      const [ni, nj] = parentCell(i, j, dir);
      const pc = i > 0 ? P[i - 1] : undefined;
      const tc = j > 0 ? Q[j - 1] : undefined;
      const kind = moveKind(dir, pc, tc);
      const move: Move = { from: [i, j], to: [ni, nj], dir, kind, optimal };
      moves.push(move);
      path = [...path, [ni, nj]];
      position = [ni, nj];
      active = [ni, nj];
      alignment = [
        { kind, pattern: dir === 'left' ? null : (pc ?? null), text: dir === 'up' ? null : (tc ?? null) },
        ...alignment,
      ];
      step = { kind: 'trace-move', cell: [i, j] };
      chosen = dir;
      tie = optimal.length > 1;
      t.count('traceback-steps');
      t.event('select', [`cell:${ni},${nj}`], kind);
      const here = `${cellName(i, j)} = ${at(i, j)}`;
      const action = kind === 'match'
        ? `${here} equals ${cellName(ni, nj)} + 0 because ${quote(pc ?? '')} = ${quote(tc ?? '')}, so move diagonally and keep the character`
        : kind === 'substitute'
          ? `${here} equals ${cellName(ni, nj)} + 1, so move diagonally and substitute ${quote(pc ?? '')} by ${quote(tc ?? '')}`
          : kind === 'insert'
            ? `${here} equals ${cellName(ni, nj)} + 1, so move left and insert ${quote(tc ?? '')}`
            : `${here} equals ${cellName(ni, nj)} + 1, so move up and delete ${quote(pc ?? '')}`;
      const others = optimal.slice(1).map((d) => DIR_NAME[d]);
      const tieNote = others.length > 0
        ? ` (${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} also optimal, but the order diagonal, left, up picks ${DIR_NAME[dir]})`
        : '';
      t.step({ lines: ['trace-step', ...(others.length > 0 ? ['tie' as const] : [])], say: () => `${action}${tieNote}.`, state });
      i = ni;
      j = nj;
    }

    // The script, forward. Walking the moves backwards visits the edits from the start of the strings to the end.
    const operations: EditOp[] = [];
    for (let k = moves.length - 1; k >= 0; k -= 1) {
      const move = moves[k];
      if (!move) continue;
      const [fi, fj] = move.from;
      operations.push({
        kind: move.kind,
        patternIndex: move.dir === 'left' ? null : fi - 1,
        textIndex: move.dir === 'up' ? null : fj - 1,
        patternChar: move.dir === 'left' ? null : (P[fi - 1] ?? null),
        textChar: move.dir === 'up' ? null : (Q[fj - 1] ?? null),
      });
    }
    script = operations;
    step = { kind: 'done', cell: [0, 0] };
    const edits = operationsCost(operations);
    const kept = operations.length - edits;
    return t.finish({
      lines: ['done'],
      say: () => (edits === 0
        ? `The traceback is back at ${cellName(0, 0)} with no edits${kept > 0 ? ` (all ${plural(kept, 'character')} match)` : ''}, so the distance is ${distance}.`
        : `The traceback is back at ${cellName(0, 0)}: ${plural(edits, 'edit')} and ${plural(kept, 'kept character')}, so the distance is ${distance}, and the script below reads forward.`),
      state,
      result: { distance, operations },
    });
  },
});

// --- growth experiments ----------------------------------------------------------------------------------------------

const ALPHABET = 'abcd';

function randomString(length: number, next: (low: number, high: number) => number): string {
  return Array.from({ length }, () => ALPHABET.charAt(next(0, ALPHABET.length - 1))).join('');
}

function inputFor(m: number, n: number, caseId: string, int: (low: number, high: number) => number): EditInput {
  if (caseId === 'equal') {
    const same = randomString(m, int);
    return { pattern: same, text: n === m ? same : randomString(n, int) };
  }
  if (caseId === 'mismatch') return { pattern: 'a'.repeat(m), text: 'b'.repeat(n) };
  return { pattern: randomString(m, int), text: randomString(n, int) };
}

const CASES = (claimFn: 'n²' | 'n'): GrowthExperiment['cases'] => [
  { id: 'random', label: 'Random strings over four letters', claim: { symbol: 'Θ', fn: claimFn, when: 'every case' } },
  { id: 'equal', label: 'Equal strings (all matches)', claim: { symbol: 'Θ', fn: claimFn, when: 'every case' } },
  { id: 'mismatch', label: 'No character in common', claim: { symbol: 'Θ', fn: claimFn, when: 'every case' } },
];

export const experiments: readonly GrowthExperiment[] = [
  experimentFor(editDistance, {
    id: 'dp-edit-distance-square',
    title: 'Edit distance, |pattern| = |text| = n',
    sizeMeaning: 'length of each string',
    primaryOp: 'cells',
    sizes: [4, 8, 16, 32, 64, 128],
    cases: CASES('n²'),
    makeInput: (n, caseId, rng) => inputFor(n, n, caseId, rng.int),
  }),
  experimentFor(editDistance, {
    id: 'dp-edit-distance-fixed-pattern',
    title: 'Edit distance, |pattern| = 8, text of length n',
    sizeMeaning: 'length of the text (the pattern stays at 8)',
    primaryOp: 'cells',
    sizes: [8, 16, 32, 64, 128, 256],
    cases: CASES('n'),
    makeInput: (n, caseId, rng) => inputFor(8, n, caseId, rng.int),
  }),
];
