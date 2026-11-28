import { useEffect, useMemo, useState } from 'react';
import type { GrowthFnId, ModuleManifest, ViewProps } from '@core';
import { Field, GrowthPanel, GrowthPlot, Notice, useModules } from '@ui';
import { commonChoices, findSortExperiments, gatherExperiments, measureSeries, shortTitle } from './algorithms/gather';
import type { Gathered } from './algorithms/gather';
import { seedFrom } from './seed';
import css from './analysis.module.css';

const CURVES: readonly GrowthFnId[] = ['log n', 'n', 'n log n', 'n²'];

/** The result is tied to the module list it was gathered for, so a late-arriving module triggers a fresh gather. */
interface Result {
  readonly for: readonly ModuleManifest[];
  readonly gathered: Gathered;
}

function SortComparison({ experiments, seed }: { readonly experiments: ReturnType<typeof findSortExperiments>; readonly seed: number }) {
  const choices = useMemo(() => commonChoices(experiments), [experiments]);
  const [caseId, setCaseId] = useState('random');
  const [opId, setOpId] = useState('comparisons');
  const [curves, setCurves] = useState<readonly GrowthFnId[]>(['n log n', 'n²']);
  const [logLog, setLogLog] = useState(false);
  const chosenCase = choices.cases.find((c) => c.id === caseId) ?? choices.cases[0];
  const chosenOp = choices.ops.find((o) => o.id === opId) ?? choices.ops[0];
  const series = useMemo(() => (chosenCase && chosenOp
    ? experiments.map((experiment) => ({ id: experiment.id, label: shortTitle(experiment.title), points: measureSeries(experiment, chosenCase.id, chosenOp.id, seed) }))
    : []), [experiments, chosenCase, chosenOp, seed]);
  if (!chosenCase || !chosenOp) return <p className="muted">The sorts share no input case, so there is nothing to compare.</p>;
  return (
    <>
      <div className="field-row">
        <Field label="Input">
          {(props) => (
            <select {...props} value={chosenCase.id} onChange={(event) => setCaseId(event.target.value)}>
              {choices.cases.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Count">
          {(props) => (
            <select {...props} value={chosenOp.id} onChange={(event) => setOpId(event.target.value)}>
              {choices.ops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </Field>
        <fieldset className="checks">
          <legend>Theory curves</legend>
          {CURVES.map((id) => (
            <label key={id}>
              <input type="checkbox" checked={curves.includes(id)} onChange={(event) => setCurves(CURVES.filter((c) => (c === id ? event.target.checked : curves.includes(c))))} />
              {id}
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>View</legend>
          <label><input type="checkbox" checked={logLog} onChange={(event) => setLogLog(event.target.checked)} />log-log axes</label>
        </fieldset>
      </div>
      <p>
        Every sort sorts exactly the same list at each size. Each dashed curve is scaled to meet the last point of the first line ({series[0]?.label ?? 'first sort'}),
        so compare shapes: a curve that the measured line follows at every size is the growth rate it has.
      </p>
      <GrowthPlot title={`${chosenOp.label} of the sorts on this input: ${chosenCase.label.toLowerCase()}`} xLabel="n = number of keys" yLabel={chosenOp.label}
        series={series} curves={curves} logLog={logLog} />
    </>
  );
}

export default function MeasuredView({ params, setParams }: ViewProps) {
  const modules = useModules();
  const seed = seedFrom(params['seed']);
  const [result, setResult] = useState<Result | null>(null);
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});

  useEffect(() => {
    let live = true;
    void gatherExperiments(modules).then((gathered) => {
      if (live) setResult({ for: modules, gathered });
    });
    return () => {
      live = false;
    };
  }, [modules]);

  const current = result !== null && result.for === modules ? result.gathered : null;
  const trio = useMemo(() => (current ? findSortExperiments(current.groups) : []), [current]);
  const count = current?.groups.reduce((sum, group) => sum + group.experiments.length, 0) ?? 0;

  return (
    <div className={css['page']}>
      <section className="panel" aria-label="Measured experiments">
        <p className={css['lead']}>
          Each module counts the operations its algorithms perform on inputs of growing size. Here they are gathered in one place, grouped by module,
          and set against the curves theory predicts. The inputs are random (seed {seed}); a new seed measures again on fresh inputs.
        </p>
        <div className="field-row">
          <button type="button" onClick={() => setParams({ seed: String(seed + 1) })}>Measure again on new random inputs</button>
        </div>
        <p role="status" className="muted small" style={{ minHeight: '1.5em' }}>
          {current === null ? 'Loading experiments from every module…' : `${count} ${count === 1 ? 'experiment' : 'experiments'} from ${current.groups.length} ${current.groups.length === 1 ? 'module' : 'modules'}.`}
        </p>
      </section>

      {current && current.notes.length > 0 ? (
        <Notice tone="info">
          <ul className={css['notes']} aria-label="Modules skipped">{current.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </Notice>
      ) : null}

      {current ? (
        <section className="panel" aria-label="Comparison of the three sorts">
          <h3>The three sorts on the same inputs</h3>
          {trio.length >= 2 ? <SortComparison experiments={trio} seed={seed} /> : (
            <p className="muted">The sorting module's experiments are not available, so there is nothing to compare here yet.</p>
          )}
        </section>
      ) : null}

      {current?.groups.map((group, index) => {
        const expanded = open[group.moduleId] ?? index === 0;
        return (
          <section key={group.moduleId} aria-label={`${group.title} experiments`}>
            <div className={css['groupHead']}>
              <h3>{group.title}</h3>
              <span className="muted small">{group.experiments.length} {group.experiments.length === 1 ? 'experiment' : 'experiments'}: {group.experiments.map((e) => e.title).join(', ')}</span>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen({ ...open, [group.moduleId]: !expanded })}>
                {expanded ? 'Hide plots' : 'Show plots'}
              </button>
            </div>
            {expanded ? <GrowthPanel experiments={group.experiments} seed={seed} /> : null}
          </section>
        );
      })}
    </div>
  );
}
