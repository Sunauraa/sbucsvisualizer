/**
 * 3-SAT to Vertex Cover: build the graph G and the bound k from a 3-CNF formula, one gadget at a time.
 *
 * The construction reads only the shape of the formula. It never asks whether the formula is
 * satisfiable (this file does not import the solver); the same code path serves both cases.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { formulaFrom, formatClause, formulaVariables } from './formula';
import type { Clause, Formula } from './formula';
import {
  cornerId, cornerVertex, crossEdgeId, layoutSize, literalLabel, literalVertex, literalVertexId, NO_HIGHLIGHT, triangleEdgeId,
  TRIANGLE_PAIRS, variableEdgeId,
} from './gadgets';
import type { Highlight, VcEdge, VcGraph, VcNode, VcSize } from './gadgets';

export interface KTerm {
  readonly label: string;
  readonly value: number;
}

export interface ConstructState extends VcSize {
  readonly clauses: readonly Clause[];
  readonly variables: readonly string[];
  /** The graph built so far. */
  readonly nodes: readonly VcNode[];
  readonly edges: readonly VcEdge[];
  /** Null until the bound is being assembled; then the running total. */
  readonly k: number | null;
  readonly kTerms: readonly KTerm[];
  readonly highlight: Highlight;
}

export interface ConstructResult {
  readonly variables: readonly string[];
  readonly n: number;
  readonly m: number;
  readonly k: number;
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly graph: VcGraph;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'reduce(formula φ with n variables, m clauses)'],
  ['var-loop', 1, 'for each variable x of φ'],
  ['var-gadget', 2, 'add vertices x and ¬x and the edge x — ¬x'],
  ['clause-loop', 1, 'for each clause C = (a ∨ b ∨ c) of φ'],
  ['triangle', 2, 'add corners a, b, c, joined in a triangle'],
  ['cross', 2, 'join each corner to the vertex of its own literal'],
  ['bound-vars', 1, 'k ← 0, then add 1 for each variable edge'],
  ['bound-clauses', 1, 'add 2 for each triangle, so k = n + 2m'],
  ['return', 1, 'return (G, k)'],
]);

const OPS = defineOps([
  { id: 'vertices', label: 'Vertices built', counts: 'One for each vertex added to G: two per variable gadget and three per triangle.' },
  { id: 'edges', label: 'Edges built', counts: 'One for each edge added to G: one per variable gadget, three per triangle and three cross edges per clause.' },
  { id: 'literals-read', label: 'Literals read', counts: 'One for each literal occurrence of the formula read to label a corner (three per clause).' },
]);

