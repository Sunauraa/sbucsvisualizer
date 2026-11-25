/**
 * From one frame to what is drawn: tones and notes for the formula and the graph. Pure, so that
 * every view draws the same way and tests can read the marks without rendering.
 */
import type { ConstructResult, ConstructState } from './algorithms/construct';
import type { CertificateState } from './algorithms/certificates';
import { literalIsTrue } from './algorithms/formula';
import type { Assignment, Clause, Formula } from './algorithms/formula';
import type { Highlight, VcEdge, VcNode, VcSize } from './algorithms/gadgets';
import { assignmentToCover } from './algorithms/maps';
import type { Mark } from './FormulaPanel';
import type { EdgeMarkSpec, NodeMarkSpec } from './ReductionGraph';

export interface StageData {
  readonly clauses: readonly Clause[];
  readonly variables: readonly string[];
  readonly size: VcSize;
  readonly nodes: readonly VcNode[];
  readonly edges: readonly VcEdge[];
  readonly literalMarks: Readonly<Record<string, Mark>>;
  readonly clauseMarks: Readonly<Record<number, Mark>>;
  readonly variableMarks: Readonly<Record<string, Mark>>;
  readonly nodeMarks: Readonly<Record<string, NodeMarkSpec>>;
  readonly edgeMarks: Readonly<Record<string, EdgeMarkSpec>>;
}

/** The "this step is about" marks, shared by every frame kind. */
function activeMarks(highlight: Highlight): Pick<StageData, 'literalMarks' | 'clauseMarks' | 'variableMarks' | 'nodeMarks' | 'edgeMarks'> {
  const active: Mark = { tone: 'active' };
  return {
    literalMarks: Object.fromEntries(highlight.literals.map((l) => [`${l.clause}.${l.position}`, active])),
    clauseMarks: Object.fromEntries(highlight.clauses.map((clause) => [clause, active])),
    variableMarks: Object.fromEntries(highlight.variables.map((variable) => [variable, active])),
    nodeMarks: Object.fromEntries(highlight.nodes.map((id) => [id, { tone: 'active' as const }])),
    edgeMarks: Object.fromEntries(highlight.edges.map((id) => [id, { tone: 'active' as const }])),
  };
}

export function constructStage(state: ConstructState): StageData {
  return {
    clauses: state.clauses,
    variables: state.variables,
    size: { width: state.width, height: state.height },
    nodes: state.nodes,
    edges: state.edges,
    ...activeMarks(state.highlight),
  };
}

export function certificateStage(state: CertificateState): StageData {
  const base = activeMarks(state.highlight);
  const inCover = new Set(state.cover);
  const witness = state.witness;
  const nodeMarks: Record<string, NodeMarkSpec> = {};
  for (const node of state.nodes) {
    const active = base.nodeMarks[node.id];
    const failing = witness?.kind === 'edge' && (witness.source === node.id || witness.target === node.id);
    const mine = inCover.has(node.id);
    nodeMarks[node.id] = {
      tone: failing ? 'swap' : active ? 'active' : mine ? 'target' : 'idle',
      ...(state.leftOut.includes(node.id) ? { sub: 'left out' } : mine && active ? { sub: 'in S' } : {}),
      state: mine ? 'in the cover' : 'not in the cover',
    };
  }
  const verified = new Set(state.verified);
  const edgeMarks: Record<string, EdgeMarkSpec> = {};
  for (const edge of state.edges) {
    const failing = witness?.kind === 'edge' && witness.edge === edge.id;
    edgeMarks[edge.id] = { tone: failing ? 'swap' : base.edgeMarks[edge.id] ? 'active' : verified.has(edge.id) ? 'done' : 'idle' };
  }

  const literalMarks: Record<string, Mark> = { ...base.literalMarks };
  state.clauses.forEach((clause, i) => {
    clause.forEach((literal, position) => {
      const value = state.assignment[literal.variable];
      if (value === null || value === undefined) return;
      const key = `${i}.${position}`;
      const isTrue = literalIsTrue(literal, { [literal.variable]: value });
      literalMarks[key] = { tone: base.literalMarks[key] ? 'active' : isTrue ? 'done' : 'idle', note: isTrue ? 'true' : 'false' };
    });
  });
  const clauseMarks: Record<number, Mark> = { ...base.clauseMarks };
  state.clauseStatus.forEach((status, i) => {
    if (status === 'unknown') return;
    const failing = witness?.kind === 'clause' && witness.clause === i;
    clauseMarks[i] = {
      tone: failing ? 'swap' : base.clauseMarks[i] ? 'active' : status === 'satisfied' ? 'done' : 'swap',
      note: status === 'satisfied' ? 'satisfied: a literal is true' : 'unsatisfied: no literal is true',
    };
  });
  const variableMarks: Record<string, Mark> = { ...base.variableMarks };
  for (const variable of state.variables) {
    const value = state.assignment[variable];
    if (value !== null && value !== undefined) variableMarks[variable] = { ...(base.variableMarks[variable] ?? {}), note: value ? 'true' : 'false' };
  }

  return {
    clauses: state.clauses, variables: state.variables, size: { width: state.width, height: state.height },
    nodes: state.nodes, edges: state.edges, literalMarks, clauseMarks, variableMarks, nodeMarks, edgeMarks,
  };
}

/**
 * A static picture for one assignment: its true and false literals, which clauses fail, and the cover
 * attempt built from it (true literal of each pair, and in each triangle every corner whose literal
 * vertex is not in the cover but at least two). Failing clauses show all three corners taken.
 */
export function attemptStage(formula: Formula, reduction: ConstructResult, assignment: Assignment): StageData {
  const attempt = assignmentToCover(formula, assignment);
  const inCover = new Set(attempt.cover);
  const failing = new Set(attempt.unsatisfied);
  const nodeMarks: Record<string, NodeMarkSpec> = {};
  for (const node of reduction.graph.nodes) {
    const mine = inCover.has(node.id);
    const overshoot = node.clause !== null && failing.has(node.clause);
    nodeMarks[node.id] = {
      tone: mine ? (overshoot ? 'swap' : 'target') : 'idle',
      ...(node.kind === 'corner' && !mine ? { sub: 'left out' } : {}),
      state: mine ? 'in the cover' : 'not in the cover',
    };
  }
  const literalMarks: Record<string, Mark> = {};
  formula.clauses.forEach((clause, i) => clause.forEach((literal, position) => {
    const isTrue = literalIsTrue(literal, assignment);
    literalMarks[`${i}.${position}`] = { tone: isTrue ? 'done' : 'idle', note: isTrue ? 'true' : 'false' };
  }));
  const clauseMarks: Record<number, Mark> = {};
  formula.clauses.forEach((_clause, i) => {
    clauseMarks[i] = failing.has(i)
      ? { tone: 'swap', note: 'unsatisfied: all 3 corners' }
      : { tone: 'done', note: 'satisfied: 1 corner out' };
  });
  return {
    clauses: formula.clauses, variables: reduction.variables, size: { width: reduction.graph.width, height: reduction.graph.height },
    nodes: reduction.graph.nodes, edges: reduction.graph.edges, literalMarks, clauseMarks, variableMarks: {}, nodeMarks, edgeMarks: {},
  };
}
