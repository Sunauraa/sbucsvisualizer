/** Per-algorithm page configuration: which algorithm, what graph it needs, how to fix a mismatch, what the key says. */
import type { Algorithm, Preset, Tone } from '@core';
import { bfs } from './algorithms/bfs';
import { dfs } from './algorithms/dfs';
import { dijkstra } from './algorithms/dijkstra';
import { experimentsFor } from './algorithms/experiments';
import { kruskal } from './algorithms/kruskal';
import { prim } from './algorithms/prim';
import { topologicalSort } from './algorithms/topologicalSort';
import type { EditAction } from './algorithms/editor';
import type { AlgoKind, GraphInput, GraphState } from './algorithms/types';

export interface Fix {
  readonly label: string;
  readonly action: EditAction;
}

export interface KindConfig {
  readonly kind: AlgoKind;
  readonly algorithm: Algorithm<GraphInput, GraphState, unknown>;
  /** Whether the start vertex matters (and so whether the editor offers it). */
  readonly usesStart: boolean;
  readonly tones: readonly Tone[];
  readonly toneLabels: Partial<Record<Tone, string>>;
  /** Which edge styles appear, for the second half of the key. */
  readonly edgeKey: 'classes' | 'tree' | 'forest' | 'cycle';
  /** The one-line reminder of what this algorithm needs from the graph. */
  readonly needs: string;
  /** Buttons that make the current graph acceptable, offered when the run is refused. */
  readonly fixes: (input: GraphInput) => readonly Fix[];
}

const makeUndirected: Fix = { label: 'Make the graph undirected', action: { type: 'set-directed', directed: false } };
const makeDirected: Fix = { label: 'Make the graph directed', action: { type: 'set-directed', directed: true } };
const makeWeighted: Fix = { label: 'Make the graph weighted (every weight 1)', action: { type: 'set-weighted', weighted: true } };

const spanning = (input: GraphInput): readonly Fix[] => [
  ...(input.graph.directed ? [makeUndirected] : []),
  ...(input.graph.weighted ? [] : [makeWeighted]),
];

export const KINDS: Readonly<Record<AlgoKind, KindConfig>> = {
  bfs: {
    kind: 'bfs', algorithm: bfs, usesStart: true, edgeKey: 'tree', needs: 'Any graph; weights are ignored.',
    tones: ['target', 'active', 'compare', 'visited', 'done'],
    toneLabels: { target: 'start vertex', active: 'u, just dequeued', compare: 'neighbour being checked', visited: 'discovered, waiting in the queue', done: 'processed' },
    fixes: () => [],
  },
  dfs: {
    kind: 'dfs', algorithm: dfs, usesStart: true, edgeKey: 'classes', needs: 'Any graph; weights are ignored.',
    tones: ['target', 'active', 'compare', 'visited', 'done'],
    toneLabels: { target: 'start vertex', active: 'u, the running call', compare: 'neighbour being checked', visited: 'discovered, still on the call stack', done: 'finished' },
    fixes: () => [],
  },
  'topological-sort': {
    kind: 'topological-sort', algorithm: topologicalSort, usesStart: false, edgeKey: 'cycle', needs: 'A directed graph. A directed cycle has no order.',
    tones: ['active', 'compare', 'visited', 'done', 'swap'],
    toneLabels: { active: 'u, the running call', compare: 'neighbour being checked', visited: 'on the call stack', done: 'finished, on the finish stack', swap: 'on the directed cycle that stops the run' },
    fixes: (input) => (input.graph.directed ? [] : [makeDirected]),
  },
  prim: {
    kind: 'prim', algorithm: prim, usesStart: true, edgeKey: 'tree', needs: 'A weighted, undirected graph; negative weights are fine.',
    tones: ['target', 'active', 'compare', 'visited', 'done', 'swap'],
    toneLabels: { target: 'start vertex', active: 'u, just added to the tree', compare: 'neighbour being checked', visited: 'has a key, not in the tree yet', done: 'in the tree', swap: 'stale queue entry, skipped when popped' },
    fixes: spanning,
  },
  kruskal: {
    kind: 'kruskal', algorithm: kruskal, usesStart: false, edgeKey: 'forest', needs: 'A weighted, undirected graph; negative weights are fine.',
    tones: ['compare', 'done', 'swap', 'active'],
    toneLabels: { compare: 'ends of the edge being examined', done: 'kept edge', swap: 'rejected edge: it would close a cycle', active: 'the edge being examined, in the sorted list' },
    fixes: spanning,
  },
  dijkstra: {
    kind: 'dijkstra', algorithm: dijkstra, usesStart: true, edgeKey: 'tree', needs: 'A weighted graph with no negative edge.',
    tones: ['target', 'active', 'compare', 'visited', 'done', 'swap'],
    toneLabels: { target: 'start vertex', active: 'u, just popped', compare: 'neighbour being checked', visited: 'has a tentative distance', done: 'final distance', swap: 'stale queue entry, skipped when popped' },
    fixes: (input) => (input.graph.weighted ? [] : [makeWeighted]),
  },
};

export const growthFor = (kind: AlgoKind) => experimentsFor(KINDS[kind].algorithm.id);

export const presetsOf = (kind: AlgoKind): readonly Preset<GraphInput>[] => KINDS[kind].algorithm.presets;

/** The six views, in order: the module manifest and the "same graph in" links both come from here. */
export const VIEW_LINKS: readonly { readonly id: string; readonly title: string; readonly kind: AlgoKind }[] = [
  { id: 'bfs', title: 'BFS', kind: 'bfs' },
  { id: 'dfs', title: 'DFS', kind: 'dfs' },
  { id: 'topological-sort', title: 'Topological sort', kind: 'topological-sort' },
  { id: 'prim', title: 'Prim', kind: 'prim' },
  { id: 'kruskal', title: 'Kruskal', kind: 'kruskal' },
  { id: 'dijkstra', title: 'Dijkstra', kind: 'dijkstra' },
];
