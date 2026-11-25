/** Measured counts against theory. Pure; the plot itself is GrowthPlot / GrowthPanel in @ui. */
import type { OpCounts, OpDef } from './ops';
import type { Algorithm } from './trace';
import { createRng } from './rng';
import type { Rng } from './rng';

export type GrowthFnId = '1' | 'log n' | 'n' | 'n log n' | 'n²' | 'n³' | '2^n';

export interface GrowthFn {
  readonly id: GrowthFnId;
  readonly f: (n: number) => number;
}

/** In dominance order. log is base 2; log n and n log n are 0 at n <= 1. */
export const GROWTH_FNS: readonly GrowthFn[] = [
  { id: '1', f: () => 1 },
  { id: 'log n', f: (n) => (n <= 1 ? 0 : Math.log2(n)) },
  { id: 'n', f: (n) => n },
  { id: 'n log n', f: (n) => (n <= 1 ? 0 : n * Math.log2(n)) },
  { id: 'n²', f: (n) => n * n },
  { id: 'n³', f: (n) => n * n * n },
  { id: '2^n', f: (n) => 2 ** n },
];

export function growthFn(id: GrowthFnId): GrowthFn {
  const fn = GROWTH_FNS.find((candidate) => candidate.id === id);
  if (!fn) throw new Error(`Unknown growth function ${id}`);
  return fn;
}

export interface Point {
  readonly n: number;
  readonly value: number;
}

/** The constant c that makes c * f(n) pass through the last measured point with f(n) > 0. Null if none. */
export function scaleToLast(points: readonly Point[], f: (n: number) => number): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (point && f(point.n) > 0) return point.value / f(point.n);
  }
  return null;
}

/** measured / f(n) at each size: flat means "this is the right growth rate". Null where f(n) is 0. */
export function ratios(points: readonly Point[], f: (n: number) => number): readonly (number | null)[] {
  return points.map(({ n, value }) => (f(n) > 0 ? value / f(n) : null));
}

export interface GrowthCase {
  /** Stable id: 'worst', 'random', 'sorted'. */
  readonly id: string;
  /** 'Worst case: target missing'. */
  readonly label: string;
  /** What theory claims for this case, e.g. { symbol: 'Θ', fn: 'n log n' }. */
  readonly claim: { readonly symbol: 'O' | 'Θ' | 'Ω'; readonly fn: GrowthFnId; readonly when: string };
}

/** A measurable algorithm. Modules export these; GrowthPanel and the analysis module plot them. */
export interface GrowthExperiment {
  /** Stable kebab-case id, unique across the app. */
  readonly id: string;
  readonly title: string;
  /** 'number of keys', 'length of each string'. */
  readonly sizeMeaning: string;
  readonly ops: readonly OpDef[];
  /** The op plotted first. */
  readonly primaryOp: string;
  readonly cases: readonly GrowthCase[];
  /** Increasing. Keep a whole sweep under about 200 ms in total. */
  readonly sizes: readonly number[];
  measure(n: number, caseId: string, rng: Rng): OpCounts;
}

/** Builds an experiment on top of an Algorithm, running it in 'counts' mode. */
export function experimentFor<I, S, R>(
  algorithm: Algorithm<I, S, R>,
  spec: Omit<GrowthExperiment, 'ops' | 'measure'> & { readonly makeInput: (n: number, caseId: string, rng: Rng) => I },
): GrowthExperiment {
  const { makeInput, ...rest } = spec;
  return {
    ...rest,
    ops: algorithm.ops,
    measure: (n, caseId, rng) => algorithm.run(makeInput(n, caseId, rng), { mode: 'counts' }).totals,
  };
}

/** One size of a sweep. Each size gets its own generator, so results do not depend on order. */
export function measureAt(experiment: GrowthExperiment, caseId: string, n: number, seed: number): OpCounts {
  return experiment.measure(n, caseId, createRng(seed * 1_000_003 + n));
}

/** Contract checks for tests. */
export function experimentProblems(experiment: GrowthExperiment): string[] {
  const problems: string[] = [];
  const ids = experiment.cases.map((c) => c.id);
  if (ids.length === 0 || new Set(ids).size !== ids.length) problems.push('cases must be non-empty with unique ids');
  if (experiment.sizes.length < 4) problems.push('at least 4 sizes are needed to see a trend');
  if (experiment.sizes.some((n, i) => i > 0 && n <= (experiment.sizes[i - 1] ?? 0))) problems.push('sizes must increase');
  if (!experiment.ops.some((op) => op.id === experiment.primaryOp)) problems.push('primaryOp is not a declared op');
  return problems;
}
