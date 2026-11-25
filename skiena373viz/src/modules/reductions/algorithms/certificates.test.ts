import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { certificates } from './certificates';
import type { CertificateInput, CertificateResult, CertificateState } from './certificates';
import { buildReduction } from './construct';
import { formulaFrom, formulaVariables } from './formula';
import type { Assignment, Formula } from './formula';
import { assignmentToCover, coverToAssignment, uncoveredEdges } from './maps';
import { allClauses, coversOfSize, isVertexCover, minimumCoverSize, randomFormula, referenceGraph } from './reference';
import { allAssignments, solve } from './solver';

const f = formulaFrom;
const SAMPLE = f('(x1 | !x2 | x3) & (!x1 | x2 | x2)');

const toCover = (formula: Formula, assignment: Assignment): CertificateInput => ({ formula, direction: 'to-cover', assignment, cover: [] });
const toAssignment = (formula: Formula, cover: readonly string[]): CertificateInput => ({ formula, direction: 'to-assignment', assignment: {}, cover });
const result = (input: CertificateInput): CertificateResult => certificates.run(input, { mode: 'counts' }).result;

/** Independent truth: is the literal true? Written without the module's helpers. */
const truthOf = (assignment: Assignment, variable: string, negated: boolean): boolean => (assignment[variable] === true) !== negated;
const failingClauses = (formula: Formula, assignment: Assignment): number[] =>
  formula.clauses.flatMap((clause, i) => (clause.some((l) => truthOf(assignment, l.variable, l.negated)) ? [] : [i]));

const checkRun = (input: CertificateInput) => checkAlgorithm(certificates, input, {
  invariant: ({ state, ops }, previous) => {
    const s = state;
    const ids = new Set(s.nodes.map((node) => node.id));
    if (s.cover.some((id) => !ids.has(id))) return 'the cover holds an unknown vertex';
    if (new Set(s.cover).size !== s.cover.length) return 'a vertex is in the cover twice';
    if (s.verified.length > (ops['edge-checks'] ?? 0)) return 'more edges verified than checked';
    if (s.direction === 'to-cover' && s.cover.length !== ops['vertices-added']) return 'cover size differs from vertices added';
    if (s.direction === 'to-assignment' && previous && previous.state.cover.join() !== s.cover.join()) return 'the given cover changed';
    if (s.leftOut.some((id) => s.cover.includes(id))) return 'a left-out corner is in the cover';
    return null;
  },
});

describe('description', () => {
  it('is described completely', () => {
    expect(describeProblems(certificates)).toEqual([]);
  });

  it.each(certificates.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the trace contract', (id, input) => {
    const trace = checkRun(input);
    expect(trace.status).toBe(id === 'wrong-assignment' || id === 'uncovered-edge' || id === 'oversized-cover' ? 'rejected' : 'completed');
  });

  it('presets light every line except the clause loop header', () => {
    const traces = certificates.presets.map((p) => certificates.run(p.input));
    expect(unlitAnchors(certificates, traces)).toEqual(['fwd-clause']);
  });
});

