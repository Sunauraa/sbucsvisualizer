import { useMemo } from 'react';
import type { ViewProps } from '@core';
import { GrowthPanel, Legend, Workbench } from '@ui';
import type { RendererProps } from '@ui';
import { mergesortExperiment } from './algorithms/experiments';
import { mergesort } from './algorithms/mergesort';
import type { MergesortState } from './algorithms/mergesort';
import type { SortResult } from './algorithms/common';
import { mergeArrayModel, mergeBufferModel } from './barModels';
import { CallStackPanel } from './CallStack';
import { describeBars, keyRange, SortBars } from './SortBars';
import { SortInputFields, useSortSetup } from './SortInputs';
import css from './sorting.module.css';

export function MergesortRenderer({ frame, trace }: RendererProps<MergesortState, SortResult>) {
  const { state } = frame;
  const first = trace.frames[0]?.state ?? state;
  const slots = first.items.length;
  const range = keyRange(first.items.flatMap((item) => (item ? [item.key] : [])));
  const array = mergeArrayModel(state);
  const buffer = mergeBufferModel(state);
  return (
    <div className={css['stack']}>
      <p className={css['heading']}>Array A (a hole ∅ means that item is waiting in the buffer)</p>
      <SortBars title={`Array A: ${describeBars(array)}`} model={array} range={range} slots={slots} rows={{ band: true, pointers: true }} />
      <p className={css['heading']}>Buffer B (a hole ∅ means that item has been written back to A)</p>
      <SortBars title={`Buffer B: ${describeBars(buffer)}`} model={buffer} range={range} slots={slots} rows={{ pointers: true, marks: true }} />
    </div>
  );
}

export default function MergesortView({ params, setParams }: ViewProps) {
  const defaults = useMemo(() => ({ items: mergesort.presets[0]?.input.items ?? [] }), []);
  const setup = useSortSetup(params, defaults);
  const trace = useMemo(() => mergesort.run({ items: setup.keys }), [setup.keys]);
  const depth = Math.max(1, ...trace.frames[trace.frames.length - 1]?.state.nodes.map((node) => node.depth + 1) ?? [1]);
  return (
    <Workbench
      algorithm={mergesort}
      trace={trace}
      Renderer={MergesortRenderer}
      inputs={<SortInputFields setup={setup} setParams={setParams} presets={mergesort.presets} />}
      legend={
        <Legend tones={['visited', 'active', 'compare', 'swap', 'done']}
          labels={{ visited: 'in a sorted run, not final', active: 'merged so far', compare: 'being compared', swap: 'just written', done: 'sorted' }} />
      }
      aside={({ frame }) => <CallStackPanel nodes={frame.state.nodes} stack={frame.state.stack} rows={depth} />}
    >
      <GrowthPanel experiments={[mergesortExperiment]} />
    </Workbench>
  );
}
