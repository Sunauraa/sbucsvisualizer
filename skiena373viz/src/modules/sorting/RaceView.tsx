import { useMemo } from 'react';
import { frameAt } from '@core';
import type { OpCounts, Trace, ViewProps } from '@core';
import { Caption, Legend, PlayerControls, usePlayer, usePlayerKeys } from '@ui';
import type { Player } from '@ui';
import { heapsort } from './algorithms/heapsort';
import { mergesort } from './algorithms/mergesort';
import { quicksort } from './algorithms/quicksort';
import { PIVOT_LABELS } from './algorithms/quicksort';
import type { SortResult } from './algorithms/common';
import { describeRanking, finishTick, laneIndex, raceLength } from './algorithms/race';
import type { AlignMode, TimedFrame } from './algorithms/race';
import { heapModel, mergeArrayModel, mergeBufferModel, quickModel } from './barModels';
import { describeBars, keyRange, SortBars } from './SortBars';
import type { BarModel } from './SortBars';
import { SortInputFields, useSortSetup } from './SortInputs';
import css from './sorting.module.css';

interface LaneBars {
  readonly title: string;
  readonly model: BarModel;
  readonly rows: { readonly band?: boolean; readonly pointers?: boolean; readonly marks?: boolean };
}

/** One lane, with its trace and its bar models closed over, so the view needs no casts. */
interface LaneSpec {
  readonly id: string;
  readonly name: string;
  readonly frames: readonly TimedFrame[];
  readonly at: (index: number) => { readonly ops: OpCounts; readonly explanation: string; readonly views: readonly LaneBars[] };
}

function laneOf<S>(id: string, name: string, trace: Trace<S, SortResult>, models: (state: S) => readonly LaneBars[]): LaneSpec {
  return {
    id, name, frames: trace.frames,
    at: (index) => {
      const frame = frameAt(trace.frames, index);
      return { ops: frame.ops, explanation: frame.explanation, views: models(frame.state) };
    },
  };
}

const OPS = [['comparisons', 'Comparisons'], ['swaps', 'Swaps'], ['writes', 'Writes']] as const;

/** One lane: a name, a status, the counts, the bars of the frame this tick selects, and that frame's sentence. */
function Lane({ spec, tick, mode, range, slots }: {
  readonly spec: LaneSpec; readonly tick: number; readonly mode: AlignMode;
  readonly range: { readonly min: number; readonly max: number }; readonly slots: number;
}) {
  const frame = spec.at(laneIndex(spec.frames, tick, mode));
  const done = tick >= finishTick(spec.frames, mode);
  const views = frame.views;
  return (
    <section className={css['lane']} aria-label={`${spec.name} lane`}>
      <div className={css['laneHead']}>
        <h3 className={css['laneName']}>{spec.name}</h3>
        <span className={`${css['status']} ${done ? css['statusDone'] : ''}`}>{done ? '✓ finished' : 'running'}</span>
        <dl className={css['counts']}>
          {OPS.map(([id, label]) => (
            <div key={id}><dt>{label}</dt><dd>{frame.ops[id] ?? 0}</dd></div>
          ))}
        </dl>
      </div>
      {views.map((view) => (
        <SortBars key={view.title} title={`${spec.name} ${view.title}: ${describeBars(view.model)}`} model={view.model} range={range}
          slots={slots} slot={30} barHeight={70} rows={view.rows} />
      ))}
      <p className={css['laneSay']}>{frame.explanation}</p>
    </section>
  );
}

export default function RaceView({ params, setParams }: ViewProps) {
  const setup = useSortSetup(params, { items: [5, 2, 9, 1, 7, 3, 8, 4, 6, 12, 10, 11] });
  const mode: AlignMode = params['align'] === 'steps' ? 'steps' : 'comparisons';
  const traces = useMemo(() => ({
    heap: heapsort.run({ items: setup.keys }),
    merge: mergesort.run({ items: setup.keys }),
    quick: quicksort.run(setup.input),
  }), [setup.keys, setup.input]);

  const lanes = useMemo<readonly LaneSpec[]>(() => [
    laneOf('heap', 'Heapsort', traces.heap, (state) => [{ title: 'array', model: heapModel(state), rows: { marks: true, pointers: true } }]),
    laneOf('merge', 'Mergesort', traces.merge, (state) => [
      { title: 'array', model: mergeArrayModel(state), rows: { band: true, pointers: true } },
      { title: 'buffer', model: mergeBufferModel(state), rows: { marks: true, pointers: true } },
    ]),
    laneOf('quick', `Quicksort (${PIVOT_LABELS[setup.pivot]} pivot)`, traces.quick, (state) => [
      { title: 'array', model: quickModel(state), rows: { band: true, pointers: true, marks: true } },
    ]),
  ], [traces, setup.pivot]);

  const frameLists = lanes.map((lane) => lane.frames);
  const source = useMemo(() => ({ traces, mode }), [traces, mode]);
  const player: Player = usePlayer({ frameCount: raceLength(frameLists, mode), source });
  usePlayerKeys(player);
  const tick = player.index;
  const range = keyRange(setup.keys);
  const slots = Math.max(1, setup.keys.length);
  const ranking = describeRanking(lanes.map((lane) => ({ name: lane.name, tick: finishTick(lane.frames, mode) })), tick, mode);

  return (
    <div className="workbench">
      <section className="workbench-inputs" aria-label="Input">
        <SortInputFields setup={setup} setParams={setParams} presets={quicksort.presets.concat(heapsort.presets)} withPivot />
        <fieldset className={css['align']}>
          <legend>One tick is</legend>
          <label>
            <input type="radio" name="align" checked={mode === 'comparisons'} onChange={() => setParams({ align: null })} />
            one key comparison (fair across the lanes)
          </label>
          <label>
            <input type="radio" name="align" checked={mode === 'steps'} onChange={() => setParams({ align: 'steps' })} />
            one recorded step
          </label>
        </fieldset>
      </section>
      <PlayerControls player={player} />
      <Caption
        text={mode === 'comparisons'
          ? `Tick ${tick}: each lane has made at most ${tick} comparisons, and shows everything it does before its next comparison.`
          : `Step ${tick}: each lane shows its own step ${tick}, or its last step once it is done.`}
        playing={player.playing}
      />
      <div className={css['lanes']} style={{ marginTop: 12 }}>
        {lanes.map((lane) => <Lane key={lane.id} spec={lane} tick={tick} mode={mode} range={range} slots={slots} />)}
      </div>
      <section className="panel" aria-label="Finishing order" style={{ marginTop: 12 }}>
        <h3>Finishing order</h3>
        <ol className={css['ranking']} aria-live="polite" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {ranking.map((line) => <li key={line}>{line}</li>)}
        </ol>
        <p className="muted small">
          Comparisons are the fair measure here: all three sorts count them the same way. Swaps and writes differ, because mergesort writes through a buffer and heapsort and quicksort swap inside the array.
        </p>
      </section>
      <div style={{ marginTop: 12 }}>
        <Legend tones={['active', 'compare', 'swap', 'visited', 'done', 'target']}
          labels={{ active: 'heap root being sifted, or merged so far', compare: 'being compared', swap: 'just swapped or written', visited: 'sorted run, not final', done: 'final place', target: 'quicksort pivot' }} />
      </div>
    </div>
  );
}
