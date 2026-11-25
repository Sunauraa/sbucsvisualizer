import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { buildReduction } from './construct';
import { formulaFrom } from './formula';
import { counterparts, sameSubject } from './mapping';
import { coverToAssignment, reportCover } from './maps';
import type { Subject } from './mapping';
import { randomFormula } from './reference';
import { allAssignments, isSatisfiable, MAX_SOLVER_VARIABLES, solve } from './solver';

const f = formulaFrom;
const F = f('(x1 | !x2 | x3) & (!x1 | x2 | x2)');
const R = buildReduction(F);
const of = (subject: Subject) => counterparts(subject, F.clauses, R.graph.nodes, R.graph.edges);

describe('mapping between the formula and the graph', () => {
  it('a literal is its corner, its literal vertex and the cross edge between them', () => {
    const found = of({ kind: 'literal', clause: 0, position: 1 });
    expect(found.nodes).toEqual(['c1.2', '!x2']);
    expect(found.edges).toEqual(['cross:1.2']);
    expect(found.clauses).toEqual([0]);
    expect(found.variables).toEqual(['x2']);
    expect(found.words).toContain('¬x2 at position 2 of clause C1 is corner 2');
  });

  it('a clause is its triangle: three corners, three triangle edges and three cross edges', () => {
    const found = of({ kind: 'clause', clause: 1 });
    expect(found.nodes).toEqual(['c2.1', 'c2.2', 'c2.3']);
    expect(found.edges).toEqual(['tri:2:1-2', 'tri:2:1-3', 'tri:2:2-3', 'cross:2.1', 'cross:2.2', 'cross:2.3']);
    expect(found.literals).toHaveLength(3);
  });

  it('a variable is its pair and its edge plus every occurrence of either sign', () => {
    const found = of({ kind: 'variable', variable: 'x2' });
    expect(found.nodes).toEqual(['x2', '!x2', 'c1.2', 'c2.2', 'c2.3']);
    expect(found.edges).toEqual(['var:x2', 'cross:1.2', 'cross:2.2', 'cross:2.3']);
    expect(found.clauses).toEqual([0, 1]);
    expect(found.words).toContain('It occurs in 3 literals (clauses C1, C2).');
  });

  it('a literal vertex stands for the occurrences of that exact literal', () => {
    const found = of({ kind: 'vertex', id: 'x2' });
    expect(found.nodes).toEqual(['x2', 'c2.2', 'c2.3']);
    expect(found.literals).toEqual([{ clause: 1, position: 1 }, { clause: 1, position: 2 }]);
    expect(found.words).toContain('2 corners');
  });

  it('a literal vertex that no clause uses says so', () => {
    const g = f('(x | x | y)');
    const built = buildReduction(g);
    const found = counterparts({ kind: 'vertex', id: '!x' }, g.clauses, built.graph.nodes, built.graph.edges);
    expect(found.words).toContain('no corner, because no clause uses this literal');
    expect(found.nodes).toEqual(['!x']);
  });

  it('a corner maps back to its literal, and each kind of edge to its gadget', () => {
    expect(of({ kind: 'vertex', id: 'c2.1' }).literals).toEqual([{ clause: 1, position: 0 }]);
    expect(of({ kind: 'edge', id: 'var:x1' }).variables).toEqual(['x1']);
    expect(of({ kind: 'edge', id: 'tri:1:2-3' }).clauses).toEqual([0]);
    const cross = of({ kind: 'edge', id: 'cross:2.2' });
    expect(cross.literals).toEqual([{ clause: 1, position: 1 }]);
    expect(cross.words).toContain('cross edge ties corner 2 of clause C2 to the vertex x2');
  });

  it('every subject of every formula points only at things that exist (200 seeded formulas)', () => {
    const rng = createRng(31);
    for (let i = 0; i < 200; i += 1) {
      const formula = randomFormula(rng, 4, 5);
      const { graph } = buildReduction(formula);
      const ids = new Set([...graph.nodes.map((v) => v.id), ...graph.edges.map((e) => e.id)]);
      const subjects: Subject[] = [
        ...graph.nodes.map((v): Subject => ({ kind: 'vertex', id: v.id })),
        ...graph.edges.map((e): Subject => ({ kind: 'edge', id: e.id })),
        ...formula.clauses.flatMap((_c, clause): Subject[] => [{ kind: 'clause', clause }, ...[0, 1, 2].map((position): Subject => ({ kind: 'literal', clause, position }))]),
      ];
      for (const subject of subjects) {
        const found = counterparts(subject, formula.clauses, graph.nodes, graph.edges);
        expect(found.words).not.toBe('Nothing is selected.');
        for (const id of [...found.nodes, ...found.edges]) expect(ids.has(id), `${JSON.stringify(subject)} -> ${id}`).toBe(true);
        for (const c of found.clauses) expect(c).toBeLessThan(formula.clauses.length);
      }
    }
  });

  it('an unknown vertex or an out-of-range clause selects nothing instead of crashing', () => {
    expect(of({ kind: 'vertex', id: 'zzz' }).words).toBe('Nothing is selected.');
    expect(of({ kind: 'clause', clause: 9 }).nodes).toEqual([]);
    expect(of({ kind: 'literal', clause: 0, position: 7 }).edges).toEqual([]);
  });

  it('compares subjects by value', () => {
    expect(sameSubject({ kind: 'clause', clause: 1 }, { kind: 'clause', clause: 1 })).toBe(true);
    expect(sameSubject({ kind: 'clause', clause: 1 }, null)).toBe(false);
  });
});

