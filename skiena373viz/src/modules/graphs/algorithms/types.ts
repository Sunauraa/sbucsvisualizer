/** Plain-JSON types shared by the six graph algorithms and their one renderer. */
import type { Dist, Graph } from '@core';

/** Algorithm input. `start` is a vertex id, or null for "the first vertex in label order". */
export interface GraphInput {
  readonly graph: Graph;
  readonly start: string | null;
}

export type AlgoKind = 'bfs' | 'dfs' | 'topological-sort' | 'prim' | 'kruskal' | 'dijkstra';

/**
 * Where a vertex is in its life. The words differ by algorithm (the table says them), the tones do not:
 * 'discovered' means seen but not final (in the queue, on the call stack, holding a tentative key or
 * distance); 'processed' means final.
 */
export type VertexStatus = 'undiscovered' | 'discovered' | 'processed';

export interface VertexRow {
  readonly id: string;
  readonly label: string;
  readonly status: VertexStatus;
  /** BFS / DFS / Prim / Dijkstra parent; Kruskal union-find parent (a root is its own parent). */
  readonly parent: string | null;
  /** BFS level. */
  readonly level: number | null;
  /** DFS entry and exit times. */
  readonly entry: number | null;
  readonly exit: number | null;
  /** Dijkstra distance or Prim key. null means infinity. */
  readonly dist: Dist;
  /** BFS component number. */
  readonly component: number | null;
  /** Kruskal: the root of the vertex's set, and the size of that set. */
  readonly root: string | null;
  readonly size: number | null;
}

/** How an edge looks right now. 'tree' covers BFS/DFS/Prim/Dijkstra tree edges and Kruskal's kept edges. */
export type EdgeRole = 'tree' | 'back' | 'forward' | 'cross' | 'rejected' | 'cycle';

export type ItemKind = 'normal' | 'current' | 'stale' | 'kept' | 'rejected';

export interface ContainerItem {
  /** What is drawn in the cell. '' draws an empty slot. */
  readonly text: string;
  /** A fuller description in words, for the list under the cell row. */
  readonly note: string;
  readonly kind: ItemKind;
}

/** A queue, stack, priority queue or sorted edge list, with its ends named. */
export interface Container {
  readonly id: string;
  readonly title: string;
  /** Names of the first and last cell: 'front' / 'back', 'bottom' / 'top'. */
  readonly left: string;
  readonly right: string;
  /** Slots with text '' are empty (the topological order fills from the right). */
  readonly items: readonly ContainerItem[];
}

export interface Fact {
  readonly label: string;
  readonly value: string;
}

/** The complete picture of one moment, for any of the six algorithms. */
export interface GraphState {
  readonly kind: AlgoKind;
  readonly graph: Graph;
  /** The effective start vertex, or null when the algorithm has none. */
  readonly start: string | null;
  /** In label order. */
  readonly vertices: readonly VertexRow[];
  readonly edgeRoles: Readonly<Record<string, EdgeRole>>;
  /** The vertex being processed (u). */
  readonly focusVertex: string | null;
  /** The edge being examined, and the endpoint it is being examined from. */
  readonly focusEdge: string | null;
  readonly focusFrom: string | null;
  readonly containers: readonly Container[];
  readonly facts: readonly Fact[];
  /** Vertex ids on a directed cycle found by topological sort. */
  readonly cycle: readonly string[];
}
