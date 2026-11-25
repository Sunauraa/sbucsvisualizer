import { describe, expect, it } from 'vitest';
import { createRng, experimentProblems, measureAt, ratios } from '@core';
import { experiments, experimentsFor, growthGraph } from './experiments';

describe('graph growth experiments', () => {
  it.each(experiments.map((e) => [e.id, e] as const))('%s is well formed and seeded', (_id, experiment) => {
    expect(experimentProblems(experiment)).toEqual([]);
    for (const { id } of experiment.cases) {
      expect(measureAt(experiment, id, experiment.sizes[0] ?? 8, 1)).toEqual(measureAt(experiment, id, experiment.sizes[0] ?? 8, 1));
    }
  });

  it('sparse graphs have exactly 2V edges and dense ones every possible edge, and they are connected', () => {
    const rng = createRng(1);
    for (const n of [5, 8, 20]) {
      expect(growthGraph(n, 'sparse', { directed: false, weighted: false }, rng).edges).toHaveLength(2 * n);
      expect(growthGraph(n, 'dense', { directed: false, weighted: false }, rng).edges).toHaveLength((n * (n - 1)) / 2);
    }
    const dag = growthGraph(10, 'sparse', { directed: true, weighted: false, acyclic: true }, rng);
    expect(dag.edges.every((e) => Number(e.source.slice(1)) < Number(e.target.slice(1)))).toBe(true);
  });

  it('BFS edge checks are exactly 4V on sparse graphs and V(V-1) on complete ones: the ratio columns settle', () => {
    const bfs = experiments.find((e) => e.id === 'graphs-bfs-growth');
    expect(bfs).toBeDefined();
    if (!bfs) return;
    const sparse = bfs.sizes.map((n) => ({ n, value: measureAt(bfs, 'sparse', n, 3)['edge-checks'] as number }));
    expect(sparse.map((p) => p.value)).toEqual(sparse.map((p) => 4 * p.n));
    const dense = bfs.sizes.map((n) => ({ n, value: measureAt(bfs, 'dense', n, 3)['edge-checks'] as number }));
    const r = ratios(dense, (n) => n * n).filter((x): x is number => x !== null);
    expect(r[r.length - 1]).toBeGreaterThan(r[0] ?? 0); // value / n² creeps up toward 1 from below: V(V-1) / V²
    expect(r[r.length - 1]).toBeLessThan(1);
    const wrong = ratios(sparse, (n) => n * n).filter((x): x is number => x !== null);
    expect(wrong[wrong.length - 1]).toBeLessThan((wrong[0] ?? 0) / 4); // against n² a sparse measure keeps falling
  });

  it('every view has its experiment', () => {
    for (const id of ['graphs-bfs', 'graphs-dfs', 'graphs-topological-sort', 'graphs-prim', 'graphs-kruskal', 'graphs-dijkstra']) {
      expect(experimentsFor(id)).toHaveLength(1);
    }
  });
});
