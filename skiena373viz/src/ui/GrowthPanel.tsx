/** Picks an experiment, measures it in small slices, and plots it. The standard foot of a module page. */
import { useEffect, useState } from 'react';
import { measureAt } from '@core';
import type { GrowthExperiment, GrowthFnId, OpCounts } from '@core';
import { Field } from './Field';
import { GrowthPlot } from './GrowthPlot';

interface Row {
  readonly n: number;
  readonly counts: OpCounts;
}

/** Measures one size per timer tick, so the page stays responsive. `rows` grows until it has every size. */
export function useGrowthRows(experiment: GrowthExperiment, caseId: string, seed: number): { readonly rows: readonly Row[]; readonly done: boolean } {
  const key = `${experiment.id}/${caseId}/${seed}`;
  const [data, setData] = useState<{ key: string; rows: readonly Row[] }>({ key, rows: [] });
  const rows = data.key === key ? data.rows : [];
  const next = experiment.sizes[rows.length];
  useEffect(() => {
    if (next === undefined) return undefined;
    const timer = setTimeout(() => {
      const counts = measureAt(experiment, caseId, next, seed);
      setData((old) => ({ key, rows: [...(old.key === key ? old.rows : []), { n: next, counts }] }));
    }, 0);
    return () => clearTimeout(timer);
  }, [experiment, caseId, seed, key, next]);
  return { rows, done: next === undefined };
}

const CHOICES: readonly GrowthFnId[] = ['log n', 'n', 'n log n', 'n²'];

export function GrowthPanel({ experiments, seed = 373 }: { readonly experiments: readonly GrowthExperiment[]; readonly seed?: number }) {
  const [experimentId, setExperimentId] = useState(experiments[0]?.id ?? '');
  const experiment = experiments.find((e) => e.id === experimentId) ?? experiments[0];
  if (!experiment) return <p className="muted">No growth experiments here yet.</p>;
  return (
    <section className="panel growth-panel" aria-label="Growth plot">
      <h3>Measured counts against theory</h3>
      {experiments.length > 1 ? (
        <Field label="Algorithm">
          {(props) => (
            <select {...props} value={experiment.id} onChange={(event) => setExperimentId(event.target.value)}>
              {experiments.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          )}
        </Field>
      ) : null}
      <ExperimentPlot key={experiment.id} experiment={experiment} seed={seed} />
    </section>
  );
}

function ExperimentPlot({ experiment, seed }: { readonly experiment: GrowthExperiment; readonly seed: number }) {
  const [caseId, setCaseId] = useState(experiment.cases[0]?.id ?? '');
  const [opId, setOpId] = useState(experiment.primaryOp);
  const [curves, setCurves] = useState<readonly GrowthFnId[]>(['n', 'n log n', 'n²']);
  const [logLog, setLogLog] = useState(false);
  const [raw, setRaw] = useState(false);
  const { rows, done } = useGrowthRows(experiment, caseId, seed);
  const chosen = experiment.cases.find((c) => c.id === caseId) ?? experiment.cases[0];
  const op = experiment.ops.find((o) => o.id === opId) ?? experiment.ops[0];
  if (!chosen || !op) return null;
  const primary = (experiment.ops.find((o) => o.id === experiment.primaryOp) ?? op).label.toLowerCase();
  return (
    <>
      <div className="field-row">
        <Field label="Input">
          {(props) => (
            <select {...props} value={chosen.id} onChange={(event) => setCaseId(event.target.value)}>
              {experiment.cases.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Count">
          {(props) => (
            <select {...props} value={op.id} onChange={(event) => setOpId(event.target.value)}>
              {experiment.ops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </Field>
        <fieldset className="checks">
          <legend>Theory curves</legend>
          {CHOICES.map((id) => (
            <label key={id}>
              <input type="checkbox" checked={curves.includes(id)}
                onChange={(event) => setCurves(CHOICES.filter((c) => (c === id ? event.target.checked : curves.includes(c))))} />
              {id}
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>View</legend>
          <label><input type="checkbox" checked={logLog} onChange={(event) => setLogLog(event.target.checked)} />log-log axes</label>
          <label><input type="checkbox" checked={raw} onChange={(event) => setRaw(event.target.checked)} />constant 1 (no scaling)</label>
        </fieldset>
      </div>
      <p>
        Theory for this input: <strong>{chosen.claim.symbol}({chosen.claim.fn})</strong> {primary}, {chosen.claim.when}.
        {raw ? ' Curves use constant 1.' : ' Each dashed curve is scaled to meet the last measured point, so compare shapes, not heights.'}
        {done ? '' : ' Measuring…'}
      </p>
      <GrowthPlot title={`${experiment.title}: ${op.label.toLowerCase()}`} xLabel={`n = ${experiment.sizeMeaning}`} yLabel={op.label}
        series={[{ id: op.id, label: 'measured', points: rows.map((row) => ({ n: row.n, value: row.counts[op.id] ?? 0 })) }]}
        curves={curves} scaling={raw ? 'raw' : 'fit'} logLog={logLog} />
    </>
  );
}
