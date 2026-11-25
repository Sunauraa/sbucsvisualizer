/** Click or focus a filled cell (when the quiz is off): where its value came from, in words. */
import { useState } from 'react';
import { Field } from '@ui';
import { cellName, DIR_NAME, showChar } from './algorithms/editDistance';
import type { Cell, EditState } from './algorithms/editDistance';
import styles from './dp.module.css';
import { candidateRows } from './recurrence';

const prefix = (chars: readonly string[], length: number): string =>
  (length === 0 ? 'the empty string' : `“${chars.slice(0, length).map(showChar).join('')}”`);

export function Inspector({ state, selected, onSelect }: {
  readonly state: EditState;
  readonly selected: Cell | null;
  readonly onSelect: (cell: Cell | null) => void;
}) {
  const rows = state.table.length;
  const cols = state.table[0]?.length ?? 1;
  const [draft, setDraft] = useState<{ row: string; col: string }>({ row: '', col: '' });
  const pick = (next: { row: string; col: string }): void => {
    setDraft(next);
    const r = Number(next.row);
    const c = Number(next.col);
    const valid = next.row.trim() !== '' && next.col.trim() !== '' && Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < rows && c < cols;
    onSelect(valid ? [r, c] : null);
  };
  return (
    <section className={`panel ${styles['inspect']}`} aria-label="Cell inspector">
      <h3>Where did a value come from?</h3>
      <div className="field-row">
        <Field label={`Row (0 to ${rows - 1})`}>
          {(props) => <input {...props} type="text" inputMode="numeric" value={draft.row} onChange={(event) => pick({ ...draft, row: event.target.value })} />}
        </Field>
        <Field label={`Column (0 to ${cols - 1})`}>
          {(props) => <input {...props} type="text" inputMode="numeric" value={draft.col} onChange={(event) => pick({ ...draft, col: event.target.value })} />}
        </Field>
      </div>
      <Body state={state} selected={selected} />
    </section>
  );
}

function Body({ state, selected }: { readonly state: EditState; readonly selected: Cell | null }) {
  if (selected === null) {
    return <p className={styles['inspectBody']}>Click a cell in the table, or focus it and press Enter, or type its row and column. Its parents get arrows and the sub-problem is put into words.</p>;
  }
  const [i, j] = selected;
  const value = state.table[i]?.[j];
  const name = cellName(i, j);
  if (value === null || value === undefined) return <p className={styles['inspectBody']}>{name} is not written yet at this step. Step forward until it is.</p>;
  const question = `the cheapest way to turn ${prefix(state.pattern, i)} into ${prefix(state.text, j)} costs ${value}`;
  if (i === 0 || j === 0) {
    const how = i === 0 && j === 0 ? 'Nothing needs to change.'
      : i === 0 ? `Every one of the ${j} text characters is inserted, at cost 1 each.` : `Every one of the ${i} pattern characters is deleted, at cost 1 each.`;
    return <p className={styles['inspectBody']}><strong>{name} = {value}</strong>: {question}. This is a base cell. {how}</p>;
  }
  const rows = candidateRows(state, selected);
  const parents = state.parents[i]?.[j] ?? [];
  return (
    <div className={styles['inspectBody']}>
      <p><strong>{name} = {value}</strong>: {question}.</p>
      {rows ? (
        <ul>
          {rows.map((row) => <li key={row.dir}>{row.name}: {row.formula} = <strong>{row.total}</strong>{row.best ? ' (a parent: this total equals the cell)' : ''}</li>)}
        </ul>
      ) : null}
      <p>{parents.length > 1
        ? `${parents.map((d) => DIR_NAME[d]).join(' and ')} tie, so the traceback takes ${DIR_NAME[parents[0] ?? 'diag']} first.`
        : `The only parent is the ${DIR_NAME[parents[0] ?? 'diag']} neighbour.`}</p>
    </div>
  );
}
