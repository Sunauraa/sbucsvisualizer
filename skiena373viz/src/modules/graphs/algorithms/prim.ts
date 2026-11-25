/** Prim's minimum spanning tree with a lazy-deletion priority queue. Grows one tree from the start vertex. */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { buildState, countsText, fmt, makeCtx, makeRows, names, plural, rowOf, startNote, startOf } from './common';
import { ComparisonMeter, newQueue, pqContainer, tiedAtFront } from './pq';
import { presetsFor } from './presets';
import type { EdgeRole, GraphInput, GraphState } from './types';

export interface PrimResult {
  /** Edge ids in the order they joined the tree. */
  readonly edges: readonly string[];
  readonly weight: number;
  /** True when the tree reaches every vertex. */
  readonly spanning: boolean;
  /** Vertices the tree never reached (ids), in label order. */
  readonly unreached: readonly string[];
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'prim(G, s)'],
  ['check', 1, 'check that G is undirected and every edge has a weight'],
  ['init', 1, 'key[v] = ∞ and parent[v] = none for all v; key[s] = 0'],
  ['seed', 1, 'Q = empty min-heap of (key, vertex, via); insert (0, s, none)'],
  ['loop', 1, 'while Q is not empty'],
  ['pop', 2, '(k, u, via) = extract-min(Q)'],
  ['stale', 2, 'if u is already in the tree: skip this entry'],
  ['add', 2, 'add u to the tree, with the edge via-u unless u = s'],
  ['scan', 2, 'for each edge (u, v, w), v in label order'],
  ['relax-test', 3, 'if v is not in the tree and w < key[v]:'],
  ['relax', 4, 'key[v] = w; parent[v] = u; insert (w, v, u) into Q'],
  ['unreached', 1, 'if some vertex is not in the tree: no spanning tree exists'],
  ['return', 1, 'return the tree edges and their total weight'],
]);

