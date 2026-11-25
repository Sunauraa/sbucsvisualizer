import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRng, experimentProblems, measureAt } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { buildReduction, threeSatToVertexCover } from './construct';
import type { ConstructState } from './construct';
import { experiments } from './experiments';
import { formulaFrom, formulaVariables } from './formula';
import type { Formula } from './formula';
import { layoutSize } from './gadgets';
import { allClauses, minimumCoverSize, randomFormula, referenceGraph } from './reference';
import { isSatisfiable, solve } from './solver';

const check = (formula: Formula) => checkAlgorithm(threeSatToVertexCover, formula, {
  invariant: ({ state }, previous) => {
    const frame = state;
    if (previous && previous.state.nodes.length > frame.nodes.length) return 'a vertex disappeared';
    if (previous && previous.state.edges.length > frame.edges.length) return 'an edge disappeared';
    const ids = new Set(frame.nodes.map((node) => node.id));
    if (ids.size !== frame.nodes.length) return 'duplicate vertex id';
    if (frame.edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) return 'an edge has a missing endpoint';
    const sum = frame.kTerms.reduce((total, term) => total + term.value, 0);
    return frame.k === null ? (sum === 0 ? null : 'k terms before k') : (sum === frame.k ? null : 'k is not the sum of its terms');
  },
});

const f = formulaFrom;

describe('description', () => {
  it('is described completely', () => {
    expect(describeProblems(threeSatToVertexCover)).toEqual([]);
  });

  it.each(threeSatToVertexCover.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the trace contract', (_id, input) => {
    expect(check(input).status).toBe('completed');
  });

  it('presets light every line except the two loop headers', () => {
    const traces = threeSatToVertexCover.presets.map((p) => threeSatToVertexCover.run(p.input));
    expect(unlitAnchors(threeSatToVertexCover, traces)).toEqual(['var-loop', 'clause-loop']);
  });

  it('presets are what they say they are', () => {
    const by = (id: string) => threeSatToVertexCover.presets.find((p) => p.id === id)?.input ?? { clauses: [] };
    expect(isSatisfiable(by('satisfiable'))).toBe(true);
    expect(solve(by('unique'))?.satisfying).toHaveLength(1);
    expect(isSatisfiable(by('unsatisfiable'))).toBe(false);
    expect(isSatisfiable(by('all-sign-patterns'))).toBe(false);
    expect(by('all-sign-patterns').clauses).toHaveLength(8);
    expect(formulaVariables(by('all-sign-patterns'))).toEqual(['x1', 'x2', 'x3']);
    expect(by('tautological-clause').clauses[0]?.map((l) => `${l.negated}${l.variable}`)).toEqual(['falsex1', 'truex1', 'falsex2']);
    expect(by('single-clause').clauses).toHaveLength(1);
  });
});

describe('edge cases', () => {
  it('empty formula: satisfiable, empty graph, k = 0', () => {
    const trace = check({ clauses: [] });
    expect(trace.status).toBe('completed');
    expect(trace.result).toMatchObject({ n: 0, m: 0, k: 0, vertexCount: 0, edgeCount: 0 });
    expect(trace.result.graph.nodes).toEqual([]);
    expect(trace.frames).toHaveLength(2);
    expect(trace.frames[0]?.explanation).toContain('no clauses');
    expect(isSatisfiable({ clauses: [] })).toBe(true);
    expect(minimumCoverSize(referenceGraph({ clauses: [] }))).toBe(0);
  });

  it('single clause: 3 variables, 9 vertices... 6 + 3, edges 3 + 6, k = 5', () => {
    const trace = check(f('(a | b | c)'));
    expect(trace.result).toMatchObject({ n: 3, m: 1, k: 5, vertexCount: 9, edgeCount: 9 });
  });

  it('repeated literal in a clause: three corners, three cross edges to the same vertex', () => {
    const trace = check(f('(x | x | !y)'));
    expect(trace.result).toMatchObject({ n: 2, m: 1, vertexCount: 7, edgeCount: 8, k: 4 });
    const cross = trace.result.graph.edges.filter((e) => e.kind === 'cross');
    expect(cross.map((e) => e.target)).toEqual(['x', 'x', '!y']);
  });

  it('three times the same literal: one variable, one pair, k = 3', () => {
    const trace = check(f('(x | x | x)'));
    expect(trace.result).toMatchObject({ n: 1, m: 1, vertexCount: 5, edgeCount: 7, k: 3 });
    expect(minimumCoverSize(referenceGraph(f('(x | x | x)')))).toBe(3);
  });

  it('a clause with x and ¬x still gets an ordinary triangle', () => {
    const trace = check(f('(x | !x | y)'));
    const cross = trace.result.graph.edges.filter((e) => e.kind === 'cross');
    expect(cross.map((e) => e.target)).toEqual(['x', '!x', 'y']);
    expect(isSatisfiable(f('(x | !x | y)'))).toBe(true);
  });

  it('unsatisfiable (x|x|x) & (!x|!x|!x): minimum cover is k + 1', () => {
    const formula = f('(x | x | x) & (!x | !x | !x)');
    const trace = check(formula);
    expect(trace.result.k).toBe(5);
    expect(isSatisfiable(formula)).toBe(false);
    expect(minimumCoverSize(referenceGraph(formula))).toBe(6);
  });

  it('a variable that appears with one sign only: its other vertex touches only the variable edge', () => {
    const trace = check(f('(x | x | y) & (x | y | y)'));
    const { edges } = trace.result.graph;
    const touching = edges.filter((e) => e.source === '!x' || e.target === '!x');
    expect(touching.map((e) => e.id)).toEqual(['var:x']);
  });

  it('variables are those that appear, in label order', () => {
    expect(check(f('(x10 | x2 | x1)')).result.variables).toEqual(['x1', 'x2', 'x10']);
  });

  it('a variable named constructor is an ordinary variable', () => {
    const trace = check(f('(constructor | !constructor | toString)'));
    expect(trace.result).toMatchObject({ n: 2, vertexCount: 7, k: 4 });
  });
});

