/** Helpers shared by the six algorithms: labels, adjacency, vertex rows and state assembly. */
import { adjacency, compareLabels } from '@core';
import type { Arc, Graph, GraphEdge } from '@core';
import type { AlgoKind, Container, EdgeRole, Fact, GraphInput, GraphState, VertexRow } from './types';

/** A number for a sentence: infinity as ∞, no floating-point noise. */
export const fmt = (value: number | null): string => (value === null ? '∞' : String(Number(value.toFixed(6))));

export interface Ctx {
  readonly graph: Graph;
  readonly directed: boolean;
  /** Vertex ids in label order: the order every "for each vertex" loop uses. */
  readonly ids: readonly string[];
  readonly adj: Readonly<Record<string, readonly Arc[]>>;
  label(id: string): string;
  edge(id: string): GraphEdge;
  /** 'A→B' in a directed graph, 'A-B' otherwise, in the stored direction. */
  edgeName(id: string): string;
  /** The same edge read from one end: 'B-A' even though the edge is stored as A-B. */
  arcName(from: string, to: string): string;
}

/** Drops anything that would make an algorithm misbehave (duplicate ids, edges to missing vertices). */
export function sanitize(graph: Graph): Graph {
  const seen = new Set<string>();
  const nodes = graph.nodes.filter((node) => (seen.has(node.id) ? false : (seen.add(node.id), true)));
  const edgeSeen = new Set<string>();
  const edges = graph.edges.filter((edge) => {
    if (!seen.has(edge.source) || !seen.has(edge.target) || edgeSeen.has(edge.id)) return false;
    edgeSeen.add(edge.id);
    return true;
  });
  return { ...graph, nodes, edges };
}

export function makeCtx(input: GraphInput): Ctx {
  const graph = sanitize(input.graph);
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const label = (id: string): string => labels.get(id) ?? id;
  const dash = graph.directed ? '→' : '-';
  return {
    graph,
    directed: graph.directed,
    ids: [...graph.nodes].sort((a, b) => compareLabels(a.label, b.label)).map((node) => node.id),
    adj: adjacency(graph),
    label,
    edge(id) {
      const found = edges.get(id);
      if (!found) throw new Error(`no edge ${id}`);
      return found;
    },
    edgeName: (id) => {
      const found = edges.get(id);
      return found ? `${label(found.source)}${dash}${label(found.target)}` : id;
    },
    arcName: (from, to) => `${label(from)}${dash}${label(to)}`,
  };
}

/** The start vertex actually used: the chosen one, else the first label; null for an empty graph. */
export function startOf(ctx: Ctx, start: string | null): string | null {
  if (start !== null && ctx.ids.includes(start)) return start;
  return ctx.ids[0] ?? null;
}

/** Why the start vertex is what it is, for frame 0. */
export function startNote(ctx: Ctx, chosen: string | null, used: string | null): string {
  if (used === null) return '';
  if (chosen === used) return `${ctx.label(used)} (the start vertex)`;
  return `${ctx.label(used)} (the first label, because no start vertex is chosen)`;
}

export type Row = { -readonly [K in keyof VertexRow]: VertexRow[K] };

export function makeRows(ctx: Ctx): Map<string, Row> {
  return new Map(ctx.ids.map((id) => [id, {
    id, label: ctx.label(id), status: 'undiscovered', parent: null, level: null, entry: null, exit: null,
    dist: null, component: null, root: null, size: null,
  } satisfies Row]));
}

export function rowOf(rows: Map<string, Row>, id: string): Row {
  const row = rows.get(id);
  if (!row) throw new Error(`no vertex ${id}`);
  return row;
}

export interface StateArgs {
  readonly kind: AlgoKind;
  readonly ctx: Ctx;
  readonly start: string | null;
  readonly rows: Map<string, Row>;
  readonly roles: Record<string, EdgeRole>;
  readonly focusVertex?: string | null;
  readonly focusEdge?: string | null;
  readonly focusFrom?: string | null;
  readonly containers?: readonly Container[];
  readonly facts?: readonly Fact[];
  readonly cycle?: readonly string[];
}

/** The one state builder. The recorder copies and freezes the result, so live rows can be passed. */
export function buildState(a: StateArgs): GraphState {
  return {
    kind: a.kind,
    graph: a.ctx.graph,
    start: a.start,
    vertices: a.ctx.ids.map((id) => rowOf(a.rows, id)),
    edgeRoles: a.roles,
    focusVertex: a.focusVertex ?? null,
    focusEdge: a.focusEdge ?? null,
    focusFrom: a.focusFrom ?? null,
    containers: a.containers ?? [],
    facts: a.facts ?? [],
    cycle: a.cycle ?? [],
  };
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const names = (ctx: Ctx, ids: readonly string[]): string => ids.map((id) => ctx.label(id)).join(', ');

export const countsText = (ctx: Ctx): string => `${plural(ctx.ids.length, 'vertex', 'vertices')} and ${plural(ctx.graph.edges.length, 'edge')}`;

/** At most three edges with their weights, then "and N more": a check sentence stays short however many edges qualify. */
export function edgeList(ctx: Ctx, edges: readonly GraphEdge[], shown = 3): string {
  const head = edges.slice(0, shown).map((e) => `${ctx.edgeName(e.id)}: ${fmt(e.weight)}`);
  return edges.length > shown ? `${head.join(', ')}, and ${edges.length - shown} more` : head.join(', ');
}
