import { useMemo } from 'react';
import type { ViewProps } from '@core';
import { GrowthPanel, Legend, Workbench } from '@ui';
import type { RendererProps } from '@ui';
import { heapsort } from './algorithms/heapsort';
import type { HeapsortState } from './algorithms/heapsort';
import { heapsortExperiment } from './algorithms/experiments';
import type { SortResult } from './algorithms/common';
import { heapModel, heapTone } from './barModels';
import { HeapTree } from './HeapTree';
import { describeBars, keyRange, SortBars } from './SortBars';
import { SortInputFields, useSortSetup } from './SortInputs';
import css from './sorting.module.css';

/** Renderer: the heap tree and the array under it, both from one frame. */
export function HeapsortRenderer({ frame, trace }: RendererProps<HeapsortState, SortResult>) {
  const { state } = frame;
  const first = trace.frames[0]?.state ?? state;
  const range = keyRange(first.items.map((item) => item.key));
  const model = heapModel(state);
  const tones = state.items.map((_item, p) => heapTone(state, p));
  return (
    <div className={css['stack']}>
      <p className={css['heading']}>Heap tree: the children of position p are 2p + 1 and 2p + 2</p>
      <HeapTree items={state.items} labels={state.labels} tones={tones} heapSize={state.heapSize}
        title={`Heap tree of ${state.items.length} items, heap size ${state.heapSize}`} />
      <p className={css['heading']}>The same array</p>
      <SortBars title={`Array: ${describeBars(model)}`} model={model} range={range} slots={first.items.length}
        rows={{ pointers: true, marks: true }} />
    </div>
  );
}

export const HEAP_NOTE = 'Heapsort works inside the array: first it rearranges the array into a max-heap, then it repeatedly swaps the root (the maximum) to the end and sifts the new root down.';

export default function HeapsortView({ params, setParams }: ViewProps) {
  const defaults = useMemo(() => ({ items: heapsort.presets[0]?.input.items ?? [] }), []);
  const setup = useSortSetup(params, defaults);
  const trace = useMemo(() => heapsort.run({ items: setup.keys }), [setup.keys]);
  return (
    <Workbench
      algorithm={heapsort}
      trace={trace}
      Renderer={HeapsortRenderer}
      inputs={<SortInputFields setup={setup} setParams={setParams} presets={heapsort.presets} />}
      legend={
        <Legend tones={['active', 'compare', 'swap', 'done']}
          labels={{ active: 'being sifted down', compare: 'being compared', swap: 'just swapped', done: 'sorted suffix, final' }} />
      }
      aside={({ frame }) => (
        <section className="panel" aria-label="Heap status">
          <h3>Heap status</h3>
          <p className={css['stateLine']}>
            Heap size {frame.state.heapSize} of {frame.state.items.length}; sorted suffix {frame.state.items.length - frame.state.heapSize}.
          </p>
          <p className={css['stateLine']}>
            {frame.state.phase === 'setup' ? 'Not started: the array is in input order.' : null}
            {frame.state.phase === 'build' ? `Building the heap from the last parent upward. ${frame.state.settled ? '' : 'The whole array is not a heap yet.'}` : null}
            {frame.state.phase === 'built' ? 'The array is a max-heap: every parent is at least as large as its children.' : null}
            {frame.state.phase === 'extract' ? `The heap part ${frame.state.settled ? 'is a valid max-heap.' : 'is being repaired after the swap.'}` : null}
            {frame.state.phase === 'done' ? 'Sorted.' : null}
          </p>
        </section>
      )}
    >
      <GrowthPanel experiments={[heapsortExperiment]} />
    </Workbench>
  );
}
