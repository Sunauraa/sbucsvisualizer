/** Growth experiments: a sparse case (E = 2V) and a dense case (complete graph), with n = V. */
import { edgeId, experimentFor } from '@core';
import type { Graph, GraphEdge, GrowthExperiment, Rng } from '@core';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { dijkstra } from './dijkstra';
import { kruskal } from './kruskal';
import { prim } from './prim';
import { topologicalSort } from './topologicalSort';
import type { GraphInput } from './types';

type Shape = 'sparse' | 'dense';

interface Spec {
  readonly directed: boolean;
  readonly weighted: boolean;
  /** Edges only run from a lower to a higher vertex number, so the graph has no cycle. */
  readonly acyclic?: boolean;
}

/**
 * A connected graph on n vertices. Sparse: a random spanning tree plus random extra edges up to 2n edges.
 * Dense: every possible edge. Positions are all (0, 0): these graphs are measured, never drawn.
 */
export function growthGraph(n: number, shape: Shape, spec: Spec, rng: Rng): Graph {
  const labels = Array.from({ length: n }, (_, i) => `v${i}`);
  const edges: GraphEdge[] = [];
  const present = new Set<string>();
  const add = (i: number, j: number): void => {
    const [a, b] = spec.acyclic && i > j ? [j, i] : [i, j];
    const source = labels[a] as string;
    const target = labels[b] as string;
    const id = edgeId(source, target, spec.directed);
    if (a === b || present.has(id)) return;
    present.add(id);
    edges.push({ id, source, target, weight: spec.weighted ? rng.int(1, 100) : null });
  };
  if (shape === 'dense') {
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) add(i, j);
  } else {
    for (let i = 1; i < n; i += 1) add(rng.int(0, i - 1), i);
    const target = Math.min(2 * n, (n * (n - 1)) / 2);
    while (edges.length < target) add(rng.int(0, n - 1), rng.int(0, n - 1));
  }
  return {
    directed: spec.directed, weighted: spec.weighted, edges,
    nodes: labels.map((label) => ({ id: label, label, x: 0, y: 0 })),
  };
}

const SIZES = [8, 16, 32, 48, 64] as const;
const SIZE_MEANING = 'number of vertices V';

const inputFor = (spec: Spec) => (n: number, caseId: string, rng: Rng): GraphInput => ({
  graph: growthGraph(n, caseId === 'dense' ? 'dense' : 'sparse', spec, rng),
  start: 'v0',
});

/** Θ(V + E) on adjacency lists: the same two cases for every traversal-shaped algorithm. */
const cases = (op: string) => [
  { id: 'sparse', label: 'Sparse: E = 2V edges', claim: { symbol: 'Θ', fn: 'n', when: `sparse graph, E = 2V, so ${op} grows with V` } },
  { id: 'dense', label: 'Dense: complete graph', claim: { symbol: 'Θ', fn: 'n²', when: `complete graph, E = V(V - 1)/2, so ${op} grows with V²` } },
] as const;

export const experiments: readonly GrowthExperiment[] = [
  experimentFor(bfs, {
    id: 'graphs-bfs-growth', title: 'Breadth-first search', sizeMeaning: SIZE_MEANING, primaryOp: 'edge-checks', sizes: SIZES,
    cases: [...cases('edge checks')], makeInput: inputFor({ directed: false, weighted: false }),
  }),
  experimentFor(dfs, {
    id: 'graphs-dfs-growth', title: 'Depth-first search', sizeMeaning: SIZE_MEANING, primaryOp: 'edge-checks', sizes: SIZES,
    cases: [...cases('edge checks')], makeInput: inputFor({ directed: false, weighted: false }),
  }),
  experimentFor(topologicalSort, {
    id: 'graphs-topological-sort-growth', title: 'Topological sort', sizeMeaning: SIZE_MEANING, primaryOp: 'edge-checks', sizes: SIZES,
    cases: [...cases('edge checks')], makeInput: inputFor({ directed: true, weighted: false, acyclic: true }),
  }),
  experimentFor(prim, {
    id: 'graphs-prim-growth', title: "Prim's algorithm", sizeMeaning: SIZE_MEANING, primaryOp: 'edge-checks', sizes: SIZES,
    cases: [...cases('edge checks')], makeInput: inputFor({ directed: false, weighted: true }),
  }),
  experimentFor(kruskal, {
    id: 'graphs-kruskal-growth', title: "Kruskal's algorithm", sizeMeaning: SIZE_MEANING, primaryOp: 'comparisons', sizes: SIZES,
    cases: [
      { id: 'sparse', label: 'Sparse: E = 2V edges', claim: { symbol: 'Θ', fn: 'n log n', when: 'sparse graph, E = 2V: sorting E edges takes Θ(E log E) comparisons' } },
      { id: 'dense', label: 'Dense: complete graph', claim: { symbol: 'Ω', fn: 'n²', when: 'complete graph: sorting E = V(V - 1)/2 edges needs at least E comparisons, and a merge sort makes about E log E' } },
    ],
    makeInput: inputFor({ directed: false, weighted: true }),
  }),
  experimentFor(dijkstra, {
    id: 'graphs-dijkstra-growth', title: "Dijkstra's algorithm", sizeMeaning: SIZE_MEANING, primaryOp: 'edge-checks', sizes: SIZES,
    cases: [...cases('edge checks')], makeInput: inputFor({ directed: false, weighted: true }),
  }),
];

/** The experiment ids that belong on each view's page. */
export const experimentsFor = (algorithmId: string): readonly GrowthExperiment[] => experiments.filter((e) => e.id === `${algorithmId}-growth`);
