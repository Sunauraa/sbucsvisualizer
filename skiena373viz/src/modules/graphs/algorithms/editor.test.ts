import { describe, expect, it } from 'vitest';
import { createRng, graphProblems, GRAPH_HEIGHT, GRAPH_WIDTH } from '@core';
import { applyEdit, decodePositions, encodePositions, freeSpot, MAX_EDGES, MAX_VERTICES, modelFromText, nextLabel } from './editor';
import type { EditAction } from './editor';
import { inputOf } from './fixtures';
import { decodeModel, encodeModel } from './graphUrl';
import type { GraphInput } from './types';

const EMPTY: GraphInput = { graph: { directed: false, weighted: false, nodes: [], edges: [] }, start: null };
const apply = (input: GraphInput, ...actions: EditAction[]): GraphInput => actions.reduce((state, action) => applyEdit(state, action).input, input);

describe('vertex labels', () => {
  it('assigns A, B, C in order and reuses freed letters before taking new ones', () => {
    expect(nextLabel([])).toBe('A');
    expect(nextLabel(['A', 'B'])).toBe('C');
    expect(nextLabel(['A', 'C'])).toBe('B');
    let state = apply(EMPTY, { type: 'add-vertex' }, { type: 'add-vertex' }, { type: 'add-vertex' });
    expect(state.graph.nodes.map((n) => n.label)).toEqual(['A', 'B', 'C']);
    state = apply(state, { type: 'delete-vertex', id: 'B' }, { type: 'add-vertex' });
    expect(state.graph.nodes.map((n) => n.label)).toEqual(['A', 'C', 'B']);
  });

  it('new vertices never land on an old one when placed automatically', () => {
    let state = EMPTY;
    for (let i = 0; i < MAX_VERTICES; i += 1) state = apply(state, { type: 'add-vertex' });
    const spots = state.graph.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(spots).size).toBe(MAX_VERTICES);
    for (const n of state.graph.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(GRAPH_WIDTH);
      expect(n.y).toBeLessThan(GRAPH_HEIGHT);
    }
    expect(freeSpot([])).toEqual({ x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 });
  });
});

