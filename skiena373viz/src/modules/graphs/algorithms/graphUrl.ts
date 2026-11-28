/** The graph, its two switches and the start vertex as short URL parameters: g, d, w, s, p. */
import { fail, formatGraph, ok, parseGraph } from '@core';
import type { Result } from '@core';
import { decodePositions, encodePositions, modelProblem } from './editor';
import type { GraphInput } from './types';

export const GRAPH_KEYS = ['g', 'd', 'w', 's', 'p'] as const;

/** A URL patch for setParams. An empty graph is written as g="" so that "no parameter" still means "use the default". */
export function encodeModel(input: GraphInput): Record<(typeof GRAPH_KEYS)[number], string | null> {
  const { graph } = input;
  return {
    g: formatGraph(graph),
    d: graph.directed ? '1' : null,
    w: graph.weighted ? '1' : null,
    s: input.start,
    p: graph.nodes.length === 0 ? null : encodePositions(graph.nodes),
  };
}

/** null in a successful result means the link carries no graph, so the caller uses its default. */
export function decodeModel(params: Readonly<Record<string, string>>): Result<GraphInput | null> {
  const text = params['g'];
  if (text === undefined) return ok(null);
  const parsed = parseGraph(text, { directed: params['d'] === '1', weighted: params['w'] === '1' });
  if (!parsed.ok) return fail(`The graph in this link could not be read: ${parsed.message}`);
  const problem = modelProblem(parsed.value);
  if (problem) return fail(`The graph in this link is not allowed: ${problem}`);
  const positions = decodePositions(params['p'] ?? '');
  const nodes = parsed.value.nodes.map((node) => ({ ...node, ...(positions.get(node.label) ?? {}) }));
  const chosen = params['s'];
  const start = chosen !== undefined && nodes.some((n) => n.id === chosen) ? chosen : null;
  return ok({ graph: { ...parsed.value, nodes }, start });
}
