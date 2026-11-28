/** The stage: strings, table with arrows, recurrence, alignment and script. A pure function of one frame. */
import { createContext, useContext } from 'react';
import { TONES } from '@core';
import type { Tone } from '@core';
import { CellGrid, CellRow } from '@ui';
import type { CellSpec, GridArrow, RendererProps } from '@ui';
import { DIR_MARK, showChar } from './algorithms/editDistance';
import type { AlignColumn, Cell, EditOp, EditResult, EditState, OpKind } from './algorithms/editDistance';
import styles from './dp.module.css';
import { GENERAL_RECURRENCE, recurrenceView } from './recurrence';

/** How the page wants cells to behave. The stage itself never decides what a click means. */
export interface StageActions {
  /** Undefined: the table is not clickable (a question that is not about a cell, or no cell to inspect). */
  readonly onCell?: (row: number, col: number) => void;
  /** A cell the learner picked to inspect; highlighted with its parents. */
  readonly selected: Cell | null;
  /**
   * Quiz mode is on. It only changes which parent marks are hidden while a traceback question may be open, so the stage never shows the
   * answer; the default is the cautious one.
   */
  readonly quizOn: boolean;
}

export const StageContext = createContext<StageActions>({ selected: null, quizOn: true });

const same = (a: Cell | null | undefined, r: number, c: number): boolean => a !== null && a !== undefined && a[0] === r && a[1] === c;

/**
 * Parent marks show on every written inner cell, in every frame. The one exception is quiz mode during the traceback: a "which parent
 * does the traceback follow?" question is open there, so only cells the traceback has already left show marks. At `done` no question
 * is asked any more, so every written cell shows its marks again.
 */
export function marksVisible(state: EditState, r: number, c: number, quizOn: boolean): boolean {
  if (r === 0 || c === 0 || state.table[r]?.[c] == null) return false;
  if (!quizOn) return true;
  switch (state.step.kind) {
    case 'trace-start':
      return false;
    case 'trace-move':
      return state.moves.some((move) => same(move.from, r, c));
    default:
      return true;
  }
}

export function cellText(state: EditState, r: number, c: number, quizOn: boolean): string {
  const value = state.table[r]?.[c];
  if (value === null || value === undefined) return '';
  const marks = marksVisible(state, r, c, quizOn) ? (state.parents[r]?.[c] ?? []).map((d) => DIR_MARK[d]).join('') : '';
  return `${value}${marks}`;
}

export function cellTone(state: EditState, r: number, c: number, selected: Cell | null): Tone {
  const { kind } = state.step;
  if (kind === 'look' || kind === 'write' || kind === 'base') {
    if (same(state.active, r, c)) return 'active';
    if (kind === 'write') {
      const dep = state.deps.find((d) => same(d.cell, r, c));
      if (dep) return (state.parents[state.active?.[0] ?? 0]?.[state.active?.[1] ?? 0] ?? []).includes(dep.dir) ? 'target' : 'compare';
    }
    if (kind === 'look' && state.deps.some((d) => same(d.cell, r, c))) return 'compare';
  } else if (kind === 'trace-start' || kind === 'trace-move' || kind === 'done') {
    if (kind !== 'done' && same(state.position, r, c)) return 'active';
    if (state.path.some((p) => same(p, r, c))) return 'done';
  }
  return same(selected, r, c) ? 'target' : 'idle';
}

export function stageArrows(state: EditState, selected: Cell | null): GridArrow[] {
  const arrows: GridArrow[] = [];
  const { step, active } = state;
  if (step.kind === 'look' && active) {
    for (const dep of state.deps) arrows.push({ from: dep.cell, to: active, tone: 'compare' });
  } else if (step.kind === 'write' && active) {
    const best = state.parents[active[0]]?.[active[1]] ?? [];
    for (const c of state.candidates ?? []) {
      arrows.push({ from: c.from, to: active, tone: best.includes(c.dir) ? 'target' : 'compare' });
    }
  } else if (step.kind === 'trace-start' || step.kind === 'trace-move' || step.kind === 'done') {
    for (const move of state.moves) arrows.push({ from: move.from, to: move.to, tone: step.kind === 'done' ? 'done' : 'target' });
  }
  if (selected && (step.kind === 'setup' || step.kind === 'base' || step.kind === 'look' || step.kind === 'write')) {
    const [r, c] = selected;
    if (r > 0 && c > 0 && state.table[r]?.[c] != null && !same(active, r, c)) {
      for (const dir of state.parents[r]?.[c] ?? []) {
        const from: Cell = dir === 'diag' ? [r - 1, c - 1] : dir === 'left' ? [r, c - 1] : [r - 1, c];
        arrows.push({ from, to: [r, c], tone: 'target' });
      }
    }
  }
  return arrows;
}

