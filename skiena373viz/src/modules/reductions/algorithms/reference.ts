/**
 * Independent references for the tests: a second, deliberately plain construction of the graph, a
 * branching minimum vertex cover, and formula generators. Nothing here is used by the app.
 */
import type { Clause, Formula, Literal } from './formula';
import { formulaVariables } from './formula';
import type { Rng } from '@core';

export interface RefGraph {
  readonly vertices: readonly string[];
  /** Each edge as [u, v]. */
  readonly edges: readonly (readonly [string, string])[];
  readonly k: number;
}

/** The textbook construction, written straight from the definition with the documented vertex names. */
export function referenceGraph(formula: Formula): RefGraph {
  const variables = formulaVariables(formula);
  const vertices: string[] = [];
  const edges: [string, string][] = [];
  for (const v of variables) {
    vertices.push(v, `!${v}`);
    edges.push([v, `!${v}`]);
  }
  formula.clauses.forEach((clause, i) => {
    const corner = (j: number): string => `c${i + 1}.${j + 1}`;
    vertices.push(corner(0), corner(1), corner(2));
    edges.push([corner(0), corner(1)], [corner(0), corner(2)], [corner(1), corner(2)]);
    clause.forEach((literal, j) => edges.push([corner(j), `${literal.negated ? '!' : ''}${literal.variable}`]));
  });
  return { vertices, edges, k: variables.length + 2 * formula.clauses.length };
}

const isCover = (edges: readonly (readonly [number, number])[], mask: number): boolean =>
  edges.every(([u, v]) => ((mask >> u) & 1) === 1 || ((mask >> v) & 1) === 1);

/** Index form of a reference graph (vertices numbered in order), for bit-mask enumeration. */
export function indexed(graph: RefGraph): { count: number; edges: [number, number][] } {
  const index = new Map(graph.vertices.map((v, i) => [v, i]));
  return { count: graph.vertices.length, edges: graph.edges.map(([u, v]) => [index.get(u) ?? -1, index.get(v) ?? -1]) };
}

/** Size of a smallest vertex cover, by branching on an uncovered edge. Fine up to about 20 vertices. */
export function minimumCoverSize(graph: RefGraph): number {
  const { edges } = indexed(graph);
  const search = (mask: number, size: number, best: number): number => {
    if (size >= best) return best;
    const open = edges.find(([u, v]) => ((mask >> u) & 1) === 0 && ((mask >> v) & 1) === 0);
    if (!open) return size;
    const [u, v] = open;
    const withU = search(mask | (1 << u), size + 1, best);
    return search(mask | (1 << v), size + 1, withU);
  };
  return search(0, 0, graph.vertices.length + 1);
}

/** Every vertex cover with exactly `size` vertices, as vertex-name lists. */
export function coversOfSize(graph: RefGraph, size: number): string[][] {
  const { count, edges } = indexed(graph);
  const found: string[][] = [];
  for (let mask = 0; mask < 2 ** count; mask += 1) {
    let bits = 0;
    for (let rest = mask; rest > 0; rest &= rest - 1) bits += 1;
    if (bits === size && isCover(edges, mask)) found.push(graph.vertices.filter((_v, i) => ((mask >> i) & 1) === 1));
  }
  return found;
}

export const isVertexCover = (graph: RefGraph, cover: readonly string[]): boolean => {
  const chosen = new Set(cover);
  return graph.edges.every(([u, v]) => chosen.has(u) || chosen.has(v));
};

/** All 20 clauses (multisets of three literals) over the given variables. */
export function allClauses(variables: readonly string[]): Clause[] {
  const literals: Literal[] = variables.flatMap((variable) => [{ variable, negated: false }, { variable, negated: true }]);
  const out: Clause[] = [];
  for (let a = 0; a < literals.length; a += 1) {
    for (let b = a; b < literals.length; b += 1) {
      for (let c = b; c < literals.length; c += 1) {
        const [la, lb, lc] = [literals[a], literals[b], literals[c]];
        if (la && lb && lc) out.push([la, lb, lc]);
      }
    }
  }
  return out;
}

/**
 * A seeded formula with at most `maxVariables` variable names and between 0 and `maxClauses` clauses.
 * With `sticky` > 0 each literal after the first repeats the one before it with that probability,
 * which makes clauses like (x | x | x) common and so unsatisfiable formulas common.
 */
export function randomFormula(rng: Rng, maxVariables: number, maxClauses: number, sticky = 0, minClauses = 0): Formula {
  const m = rng.int(minClauses, maxClauses);
  const fresh = (): Literal => ({ variable: `x${rng.int(1, maxVariables)}`, negated: rng.next() < 0.5 });
  const clause = (): Clause => {
    const a = fresh();
    const b = rng.next() < sticky ? a : fresh();
    const c = rng.next() < sticky ? b : fresh();
    return [a, b, c];
  };
  return { clauses: Array.from({ length: m }, clause) };
}
