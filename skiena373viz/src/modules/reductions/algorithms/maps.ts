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
import type { VcGraph } from './gadgets';

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