describe('editing', () => {
  it('vertex cap: the 13th vertex is refused with a message', () => {
    let state = EMPTY;
    for (let i = 0; i < MAX_VERTICES; i += 1) state = apply(state, { type: 'add-vertex' });
    const outcome = applyEdit(state, { type: 'add-vertex' });
    expect(outcome.changed).toBe(false);
    expect(outcome.message).toContain('12 vertices');
    expect(outcome.input).toBe(state);
  });

  it('edge cap: the 31st edge is refused with a message', () => {
    let state = EMPTY;
    for (let i = 0; i < 9; i += 1) state = apply(state, { type: 'add-vertex' });
    const labels = state.graph.nodes.map((n) => n.id);
    let added = 0;
    for (let i = 0; i < labels.length && added < MAX_EDGES; i += 1) {
      for (let j = i + 1; j < labels.length && added < MAX_EDGES; j += 1) {
        state = apply(state, { type: 'add-edge', source: labels[i] as string, target: labels[j] as string });
        added += 1;
      }
    }
    expect(state.graph.edges).toHaveLength(MAX_EDGES);
    const outcome = applyEdit(state, { type: 'add-edge', source: 'A', target: 'A' });
    expect(outcome.changed).toBe(false);
    expect(outcome.message).toContain('30 edges');
  });

  it('a duplicate edge is refused, and in an undirected graph B-A duplicates A-B', () => {
    const state = apply(EMPTY, { type: 'add-vertex' }, { type: 'add-vertex' }, { type: 'add-edge', source: 'A', target: 'B' });
    const outcome = applyEdit(state, { type: 'add-edge', source: 'B', target: 'A' });
    expect(outcome.changed).toBe(false);
    expect(outcome.message).toContain('already exists');
    const directed = apply(state, { type: 'set-directed', directed: true });
    expect(applyEdit(directed, { type: 'add-edge', source: 'B', target: 'A' }).changed).toBe(true);
  });

  it('a self-loop is allowed and the message says so', () => {
    const state = apply(EMPTY, { type: 'add-vertex' });
    const outcome = applyEdit(state, { type: 'add-edge', source: 'A', target: 'A' });
    expect(outcome.changed).toBe(true);
    expect(outcome.message).toContain('self-loop');
    expect(graphProblems(outcome.input.graph)).toEqual([]);
  });

  it('deleting a vertex removes its edges, and deleting the start vertex resets the start', () => {
    const state: GraphInput = { ...inputOf('A-B, B-C, C-D'), start: 'B' };
    const outcome = applyEdit(state, { type: 'delete-vertex', id: 'B' });
    expect(outcome.input.graph.edges.map((e) => e.id)).toEqual(['C-D']);
    expect(outcome.input.start).toBeNull();
    expect(outcome.message).toContain('2 edges');
    expect(outcome.message).toContain('start vertex');
    expect(graphProblems(outcome.input.graph)).toEqual([]);
  });

  it('weights: new edges in a weighted graph start at 1, setting a weight validates it, and turning weights off removes them', () => {
    let state = apply(EMPTY, { type: 'add-vertex' }, { type: 'add-vertex' }, { type: 'set-weighted', weighted: true }, { type: 'add-edge', source: 'A', target: 'B' });
    expect(state.graph.edges[0]?.weight).toBe(1);
    expect(applyEdit(state, { type: 'set-weight', id: 'A-B', text: 'x' }).message).toContain('not a whole number');
    expect(applyEdit(state, { type: 'set-weight', id: 'A-B', text: '5000' }).message).toContain('outside');
    state = apply(state, { type: 'set-weight', id: 'A-B', text: ' -7 ' });
    expect(state.graph.edges[0]?.weight).toBe(-7);
    state = apply(state, { type: 'set-weighted', weighted: false });
    expect(state.graph.edges[0]?.weight).toBeNull();
    expect(applyEdit(state, { type: 'set-weight', id: 'A-B', text: '3' }).message).toContain('Weighted');
    expect(graphProblems(state.graph)).toEqual([]);
  });

  it('switching to undirected merges opposite edges and says so; to directed keeps each edge as drawn', () => {
    const directed = inputOf('A>B:3, B>A:5, B>C:1', { directed: true, weighted: true });
    const outcome = applyEdit(directed, { type: 'set-directed', directed: false });
    expect(outcome.input.graph.edges.map((e) => [e.id, e.weight])).toEqual([['A-B', 3], ['B-C', 1]]);
    expect(outcome.message).toContain('1 pair of opposite edges');
    expect(graphProblems(outcome.input.graph)).toEqual([]);
    const back = applyEdit(outcome.input, { type: 'set-directed', directed: true });
    expect(back.input.graph.edges.map((e) => e.id)).toEqual(['A>B', 'B>C']);
    expect(graphProblems(back.input.graph)).toEqual([]);
  });

  it('moving clamps into the canvas, clear empties, auto layout keeps every vertex', () => {
    const state = inputOf('A-B, B-C');
    const moved = apply(state, { type: 'move-vertex', id: 'A', x: -500, y: 9999 });
    expect(moved.graph.nodes.find((n) => n.id === 'A')).toMatchObject({ x: 30, y: GRAPH_HEIGHT - 30 });
    const laid = applyEdit(state, { type: 'layout' });
    expect(laid.input.graph.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']);
    expect(applyEdit(state, { type: 'clear' }).input.graph.nodes).toEqual([]);
  });

  it('random edit sequences never produce a structurally invalid graph', () => {
    const rng = createRng(2);
    for (let round = 0; round < 60; round += 1) {
      let state: GraphInput = EMPTY;
      for (let step = 0; step < 40; step += 1) {
        const ids = state.graph.nodes.map((n) => n.id);
        const edges = state.graph.edges.map((e) => e.id);
        const roll = rng.int(0, 9);
        let action: EditAction;
        if (roll < 3) action = { type: 'add-vertex' };
        else if (roll < 6 && ids.length > 0) action = { type: 'add-edge', source: rng.pick(ids), target: rng.pick(ids) };
        else if (roll === 6 && ids.length > 0) action = { type: 'delete-vertex', id: rng.pick(ids) };
        else if (roll === 7 && edges.length > 0) action = { type: 'delete-edge', id: rng.pick(edges) };
        else if (roll === 8) action = { type: 'set-directed', directed: !state.graph.directed };
        else action = { type: 'set-weighted', weighted: !state.graph.weighted };
        state = applyEdit(state, action).input;
        expect(graphProblems(state.graph), `round ${round} step ${step}`).toEqual([]);
        expect(state.graph.nodes.length).toBeLessThanOrEqual(MAX_VERTICES);
        expect(state.graph.edges.length).toBeLessThanOrEqual(MAX_EDGES);
        expect(state.start === null || ids.concat(state.graph.nodes.map((n) => n.id)).includes(state.start)).toBe(true);
      }
    }
  });
});

describe('text field', () => {
  it('keeps the positions of existing vertices and places new ones on free spots', () => {
    const base: GraphInput = apply(EMPTY, { type: 'add-vertex', x: 100, y: 100 }, { type: 'add-vertex', x: 400, y: 300 });
    const result = modelFromText('A-B, B-C', base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.value.graph.nodes.map((n) => [n.id, n]));
    expect(byId.get('A')).toMatchObject({ x: 100, y: 100 });
    expect(byId.get('B')).toMatchObject({ x: 400, y: 300 });
    const c = byId.get('C');
    expect(Math.min(Math.hypot((c?.x ?? 0) - 100, (c?.y ?? 0) - 100), Math.hypot((c?.x ?? 0) - 400, (c?.y ?? 0) - 300))).toBeGreaterThan(60);
  });

  it('gives messages for malformed text, a duplicate edge, a weight where none is wanted, and over-limit graphs', () => {
    const message = (text: string, base: GraphInput = EMPTY): string => {
      const r = modelFromText(text, base);
      return r.ok ? '' : r.message;
    };
    expect(message('A-B, ??')).toContain('"??" is not a vertex or an edge');
    expect(message('A-B, B-A')).toContain('appears twice');
    expect(message('A-B:4')).toContain('unweighted');
    expect(message('A>B')).toContain('undirected');
    expect(message('A-B', inputOf('', { weighted: true }))).toContain('needs a weight');
    expect(message('A-B:1.5', inputOf('', { weighted: true }))).toContain('whole numbers');
    expect(message(Array.from({ length: 13 }, (_, i) => `V${i + 1}`).join(', '))).toContain('limit is 12');
    expect(message(Array.from({ length: 31 }, (_, i) => `${String.fromCharCode(65 + (i % 8))}-${String.fromCharCode(66 + ((i * 3 + 1) % 8))}x${i}`).join(' '))).not.toBe('');
  });

  it('a vertex missing from the new text disappears, and the start vertex with it', () => {
    const base: GraphInput = { ...inputOf('A-B, B-C'), start: 'C' };
    const result = modelFromText('A-B', base);
    expect(result.ok && result.value.start).toBeNull();
    const keep = modelFromText('A-B, B-C, C-D', base);
    expect(keep.ok && keep.value.start).toBe('C');
  });

  it('empty text is the empty graph', () => {
    const result = modelFromText('  ', inputOf('A-B'));
    expect(result.ok && result.value.graph.nodes).toEqual([]);
  });
});

describe('the URL form', () => {
  it('round-trips the graph, switches, start vertex and positions', () => {
    const input: GraphInput = {
      graph: { ...inputOf('A>B:3, B>C:-2, D', { directed: true, weighted: true }).graph, nodes: [
        { id: 'A', label: 'A', x: 50, y: 60 }, { id: 'B', label: 'B', x: 200, y: 90 }, { id: 'C', label: 'C', x: 310, y: 300 }, { id: 'D', label: 'D', x: 600, y: 350 },
      ] },
      start: 'C',
    };
    const patch = encodeModel(input);
    const params = Object.fromEntries(Object.entries(patch).filter((e): e is [string, string] => e[1] !== null));
    const decoded = decodeModel(params);
    const key = (nodes: readonly { id: string; x: number; y: number }[] | undefined) => [...(nodes ?? [])].map((n) => `${n.id}@${n.x},${n.y}`).sort();
    expect(key(decoded.ok ? decoded.value?.graph.nodes : undefined)).toEqual(key(input.graph.nodes));
    expect(decoded.ok && decoded.value?.graph.edges).toEqual(input.graph.edges);
    expect(decoded.ok && decoded.value?.graph.directed).toBe(true);
    expect(decoded.ok && decoded.value?.graph.weighted).toBe(true);
    expect(decoded.ok && decoded.value?.start).toBe('C');
  });

  it('an empty graph is g="" (present), and no g at all means "use the default"', () => {
    expect(encodeModel(EMPTY).g).toBe('');
    const empty = decodeModel({ g: '' });
    expect(empty.ok && empty.value?.graph.nodes).toEqual([]);
    const none = decodeModel({});
    expect(none.ok && none.value).toBeNull();
  });

  it('a damaged link gives a message, not a crash, and a start that does not exist is dropped', () => {
    const bad = decodeModel({ g: 'A-B,,%%' });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.message).toContain('could not be read');
    const big = decodeModel({ g: Array.from({ length: 14 }, (_, i) => `V${i}`).join(',') });
    expect(!big.ok && big.message).toContain('not allowed');
    const ghost = decodeModel({ g: 'A-B', s: 'Z' });
    expect(ghost.ok && ghost.value?.start).toBeNull();
  });

  it('position strings survive a round trip and ignore garbage', () => {
    const nodes = [{ id: 'A', label: 'A', x: 10.4, y: 20.6 }, { id: 'B2', label: 'B2', x: 700, y: 5 }];
    const decoded = decodePositions(encodePositions(nodes));
    expect(decoded.get('A')).toEqual({ x: 30, y: 30 }); // clamped into the canvas margin
    expect(decoded.get('B2')?.x).toBeLessThanOrEqual(GRAPH_WIDTH);
    expect(decodePositions('junk_A.x.y_').size).toBe(0);
  });
});
