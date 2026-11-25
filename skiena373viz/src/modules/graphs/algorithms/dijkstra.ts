/** Dijkstra's single-source shortest paths with a lazy-deletion priority queue. Refuses negative edges by its own check. */
import { compareLabels, defineAlgorithm, defineOps, definePseudocode, distAdd, distLess } from '@core';
import type { AnchorOf, Dist, Finished, OpOf, Recorder } from '@core';
import { buildState, countsText, fmt, makeCtx, makeRows, names, rowOf, startNote, startOf } from './common';
import { ComparisonMeter, newQueue, pqContainer, tiedAtFront } from './pq';
import { presetsFor } from './presets';
import type { EdgeRole, GraphInput, GraphState } from './types';

export interface DijkstraResult {
  /** Shortest distance from the start; null means unreachable (infinity). */
  readonly dist: Readonly<Record<string, Dist>>;
  readonly parent: Readonly<Record<string, string | null>>;
  /** Vertices in the order they became final. */
  readonly order: readonly string[];
  /** The offending edge id when a negative edge made the run stop. */
  readonly negativeEdge: string | null;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'dijkstra(G, s)'],
  ['check', 1, 'check that every edge has a weight and no weight is negative'],
  ['init', 1, 'dist[v] = ∞ and parent[v] = none for all v; dist[s] = 0'],
  ['seed', 1, 'Q = empty min-heap of (dist, vertex); insert (0, s)'],
  ['loop', 1, 'while Q is not empty'],
  ['pop', 2, '(d, u) = extract-min(Q)'],
  ['stale', 2, 'if u is already final: skip this entry'],
  ['finalize', 2, 'mark u final: dist[u] = d will never change'],
  ['scan', 2, 'for each edge (u, v, w), v in label order'],
  ['relax-test', 3, 'if dist[u] + w < dist[v]:'],
  ['relax', 4, 'dist[v] = dist[u] + w; parent[v] = u; insert (dist[v], v) into Q'],
  ['return', 1, 'return dist and parent'],
]);

