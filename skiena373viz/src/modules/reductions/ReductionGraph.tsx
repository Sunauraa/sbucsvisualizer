/** The constructed graph: variable pairs on top, one triangle per clause below, drawn at fixed positions. */
import { SURFACE, TONES } from '@core';
import type { Tone } from '@core';
import { activatable, Halo, SvgEdge, SvgStage, ToneGlyph } from '@ui';
import { NODE_RADIUS } from './algorithms/gadgets';
import type { Highlight, VcEdge, VcNode, VcSize } from './algorithms/gadgets';
import type { Interaction } from './FormulaPanel';

export interface NodeMarkSpec {
  readonly tone?: Tone;
  /** Short text under the vertex. */
  readonly sub?: string;
  /** Said by screen readers after the vertex name: "in the cover". */
  readonly state?: string;
}

export interface EdgeMarkSpec {
  readonly tone?: Tone;
}

export interface ReductionGraphProps {
  readonly size: VcSize;
  readonly nodes: readonly VcNode[];
  readonly edges: readonly VcEdge[];
  readonly nodeMarks?: Readonly<Record<string, NodeMarkSpec>>;
  readonly edgeMarks?: Readonly<Record<string, EdgeMarkSpec>>;
  readonly linked?: Pick<Highlight, 'nodes' | 'edges'> | null;
  readonly interaction?: Interaction;
  /** When given, every vertex is a toggle button (choosing a cover). */
  readonly onToggleVertex?: (id: string) => void;
  readonly title?: string;
  readonly emptyText?: string;
}

const R = NODE_RADIUS;

const vertexName = (node: VcNode): string => (node.kind === 'corner'
  ? `corner ${(node.position ?? 0) + 1} of clause ${(node.clause ?? 0) + 1}, labelled ${node.label}`
  : `vertex ${node.label}`);

function Vertex({ node, mark, linked, interaction, onToggle }: {
  readonly node: VcNode;
  readonly mark: NodeMarkSpec | undefined;
  readonly linked: boolean;
  readonly interaction: Interaction | undefined;
  readonly onToggle: ((id: string) => void) | undefined;
}) {
  const tone = mark?.tone ?? 'idle';
  const { color, soft } = TONES[tone];
  const common = { fill: soft, stroke: color, strokeWidth: tone === 'idle' ? 1.75 : 3 };
  const name = `${vertexName(node)}${mark?.state ? `, ${mark.state}` : ''}`;
  const subject = { kind: 'vertex', id: node.id } as const;
  const long = node.label.length > 3;
  const key = onToggle ? activatable(name, () => onToggle(node.id)) : {};
  return (
    <g
      {...key}
      data-vertex={node.id}
      data-linked={linked ? 'true' : undefined}
      {...(onToggle && mark?.state ? { 'aria-pressed': mark.state === 'in the cover' } : {})}
      onPointerEnter={() => interaction?.onHover(subject)}
      onPointerLeave={() => interaction?.onHover(null)}
      onFocus={onToggle ? () => interaction?.onHover(subject) : undefined}
      onBlur={onToggle ? () => interaction?.onHover(null) : undefined}
      onClick={onToggle ? () => onToggle(node.id) : () => interaction?.onPick(subject)}
      style={interaction || onToggle ? { cursor: 'pointer' } : undefined}
    >
      {linked ? (node.kind === 'corner'
        ? <circle cx={node.x} cy={node.y} r={R + 6} fill="none" stroke={SURFACE.ink} strokeWidth={2.5} strokeDasharray="5 4" />
        : <rect x={node.x - R - 6} y={node.y - R - 6} width={2 * R + 12} height={2 * R + 12} rx={10} fill="none" stroke={SURFACE.ink} strokeWidth={2.5} strokeDasharray="5 4" />) : null}
      {node.kind === 'corner'
        ? <circle cx={node.x} cy={node.y} r={R} {...common} />
        : <rect x={node.x - R} y={node.y - R} width={2 * R} height={2 * R} rx={6} {...common} />}
      <text x={node.x} y={node.y} dy="0.35em" textAnchor="middle" fontSize={long ? 12 : 15} fontWeight={700} fill={SURFACE.ink}
        {...(long ? { textLength: 2 * R - 8, lengthAdjust: 'spacingAndGlyphs' as const } : {})}>{node.label}</text>
      {mark?.sub ? <Halo x={node.x} y={node.y + R + 13} size={12}>{mark.sub}</Halo> : null}
      <ToneGlyph x={node.x + R * 0.8} y={node.y - R * 0.8} tone={tone} />
    </g>
  );
}

