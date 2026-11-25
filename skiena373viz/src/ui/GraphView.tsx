/** Draws a Graph. Used read-only by renderers and, with the handlers, as the canvas of an editor. */
import { GRAPH_HEIGHT, GRAPH_WIDTH, SURFACE } from '@core';
import type { Graph, Tone } from '@core';
import type { PointerEvent, ReactNode } from 'react';
import { Halo, SvgEdge, SvgNode, SvgStage } from './Svg';

export interface NodeMark {
  readonly tone?: Tone;
  /** Under the node: a distance, key or order number. */
  readonly sub?: string;
  /** Above the node: 'start', 'u'. */
  readonly tag?: string;
  readonly shape?: 'circle' | 'square';
}

export interface EdgeMark {
  readonly tone?: Tone;
  readonly dashed?: boolean;
  /** Overrides the weight label. */
  readonly label?: string;
}

export interface GraphViewProps {
  readonly graph: Graph;
  readonly title: string;
  readonly nodes?: Readonly<Record<string, NodeMark>>;
  readonly edges?: Readonly<Record<string, EdgeMark>>;
  readonly width?: number;
  readonly height?: number;
  readonly radius?: number;
  /** Narrower than this (CSS px) the drawing scrolls in its own box, so labels stay readable. Default 500. */
  readonly minWidth?: number;
  readonly onNode?: (id: string) => void;
  readonly onEdge?: (id: string) => void;
  /** Click on empty canvas, in graph coordinates. */
  readonly onBackground?: (x: number, y: number) => void;
  /** Pointer down on a node, for dragging. Call event.currentTarget.setPointerCapture as needed. */
  readonly onNodePointerDown?: (id: string, event: PointerEvent<SVGGElement>) => void;
  /** Extra SVG drawn on top, in graph coordinates. */
  readonly overlay?: ReactNode;
}

/** Converts a pointer position to SVG user units. Null when there is no layout (tests). */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
  if (!matrix || matrix.a === 0 || matrix.d === 0) return null;
  return { x: Math.round((clientX - matrix.e) / matrix.a), y: Math.round((clientY - matrix.f) / matrix.d) };
}

export function GraphView({
  graph, title, nodes = {}, edges = {}, width = GRAPH_WIDTH, height = GRAPH_HEIGHT, radius = 20, minWidth = 500,
  onNode, onEdge, onBackground, onNodePointerDown, overlay,
}: GraphViewProps) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const pairs = new Set(graph.edges.map((edge) => `${edge.source} ${edge.target}`));
  return (
    <SvgStage width={width} height={height} title={title} minWidth={minWidth} interactive={Boolean(onNode ?? onEdge ?? onBackground ?? onNodePointerDown)}>
      <rect width={width} height={height} fill="transparent"
        onClick={onBackground ? (event) => {
          const svg = event.currentTarget.ownerSVGElement;
          const point = svg ? toSvgPoint(svg, event.clientX, event.clientY) : null;
          if (point) onBackground(point.x, point.y);
        } : undefined} />
      {graph.nodes.length === 0 ? <Halo x={width / 2} y={height / 2} fill={SURFACE.muted}>The graph is empty</Halo> : null}
      {graph.edges.map((edge) => {
        const from = byId.get(edge.source);
        const to = byId.get(edge.target);
        if (!from || !to) return null;
        const mark = edges[edge.id] ?? {};
        const antiparallel = graph.directed && edge.source !== edge.target && pairs.has(`${edge.target} ${edge.source}`);
        const label = mark.label ?? (edge.weight === null ? undefined : String(edge.weight));
        return (
          <SvgEdge key={edge.id} from={from} to={to} tone={mark.tone} dashed={mark.dashed} label={label} directed={graph.directed} r={radius}
            bend={antiparallel ? 16 : 0}
            ariaLabel={`edge ${from.label} to ${to.label}${label === undefined ? '' : `, ${label}`}`}
            onActivate={onEdge ? () => onEdge(edge.id) : undefined} />
        );
      })}
      {graph.nodes.map((node) => {
        const mark = nodes[node.id] ?? {};
        return (
          <g key={node.id} style={onNodePointerDown ? { touchAction: 'none' } : undefined} onPointerDown={onNodePointerDown ? (event) => onNodePointerDown(node.id, event) : undefined}>
            <SvgNode x={node.x} y={node.y} label={node.label} r={radius} {...mark}
              ariaLabel={`vertex ${node.label}`} onActivate={onNode ? () => onNode(node.id) : undefined} />
          </g>
        );
      })}
      {overlay}
    </SvgStage>
  );
}
