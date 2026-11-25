import { describe, expect, it } from 'vitest';
import { adjacency, compareLabels, createRng, edgeId, forceLayout, formatGraph, graphProblems, growthFn, nodesInOrder, parseBoundedInt, parseGraph, parseIntList, ratios, scaleToLast, GRAPH_HEIGHT, GRAPH_WIDTH } from '.';
import type { Graph } from '.';

const graph = (text: string, directed = false, weighted = false): Graph => {
  const parsed = parseGraph(text, { directed, weighted });
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};

describe('rng', () => {
  it('is reproducible and in range', () => {
    const draw = (seed: number) => { const r = createRng(seed); return Array.from({ length: 50 }, () => r.int(3, 7)); };
    expect(draw(1)).toEqual(draw(1));
    expect(draw(1)).not.toEqual(draw(2));
    expect(new Set(draw(5))).toEqual(new Set([3, 4, 5, 6, 7]));
  });
  it('shuffle copies and keeps the items', () => {
    const items = Object.freeze([1, 2, 3, 4]);
    expect([...createRng(9).shuffle(items)].sort()).toEqual([1, 2, 3, 4]);
    expect(() => createRng(1).pick([])).toThrow();
  });
});

describe('input', () => {
  it('parses lists and explains problems', () => {
    expect(parseIntList(' 5, 3 -8,,-0 ')).toEqual({ ok: true, value: [5, 3, -8, 0] });
    expect(parseIntList('')).toEqual({ ok: true, value: [] });
    expect(parseIntList('', { allowEmpty: false }).ok).toBe(false);
    for (const bad of ['1.5', 'x', '1e3', '1000', 'Infinity']) expect(parseIntList(bad).ok).toBe(false);
    expect(parseIntList('1 2 3', { maxLength: 2 }).ok).toBe(false);
    expect(parseBoundedInt('12', 'k', 0, 10)).toEqual({ ok: false, message: 'k must be between 0 and 10.' });
  });
});

describe('graph', () => {
  it('parses, formats and validates', () => {
    const g = graph('A-B:4, C-B:-2, D', false, true);
    expect(g.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(g.edges.map((e) => e.id)).toEqual(['A-B', 'B-C']);
    expect(graphProblems(g)).toEqual([]);
    expect(formatGraph(g)).toBe('D, A-B:4, C-B:-2');
    expect(graph('').nodes).toEqual([]);
    expect(graph('A').nodes).toHaveLength(1);
  });
  it.each([['A>B', false, false], ['A-B', true, false], ['A-B', false, true], ['A-B:1', false, false], ['A-B B-A', false, false], ['A-', false, false]])(
    'rejects %s with a message', (text, directed, weighted) => {
      expect(parseGraph(text, { directed, weighted })).toMatchObject({ ok: false, message: expect.any(String) as string });
    });
  it('adjacency is ordered by label; undirected edges appear on both sides', () => {
    const g = graph('A-v10, A-v2, A-B, B-B');
    const lists = adjacency(g);
    expect(lists['A']?.map((a) => a.to)).toEqual(['B', 'v2', 'v10']);
    expect(lists['B']?.map((a) => a.to)).toEqual(['A', 'B']);
    expect(adjacency(graph('B>A, A>B', true))['A']?.map((a) => a.edgeId)).toEqual(['A>B']);
    expect(nodesInOrder(graph('C-A, B')).map((n) => n.id)).toEqual(['A', 'B', 'C']);
    expect([compareLabels('v2', 'v10') < 0, compareLabels('A', 'A'), edgeId('B', 'A', false), edgeId('B', 'A', true)]).toEqual([true, 0, 'A-B', 'B>A']);
  });
  it('reports structural problems', () => {
    const bad: Graph = { directed: false, weighted: true, nodes: [{ id: 'A', label: 'A', x: 0, y: NaN }], edges: [{ id: 'A-Z', source: 'A', target: 'Z', weight: null }] };
    expect(graphProblems(bad)).toHaveLength(3);
  });
  it('forceLayout is deterministic, in bounds, and handles tiny graphs', () => {
    const g = graph('A-B, B-C, C-D, D-A, E, F-F');
    expect(forceLayout(g)).toEqual(forceLayout(g));
    for (const n of forceLayout(g).nodes) {
      expect(n.x >= 0 && n.x <= GRAPH_WIDTH && n.y >= 0 && n.y <= GRAPH_HEIGHT).toBe(true);
    }
    expect(forceLayout(graph('')).nodes).toEqual([]);
    expect(graphProblems(forceLayout(graph('A')))).toEqual([]);
  });
});

describe('growth', () => {
  it('scales to the last usable point and reports ratios', () => {
    const points = [1, 2, 4, 8].map((n) => ({ n, value: 3 * n * n }));
    expect(scaleToLast(points, growthFn('n²').f)).toBe(3);
    expect(ratios(points, growthFn('n²').f)).toEqual([3, 3, 3, 3]);
    expect(ratios(points, growthFn('log n').f)[0]).toBeNull();
    expect(scaleToLast([], growthFn('n').f)).toBeNull();
    expect([growthFn('n log n').f(0), growthFn('n log n').f(8), growthFn('log n').f(1)]).toEqual([0, 24, 0]);
  });
});
