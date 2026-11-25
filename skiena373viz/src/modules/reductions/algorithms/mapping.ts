/**
 * The correspondence between the formula and the graph, as data: point at anything on either side and
 * get back everything that stands for it on both sides, with the mapping in words.
 */
import { formatClause } from './formula';
import type { Clause } from './formula';
import {
  cornerId, crossEdgeId, literalLabel, literalVertexId, triangleEdgeId, TRIANGLE_PAIRS, variableEdgeId,
} from './gadgets';
import type { Highlight, VcEdge, VcNode } from './gadgets';

export type Subject =
  | { readonly kind: 'variable'; readonly variable: string }
  | { readonly kind: 'clause'; readonly clause: number }
  | { readonly kind: 'literal'; readonly clause: number; readonly position: number }
  | { readonly kind: 'vertex'; readonly id: string }
  | { readonly kind: 'edge'; readonly id: string };

export interface Counterparts extends Highlight {
  /** The mapping, in one or two plain sentences. */
  readonly words: string;
}

export const sameSubject = (a: Subject | null, b: Subject | null): boolean => JSON.stringify(a) === JSON.stringify(b);

const clauseNames = (indices: readonly number[]): string => indices.map((i) => `C${i + 1}`).join(', ');
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Every occurrence (clause, position) of a variable, or of one signed literal when `negated` is given. */
function occurrences(clauses: readonly Clause[], variable: string, negated?: boolean): { clause: number; position: number }[] {
  return clauses.flatMap((clause, i) => clause.flatMap((literal, position) => (
    literal.variable === variable && (negated === undefined || literal.negated === negated) ? [{ clause: i, position }] : [])));
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

function forOccurrences(clauses: readonly Clause[], variable: string, negated: boolean | undefined, extra: Partial<Highlight>, words: string): Counterparts {
  const found = occurrences(clauses, variable, negated);
  return {
    clauses: unique(found.map((o) => o.clause)),
    literals: found,
    variables: [variable],
    nodes: unique([...(extra.nodes ?? []), ...found.map((o) => cornerId(o.clause, o.position))]),
    edges: unique([...(extra.edges ?? []), ...found.map((o) => crossEdgeId(o.clause, o.position))]),
    words,
  };
}

export function counterparts(subject: Subject, clauses: readonly Clause[], nodes: readonly VcNode[], edges: readonly VcEdge[]): Counterparts {
  switch (subject.kind) {
    case 'variable': {
      const { variable } = subject;
      const found = occurrences(clauses, variable);
      const where = clauseNames(unique(found.map((o) => o.clause)));
      return forOccurrences(clauses, variable, undefined, {
        nodes: [literalVertexId({ variable, negated: false }), literalVertexId({ variable, negated: true })], edges: [variableEdgeId(variable)],
      }, `Variable ${variable} is the pair of vertices ${variable} and ¬${variable} joined by an edge: a cover takes one of them, which is the choice of ${variable} true or false. It occurs in ${plural(found.length, 'literal')}${found.length > 0 ? ` (clauses ${where})` : ''}.`);
    }
    case 'literal': {
      const literal = clauses[subject.clause]?.[subject.position];
      if (!literal) return { clauses: [], literals: [], variables: [], nodes: [], edges: [], words: 'Nothing is selected.' };
      const text = literalLabel(literal);
      return {
        clauses: [subject.clause],
        literals: [{ clause: subject.clause, position: subject.position }],
        variables: [literal.variable],
        nodes: [cornerId(subject.clause, subject.position), literalVertexId(literal)],
        edges: [crossEdgeId(subject.clause, subject.position)],
        words: `Literal ${text} at position ${subject.position + 1} of clause C${subject.clause + 1} is corner ${subject.position + 1} of that clause's triangle; its cross edge leads to the vertex ${text} of variable ${literal.variable}.`,
      };
    }
    case 'clause': {
      const clause = clauses[subject.clause];
      if (!clause) return { clauses: [], literals: [], variables: [], nodes: [], edges: [], words: 'Nothing is selected.' };
      const i = subject.clause;
      return {
        clauses: [i],
        literals: clause.map((_literal, position) => ({ clause: i, position })),
        variables: unique(clause.map((literal) => literal.variable)),
        nodes: [0, 1, 2].map((position) => cornerId(i, position)),
        edges: [...TRIANGLE_PAIRS.map(([a, b]) => triangleEdgeId(i, a, b)), ...[0, 1, 2].map((position) => crossEdgeId(i, position))],
        words: `Clause C${i + 1} = ${formatClause(clause)} is a triangle with one corner per literal: a cover needs two of its three corners, and the corner left out must have its literal vertex in the cover.`,
      };
    }
    case 'vertex': {
      const node = nodes.find((candidate) => candidate.id === subject.id);
      if (!node) return { clauses: [], literals: [], variables: [], nodes: [], edges: [], words: 'Nothing is selected.' };
      if (node.kind === 'corner' && node.clause !== null && node.position !== null) {
        const text = node.label;
        return {
          ...counterparts({ kind: 'literal', clause: node.clause, position: node.position }, clauses, nodes, edges),
          words: `Corner ${node.position + 1} of triangle C${node.clause + 1} stands for the literal ${text} of that clause: it may stay out of the cover only when the vertex ${text} is in, which makes ${text} true.`,
        };
      }
      const found = occurrences(clauses, node.variable, node.negated);
      const text = node.label;
      return forOccurrences(clauses, node.variable, node.negated, {
        nodes: [node.id], edges: [variableEdgeId(node.variable)],
      }, `The vertex ${text} stands for the literal ${text}: it is one end of the edge ${node.variable} — ¬${node.variable} and is joined to ${found.length === 0 ? 'no corner, because no clause uses this literal' : `${plural(found.length, 'corner')}, one for each occurrence (clauses ${clauseNames(unique(found.map((o) => o.clause)))})`}.`);
    }
    case 'edge': {
      const edge = edges.find((candidate) => candidate.id === subject.id);
      if (!edge) return { clauses: [], literals: [], variables: [], nodes: [], edges: [], words: 'Nothing is selected.' };
      if (edge.kind === 'variable' && edge.variable !== null) {
        return {
          ...counterparts({ kind: 'variable', variable: edge.variable }, clauses, nodes, edges),
          words: `The edge ${edge.variable} — ¬${edge.variable} forces a cover to contain at least one of its ends: this is where each variable gets its true-or-false choice.`,
        };
      }
      if (edge.kind === 'triangle' && edge.clause !== null) {
        return {
          ...counterparts({ kind: 'clause', clause: edge.clause }, clauses, nodes, edges),
          words: `This edge of the triangle for clause C${edge.clause + 1} forces one of its two corners into the cover; the three edges together force at least two corners.`,
        };
      }
      if (edge.clause !== null && edge.position !== null) {
        const literal = clauses[edge.clause]?.[edge.position];
        return {
          ...counterparts({ kind: 'literal', clause: edge.clause, position: edge.position }, clauses, nodes, edges),
          words: `This cross edge ties corner ${edge.position + 1} of clause C${edge.clause + 1} to the vertex ${literal ? literalLabel(literal) : ''}: if the corner stays out of the cover, that vertex must be in it, so the literal is true.`,
        };
      }
      return { clauses: [], literals: [], variables: [], nodes: [], edges: [], words: 'Nothing is selected.' };
    }
  }
}
