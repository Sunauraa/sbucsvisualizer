import { useMemo } from 'react';
import type { GrowthFnId, ViewProps } from '@core';
import { Field, ScrollX } from '@ui';
import {
  autoCeiling, BUDGETS, describeMaxSize, DOMINANCE_WORDS, dominanceLines, formatSteps, leavesAt, maxSizeWithin, RATE_CODE, RATE_IDS, RATE_LABEL,
  ratesFromCodes, timeAt,
} from './algorithms/rates';
import { RatesPlot } from './RatesPlot';
import css from './analysis.module.css';

const DEFAULT_SHOWN: readonly GrowthFnId[] = ['log n', 'n', 'n log n', 'n²', '2^n'];
const CEILINGS = [100, 1000, 1e4, 1e6, 1e9, 1e12] as const;
const WORDS: Readonly<Record<GrowthFnId, string>> = {
  '1': 'constant: the cost does not depend on n',
  'log n': 'logarithmic: halving the problem each step',
  n: 'linear: one look at each item',
  'n log n': 'what a good comparison sort costs',
  'n²': 'quadratic: every pair of items',
  'n³': 'cubic: every triple of items',
  '2^n': 'exponential: every subset of the items',
};

const intFrom = (text: string | undefined, fallback: number, low: number, high: number): number => {
  const value = Number(text);
  return text !== undefined && text.trim() !== '' && Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;
};

export default function GrowthRatesView({ params, setParams }: ViewProps) {
  const shown = useMemo(() => ratesFromCodes(params['fns'], DEFAULT_SHOWN), [params]);
  const maxN = intFrom(params['max'], 30, 4, 200);
  const logLog = params['scale'] === 'log';
  const picked = intFrom(params['n'], 20, 1, 1_000_000_000);
  const budget = BUDGETS.find((b) => b.id === params['t']) ?? BUDGETS[1] ?? { id: 's', label: 'one second', seconds: 1 };
  const fixed = CEILINGS.find((c) => String(c) === params['h']);
  const ceiling = fixed ?? autoCeiling(shown, maxN);
  const lines = useMemo(() => dominanceLines(), []);
  const leaving = shown.map((id) => ({ id, at: leavesAt(id, ceiling, maxN) })).filter((entry): entry is { id: GrowthFnId; at: number } => entry.at !== null);

  const toggle = (id: GrowthFnId, on: boolean): void => {
    const next = RATE_IDS.filter((candidate) => (candidate === id ? on : shown.includes(candidate)));
    setParams({ fns: next.map((candidate) => RATE_CODE[candidate]).join(',') });
  };

  return (
    <div className={css['page']}>
      <section className="panel" aria-label="Chart controls">
        <div className="field-row">
          <fieldset className="checks">
            <legend>Curves</legend>
            {RATE_IDS.map((id) => (
              <label key={id}><input type="checkbox" checked={shown.includes(id)} onChange={(event) => toggle(id, event.target.checked)} />{RATE_LABEL[id]}</label>
            ))}
          </fieldset>
          <Field label={`Largest n on the chart: ${maxN}`}>
            {(props) => (
              <input {...props} className={css['range']} type="range" min={4} max={200} value={maxN}
                onChange={(event) => setParams({ max: event.target.value })} />
            )}
          </Field>
          <fieldset className="checks">
            <legend>Axes</legend>
            <label><input type="radio" name="scale" checked={!logLog} onChange={() => setParams({ scale: null })} />linear</label>
            <label><input type="radio" name="scale" checked={logLog} onChange={() => setParams({ scale: 'log' })} />log-log</label>
          </fieldset>
          <Field label="Chart height (steps)">
            {(props) => (
              <select {...props} value={fixed === undefined ? 'auto' : String(fixed)} onChange={(event) => setParams({ h: event.target.value === 'auto' ? null : event.target.value })}>
                <option value="auto">Automatic: fits the slower curves</option>
                {CEILINGS.map((c) => <option key={c} value={String(c)}>up to {formatSteps('n', c)}</option>)}
              </select>
            )}
          </Field>
        </div>
      </section>

      <section className="panel" aria-label="Growth curves">
        <h3>How the curves grow</h3>
        <RatesPlot ids={shown} maxN={maxN} logLog={logLog} ceiling={ceiling} n={picked}
          onPick={(n) => setParams({ n: String(n) })} />
        <div className={css['leaves']} aria-live="polite">
          {leaving.length === 0 ? 'Every selected curve stays on the chart.' : (
            <ul className={css['notes']}>
              {leaving.map(({ id, at }) => (
                <li key={id}>
                  {RATE_LABEL[id]} rises past the top of the chart at n = {at} and is not drawn beyond that point: at n = {maxN} it would be {formatSteps(id, maxN)} steps.
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className={css['twoCol']}>
        <section className="panel" aria-label="Values at one n">
          <h3>Values at one n</h3>
          <div className={css['panelBody']}>
            <Field label="n" hint="Whole number from 1 to 1,000,000,000">
              {(props) => (
                <input {...props} type="number" min={1} max={1_000_000_000} value={picked} style={{ maxWidth: '14em' }}
                  onChange={(event) => setParams({ n: String(intFrom(event.target.value, picked, 1, 1_000_000_000)) })} />
              )}
            </Field>
            <ScrollX label="Steps at the chosen n">
              <table className={css['table']}>
                <caption className="muted small">Steps f(n), and the time they take at 10⁹ steps per second</caption>
                <thead><tr><th scope="col">Growth</th><th scope="col">Steps at n = {picked}</th><th scope="col">Time</th></tr></thead>
                <tbody>
                  {RATE_IDS.map((id) => (
                    <tr key={id}><th scope="row">{RATE_LABEL[id]}</th><td>{formatSteps(id, picked)}</td><td>{timeAt(id, picked)}</td></tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>
        </section>

        <section className="panel" aria-label="How large an n fits in a time budget">
          <h3>How big an n fits in the time?</h3>
          <div className={css['panelBody']}>
            <Field label="Time available, at 10⁹ steps per second">
              {(props) => (
                <select {...props} value={budget.id} onChange={(event) => setParams({ t: event.target.value })}>
                  {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              )}
            </Field>
            <ScrollX label="Largest n by growth rate">
              <table className={css['table']}>
                <caption className="muted small">The largest n whose f(n) steps fit in {budget.label}</caption>
                <thead><tr><th scope="col">Growth</th><th scope="col">Largest n</th></tr></thead>
                <tbody>
                  {RATE_IDS.map((id) => (
                    <tr key={id}><th scope="row">{RATE_LABEL[id]}</th><td style={{ textAlign: 'left' }}>{describeMaxSize(maxSizeWithin(id, budget.seconds))}</td></tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>
        </section>
      </div>

      <section className="panel" aria-label="Which grows faster">
        <h3>Which grows faster?</h3>
        <div className={css['panelBody']}>
          <p className={css['lead']}>{DOMINANCE_WORDS}</p>
          <ul className={css['notes']}>
            {RATE_IDS.map((id) => <li key={id}><strong>{RATE_LABEL[id]}</strong>: {WORDS[id]}; {id === '1' ? 'grows slowest' : id === '2^n' ? 'grows fastest' : 'grows faster than the one before it'}.</li>)}
          </ul>
          <details>
            <summary>From which n does each curve stay above the one before it?</summary>
            <ul className={css['notes']}>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
            <p className="muted small">Small n can mislead: 2ⁿ is below n³ until n = 10, which is why Big-O talks about large n.</p>
          </details>
        </div>
      </section>
    </div>
  );
}