export function ReductionGraph({ size, nodes, edges, nodeMarks = {}, edgeMarks = {}, linked = null, interaction, onToggleVertex, title, emptyText = 'Nothing built yet' }: ReductionGraphProps) {
  const at = new Map(nodes.map((node) => [node.id, node]));
  const corners = new Map<number, VcNode[]>();
  for (const node of nodes) if (node.kind === 'corner' && node.clause !== null) corners.set(node.clause, [...(corners.get(node.clause) ?? []), node]);
  const pairs = new Map<string, VcNode[]>();
  for (const node of nodes) if (node.kind === 'literal') pairs.set(node.variable, [...(pairs.get(node.variable) ?? []), node]);
  const summary = `${title ?? 'Graph'}: ${nodes.length} vertices and ${edges.length} edges`;

  return (
    <SvgStage width={size.width} height={size.height} title={summary} minWidth={Math.round(Math.min(size.width, Math.max(380, size.width * 0.72)))} interactive={Boolean(onToggleVertex)}>
      <rect width={size.width} height={size.height} fill="transparent" />
      {nodes.length === 0 ? <Halo x={size.width / 2} y={size.height / 2} fill={SURFACE.muted}>{emptyText}</Halo> : null}
      {[...pairs.entries()].map(([variable, members]) => {
        const xs = members.map((node) => node.x);
        const left = Math.min(...xs) - R - 10;
        const width = Math.max(...xs) - Math.min(...xs) + 2 * R + 20;
        const top = (members[0]?.y ?? 0) - R - 12;
        return <rect key={`pair-${variable}`} x={left} y={top} width={width} height={2 * R + 24} rx={12} fill={SURFACE.page} stroke={SURFACE.line} strokeDasharray="3 4" />;
      })}
      {[...corners.entries()].map(([clause, members]) => {
        if (members.length < 3) return null;
        const points = members.map((node) => `${node.x},${node.y}`).join(' ');
        const x = members.reduce((sum, node) => sum + node.x, 0) / members.length;
        const bottom = Math.max(...members.map((node) => node.y));
        return (
          <g key={`tri-${clause}`}>
            <polygon points={points} fill={SURFACE.page} stroke={SURFACE.line} strokeWidth={26} strokeLinejoin="round" />
            <text x={x} y={bottom + R + 22} textAnchor="middle" fontSize={13} fontWeight={700} fill={SURFACE.muted}>{`C${clause + 1}`}</text>
          </g>
        );
      })}
      {edges.map((edge) => {
        const from = at.get(edge.source);
        const to = at.get(edge.target);
        if (!from || !to) return null;
        const mark = edgeMarks[edge.id];
        const isLinked = Boolean(linked?.edges.includes(edge.id));
        const subject = { kind: 'edge', id: edge.id } as const;
        return (
          <g key={edge.id} data-edge={edge.id} data-linked={isLinked ? 'true' : undefined} onPointerEnter={() => interaction?.onHover(subject)} onPointerLeave={() => interaction?.onHover(null)}
            onClick={() => interaction?.onPick(subject)} style={interaction ? { cursor: 'pointer' } : undefined}>
            {isLinked ? <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={SURFACE.ink} strokeOpacity={0.22} strokeWidth={10} strokeLinecap="round" /> : null}
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={14} />
            <SvgEdge from={from} to={to} r={R} tone={mark?.tone ?? 'idle'} dashed={edge.kind === 'cross'} ariaLabel={`${edge.kind} edge`} />
          </g>
        );
      })}
      {nodes.map((node) => (
        <Vertex key={node.id} node={node} mark={nodeMarks[node.id]} linked={Boolean(linked?.nodes.includes(node.id))}
          interaction={interaction} onToggle={onToggleVertex} />
      ))}
    </SvgStage>
  );
}
