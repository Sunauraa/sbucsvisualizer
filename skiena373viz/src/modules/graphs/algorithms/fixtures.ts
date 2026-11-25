/** Test helpers: build graphs from text and from a seeded generator. Not imported by the app. */
import { circlePositions, edgeId, parseGraph } from '@core';
import type { Graph, GraphEdge, Rng } from '@core';
import type { GraphInput } from './types';

export function graphOf(text: string, directed = false, weighted = false): Graph {
  const parsed = parseGraph(text, { directed, weighted });
  if (!parsed.ok) throw new Error(`fixture "${text}": ${parsed.message}`);
  return parsed.value;
}

export const inputOf = (text: string, options: { directed?: boolean; weighted?: boolean; start?: string | null } = {}): GraphInput => ({
  graph: graphOf(text, options.directed ?? false, options.weighted ?? false),
  start: options.start ?? null,
});

export interface RandomOptions {
  readonly directed: boolean;
  readonly weighted: boolean;
  readonly maxVertices?: number;
  readonly minVertices?: number;
  readonly density?: number;
  readonly selfLoops?: boolean;
  readonly minWeight?: number;
  readonly maxWeight?: number;
}

/** A random simple graph on vertices A, B, C, ...; parallel edges never occur, antiparallel ones may. */
export function randomGraph(rng: Rng, options: RandomOptions): Graph {
  const { directed, weighted, maxVertices = 8, minVertices = 0, density = 0.35, selfLoops = false, minWeight = 1, maxWeight = 9 } = options;
  const n = rng.int(minVertices, maxVertices);
  const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const positions = circlePositions(n);
  const edges: GraphEdge[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = directed ? 0 : i; j < n; j += 1) {
      if (i === j && !selfLoops) continue;
      if (rng.next() >= density) continue;
      const source = labels[i] as string;
      const target = labels[j] as string;
      edges.push({ id: edgeId(source, target, directed), source, target, weight: weighted ? rng.int(minWeight, maxWeight) : null });
    }
  }
  return {
    directed, weighted, edges,
    nodes: labels.map((label, i) => ({ id: label, label, x: positions[i]?.x ?? 0, y: positions[i]?.y ?? 0 })),
  };
}
