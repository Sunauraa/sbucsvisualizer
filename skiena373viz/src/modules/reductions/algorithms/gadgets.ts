/**
 * The vocabulary of the 3-SAT to Vertex Cover graph: vertex and edge ids, kinds, and the layout.
 * Ids are part of the URL (a chosen cover is a list of vertex ids), so they are stable:
 *   literal vertex   `x1`, `!x1`          (the pair of variable x1)
 *   corner           `c2.3`               (clause 2, third literal; 1-based in ids, 0-based in fields)
 *   variable edge    `var:x1`
 *   triangle edge    `tri:2:1-3`          (clause 2, corners 1 and 3)
 *   cross edge       `cross:2.3`          (corner 3 of clause 2 to its literal vertex)
 */
import type { Literal } from './formula';

export interface VcNode {
  readonly id: string;
  /** What is drawn inside: `x1`, `¬x1`. */
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly kind: 'literal' | 'corner';
  /** The variable of the literal this vertex stands for. */
  readonly variable: string;
  readonly negated: boolean;
  /** 0-based clause and position of a corner; null for a literal vertex. */
  readonly clause: number | null;
  readonly position: number | null;
}

export interface VcEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'variable' | 'triangle' | 'cross';
  /** The variable of a variable edge; null otherwise. */
  readonly variable: string | null;
  /** 0-based clause of a triangle or cross edge; null for a variable edge. */
  readonly clause: number | null;
  /** 0-based corner position of a cross edge; null otherwise. */
  readonly position: number | null;
}

/** The drawing area is fixed by the input, never by the frame. */
export interface VcSize {
  readonly width: number;
  readonly height: number;
}

export interface VcGraph extends VcSize {
  readonly nodes: readonly VcNode[];
  readonly edges: readonly VcEdge[];
}

export const NODE_RADIUS = 20;

export const literalLabel = (literal: Literal): string => `${literal.negated ? '¬' : ''}${literal.variable}`;
export const literalVertexId = (literal: Literal): string => `${literal.negated ? '!' : ''}${literal.variable}`;
export const cornerId = (clause: number, position: number): string => `c${clause + 1}.${position + 1}`;
export const variableEdgeId = (variable: string): string => `var:${variable}`;
export const crossEdgeId = (clause: number, position: number): string => `cross:${clause + 1}.${position + 1}`;
/** Corners a and b of a clause (0-based, a < b). */
export const triangleEdgeId = (clause: number, a: number, b: number): string => `tri:${clause + 1}:${a + 1}-${b + 1}`;

/** The three edges of a triangle as corner position pairs, in the order they are built. */
export const TRIANGLE_PAIRS: readonly (readonly [number, number])[] = [[0, 1], [0, 2], [1, 2]];

// ---------------------------------------------------------------------------------------------
// Layout: variable pairs in a top row, triangles below in one row. Size depends only on n and m.

const MARGIN = 36;
const PAIR_WIDTH = 124;
const PAIR_OFFSET = 34;
const TRIANGLE_WIDTH = 136;
const TRIANGLE_OFFSET = 38;
const TOP_Y = 40;
const TRIANGLE_DEPTH = 46;
const MIN_WIDTH = 280;

/** Where the top of the triangles sits: below the pairs when there are any. */
const triangleTop = (n: number): number => (n > 0 ? 190 : 34);

export function layoutSize(n: number, m: number): VcSize {
  const content = Math.max(n * PAIR_WIDTH, m * TRIANGLE_WIDTH);
  const width = Math.max(MIN_WIDTH, content + 2 * MARGIN);
  const height = m > 0 ? triangleTop(n) + TRIANGLE_DEPTH + 58 : n > 0 ? TOP_Y + 66 : 120;
  return { width, height };
}

/** Left edge of a row of `count` blocks of `block` pixels, centred in the drawing. */
function rowStart(n: number, m: number, count: number, block: number): number {
  return (layoutSize(n, m).width - count * block) / 2;
}

/** Position of the literal vertex of the variable with 0-based `index`. */
export function literalPosition(n: number, m: number, index: number, negated: boolean): { x: number; y: number } {
  const centre = rowStart(n, m, n, PAIR_WIDTH) + index * PAIR_WIDTH + PAIR_WIDTH / 2;
  return { x: Math.round(centre + (negated ? PAIR_OFFSET : -PAIR_OFFSET)), y: TOP_Y };
}

/** Position of corner `position` (0 left, 1 top, 2 right) of triangle `clause`. */
export function cornerPosition(n: number, m: number, clause: number, position: number): { x: number; y: number } {
  const centre = rowStart(n, m, m, TRIANGLE_WIDTH) + clause * TRIANGLE_WIDTH + TRIANGLE_WIDTH / 2;
  const top = triangleTop(n);
  if (position === 1) return { x: Math.round(centre), y: top };
  return { x: Math.round(centre + (position === 0 ? -TRIANGLE_OFFSET : TRIANGLE_OFFSET)), y: top + TRIANGLE_DEPTH };
}

/** Where the "C3" label of a triangle goes. */
export function clauseLabelPosition(n: number, m: number, clause: number): { x: number; y: number } {
  const bottom = cornerPosition(n, m, clause, 0);
  return { x: Math.round(rowStart(n, m, m, TRIANGLE_WIDTH) + clause * TRIANGLE_WIDTH + TRIANGLE_WIDTH / 2), y: bottom.y + 36 };
}

export function literalVertex(literal: Literal, index: number, n: number, m: number): VcNode {
  const { x, y } = literalPosition(n, m, index, literal.negated);
  return {
    id: literalVertexId(literal), label: literalLabel(literal), x, y, kind: 'literal',
    variable: literal.variable, negated: literal.negated, clause: null, position: null,
  };
}

export function cornerVertex(literal: Literal, clause: number, position: number, n: number, m: number): VcNode {
  const { x, y } = cornerPosition(n, m, clause, position);
  return {
    id: cornerId(clause, position), label: literalLabel(literal), x, y, kind: 'corner',
    variable: literal.variable, negated: literal.negated, clause, position,
  };
}

/** What a frame points at, on both sides of the picture. Clause and position numbers are 0-based. */
export interface Highlight {
  readonly clauses: readonly number[];
  readonly literals: readonly { readonly clause: number; readonly position: number }[];
  readonly variables: readonly string[];
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
}

export const NO_HIGHLIGHT: Highlight = { clauses: [], literals: [], variables: [], nodes: [], edges: [] };