describe('the construction', () => {
  it('has the documented sizes on 100 seeded formulas: 2n+3m vertices, n+6m edges, k = n+2m', () => {
    const rng = createRng(11);
    for (let i = 0; i < 100; i += 1) {
      const formula = randomFormula(rng, 6, 8);
      const { n, m, k, vertexCount, edgeCount, graph } = buildReduction(formula);
      expect(n).toBe(formulaVariables(formula).length);
      expect(m).toBe(formula.clauses.length);
      expect(vertexCount).toBe(2 * n + 3 * m);
      expect(edgeCount).toBe(n + 6 * m);
      expect(k).toBe(n + 2 * m);
      expect(graph.nodes).toHaveLength(vertexCount);
      expect(graph.edges).toHaveLength(edgeCount);
    }
  });

  it('matches an independent construction, vertex for vertex and edge for edge, on 100 seeded formulas', () => {
    const rng = createRng(12);
    for (let i = 0; i < 100; i += 1) {
      const formula = randomFormula(rng, 4, 5);
      const reference = referenceGraph(formula);
      const { graph, k } = buildReduction(formula);
      expect(new Set(graph.nodes.map((v) => v.id))).toEqual(new Set(reference.vertices));
      const asKey = (u: string, v: string): string => [u, v].sort().join('|');
      expect(graph.edges.map((e) => asKey(e.source, e.target)).sort()).toEqual(reference.edges.map(([u, v]) => asKey(u, v)).sort());
      expect(k).toBe(reference.k);
    }
  });

  it('counts: vertices, edges and literals read are exactly 2n+3m, n+6m and 3m', () => {
    const rng = createRng(13);
    for (let i = 0; i < 40; i += 1) {
      const formula = randomFormula(rng, 5, 8);
      const { totals } = threeSatToVertexCover.run(formula, { mode: 'counts' });
      const n = formulaVariables(formula).length;
      const m = formula.clauses.length;
      expect(totals).toEqual({ vertices: 2 * n + 3 * m, edges: n + 6 * m, 'literals-read': 3 * m });
    }
  });

  it('frame sequence: setup, variable gadgets, then per clause a triangle and three cross edges, then k, then return', () => {
    const formula = f('(x1 | !x2 | x3) & (!x1 | x2 | x2) & (x3 | x3 | x3)');
    const trace = check(formula);
    const n = 3;
    const m = 3;
    const lines = trace.frames.map((frame) => frame.lines.join('+'));
    const expected = [
      'signature',
      ...Array<string>(n).fill('var-gadget'),
      ...Array.from({ length: m }, () => ['triangle', 'cross', 'cross', 'cross']).flat(),
      ...Array<string>(n).fill('bound-vars'),
      ...Array<string>(m).fill('bound-clauses'),
      'return',
    ];
    expect(lines).toEqual(expected);
    expect(trace.frames).toHaveLength(2 * n + 5 * m + 2);
  });

  it('every frame: the graph so far has exactly as many vertices and edges as the counters say', () => {
    const trace = check(threeSatToVertexCover.presets[3]?.input ?? { clauses: [] });
    for (const frame of trace.frames) {
      expect(frame.state.nodes).toHaveLength(frame.ops['vertices'] ?? -1);
      expect(frame.state.edges).toHaveLength(frame.ops['edges'] ?? -1);
    }
  });

  it('k is built from its reasons: one per variable edge, two per triangle', () => {
    const trace = check(f('(x1 | x2 | x3) & (!x1 | x2 | x2)'));
    const last = trace.frames[trace.frames.length - 1]?.state as ConstructState;
    expect(last.kTerms.map((term) => term.value)).toEqual([1, 1, 1, 2, 2]);
    expect(last.k).toBe(7);
    const kFrames = trace.frames.filter((frame) => frame.lines.includes('bound-vars') || frame.lines.includes('bound-clauses'));
    expect(kFrames.map((frame) => frame.state.k)).toEqual([1, 2, 3, 5, 7]);
    expect(kFrames[0]?.explanation).toContain('x1 — ¬x1');
  });

  it('every vertex is inside the fixed drawing area, and the area never changes', () => {
    const rng = createRng(14);
    for (let i = 0; i < 40; i += 1) {
      const formula = randomFormula(rng, 5, 8);
      const trace = threeSatToVertexCover.run(formula);
      const size = layoutSize(formulaVariables(formula).length, formula.clauses.length);
      for (const frame of trace.frames) {
        expect({ width: frame.state.width, height: frame.state.height }).toEqual(size);
        for (const node of frame.state.nodes) {
          expect(node.x).toBeGreaterThanOrEqual(20);
          expect(node.x).toBeLessThanOrEqual(size.width - 20);
          expect(node.y).toBeGreaterThanOrEqual(20);
          expect(node.y).toBeLessThanOrEqual(size.height - 20);
        }
      }
    }
  });

  it('no two vertices are drawn closer than a node diameter', () => {
    const rng = createRng(15);
    for (let i = 0; i < 40; i += 1) {
      const { graph } = buildReduction(randomFormula(rng, 5, 8));
      for (const [a, node] of graph.nodes.entries()) {
        for (const other of graph.nodes.slice(a + 1)) expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThan(42);
      }
    }
  });

  it('is deterministic and the same code path for satisfiable and unsatisfiable formulas', () => {
    const source = readFileSync(fileURLToPath(new URL('./construct.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/from '\.\/(solver|maps|certificates|reference)'/);
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'[^']*'|`[^`]*`/g, '');
    expect(code).not.toMatch(/satisf/i);
    // Same shape in, same graph out, whatever the answer: rename the variables of a satisfiable and an unsatisfiable formula alike.
    const sat = buildReduction(f('(x | y | y) & (!x | y | y)'));
    const unsat = buildReduction(f('(x | x | x) & (!x | !x | !x)'));
    expect(sat.graph.nodes.map((v) => v.kind)).toEqual(['literal', 'literal', 'literal', 'literal', 'corner', 'corner', 'corner', 'corner', 'corner', 'corner']);
    expect(unsat.graph.nodes.map((v) => v.kind)).toEqual(['literal', 'literal', 'corner', 'corner', 'corner', 'corner', 'corner', 'corner']);
    expect(sat.k).toBe(6);
    expect(unsat.k).toBe(5);
  });
});

describe('brute-force equivalence: satisfiable iff a vertex cover of size at most k exists', () => {
  const x = ['x1', 'x2'];
  const clauses = allClauses(x);
  it('there are 20 clauses over two variables', () => {
    expect(clauses).toHaveLength(20);
  });

  it('every formula with n <= 2 and m <= 2: all 1 + 20 + 400 of them', () => {
    const formulas: Formula[] = [{ clauses: [] }, ...clauses.map((c) => ({ clauses: [c] })), ...clauses.flatMap((a) => clauses.map((b) => ({ clauses: [a, b] })))];
    expect(formulas).toHaveLength(421);
    for (const formula of formulas) {
      const reference = referenceGraph(formula);
      const smallest = minimumCoverSize(reference);
      expect(smallest, JSON.stringify(formula)).toBeGreaterThanOrEqual(reference.k);
      expect(smallest <= reference.k, JSON.stringify(formula)).toBe(isSatisfiable(formula));
      expect(buildReduction(formula).k).toBe(reference.k);
    }
  });

  it('200 seeded formulas with n <= 3 and m <= 3 (at most 15 vertices)', () => {
    const rng = createRng(16);
    let satisfiable = 0;
    for (let i = 0; i < 200; i += 1) {
      const formula = i % 2 === 0 ? randomFormula(rng, rng.int(1, 2), 3, 0.8, 2) : randomFormula(rng, 3, 3);
      const reference = referenceGraph(formula);
      expect(reference.vertices.length).toBeLessThanOrEqual(15);
      const smallest = minimumCoverSize(reference);
      expect(smallest, JSON.stringify(formula)).toBeGreaterThanOrEqual(reference.k);
      const sat = isSatisfiable(formula);
      expect(smallest <= reference.k, JSON.stringify(formula)).toBe(sat);
      if (sat) satisfiable += 1;
      // The graph the algorithm builds has the same minimum cover size as the reference.
      const built = buildReduction(formula).graph;
      const asRef = { vertices: built.nodes.map((v) => v.id), edges: built.edges.map((e) => [e.source, e.target] as const), k: reference.k };
      expect(minimumCoverSize(asRef)).toBe(smallest);
    }
    // The sample has both kinds, so the equivalence is tested in both directions.
    expect(satisfiable).toBeGreaterThan(40);
    expect(200 - satisfiable).toBeGreaterThan(20);
  });
});

describe('growth experiment', () => {
  it('is valid and linear in the number of clauses', () => {
    const [experiment] = experiments;
    expect(experimentProblems(experiment!)).toEqual([]);
    for (const caseId of ['shared-variables', 'fresh-variables']) {
      const small = measureAt(experiment!, caseId, 16, 1)['edges'] ?? 0;
      const large = measureAt(experiment!, caseId, 128, 1)['edges'] ?? 0;
      expect(large / small).toBeGreaterThan(6);
      expect(large / small).toBeLessThan(10);
    }
  });
});
