/** Shared SVG primitives. All state styling goes through `tone`, which also draws a glyph. */
import type { KeyboardEvent, ReactNode } from 'react';
import { SURFACE, TONES } from '@core';
import type { Tone } from '@core';
import { arrowPoints, edgeGeometry } from './geometry';
import { ScrollX } from './ScrollX';
import type { Pt } from './geometry';

export interface SvgStageProps {
  readonly width: number;
  readonly height: number;
  /** Accessible name: what this picture shows right now. */
  readonly title: string;
  readonly children: ReactNode;
  /** Below this many CSS pixels the stage scrolls inside its own box instead of shrinking further. */
  readonly minWidth?: number;
  /** Set when children contain focusable controls; otherwise the stage is announced as one image. */
  readonly interactive?: boolean;
}

/**
 * Responsive SVG frame. Keep width/height CONSTANT for the whole trace (derive them from the input,
 * never from the current frame) so that stepping and scrubbing never move the page.
 */
export function SvgStage({ width, height, title, children, minWidth, interactive = false }: SvgStageProps) {
  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role={interactive ? 'group' : 'img'}
      aria-label={title}
      className="svg-stage"
      style={{ maxWidth: `${Math.round(width * 1.25)}px`, minWidth: minWidth ? `${minWidth}px` : undefined }}
    >
      {children}
    </svg>
  );
  if (!minWidth) return svg;
  return <ScrollX label={title}>{svg}</ScrollX>;
}

/** Makes an SVG shape operable: click, Enter and Space. Spread onto a <g>. */
export function activatable(label: string, onActivate: (() => void) | undefined) {
  if (!onActivate) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    className: 'svg-button',
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
      }
    },
  } as const;
}

/** The non-colour half of a tone: a small badge with the tone's glyph. */
export function ToneGlyph({ x, y, tone, r = 8 }: { readonly x: number; readonly y: number; readonly tone: Tone; readonly r?: number }) {
  const { color, glyph } = TONES[tone];
  if (glyph === '') return null;
  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={1.5} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={r * 1.35} fontWeight={700} fill={TONES[tone].ink}>{glyph}</text>
    </g>
  );
}

export interface NodeProps {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly tone?: Tone;
  readonly r?: number;
  /** Text under the node, e.g. a distance or key. */
  readonly sub?: string;
  /** Text above the node, e.g. 'start'. */
  readonly tag?: string;
  /** Square nodes read as a different kind of thing (heap array slot, literal, clause). */
  readonly shape?: 'circle' | 'square';
  readonly onActivate?: () => void;
  readonly ariaLabel?: string;
}

export function SvgNode({ x, y, label, tone = 'idle', r = 20, sub, tag, shape = 'circle', onActivate, ariaLabel }: NodeProps) {
  const { color, soft } = TONES[tone];
  const common = { fill: soft, stroke: color, strokeWidth: tone === 'idle' ? 1.75 : 3 };
  return (
    <g {...activatable(ariaLabel ?? label, onActivate)}>
      {shape === 'circle'
        ? <circle cx={x} cy={y} r={r} {...common} />
        : <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={5} {...common} />}
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={label.length > 3 ? 11 : 14} fontWeight={700} fill={SURFACE.ink}>{label}</text>
      {tag ? <Halo x={x} y={y - r - 8} size={12}>{tag}</Halo> : null}
      {sub ? <Halo x={x} y={y + r + 13} size={12}>{sub}</Halo> : null}
      <ToneGlyph x={x + r * 0.8} y={y - r * 0.8} tone={tone} />
    </g>
  );
}

/** Text with a white outline, readable over lines. */
export function Halo({ x, y, size = 13, fill = SURFACE.ink, children }: {
  readonly x: number; readonly y: number; readonly size?: number; readonly fill?: string; readonly children: ReactNode;
}) {
  return (
    <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={size} fontWeight={600} fill={fill}
      stroke="#fff" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">{children}</text>
  );
}

export interface EdgeProps {
  readonly from: Pt;
  readonly to: Pt;
  readonly tone?: Tone;
  readonly label?: string;
  readonly directed?: boolean;
  /** Radius of the nodes at both ends; the line stops at their rims. */
  readonly r?: number;
  /** Sideways curve, for antiparallel pairs. */
  readonly bend?: number;
  readonly dashed?: boolean;
  readonly onActivate?: () => void;
  readonly ariaLabel?: string;
}

export function SvgEdge({ from, to, tone = 'idle', label, directed = false, r = 20, bend = 0, dashed = false, onActivate, ariaLabel }: EdgeProps) {
  const geometry = edgeGeometry(from, to, r, bend);
  const { color, glyph } = TONES[tone];
  const text = [glyph, label].filter(Boolean).join(' ');
  return (
    <g {...activatable(ariaLabel ?? label ?? 'edge', onActivate)}>
      {onActivate ? <path d={geometry.path} fill="none" stroke="transparent" strokeWidth={18} /> : null}
      <path d={geometry.path} fill="none" stroke={color} strokeWidth={tone === 'idle' ? 1.75 : 3.5} strokeDasharray={dashed ? '6 5' : undefined} />
      {directed ? <polygon points={arrowPoints(geometry.tip, geometry.angle, 11)} fill={color} /> : null}
      {text ? <Halo x={geometry.mid.x} y={geometry.mid.y} fill={TONES[tone].ink}>{text}</Halo> : null}
    </g>
  );
}

/** A free arrow between two points (pointers, dependencies, carries). */
export function SvgArrow({ from, to, tone = 'active', label, bend = 0, trim = 0 }: {
  readonly from: Pt; readonly to: Pt; readonly tone?: Tone; readonly label?: string; readonly bend?: number; readonly trim?: number;
}) {
  return <SvgEdge from={from} to={to} tone={tone} label={label} bend={bend} r={trim} directed />;
}
