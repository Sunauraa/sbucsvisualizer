import { useMemo } from 'react';
import { SURFACE, TONES } from '@core';
import type { Tone, ViewProps } from '@core';
import { Field, Legend, SvgStage, ToneGlyph, Workbench } from '@ui';
import type { RendererProps } from '@ui';
import { mergesort } from './algorithms/mergesort';
import type { MergesortState } from './algorithms/mergesort';
import { quicksort } from './algorithms/quicksort';
import type { QuicksortState } from './algorithms/quicksort';
import type { CallNode, SortResult } from './algorithms/common';
import { plural } from './algorithms/common';
import { levelCosts, layoutTree, levelSummary } from './algorithms/tree';
import type { TreeLayout } from './algorithms/tree';
import { keyRange } from './SortBars';
import { mergeArrayModel, quickModel } from './barModels';
import { describeBars, slotFor, SortBars } from './SortBars';
import { SortInputFields, useSortSetup } from './SortInputs';
import css from './sorting.module.css';

const COST_W = 190;

interface TreeState {
  readonly nodes: readonly CallNode[];
  readonly stack: readonly number[];
  readonly labels: readonly string[];
}

const trim = (text: string, room: number): string => (text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1))}…`);

function toneOf(node: CallNode, stack: readonly number[]): Tone {
  if (node.status === 'done') return 'done';
  return stack[stack.length - 1] === node.id ? 'active' : 'visited';
}

/** The tree so far, in a box sized by the finished tree, with each level's cost in a column on the right. */
export function TreeCanvas({ state, layout, title }: { readonly state: TreeState; readonly layout: TreeLayout; readonly title: string }) {
  const { nodes, stack, labels } = state;
  const width = layout.width + COST_W;
  const costs = levelCosts(nodes);
  const shown = new Set(nodes.map((node) => node.id));
  const ids = (node: CallNode): readonly number[] => (node.status === 'done' && node.out ? node.out : node.ids);
  return (
    <SvgStage width={width} height={layout.height + 8} title={title} minWidth={Math.round(width * 0.7)}>
      <text x={layout.width + 8} y={12} fontSize={12} fontWeight={700} fill={SURFACE.muted}>cost of each level</text>
      {Array.from({ length: layout.depthCount }, (_, depth) => {
        const row = costs[depth];
        const y = 22 + depth * layout.rowHeight + layout.boxHeight / 2;
        return (
          <g key={`level${depth}`}>
            <line x1={4} x2={width - 4} y1={y + layout.rowHeight / 2 - 1} y2={y + layout.rowHeight / 2 - 1} stroke={SURFACE.grid} />
            <text x={layout.width + 8} y={y - 6} fontSize={12} fontWeight={700} fill={SURFACE.ink}>level {depth}</text>
            <text x={layout.width + 8} y={y + 9} fontSize={12} fill={row ? SURFACE.ink : SURFACE.muted}>
              {row ? `${plural(row.comparisons, 'comparison')}, ${plural(row.items, 'item')}` : 'not reached yet'}
            </text>
          </g>
        );
      })}
      {nodes.map((node) => {
        const parent = node.parent === null ? null : layout.placed[node.parent];
        const at = layout.placed[node.id];
        if (!parent || !at || node.parent === null || !shown.has(node.parent)) return null;
        return <line key={`edge${node.id}`} x1={parent.x} y1={parent.y + layout.boxHeight} x2={at.x} y2={at.y} stroke={SURFACE.muted} strokeWidth={1.5} />;
      })}
      {nodes.map((node) => {
        const at = layout.placed[node.id];
        if (!at) return null;
        const tone = toneOf(node, stack);
        const style = TONES[tone];
        const size = node.hi - node.lo;
        const room = Math.floor((at.w - 8) / 6.4);
        const values = ids(node).map((id) => labels[id] ?? '?').join(' ');
        const range = size === 1 ? `[${node.lo}]` : `[${node.lo}..${node.hi - 1}]`;
        const pivot = node.pivot !== null && size > 1 ? ` p=${labels[node.pivot] ?? '?'}` : '';
        return (
          <g key={`node${node.id}`} role="img" aria-label={`Call on positions ${node.lo} to ${node.hi - 1}, ${node.status === 'done' ? 'returned' : stack[stack.length - 1] === node.id ? 'running now' : 'waiting'}, items ${values}`}>
            <rect x={at.x - at.w / 2} y={at.y} width={at.w} height={layout.boxHeight} rx={6} fill={style.soft} stroke={style.color} strokeWidth={tone === 'idle' ? 1.5 : 2.5} />
            <text x={at.x} y={at.y + 13} textAnchor="middle" fontSize={11} fontWeight={700} fill={SURFACE.ink}>{trim(`${range}${pivot}`, room)}</text>
            <text x={at.x} y={at.y + 27} textAnchor="middle" fontSize={11} fill={SURFACE.ink}>{trim(values, room)}</text>
            <ToneGlyph x={at.x + at.w / 2 - 2} y={at.y + 1} tone={tone} r={6} />
          </g>
        );
      })}
    </SvgStage>
  );
}

function useLayout(trace: { readonly frames: readonly { readonly state: TreeState }[] }): TreeLayout {
  return useMemo(() => layoutTree(trace.frames[trace.frames.length - 1]?.state.nodes ?? []), [trace]);
}

const HOLE_NOTE = 'The array at this step (a hole ∅ means that item is waiting in the merge buffer)';

export function MergeTreeRenderer({ frame, trace }: RendererProps<MergesortState, SortResult>) {
  const layout = useLayout(trace);
  const first = trace.frames[0]?.state ?? frame.state;
  const model = mergeArrayModel(frame.state);
  return (
    <div className={css['stack']}>
      <TreeCanvas state={frame.state} layout={layout} title={`Mergesort call tree, ${frame.state.nodes.length} calls so far`} />
      <p className={css['heading']}>{HOLE_NOTE}</p>
      <SortBars title={`Array: ${describeBars(model)}`} model={model} range={keyRange(first.items.flatMap((item) => (item ? [item.key] : [])))}
        slots={first.items.length} rows={{ band: true }} barHeight={60} slot={slotFor(first.items.length, true)} />
    </div>
  );
}

export function QuickTreeRenderer({ frame, trace }: RendererProps<QuicksortState, SortResult>) {
  const layout = useLayout(trace);
  const first = trace.frames[0]?.state ?? frame.state;
  const model = quickModel(frame.state);
  return (
    <div className={css['stack']}>
      <TreeCanvas state={frame.state} layout={layout} title={`Quicksort call tree, ${frame.state.nodes.length} calls so far`} />
      <p className={css['heading']}>The array at this step</p>
      <SortBars title={`Array: ${describeBars(model)}`} model={model} range={keyRange(first.items.map((item) => item.key))}
        slots={first.items.length} rows={{ band: true }} barHeight={60} slot={slotFor(first.items.length, true)} />
    </div>
  );
}

function LevelsPanel({ nodes, n }: { readonly nodes: readonly CallNode[]; readonly n: number }) {
  const rows = levelCosts(nodes);
  return (
    <section className="panel" aria-label="Cost per level">
      <h3>Cost per level</h3>
      <p className={css['stateLine']} style={{ minHeight: '3em' }}>{levelSummary(nodes, n)}</p>
      <div className="scroll-x">
        <table className={css['levels']}>
          <thead><tr><th scope="col">Level</th><th scope="col">Calls</th><th scope="col">Items</th><th scope="col">Comparisons</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.depth}><th scope="row">{row.depth}</th><td>{row.calls}</td><td>{row.items}</td><td>{row.comparisons}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TreeNotes({ which }: { readonly which: 'merge' | 'quick' }) {
  return (
    <section className="panel" aria-label="Where n log n comes from" style={{ marginTop: 'var(--gap)' }}>
      <h3>Where n log n comes from: levels times work per level</h3>
      <ul className={css['notes']}>
        {which === 'merge' ? (
          <>
            <li>Every call splits its range in half, so the tree has about log₂ n levels.</li>
            <li>On each level the merges together handle all n items once, with at most n - 1 comparisons, so a level costs at most about n.</li>
            <li>Levels times cost per level: about n log₂ n comparisons, whatever order the input is in.</li>
          </>
        ) : (
          <>
            <li>A call partitions its range around one pivot, spending one comparison for each other item in the range.</li>
            <li>When the pivot splits the range about in half, the tree has about log₂ n levels and each level costs at most about n, which gives n log n.</li>
            <li>When the pivot is always the smallest or largest key, as with the last item of a sorted list, each call has one child that is only one item shorter, so the tree becomes a path of n levels costing n - 1, n - 2, ..., 1: about n²/2 in all.</li>
          </>
        )}
      </ul>
    </section>
  );
}

export default function RecursionTreeView({ params, setParams }: ViewProps) {
  const which = params['alg'] === 'quicksort' ? 'quick' : 'merge';
  const setup = useSortSetup(params, { items: which === 'quick' ? [1, 2, 3, 4, 5, 6, 7, 8] : [5, 2, 9, 1, 7, 3, 8, 4, 6] });
  const mergeTrace = useMemo(() => mergesort.run({ items: setup.keys }), [setup.keys]);
  const quickTrace = useMemo(() => quicksort.run(setup.input), [setup.input]);
  const choose = (
    <Field label="Algorithm">
      {(props) => (
        <select {...props} value={which} onChange={(event) => setParams({ alg: event.target.value === 'quick' ? 'quicksort' : 'mergesort' })}>
          <option value="merge">Mergesort</option>
          <option value="quick">Quicksort</option>
        </select>
      )}
    </Field>
  );
  const inputs = (
    <>
      <div className="field-row">{choose}</div>
      <SortInputFields setup={setup} setParams={setParams} presets={which === 'quick' ? quicksort.presets : mergesort.presets} withPivot={which === 'quick'} />
    </>
  );
  const legend = (
    <Legend tones={['active', 'visited', 'done']} labels={{ active: 'the call running now', visited: 'on the stack, waiting for its calls', done: 'returned' }} />
  );
  const n = setup.keys.length;
  return which === 'quick' ? (
    <Workbench algorithm={quicksort} trace={quickTrace} Renderer={QuickTreeRenderer} inputs={inputs} legend={legend}
      aside={({ frame }) => <LevelsPanel nodes={frame.state.nodes} n={n} />}>
      <TreeNotes which="quick" />
    </Workbench>
  ) : (
    <Workbench algorithm={mergesort} trace={mergeTrace} Renderer={MergeTreeRenderer} inputs={inputs} legend={legend}
      aside={({ frame }) => <LevelsPanel nodes={frame.state.nodes} n={n} />}>
      <TreeNotes which="merge" />
    </Workbench>
  );
}
