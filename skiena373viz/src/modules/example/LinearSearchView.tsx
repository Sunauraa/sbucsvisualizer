import { useMemo, useState } from 'react';
import { ok, parseBoundedInt, parseIntList } from '@core';
import type { Result, ViewProps } from '@core';
import { CellRow, Field, GrowthPanel, Legend, Workbench } from '@ui';
import type { CellSpec, RendererProps } from '@ui';
import { experiments, linearSearch } from './algorithms/linearSearch';
import type { LinearSearchInput, LinearSearchState } from './algorithms/linearSearch';

/** Renderer: a pure function of one frame. */
export function LinearSearchRenderer({ frame }: RendererProps<LinearSearchState>) {
  const { items, target, cursor, ruledOut, foundAt } = frame.state;
  const cells = items.map((item, i): CellSpec => ({
    text: String(item),
    tone: i === foundAt ? 'done' : i === cursor ? 'compare' : i < ruledOut ? 'visited' : 'idle',
    ...(i === cursor ? { pointer: 'i' } : {}),
  }));
  return (
    <>
      <p>Target: <strong>{target}</strong></p>
      <CellRow title={`Array of ${items.length} items, searching for ${target}`} cells={cells} emptyText="the array is empty" />
    </>
  );
}

function parse(itemsText: string, targetText: string): Result<LinearSearchInput> {
  const items = parseIntList(itemsText, { maxLength: 24 });
  if (!items.ok) return items;
  const target = parseBoundedInt(targetText, 'Target', -999, 999);
  return target.ok ? ok({ items: items.value, target: target.value }) : target;
}

const DEFAULT = linearSearch.presets[0]?.input ?? { items: [], target: 0 };

export default function LinearSearchView({ params, setParams }: ViewProps) {
  const itemsText = params['a'] ?? DEFAULT.items.join(', ');
  const targetText = params['x'] ?? String(DEFAULT.target);
  const parsed = useMemo(() => parse(itemsText, targetText), [itemsText, targetText]);
  // While the input is invalid, keep showing the last valid run and say what is wrong.
  const [lastGood, setLastGood] = useState<LinearSearchInput>(parsed.ok ? parsed.value : DEFAULT);
  if (parsed.ok && parsed.value !== lastGood) setLastGood(parsed.value);
  const trace = useMemo(() => linearSearch.run(lastGood), [lastGood]);

  return (
    <Workbench
      algorithm={linearSearch}
      trace={trace}
      Renderer={LinearSearchRenderer}
      legend={<Legend tones={['compare', 'visited', 'done']} labels={{ compare: 'being compared', visited: 'ruled out', done: 'found' }} />}
      inputs={
        <div className="field-row">
          <Field label="Array" error={parsed.ok ? null : parsed.message} hint="Up to 24 whole numbers">
            {(props) => <input {...props} type="text" value={itemsText} onChange={(event) => setParams({ a: event.target.value })} />}
          </Field>
          <Field label="Target">
            {(props) => <input {...props} type="text" inputMode="numeric" value={targetText} onChange={(event) => setParams({ x: event.target.value })} />}
          </Field>
          <Field label="Try">
            {(props) => (
              <select {...props} value="" onChange={(event) => {
                const preset = linearSearch.presets.find((p) => p.id === event.target.value);
                if (preset) setParams({ a: preset.input.items.join(', '), x: String(preset.input.target) });
              }}>
                <option value="">Choose an example</option>
                {linearSearch.presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
          </Field>
        </div>
      }
    >
      <GrowthPanel experiments={experiments} />
    </Workbench>
  );
}
