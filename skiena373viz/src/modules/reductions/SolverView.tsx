import { useMemo } from 'react';
import type { ViewProps } from '@core';
import { Legend } from '@ui';
import { buildReduction } from './algorithms/construct';
import { formatClause, formulaVariables } from './algorithms/formula';
import { assignmentToCover } from './algorithms/maps';
import { solve } from './algorithms/solver';
import { FormulaField, useFormula } from './FormulaField';
import { linkedFor, ReductionStage, useSubjectLink } from './ReductionStage';
import { attemptStage } from './stages';
import { assignmentFromBits, bitsFromAssignment } from './params';
import css from './reductions.module.css';

const tf = (value: boolean): string => (value ? 'T' : 'F');

export default function SolverView({ params, setParams }: ViewProps) {
  const input = useFormula(params);
  const { formula } = input;
  const variables = useMemo(() => formulaVariables(formula), [formula]);
  const reduction = useMemo(() => buildReduction(formula), [formula]);
  const report = useMemo(() => solve(formula), [formula]);
  const link = useSubjectLink();

  const bits = params['a'];
  const chosen = useMemo(
    () => (bits === undefined ? (report?.satisfying[0] ?? report?.rows[0]?.assignment ?? {}) : assignmentFromBits(variables, bits)),
    [bits, report, variables],
  );
  const attempt = useMemo(() => assignmentToCover(formula, chosen), [formula, chosen]);
  const data = useMemo(() => attemptStage(formula, reduction, chosen), [formula, reduction, chosen]);
  const linked = linkedFor(data, link.active);
  const k = reduction.k;
  const m = formula.clauses.length;
  const satisfiable = (report?.satisfying.length ?? 0) > 0;
  const smallest = report ? report.rows.reduce((least, row) => Math.min(least, k + row.unsatisfied.length), Infinity) : null;

  return (
    <div className={css['page']}>
      <section className="workbench-inputs" aria-label="Input">
        <FormulaField state={input} onText={(text) => setParams({ f: text, a: null })} />
      </section>

      <section className="panel" aria-label="Solver">
        <h3>Brute-force solver</h3>
        {report ? (
          <>
            <p>
              Tried all 2<sup>{variables.length}</sup> = <strong>{report.tried}</strong> assignments of {variables.length} variable{variables.length === 1 ? '' : 's'}:{' '}
              <strong>{report.satisfying.length}</strong> satisfy all {m} clause{m === 1 ? '' : 's'}.{' '}
              The formula is <strong>{satisfiable ? 'satisfiable' : 'unsatisfiable'}</strong>.
            </p>
            <p>
              Its graph has {reduction.vertexCount} vertices and k = {k}. Each assignment below gives a cover attempt of size k plus the number of clauses it
              leaves unsatisfied, and the smallest attempt has {smallest} vertices: {satisfiable ? `exactly k = ${k}, so a vertex cover of size k exists.` : `more than k = ${k}, so no cover of size k comes from any assignment.`}
            </p>
            <p className="muted small">
              This is honest exponential work: every extra variable doubles the number of tries (30 variables would be over a billion). Checking <em>one</em> assignment takes only
              time proportional to the formula, which is why 3-SAT is in NP; no polynomial-time way to find one is known, and the reduction does not make finding it easier, it
              moves the same difficulty into a graph. The attempts consider covers with one literal vertex per pair; the counting argument on the Certificates view shows that
              every cover of size at most k has that shape.
            </p>
          </>
        ) : (
          <p>This formula has {variables.length} variables, so trying all 2<sup>{variables.length}</sup> assignments is too many to run here. That is the point of the problem.</p>
        )}
      </section>

      {report ? (
        <section className="panel" aria-label="All assignments">
          <h3>Every assignment</h3>
          <div className={css['tableWrap']}>
            <table>
              <caption className="small muted" style={{ textAlign: 'left' }}>One row per assignment. Choose a row to draw its cover attempt below.</caption>
              <thead>
                <tr><th scope="col">Assignment</th><th scope="col">Unsatisfied clauses</th><th scope="col">Cover attempt</th><th scope="col">Against k = {k}</th><th scope="col"><span className={css['srOnly']}>Show</span></th></tr>
              </thead>
              <tbody>
                {report.rows.map((row) => {
                  const text = variables.map((v) => `${v}=${tf(row.assignment[v] === true)}`).join(' ') || '(none)';
                  const picked = bitsFromAssignment(variables, row.assignment) === bitsFromAssignment(variables, chosen);
                  const size = k + row.unsatisfied.length;
                  return (
                    <tr key={text} data-selected={picked}>
                      <th scope="row">{text}</th>
                      <td>{row.unsatisfied.length === 0 ? 'none' : row.unsatisfied.map((i) => `C${i + 1}`).join(', ')}</td>
                      <td>{size} vertices</td>
                      <td>{row.unsatisfied.length === 0 ? '✓ equals k' : `✗ k + ${row.unsatisfied.length}`}</td>
                      <td><button type="button" className={css['rowButton']} aria-pressed={picked} onClick={() => setParams({ a: bitsFromAssignment(variables, row.assignment) })}>{picked ? 'Shown' : 'Show'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="stage" aria-label="Cover attempt for the chosen assignment">
        <p>
          <strong>Chosen assignment:</strong> {variables.map((v) => `${v} = ${tf(chosen[v] === true)}`).join(', ') || 'none (no variables)'}.{' '}
          {attempt.unsatisfied.length === 0
            ? `It satisfies every clause, and the matching cover has exactly ${k} vertices.`
            : `Clause${attempt.unsatisfied.length === 1 ? '' : 's'} ${attempt.unsatisfied.map((i) => `C${i + 1} = ${formula.clauses[i] ? formatClause(formula.clauses[i]) : ''}`).join(' and ')} ${attempt.unsatisfied.length === 1 ? 'has' : 'have'} no true literal, so all three corners of ${attempt.unsatisfied.length === 1 ? 'its triangle are' : 'each such triangle are'} needed: the cover attempt has ${attempt.cover.length} = k + ${attempt.unsatisfied.length} vertices, more than k = ${k}.`}
        </p>
        <ReductionStage data={data} linked={linked} interaction={link.interaction} graphTitle="Cover attempt from the assignment" />
      </section>
      <Legend tones={['target', 'swap', 'done']} labels={{ target: 'in the cover attempt', swap: 'a clause with no true literal, and its three corners (too many)', done: 'true literal or satisfied clause' }} />

      <section className="panel" aria-label="What stands for what">
        <h3>What stands for what</h3>
        <p className={css['words']} aria-live="polite">{linked?.words ?? 'Point at, focus or click anything in the formula or the graph to see what stands for it on the other side.'}</p>
        {link.selected ? <button type="button" onClick={link.clear}>Clear selection</button> : null}
      </section>
    </div>
  );
}
