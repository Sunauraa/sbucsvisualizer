/**
 * Independent reference implementations for tests. They share no code with the algorithms: plain arrays and
 * indices, no adjacency helper, no heap. Slow and simple on purpose.
 */
import type { Graph } from '@core';

/** Arcs as [from, to, weight] index triples, in the graph's direction. */
function arcs(graph: Graph): { ids: string[]; list: [number, number, number][] } {
  const ids = graph.nodes.map((n) => n.id);
  const at = (id: string): number => ids.indexOf(id);
  const list: [number, number, number][] = [];
  for (const e of graph.edges) {
    const w = e.weight ?? 1;
    list.push([at(e.source), at(e.target), w]);
    if (!graph.directed && e.source !== e.target) list.push([at(e.target), at(e.source), w]);
  }
  return { ids, list };
}

/** Hop counts from `start` (null = unreachable), by repeated sweeps rather than a queue. */
export function refHops(graph: Graph, start: string): Record<string, number | null> {
  const { ids, list } = arcs(graph);
  const hops: (number | null)[] = ids.map(() => null);
  hops[ids.indexOf(start)] = 0;
  for (let round = 0; round < ids.length; round += 1) {
    for (const [a, b] of list) {
      const ha = hops[a] ?? null;
      if (ha !== null && (hops[b] === null || (hops[b] as number) > ha + 1)) hops[b] = ha + 1;
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, hops[i] ?? null]));
}

/** Bellman-Ford distances from `start`; null = unreachable. Weights must not form a negative cycle. */
export function refBellmanFord(graph: Graph, start: string): Record<string, number | null> {
  const { ids, list } = arcs(graph);
  const dist: (number | null)[] = ids.map(() => null);
  dist[ids.indexOf(start)] = 0;
  for (let round = 0; round < ids.length; round += 1) {
    for (const [a, b, w] of list) {
      const da = dist[a] ?? null;
      if (da !== null && (dist[b] === null || (dist[b] as number) > da + w)) dist[b] = da + w;
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, dist[i] ?? null]));
}

/** Floyd-Warshall row for `start`. */
export function refFloyd(graph: Graph, start: string): Record<string, number | null> {
  const { ids, list } = arcs(graph);
  const n = ids.length;
  const d: (number | null)[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : null)));
  for (const [a, b, w] of list) {
    const row = d[a] as (number | null)[];
    if (row[b] === null || (row[b] as number) > w) row[b] = a === b ? Math.min(0, w) : w;
  }
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const ik = (d[i] as (number | null)[])[k] ?? null;
        const kj = (d[k] as (number | null)[])[j] ?? null;
        const ij = (d[i] as (number | null)[])[j] ?? null;
        if (ik !== null && kj !== null && (ij === null || ik + kj < ij)) (d[i] as (number | null)[])[j] = ik + kj;
      }
    }
  }
  const s = ids.indexOf(start);
  return Object.fromEntries(ids.map((id, j) => [id, (d[s] as (number | null)[])[j] ?? null]));
}

/** Connected components of an undirected graph, as a map vertex -> component index. */
export function refComponents(graph: Graph): Record<string, number> {
  const ids = graph.nodes.map((n) => n.id);
  const comp = new Map<string, number>();
  let next = 0;
  for (const id of ids) {
    if (comp.has(id)) continue;
    const stack = [id];
    comp.set(id, next);
    while (stack.length > 0) {
      const at = stack.pop() as string;
      for (const e of graph.edges) {
        const other = e.source === at ? e.target : e.target === at ? e.source : null;
        if (other !== null && !comp.has(other)) {
          comp.set(other, next);
          stack.push(other);
        }
      }
    }
    next += 1;
  }
  return Object.fromEntries(comp);
}

/**
 * The weight of a minimum spanning forest, found by trying every subset of edges: the lightest acyclic subset
 * that has V - c edges (c = number of components). Only for small graphs (E <= 14).
 */
export function refMinForestWeight(graph: Graph): number {
  const ids = graph.nodes.map((n) => n.id);
  const comps = new Set(Object.values(refComponents(graph))).size;
  const need = ids.length - comps;
  const m = graph.edges.length;
  let best = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 1 << m; mask += 1) {
    let count = 0;
    let weight = 0;
    const parent = ids.map((_, i) => i);
    const root = (x: number): number => (parent[x] === x ? x : root(parent[x] as number));
    let acyclic = true;
    for (let i = 0; i < m && acyclic; i += 1) {
      if ((mask & (1 << i)) === 0) continue;
      const e = graph.edges[i];
      if (!e) continue;
      count += 1;
      weight += e.weight ?? 0;
      const a = root(ids.indexOf(e.source));
      const b = root(ids.indexOf(e.target));
      if (a === b) acyclic = false;
      else parent[a] = b;
    }
    if (acyclic && count === need && weight < best) best = weight;
  }
  return best;
}

/** True when the directed graph has a cycle (Kahn's method, so it shares nothing with the DFS-based code). */
export function refHasCycle(graph: Graph): boolean {
  const ids = graph.nodes.map((n) => n.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  for (const e of graph.edges) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  const ready = ids.filter((id) => indegree.get(id) === 0);
  let removed = 0;
  while (ready.length > 0) {
    const at = ready.pop() as string;
    removed += 1;
    for (const e of graph.edges) {
      if (e.source !== at) continue;
      const left = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, left);
      if (left === 0) ready.push(e.target);
    }
  }
  return removed < ids.length;
}

/** Every edge goes from an earlier position to a strictly later one, and every vertex appears once. */
export function respectsEdges(graph: Graph, order: readonly string[]): boolean {
  if (order.length !== graph.nodes.length || new Set(order).size !== order.length) return false;
  return graph.edges.every((e) => order.indexOf(e.source) < order.indexOf(e.target));
}

export interface RefDfs {
  readonly entry: Record<string, number>;
  readonly exit: Record<string, number>;
  readonly classes: Record<string, 'tree' | 'back' | 'forward' | 'cross'>;
}

/**
 * Recursive depth-first search written as the textbook describes it, with neighbours in the given label order.
 * `roots` is the order in which restarts are tried. Edge classes come from the timestamps, not from colours.
 */
export function refDfs(graph: Graph, roots: readonly string[], neighbours: (id: string) => readonly { to: string; edge: string }[]): RefDfs {
  const entry: Record<string, number> = {};
  const exit: Record<string, number> = {};
  const treeEdges = new Set<string>();
  let clock = 0;
  const go = (u: string): void => {
    entry[u] = ++clock;
    for (const { to, edge } of neighbours(u)) {
      if (entry[to] === undefined) {
        treeEdges.add(edge);
        go(to);
      }
    }
    exit[u] = ++clock;
  };
  for (const r of roots) if (entry[r] === undefined) go(r);
  const classes: RefDfs['classes'] = {};
  for (const e of graph.edges) {
    const [su, sv] = [e.source, e.target];
    const eu = entry[su] as number;
    const ev = entry[sv] as number;
    const xu = exit[su] as number;
    const xv = exit[sv] as number;
    if (treeEdges.has(e.id)) classes[e.id] = 'tree';
    else if (!graph.directed) classes[e.id] = 'back';
    else if (ev <= eu && xu <= xv) classes[e.id] = 'back';
    else if (eu < ev && xv < xu) classes[e.id] = 'forward';
    else classes[e.id] = 'cross';
  }
  return { entry, exit, classes };
}