describe('assignment to cover', () => {
  it('valid assignment: one true literal per pair, two corners per triangle, size exactly k', () => {
    const trace = checkRun(toCover(SAMPLE, { x1: true, x2: true, x3: false }));
    expect(trace.status).toBe('completed');
    expect(trace.result.cover).toEqual(['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1', 'c2.3']);
    expect(trace.result.cover).toHaveLength(7);
    expect(trace.result.k).toBe(7);
  });

  it('frame sequence: setup, one per variable, then find and take per clause, then return; every edge justified once', () => {
    const trace = checkRun(toCover(SAMPLE, { x1: true, x2: true, x3: false }));
    expect(trace.frames.map((frame) => frame.lines.join('+'))).toEqual([
      'fwd-signature', 'fwd-vars', 'fwd-vars', 'fwd-vars', 'fwd-find', 'fwd-take', 'fwd-find', 'fwd-take', 'fwd-return',
    ]);
    expect(trace.totals).toEqual({ 'edge-checks': 3 + 12, 'clause-checks': 2, 'vertices-added': 7 });
    const last = trace.frames[trace.frames.length - 1]?.state as CertificateState;
    expect([...last.verified].sort()).toEqual(buildReduction(SAMPLE).graph.edges.map((e) => e.id).sort());
  });

  it('leaves out the first corner whose literal is true, and says which', () => {
    const trace = checkRun(toCover(f('(x | x | x)'), { x: true }));
    expect(trace.result.cover).toEqual(['x', 'c1.2', 'c1.3']);
    expect(trace.frames[2]?.explanation).toBe('The first true literal of C1 is x at position 1, so corner 1 stays out of S.');
  });

  it('a variable missing from the assignment counts as false', () => {
    const trace = checkRun(toCover(f('(!x | !x | !x)'), {}));
    expect(trace.status).toBe('completed');
    expect(trace.result.cover?.[0]).toBe('!x');
  });

  it('refuses a wrong assignment at the first unsatisfied clause and names it', () => {
    const trace = checkRun(toCover(SAMPLE, { x1: true, x2: false, x3: false }));
    expect(trace.status).toBe('rejected');
    expect(trace.result.witness).toEqual({ kind: 'clause', clause: 1 });
    expect(trace.result.cover).toBeNull();
    const last = trace.frames[trace.frames.length - 1];
    expect(last?.explanation).toContain('C2');
    expect(last?.explanation).toContain('more than k = 7');
    expect(last?.lines).toEqual(['fwd-fail']);
    expect(last?.state.witness).toEqual({ kind: 'clause', clause: 1 });
    expect(last?.state.clauseStatus).toEqual(['satisfied', 'unsatisfied']);
  });

  it('refuses and reports every unsatisfied clause in the result', () => {
    const formula = f('(x | x | x) & (!x | !x | !x) & (x | x | x)');
    const trace = checkRun(toCover(formula, { x: false }));
    expect(trace.result.unsatisfied).toEqual([0, 2]);
    expect(trace.result.witness).toEqual({ kind: 'clause', clause: 0 });
  });

  it('unsatisfiable (x|x|x) & (!x|!x|!x): every assignment is refused, and its cover attempt exceeds k', () => {
    const formula = f('(x | x | x) & (!x | !x | !x)');
    for (const value of [true, false]) {
      const attempt = assignmentToCover(formula, { x: value });
      expect(attempt.unsatisfied).toHaveLength(1);
      expect(attempt.cover).toHaveLength(attempt.k + 1);
      expect(result(toCover(formula, { x: value })).accepted).toBe(false);
    }
  });

  it('empty formula: the empty cover of size 0', () => {
    const trace = checkRun(toCover({ clauses: [] }, {}));
    expect(trace.result).toMatchObject({ accepted: true, cover: [], k: 0 });
    expect(trace.frames).toHaveLength(2);
  });

  it('a variable called constructor works', () => {
    const formula = f('(constructor | !constructor | y)');
    const trace = checkRun(toCover(formula, { constructor: true, y: false }));
    expect(trace.status).toBe('completed');
    expect(trace.result.cover?.[0]).toBe('constructor');
  });
});

