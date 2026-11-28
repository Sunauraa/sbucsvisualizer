/**
 * Draws a Graph for both the editor and the algorithm stage. It exists beside @ui's GraphView because the
 * stage needs one thing GraphView cannot say: a different dash pattern for each edge class (see NOTES.md).
 */
import { GRAPH_HEIGHT, GRAPH_WIDTH, SURFACE, TONES } from '@core';
import type { Graph, Tone } from '@core';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { activatable, arrowPoints, edgeGeometry, Halo, SvgStage, ToneGlyph, toSvgPoint } from '@ui';

/** The drawing never shrinks below this many CSS pixels before it scrolls in its own box. */
export const CANVAS_MIN_WIDTH = 300;
/** A stage narrower than this (CSS pixels) is drawn with bigger vertices and text, because the 640-unit canvas is scaled down to about half. */
export const NARROW_BELOW = 480;
export const WIDE_LOOK = { radius: 21, label: 14, longLabel: 11, note: 12, weight: 13 } as const;
export const NARROW_LOOK = { radius: 24, label: 15, longLabel: 13, note: 14, weight: 15 } as const;

/** The width of a box in CSS pixels, from a ResizeObserver; null until it is known (and always null where there is none, as in tests). */
function useBoxWidth(): { readonly ref: React.RefObject<HTMLDivElement | null>; readonly width: number | null } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

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
  graph, title, vertices = {}, edges = {}, radius: radiusOverride, onVertex, onEdge, onBackground, onVertexPointerDown, onVertexKeyDown,
  emptyText = 'The graph is empty', overlay,
}: GraphCanvasProps) {
  const { ref, width } = useBoxWidth();
  // The look depends on the width of the box, never on the frame.
  const look = width !== null && width > 0 && width < NARROW_BELOW ? NARROW_LOOK : WIDE_LOOK;
  const radius = radiusOverride ?? look.radius;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const pairs = new Set(graph.edges.map((edge) => `${edge.source} ${edge.target}`));
  const interactive = Boolean(onVertex ?? onEdge ?? onBackground ?? onVertexPointerDown);
  return (
    <div ref={ref}>
      <SvgStage width={GRAPH_WIDTH} height={GRAPH_HEIGHT} title={title} minWidth={CANVAS_MIN_WIDTH} interactive={interactive}>
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
              {text ? <Halo x={geometry.mid.x} y={geometry.mid.y} size={look.weight} fill={ink}>{text}</Halo> : null}
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const mark = vertices[node.id] ?? {};
          return (
            <g key={node.id} data-vertex={node.id} style={onVertexPointerDown ? { touchAction: 'none' } : undefined}
              onPointerDown={onVertexPointerDown ? (event) => onVertexPointerDown(node.id, event) : undefined}
              onKeyDown={onVertexKeyDown ? (event) => onVertexKeyDown(node.id, event) : undefined}>
              <Vertex x={node.x} y={node.y} label={node.label} r={radius} look={look} {...mark} ariaLabel={`vertex ${node.label}`}
                onActivate={onVertex ? () => onVertex(node.id) : undefined} />
            </g>
          );
        })}
        {overlay}
      </SvgStage>
    </div>
  );
}

/** A vertex like @ui's SvgNode, with text sizes that follow the look (SvgNode's are fixed). */
function Vertex({ x, y, label, r, look, tone = 'idle', sub, tag, onActivate, ariaLabel }: VertexMark & {
  readonly x: number; readonly y: number; readonly label: string; readonly r: number; readonly look: typeof WIDE_LOOK | typeof NARROW_LOOK;
  readonly onActivate?: () => void; readonly ariaLabel: string;
}) {
  const { color, soft } = TONES[tone];
  return (
    <g {...activatable(ariaLabel, onActivate)}>
      <circle cx={x} cy={y} r={r} fill={soft} stroke={color} strokeWidth={tone === 'idle' ? 1.75 : 3} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={label.length > 3 ? look.longLabel : look.label} fontWeight={700} fill={SURFACE.ink}>{label}</text>
      {tag ? <Halo x={x} y={y - r - 8} size={look.note}>{tag}</Halo> : null}
      {sub ? <Halo x={x} y={y + r + 13} size={look.note}>{sub}</Halo> : null}
      <ToneGlyph x={x + r * 0.8} y={y - r * 0.8} tone={tone} />
    </g>
  );
}
