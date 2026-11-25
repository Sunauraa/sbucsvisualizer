import { SURFACE } from '@core';
import type { Trace } from '@core';
import { Halo, SvgEdge, SvgNode, SvgStage } from '@ui';
import type { RendererProps } from '@ui';
import { bstExtent, bstPlaces } from './algorithms/bst';
import type { BstResult, BstState } from './algorithms/bst';
import css from './structures.module.css';

const SLOT = 36;
const LEVEL = 58;
const R = 16;
const TOP = 54;

const extents = new WeakMap<object, ReturnType<typeof bstExtent>>();
function extentOf(trace: Trace<BstState, BstResult>): ReturnType<typeof bstExtent> {
  let found = extents.get(trace.frames);
  if (!found) {
    found = bstExtent(trace.frames);
    extents.set(trace.frames, found);
  }
  return found;
}

const lg = (n: number): number => Math.floor(Math.log2(n));

/** The tree in words, for the picture's accessible name. */
export function describeBst(state: BstState): string {
  if (state.n === 0) return 'Empty binary search tree';
  return `Binary search tree with ${state.n} ${state.n === 1 ? 'node' : 'nodes'}, height ${state.height ?? 0}. Keys in order: ${state.nodes.map((n) => n.key).join(', ')}`;
}

export function BstRenderer({ frame, trace }: RendererProps<BstState, BstResult>) {
  const s = frame.state;
  const { slots, levels } = extentOf(trace);
  const places = bstPlaces(s);
  const width = Math.max(slots * SLOT + 24, 300);
  const height = TOP + (levels - 1) * LEVEL + 2 * R + 28;
  const offset = ((slots - s.n) * SLOT) / 2;
  const pos = (id: string): { x: number; y: number } => {
    const place = places[id];
    return { x: 12 + offset + SLOT * ((place?.slot ?? 0) + 0.5), y: TOP + R + (place?.depth ?? 0) * LEVEL };
  };
  const byId = new Map(s.nodes.map((node) => [node.id, node]));
  const changed = new Set(s.changedLinks);
  return (
    <div>
      <p className={css['status']} aria-hidden="true">
        <span>
          n = <strong>{s.n}</strong>, height h = <strong>{s.height === null ? 'none (empty tree)' : s.height}</strong>
        </span>
        <span className={css['muted']}>
          {s.n === 0 ? 'The empty tree has no height.' : `For n = ${s.n} the height can be anything from ⌊lg n⌋ = ${lg(s.n)} up to n − 1 = ${s.n - 1}.`}
        </span>
      </p>
      <SvgStage width={width} height={height} title={describeBst(s)} minWidth={width > 340 ? Math.round(width * 0.85) : undefined}>
        {s.nodes.flatMap((node) => [node.left, node.right].flatMap((childId) => {
          const child = childId === null ? undefined : byId.get(childId);
          if (!child) return [];
          return [
            <SvgEdge key={`e-${child.id}`} from={pos(node.id)} to={pos(child.id)} r={R}
              tone={changed.has(child.id) ? 'swap' : 'idle'} />,
          ];
        }))}
        {s.nodes.map((node) => (
          <SvgNode key={node.id} {...pos(node.id)} r={R} label={String(node.key)} tone={s.marks[node.id] ?? 'idle'}
            {...(node.id === s.root ? { tag: 'root' } : {})} />
        ))}
        {s.n === 0 ? <Halo x={width / 2} y={TOP + R + 6} fill={SURFACE.muted}>empty tree</Halo> : null}
        {s.held ? (
          <g>
            <SvgNode x={34} y={26} r={R} label={String(s.held.key)} tone="target" />
            <Halo x={106} y={26} size={13}>in transit, out of the tree</Halo>
          </g>
        ) : null}
      </SvgStage>
    </div>
  );
}
