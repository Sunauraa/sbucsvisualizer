import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { bfs } from './bfs';
import { inputOf, randomGraph } from './fixtures';
import { refComponents, refHops } from './reference';
import type { GraphInput, GraphState } from './types';

const run = (input: GraphInput) => checkAlgorithm(bfs, input);
const last = <S>(frames: readonly { state: S }[]): S => (frames[frames.length - 1] as { state: S }).state;

describe('graphs-bfs', () => {
  it('describes itself correctly', () => {
    expect(describeProblems(bfs)).toEqual([]);
  });

  it('is valid on every preset, and the presets light every line except loop headers', () => {
    const traces = bfs.presets.map((p) => checkAlgorithm(bfs, p.input));
    expect(unlitAnchors(bfs, traces)).toEqual(['roots', 'loop', 'scan']);
  });

  it('empty graph: two frames, nothing visited', () => {
    const trace = run(inputOf(''));
    expect(trace.frames).toHaveLength(2);
    expect(trace.result).toMatchObject({ order: [], components: 0 });
    expect(trace.totals).toEqual({ visits: 0, 'edge-checks': 0 });
  });

  it('single vertex: one component, level 0, no edge checks', () => {
    const trace = run(inputOf('A'));
    expect(trace.result).toMatchObject({ order: ['A'], components: 1, level: { A: 0 } });
    expect(trace.totals).toEqual({ visits: 1, 'edge-checks': 0 });
  });

  it('self-loop: the loop is looked at once, discovers nothing, and does not disturb levels', () => {
    const trace = run(inputOf('A-A, A-B'));
    expect(trace.result).toMatchObject({ level: { A: 0, B: 1 }, components: 1 });
    expect(trace.totals['edge-checks']).toBe(3); // A: loop, A-B; B: A-B
    const sentences = trace.frames.map((f) => f.explanation);
    expect(sentences.some((s) => s.includes('edge to itself'))).toBe(true);
  });

  it('disconnected: every component is covered and numbered, restarting in label order', () => {
    const trace = run(inputOf('A-B, C-D, D-E, F', { start: 'D' }));
    expect(trace.result.components).toBe(3);
    // start D first, then A, then F (label order of what is left)
    expect(trace.result.component).toEqual({ D: 1, C: 1, E: 1, A: 2, B: 2, F: 3 });
    expect(Object.values(trace.result.level)).not.toContain(null);
    expect(trace.totals.visits).toBe(6);
  });

  it('directed graph: a restart is needed when the start cannot reach everything', () => {
    const trace = run(inputOf('A>B, C>A', { directed: true, start: 'A' }));
    expect(trace.result.components).toBe(2);
    expect(trace.result.level).toEqual({ A: 0, B: 1, C: 0 });
    expect(trace.totals['edge-checks']).toBe(2);
  });

  it('antiparallel edges are two different adjacency entries', () => {
    const trace = run(inputOf('A>B, B>A', { directed: true }));
    expect(trace.totals['edge-checks']).toBe(2);
    expect(trace.result.level).toEqual({ A: 0, B: 1 });
  });

  it('start vertex deleted: a stale start id falls back to the first label instead of failing', () => {
    const trace = run(inputOf('B-C, C-D', { start: 'A' }));
    expect(trace.result.order[0]).toBe('B');
    expect(trace.frames[0]?.explanation).toContain('first label');
  });

  it('BFS levels equal unweighted shortest distances on 200 seeded random graphs', () => {
    const rng = createRng(373);
    for (let round = 0; round < 200; round += 1) {
      const directed = round % 2 === 0;
      const graph = randomGraph(rng, { directed, weighted: false, minVertices: 1, maxVertices: 9, density: rng.next() * 0.5, selfLoops: round % 3 === 0 });
      const start = rng.pick(graph.nodes).id;
      const trace = bfs.run({ graph, start }, { mode: 'counts' });
      const hops = refHops(graph, start);
      for (const [id, h] of Object.entries(hops)) {
        if (h !== null) expect(trace.result.level[id], `${round} ${id}`).toBe(h);
        else expect(trace.result.component[id], `${round} ${id} restarts later`).toBeGreaterThan(1);
      }
      // each vertex is discovered exactly once; edge checks are the sum of adjacency-list lengths
      expect(trace.totals.visits).toBe(graph.nodes.length);
      const arcs = graph.edges.reduce((sum, e) => sum + (graph.directed || e.source === e.target ? 1 : 2), 0);
      expect(trace.totals['edge-checks']).toBe(arcs);
      if (!directed) {
        const comps = new Set(Object.values(refComponents(graph))).size;
        expect(trace.result.components).toBe(comps);
      }
    }
  });

  it('every frame keeps the queue in first-in first-out order with levels differing by at most one', () => {
    const rng = createRng(8);
    for (let round = 0; round < 40; round += 1) {
      const graph = randomGraph(rng, { directed: round % 2 === 0, weighted: false, minVertices: 1, maxVertices: 8 });
      const trace = bfs.run({ graph, start: null });
      const discovery: string[] = [];
      for (const frame of trace.frames) {
        const s: GraphState = frame.state;
        const queue = (s.containers[0]?.items ?? []).map((i) => i.text);
        const levels = queue.map((label) => s.vertices.find((v) => v.label === label)?.level ?? -1);
        expect([...levels].sort((a, b) => a - b)).toEqual(levels);
        expect(levels.length === 0 || (levels[levels.length - 1] as number) - (levels[0] as number) <= 1).toBe(true);
        for (const label of queue) if (!discovery.includes(label)) discovery.push(label);
        const open = s.vertices.filter((v) => v.status === 'discovered').map((v) => v.label);
        const allowed = new Set([...queue, ...(s.focusVertex === null ? [] : [s.focusVertex])]);
        expect(open.every((label) => allowed.has(label))).toBe(true);
      }
      // the order vertices leave the queue is the order they entered it
      expect(trace.result.order.map((id) => id)).toEqual(discovery);
      expect(last(trace.frames).containers[0]?.items).toEqual([]);
    }
  });

  it('counts only when work happens: visits rise on discover frames, edge checks on test frames', () => {
    const trace = run(inputOf('A-B, A-C, B-C', { start: 'A' }));
    trace.frames.forEach((frame, i) => {
      const prev = trace.frames[i - 1];
      if (!prev) return;
      const dv = frame.ops['visits'] as number - (prev.ops['visits'] as number);
      const de = frame.ops['edge-checks'] as number - (prev.ops['edge-checks'] as number);
      if (frame.lines.includes('discover') || frame.lines.includes('start')) expect(dv).toBe(1);
      else expect(dv).toBe(0);
      expect(de).toBe(frame.lines[0] === 'test' ? 1 : 0);
    });
  });
});
