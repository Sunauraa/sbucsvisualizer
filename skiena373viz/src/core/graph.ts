/** The shared graph type: plain JSON, used by the graphs and reductions modules and by GraphView. */
import { fail, ok } from './input';
import type { Result } from './input';

/** Logical canvas. Coordinates are in these units; GraphView uses them as its viewBox. */
export const GRAPH_WIDTH = 640;
export const GRAPH_HEIGHT = 400;

export interface GraphNode {
  readonly id: string;
  /** Short text inside the node (1-3 characters). */
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  /** null in an unweighted graph. */
  readonly weight: number | null;
}

export interface Graph {
  readonly directed: boolean;
  readonly weighted: boolean;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** One entry of an adjacency list. */
export interface Arc {
  readonly edgeId: string;
  readonly to: string;
  readonly weight: number | null;
}

export const emptyGraph = (directed: boolean, weighted: boolean): Graph => ({ directed, weighted, nodes: [], edges: [] });

/** Stable edge id. Undirected edges are keyed in label order, so A-B and B-A are the same edge. */
export function edgeId(source: string, target: string, directed: boolean): string {
  if (directed) return `${source}>${target}`;
  return source <= target ? `${source}-${target}` : `${target}-${source}`;
}

/**
 * Deterministic adjacency lists: neighbours in node-label order (numeric-aware), so ties are always
 * broken the same way. An undirected edge appears in both lists; an undirected self-loop once.
 */
export function adjacency(graph: Graph): Readonly<Record<string, readonly Arc[]>> {
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const lists: Record<string, Arc[]> = {};
  for (const node of graph.nodes) lists[node.id] = [];
  for (const edge of graph.edges) {
    lists[edge.source]?.push({ edgeId: edge.id, to: edge.target, weight: edge.weight });
    if (!graph.directed && edge.source !== edge.target) {
      lists[edge.target]?.push({ edgeId: edge.id, to: edge.source, weight: edge.weight });
    }
  }
  for (const list of Object.values(lists)) {
    list.sort((a, b) => compareLabels(labels.get(a.to) ?? a.to, labels.get(b.to) ?? b.to));
  }
  return lists;
}

/** 'A' before 'B', 'v2' before 'v10'. Locale-independent, so traces are the same everywhere. */
export function compareLabels(a: string, b: string): number {
  const pa = a.match(/\d+|\D+/g) ?? [];
  const pb = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    if (/^\d/.test(x) && /^\d/.test(y)) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y);
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

/** Nodes in label order: the order every "for each vertex" loop should use. */
export function nodesInOrder(graph: Graph): readonly GraphNode[] {
  return [...graph.nodes].sort((a, b) => compareLabels(a.label, b.label));
}

/** Structural problems: duplicate ids, dangling edges, bad coordinates, parallel edges. */
export function graphProblems(graph: Graph): string[] {
  const problems: string[] = [];
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length) problems.push('Two nodes share an id.');
  if (new Set(graph.nodes.map((node) => node.label)).size !== graph.nodes.length) problems.push('Two nodes share a label.');
  for (const node of graph.nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) problems.push(`Node ${node.label} has no position.`);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) problems.push(`Edge ${edge.id} has a missing endpoint.`);
    if (edge.id !== edgeId(edge.source, edge.target, graph.directed)) problems.push(`Edge ${edge.id} has a non-canonical id.`);
    if (edgeIds.has(edge.id)) problems.push(`Edge ${edge.id} appears twice.`);
    edgeIds.add(edge.id);
    if (graph.weighted && (edge.weight === null || !Number.isFinite(edge.weight))) problems.push(`Edge ${edge.id} needs a weight.`);
    if (!graph.weighted && edge.weight !== null) problems.push(`Edge ${edge.id} has a weight in an unweighted graph.`);
  }
  return problems;
}

/**
 * Compact text form, for presets, tests and links: "A-B:4, B-C, D" (directed: "A>B:4").
 * A lone label is an isolated vertex. Nodes are placed on a circle; see graphLayout.ts for more.
 */
export function parseGraph(text: string, options: { readonly directed: boolean; readonly weighted: boolean }): Result<Graph> {
  const { directed, weighted } = options;
  const labels: string[] = [];
  const edges: GraphEdge[] = [];
  const addLabel = (label: string): void => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const token of text.split(/[\s,;]+/).filter((part) => part !== '')) {
    const match = /^([A-Za-z0-9]{1,3})(?:([->])([A-Za-z0-9]{1,3})(?::(-?\d+(?:\.\d+)?))?)?$/.exec(token);
    if (!match) return fail(`"${token}" is not a vertex or an edge such as A-B or A-B:4.`);
    const [, from = '', dash, to, weightText] = match;
    addLabel(from);
    if (dash === undefined || to === undefined) continue;
    if ((dash === '>') !== directed) return fail(`"${token}": write ${directed ? 'A>B in a directed' : 'A-B in an undirected'} graph.`);
    addLabel(to);
    if (weighted && weightText === undefined) return fail(`"${token}" needs a weight, such as ${from}${dash}${to}:4.`);
    if (!weighted && weightText !== undefined) return fail(`"${token}" has a weight, but this graph is unweighted.`);
    const id = edgeId(from, to, directed);
    if (edges.some((edge) => edge.id === id)) return fail(`The edge ${from}${dash}${to} appears twice.`);
    const weight = weightText === undefined ? null : Number(weightText);
    edges.push({ id, source: from, target: to, weight: weight === 0 ? 0 : weight });
  }
  const positions = circlePositions(labels.length);
  const nodes = labels.map((label, i) => ({ id: label, label, x: positions[i]?.x ?? 0, y: positions[i]?.y ?? 0 }));
  return ok({ directed, weighted, nodes, edges });
}

/** The inverse of parseGraph (positions are not kept). */
export function formatGraph(graph: Graph): string {
  const label = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const touched = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));
  const dash = graph.directed ? '>' : '-';
  const isolated = graph.nodes.filter((node) => !touched.has(node.id)).map((node) => node.label);
  const edges = graph.edges.map((edge) => {
    const weight = edge.weight === null ? '' : `:${edge.weight}`;
    return `${label.get(edge.source) ?? edge.source}${dash}${label.get(edge.target) ?? edge.target}${weight}`;
  });
  return [...isolated, ...edges].join(', ');
}

/** n points on an ellipse in the logical canvas, starting at the top, clockwise. */
export function circlePositions(n: number, width = GRAPH_WIDTH, height = GRAPH_HEIGHT): readonly { x: number; y: number }[] {
  if (n === 1) return [{ x: width / 2, y: height / 2 }];
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: Math.round(width / 2 + (width / 2 - 60) * Math.cos(angle)),
      y: Math.round(height / 2 + (height / 2 - 50) * Math.sin(angle)),
    };
  });
}