const OPS = defineOps([
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for every adjacency-list entry looked at after a vertex becomes final; the input check is not counted.' },
  { id: 'relaxations', label: 'Relaxations', counts: 'One each time a distance improves (a strictly shorter route is found), which also inserts a queue entry.' },
  { id: 'queue-comparisons', label: 'Queue comparisons', counts: 'Entry-against-entry comparisons made inside the binary heap by inserts and extract-mins.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const refused = (ids: readonly string[], negativeEdge: string | null): DijkstraResult => ({
  dist: Object.fromEntries(ids.map((id) => [id, null])),
  parent: Object.fromEntries(ids.map((id) => [id, null])),
  order: [],
  negativeEdge,
});

export const dijkstra = defineAlgorithm({
  id: 'graphs-dijkstra',
  title: "Dijkstra's algorithm",
  summary: 'Finalize vertices in order of distance from the start, relaxing the edges of each one as it is finalized.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'with a binary heap and lazy deletion', bound: 'O((V + E) log V)', why: 'each vertex is finalized once, each edge direction is scanned once, and every queue operation costs O(log V).' },
    { resource: 'space', when: 'worst case', bound: 'O(E)', why: 'with lazy deletion the queue can hold one entry per successful relaxation, up to one per edge direction.' },
  ],
  presets: presetsFor('dijkstra'),
  execute(input: GraphInput, t: T): Finished<DijkstraResult> {
    const ctx = makeCtx(input);
    const start = startOf(ctx, input.start);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const heap = newQueue(ctx);
    const meter = new ComparisonMeter(heap);
    const order: string[] = [];
    let popped: string | null = null;
    let focusVertex: string | null = null;
    let focusEdge: string | null = null;
    let focusFrom: string | null = null;
    const label = ctx.label;

    const state = (): GraphState => buildState({
      kind: 'dijkstra', ctx, start, rows, roles, focusVertex, focusEdge, focusFrom,
      containers: [pqContainer(ctx, heap, rows, false)],
      facts: [
        { label: 'Final', value: `${order.length} of ${ctx.ids.length}` },
        ...(popped === null ? [] : [{ label: 'Just popped', value: popped }]),
      ],
    });
    const spend = (): void => t.count('queue-comparisons', meter.take());

    t.step({
      lines: ['signature'],
      say: start === null
        ? 'The graph has no vertices, so there are no distances to find.'
        : `Find shortest distances over ${countsText(ctx)} from ${startNote(ctx, input.start, start)}.`,
      state,
    });

    // The algorithm's own input check: greedy finality is only sound when no edge is negative.
    const missing = ctx.graph.edges.find((e) => e.weight === null || !Number.isFinite(e.weight));
    if (!ctx.graph.weighted || missing) {
      return t.reject({
        lines: ['check'],
        say: ctx.graph.weighted && missing ? `The edge ${ctx.edgeName(missing.id)} has no weight, so there are no distances to add up and the run stops.` : 'This graph has no edge weights, so there are no distances to add up and the run stops.',
        state, result: refused(ctx.ids, null),
      });
    }
    const sorted = [...ctx.graph.edges].sort((a, b) => compareLabels(ctx.label(a.source), ctx.label(b.source)) || compareLabels(ctx.label(a.target), ctx.label(b.target)));
    const negative = sorted.find((e) => (e.weight ?? 0) < 0);
    if (negative) {
      return t.reject({
        lines: ['check'],
        say: `The edge ${ctx.edgeName(negative.id)} has weight ${fmt(negative.weight)}, and with a negative edge a vertex that was already made final could still get a shorter route later, so finalizing by smallest distance is unsafe and the run stops.`,
        state, result: refused(ctx.ids, negative.id),
      });
    }
    t.step({ lines: ['check'], say: 'Every edge has a weight of 0 or more, so the first time a vertex is extracted its distance is already the shortest.', state });
    if (start === null) {
      return t.finish({ lines: ['return'], say: 'There were no vertices, so there is nothing to return.', state, result: refused([], null) });
    }

    const first = rowOf(rows, start);
    first.dist = 0;
    first.status = 'discovered';
    heap.push({ key: 0, vertex: start, via: null, edge: null });
    spend();
    t.event('insert', [`node:${start}`]);
    t.step({
      lines: ['init', 'seed'],
      say: `Set dist[${label(start)}] = 0 and every other distance to ∞, then insert (0, ${label(start)}) into the queue.`,
      state,
    });

    while (heap.size > 0) {
      const tie = tiedAtFront(heap);
      const entry = heap.pop();
      spend();
      if (entry === undefined) break;
      const u = entry.vertex;
      const row = rowOf(rows, u);
      popped = `${label(u)} ${fmt(entry.key)}`;
      focusVertex = u;
      focusEdge = null;
      focusFrom = null;
      t.event('dequeue', [`node:${u}`], popped);
      t.step({
        lines: ['pop'],
        say: () => `Extract the smallest entry, (${fmt(entry.key)}, ${label(u)})${tie ? ', where equal distances are ordered by vertex label' : ''}.`,
        state,
      });
      if (row.status === 'processed') {
        t.event('reject', [`node:${u}`], 'stale');
        t.step({ lines: ['stale'], say: () => `${label(u)} is already final at ${fmt(row.dist)}, so this entry is stale and is thrown away.`, state });
        continue;
      }
      row.status = 'processed';
      order.push(u);
      if (entry.edge !== null) roles[entry.edge] = 'tree';
      t.event('select', [`node:${u}`]);
      focusVertex = null;
      t.step({
        lines: ['finalize'],
        say: () => `${label(u)} is final with distance ${fmt(row.dist)}${entry.via === null ? '' : ` through ${label(entry.via)}`}, because no unfinished vertex can be closer.`,
        state,
      });
      focusVertex = u;
      for (const arc of ctx.adj[u] ?? []) {
        const v = arc.to;
        const target = rowOf(rows, v);
        const alt = distAdd(row.dist, arc.weight ?? 0);
        focusEdge = arc.edgeId;
        focusFrom = u;
        t.count('edge-checks');
        const better = target.status !== 'processed' && distLess(alt, target.dist);
        t.event('compare', [`edge:${arc.edgeId}`], `${fmt(alt)} < ${fmt(target.dist)}?`);
        t.step({
          lines: ['relax-test'],
          say: () => {
            const name = ctx.arcName(u, v);
            const via = `${fmt(row.dist)} + ${fmt(arc.weight)} = ${fmt(alt)}`;
            if (target.status === 'processed') return `The edge ${name} leads to ${label(v)}, which is already final, so it is skipped.`;
            if (better) return `The edge ${name} offers ${label(v)} the distance ${via}, which beats ${fmt(target.dist)}.`;
            return `The edge ${name} offers ${label(v)} the distance ${via}, which does not beat ${fmt(target.dist)}, so nothing changes.`;
          },
          state,
        });
        if (better) {
          const old = target.dist;
          target.dist = alt;
          target.parent = u;
          target.status = 'discovered';
          heap.push({ key: alt ?? 0, vertex: v, via: u, edge: arc.edgeId });
          t.count('relaxations');
          spend();
          t.event('relax', [`node:${v}`], `${fmt(old)} to ${fmt(alt)}`);
          t.step({
            lines: ['relax'],
            say: () => `Lower dist[${label(v)}] from ${fmt(old)} to ${fmt(alt)}, set its parent to ${label(u)}, and insert (${fmt(alt)}, ${label(v)}) into the queue.`,
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
    return t.finish({
      lines: ['return'],
      say: unreached.length > 0
        ? `The queue is empty: ${order.length} vertices are final, and ${names(ctx, unreached)} stay${unreached.length === 1 ? 's' : ''} at ∞ because no path from ${label(start)} reaches ${unreached.length === 1 ? 'it' : 'them'}.`
        : `The queue is empty and all ${order.length} vertices are final, so dist holds every shortest distance from ${label(start)}.`,
      state,
      result: {
        dist: Object.fromEntries(ctx.ids.map((id) => [id, rowOf(rows, id).dist])),
        parent: Object.fromEntries(ctx.ids.map((id) => [id, rowOf(rows, id).parent])),
        order, negativeEdge: null,
      },
    });
  },
});
