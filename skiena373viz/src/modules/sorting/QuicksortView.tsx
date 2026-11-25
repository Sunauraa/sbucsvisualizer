import { useMemo } from 'react';
import type { ViewProps } from '@core';
import { GrowthPanel, Legend, Workbench } from '@ui';
import type { RendererProps } from '@ui';
import { quicksortExperiment } from './algorithms/experiments';
import { PIVOT_LABELS, quicksort } from './algorithms/quicksort';
import type { QuicksortState } from './algorithms/quicksort';
import type { SortResult } from './algorithms/common';
import { quickModel } from './barModels';
import { CallStackPanel } from './CallStack';
import { describeBars, keyRange, SortBars } from './SortBars';
import { SortInputFields, useSortSetup } from './SortInputs';
import css from './sorting.module.css';

export function QuicksortRenderer({ frame, trace }: RendererProps<QuicksortState, SortResult>) {
  const { state } = frame;
  const first = trace.frames[0]?.state ?? state;
  const model = quickModel(state);
  return (
    <div className={css['stack']}>
      <p className={css['heading']}>Array A: positions left of store hold keys less than the pivot p</p>
      <SortBars title={`Array: ${describeBars(model)}`} model={model} range={keyRange(first.items.map((item) => item.key))}
        slots={first.items.length} rows={{ band: true, pointers: true, marks: true }} />
    </div>
  );
}

export function QuicksortNotes() {
  return (
    <section className="panel" aria-label="Why sorted input is the worst case">
      <h3>Why a sorted list is the worst case for the last-item pivot</h3>
      <ul className={css['notes']}>
        <li>With the last item as pivot on a sorted list, the pivot is the largest key, so nothing lands on its right and all n - 1 others land on its left.</li>
        <li>The next call then has n - 1 items and the same problem, so the partitions cost n - 1, n - 2, ..., 1 comparisons: n(n - 1)/2 in all, which is Θ(n²).</li>
        <li>A random pivot or the median of three breaks this pattern on sorted input; the recursion tree view shows the difference.</li>
      </ul>
    </section>
  );
}

export default function QuicksortView({ params, setParams }: ViewProps) {
  const defaults = useMemo(() => ({ items: quicksort.presets[0]?.input.items ?? [] }), []);
  const setup = useSortSetup(params, defaults);
  const trace = useMemo(() => quicksort.run(setup.input), [setup.input]);
  const depth = Math.max(1, ...trace.frames[trace.frames.length - 1]?.state.nodes.map((node) => node.depth + 1) ?? [1]);
  return (
    <Workbench
      algorithm={quicksort}
      trace={trace}
      Renderer={QuicksortRenderer}
      inputs={<SortInputFields setup={setup} setParams={setParams} presets={quicksort.presets} withPivot />}
      legend={
        <Legend tones={['target', 'compare', 'swap', 'done']}
          labels={{ target: 'the pivot', compare: 'being compared', swap: 'just swapped', done: 'in its final place' }} />
      }
      aside={({ frame }) => (
        <>
          <section className="panel" aria-label="Partition status">
            <h3>Partition</h3>
            <p className={css['stateLine']}>Pivot rule: {PIVOT_LABELS[frame.state.rule]}</p>
            <p className={css['stateLine']}>
              {frame.state.range ? `Range A[${frame.state.range[0]}..${frame.state.range[1] - 1}]` : 'No partition running.'}
              {frame.state.store !== null ? `, store ${frame.state.store}` : ''}
            </p>
          </section>
          <CallStackPanel nodes={frame.state.nodes} stack={frame.state.stack} rows={depth} />
        </>
      )}
    >
      <QuicksortNotes />
      <GrowthPanel experiments={[quicksortExperiment]} />
    </Workbench>
  );
}
