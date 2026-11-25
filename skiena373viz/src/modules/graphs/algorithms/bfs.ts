/** Breadth-first search with restarts: every component is explored and numbered. */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { buildState, countsText, makeCtx, makeRows, names, plural, rowOf, startNote, startOf } from './common';
import { presetsFor } from './presets';
import type { EdgeRole, GraphInput, GraphState } from './types';

export interface BfsResult {
  /** Vertices in the order they were processed (dequeued). */
  readonly order: readonly string[];
  readonly parent: Readonly<Record<string, string | null>>;
  readonly level: Readonly<Record<string, number | null>>;
  readonly component: Readonly<Record<string, number | null>>;
  readonly components: number;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'bfs(G, s)'],
  ['init', 1, 'mark every vertex undiscovered; components = 0'],
  ['roots', 1, 'for each vertex r (s first, then label order)'],
  ['new-root', 2, 'if r is undiscovered:'],
  ['start', 3, 'components += 1; mark r discovered, level 0; enqueue r'],
  ['loop', 3, 'while the queue is not empty'],
  ['dequeue', 4, 'u = dequeue from the front'],
  ['scan', 4, 'for each neighbour v of u (label order)'],
  ['test', 5, 'if v is undiscovered:'],
  ['discover', 6, 'mark v discovered; parent[v] = u; level[v] = level[u] + 1; enqueue v'],
  ['finish', 4, 'mark u processed'],
  ['return', 1, 'return parents, levels and components'],
]);

const OPS = defineOps([
  { id: 'visits', label: 'Vertices discovered', counts: 'One each time a vertex is marked discovered (and enqueued), including each component\'s first vertex.' },
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for every adjacency-list entry looked at while processing a vertex; an undirected edge is looked at from both ends.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const bfs = defineAlgorithm({
  id: 'graphs-bfs',
  title: 'Breadth-first search',
  summary: 'Explore level by level with a queue, restarting in each unexplored component.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case, adjacency lists', bound: 'Θ(V + E)', why: 'each vertex is enqueued once and each adjacency entry is read once, whatever the graph looks like.' },
    { resource: 'space', when: 'every case', bound: 'Θ(V)', why: 'the queue and the per-vertex arrays hold at most one entry per vertex.' },
  ],
  presets: presetsFor('bfs'),
  execute(input: GraphInput, t: T): Finished<BfsResult> {
    const ctx = makeCtx(input);
    const start = startOf(ctx, input.start);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const queue: string[] = [];
    const order: string[] = [];
    let components = 0;
    let focusVertex: string | null = null;
    let focusEdge: string | null = null;
    let focusFrom: string | null = null;
    const label = ctx.label;

    const state = (): GraphState => buildState({
      kind: 'bfs', ctx, start, rows, roles, focusVertex, focusEdge, focusFrom,
      containers: [{
        id: 'queue', title: 'Queue', left: 'front', right: 'back',
        items: queue.map((id, i) => ({
          text: label(id), kind: 'normal', note: `${label(id)}, level ${rowOf(rows, id).level ?? 0}${i === 0 ? ', next to leave' : ''}`,
        })),
      }],
      facts: [
        { label: 'Components found', value: String(components) },
        { label: 'Processed', value: `${order.length} of ${ctx.ids.length}` },
      ],
    });
    const queueText = (): string => (queue.length === 0 ? 'the queue is empty' : `the queue is now ${names(ctx, queue)}`);

    t.step({
      lines: ['signature', 'init'],
      say: start === null
        ? 'The graph has no vertices, so there is nothing to search.'
        : `Search ${countsText(ctx)} breadth-first from ${startNote(ctx, input.start, start)}; every vertex starts undiscovered.`,
      state,
    });

    const roots = start === null ? [] : [start, ...ctx.ids.filter((id) => id !== start)];
    for (const r of roots) {
      if (rowOf(rows, r).status !== 'undiscovered') continue;
      components += 1;
      const root = rowOf(rows, r);
      root.status = 'discovered';
      root.level = 0;
      root.component = components;
      queue.push(r);
      t.count('visits');
      t.event('discover', [`node:${r}`], `component ${components}`);
      t.step({
        lines: ['new-root', 'start'],
        say: components === 1
          ? `${label(r)} is undiscovered, so component 1 starts there: level 0, and ${queueText()}.`
          : `${label(r)} is still undiscovered after the earlier components, so component ${components} starts there: level 0, and ${queueText()}.`,
        state,
      });

      while (queue.length > 0) {
        const u = queue.shift() as string;
        focusVertex = u;
        t.event('dequeue', [`node:${u}`]);
        const arcs = ctx.adj[u] ?? [];
        t.step({
          lines: ['dequeue'],
          say: () => `Dequeue ${label(u)} from the front; it has ${plural(arcs.length, 'adjacency entry', 'adjacency entries')} to look at, and ${queueText()}.`,
          state,
        });
        for (const arc of arcs) {
          const v = arc.to;
          const target = rowOf(rows, v);
          focusEdge = arc.edgeId;
          focusFrom = u;
          t.count('edge-checks');
          t.event('compare', [`edge:${arc.edgeId}`], `${label(u)} to ${label(v)}`);
          const fresh = target.status === 'undiscovered';
          t.step({
            lines: ['test'],
            say: () => {
              if (fresh) return `${label(u)} has the edge ${ctx.arcName(u, v)}, and ${label(v)} is undiscovered.`;
              if (v === u) return `${label(u)} has an edge to itself, and ${label(u)} is already discovered, so nothing changes.`;
              return `${label(u)} has the edge ${ctx.arcName(u, v)}, but ${label(v)} is already ${target.status === 'processed' ? 'processed' : 'discovered'}, so nothing changes.`;
            },
            state,
          });
          if (fresh) {
            target.status = 'discovered';
            target.parent = u;
            target.level = (rowOf(rows, u).level ?? 0) + 1;
            target.component = components;
            queue.push(v);
            roles[arc.edgeId] = 'tree';
            t.count('visits');
            t.event('enqueue', [`node:${v}`]);
            t.step({
              lines: ['discover'],
              say: () => `Discover ${label(v)} with parent ${label(u)} and level ${target.level ?? 0}, and enqueue it at the back, so ${queueText()}.`,
              state,
            });
          }
        }
        focusEdge = null;
        focusFrom = null;
        focusVertex = null;
        rowOf(rows, u).status = 'processed';
        order.push(u);
        t.event('finish', [`node:${u}`]);
        t.step({
          lines: ['finish'],
          say: () => `Every neighbour of ${label(u)} has been looked at, so ${label(u)} is processed.`,
          state,
        });
      }
    }

    const result: BfsResult = {
      order,
      parent: Object.fromEntries(ctx.ids.map((id) => [id, rowOf(rows, id).parent])),
      level: Object.fromEntries(ctx.ids.map((id) => [id, rowOf(rows, id).level])),
      component: Object.fromEntries(ctx.ids.map((id) => [id, rowOf(rows, id).component])),
      components,
    };
    return t.finish({
      lines: ['return'],
      say: start === null
        ? 'There were no vertices, so the search returns nothing.'
        : `The queue is empty and every vertex is processed, so the search is done with ${plural(components, 'component')}.`,
      state,
      result,
    });
  },
});
