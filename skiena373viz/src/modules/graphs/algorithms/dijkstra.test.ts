import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { dijkstra } from './dijkstra';
import { inputOf, randomGraph } from './fixtures';
import { refBellmanFord, refFloyd } from './reference';
import type { GraphInput } from './types';

const run = (input: GraphInput) => checkAlgorithm(dijkstra, input);
const wd = (text: string, start: string | null = 'A'): GraphInput => inputOf(text, { directed: true, weighted: true, start });
const lastSentence = (trace: { frames: readonly { explanation: string }[] }): string => trace.frames[trace.frames.length - 1]?.explanation ?? '';

describe('graphs-dijkstra', () => {
  it('describes itself correctly', () => {
    expect(describeProblems(dijkstra)).toEqual([]);
  });

  it('is valid on every preset (including the refused one), and the presets light every line except loop headers', () => {
    const traces = dijkstra.presets.map((p) => checkAlgorithm(dijkstra, p.input));
    expect(unlitAnchors(dijkstra, traces)).toEqual(['loop', 'scan']);
  });

  it('empty graph: nothing to compute', () => {
    const trace = run(wd('', null));
    expect(trace.status).toBe('completed');
    expect(trace.result.order).toEqual([]);
  });

  it('single vertex: distance 0 to itself', () => {
    const trace = run(wd('A'));
    expect(trace.result.dist).toEqual({ A: 0 });
    expect(trace.totals).toEqual({ 'edge-checks': 0, relaxations: 0, 'queue-comparisons': 0 });
  });

  it('self-loop never improves anything', () => {
    const trace = run(wd('A>A:3, A>B:2'));
    expect(trace.result.dist).toEqual({ A: 0, B: 2 });
    expect(trace.totals['relaxations']).toBe(1);
  });

  it('disconnected: unreachable vertices stay null, which the table shows as infinity', () => {
    const trace = run(wd('A>B:2, B>C:2, D>A:1, E'));
    expect(trace.result.dist).toEqual({ A: 0, B: 2, C: 4, D: null, E: null });
    expect(lastSentence(trace)).toContain('D, E stay at ∞');
    const rows = trace.frames[trace.frames.length - 1]?.state.vertices ?? [];
    expect(rows.find((v) => v.label === 'E')?.dist).toBeNull();
  });

  it('a negative edge is refused by its own check, naming the edge and why greedy finality fails', () => {
    const trace = run(wd('A>B:2, B>C:-3, A>C:1'));
    expect(trace.status).toBe('rejected');
    const sentence = lastSentence(trace);
    expect(sentence).toContain('B→C');
    expect(sentence).toContain('-3');
    expect(sentence).toContain('already made final');
    expect(trace.frames[trace.frames.length - 1]?.lines).toEqual(['check']);
    expect(trace.result.negativeEdge).toBe('B>C');
    expect(trace.totals).toEqual({ 'edge-checks': 0, relaxations: 0, 'queue-comparisons': 0 });
  });

  it('a negative undirected edge is refused too', () => {
    expect(run(inputOf('A-B:-1', { weighted: true, start: 'A' })).status).toBe('rejected');
  });

  it('unweighted input is refused by its own check', () => {
    const trace = run(inputOf('A>B', { directed: true, start: 'A' }));
    expect(trace.status).toBe('rejected');
    expect(lastSentence(trace)).toContain('no edge weights');
  });

  it('zero weights are accepted', () => {
    const trace = run(wd('A>B:0, B>C:0, A>C:1'));
    expect(trace.status).toBe('completed');
    expect(trace.result.dist).toEqual({ A: 0, B: 0, C: 0 });
  });

  it('antiparallel edges are separate arcs with their own weights', () => {
    const trace = run(wd('A>B:1, B>A:5'));
    expect(trace.result.dist).toEqual({ A: 0, B: 1 });
    expect(trace.totals['edge-checks']).toBe(2);
  });

  it('start vertex deleted: a stale start id falls back to the first label', () => {
    const trace = run(wd('B>C:2', 'A'));
    expect(trace.result.dist).toEqual({ B: 0, C: 2 });
  });

  it('a better route shows its older queue entry as stale, and the stale entry is thrown away when popped', () => {
    const trace = run(wd('A>B:10, A>C:3, C>B:4, B>D:2, C>D:12'));
    expect(trace.result.dist).toEqual({ A: 0, B: 7, C: 3, D: 9 });
    const stale = trace.frames.flatMap((f) => f.state.containers[0]?.items.filter((i) => i.kind === 'stale') ?? []);
    expect(stale.length).toBeGreaterThan(0);
    expect(trace.frames.filter((f) => f.lines[0] === 'stale')).not.toHaveLength(0);
  });

  it('equals Bellman-Ford and Floyd-Warshall on 200 seeded random graphs (directed and undirected, zero weights, unreachable vertices)', () => {
    const rng = createRng(1959);
    for (let round = 0; round < 200; round += 1) {
      const graph = randomGraph(rng, { directed: round % 2 === 0, weighted: true, minVertices: 1, maxVertices: 9, density: rng.next() * 0.5, selfLoops: round % 3 === 0, minWeight: 0, maxWeight: 9 });
      const start = rng.pick(graph.nodes).id;
      const trace = dijkstra.run({ graph, start }, { mode: 'counts' });
      expect(trace.result.dist, `bf ${round}`).toEqual(refBellmanFord(graph, start));
      expect(trace.result.dist, `fw ${round}`).toEqual(refFloyd(graph, start));
      // the parents form a shortest-path tree
      for (const [id, parent] of Object.entries(trace.result.parent)) {
        if (parent === null) continue;
        const w = Math.min(...graph.edges.filter((e) => (e.source === parent && e.target === id) || (!graph.directed && e.source === id && e.target === parent)).map((e) => e.weight ?? 0));
        expect((trace.result.dist[parent] as number) + w).toBe(trace.result.dist[id]);
      }
    }
  });

  it('vertices become final in nondecreasing distance order, and each frame\'s queue is sorted smallest first', () => {
    const rng = createRng(3);
    for (let round = 0; round < 30; round += 1) {
      const graph = randomGraph(rng, { directed: true, weighted: true, minVertices: 2, maxVertices: 8, density: 0.4, minWeight: 0, maxWeight: 6 });
      const trace = dijkstra.run({ graph, start: null });
      const finals = trace.result.order.map((id) => trace.result.dist[id] as number);
      expect([...finals].sort((a, b) => a - b)).toEqual(finals);
      for (const frame of trace.frames) {
        const keys = (frame.state.containers[0]?.items ?? []).map((i) => Number(i.text.split(' ')[1]));
        expect([...keys].sort((a, b) => a - b)).toEqual(keys);
      }
      expect(trace.totals['relaxations']).toBeLessThanOrEqual(trace.totals['edge-checks'] as number);
    }
  });

  it('counts: edge checks are the out-degrees of the reached vertices; relaxations are successful improvements only', () => {
    const trace = run(wd('A>B:4, A>C:1, C>B:2, B>D:1'));
    expect(trace.totals['edge-checks']).toBe(4);
    expect(trace.totals['relaxations']).toBe(4); // B=4, C=1, B=3, D=4
    expect(trace.result.dist).toEqual({ A: 0, B: 3, C: 1, D: 4 });
  });
});
