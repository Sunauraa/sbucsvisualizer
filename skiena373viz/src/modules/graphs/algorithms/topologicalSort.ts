/** Topological sort by depth-first finish order. A directed cycle is found by the search itself and rejected. */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { buildState, countsText, makeCtx, makeRows, names, plural, rowOf } from './common';
import { presetsFor } from './presets';
import type { EdgeRole, GraphInput, GraphState } from './types';

export interface TopoResult {
  /** A valid order (every edge points left to right), or null when the graph has a cycle. */
  readonly order: readonly string[] | null;
  /** The vertices of a directed cycle in order, repeating the first at the end, or null. */
  readonly cycle: readonly string[] | null;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'topological-sort(G)'],
  ['check', 1, 'check that G is directed'],
  ['init', 1, 'mark every vertex undiscovered; finish stack S = empty'],
  ['roots', 1, 'for each vertex r in label order'],
  ['call-root', 2, 'if r is undiscovered: visit(r)'],
  ['visit', 0, 'visit(u)'],
  ['enter', 1, 'mark u discovered; push u on the call stack'],
  ['scan', 1, 'for each edge (u, v), v in label order'],
  ['cycle', 2, 'if v is discovered but not finished: cycle found, stop'],
  ['recurse', 2, 'else if v is undiscovered: parent[v] = u; visit(v)'],
  ['finish', 1, 'mark u finished; pop it from the call stack; push u on S'],
  ['return', 1, 'return S, read from top to bottom'],
]);

