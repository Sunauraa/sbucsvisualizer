/** Example graphs for the six views, written as text and laid out once, deterministically. */
import { forceLayout, parseGraph } from '@core';
import type { Preset } from '@core';
import type { AlgoKind, GraphInput } from './types';

interface Spec {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly directed: boolean;
  readonly weighted: boolean;
  readonly start?: string;
}

function build(spec: Spec): Preset<GraphInput> {
  const parsed = parseGraph(spec.text, { directed: spec.directed, weighted: spec.weighted });
  if (!parsed.ok) throw new Error(`preset ${spec.id}: ${parsed.message}`);
  return { id: spec.id, label: spec.label, input: { graph: forceLayout(parsed.value), start: spec.start ?? null } };
}

const unweighted = (id: string, label: string, text: string, start?: string): Spec => ({ id, label, text, directed: false, weighted: false, ...(start ? { start } : {}) });
const digraph = (id: string, label: string, text: string, start?: string): Spec => ({ id, label, text, directed: true, weighted: false, ...(start ? { start } : {}) });
const weightedUndirected = (id: string, label: string, text: string, start?: string): Spec => ({ id, label, text, directed: false, weighted: true, ...(start ? { start } : {}) });
const weightedDirected = (id: string, label: string, text: string, start?: string): Spec => ({ id, label, text, directed: true, weighted: true, ...(start ? { start } : {}) });

const MST_SPECS: readonly Spec[] = [
  weightedUndirected('classic', 'Six vertices, one cycle choice at a time', 'A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3', 'A'),
  weightedUndirected('ties', 'Equal weights: ties broken by label', 'A-B:1, A-C:1, B-C:1, B-D:2, C-D:2', 'A'),
  weightedUndirected('disconnected', 'Disconnected: no spanning tree', 'A-B:3, B-C:1, A-C:2, D-E:4', 'A'),
  weightedUndirected('negative', 'Negative weights are fine here', 'A-B:-2, B-C:3, A-C:1, C-D:-1', 'A'),
];

const SPECS: Readonly<Record<AlgoKind, readonly Spec[]>> = {
  bfs: [
    unweighted('levels', 'Levels and a cycle', 'A-B, A-C, B-D, B-E, C-F, E-F, D-G', 'A'),
    unweighted('components', 'Two components and an isolated vertex', 'A-B, B-C, A-C, D-E, F', 'A'),
    digraph('directed', 'Directed: a restart is needed', 'A>B, A>C, B>D, C>D, D>E, F>A', 'A'),
    unweighted('loop', 'A self-loop', 'A-A, A-B, B-C, D', 'A'),
  ],
  dfs: [
    digraph('four-kinds', 'Directed: tree, back, forward and cross edges', 'A>B, B>C, C>A, A>C, A>D, D>C', 'A'),
    unweighted('undirected', 'Undirected: tree and back edges only', 'A-B, A-C, B-C, B-D, C-E, D-E', 'A'),
    unweighted('forest', 'Several trees', 'A-B, C-D, E', 'A'),
  ],
  'topological-sort': [
    digraph('dag', 'A small dependency graph', 'A>C, B>C, C>D, C>E, D>F, E>F, B>E'),
    digraph('cycle', 'A cycle: no order exists', 'A>B, B>D, D>C, C>B, A>E'),
    digraph('two-cycle', 'A two-vertex cycle', 'A>B, B>A'),
    digraph('pieces', 'Several pieces', 'A>B, C>D, E'),
  ],
  prim: MST_SPECS,
  kruskal: MST_SPECS,
  dijkstra: [
    weightedDirected('directed', 'Directed, weighted', 'A>B:4, A>C:1, C>B:2, B>D:1, C>D:5, D>E:3, A>F:9, E>F:1', 'A'),
    weightedDirected('stale', 'A better route replaces an earlier entry', 'A>B:10, A>C:3, C>B:4, B>D:2, C>D:12', 'A'),
    weightedDirected('unreachable', 'Unreachable vertices stay at infinity', 'A>B:2, B>C:2, D>A:1, E', 'A'),
    weightedDirected('zero', 'Zero weights', 'A>B:0, B>C:0, A>C:1, C>D:2', 'A'),
    weightedUndirected('undirected', 'Undirected, weighted', 'A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3', 'A'),
    weightedDirected('negative', 'A negative edge: refused', 'A>B:2, B>C:-3, A>C:1', 'A'),
  ],
};

const cache = new Map<AlgoKind, readonly Preset<GraphInput>[]>();

export function presetsFor(kind: AlgoKind): readonly Preset<GraphInput>[] {
  const known = cache.get(kind);
  if (known) return known;
  const made = SPECS[kind].map(build);
  cache.set(kind, made);
  return made;
}