describe('cover to assignment', () => {
  const GOOD = ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1', 'c2.3'];

  it('valid cover of size k: reads the assignment off the variable vertices', () => {
    const trace = checkRun(toAssignment(SAMPLE, GOOD));
    expect(trace.status).toBe('completed');
    expect(trace.result.assignment).toEqual({ x1: true, x2: true, x3: false });
  });

  it('frame sequence: setup, each edge group, counting argument, one frame per variable and per clause, return', () => {
    const trace = checkRun(toAssignment(SAMPLE, GOOD));
    const lines = trace.frames.map((frame) => frame.lines.join('+'));
    expect(lines).toEqual([
      'bwd-signature',
      'bwd-edges', 'bwd-edges', 'bwd-edges', // three variable edges
      'bwd-edges', 'bwd-edges', 'bwd-edges', 'bwd-edges', // triangle and cross edges of clause 1 and 2
      'bwd-count', 'bwd-vars', 'bwd-vars', 'bwd-vars', 'bwd-clauses', 'bwd-clauses', 'bwd-return',
    ]);
    expect(trace.totals).toEqual({ 'edge-checks': 3 + 12, 'clause-checks': 2, 'vertices-added': 0 });
    const reads = trace.frames.filter((frame) => frame.lines.includes('bwd-clauses'));
    expect(reads[0]?.explanation).toContain('corner 1 (x1)');
    expect(reads[1]?.explanation).toContain('corner 2 (x2)');
  });

  it('the answer frames fill the assignment in one variable at a time, and clauses turn satisfied', () => {
    const trace = checkRun(toAssignment(SAMPLE, GOOD));
    const states = trace.frames.map((frame) => frame.state as CertificateState);
    expect(states[0]?.assignment).toEqual({ x1: null, x2: null, x3: null });
    const afterVars = trace.frames.findIndex((frame) => frame.lines.includes('bwd-clauses'));
    expect(states[afterVars - 1]?.assignment).toEqual({ x1: true, x2: true, x3: false });
    expect(states[states.length - 1]?.clauseStatus).toEqual(['satisfied', 'satisfied']);
  });

  it('refuses a cover that misses a triangle edge, naming the edge', () => {
    const trace = checkRun(toAssignment(SAMPLE, ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1']));
    expect(trace.status).toBe('rejected');
    expect(trace.result.witness).toEqual({ kind: 'edge', edge: 'tri:2:2-3', source: 'c2.2', target: 'c2.3' });
    const last = trace.frames[trace.frames.length - 1];
    expect(last?.explanation).toContain('triangle edge between corners 2 and 3 of C2');
    expect(last?.lines).toEqual(['bwd-edge-fail']);
    expect(last?.state.highlight.edges).toEqual(['tri:2:2-3']);
  });

  it('refuses a cover that misses a variable edge', () => {
    const trace = checkRun(toAssignment(f('(x | y | y)'), ['c1.1', 'c1.2', 'y']));
    expect(trace.result.witness).toEqual({ kind: 'edge', edge: 'var:x', source: 'x', target: '!x' });
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('The edge x — ¬x is not covered');
  });

  it('refuses a cover that misses a cross edge', () => {
    // Corner 3 of C1 is out, so its literal vertex y must be in; here it is not.
    const trace = checkRun(toAssignment(f('(x | x | y)'), ['x', '!y', 'c1.1', 'c1.2']));
    expect(trace.result.witness).toEqual({ kind: 'edge', edge: 'cross:1.3', source: 'c1.3', target: 'y' });
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('cross edge from corner 3 of C1');
  });

  it('refuses a vertex cover with more than k vertices: it is a cover, but the counting argument needs |S| <= k', () => {
    const trace = checkRun(toAssignment(SAMPLE, [...GOOD, '!x1']));
    expect(trace.result.witness).toEqual({ kind: 'size', size: 8, k: 7 });
    expect(trace.frames[trace.frames.length - 1]?.lines).toEqual(['bwd-size']);
  });

  it('empty formula: the empty set is a cover of size 0, and ignored or repeated vertices change nothing', () => {
    expect(result(toAssignment({ clauses: [] }, []))).toMatchObject({ accepted: true, assignment: {}, cover: [] });
    expect(result(toAssignment({ clauses: [] }, ['nope', 'nope']))).toMatchObject({ accepted: true, cover: [] });
    expect(result(toAssignment(SAMPLE, [...GOOD, ...GOOD, 'not-a-vertex'])).accepted).toBe(true);
  });

  it('the empty cover is refused at the first edge when there is any edge', () => {
    expect(result(toAssignment(SAMPLE, [])).witness).toMatchObject({ kind: 'edge', edge: 'var:x1' });
  });
});

describe('both maps against brute force', () => {
  const small: Formula[] = (() => {
    const clauses = allClauses(['x1', 'x2']);
    return [{ clauses: [] }, ...clauses.map((c) => ({ clauses: [c] })), ...clauses.flatMap((a) => clauses.map((b) => ({ clauses: [a, b] })))];
  })();
  const rng = createRng(21);
  const seeded: Formula[] = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? randomFormula(rng, rng.int(1, 2), 3, 0.8, 2) : randomFormula(rng, 3, 3)));

  it('every satisfying assignment maps to a valid cover of size exactly k (421 small and 200 seeded formulas)', () => {
    let checked = 0;
    for (const formula of [...small, ...seeded]) {
      const reference = referenceGraph(formula);
      for (const assignment of solve(formula)?.satisfying ?? []) {
        const run = result(toCover(formula, assignment));
        expect(run.accepted).toBe(true);
        const cover = run.cover ?? [];
        expect(isVertexCover(reference, cover), JSON.stringify([formula, assignment])).toBe(true);
        expect(cover).toHaveLength(reference.k);
        expect(new Set(cover).size).toBe(cover.length);
        expect(cover).toEqual(assignmentToCover(formula, assignment).cover);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('every vertex cover of size k maps to a satisfying assignment (421 small and 200 seeded formulas)', () => {
    let covers = 0;
    for (const formula of [...small, ...seeded]) {
      const reference = referenceGraph(formula);
      for (const cover of coversOfSize(reference, reference.k)) {
        const run = result(toAssignment(formula, cover));
        expect(run.accepted, JSON.stringify([formula, cover])).toBe(true);
        const assignment = run.assignment ?? {};
        expect(failingClauses(formula, assignment), JSON.stringify([formula, cover])).toEqual([]);
        const direct = coverToAssignment(formula, buildReduction(formula).graph, cover, reference.k);
        expect(direct).toEqual({ ok: true, assignment });
        covers += 1;
      }
    }
    expect(covers).toBeGreaterThan(1000);
  });

  it('assignment to cover to assignment is the identity', () => {
    for (const formula of [...small, ...seeded]) {
      for (const assignment of solve(formula)?.satisfying ?? []) {
        const cover = result(toCover(formula, assignment)).cover ?? [];
        const back = result(toAssignment(formula, cover)).assignment;
        expect(back, JSON.stringify([formula, assignment])).toEqual(assignment);
      }
    }
  });

  it('no cover of size less than k exists, so a smaller set is always refused with an uncovered edge', () => {
    const rng2 = createRng(22);
    for (const formula of seeded.slice(0, 60)) {
      const reference = referenceGraph(formula);
      expect(minimumCoverSize(reference)).toBeGreaterThanOrEqual(reference.k);
      const vertices = reference.vertices;
      for (let trial = 0; trial < 10; trial += 1) {
        const smaller = rng2.shuffle(vertices).slice(0, Math.max(0, reference.k - 1 - rng2.int(0, 1)));
        if (reference.k === 0) continue;
        expect(isVertexCover(reference, smaller)).toBe(false);
        expect(result(toAssignment(formula, smaller)).witness?.kind).toBe('edge');
      }
    }
  });

  it('a wrong assignment is refused at the first unsatisfied clause, with all of them listed (every assignment, small and seeded)', () => {
    for (const formula of [...small.slice(0, 100), ...seeded]) {
      for (const assignment of allAssignments(formulaVariables(formula))) {
        const failing = failingClauses(formula, assignment);
        const run = result(toCover(formula, assignment));
        expect(run.accepted).toBe(failing.length === 0);
        expect(run.unsatisfied).toEqual(failing);
        if (failing.length > 0) expect(run.witness).toEqual({ kind: 'clause', clause: failing[0] });
        // The attempt (all three corners of each failing clause) has k plus one vertex per failing clause.
        const attempt = assignmentToCover(formula, assignment);
        expect(attempt.cover).toHaveLength(attempt.k + failing.length);
      }
    }
  });

  it('a cover attempt from an assignment cannot be completed with fewer than k + (failing clauses) vertices', () => {
    // Brute force over the corners: fix the variable side to the assignment's true literals.
    for (const formula of seeded.slice(0, 40)) {
      const reference = referenceGraph(formula);
      const variables = formulaVariables(formula);
      const corners = reference.vertices.filter((v) => v.startsWith('c'));
      for (const assignment of allAssignments(variables)) {
        const fixed = variables.map((v) => (assignment[v] ? v : `!${v}`));
        let best = Infinity;
        for (let mask = 0; mask < 2 ** corners.length; mask += 1) {
          const chosen = [...fixed, ...corners.filter((_c, i) => ((mask >> i) & 1) === 1)];
          if (isVertexCover(reference, chosen)) best = Math.min(best, chosen.length);
        }
        expect(best).toBe(reference.k + failingClauses(formula, assignment).length);
      }
    }
  });

  it('a set of vertices is refused with the first uncovered edge, or with its size, or accepted: 3000 seeded subsets', () => {
    const rng3 = createRng(23);
    let refusedEdge = 0;
    let refusedSize = 0;
    let accepted = 0;
    for (let i = 0; i < 3000; i += 1) {
      const formula = seeded[i % seeded.length] ?? { clauses: [] };
      const reference = referenceGraph(formula);
      const chosen = reference.vertices.filter(() => rng3.next() < 0.7);
      const run = result(toAssignment(formula, chosen));
      const open = reference.edges.find(([u, v]) => !chosen.includes(u) && !chosen.includes(v));
      if (open) {
        refusedEdge += 1;
        expect(run.witness).toMatchObject({ kind: 'edge' });
        const w = run.witness;
        expect(w?.kind === 'edge' && [w.source, w.target].sort()).toEqual([...open].sort());
      } else if (chosen.length > reference.k) {
        refusedSize += 1;
        expect(run.witness).toEqual({ kind: 'size', size: chosen.length, k: reference.k });
      } else {
        accepted += 1;
        expect(failingClauses(formula, run.assignment ?? {})).toEqual([]);
      }
      expect(uncoveredEdges(buildReduction(formula).graph, chosen).length > 0).toBe(open !== undefined);
    }
    expect(refusedEdge).toBeGreaterThan(100);
    expect(refusedSize).toBeGreaterThan(100);
    expect(accepted).toBeGreaterThan(5);
  });
});

describe('traces on seeded formulas keep the contract', () => {
  it('forward and backward, accepted and refused', () => {
    const rng = createRng(24);
    for (let i = 0; i < 25; i += 1) {
      const formula = randomFormula(rng, 4, 4, 0.3);
      const variables = formulaVariables(formula);
      const assignment = Object.fromEntries(variables.map((v) => [v, rng.next() < 0.5]));
      const forward = checkRun(toCover(formula, assignment));
      const reference = referenceGraph(formula);
      const cover = reference.vertices.filter(() => rng.next() < 0.75);
      checkRun(toAssignment(formula, cover));
      if (forward.status === 'completed') checkRun(toAssignment(formula, forward.result.cover ?? []));
    }
  });
});
