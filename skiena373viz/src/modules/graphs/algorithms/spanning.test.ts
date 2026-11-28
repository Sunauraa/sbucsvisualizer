import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import type { Algorithm } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { inputOf, randomGraph } from './fixtures';
import { kruskal } from './kruskal';
import { prim } from './prim';
import { refComponents, refMinForestWeight } from './reference';
import type { GraphInput, GraphState } from './types';

const runPrim = (input: GraphInput) => checkAlgorithm(prim, input);
const runKruskal = (input: GraphInput) => checkAlgorithm(kruskal, input);
const weighted = (text: string, start: string | null = null): GraphInput => inputOf(text, { weighted: true, start });
const lastSentence = (trace: { frames: readonly { explanation: string }[] }): string => trace.frames[trace.frames.length - 1]?.explanation ?? '';

type SpanningAlgorithm = Algorithm<GraphInput, GraphState, { readonly weight: number; readonly edges: readonly string[] }>;
const BOTH: readonly (readonly [string, SpanningAlgorithm])[] = [['prim', prim], ['kruskal', kruskal]];

describe.each(BOTH)('graphs-%s: check sentences stay short', (_name, algorithm) => {
  const manyNegative = (edgeCount: number): GraphInput => {
    const labels = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i));
    const pairs = labels.flatMap((a, i) => labels.slice(i + 1).map((b) => `${a}-${b}:-${1 + ((i * 7 + labels.indexOf(b)) % 99)}`));
    return weighted([...labels.slice(0, 1), ...pairs.slice(0, edgeCount)].join(', '));
  };
  it('a 12-vertex graph with 30 negative edges passes validateTrace, and the check names three edges then "and 27 more"', () => {
    const trace = checkAlgorithm(algorithm, manyNegative(30));
    expect(trace.status).toBe('completed');
    const check = trace.frames.find((f) => f.lines.includes('check'));
    expect(check?.explanation.length).toBeLessThanOrEqual(260);
    expect(check?.explanation).toContain('and 27 more');
    expect(trace.frames.every((f) => f.explanation.length <= 260)).toBe(true);
  });
  it('with exactly three negative edges all three are listed and nothing is hidden', () => {
    const check = checkAlgorithm(algorithm, manyNegative(3)).frames.find((f) => f.lines.includes('check'));
    expect(check?.explanation).not.toContain('more');
    expect(check?.explanation.match(/: -\d+/g)).toHaveLength(3);
  });
  it('with four negative edges the fourth is counted as "and 1 more"', () => {
    const check = checkAlgorithm(algorithm, manyNegative(4)).frames.find((f) => f.lines.includes('check'));
    expect(check?.explanation).toContain('and 1 more');
  });
});

describe.each(BOTH)('graphs-%s: shared edge cases', (_name, algorithm) => {
  const run = (input: GraphInput) => checkAlgorithm(algorithm, input);
  it('describes itself correctly', () => {
    expect(describeProblems(algorithm)).toEqual([]);
  });

  it('empty graph: no edges, weight 0', () => {
    const trace = run(weighted(''));
    expect(trace.status).toBe('completed');
    expect(trace.result.weight).toBe(0);
    expect(trace.result.edges).toEqual([]);
  });

  it('single vertex: weight 0 and a (trivial) spanning tree', () => {
    const trace = run(weighted('A'));
    expect(trace.result.weight).toBe(0);
    expect(trace.result.edges).toEqual([]);
  });

  it('self-loop is never taken', () => {
    const trace = run(weighted('A-A:1, A-B:5'));
    expect(trace.result.weight).toBe(5);
    expect(trace.result.edges).toEqual(['A-B']);
  });

  it('directed input is rejected by its own check, with the reason in the last sentence', () => {
    const trace = run(inputOf('A>B:1', { directed: true, weighted: true }));
    expect(trace.status).toBe('rejected');
    expect(lastSentence(trace)).toContain('directed');
    expect(trace.frames[trace.frames.length - 1]?.lines).toEqual(['check']);
  });

  it('unweighted input is rejected by its own check', () => {
    const trace = run(inputOf('A-B'));
    expect(trace.status).toBe('rejected');
    expect(lastSentence(trace)).toContain('no edge weights');
  });

  it('negative weights are accepted and the sentence says why they are fine', () => {
    const trace = run(weighted('A-B:-2, B-C:3, A-C:1, C-D:-1', 'A'));
    expect(trace.status).toBe('completed');
    expect(trace.result.weight).toBe(-2 + 1 + -1);
    expect(trace.frames.some((f) => f.explanation.includes('negative weights') && f.explanation.includes('fine'))).toBe(true);
  });

  it('zero weights are accepted', () => {
    const trace = run(weighted('A-B:0, B-C:0, A-C:0'));
    expect(trace.status).toBe('completed');
    expect(trace.result.weight).toBe(0);
    expect(trace.result.edges).toHaveLength(2);
  });

  it('equal weights: total weight is the same whichever edge wins a tie, and ties are resolved by labels', () => {
    const trace = run(weighted('A-B:1, A-C:1, B-C:1, B-D:2, C-D:2', 'A'));
    expect(trace.result.weight).toBe(1 + 1 + 2);
    expect(trace.result.edges).toHaveLength(3);
    expect(trace.result.edges[0]).toBe('A-B');
  });

  it('start vertex deleted: a stale start id falls back to the first label', () => {
    const trace = run(weighted('B-C:2', 'A'));
    expect(trace.result.weight).toBe(2);
  });
});

