/** Layout only: this is the single place D3 is allowed. Deterministic, synchronous, DOM-free. */
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import { circlePositions, GRAPH_HEIGHT, GRAPH_WIDTH } from './graph';
import type { Graph } from './graph';

interface SimNode extends SimulationNodeDatum {
  id: string;
}

export interface LayoutOptions {
  readonly width?: number;
  readonly height?: number;
  readonly linkDistance?: number;
  /** Kept clear on every side. */
  readonly margin?: number;
}

/** Same graph in, same positions out (d3-force uses a fixed-seed generator). */
export function forceLayout(graph: Graph, options: LayoutOptions = {}): Graph {
  const { width = GRAPH_WIDTH, height = GRAPH_HEIGHT, linkDistance = 110, margin = 36 } = options;
  const start = circlePositions(graph.nodes.length, width, height);
  const nodes: SimNode[] = graph.nodes.map((node, i) => ({ id: node.id, x: start[i]?.x ?? 0, y: start[i]?.y ?? 0 }));
  const links: SimulationLinkDatum<SimNode>[] = graph.edges
    .filter((edge) => edge.source !== edge.target)
    .map((edge) => ({ source: edge.source, target: edge.target }));
  forceSimulation(nodes)
    .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(links).id((node) => node.id).distance(linkDistance))
    .force('charge', forceManyBody().strength(-420))
    .force('x', forceX(width / 2).strength(0.06))
    .force('y', forceY(height / 2).strength(0.1))
    .force('collide', forceCollide(34))
    .stop()
    .tick(220);
  const clamp = (value: number, max: number): number => Math.round(Math.min(max - margin, Math.max(margin, value)));
  const placed = new Map(nodes.map((node) => [node.id, { x: clamp(node.x ?? 0, width), y: clamp(node.y ?? 0, height) }]));
  return { ...graph, nodes: graph.nodes.map((node) => ({ ...node, ...placed.get(node.id) })) };
}
