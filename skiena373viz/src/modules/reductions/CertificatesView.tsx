import { useMemo } from 'react';
import type { ViewProps } from '@core';
import type { RendererProps } from '@ui';
import { certificates } from './algorithms/certificates';
import type { CertificateInput, CertificateState, Direction } from './algorithms/certificates';
import { buildReduction } from './algorithms/construct';
import { clauseIsSatisfied, formatClause, formulaVariables } from './algorithms/formula';
import type { Assignment, Formula } from './algorithms/formula';
import { assignmentToCover, describeEdge, reportCover } from './algorithms/maps';
import { solve } from './algorithms/solver';
import { FormulaField, useFormula } from './FormulaField';
import { ReductionPage } from './ReductionPage';
import { ReductionStage } from './ReductionStage';
import { SameFormulaLinks } from './SameFormulaLinks';
import { certificateStage } from './stages';
import { assignmentFromBits, bitsFromAssignment, coverFromParam, coverToParam, toggleInCover } from './params';
import css from './reductions.module.css';

export function CertificateRenderer({ frame }: RendererProps<CertificateState>) {
  return <ReductionStage data={certificateStage(frame.state)} graphTitle="Graph and cover S" />;
}

const assignmentText = (variables: readonly string[], values: Assignment): string =>
  (variables.length === 0 ? 'no variables' : variables.map((v) => `${v} = ${values[v] ? 'T' : 'F'}`).join(', '));

/** The assignment the page starts from: a satisfying one if there is any, otherwise all false. */
function startingAssignment(formula: Formula, variables: readonly string[]): Assignment {
  return solve(formula)?.satisfying[0] ?? assignmentFromBits(variables, '');
}