describe('graphs-prim', () => {
  it('is valid on every preset, and the presets light every line except loop headers', () => {
    const traces = prim.presets.map((p) => checkAlgorithm(prim, p.input));
    expect(unlitAnchors(prim, traces)).toEqual(['loop', 'scan']);
  });

  it('classic example: edges, weight and a spanning tree', () => {
    const trace = runPrim(prim.presets[0]?.input as GraphInput);
    expect(trace.result).toEqual({ edges: ['A-C', 'B-C', 'B-D', 'D-E', 'E-F'], weight: 13, spanning: true, unreached: [] });
  });

  it('disconnected: reports the unreached vertices and that no spanning tree exists', () => {
    const trace = runPrim(weighted('A-B:3, B-C:1, A-C:2, D-E:4', 'A'));
    expect(trace.result).toMatchObject({ spanning: false, unreached: ['D', 'E'], weight: 3 });
    const sentence = trace.frames.find((f) => f.lines[0] === 'unreached')?.explanation ?? '';
    expect(sentence).toContain('D, E');
    expect(sentence).toContain('no spanning tree');
  });

  it('stale entries are marked: an entry whose vertex is already in the tree, or has a better key, is flagged', () => {
    const trace = runPrim(prim.presets[0]?.input as GraphInput);
    const flagged = trace.frames.flatMap((f) => f.state.containers[0]?.items.filter((i) => i.kind === 'stale') ?? []);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((i) => i.note.includes('stale:'))).toBe(true);
    expect(trace.frames.some((f) => f.lines[0] === 'stale')).toBe(true);
  });

  it('the queue is always shown smallest first, and each pop takes exactly the front entry', () => {
    const rng = createRng(31);
    for (let round = 0; round < 25; round += 1) {
      const graph = randomGraph(rng, { directed: false, weighted: true, minVertices: 2, maxVertices: 8, density: 0.5 });
      const trace = prim.run({ graph, start: null });
      trace.frames.forEach((frame, i) => {
        const keys = (frame.state.containers[0]?.items ?? []).map((item) => Number(item.text.split(' ')[1]));
        expect([...keys].sort((a, b) => a - b)).toEqual(keys);
        const prev = trace.frames[i - 1];
        if (frame.lines[0] === 'pop' && prev) {
          const front = Number((prev.state.containers[0]?.items[0]?.text ?? '').split(' ')[1]);
          expect(frame.ops['queue-comparisons']).toBeGreaterThanOrEqual(prev.ops['queue-comparisons'] as number);
          expect(frame.state.facts.find((f) => f.label === 'Just popped')?.value.split(' ')[1]).toBe(String(front));
        }
      });
    }
  });

  it('keys and the tree weight behave: keys never increase, the weight is the sum of tree edge weights', () => {
    const rng = createRng(4);
    for (let round = 0; round < 30; round += 1) {
      const graph = randomGraph(rng, { directed: false, weighted: true, minVertices: 1, maxVertices: 8, density: 0.5 });
      const trace = prim.run({ graph, start: null });
      let previous: Record<string, number | null> = {};
      for (const frame of trace.frames) {
        for (const v of frame.state.vertices) {
          const was = previous[v.id];
          if (was !== undefined && was !== null) expect(v.dist === null ? Infinity : v.dist).toBeLessThanOrEqual(was);
        }
        previous = Object.fromEntries(frame.state.vertices.map((v) => [v.id, v.dist]));
      }
      const byId = new Map(graph.edges.map((e) => [e.id, e.weight ?? 0]));
      expect(trace.result.edges.reduce((s, id) => s + (byId.get(id) ?? 0), 0)).toBe(trace.result.weight);
    }
  });

  it('edge checks are the sum of the degrees of the vertices reached, relaxations never exceed edge checks', () => {
    const trace = runPrim(prim.presets[0]?.input as GraphInput);
    expect(trace.totals['edge-checks']).toBe(2 * 9);
    expect(trace.totals['relaxations']).toBeLessThanOrEqual(trace.totals['edge-checks'] as number);
    expect(trace.totals['queue-comparisons']).toBeGreaterThan(0);
  });
});

