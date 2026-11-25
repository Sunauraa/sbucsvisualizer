/**
 * Certificates across the reduction, both directions, as traces:
 *   assignment -> cover   (a satisfying assignment becomes a vertex cover of size exactly k)
 *   cover -> assignment   (a vertex cover of size at most k becomes a satisfying assignment)
 * Every frame names the vertex, edge or clause it justifies. A wrong certificate is refused at one
 * specific unsatisfied clause, uncovered edge, or size.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { buildReduction } from './construct';
import { clauseIsSatisfied, firstTrueLiteral, formatClause, formulaFrom, literalIsTrue, valueOf } from './formula';
import type { Assignment, Clause, Formula } from './formula';
import {
  cornerId, crossEdgeId, literalLabel, literalVertexId, NO_HIGHLIGHT, triangleEdgeId, TRIANGLE_PAIRS, variableEdgeId,
} from './gadgets';
import type { Highlight, VcEdge, VcNode, VcSize } from './gadgets';
import type { Witness } from './maps';

export type Direction = 'to-cover' | 'to-assignment';

export interface CertificateInput {
  readonly formula: Formula;
  readonly direction: Direction;
  /** Used by 'to-cover'. A variable that is missing counts as false. */
  readonly assignment: Assignment;
  /** Used by 'to-assignment': vertex ids. Unknown ids are ignored and repeats count once. */
  readonly cover: readonly string[];
}

export type ClauseStatus = 'unknown' | 'satisfied' | 'unsatisfied';

export interface CertificateState extends VcSize {
  readonly direction: Direction;
  readonly clauses: readonly Clause[];
  readonly variables: readonly string[];
  readonly nodes: readonly VcNode[];
  readonly edges: readonly VcEdge[];
  readonly k: number;
  /** Known truth values; null where the cover has not been read yet. */
  readonly assignment: Readonly<Record<string, boolean | null>>;
  /** The vertex set S: vertex ids so far (to-cover) or as given (to-assignment). */
  readonly cover: readonly string[];
  /** Corners left out of S, one per clause handled so far. */
  readonly leftOut: readonly string[];
  readonly clauseStatus: readonly ClauseStatus[];
  /** Edges shown to have an endpoint in S so far. */
  readonly verified: readonly string[];
  readonly witness: Witness | null;
  readonly highlight: Highlight;
}

export interface CertificateResult {
  readonly direction: Direction;
  /** True when the certificate was converted; false when it was refused. */
  readonly accepted: boolean;
  readonly witness: Witness | null;
  readonly cover: readonly string[] | null;
  readonly assignment: Readonly<Record<string, boolean>> | null;
  readonly k: number;
  /** All clauses that no literal satisfies, for 'to-cover'; empty otherwise. */
  readonly unsatisfied: readonly number[];
}

const PSEUDOCODE = definePseudocode([
  ['fwd-signature', 0, 'assignment-to-cover(φ, a)'],
  ['fwd-vars', 1, 'for each variable x: add the vertex of the true literal of x to S'],
  ['fwd-clause', 1, 'for each clause C of φ:'],
  ['fwd-find', 2, 'find the first corner of C whose literal is true under a'],
  ['fwd-fail', 2, 'if there is none: reject (all three corners are needed, so |S| > k)'],
  ['fwd-take', 2, 'add the other two corners to S'],
  ['fwd-return', 1, 'return S, with |S| = n + 2m = k'],
  ['bwd-signature', 0, 'cover-to-assignment(φ, S)'],
  ['bwd-edges', 1, 'for each edge of G: check that an endpoint is in S'],
  ['bwd-edge-fail', 2, 'if no endpoint is in S: reject (S is not a vertex cover)'],
  ['bwd-size', 1, 'if |S| > k: reject (S is too big)'],
  ['bwd-count', 1, 'variable edges need 1 vertex, triangles need 2, so |S| ≥ k and |S| = k'],
  ['bwd-vars', 1, 'for each variable x: a(x) ← true if x is in S, else false'],
  ['bwd-clauses', 1, 'for each clause C: the corner left out has its literal vertex in S'],
  ['bwd-return', 1, 'return a'],
]);

const OPS = defineOps([
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for each edge of G shown to have an endpoint in S (or found to have none).' },
  { id: 'clause-checks', label: 'Clause checks', counts: 'One for each clause examined for a true literal or for its left-out corner.' },
  { id: 'vertices-added', label: 'Vertices added', counts: 'One for each vertex the assignment-to-cover map puts into S.' },
]);

type T = Recorder<CertificateState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const truth = (value: boolean): string => (value ? 'true' : 'false');
const assignmentText = (variables: readonly string[], values: Readonly<Record<string, boolean>>): string =>
  (variables.length === 0 ? 'the empty assignment' : variables.map((v) => `${v} = ${valueOf(values, v) ? 'T' : 'F'}`).join(', '));