type T = Recorder<ConstructState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const list = (names: readonly string[]): string => (names.length === 0 ? 'none' : names.join(', '));
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const threeSatToVertexCover = defineAlgorithm({
  id: 'reductions-3sat-vertex-cover',
  title: '3-SAT to Vertex Cover',
  summary: 'Turn a 3-CNF formula into a graph G and a number k so that the formula is satisfiable exactly when G has a vertex cover of size k.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case', bound: 'Θ(n + m)', why: 'each of the n variables adds a constant amount of graph and each of the m clauses adds three vertices and six edges.' },
    { resource: 'space', when: 'every case', bound: 'Θ(n + m)', why: 'the graph has 2n + 3m vertices and n + 6m edges.' },
  ],
  presets: [
    { id: 'satisfiable', label: 'Satisfiable', input: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)') },
    { id: 'unique', label: 'Exactly one satisfying assignment', input: formulaFrom('(x1 | x2 | x2) & (!x1 | x2 | x2) & (x1 | !x2 | !x2)') },
    { id: 'unsatisfiable', label: 'Unsatisfiable, with repeated literals', input: formulaFrom('(x1 | x1 | x1) & (!x1 | !x1 | !x1)') },
    {
      id: 'all-sign-patterns',
      label: 'All eight sign patterns on three variables (unsatisfiable)',
      input: formulaFrom('(x1 | x2 | x3) & (x1 | x2 | !x3) & (x1 | !x2 | x3) & (x1 | !x2 | !x3) & (!x1 | x2 | x3) & (!x1 | x2 | !x3) & (!x1 | !x2 | x3) & (!x1 | !x2 | !x3)'),
    },
    { id: 'tautological-clause', label: 'A clause containing x and ¬x', input: formulaFrom('(x1 | !x1 | x2) & (!x2 | x3 | x3)') },
    { id: 'single-clause', label: 'A single clause', input: formulaFrom('(x1 | x2 | x3)') },
    { id: 'empty', label: 'No clauses at all', input: { clauses: [] } },
  ],
  execute(formula: Formula, t: T): Finished<ConstructResult> {
    const { clauses } = formula;
    const variables = formulaVariables(formula);
    const n = variables.length;
    const m = clauses.length;
    const size = layoutSize(n, m);
    const nodes: VcNode[] = [];
    const edges: VcEdge[] = [];
    let k: number | null = null;
    const kTerms: KTerm[] = [];
    let highlight: Highlight = NO_HIGHLIGHT;

    const state = (): ConstructState => ({ clauses, variables, ...size, nodes, edges, k, kTerms, highlight });

    t.step({
      lines: ['signature'],
      say: () => (m === 0 && n === 0
        ? 'The formula has no clauses and no variables, so there is nothing to build: the graph will be empty and k will be 0.'
        : `The formula has ${plural(m, 'clause')} over ${plural(n, 'variable')} (${list(variables)}), so G will have ${2 * n + 3 * m} vertices and ${n + 6 * m} edges.`),
      state,
    });

    variables.forEach((variable, index) => {
      const pos = literalVertex({ variable, negated: false }, index, n, m);
      const neg = literalVertex({ variable, negated: true }, index, n, m);
      const edge: VcEdge = {
        id: variableEdgeId(variable), source: pos.id, target: neg.id, kind: 'variable', variable, clause: null, position: null,
      };
      nodes.push(pos, neg);
      edges.push(edge);
      t.count('vertices', 2);
      t.count('edges');
      highlight = { ...NO_HIGHLIGHT, variables: [variable], nodes: [pos.id, neg.id], edges: [edge.id] };
      t.event('insert', [`node:${pos.id}`, `node:${neg.id}`]);
      t.event('link', [`edge:${edge.id}`], `${pos.label} — ${neg.label}`);
      t.step({
        lines: ['var-gadget'],
        say: `Variable ${variable} gets the vertices ${pos.label} and ${neg.label} joined by an edge, so any cover must contain at least one of them.`,
        state,
      });
    });

    clauses.forEach((clause, i) => {
      const corners = clause.map((literal, position) => cornerVertex(literal, i, position, n, m));
      const triangle = TRIANGLE_PAIRS.map(([a, b]): VcEdge => ({
        id: triangleEdgeId(i, a, b), source: cornerId(i, a), target: cornerId(i, b), kind: 'triangle', variable: null, clause: i, position: null,
      }));
      nodes.push(...corners);
      edges.push(...triangle);
      t.count('literals-read', 3);
      t.count('vertices', 3);
      t.count('edges', 3);
      highlight = {
        ...NO_HIGHLIGHT, clauses: [i], literals: clause.map((_literal, position) => ({ clause: i, position })),
        nodes: corners.map((corner) => corner.id), edges: triangle.map((edge) => edge.id),
      };
      t.event('insert', corners.map((corner) => `node:${corner.id}`));
      t.event('link', triangle.map((edge) => `edge:${edge.id}`));
      t.step({
        lines: ['triangle'],
        say: `Clause C${i + 1} = ${formatClause(clause)} gets a triangle with one corner per literal, and any cover needs at least two of its three corners.`,
        state,
      });

      clause.forEach((literal, position) => {
        const cross: VcEdge = {
          id: crossEdgeId(i, position), source: cornerId(i, position), target: literalVertexId(literal), kind: 'cross',
          variable: null, clause: i, position,
        };
        edges.push(cross);
        t.count('edges');
        highlight = {
          ...NO_HIGHLIGHT, clauses: [i], literals: [{ clause: i, position }], variables: [literal.variable],
          nodes: [cross.source, cross.target], edges: [cross.id],
        };
        t.event('link', [`edge:${cross.id}`]);
        t.step({
          lines: ['cross'],
          say: `Corner ${position + 1} of clause C${i + 1}, labelled ${literalLabel(literal)}, is joined to the vertex ${literalLabel(literal)} of its variable pair, so a corner left out of the cover forces that literal vertex in.`,
          state,
        });
      });
    });

    k = 0;
    variables.forEach((variable, index) => {
      k = (k ?? 0) + 1;
      kTerms.push({ label: `edge ${variable} — ¬${variable}`, value: 1 });
      highlight = { ...NO_HIGHLIGHT, variables: [variable], nodes: [literalVertexId({ variable, negated: false }), literalVertexId({ variable, negated: true })], edges: [variableEdgeId(variable)] };
      t.event('note', [`edge:${variableEdgeId(variable)}`], '+1');
      t.step({
        lines: ['bound-vars'],
        say: `The edge ${variable} — ¬${variable} needs one endpoint in any cover, so it adds 1 to k, which is now ${k} (variable ${index + 1} of ${n}).`,
        state,
      });
    });
    clauses.forEach((clause, i) => {
      k = (k ?? 0) + 2;
      kTerms.push({ label: `triangle C${i + 1}`, value: 2 });
      highlight = {
        ...NO_HIGHLIGHT, clauses: [i], nodes: clause.map((_literal, position) => cornerId(i, position)),
        edges: TRIANGLE_PAIRS.map(([a, b]) => triangleEdgeId(i, a, b)),
      };
      t.event('note', [`clause:${i}`], '+2');
      t.step({
        lines: ['bound-clauses'],
        say: `The triangle of clause C${i + 1} needs two of its three corners in any cover, so it adds 2 to k, which is now ${k}.`,
        state,
      });
    });

    highlight = NO_HIGHLIGHT;
    const kTotal = n + 2 * m;
    const graph: VcGraph = { ...size, nodes: [...nodes], edges: [...edges] };
    return t.finish({
      lines: ['return'],
      say: m === 0 && n === 0
        ? 'Return the empty graph with k = 0; the empty formula is satisfied and the empty set is a cover of size 0.'
        : `Return G with ${nodes.length} vertices and ${edges.length} edges, and k = ${n} + 2·${m} = ${kTotal}.`,
      state,
      result: {
        variables, n, m, k: kTotal, vertexCount: nodes.length, edgeCount: edges.length, graph,
      },
    });
  },
});

/** The reduction without frames: the graph and k for a formula. */
export function buildReduction(formula: Formula): ConstructResult {
  return threeSatToVertexCover.run(formula, { mode: 'counts' }).result;
}
