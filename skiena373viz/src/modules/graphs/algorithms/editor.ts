/**
 * The editor as a pure reducer: every change to the graph, with the message a student sees when a change is
 * refused or has a side effect. No React here; the canvas, the toolbar and the text field all call applyEdit.
 */
import { circlePositions, edgeId, fail, forceLayout, GRAPH_HEIGHT, GRAPH_WIDTH, ok, parseGraph } from '@core';
import type { Graph, GraphEdge, GraphNode, Result } from '@core';
import type { GraphInput } from './types';

export const MAX_VERTICES = 12;
export const MAX_EDGES = 30;
export const MAX_WEIGHT = 999;
const MARGIN = 30;

export type EditAction =
  | { readonly type: 'add-vertex'; readonly x?: number; readonly y?: number }
  | { readonly type: 'move-vertex'; readonly id: string; readonly x: number; readonly y: number }
  | { readonly type: 'add-edge'; readonly source: string; readonly target: string; readonly weight?: number }
  | { readonly type: 'delete-vertex'; readonly id: string }
  | { readonly type: 'delete-edge'; readonly id: string }
  | { readonly type: 'set-weight'; readonly id: string; readonly text: string }
  | { readonly type: 'set-directed'; readonly directed: boolean }
  | { readonly type: 'set-weighted'; readonly weighted: boolean }
  | { readonly type: 'set-start'; readonly id: string | null }
  | { readonly type: 'clear' }
  | { readonly type: 'layout' };

/** What the UI should select after the edit: the new vertex or edge, or nothing. */
export type Focus = { readonly kind: 'vertex' | 'edge'; readonly id: string } | null;

export interface EditOutcome {
  readonly input: GraphInput;
  /** Said to the student, politely. null when nothing needs saying. */
  readonly message: string | null;
  readonly changed: boolean;
  readonly focus?: Focus;
}

const clampX = (x: number): number => Math.round(Math.min(GRAPH_WIDTH - MARGIN, Math.max(MARGIN, x)));
const clampY = (y: number): number => Math.round(Math.min(GRAPH_HEIGHT - MARGIN, Math.max(MARGIN, y)));

/** The first unused letter A..Z, so a deleted letter is reused before a new one is taken. */
export function nextLabel(taken: readonly string[]): string {
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (!taken.includes(letter)) return letter;
  }
  let k = 1;
  while (taken.includes(`V${k}`)) k += 1;
  return `V${k}`;
}