export const certificates = defineAlgorithm({
  id: 'reductions-certificates',
  title: 'Certificates in both directions',
  summary: 'Convert a satisfying assignment into a vertex cover of size k, and a vertex cover of size at most k into a satisfying assignment.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case', bound: 'Θ(n + m)', why: 'each variable, each clause and each of the n + 6m edges is handled once, in constant time.' },
    { resource: 'space', when: 'every case', bound: 'Θ(n + m)', why: 'the cover and the assignment are stored next to the graph.' },
  ],
  presets: [
    {
      id: 'assignment-to-cover', label: 'Assignment to cover',
      input: { formula: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)'), direction: 'to-cover', assignment: { x1: true, x2: true, x3: false }, cover: [] },
    },
    {
      id: 'wrong-assignment', label: 'Wrong assignment: a clause fails',
      input: { formula: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)'), direction: 'to-cover', assignment: { x1: true, x2: false, x3: false }, cover: [] },
    },
    {
      id: 'cover-to-assignment', label: 'Cover to assignment',
      input: {
        formula: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)'), direction: 'to-assignment', assignment: {},
        cover: ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1', 'c2.3'],
      },
    },
    {
      id: 'uncovered-edge', label: 'Wrong cover: an edge is uncovered',
      input: {
        formula: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)'), direction: 'to-assignment', assignment: {},
        cover: ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1'],
      },
    },
    {
      id: 'oversized-cover', label: 'Wrong cover: too many vertices',
      input: {
        formula: formulaFrom('(x1 | !x2 | x3) & (!x1 | x2 | x2)'), direction: 'to-assignment', assignment: {},
        cover: ['x1', '!x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1', 'c2.3'],
      },
    },
    {
      id: 'empty', label: 'Empty formula',
      input: { formula: { clauses: [] }, direction: 'to-cover', assignment: {}, cover: [] },
    },
  ],
  execute({ formula, direction, assignment, cover: given }: CertificateInput, t: T): Finished<CertificateResult> {
    const reduction = buildReduction(formula);
    const { graph, k, variables, n, m } = reduction;
    const { clauses } = formula;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
    const clauseText = (i: number): string => `C${i + 1}`;

    // The values being worked with. 'to-cover' knows them from the start; 'to-assignment' reads them off.
    const values: Record<string, boolean | null> = {};
    for (const variable of variables) values[variable] = direction === 'to-cover' ? valueOf(assignment, variable) : null;
    const cover: string[] = [];
    const leftOut: string[] = [];
    const verified: string[] = [];
    const status: ClauseStatus[] = clauses.map((clause): ClauseStatus => {
      if (direction === 'to-assignment') return 'unknown';
      return clauseIsSatisfied(clause, assignment) ? 'satisfied' : 'unsatisfied';
    });
    let witness: Witness | null = null;
    let highlight: Highlight = NO_HIGHLIGHT;

    const state = (): CertificateState => ({
      direction, clauses, variables, width: graph.width, height: graph.height, nodes: graph.nodes, edges: graph.edges, k,
      assignment: values, cover, leftOut, clauseStatus: status, verified, witness, highlight,
    });
    const refused = (partial: Partial<CertificateResult>, unsatisfied: readonly number[] = []): CertificateResult => ({
      direction, accepted: false, witness, cover: null, assignment: null, k, unsatisfied, ...partial,
    });
    const literalsOf = (i: number): { clause: number; position: number }[] => [0, 1, 2].map((position) => ({ clause: i, position }));
    const trianglesOf = (i: number): string[] => TRIANGLE_PAIRS.map(([a, b]) => triangleEdgeId(i, a, b));
    const crossOf = (i: number): string[] => [0, 1, 2].map((position) => crossEdgeId(i, position));
    const cornersOf = (i: number): string[] => [0, 1, 2].map((position) => cornerId(i, position));

    // ------------------------------------------------------------------------------------------
    if (direction === 'to-cover') {
      const all = Object.fromEntries(variables.map((variable) => [variable, valueOf(assignment, variable)]));
      const bad = clauses.flatMap((clause, i) => (clauseIsSatisfied(clause, all) ? [] : [i]));
      t.step({
        lines: ['fwd-signature'],
        say: () => `Turn the assignment ${assignmentText(variables, all)} into a vertex cover S of the graph, which should have exactly k = ${k} vertices.`,
        state,
      });

      for (const variable of variables) {
        const chosen = literalVertexId({ variable, negated: !all[variable] });
        const edge = variableEdgeId(variable);
        cover.push(chosen);
        verified.push(edge);
        t.count('vertices-added');
        t.count('edge-checks');
        highlight = { ...NO_HIGHLIGHT, variables: [variable], nodes: [chosen], edges: [edge] };
        t.event('select', [`node:${chosen}`]);
        t.step({
          lines: ['fwd-vars'],
          say: () => `${variable} is ${truth(all[variable] === true)}, so the vertex ${nodeById.get(chosen)?.label ?? chosen} joins S and covers the edge ${variable} — ¬${variable}.`,
          state,
        });
      }

      for (const [i, clause] of clauses.entries()) {
        const out = firstTrueLiteral(clause, all);
        t.count('clause-checks');
        if (out === null) {
          witness = { kind: 'clause', clause: i };
          highlight = { ...NO_HIGHLIGHT, clauses: [i], literals: literalsOf(i), nodes: cornersOf(i), edges: trianglesOf(i) };
          status[i] = 'unsatisfied';
          t.step({
            lines: ['fwd-find'],
            say: () => `None of the three literals of ${clauseText(i)} = ${formatClause(clause)} is true under this assignment.`,
            state,
          });
          return t.reject({
            lines: ['fwd-fail'],
            say: () => `Clause ${clauseText(i)} is not satisfied, so no corner can be left out: all three would be needed and S would have at least ${k + 1} vertices, more than k = ${k}.`,
            state,
            result: refused({}, bad),
          });
        }
        const literal = clause[out];
        const outId = cornerId(i, out);
        const label = literal ? literalLabel(literal) : '';
        leftOut.push(outId);
        highlight = { ...NO_HIGHLIGHT, clauses: [i], literals: [{ clause: i, position: out }], nodes: [outId] };
        t.event('find', [`clause:${i}`, `node:${outId}`]);
        t.step({
          lines: ['fwd-find'],
          say: () => `The first true literal of ${clauseText(i)} is ${label} at position ${out + 1}, so corner ${out + 1} stays out of S.`,
          state,
        });

        const taken = [0, 1, 2].filter((position) => position !== out).map((position) => cornerId(i, position));
        cover.push(...taken);
        verified.push(...trianglesOf(i), ...crossOf(i));
        t.count('vertices-added', 2);
        t.count('edge-checks', 6);
        highlight = { ...NO_HIGHLIGHT, clauses: [i], nodes: taken, edges: [...trianglesOf(i), ...crossOf(i)] };
        t.event('select', taken.map((id) => `node:${id}`));
        t.step({
          lines: ['fwd-take'],
          say: () => `The other two corners of ${clauseText(i)} join S, which covers its three triangle edges and their cross edges, and the left-out corner's cross edge is covered by the true literal's vertex ${label}.`,
          state,
        });
      }

      highlight = NO_HIGHLIGHT;
      const result: CertificateResult = {
        direction, accepted: true, witness: null, cover: [...cover], assignment: all, k, unsatisfied: [],
      };
      return t.finish({
        lines: ['fwd-return'],
        say: () => `S has ${n} variable vertices and ${2 * m} corners, ${cover.length} in all, which equals k = ${k}, so it is a vertex cover of the required size.`,
        state,
        result,
      });
    }

    // ------------------------------------------------------------------------------------------
    const chosen = new Set(given.filter((id) => nodeById.has(id)));
    for (const node of graph.nodes) if (chosen.has(node.id)) cover.push(node.id);
    const inS = (id: string): boolean => chosen.has(id);
    const nodeLabel = (id: string): string => nodeById.get(id)?.label ?? id;

    t.step({
      lines: ['bwd-signature'],
      say: () => `Turn the vertex set S of ${cover.length} vertices into an assignment, after checking that S covers every edge of the graph and has at most k = ${k} vertices.`,
      state,
    });

    /** Checks the given edges together; refuses at the first one with no endpoint in S. */
    const checkEdges = (ids: readonly string[], describeOk: () => string, describeBad: (edge: VcEdge) => string, extra: Highlight): Finished<CertificateResult> | null => {
      for (const id of ids) {
        const edge = edgeById.get(id);
        if (!edge) continue;
        t.count('edge-checks');
        if (!inS(edge.source) && !inS(edge.target)) {
          witness = { kind: 'edge', edge: edge.id, source: edge.source, target: edge.target };
          highlight = { ...extra, nodes: [edge.source, edge.target], edges: [edge.id] };
          return t.reject({ lines: ['bwd-edge-fail'], say: () => describeBad(edge), state, result: refused({}) });
        }
      }
      verified.push(...ids);
      highlight = { ...extra, edges: [...ids] };
      t.event('select', ids.map((id) => `edge:${id}`));
      t.step({ lines: ['bwd-edges'], say: describeOk, state });
      return null;
    };

    for (const variable of variables) {
      const pos = literalVertexId({ variable, negated: false });
      const neg = literalVertexId({ variable, negated: true });
      const stop = checkEdges(
        [variableEdgeId(variable)],
        () => `The edge ${variable} — ¬${variable} is covered by ${inS(pos) && inS(neg) ? 'both of its endpoints' : inS(pos) ? variable : `¬${variable}`}.`,
        () => `The edge ${variable} — ¬${variable} is not covered, since neither endpoint is in S, so S is not a vertex cover and gives no assignment.`,
        { ...NO_HIGHLIGHT, variables: [variable] },
      );
      if (stop) return stop;
    }

    for (const [i, clause] of clauses.entries()) {
      const inTriangle = [0, 1, 2].filter((position) => inS(cornerId(i, position)));
      const stopTriangle = checkEdges(
        trianglesOf(i),
        () => `The three triangle edges of ${clauseText(i)} are covered, because the corner${inTriangle.length === 1 ? '' : 's'} ${inTriangle.map((p) => p + 1).join(', ')} ${inTriangle.length === 1 ? 'is' : 'are'} in S.`,
        (edge) => `The triangle edge between corners ${(nodeById.get(edge.source)?.position ?? 0) + 1} and ${(nodeById.get(edge.target)?.position ?? 0) + 1} of ${clauseText(i)} is not covered, since neither corner is in S, so S is not a vertex cover.`,
        { ...NO_HIGHLIGHT, clauses: [i] },
      );
      if (stopTriangle) return stopTriangle;

      const stopCross = checkEdges(
        crossOf(i),
        () => `The cross edges of ${clauseText(i)} are covered: ${[0, 1, 2].map((position) => {
          const literal = clause[position];
          const own = inS(cornerId(i, position));
          return `corner ${position + 1} ${own ? 'by itself' : `by the vertex ${literal ? literalLabel(literal) : ''}`}`;
        }).join(', ')}.`,
        (edge) => `The cross edge from corner ${(edgeById.get(edge.id)?.position ?? 0) + 1} of ${clauseText(i)} to the vertex ${nodeLabel(edge.target)} is not covered, since neither end is in S, so S is not a vertex cover.`,
        { ...NO_HIGHLIGHT, clauses: [i] },
      );
      if (stopCross) return stopCross;
    }

    highlight = NO_HIGHLIGHT;
    if (chosen.size > k) {
      witness = { kind: 'size', size: chosen.size, k };
      return t.reject({
        lines: ['bwd-size'],
        say: () => `S has ${chosen.size} vertices, more than k = ${k}, so it covers every edge but is not a cover of size at most k, and the counting argument does not apply.`,
        state,
        result: refused({}),
      });
    }

    t.step({
      lines: ['bwd-count'],
      say: () => `The ${n} variable edges and ${m} triangles share no vertices and need at least ${n} + 2·${m} = ${k} vertices of S, so |S| = ${chosen.size} ≤ k forces exactly one vertex per pair and exactly two per triangle.`,
      state,
    });

    for (const variable of variables) {
      const pos = literalVertexId({ variable, negated: false });
      const value = inS(pos);
      values[variable] = value;
      highlight = { ...NO_HIGHLIGHT, variables: [variable], nodes: [value ? pos : literalVertexId({ variable, negated: true })] };
      t.event('assign', [`var:${variable}`], truth(value));
      t.step({
        lines: ['bwd-vars'],
        say: () => `Exactly one of ${variable} and ¬${variable} is in S, namely ${value ? variable : `¬${variable}`}, so ${variable} is set to ${truth(value)}.`,
        state,
      });
    }

    const final: Record<string, boolean> = {};
    for (const variable of variables) final[variable] = values[variable] === true;
    for (const [i, clause] of clauses.entries()) {
      const outPosition = [0, 1, 2].find((position) => !inS(cornerId(i, position))) ?? 0;
      const literal = clause[outPosition] ?? clause[0];
      const outId = cornerId(i, outPosition);
      leftOut.push(outId);
      status[i] = literalIsTrue(literal, final) ? 'satisfied' : 'unsatisfied';
      t.count('clause-checks');
      highlight = {
        ...NO_HIGHLIGHT, clauses: [i], literals: [{ clause: i, position: outPosition }], nodes: [outId, literalVertexId(literal)],
        edges: [crossEdgeId(i, outPosition)],
      };
      t.event('find', [`clause:${i}`, `node:${outId}`]);
      t.step({
        lines: ['bwd-clauses'],
        say: () => `Clause ${clauseText(i)} has exactly two corners in S, so corner ${outPosition + 1} (${literalLabel(literal)}) is left out and its cross edge forces the vertex ${literalLabel(literal)} into S, which makes ${literalLabel(literal)} true.`,
        state,
      });
    }

    highlight = NO_HIGHLIGHT;
    return t.finish({
      lines: ['bwd-return'],
      say: () => `Every clause has a true literal, so the assignment ${assignmentText(variables, final)} satisfies the formula.`,
      state,
      result: { direction, accepted: true, witness: null, cover: [...cover], assignment: final, k, unsatisfied: [] },
    });
  },
});
