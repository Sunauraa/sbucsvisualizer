/**
 * The two certificate maps of the reduction, as plain functions (the trace in certificates.ts
 * explains them step by step; the interactive panels call these).
 *
 *   assignment -> cover : take the true literal of every variable pair; in every triangle leave out
 *                         the FIRST corner whose literal is true and take the other two.
 *   cover -> assignment : x is true exactly when the vertex x is in the cover.
 */
import { firstTrueLiteral, formulaVariables, unsatisfiedClauses, valueOf } from './formula';
import type { Assignment, Formula } from './formula';
import { cornerId, literalVertexId } from './gadgets';
import type { VcEdge, VcGraph, VcNode } from './gadgets';

/** Why a certificate is refused: the specific edge, clause or size that breaks it. */
export type Witness =
  | { readonly kind: 'edge'; readonly edge: string; readonly source: string; readonly target: string }
  | { readonly kind: 'clause'; readonly clause: number }
  | { readonly kind: 'size'; readonly size: number; readonly k: number };

export interface CoverFromAssignment {
  /** Vertex ids: variable vertices first (in variable order), then corners clause by clause. */
  readonly cover: readonly string[];
  /** Corner ids left out: one per satisfied clause. */
  readonly leftOut: readonly string[];
  /** Clauses with no true literal. For these all three corners are taken, which overshoots k. */
  readonly unsatisfied: readonly number[];
  readonly k: number;
}

export function assignmentToCover(formula: Formula, assignment: Assignment): CoverFromAssignment {
  const variables = formulaVariables(formula);
  const cover: string[] = variables.map((variable) => literalVertexId({ variable, negated: !valueOf(assignment, variable) }));
  const leftOut: string[] = [];
  formula.clauses.forEach((clause, i) => {
    const out = firstTrueLiteral(clause, assignment);
    for (let position = 0; position < 3; position += 1) {
      if (position === out) leftOut.push(cornerId(i, position));
      else cover.push(cornerId(i, position));
    }
  });
  return { cover, leftOut, unsatisfied: unsatisfiedClauses(formula, assignment), k: variables.length + 2 * formula.clauses.length };
}

/** Every edge with no endpoint in the cover, in construction order. */
export function uncoveredEdges(graph: VcGraph, cover: readonly string[]): VcGraph['edges'] {
  const chosen = new Set(cover);
  return graph.edges.filter((edge) => !chosen.has(edge.source) && !chosen.has(edge.target));
}

export type AssignmentFromCover =
  | { readonly ok: true; readonly assignment: Record<string, boolean> }
  | { readonly ok: false; readonly witness: Witness };

/**
 * Reads an assignment off a vertex cover of size at most k. Refuses, with the witness, when the set
 * leaves an edge uncovered (the first one) or has more than k vertices.
 */
export function coverToAssignment(formula: Formula, graph: VcGraph, cover: readonly string[], k: number): AssignmentFromCover {
  const known = new Set(graph.nodes.map((node) => node.id));
  const chosen = new Set(cover.filter((id) => known.has(id)));
  const bad = uncoveredEdges(graph, [...chosen])[0];
  if (bad) return { ok: false, witness: { kind: 'edge', edge: bad.id, source: bad.source, target: bad.target } };
  if (chosen.size > k) return { ok: false, witness: { kind: 'size', size: chosen.size, k } };
  const assignment: Record<string, boolean> = {};
  for (const variable of formulaVariables(formula)) assignment[variable] = chosen.has(literalVertexId({ variable, negated: false }));
  return { ok: true, assignment };
}

/** An edge in words, for lists and messages: `x1 — ¬x1`, `triangle edge of C2 between corners 1 and 3`, ... */
export function describeEdge(edge: VcEdge, nodes: readonly VcNode[]): string {
  const label = (id: string): string => nodes.find((node) => node.id === id)?.label ?? id;
  if (edge.kind === 'variable') return `${label(edge.source)} — ${label(edge.target)}`;
  const corner = (id: string): number => (nodes.find((node) => node.id === id)?.position ?? 0) + 1;
  if (edge.kind === 'triangle') return `triangle edge of C${(edge.clause ?? 0) + 1} between corners ${corner(edge.source)} and ${corner(edge.target)}`;
  return `cross edge from corner ${corner(edge.source)} of C${(edge.clause ?? 0) + 1} to ${label(edge.target)}`;
}

export interface CoverReport {
  readonly size: number;
  readonly k: number;
  /** Every edge with no endpoint in the cover. */
  readonly uncovered: readonly VcEdge[];
  /** Variables whose vertices x and ¬x are both in the cover. */
  readonly bothEnds: readonly string[];
  /** The assignment read off the cover, or null when the cover is refused. */
  readonly assignment: Readonly<Record<string, boolean>> | null;
  /** One sentence: the induced assignment, or exactly why there is none. */
  readonly reason: string;
}

/** Everything the "choose a cover" panel shows: coverage, size against k, and the assignment or the reason for none. */
export function reportCover(formula: Formula, graph: VcGraph, cover: readonly string[], k: number): CoverReport {
  const known = new Set(graph.nodes.map((node) => node.id));
  const chosen = [...new Set(cover.filter((id) => known.has(id)))];
  const uncovered = uncoveredEdges(graph, chosen);
  const variables = formulaVariables(formula);
  const bothEnds = variables.filter((variable) => chosen.includes(variable) && chosen.includes(`!${variable}`));
  const mapped = coverToAssignment(formula, graph, chosen, k);
  const base = { size: chosen.length, k, uncovered, bothEnds };
  if (mapped.ok) {
    const text = variables.length === 0 ? 'the empty assignment' : variables.map((v) => `${v} = ${mapped.assignment[v] ? 'T' : 'F'}`).join(', ');
    return { ...base, assignment: mapped.assignment, reason: `S covers every edge with ${chosen.length} ≤ k = ${k} vertices, so it holds exactly one vertex of each pair and two of each triangle, and it induces ${text}.` };
  }
  if (mapped.witness.kind === 'edge') {
    const edge = uncovered[0];
    const what = edge ? describeEdge(edge, graph.nodes) : mapped.witness.edge;
    return { ...base, assignment: null, reason: `The ${what} has no endpoint in S, so S is not a vertex cover${uncovered.length > 1 ? ` (${uncovered.length} edges are uncovered)` : ''} and induces no assignment.` };
  }
  const first = bothEnds[0];
  const ambiguous = first === undefined
    ? ' and some pair or triangle holds more vertices than the counting argument allows'
    : `, for example ${first} and ¬${first} are both in S, so ${first} would be both true and false`;
  return { ...base, assignment: null, reason: `S covers every edge but has ${chosen.length} vertices, more than k = ${k}${ambiguous}, so no assignment is read off it.` };
}
