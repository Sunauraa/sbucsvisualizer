import { describe, expect, it } from 'vitest';
import { adjacency, createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { dfs } from './dfs';
import type { EdgeClass } from './dfs';
import { inputOf, randomGraph } from './fixtures';
import { refDfs } from './reference';
import type { GraphInput } from './types';

const run = (input: GraphInput) => checkAlgorithm(dfs, input);

describe('graphs-dfs', () => {
  it('describes itself correctly', () => {
    expect(describeProblems(dfs)).toEqual([]);
  });

  it('is valid on every preset, and the presets light every line except loop headers', () => {
    const traces = dfs.presets.map((p) => checkAlgorithm(dfs, p.input));
    expect(unlitAnchors(dfs, traces)).toEqual(['roots', 'visit', 'scan']);
  });

  it('empty graph: two frames, nothing entered', () => {
    const trace = run(inputOf(''));
    expect(trace.frames).toHaveLength(2);
    expect(trace.result.order).toEqual([]);
  });

  it('single vertex: entry 1, exit 2', () => {
    const trace = run(inputOf('A'));
    expect(trace.result.entry).toEqual({ A: 1 });
    expect(trace.result.exit).toEqual({ A: 2 });
  });

  it('self-loop is a back edge (directed and undirected)', () => {
    for (const directed of [true, false]) {
      const trace = run(inputOf(directed ? 'A>A' : 'A-A', { directed }));
      expect(Object.values(trace.result.classes)).toEqual(['back']);
      expect(trace.totals['edge-checks']).toBe(1);
    }
  });

  it('disconnected: restarts cover every component, trees counted', () => {
    const trace = run(inputOf('A-B, C-D, E', { start: 'C' }));
    expect(trace.result.roots).toEqual(['C', 'A', 'E']);
    expect(trace.result.order).toEqual(['C', 'D', 'A', 'B', 'E']);
  });

  it('directed graph having all four kinds of edge classifies each correctly', () => {
    const trace = run(inputOf('A>B, B>C, C>A, A>C, A>D, D>C', { directed: true, start: 'A' }));
    expect(trace.result.classes).toEqual({
      'A>B': 'tree', 'B>C': 'tree', 'C>A': 'back', 'A>C': 'forward', 'A>D': 'tree', 'D>C': 'cross',
    });
    expect(trace.result.entry).toEqual({ A: 1, B: 2, C: 3, D: 6 });
    expect(trace.result.exit).toEqual({ A: 8, B: 5, C: 4, D: 7 });
    // the dash/label data is in the state: the final frame carries every class
    const roles = trace.frames[trace.frames.length - 1]?.state.edgeRoles;
    expect(Object.values(roles ?? {}).sort()).toEqual(['back', 'cross', 'forward', 'tree', 'tree', 'tree']);
  });

  it('undirected graph never reports forward or cross edges, and the edge to the parent is not a back edge', () => {
    const trace = run(inputOf('A-B, B-C, A-C, C-D', { start: 'A' }));
    const classes = Object.values(trace.result.classes);
    expect(classes).not.toContain('forward');
    expect(classes).not.toContain('cross');
    expect(trace.result.classes['A-B']).toBe('tree');
    expect(trace.result.classes['A-C']).toBe('back'); // C reaches the open ancestor A
    // looking back along the tree edge B-A from B is a skip, never a back edge
    const skips = trace.frames.filter((f) => f.lines[0] === 'skip').map((f) => f.explanation);
    expect(skips.some((s) => s.includes('tree edge that led from'))).toBe(true);
    expect(trace.frames.every((f) => f.lines[0] !== 'forward' && f.lines[0] !== 'cross')).toBe(true);
  });

  it('antiparallel edges in a directed graph: the second one is a back edge', () => {
    const trace = run(inputOf('A>B, B>A', { directed: true }));
    expect(trace.result.classes).toEqual({ 'A>B': 'tree', 'B>A': 'back' });
  });

  it('start vertex deleted: a stale start id falls back to the first label', () => {
    const trace = run(inputOf('B-C', { start: 'A' }));
    expect(trace.result.roots).toEqual(['B']);
  });

  it('matches an independent recursive DFS on 200 seeded random graphs (times and edge classes)', () => {
    const rng = createRng(2024);
    for (let round = 0; round < 200; round += 1) {
      const directed = round % 2 === 0;
      const graph = randomGraph(rng, { directed, weighted: false, minVertices: 1, maxVertices: 9, density: rng.next() * 0.5, selfLoops: round % 3 === 0 });
      const start = rng.pick(graph.nodes).id;
      const trace = dfs.run({ graph, start }, { mode: 'counts' });
      const lists = adjacency(graph);
      const ref = refDfs(
        graph,
        [start, ...graph.nodes.map((n) => n.id).sort().filter((id) => id !== start)],
        (id) => [...(lists[id] ?? [])].map((a) => ({ to: a.to, edge: a.edgeId })),
      );
      expect(trace.result.entry, `entry ${round}`).toEqual(ref.entry);
      expect(trace.result.exit, `exit ${round}`).toEqual(ref.exit);
      expect(trace.result.classes, `classes ${round}`).toEqual(ref.classes);
      const kinds = new Set<EdgeClass>(Object.values(trace.result.classes));
      if (!directed) expect(kinds.has('forward') || kinds.has('cross')).toBe(false);
      expect(trace.totals.visits).toBe(graph.nodes.length);
      const arcs = graph.edges.reduce((sum, e) => sum + (directed || e.source === e.target ? 1 : 2), 0);
      expect(trace.totals['edge-checks']).toBe(arcs);
    }
  });

  it('the call stack matches the parent chain in every frame, and entry/exit times only grow', () => {
    const rng = createRng(77);
    for (let round = 0; round < 30; round += 1) {
      const graph = randomGraph(rng, { directed: round % 2 === 0, weighted: false, minVertices: 1, maxVertices: 8 });
      const trace = dfs.run({ graph, start: null });
      for (const frame of trace.frames) {
        const stack = (frame.state.containers[0]?.items ?? []).map((i) => i.text);
        const byLabel = new Map(frame.state.vertices.map((v) => [v.label, v]));
        stack.forEach((label, i) => {
          const parent = byLabel.get(label)?.parent ?? null;
          if (i > 0) expect(byLabel.get(stack[i - 1] ?? '')?.id).toBe(parent);
        });
        const open = frame.state.vertices.filter((v) => v.status === 'discovered').map((v) => v.label);
        expect([...open].sort()).toEqual([...stack].sort());
      }
    }
  });
});