export default function CertificatesView({ params, setParams }: ViewProps) {
  const input = useFormula(params);
  const { formula } = input;
  const variables = useMemo(() => formulaVariables(formula), [formula]);
  const reduction = useMemo(() => buildReduction(formula), [formula]);
  const direction: Direction = params['dir'] === 'cover' ? 'to-assignment' : 'to-cover';

  const bits = params['a'];
  const assignment = useMemo(
    () => (bits === undefined ? startingAssignment(formula, variables) : assignmentFromBits(variables, bits)),
    [bits, formula, variables],
  );
  const coverParam = params['s'];
  const cover = useMemo(
    () => (coverParam === undefined ? [...assignmentToCover(formula, assignment).cover] : coverFromParam(coverParam)),
    [coverParam, formula, assignment],
  );

  const certificateInput = useMemo<CertificateInput>(
    () => ({ formula, direction, assignment, cover }),
    [formula, direction, assignment, cover],
  );
  const trace = useMemo(() => certificates.run(certificateInput), [certificateInput]);

  const setAssignment = (next: Assignment): void => setParams({ a: bitsFromAssignment(variables, next) });
  const mapped = useMemo(() => assignmentToCover(formula, assignment), [formula, assignment]);
  const report = useMemo(() => reportCover(formula, reduction.graph, cover, reduction.k), [formula, reduction, cover]);
  const unsatisfied = mapped.unsatisfied;
  const nameOf = (id: string): string => reduction.graph.nodes.find((node) => node.id === id)?.label ?? id;

  const inputs = (
    <>
      <FormulaField state={input} onText={(text) => setParams({ f: text, a: null, s: null })} />
      <div className="field-row">
        <div role="group" aria-label="Direction" className={css['toggleRow']}>
          <button type="button" aria-pressed={direction === 'to-cover'} onClick={() => setParams({ dir: null })}>Assignment → cover</button>
          <button type="button" aria-pressed={direction === 'to-assignment'} onClick={() => setParams({ dir: 'cover' })}>Cover → assignment</button>
        </div>
      </div>
      {direction === 'to-cover' ? (
        <fieldset className="checks">
          <legend>Truth values (toggle a variable and the cover updates)</legend>
          <span className={css['assign']}>
            {variables.map((variable) => (
              <label key={variable}>
                <input type="checkbox" checked={assignment[variable] === true}
                  onChange={(event) => setAssignment({ ...assignment, [variable]: event.target.checked })} />
                {variable} is {assignment[variable] === true ? 'true' : 'false'}
              </label>
            ))}
            {variables.length === 0 ? <span className="muted">The formula has no variables.</span> : null}
          </span>
          <span className="field-row" style={{ gap: 8, marginTop: 6 }}>
            <button type="button" onClick={() => setAssignment({})}>All false</button>
            <button type="button" onClick={() => setAssignment(Object.fromEntries(variables.map((v) => [v, true])))}>All true</button>
            <button type="button" disabled={solve(formula)?.satisfying[0] === undefined} onClick={() => setAssignment(startingAssignment(formula, variables))}>First satisfying</button>
          </span>
        </fieldset>
      ) : (
        <fieldset className="checks">
          <legend>Choose the vertex set S: click vertices in the graph, or use the boxes</legend>
          <span className="field-row" style={{ gap: 8, marginBottom: 6 }}>
            <button type="button" onClick={() => setParams({ s: '' })}>Empty S</button>
            <button type="button" onClick={() => setParams({ s: coverToParam(assignmentToCover(formula, assignment).cover) })}>Cover from the assignment</button>
            <button type="button" onClick={() => setParams({ s: null })}>Reset</button>
          </span>
          <details>
            <summary>Vertices as check boxes ({cover.length} chosen)</summary>
            <span className={css['vertexBoxes']}>
              {reduction.graph.nodes.map((node) => (
                <label key={node.id}>
                  <input type="checkbox" checked={cover.includes(node.id)} onChange={() => setParams({ s: coverToParam(toggleInCover(cover, node.id)) })} />
                  {node.kind === 'corner' ? `C${(node.clause ?? 0) + 1}.${(node.position ?? 0) + 1} (${node.label})` : node.label}
                </label>
              ))}
            </span>
          </details>
        </fieldset>
      )}
    </>
  );

  const summary = direction === 'to-cover' ? (
    <section className="panel" aria-label="Live result">
      <h3>This assignment, live</h3>
      <div className={css['summary']}>
        <p><strong>{assignmentText(variables, assignment)}</strong></p>
        <p>
          {formula.clauses.length - unsatisfied.length} of {formula.clauses.length} clauses are satisfied.
          {unsatisfied.length === 0
            ? <span className={css['good']}> ✓ Every clause has a true literal.</span>
            : <span className={css['bad']}> ✗ Unsatisfied: {unsatisfied.map((i) => `C${i + 1} = ${formula.clauses[i] ? formatClause(formula.clauses[i]) : ''}`).join('; ')}.</span>}
        </p>
        <p>
          The matching cover has <strong>{mapped.cover.length}</strong> vertices; k = {mapped.k}.{' '}
          {unsatisfied.length === 0
            ? <span className={css['good']}>✓ Exactly k: a vertex cover of the required size.</span>
            : <span className={css['bad']}>✗ k + {unsatisfied.length} = {mapped.cover.length}: every unsatisfied clause forces all three of its corners, so this attempt is too big.</span>}
        </p>
        <p>
          {mapped.cover.map((id) => <span key={id} className={css['pill']}>{nameOf(id)}{id.startsWith('c') ? ` (${id})` : ''}</span>)}
          {mapped.cover.length === 0 ? <span className="muted">The cover is empty.</span> : null}
        </p>
      </div>
    </section>
  ) : (
    <section className="panel" aria-label="Live result">
      <h3>This cover, live</h3>
      <div className={css['summary']}>
        <p>S has <strong>{report.size}</strong> vertices; k = {report.k}. {report.size <= report.k ? <span className={css['good']}>✓ Within the budget.</span> : <span className={css['bad']}>✗ More than k.</span>}</p>
        <p>
          {report.uncovered.length === 0
            ? <span className={css['good']}>✓ Every edge has an endpoint in S.</span>
            : <span className={css['bad']}>✗ {report.uncovered.length} uncovered edge{report.uncovered.length === 1 ? '' : 's'}:</span>}
        </p>
        {report.uncovered.length > 0 ? (
          <ul className={css['list']}>
            {report.uncovered.slice(0, 6).map((edge) => <li key={edge.id}>{describeEdge(edge, reduction.graph.nodes)}</li>)}
            {report.uncovered.length > 6 ? <li>and {report.uncovered.length - 6} more</li> : null}
          </ul>
        ) : null}
        <p>
          {report.assignment
            ? <span className={css['good']}>✓ </span>
            : <span className={css['bad']}>✗ </span>}
          {report.reason}
        </p>
        {report.assignment ? (
          <p>
            {formula.clauses.every((clause) => clauseIsSatisfied(clause, report.assignment ?? {}))
              ? <span className={css['good']}>✓ It satisfies all {formula.clauses.length} clauses.</span>
              : <span className={css['bad']}>✗ It does not satisfy the formula.</span>}
          </p>
        ) : null}
      </div>
    </section>
  );

  return (
    <ReductionPage
      algorithm={certificates}
      trace={trace}
      stageOf={certificateStage}
      graphTitle="Graph and cover S"
      legend={{
        tones: ['target', 'active', 'done', 'swap'],
        labels: { target: 'in the cover S', active: 'this step', done: 'verified: edge covered, literal true, clause satisfied', swap: 'the witness: uncovered edge or unsatisfied clause' },
      }}
      legendNote={direction === 'to-assignment'
        ? 'Click a vertex to put it in S or take it out. A corner that stays out of S is labelled "left out".'
        : 'The cover is built from the assignment; a corner that stays out of S is labelled "left out".'}
      inputs={inputs}
      {...(direction === 'to-assignment' ? { onToggleVertex: (id: string) => setParams({ s: coverToParam(toggleInCover(cover, id)) }) } : {})}
      notes={({ words }) => (
        <>
          {summary}
          {words}
          <SameFormulaLinks text={input.text} current="certificates" />
        </>
      )}
    />
  );
}