/** The spot on a grid that is farthest from every existing vertex: new vertices never land on old ones. */
export function freeSpot(nodes: readonly { readonly x: number; readonly y: number }[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  let best = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
  let bestDistance = -1;
  for (let y = 50; y <= GRAPH_HEIGHT - 50; y += 50) {
    for (let x = 50; x <= GRAPH_WIDTH - 50; x += 55) {
      const nearest = Math.min(...nodes.map((n) => Math.hypot(n.x - x, n.y - y)));
      if (nearest > bestDistance + 1e-9) {
        bestDistance = nearest;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Limits and weight rules. Returns the first message, or null when the graph is acceptable. */
export function modelProblem(graph: Graph): string | null {
  if (graph.nodes.length > MAX_VERTICES) return `That graph has ${graph.nodes.length} vertices; the limit is ${MAX_VERTICES}.`;
  if (graph.edges.length > MAX_EDGES) return `That graph has ${graph.edges.length} edges; the limit is ${MAX_EDGES}.`;
  for (const edge of graph.edges) {
    if (edge.weight === null) continue;
    if (!Number.isInteger(edge.weight) || Math.abs(edge.weight) > MAX_WEIGHT) {
      return `The edge ${edge.source}${graph.directed ? '>' : '-'}${edge.target} has weight ${edge.weight}; weights here are whole numbers from -${MAX_WEIGHT} to ${MAX_WEIGHT}.`;
    }
  }
  return null;
}

const unchanged = (input: GraphInput, message: string | null): EditOutcome => ({ input, message, changed: false });
const withGraph = (input: GraphInput, graph: Graph, message: string | null, focus?: Focus): EditOutcome => ({
  input: { ...input, graph }, message, changed: true, ...(focus === undefined ? {} : { focus }),
});

const nameOf = (graph: Graph, id: string): string => graph.nodes.find((n) => n.id === id)?.label ?? id;
const dashOf = (graph: Graph): string => (graph.directed ? '>' : '-');
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function parseWeight(text: string): Result<number> {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return fail(`"${text.trim()}" is not a whole number; weights are whole numbers from -${MAX_WEIGHT} to ${MAX_WEIGHT}.`);
  const value = Number(trimmed);
  if (Math.abs(value) > MAX_WEIGHT) return fail(`${value} is outside -${MAX_WEIGHT} to ${MAX_WEIGHT}.`);
  return ok(value === 0 ? 0 : value);
}

export function applyEdit(input: GraphInput, action: EditAction): EditOutcome {
  const { graph } = input;
  switch (action.type) {
    case 'add-vertex': {
      if (graph.nodes.length >= MAX_VERTICES) return unchanged(input, `The graph already has ${MAX_VERTICES} vertices, which is the limit.`);
      const label = nextLabel(graph.nodes.map((n) => n.label));
      const at = action.x === undefined || action.y === undefined ? freeSpot(graph.nodes) : { x: clampX(action.x), y: clampY(action.y) };
      const node: GraphNode = { id: label, label, x: at.x, y: at.y };
      return withGraph(input, { ...graph, nodes: [...graph.nodes, node] }, `Added vertex ${label}.`, { kind: 'vertex', id: label });
    }
    case 'move-vertex': {
      if (!graph.nodes.some((n) => n.id === action.id)) return unchanged(input, null);
      const nodes = graph.nodes.map((n) => (n.id === action.id ? { ...n, x: clampX(action.x), y: clampY(action.y) } : n));
      return withGraph(input, { ...graph, nodes }, null);
    }
    case 'add-edge': {
      const { source, target } = action;
      if (!graph.nodes.some((n) => n.id === source) || !graph.nodes.some((n) => n.id === target)) return unchanged(input, 'Both ends of an edge must be vertices that exist.');
      const id = edgeId(source, target, graph.directed);
      const name = `${nameOf(graph, source)}${dashOf(graph)}${nameOf(graph, target)}`;
      if (graph.edges.some((e) => e.id === id)) return unchanged(input, `The edge ${name} already exists${graph.directed ? '' : ' (an undirected edge runs both ways)'}.`);
      if (graph.edges.length >= MAX_EDGES) return unchanged(input, `The graph already has ${MAX_EDGES} edges, which is the limit.`);
      let weight: number | null = null;
      if (graph.weighted) {
        const given = action.weight === undefined ? ok(1) : parseWeight(String(action.weight));
        if (!given.ok) return unchanged(input, given.message);
        weight = given.value;
      }
      const edge: GraphEdge = { id, source, target, weight };
      const loop = source === target ? ' (a self-loop)' : '';
      return withGraph(input, { ...graph, edges: [...graph.edges, edge] }, `Added the edge ${name}${loop}${graph.weighted ? ` with weight ${weight}` : ''}.`, { kind: 'edge', id });
    }
    case 'delete-vertex': {
      if (!graph.nodes.some((n) => n.id === action.id)) return unchanged(input, null);
      const edges = graph.edges.filter((e) => e.source !== action.id && e.target !== action.id);
      const removed = graph.edges.length - edges.length;
      const next: GraphInput = { graph: { ...graph, nodes: graph.nodes.filter((n) => n.id !== action.id), edges }, start: input.start === action.id ? null : input.start };
      const lostStart = input.start === action.id ? ' It was the start vertex, so the start is back to the first label.' : '';
      return { input: next, changed: true, focus: null, message: `Deleted vertex ${nameOf(graph, action.id)} and ${plural(removed, 'edge')}.${lostStart}` };
    }
    case 'delete-edge': {
      const edge = graph.edges.find((e) => e.id === action.id);
      if (!edge) return unchanged(input, null);
      return withGraph(input, { ...graph, edges: graph.edges.filter((e) => e.id !== action.id) }, `Deleted the edge ${nameOf(graph, edge.source)}${dashOf(graph)}${nameOf(graph, edge.target)}.`, null);
    }
    case 'set-weight': {
      const edge = graph.edges.find((e) => e.id === action.id);
      if (!edge) return unchanged(input, null);
      if (!graph.weighted) return unchanged(input, 'Turn on "Weighted" first; this graph has no weights.');
      const parsed = parseWeight(action.text);
      if (!parsed.ok) return unchanged(input, parsed.message);
      if (edge.weight === parsed.value) return unchanged(input, null);
      return withGraph(input, { ...graph, edges: graph.edges.map((e) => (e.id === action.id ? { ...e, weight: parsed.value } : e)) }, null);
    }
    case 'set-directed': {
      if (action.directed === graph.directed) return unchanged(input, null);
      const seen = new Map<string, GraphEdge>();
      let merged = 0;
      for (const e of graph.edges) {
        const id = edgeId(e.source, e.target, action.directed);
        const copy: GraphEdge = { ...e, id };
        const earlier = seen.get(id);
        if (!earlier) {
          seen.set(id, copy);
          continue;
        }
        merged += 1;
        if (copy.weight !== null && (earlier.weight === null || copy.weight < earlier.weight)) seen.set(id, copy);
      }
      const note = merged > 0 ? ` ${plural(merged, 'pair')} of opposite edges merged into one, keeping the lighter weight.` : '';
      return withGraph(input, { ...graph, directed: action.directed, edges: [...seen.values()] }, `The graph is now ${action.directed ? 'directed: each edge keeps the direction it was drawn in' : 'undirected: edges run both ways'}.${note}`);
    }
    case 'set-weighted': {
      if (action.weighted === graph.weighted) return unchanged(input, null);
      const edges = graph.edges.map((e) => ({ ...e, weight: action.weighted ? 1 : null }));
      return withGraph(input, { ...graph, weighted: action.weighted, edges }, action.weighted ? 'The graph is now weighted, and every edge starts at weight 1. Select an edge to change its weight.' : 'The graph is now unweighted, so the weights are gone.');
    }
    case 'set-start': {
      if (action.id !== null && !graph.nodes.some((n) => n.id === action.id)) return unchanged(input, null);
      if (action.id === input.start) return unchanged(input, null);
      return { input: { ...input, start: action.id }, changed: true, message: action.id === null ? 'The start vertex is the first label.' : `The start vertex is now ${nameOf(graph, action.id)}.` };
    }
    case 'clear':
      return { input: { graph: { ...graph, nodes: [], edges: [] }, start: null }, changed: graph.nodes.length > 0, message: 'The graph is empty.', focus: null };
    case 'layout':
      if (graph.nodes.length === 0) return unchanged(input, 'There is nothing to lay out yet.');
      return withGraph(input, forceLayout(graph), 'Spread the vertices out.');
  }
}

/** Positions encoded for a URL: "A.120.80_B.300.40". Labels are letters and digits, so '.' and '_' are safe. */
export function encodePositions(nodes: readonly GraphNode[]): string {
  return nodes.map((n) => `${n.label}.${Math.round(n.x)}.${Math.round(n.y)}`).join('_');
}

export function decodePositions(text: string): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const part of text.split('_')) {
    const [label, x, y] = part.split('.');
    if (label === undefined || x === undefined || y === undefined) continue;
    const px = Number(x);
    const py = Number(y);
    if (label !== '' && Number.isFinite(px) && Number.isFinite(py)) out.set(label, { x: clampX(px), y: clampY(py) });
  }
  return out;
}

/**
 * The text field's path into the model: parse the text with the shared parser, keep the position of every
 * vertex that already exists, and give new vertices a free spot. The start vertex survives if it still exists.
 */
export function modelFromText(text: string, current: GraphInput, positions?: ReadonlyMap<string, { x: number; y: number }>): Result<GraphInput> {
  const parsed = parseGraph(text, { directed: current.graph.directed, weighted: current.graph.weighted });
  if (!parsed.ok) return parsed;
  const problem = modelProblem(parsed.value);
  if (problem) return fail(problem);
  const known = new Map<string, { x: number; y: number }>(current.graph.nodes.map((n) => [n.label, { x: n.x, y: n.y }]));
  for (const [label, at] of positions ?? []) known.set(label, at);
  const placed: { x: number; y: number }[] = [];
  const fallback = circlePositions(parsed.value.nodes.length);
  const nodes = parsed.value.nodes.map((node, i) => {
    const at = known.get(node.label);
    if (at) {
      placed.push(at);
      return { ...node, x: at.x, y: at.y };
    }
    return { ...node, x: fallback[i]?.x ?? 0, y: fallback[i]?.y ?? 0 };
  });
  // Vertices with no remembered position go to the free spot farthest from everything already placed.
  const finished = nodes.map((node) => {
    if (known.has(node.label)) return node;
    const spot = freeSpot(placed);
    placed.push(spot);
    return { ...node, ...spot };
  });
  const start = current.start !== null && finished.some((n) => n.id === current.start) ? current.start : null;
  return ok({ graph: { ...parsed.value, nodes: finished }, start });
}
