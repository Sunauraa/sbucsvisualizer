import { useMemo, useState } from 'react';
import { ok, parseBoundedInt, parseIntList } from '@core';
import type { Result, ViewProps } from '@core';
import { CellRow, Field, GrowthPanel, Legend, Workbench } from '@ui';
import type { CellSpec, RendererProps } from '@ui';
import { binarySearch, binarySearchExperiment, halvingChain, worstComparisons } from './algorithms/binarySearch';
import type { BinarySearchInput, BinarySearchState } from './algorithms/binarySearch';
import css from './analysis.module.css';

const MAX_ITEMS = 64;

/** Renderer: the array with the candidate range, the middle and the answer. A pure function of one frame. */
export function BinarySearchRenderer({ frame }: RendererProps<BinarySearchState, number | null>) {
  const { items, target, lo, hi, mid, foundAt, offending, phase } = frame.state;
  const cells = items.map((value, i): CellSpec => {
    const names = [
      ...(phase === 'search' || phase === 'done' ? [i === lo && lo <= hi ? 'lo' : '', i === mid ? 'mid' : '', i === hi && lo <= hi ? 'hi' : ''] : []),
    ].filter(Boolean);
    let tone: CellSpec['tone'] = 'idle';
    if (offending.includes(i)) tone = 'swap';
    else if (foundAt === i) tone = 'done';
    else if (i === mid && phase !== 'done') tone = 'compare';
    else if (phase === 'search' || phase === 'done') tone = i >= lo && i <= hi ? 'active' : 'visited';
    return { text: String(value), tone, ...(names.length > 0 ? { pointer: names.join('/') } : {}) };
  });
  return (
    <>
      <p>Target: <strong>{target}</strong></p>
      <CellRow title={`Sorted array of ${items.length} items, searching for ${target}`} cells={cells} slots={items.length} emptyText="the array is empty" />
    </>
  );
}

function parse(itemsText: string, targetText: string): Result<BinarySearchInput> {
  const items = parseIntList(itemsText, { maxLength: MAX_ITEMS });
  if (!items.ok) return items;
  const target = parseBoundedInt(targetText, 'Target', -999, 999);
  return target.ok ? ok({ items: items.value, target: target.value }) : target;
}

const DEFAULT = binarySearch.presets[0]?.input ?? { items: [], target: 0 };

function HalvingPanel({ n, comparisons, total, remaining }: { readonly n: number; readonly comparisons: number; readonly total: number; readonly remaining: number }) {
  const chain = halvingChain(n);
  const halvings = Math.max(0, chain.length - 1);
  return (
    <section className="panel" aria-label="Halving">
      <h3>How many times can n be halved?</h3>
      <p className={css['stateLine']}>With n = {n}, halving (rounding down) gives:</p>
      <p className={css['chain']}>{chain.length === 0 ? 'nothing: n is 0' : chain.join(' → ')}</p>
      <p className={css['stateLine']}>
        {chain.length === 0 ? 'There is nothing to search.' : `That is ${halvings} ${halvings === 1 ? 'halving' : 'halvings'}, which is ⌊lg ${n}⌋, so binary search makes at most ⌊lg n⌋ + 1 = ${worstComparisons(n)} ${worstComparisons(n) === 1 ? 'comparison' : 'comparisons'}.`}
      </p>
      <p className={css['stateLine']}>This run: {comparisons} of {total} comparisons so far; {remaining} {remaining === 1 ? 'candidate' : 'candidates'} left.</p>
      <details>
        <summary>The bound for larger n</summary>
        <table>
          <thead><tr><th scope="col">n</th><th scope="col">at most ⌊lg n⌋ + 1 comparisons</th></tr></thead>
          <tbody>
            {[10, 1000, 1_000_000, 1_000_000_000].map((size) => <tr key={size}><th scope="row">{size.toLocaleString('en-US')}</th><td>{worstComparisons(size)}</td></tr>)}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export default function HalvingView({ params, setParams }: ViewProps) {
  const itemsText = params['a'] ?? DEFAULT.items.join(', ');
  const targetText = params['t'] ?? String(DEFAULT.target);
  const parsed = useMemo(() => parse(itemsText, targetText), [itemsText, targetText]);
  const [lastGood, setLastGood] = useState<BinarySearchInput>(parsed.ok ? parsed.value : DEFAULT);
  if (parsed.ok && parsed.value !== lastGood) setLastGood(parsed.value);
  const trace = useMemo(() => binarySearch.run(lastGood), [lastGood]);
  const total = trace.totals['comparisons'] ?? 0;
  const sortedText = parsed.ok ? [...parsed.value.items].sort((a, b) => a - b).join(', ') : '';

  return (
    <Workbench
      algorithm={binarySearch}
      trace={trace}
      Renderer={BinarySearchRenderer}
      legend={<Legend tones={['active', 'compare', 'visited', 'done', 'swap']}
        labels={{ active: 'still a candidate', compare: 'compared now', visited: 'ruled out', done: 'found', swap: 'out of order: refused' }} />}
      inputs={
        <div className="field-row">
          <Field label="Sorted array" error={parsed.ok ? null : parsed.message} hint={`Up to ${MAX_ITEMS} whole numbers. Try an unsorted one: the algorithm refuses it.`}>
            {(props) => <input {...props} type="text" value={itemsText} spellCheck={false} onChange={(event) => setParams({ a: event.target.value })} />}
          </Field>
          <Field label="Target">
            {(props) => <input {...props} type="text" inputMode="numeric" value={targetText} onChange={(event) => setParams({ t: event.target.value })} />}
          </Field>
          <Field label="Or n sorted items (0 to 64)">
            {(props) => (
              <input {...props} type="number" min={0} max={MAX_ITEMS} style={{ width: '6em' }} defaultValue=""
                onChange={(event) => {
                  const size = Math.min(MAX_ITEMS, Math.max(0, Math.floor(Number(event.target.value))));
                  if (Number.isFinite(size) && event.target.value !== '') setParams({ a: Array.from({ length: size }, (_, i) => 2 * i + 1).join(', ') });
                }} />
            )}
          </Field>
          <Field label="Examples">
            {(props) => (
              <select {...props} value="" onChange={(event) => {
                const preset = binarySearch.presets.find((p) => p.id === event.target.value);
                if (preset) setParams({ a: preset.input.items.join(', '), t: String(preset.input.target) });
              }}>
                <option value="">Choose an example</option>
                {binarySearch.presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
          </Field>
          <div className="field">
            <div aria-hidden="true" style={{ height: '1.7em' }} />
            <button type="button" disabled={!parsed.ok} onClick={() => setParams({ a: sortedText })}>Sort the list for me</button>
          </div>
        </div>
      }
      aside={({ frame }) => <HalvingPanel n={lastGood.items.length} comparisons={frame.ops['comparisons'] ?? 0} total={total} remaining={frame.state.remaining} />}
    >
      <GrowthPanel experiments={[binarySearchExperiment]} />
    </Workbench>
  );
}
