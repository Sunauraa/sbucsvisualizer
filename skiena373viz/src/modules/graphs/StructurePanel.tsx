/** The aside: the queue / stack / priority queue / sorted edge list with its ends named, and the vertex table. */
import { formatDist } from '@core';
import type { Tone } from '@core';
import { CellRow, ScrollX } from '@ui';
import type { CellSpec } from '@ui';
import type { Container, GraphState, ItemKind, VertexRow } from './algorithms/types';
import styles from './graphs.module.css';

const ITEM_TONE: Readonly<Record<ItemKind, Tone>> = { normal: 'idle', current: 'active', stale: 'swap', kept: 'done', rejected: 'swap' };
const ITEM_WORD: Partial<Record<ItemKind, string>> = { current: 'cursor', kept: 'kept', rejected: 'cycle' };

/** Room a container needs anywhere in the trace, so its row never changes size while stepping. */
export interface RowLayout {
  readonly slots: number;
  readonly cellWidth: number;
}

export function slotsFor(frames: readonly { readonly state: GraphState }[]): Readonly<Record<string, RowLayout>> {
  const seen: Record<string, { slots: number; text: number; ends: number }> = {};
  for (const frame of frames) {
    for (const c of frame.state.containers) {
      const at = seen[c.id] ?? { slots: 0, text: 0, ends: 0 };
      at.slots = Math.max(at.slots, c.items.length);
      for (const item of c.items) at.text = Math.max(at.text, item.text.length + 2);
      at.ends = Math.max(at.ends, c.items.length === 1 ? c.left.length + c.right.length + 1 : 6);
      seen[c.id] = at;
    }
  }
  return Object.fromEntries(Object.entries(seen).map(([id, at]) => [id, { slots: at.slots, cellWidth: Math.max(52, at.text * 7 + 16, at.ends * 7 + 8) }]));
}

function cellsOf(container: Container): CellSpec[] {
  const last = container.items.length - 1;
  return container.items.map((item, i): CellSpec => {
    const ends = [i === 0 ? container.left : null, i === last ? container.right : null].filter((x): x is string => x !== null);
    const word = ITEM_WORD[item.kind];
    const pointer = ends.length > 0 ? ends.join('/') : word;
    return {
      text: item.kind === 'stale' ? `${item.text} ✗` : item.text,
      tone: ITEM_TONE[item.kind],
      ...(pointer ? { pointer } : {}),
    };
  });
}

function ContainerView({ container, layout }: { readonly container: Container; readonly layout: RowLayout }) {
  const cells = cellsOf(container);
  const listed = container.id === 'pq' || container.id === 'edges';
  return (
    <section className={styles['container']} aria-label={container.title}>
      <h4>{container.title}</h4>
      <CellRow title={`${container.title}: ${container.items.length === 0 ? 'empty' : container.items.map((i) => i.note).join('; ')}`}
        cells={cells} slots={Math.max(1, layout.slots)} showIndexes={false} cellWidth={layout.cellWidth}
        emptyText={`empty (${container.left} to ${container.right})`} />
      {listed ? (
        <ol className={styles['entries']} aria-label={`${container.title}, in words`}>
          {container.items.length === 0 ? <li className="muted">empty</li> : container.items.map((item, i) => <li key={i}>{item.note}</li>)}
        </ol>
      ) : null}
    </section>
  );
}

const STATUS_WORDS: Readonly<Record<GraphState['kind'], readonly [string, string, string]>> = {
  bfs: ['undiscovered', 'in the queue', 'processed'],
  dfs: ['undiscovered', 'on the stack', 'finished'],
  'topological-sort': ['undiscovered', 'on the stack', 'finished'],
  prim: ['not reached', 'has a key', 'in the tree'],
  kruskal: ['', '', ''],
  dijkstra: ['unreached', 'tentative', 'final'],
};

interface Column {
  readonly head: string;
  readonly cell: (v: VertexRow, state: GraphState) => string;
}

const labelOf = (state: GraphState, id: string | null): string => (id === null ? '—' : state.vertices.find((v) => v.id === id)?.label ?? id);
const dash = (value: number | null): string => (value === null ? '—' : String(value));

function columns(state: GraphState): readonly Column[] {
  const status: Column = { head: 'State', cell: (v) => STATUS_WORDS[state.kind][v.status === 'undiscovered' ? 0 : v.status === 'discovered' ? 1 : 2] };
  const parent: Column = { head: 'Parent', cell: (v) => labelOf(state, v.parent) };
  switch (state.kind) {
    case 'bfs': return [status, parent, { head: 'Level', cell: (v) => dash(v.level) }, { head: 'Component', cell: (v) => dash(v.component) }];
    case 'dfs':
    case 'topological-sort': return [status, parent, { head: 'Entry', cell: (v) => dash(v.entry) }, { head: 'Exit', cell: (v) => dash(v.exit) }];
    case 'prim': return [status, { head: 'Key', cell: (v) => (v.status === 'undiscovered' ? '∞' : formatDist(v.dist)) }, parent];
    case 'dijkstra': return [status, { head: 'Distance', cell: (v) => (v.status === 'undiscovered' ? '∞' : formatDist(v.dist)) }, parent];
    case 'kruskal': return [
      { head: 'Set', cell: (v) => labelOf(state, v.root) },
      { head: 'Union-find parent', cell: (v) => (v.parent === v.id ? 'itself (root)' : labelOf(state, v.parent)) },
      { head: 'Set size', cell: (v) => dash(v.size) },
    ];
  }
}

export function VertexTable({ state }: { readonly state: GraphState }) {
  const cols = columns(state);
  if (state.vertices.length === 0) return <p className="muted">There are no vertices yet.</p>;
  return (
    <ScrollX label="Vertex table">
      <table className={styles['table']}>
        <caption className="muted small">Vertices, one row each</caption>
        <thead>
          <tr><th scope="col" className={styles['now']}><span className={styles['srOnly']}>current</span></th><th scope="col">Vertex</th>{cols.map((c) => <th key={c.head} scope="col">{c.head}</th>)}</tr>
        </thead>
        <tbody>
          {state.vertices.map((v) => {
            const now = v.id === state.focusVertex;
            return (
              <tr key={v.id} aria-current={now ? 'true' : undefined} className={now ? styles['rowNow'] : undefined}>
                <td className={styles['now']} aria-hidden="true">{now ? '▸' : ''}</td>
                <th scope="row">{v.label}</th>
                {cols.map((c) => <td key={c.head}>{c.cell(v, state)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollX>
  );
}

export function StructurePanel({ state, slots }: { readonly state: GraphState; readonly slots: Readonly<Record<string, RowLayout>> }) {
  return (
    <section className="panel" aria-label="Data structure and vertex table" data-player-keys="arrows">
      {state.containers.map((c) => <ContainerView key={c.id} container={c} layout={slots[c.id] ?? { slots: c.items.length, cellWidth: 60 }} />)}
      <h4>Per-vertex values</h4>
      <VertexTable state={state} />
    </section>
  );
}