describe('graphs-kruskal', () => {
  it('is valid on every preset, and the presets light every line except the loop header', () => {
    const traces = kruskal.presets.map((p) => checkAlgorithm(kruskal, p.input));
    expect(unlitAnchors(kruskal, traces)).toEqual(['loop']);
  });

  it('classic example: edges in the order kept, weight 13', () => {
    const trace = runKruskal(kruskal.presets[0]?.input as GraphInput);
    expect(trace.result).toEqual({ edges: ['B-C', 'A-C', 'D-E', 'E-F', 'B-D'], weight: 13, components: 1, spanning: true });
  });

  it('disconnected: returns a forest and says so', () => {
    const trace = runKruskal(weighted('A-B:3, B-C:1, A-C:2, D-E:4'));
    expect(trace.result).toMatchObject({ components: 2, spanning: false, weight: 7 });
    expect(trace.result.edges).toHaveLength(3);
    expect(lastSentence(trace)).toContain('forest');
    expect(lastSentence(trace)).toContain('no spanning tree');
  });

  it('stops early once V - 1 edges are kept, and says how many edges it skipped', () => {
    const trace = runKruskal(weighted('A-B:1, B-C:1, A-C:5, C-D:2, A-D:9'));
    const stop = trace.frames.find((f) => f.lines[0] === 'stop');
    expect(stop?.explanation).toContain('remaining 2 edges');
    expect(trace.totals['finds']).toBe(2 * 3);
  });

  it('keeps the union-find forest visible: parent and size per vertex, component label on every vertex', () => {
    const trace = runKruskal(weighted('A-B:1, B-C:2, D-E:3'));
    const last = trace.frames[trace.frames.length - 1]?.state;
    const roots = Object.fromEntries((last?.vertices ?? []).map((v) => [v.label, v.root]));
    expect(roots).toEqual({ A: 'A', B: 'A', C: 'A', D: 'D', E: 'D' });
    const sizes = Object.fromEntries((last?.vertices ?? []).map((v) => [v.label, v.size]));
    expect(sizes['A']).toBe(3);
    expect(sizes['D']).toBe(2);
  });

  it('rejected edges are explained as closing a cycle', () => {
    const trace = runKruskal(weighted('A-B:1, B-C:2, A-C:3, C-D:4'));
    const rejected = trace.frames.find((f) => f.lines[0] === 'cycle');
    expect(rejected?.explanation).toContain('close a cycle');
    expect(Object.values(trace.frames[trace.frames.length - 1]?.state.edgeRoles ?? {})).toContain('rejected');
  });

  it('sorting counts comparisons: n-1 for a presorted list at least, never more than n log2 n', () => {
    const trace = runKruskal(weighted('A-B:1, B-C:2, C-D:3, D-E:4, E-F:5'));
    expect(trace.totals['comparisons']).toBeGreaterThanOrEqual(4);
    expect(trace.totals['comparisons']).toBeLessThanOrEqual(Math.ceil(5 * Math.log2(5)));
  });
});

describe('Prim and Kruskal against brute force and each other', () => {
  it('both equal a brute-force minimum spanning forest on 200 seeded random graphs with V <= 5', () => {
    const rng = createRng(555);
    for (let round = 0; round < 200; round += 1) {
      const graph = randomGraph(rng, { directed: false, weighted: true, minVertices: 1, maxVertices: 5, density: 0.2 + rng.next() * 0.7, selfLoops: round % 4 === 0, minWeight: -3, maxWeight: 4 });
      const brute = refMinForestWeight(graph);
      const k = kruskal.run({ graph, start: null }, { mode: 'counts' });
      expect(k.result.weight, `kruskal ${round}`).toBe(brute);
      const comps = new Set(Object.values(refComponents(graph))).size;
      expect(k.result.components).toBe(comps);
      const p = prim.run({ graph, start: null }, { mode: 'counts' });
      if (comps === 1) {
        expect(p.result.weight, `prim ${round}`).toBe(brute);
        expect(p.result.spanning).toBe(true);
      } else {
        expect(p.result.spanning).toBe(false);
        expect(p.result.unreached.length).toBeGreaterThan(0);
      }
    }
  });

  it('total weights agree on 200 seeded random graphs of up to 10 vertices, with many equal weights', () => {
    const rng = createRng(99);
    let compared = 0;
    for (let round = 0; round < 200; round += 1) {
      const graph = randomGraph(rng, { directed: false, weighted: true, minVertices: 2, maxVertices: 10, density: 0.4 + rng.next() * 0.5, minWeight: 1, maxWeight: 3 });
      const k = kruskal.run({ graph, start: null }, { mode: 'counts' });
      const p = prim.run({ graph, start: null }, { mode: 'counts' });
      if (k.result.spanning) {
        compared += 1;
        expect(p.result.weight, `round ${round}`).toBe(k.result.weight);
        expect(p.result.edges).toHaveLength(graph.nodes.length - 1);
        expect(k.result.edges).toHaveLength(graph.nodes.length - 1);
      }
    }
    expect(compared).toBeGreaterThan(100);
  });
});
