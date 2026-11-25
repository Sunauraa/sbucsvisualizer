import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { inputOf, randomGraph } from './fixtures';
import { refHasCycle, respectsEdges } from './reference';
import { topologicalSort } from './topologicalSort';
import type { GraphInput } from './types';

const run = (input: GraphInput) => checkAlgorithm(topologicalSort, input);

describe('graphs-topological-sort', () => {
  it('describes itself correctly', () => {
    expect(describeProblems(topologicalSort)).toEqual([]);
  });

  it('is valid on every preset, and the presets light every line except loop headers', () => {
    const traces = topologicalSort.presets.map((p) => checkAlgorithm(topologicalSort, p.input));
    expect(unlitAnchors(topologicalSort, traces)).toEqual(['roots', 'visit']);
  });

  it('empty graph: an empty order', () => {
    const trace = run(inputOf('', { directed: true }));
    expect(trace.status).toBe('completed');
    expect(trace.result).toEqual({ order: [], cycle: null });
  });

  it('single vertex', () => {
    expect(run(inputOf('A', { directed: true })).result.order).toEqual(['A']);
  });

  it('self-loop is a cycle of length one and is rejected, naming A → A', () => {
    const trace = run(inputOf('A>A', { directed: true }));
    expect(trace.status).toBe('rejected');
    expect(trace.result.cycle).toEqual(['A', 'A']);
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('A → A');
  });

  it('a directed cycle is rejected and the sentence names a real cycle, here B → D → C → B', () => {
    const input = inputOf('A>B, B>D, D>C, C>B, A>E', { directed: true });
    const trace = run(input);
    expect(trace.status).toBe('rejected');
    const sentence = trace.frames[trace.frames.length - 1]?.explanation ?? '';
    expect(sentence).toContain('B → D → C → B');
    const cycle = trace.result.cycle ?? [];
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    for (let i = 0; i + 1 < cycle.length; i += 1) {
      expect(input.graph.edges.some((e) => e.source === cycle[i] && e.target === cycle[i + 1])).toBe(true);
    }
  });

  it('a two-vertex directed cycle is rejected as A → B → A', () => {
    const trace = run(inputOf('A>B, B>A', { directed: true }));
    expect(trace.status).toBe('rejected');
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('A → B → A');
  });

  it('undirected input is rejected by its own check', () => {
    const trace = run(inputOf('A-B, B-C'));
    expect(trace.status).toBe('rejected');
    expect(trace.frames[trace.frames.length - 1]?.lines).toEqual(['check']);
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('undirected');
  });

  it('disconnected pieces are all ordered', () => {
    const trace = run(inputOf('A>B, C>D, E', { directed: true }));
    expect(trace.result.order).toHaveLength(5);
  });

  it('antiparallel edges between different pairs are fine when no cycle forms', () => {
    const trace = run(inputOf('A>B, A>C, C>B', { directed: true }));
    expect(trace.result.order).toEqual(['A', 'C', 'B']);
  });

  it('the first vertex to finish ends up last, and the order grows from the right', () => {
    const trace = run(inputOf('A>B, B>C', { directed: true }));
    const orders = trace.frames.map((f) => (f.state.containers[2]?.items ?? []).map((i) => i.text));
    expect(orders[orders.length - 1]).toEqual(['A', 'B', 'C']);
    const filled = orders.map((o) => o.filter((x) => x !== ''));
    // while it fills, the filled part is a suffix of the final order
    for (const part of filled) expect(['A', 'B', 'C'].slice(3 - part.length)).toEqual(part);
  });

  it('every order on 200 seeded random graphs respects every edge; rejection happens exactly when a cycle exists', () => {
    const rng = createRng(12);
    let accepted = 0;
    for (let round = 0; round < 200; round += 1) {
      const graph = randomGraph(rng, { directed: true, weighted: false, minVertices: 0, maxVertices: 9, density: rng.next() * 0.3, selfLoops: round % 5 === 0 });
      const trace = topologicalSort.run({ graph, start: null }, { mode: 'counts' });
      const cyclic = refHasCycle(graph);
      expect(trace.status === 'rejected', `round ${round}`).toBe(cyclic);
      if (!cyclic) {
        accepted += 1;
        expect(respectsEdges(graph, trace.result.order ?? [])).toBe(true);
      } else {
        const cycle = trace.result.cycle ?? [];
        for (let i = 0; i + 1 < cycle.length; i += 1) {
          expect(graph.edges.some((e) => e.source === cycle[i] && e.target === cycle[i + 1])).toBe(true);
        }
        expect(cycle[0]).toBe(cycle[cycle.length - 1]);
      }
    }
    expect(accepted).toBeGreaterThan(30);
  });
});