const OPS = defineOps([
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for every adjacency-list entry looked at while adding a vertex to the tree; the input check is not counted.' },
  { id: 'relaxations', label: 'Relaxations', counts: 'One each time a key improves (the edge is lighter than the key it replaces), which also inserts a queue entry.' },
  { id: 'queue-comparisons', label: 'Queue comparisons', counts: 'Entry-against-entry comparisons made inside the binary heap by inserts and extract-mins.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const EMPTY: PrimResult = { edges: [], weight: 0, spanning: false, unreached: [] };

export const prim = defineAlgorithm({
  id: 'graphs-prim',
  title: "Prim's algorithm",
  summary: 'Grow one tree from the start vertex, always adding the lightest edge that leaves it.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'with a binary heap and lazy deletion', bound: 'O(E log V)', why: 'at most one entry is inserted per edge direction, so the heap holds O(E) entries and each operation costs O(log E) = O(log V).' },
    { resource: 'space', when: 'worst case', bound: 'O(E)', why: 'with lazy deletion the queue can hold one entry per edge direction.' },
  ],
  presets: presetsFor('prim'),
  execute(input: GraphInput, t: T): Finished<PrimResult> {
    const ctx = makeCtx(input);
    const start = startOf(ctx, input.start);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const heap = newQueue(ctx);
    const meter = new ComparisonMeter(heap);
    const treeEdges: string[] = [];
    let weight = 0;
    let inTree = 0;
    let popped: string | null = null;
    let focusVertex: string | null = null;
    let focusEdge: string | null = null;
    let focusFrom: string | null = null;
    const label = ctx.label;

    const state = (): GraphState => buildState({
      kind: 'prim', ctx, start, rows, roles, focusVertex, focusEdge, focusFrom,
      containers: [pqContainer(ctx, heap, rows, true)],
      facts: [
        { label: 'Tree weight so far', value: fmt(weight) },
        { label: 'In the tree', value: `${inTree} of ${ctx.ids.length}` },
        ...(popped === null ? [] : [{ label: 'Just popped', value: popped }]),
      ],
    });
    const spend = (): void => t.count('queue-comparisons', meter.take());

    t.step({
      lines: ['signature'],
      say: start === null
        ? 'The graph has no vertices, so there is nothing to span.'
        : `Grow a minimum spanning tree over ${countsText(ctx)} from ${startNote(ctx, input.start, start)}.`,
      state,
    });

    // The algorithm's own input check.
    const unweighted = ctx.graph.edges.find((e) => e.weight === null || !Number.isFinite(e.weight));
    if (ctx.directed) {
      return t.reject({ lines: ['check'], say: 'This graph is directed, but a spanning tree is built from undirected edges, so the run stops.', state, result: EMPTY });
    }
    if (!ctx.graph.weighted || unweighted) {
      return t.reject({
        lines: ['check'],
        say: unweighted ? `The edge ${ctx.edgeName(unweighted.id)} has no weight, so there is nothing to minimise and the run stops.` : 'This graph has no edge weights, so there is nothing to minimise and the run stops.',
        state, result: EMPTY,
      });
    }
    const negative = ctx.graph.edges.filter((e) => (e.weight ?? 0) < 0);
    t.step({
      lines: ['check'],
      say: negative.length > 0
        ? `The graph is undirected and weighted, and its negative weights (${negative.map((e) => `${ctx.edgeName(e.id)}: ${fmt(e.weight)}`).join(', ')}) are fine here because Prim only compares single edges and never adds up paths.`
        : 'The graph is undirected and every edge has a weight, so Prim can run.',
      state,
    });

    if (start === null) {
      return t.finish({ lines: ['return'], say: 'There were no vertices, so the minimum spanning tree has no edges and weight 0.', state, result: { edges: [], weight: 0, spanning: true, unreached: [] } });
    }
    const first = rowOf(rows, start);
    first.dist = 0;
    first.status = 'discovered';
    heap.push({ key: 0, vertex: start, via: null, edge: null });
    spend();
    t.event('insert', [`node:${start}`]);
    t.step({
      lines: ['init', 'seed'],
      say: `Set key[${label(start)}] = 0 and every other key to ∞, then insert (0, ${label(start)}) into the queue.`,
      state,
    });

    while (heap.size > 0) {
      const tie = tiedAtFront(heap);
      const entry = heap.pop();
      spend();
      if (entry === undefined) break;
      const u = entry.vertex;
      const row = rowOf(rows, u);
      popped = `${label(u)} ${fmt(entry.key)}${entry.via === null ? '' : ` via ${label(entry.via)}`}`;
      focusVertex = u;
      focusEdge = null;
      focusFrom = null;
      t.event('dequeue', [`node:${u}`], popped);
      t.step({
        lines: ['pop'],
        say: () => `Extract the smallest entry, (${fmt(entry.key)}, ${label(u)}${entry.via === null ? '' : ` via ${label(entry.via)}`})${tie ? ', where equal keys are ordered by vertex label' : ''}.`,
        state,
      });
      if (row.status === 'processed') {
        t.event('reject', [`node:${u}`], 'stale');
        t.step({ lines: ['stale'], say: () => `${label(u)} is already in the tree, so this entry is stale and is thrown away.`, state });
        continue;
      }
      row.status = 'processed';
      inTree += 1;
      weight += entry.key;
      if (entry.edge !== null) {
        treeEdges.push(entry.edge);
        roles[entry.edge] = 'tree';
      }
      t.event('select', [`node:${u}`]);
      t.step({
        lines: ['add'],
        say: () => (entry.via === null || entry.edge === null
          ? `Add ${label(u)} as the first vertex of the tree.`
          : `Add ${label(u)} to the tree with the edge ${ctx.edgeName(entry.edge)} of weight ${fmt(entry.key)}, so the tree weighs ${fmt(weight)}.`),
        state,
      });
      focusVertex = u;
      for (const arc of ctx.adj[u] ?? []) {
        const v = arc.to;
        const target = rowOf(rows, v);
        const w = arc.weight ?? 0;
        focusEdge = arc.edgeId;
        focusFrom = u;
        t.count('edge-checks');
        const better = target.status !== 'processed' && (target.dist === null || w < target.dist);
        t.event('compare', [`edge:${arc.edgeId}`], `${fmt(w)} < ${fmt(target.dist)}?`);
        t.step({
          lines: ['relax-test'],
          say: () => {
            const name = ctx.arcName(u, v);
            if (target.status === 'processed') return `The edge ${name} leads to ${label(v)}, which is already in the tree, so it is skipped.`;
            if (better) return `The edge ${name} has weight ${fmt(w)}, which beats the key ${fmt(target.dist)} of ${label(v)}.`;
            return `The edge ${name} has weight ${fmt(w)}, which does not beat the key ${fmt(target.dist)} of ${label(v)}, so nothing changes.`;
          },
          state,
        });
        if (better) {
          const old = target.dist;
          target.dist = w;
          target.parent = u;
          target.status = 'discovered';
          heap.push({ key: w, vertex: v, via: u, edge: arc.edgeId });
          t.count('relaxations');
          spend();
          t.event('relax', [`node:${v}`], `${fmt(old)} to ${fmt(w)}`);
          t.step({
            lines: ['relax'],
            say: () => `Lower the key of ${label(v)} from ${fmt(old)} to ${fmt(w)}, set its parent to ${label(u)}, and insert (${fmt(w)}, ${label(v)}) into the queue.`,
            state,
          });
        }
      }
      focusEdge = null;
      focusFrom = null;
    }
    focusVertex = null;
    popped = null;
    const unreached = ctx.ids.filter((id) => rowOf(rows, id).status !== 'processed');
    if (unreached.length > 0) {
      t.step({
        lines: ['unreached'],
        say: `The queue is empty, but ${names(ctx, unreached)} ${unreached.length === 1 ? 'was' : 'were'} never reached, so this graph has no spanning tree.`,
        state,
      });
    }
    return t.finish({
      lines: ['return'],
      say: unreached.length > 0
        ? `Return the tree of ${label(start)}'s component: ${plural(treeEdges.length, 'edge')} of total weight ${fmt(weight)}, which is not a spanning tree.`
        : `Return the minimum spanning tree: ${plural(treeEdges.length, 'edge')} of total weight ${fmt(weight)}.`,
      state,
      result: { edges: treeEdges, weight, spanning: unreached.length === 0, unreached },
    });
  },
});