describe('solver', () => {
  it('tries 2^n assignments and reports how many satisfy', () => {
    const report = solve(F);
    expect(report?.tried).toBe(8);
    expect(report?.rows).toHaveLength(8);
    expect(report?.satisfying.length).toBeGreaterThan(0);
  });

  it('empty formula: one (empty) assignment, satisfied', () => {
    expect(solve({ clauses: [] })).toMatchObject({ tried: 1, satisfying: [{}] });
    expect(isSatisfiable({ clauses: [] })).toBe(true);
  });

  it('lists assignments with the first variable as the most significant bit, false before true', () => {
    expect(allAssignments(['a', 'b'])).toEqual([{ a: false, b: false }, { a: false, b: true }, { a: true, b: false }, { a: true, b: true }]);
  });

  it('says it cannot enumerate when 2^n would be too many', () => {
    const big = { clauses: Array.from({ length: MAX_SOLVER_VARIABLES }, (_, i) => f(`(v${i} | v${i} | v${i + 1})`).clauses[0] ?? []) };
    expect(solve(big as never)).toBeNull();
  });

  it('knows the unsatisfiable presets', () => {
    expect(isSatisfiable(f('(x | x | x) & (!x | !x | !x)'))).toBe(false);
  });
});

describe('cover report', () => {
  const graph = R.graph;
  const k = R.k;
  const GOOD = ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1', 'c2.3'];

  it('a valid cover of size k induces its assignment, in words', () => {
    const report = reportCover(F, graph, GOOD, k);
    expect(report.assignment).toEqual({ x1: true, x2: true, x3: false });
    expect(report.uncovered).toEqual([]);
    expect(report.reason).toBe('S covers every edge with 7 ≤ k = 7 vertices, so it holds exactly one vertex of each pair and two of each triangle, and it induces x1 = T, x2 = T, x3 = F.');
  });

  it('an uncovered edge is named and no assignment is induced', () => {
    const report = reportCover(F, graph, ['x1', 'x2', '!x3', 'c1.2', 'c1.3', 'c2.1'], k);
    expect(report.assignment).toBeNull();
    expect(report.uncovered.map((e) => e.id)).toEqual(['tri:2:2-3']);
    expect(report.reason).toBe('The triangle edge of C2 between corners 2 and 3 has no endpoint in S, so S is not a vertex cover and induces no assignment.');
  });

  it('too many vertices: a pair with both ends is ambiguous', () => {
    const report = reportCover(F, graph, [...GOOD, '!x1'], k);
    expect(report.assignment).toBeNull();
    expect(report.bothEnds).toEqual(['x1']);
    expect(report.reason).toContain('8 vertices, more than k = 7, for example x1 and ¬x1 are both in S, so x1 would be both true and false');
  });

  it('too many vertices without a doubled pair is explained too', () => {
    const report = reportCover(F, graph, [...GOOD, 'c1.1'], k);
    expect(report.reason).toContain('some pair or triangle holds more vertices than the counting argument allows');
  });

  it('empty formula, empty cover: the empty assignment', () => {
    const empty = buildReduction({ clauses: [] });
    const report = reportCover({ clauses: [] }, empty.graph, [], 0);
    expect(report.assignment).toEqual({});
    expect(report.reason).toContain('the empty assignment');
  });

  it('agrees with coverToAssignment on 500 seeded subsets', () => {
    const rng = createRng(41);
    for (let i = 0; i < 500; i += 1) {
      const formula = randomFormula(rng, 3, 3, 0.3);
      const built = buildReduction(formula);
      const chosen = built.graph.nodes.map((node) => node.id).filter(() => rng.next() < 0.7);
      const report = reportCover(formula, built.graph, chosen, built.k);
      const mapped = coverToAssignment(formula, built.graph, chosen, built.k);
      expect(report.assignment).toEqual(mapped.ok ? mapped.assignment : null);
    }
  });
});