const headerText = (index: number, ch: string | undefined): string => (index === 0 ? '0 ε' : `${index} ${showChar(ch ?? '')}`);

export function EditStage({ frame }: RendererProps<EditState>) {
  const state = frame.state;
  const { selected, onCell, quizOn } = useContext(StageContext);
  const m = state.pattern.length;
  const n = state.text.length;
  const compact = Math.max(m, n) > 8;
  const chars = (list: readonly string[], comparing: number | null): CellSpec[] =>
    list.map((ch, k) => ({ text: showChar(ch), tone: k === comparing ? 'compare' : 'idle' }));
  return (
    <div className={styles['stageStack']}>
      <div className={styles['strings']}>
        <p className={styles['label']}>Pattern: the rows (what we start from)</p>
        <CellRow title={`Pattern, ${m} characters`} cells={chars(state.pattern, state.comparing?.pattern ?? null)} firstIndex={1}
          cellWidth={38} emptyText="the pattern is empty" />
        <p className={styles['label']}>Text: the columns (what we want)</p>
        <CellRow title={`Text, ${n} characters`} cells={chars(state.text, state.comparing?.text ?? null)} firstIndex={1}
          cellWidth={38} emptyText="the text is empty" />
      </div>
      <CellGrid
        title={`Edit distance table: ${m + 1} rows for pattern prefixes by ${n + 1} columns for text prefixes`}
        rows={m + 1} cols={n + 1} cellSize={compact ? 42 : 48}
        rowHeader={(r) => headerText(r, state.pattern[r - 1])} colHeader={(c) => headerText(c, state.text[c - 1])}
        cell={(r, c): CellSpec => ({ text: cellText(state, r, c, quizOn), tone: cellTone(state, r, c, selected) })}
        arrows={stageArrows(state, selected)}
        {...(onCell ? { onCell } : {})}
      />
      <div className={styles['vh']}>
      <table>
        <caption>{`Edit distance table, ${m + 1} rows by ${n + 1} columns, as of this step. Cells not written yet are empty.`}</caption>
        <thead>
          <tr><th scope="col">Pattern prefix</th>{Array.from({ length: n + 1 }, (_c, c) => <th key={c} scope="col">{c === 0 ? 'empty text' : `text up to ${showChar(state.text[c - 1] ?? '')}`}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: m + 1 }, (_r, r) => (
            <tr key={r}>
              <th scope="row">{r === 0 ? 'empty pattern' : `pattern up to ${showChar(state.pattern[r - 1] ?? '')}`}</th>
              {Array.from({ length: n + 1 }, (_c, c) => <td key={c} data-cell={`${r},${c}`}>{cellText(state, r, c, quizOn) || 'empty'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/** Below the player: the recurrence with the current numbers, the alignment strip and the edit script. */
export function EditDetails({ frame }: RendererProps<EditState>) {
  return (
    <div className={styles['stageStack']}>
      <Recurrence state={frame.state} />
      <Alignment state={frame.state} />
      <Script script={frame.state.script} />
    </div>
  );
}

function Recurrence({ state }: { readonly state: EditState }) {
  const view = recurrenceView(state);
  const slots = view.rows ?? [null, null, null];
  return (
    <section className={styles['recurrence']} aria-label="Recurrence with the current numbers">
      <p className={styles['recGeneral']}>{GENERAL_RECURRENCE}</p>
      <p className={styles['recTitle']}>{view.title}</p>
      <table className={`${styles['recTable']} ${view.rows === null ? styles['recEmpty'] : ''}`} aria-hidden={view.rows === null ? true : undefined}>
        <tbody>
          {slots.map((row, k) => (
            <tr key={row?.dir ?? k} className={row?.best ? styles['best'] : undefined}>
              <th scope="row">{row ? row.name : '\u00a0'}</th>
              <td>{row ? row.formula : ''}</td>
              <td className={styles['num']}>{row ? `${row.best ? '◎ ' : ''}${row.total}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles['recFooter']}>{view.footer}</p>
    </section>
  );
}

const KIND_WORD: Readonly<Record<OpKind, string>> = { match: 'keep', substitute: 'sub', insert: 'ins', delete: 'del' };
const KIND_TONE: Readonly<Record<OpKind, Tone>> = { match: 'done', substitute: 'swap', insert: 'target', delete: 'compare' };
const KIND_BORDER: Readonly<Record<OpKind, string>> = { match: 'solid', substitute: 'solid', insert: 'dashed', delete: 'dotted' };

function Alignment({ state }: { readonly state: EditState }) {
  const columns: readonly (AlignColumn | null)[] = state.step.kind === 'done' ? state.alignment : [null, ...state.alignment];
  const finished = state.step.kind === 'done';
  const gap = <span className={styles['gap']} aria-label="gap">–</span>;
  const description = columns.length === 1 && columns[0] === null
    ? 'The alignment appears during the traceback.'
    : `Alignment ${finished ? '' : 'so far, from the right end '}in ${state.alignment.length} columns: ${state.alignment.map((c) => `${KIND_WORD[c.kind]} ${c.pattern === null ? 'gap' : showChar(c.pattern)} over ${c.text === null ? 'gap' : showChar(c.text)}`).join(', ')}.`;
  return (
    <section className={styles['align']} aria-label="Alignment">
      <p className={styles['label']}>Alignment (pattern over text){finished ? '' : ', built from the right end during the traceback'}</p>
      <div className={styles['alignScroll']}>
        <table className={styles['alignTable']} aria-label={description}>
          <tbody>
            <tr>
              <th scope="row">Pattern</th>
              {columns.map((col, k) => <td key={k} className={col ? undefined : styles['unknown']} style={col ? { borderColor: TONES[KIND_TONE[col.kind]].color, borderStyle: KIND_BORDER[col.kind] } : undefined}>{col ? (col.pattern === null ? gap : showChar(col.pattern)) : '…'}</td>)}
            </tr>
            <tr>
              <th scope="row">Edit</th>
              {columns.map((col, k) => <td key={k} className={`${styles['word']} ${col ? '' : styles['unknown']}`} style={col ? { borderColor: TONES[KIND_TONE[col.kind]].color, borderStyle: KIND_BORDER[col.kind], color: TONES[KIND_TONE[col.kind]].ink } : undefined}>{col ? KIND_WORD[col.kind] : '…'}</td>)}
            </tr>
            <tr>
              <th scope="row">Text</th>
              {columns.map((col, k) => <td key={k} className={col ? undefined : styles['unknown']} style={col ? { borderColor: TONES[KIND_TONE[col.kind]].color, borderStyle: KIND_BORDER[col.kind] } : undefined}>{col ? (col.text === null ? gap : showChar(col.text)) : '…'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function describeOp(op: EditOp): string {
  const p = op.patternChar === null ? '' : `‘${showChar(op.patternChar)}’`;
  const t = op.textChar === null ? '' : `‘${showChar(op.textChar)}’`;
  switch (op.kind) {
    case 'match': return `keep ${p}`;
    case 'substitute': return `replace ${p} by ${t}`;
    case 'insert': return `insert ${t}`;
    case 'delete': return `delete ${p}`;
  }
}

function Script({ script }: { readonly script: EditResult['operations'] | null }) {
  const edits = script?.filter((op) => op.kind !== 'match') ?? [];
  return (
    <section className={styles['script']} aria-label="Edit script">
      <p className={styles['label']}>Edit script, from the start of the pattern</p>
      {script === null ? <p>The script appears at the end of the traceback.</p>
        : script.length === 0 ? <p>Both strings are empty, so there is nothing to edit.</p>
          : (
            <>
              <ol>
                {script.map((op, k) => <li key={k}>{describeOp(op)}</li>)}
              </ol>
              <p>{edits.length === 0 ? 'The strings are equal: every character is kept.' : `${edits.length} edit${edits.length === 1 ? '' : 's'} in total; kept characters cost 0.`}</p>
            </>
          )}
    </section>
  );
}

