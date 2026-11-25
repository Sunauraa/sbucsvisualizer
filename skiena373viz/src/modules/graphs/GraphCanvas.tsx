/**
 * Draws a Graph for both the editor and the algorithm stage. It exists beside @ui's GraphView because the
 * stage needs one thing GraphView cannot say: a different dash pattern for each edge class (see NOTES.md).
 */
import { GRAPH_HEIGHT, GRAPH_WIDTH, SURFACE, TONES } from '@core';
import type { Graph, Tone } from '@core';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { activatable, arrowPoints, edgeGeometry, Halo, SvgNode, SvgStage, toSvgPoint } from '@ui';

export interface VertexMark {
  readonly tone?: Tone;
  /** Under the vertex. */
  readonly sub?: string;
  /** Above the vertex. */
  readonly tag?: string;
}

export interface EdgeMark {
  readonly tone?: Tone;
  /** SVG dash pattern, such as '7 5'. Solid when left out. */
  readonly dash?: string;
  /** Replaces the weight label. */
  readonly label?: string;
  /** Draws a halo under the edge: it is the one being examined in this frame. */
  readonly focus?: boolean;
  /** An arrowhead toward the other end, even in an undirected graph: the edge is being read from this vertex. */
  readonly from?: string;
}

export interface GraphCanvasProps {
  readonly graph: Graph;
  readonly title: string;
  readonly vertices?: Readonly<Record<string, VertexMark>>;
  readonly edges?: Readonly<Record<string, EdgeMark>>;
  readonly radius?: number;
  readonly onVertex?: (id: string) => void;
  readonly onEdge?: (id: string) => void;
  readonly onBackground?: (x: number, y: number) => void;
  readonly onVertexPointerDown?: (id: string, event: PointerEvent<SVGGElement>) => void;
  readonly onVertexKeyDown?: (id: string, event: KeyboardEvent<SVGGElement>) => void;
  readonly emptyText?: string;
  readonly overlay?: ReactNode;
}

export function GraphCanvas({
  graph, title, vertices = {}, edges = {}, radius = 21, onVertex, onEdge, onBackground, onVertexPointerDown, onVertexKeyDown,
  emptyText = 'The graph is empty', overlay,
}: GraphCanvasProps) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const pairs = new Set(graph.edges.map((edge) => `${edge.source} ${edge.target}`));
  const interactive = Boolean(onVertex ?? onEdge ?? onBackground ?? onVertexPointerDown);
  return (
    <SvgStage width={GRAPH_WIDTH} height={GRAPH_HEIGHT} title={title} minWidth={440} interactive={interactive}>
      <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="transparent"
        onClick={onBackground ? (event) => {
          const svg = event.currentTarget.ownerSVGElement;
          const point = svg ? toSvgPoint(svg, event.clientX, event.clientY) : null;
          if (point) onBackground(point.x, point.y);
        } : undefined} />
      {graph.nodes.length === 0 ? <Halo x={GRAPH_WIDTH / 2} y={GRAPH_HEIGHT / 2} fill={SURFACE.muted}>{emptyText}</Halo> : null}
      {graph.edges.map((edge) => {
        const from = byId.get(edge.source);
        const to = byId.get(edge.target);
        if (!from || !to) return null;
        const mark = edges[edge.id] ?? {};
        const tone = mark.tone ?? 'idle';
        const { color, glyph, ink } = TONES[tone];
        const antiparallel = graph.directed && edge.source !== edge.target && pairs.has(`${edge.target} ${edge.source}`);
        const geometry = edgeGeometry(from, to, radius, antiparallel ? 16 : 0);
        const weight = edge.weight === null ? '' : String(edge.weight);
        const label = mark.label ?? weight;
        const text = [glyph, label].filter((part) => part !== '').join(' ');
        const name = `edge ${from.label} ${graph.directed ? 'to' : 'and'} ${to.label}${weight === '' ? '' : `, weight ${weight}`}`;
        const reversed = mark.from === edge.target && edge.source !== edge.target;
        const arrow = graph.directed || mark.from !== undefined;
        // An undirected edge read from its target end gets the arrowhead at the source end.
        const head = reversed && !graph.directed ? edgeGeometry(to, from, radius, 0) : geometry;
        return (
          <g key={edge.id} {...activatable(name, onEdge ? () => onEdge(edge.id) : undefined)}>
            {onEdge ? <path d={geometry.path} fill="none" stroke="transparent" strokeWidth={18} /> : null}
            {mark.focus ? <path d={geometry.path} fill="none" stroke={TONES.compare.color} strokeOpacity={0.3} strokeWidth={11} strokeLinecap="round" /> : null}
            <path d={geometry.path} fill="none" stroke={color} strokeWidth={tone === 'idle' ? 1.75 : 3.5} strokeDasharray={mark.dash} />
            {arrow ? <polygon points={arrowPoints(head.tip, head.angle, 11)} fill={color} /> : null}
            {text ? <Halo x={geometry.mid.x} y={geometry.mid.y} fill={ink}>{text}</Halo> : null}
          </g>
        );
      })}
      {graph.nodes.map((node) => {
        const mark = vertices[node.id] ?? {};
        return (
          <g key={node.id} data-vertex={node.id} style={onVertexPointerDown ? { touchAction: 'none' } : undefined}
            onPointerDown={onVertexPointerDown ? (event) => onVertexPointerDown(node.id, event) : undefined}
            onKeyDown={onVertexKeyDown ? (event) => onVertexKeyDown(node.id, event) : undefined}>
            <SvgNode x={node.x} y={node.y} label={node.label} r={radius} {...mark} ariaLabel={`vertex ${node.label}`}
              onActivate={onVertex ? () => onVertex(node.id) : undefined} />
          </g>
        );
      })}
      {overlay}
    </SvgStage>
  );
}
