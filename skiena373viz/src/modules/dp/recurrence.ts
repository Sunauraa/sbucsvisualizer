/** What the recurrence panel says for one frame. Pure, so the quiz tests can look at exactly what a gated frame shows. */
import { candidatesAt, cellName, DIR_MARK, DIR_NAME, DIRS, showChar } from './algorithms/editDistance';
import type { Cell, Dir, EditState } from './algorithms/editDistance';

export interface RecurrenceRow {
  readonly dir: Dir;
  readonly name: string;
  readonly formula: string;
  /** '?' until the cell is written. */
  readonly total: string;
  readonly best: boolean;
}

export interface RecurrenceView {
  readonly title: string;
  /** Always null or exactly three rows, so the panel keeps its height. */
  readonly rows: readonly RecurrenceRow[] | null;
  readonly footer: string;
}

const quote = (ch: string | undefined): string => `‘${showChar(ch ?? '')}’`;

export const GENERAL_RECURRENCE = 'D[i][j] = min( D[i-1][j-1] + c,  D[i][j-1] + 1,  D[i-1][j] + 1 ),  c = 0 if P[i] = T[j], else 1';

const label = (dir: Dir): string => `${DIR_MARK[dir]} ${DIR_NAME[dir]}`;

/** Rows for an inner cell whose neighbours are written. `withTotals` false hides every sum. */
export function rowsFor(state: EditState, cell: Cell, withTotals: boolean, optimal: readonly Dir[]): RecurrenceRow[] | null {
  const [i, j] = cell;
  const found = candidatesAt(state.table, state.pattern, state.text, i, j);
  if (found === null) return null;
  return found.map((c) => {
    const from = state.table[c.from[0]]?.[c.from[1]] ?? 0;
    const diag = c.dir === 'diag';
    const formula = `${cellName(c.from[0], c.from[1])} + ${diag ? 'c' : '1'} = ${from} + ${withTotals || !diag ? c.cost : 'c'}`;
    return {
      dir: c.dir, name: label(c.dir), formula,
      total: withTotals ? String(c.total) : '?', best: withTotals && optimal.includes(c.dir),
    };
  });
}

/** The three candidates of any written inner cell, for the inspector and the traceback panel. */
export function candidateRows(state: EditState, cell: Cell): RecurrenceRow[] | null {
  const [i, j] = cell;
  if (i === 0 || j === 0) return null;
  return rowsFor(state, cell, true, state.parents[i]?.[j] ?? []);
}

export function recurrenceView(state: EditState): RecurrenceView {
  const { step } = state;
  const cell = step.cell;
  switch (step.kind) {
    case 'setup':
      return { title: 'The recurrence', rows: null, footer: 'Row 0 and column 0 are filled first. Every other cell is the smallest of three candidates, one from each neighbour.' };
    case 'base': {
      const [i, j] = cell ?? [0, 0];
      const why = i === 0 && j === 0 ? 'no edits are needed between two empty prefixes'
        : i === 0 ? `${j} text character${j === 1 ? '' : 's'} must be inserted into the empty pattern prefix`
          : `${i} pattern character${i === 1 ? '' : 's'} must be deleted to reach the empty text prefix`;
      return { title: `${cellName(i, j)} is a base cell`, rows: null, footer: `Base cells need no recurrence: ${why}.` };
    }
    case 'look': {
      const [i, j] = cell ?? [1, 1];
      return {
        title: `${cellName(i, j)}: compare P[${i}] = ${quote(state.pattern[i - 1])} with T[${j}] = ${quote(state.text[j - 1])}`,
        rows: rowsFor(state, [i, j], false, []),
        footer: 'Work out each total, then the cell takes the smallest one.',
      };
    }
    case 'write': {
      const [i, j] = cell ?? [1, 1];
      const optimal = state.parents[i]?.[j] ?? [];
      const value = state.table[i]?.[j];
      return {
        title: `${cellName(i, j)}: compare P[${i}] = ${quote(state.pattern[i - 1])} with T[${j}] = ${quote(state.text[j - 1])}`,
        rows: rowsFor(state, [i, j], true, optimal),
        footer: `${cellName(i, j)} = ${value ?? '?'}. ${optimal.length > 1
          ? `${optimal.map((d) => DIR_NAME[d]).join(' and ')} tie; the tie-break takes ${DIR_NAME[optimal[0] ?? 'diag']}.`
          : `Its parent is the ${DIR_NAME[optimal[0] ?? 'diag']} neighbour.`}`,
      };
    }
    case 'trace-start':
      return {
        title: 'Traceback', rows: null,
        footer: 'From the bottom-right cell, each step moves to a parent: a neighbour whose total equals the cell. Ties go diagonal, then left, then up.',
      };
    case 'trace-move': {
      const [i, j] = cell ?? [0, 0];
      const move = state.moves[state.moves.length - 1];
      const rows = candidateRows(state, [i, j]);
      return {
        title: `Why ${cellName(i, j)} = ${state.table[i]?.[j] ?? '?'} moved ${move ? DIR_NAME[move.dir] : ''}`,
        rows,
        footer: rows === null
          ? (i === 0 ? 'Row 0 has no pattern characters left, so the only move is left.' : 'Column 0 has no text characters left, so the only move is up.')
          : `A move is a parent when its total equals ${cellName(i, j)} = ${state.table[i]?.[j] ?? '?'}.`,
      };
    }
    case 'done':
      return { title: 'Traceback finished', rows: null, footer: 'The alignment and the script below were read from the path of parents, forward from D[0][0].' };
  }
}

export const ROW_ORDER = DIRS;