const OPS = defineOps([
  { id: 'visits', label: 'Vertices entered', counts: 'One each time visit(u) is called, which happens once per vertex.' },
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for every adjacency-list entry looked at.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const topologicalSort = defineAlgorithm({
  id: 'graphs-topological-sort',
  title: 'Topological sort',
  summary: 'Order the vertices of a directed graph so every edge points forward: reverse the order in which a depth-first search finishes them.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case, adjacency lists', bound: 'Θ(V + E)', why: 'it is one depth-first search plus a push per vertex.' },
    { resource: 'space', when: 'worst case', bound: 'Θ(V)', why: 'the call stack and the finish stack each hold at most V vertices.' },
  ],
  presets: presetsFor('topological-sort'),
  execute(input: GraphInput, t: T): Finished<TopoResult> {
    const ctx = makeCtx(input);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const stack: string[] = [];
    const finished: string[] = [];
    let cycle: string[] = [];
    let time = 0;
    let focusVertex: string | null = null;
    let focusEdge: string | null = null;
    let focusFrom: string | null = null;
    const label = ctx.label;
    const n = ctx.ids.length;

    const state = (): GraphState => buildState({
      kind: 'topological-sort', ctx, start: null, rows, roles, focusVertex, focusEdge, focusFrom, cycle,
      containers: [
        {
          id: 'stack', title: 'Call stack', left: 'bottom', right: 'top',
          items: stack.map((id) => ({ text: label(id), kind: 'normal', note: `visit(${label(id)})` })),
        },
        {
          id: 'finish', title: 'Finish stack (the top finished last)', left: 'bottom', right: 'top',
          items: finished.map((id) => ({ text: label(id), kind: 'normal', note: `${label(id)} finished` })),
        },
        {
          id: 'order', title: 'Order so far (fills from the right)', left: 'first', right: 'last',
          items: Array.from({ length: n }, (_, slot) => {
            const id = finished[n - 1 - slot];
            return id === undefined
              ? { text: '', kind: 'normal' as const, note: 'empty' }
              : { text: label(id), kind: 'kept' as const, note: `position ${slot + 1}: ${label(id)}` };
          }),
        },
      ],
      facts: [{ label: 'Finished', value: `${finished.length} of ${n}` }, { label: 'Clock', value: String(time) }],
    });
    const stackText = (): string => (stack.length === 0 ? 'the call stack is empty' : `the call stack is ${names(ctx, stack)} (bottom to top)`);

    const reject = (): Finished<TopoResult> => {
      const found = cycle;
      return t.reject({
        lines: ['cycle'],
        say: () => `The edge ${ctx.arcName(found[found.length - 2] ?? '', found[found.length - 1] ?? '')} closes the directed cycle ${found.map(label).join(' → ')}, so no topological order exists.`,
        state,
        result: { order: null, cycle: found },
      });
    };

    t.step({
      lines: ['signature'],
      say: `Sort ${countsText(ctx)} topologically by depth-first finish order.`,
      state,
    });
    if (!ctx.directed) {
      return t.reject({
        lines: ['check'],
        say: 'This graph is undirected, so its edges have no direction to respect and a topological order is not defined.',
        state,
        result: { order: null, cycle: null },
      });
    }
    t.step({ lines: ['check', 'init'], say: 'The graph is directed, so every edge says which vertex must come first; every vertex starts undiscovered.', state });

    let failed = false;
    const visit = (u: string): void => {
      const row = rowOf(rows, u);
      time += 1;
      row.entry = time;
      row.status = 'discovered';
      stack.push(u);
      focusVertex = u;
      focusEdge = null;
      focusFrom = null;
      t.count('visits');
      t.event('call', [`node:${u}`]);
      t.step({ lines: ['enter'], say: () => `Call visit(${label(u)}), and ${stackText()}.`, state });
      for (const arc of ctx.adj[u] ?? []) {
        if (failed) return;
        const v = arc.to;
        const target = rowOf(rows, v);
        focusVertex = u;
        focusEdge = arc.edgeId;
        focusFrom = u;
        t.count('edge-checks');
        const name = ctx.arcName(u, v);
        if (target.status === 'discovered') {
          // v is still on the call stack, so u is a descendant of v and this edge closes a loop.
          cycle = [...stack.slice(stack.indexOf(v)), v];
          for (let i = 0; i + 1 < cycle.length; i += 1) {
            const from = cycle[i] as string;
            const to = cycle[i + 1] as string;
            const edge = ctx.graph.edges.find((e) => e.source === from && e.target === to);
            if (edge) roles[edge.id] = 'cycle';
          }
          failed = true;
          return;
        }
        if (target.status === 'undiscovered') {
          target.parent = u;
          roles[arc.edgeId] = 'tree';
          t.event('call', [`edge:${arc.edgeId}`]);
          t.step({
            lines: ['recurse'],
            say: () => `The edge ${name} reaches ${label(v)}, which is undiscovered, so visit(${label(v)}) is called.`,
            state,
          });
          visit(v);
          if (failed) return;
          focusVertex = u;
          focusEdge = null;
          focusFrom = null;
        } else {
          t.step({
            lines: ['scan'],
            say: () => `The edge ${name} reaches ${label(v)}, which is already finished, so ${label(v)} will appear after ${label(u)} and nothing needs doing.`,
            state,
          });
        }
      }
      time += 1;
      row.exit = time;
      row.status = 'processed';
      stack.pop();
      finished.push(u);
      focusVertex = null;
      focusEdge = null;
      focusFrom = null;
      t.event('finish', [`node:${u}`]);
      t.step({
        lines: ['finish'],
        say: () => `Every edge of ${label(u)} is handled, so ${label(u)} finishes and is pushed on the finish stack, taking position ${n - finished.length + 1} of ${n} from the left.`,
        state,
      });
    };

    for (const r of ctx.ids) {
      if (rowOf(rows, r).status !== 'undiscovered') continue;
      focusVertex = r;
      t.step({ lines: ['call-root'], say: `${label(r)} is undiscovered, so visit(${label(r)}) starts a new search tree.`, state });
      visit(r);
      if (failed) return reject();
    }
    focusVertex = null;
    const order = [...finished].reverse();
    return t.finish({
      lines: ['return'],
      say: n === 0
        ? 'There were no vertices, so the order is empty.'
        : `Reading the finish stack from the top gives the order ${names(ctx, order)}, and every one of the ${plural(ctx.graph.edges.length, 'edge')} points from left to right.`,
      state,
      result: { order, cycle: null },
    });
  },
});

