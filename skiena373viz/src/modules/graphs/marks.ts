/** How a frame's state turns into tones, labels and dashes. Pure, so it can be tested without a DOM. */
import { formatDist } from '@core';
import type { Tone } from '@core';
import type { EdgeMark, VertexMark } from './GraphCanvas';
import type { EdgeRole, GraphState, VertexRow } from './algorithms/types';

/** Dash patterns for the edge classes: never colour alone. Tree edges are solid. */
export const ROLE_STYLE: Readonly<Record<EdgeRole, { tone: Tone; dash?: string; word: string }>> = {
  tree: { tone: 'done', word: 'tree' },
  back: { tone: 'swap', dash: '7 5', word: 'back' },
  forward: { tone: 'visited', dash: '2 5', word: 'fwd' },
  cross: { tone: 'target', dash: '10 4 2 4', word: 'cross' },
  rejected: { tone: 'swap', dash: '7 5', word: 'rejected' },
  cycle: { tone: 'swap', dash: '7 5', word: 'cycle' },
};

/** Algorithms whose edges are labelled with their class as well as drawn in its style. */
const NAMES_CLASSES: ReadonlySet<GraphState['kind']> = new Set(['dfs', 'topological-sort']);

const usesStart = (kind: GraphState['kind']): boolean => kind === 'bfs' || kind === 'dfs' || kind === 'prim' || kind === 'dijkstra';

function subText(kind: GraphState['kind'], v: VertexRow, labelOf: (id: string) => string): string {
  switch (kind) {
    case 'bfs': return v.level === null ? '' : `L${v.level}`;
    case 'dfs':
    case 'topological-sort': return v.entry === null ? '' : `${v.entry}/${v.exit ?? '–'}`;
    case 'prim': return `k=${formatDist(v.status === 'undiscovered' ? null : v.dist)}`;
    case 'dijkstra': return `d=${formatDist(v.status === 'undiscovered' ? null : v.dist)}`;
    case 'kruskal': return v.root === null ? '' : `{${labelOf(v.root)}}`;
  }
}

export function vertexMarks(state: GraphState): Record<string, VertexMark> {
  const out: Record<string, VertexMark> = {};
  const focusEdge = state.focusEdge === null ? null : state.graph.edges.find((e) => e.id === state.focusEdge) ?? null;
  const neighbour = focusEdge === null || state.focusFrom === null
    ? null
    : (focusEdge.source === state.focusFrom ? focusEdge.target : focusEdge.source);
  const ends = focusEdge === null ? [] : [focusEdge.source, focusEdge.target];
  const labels = new Map(state.vertices.map((v) => [v.id, v.label]));
  const labelOf = (id: string): string => labels.get(id) ?? id;
  for (const v of state.vertices) {
    let tone: Tone = 'idle';
    if (state.cycle.includes(v.id)) tone = 'swap';
    else if (state.kind === 'kruskal') tone = ends.includes(v.id) ? 'compare' : 'idle';
    else if (v.id === state.focusVertex) tone = 'active';
    else if (v.id === neighbour) tone = 'compare';
    else if (v.status === 'processed') tone = 'done';
    else if (v.status === 'discovered') tone = 'visited';
    else if (usesStart(state.kind) && v.id === state.start) tone = 'target';
    const sub = subText(state.kind, v, labelOf);
    const tag = usesStart(state.kind) && v.id === state.start ? 'start' : undefined;
    out[v.id] = { tone, ...(sub === '' ? {} : { sub }), ...(tag ? { tag } : {}) };
  }
  return out;
}

export function edgeMarks(state: GraphState): Record<string, EdgeMark> {
  const out: Record<string, EdgeMark> = {};
  for (const edge of state.graph.edges) {
    const role = state.edgeRoles[edge.id];
    const focus = state.focusEdge === edge.id;
    const weight = edge.weight === null ? '' : String(edge.weight);
    const mark: { tone?: Tone; dash?: string; label?: string; focus?: boolean; from?: string } = {};
    if (role !== undefined) {
      const style = ROLE_STYLE[role];
      mark.tone = style.tone;
      if (style.dash) mark.dash = style.dash;
      if (NAMES_CLASSES.has(state.kind) || role === 'cycle') mark.label = [style.word, weight].filter((x) => x !== '').join(' ');
      else if (role === 'rejected') mark.label = ['✗', weight].filter((x) => x !== '').join(' ');
    } else if (focus) {
      mark.tone = 'compare';
    }
    if (focus) {
      mark.focus = true;
      if (state.focusFrom !== null) mark.from = state.focusFrom;
    }
    if (Object.keys(mark).length > 0) out[edge.id] = mark;
  }
  return out;
}
