/** Depth-first search with entry/exit times and edge classification (tree, back, and for directed graphs forward and cross). */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder } from '@core';
import { buildState, countsText, makeCtx, makeRows, names, plural, rowOf, startNote, startOf } from './common';
import { presetsFor } from './presets';
import type { EdgeRole, GraphInput, GraphState } from './types';

export type EdgeClass = 'tree' | 'back' | 'forward' | 'cross';

export interface DfsResult {
  /** Vertices in the order they were entered. */
  readonly order: readonly string[];
  readonly entry: Readonly<Record<string, number | null>>;
  readonly exit: Readonly<Record<string, number | null>>;
  readonly parent: Readonly<Record<string, string | null>>;
  /** One class per edge id. */
  readonly classes: Readonly<Record<string, EdgeClass>>;
  readonly roots: readonly string[];
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'dfs(G, s)'],
  ['init', 1, 'time = 0; mark every vertex undiscovered'],
  ['roots', 1, 'for each vertex r (s first, then label order)'],
  ['call-root', 2, 'if r is undiscovered: visit(r)'],
  ['visit', 0, 'visit(u)'],
  ['enter', 1, 'time += 1; entry[u] = time; mark u discovered; push u on the call stack'],
  ['scan', 1, 'for each edge (u, v), v in label order'],
  ['tree', 2, 'if v is undiscovered: tree edge; parent[v] = u; visit(v)'],
  ['skip', 2, 'else if the graph is undirected and the edge is already classified: skip it'],
  ['back', 2, 'else if v is discovered but not finished: back edge'],
  ['forward', 2, 'else if entry[u] < entry[v]: forward edge (directed only)'],
  ['cross', 2, 'else: cross edge (directed only)'],
  ['exit', 1, 'time += 1; exit[u] = time; mark u finished; pop u'],
  ['return', 1, 'return times, parents and edge classes'],
]);

const OPS = defineOps([
  { id: 'visits', label: 'Vertices entered', counts: 'One each time visit(u) is called, which happens once per vertex.' },
  { id: 'edge-checks', label: 'Edge checks', counts: 'One for every adjacency-list entry looked at; an undirected edge is looked at from both ends.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

export const dfs = defineAlgorithm({
  id: 'graphs-dfs',
  title: 'Depth-first search',
  summary: 'Follow edges as deep as possible with a call stack, timing every vertex and classifying every edge.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'every case, adjacency lists', bound: 'Θ(V + E)', why: 'visit runs once per vertex and every adjacency entry is read once.' },
    { resource: 'space', when: 'worst case', bound: 'Θ(V)', why: 'the call stack can hold every vertex at once, for example on a path.' },
  ],
  presets: presetsFor('dfs'),
  execute(input: GraphInput, t: T): Finished<DfsResult> {
    const ctx = makeCtx(input);
    const start = startOf(ctx, input.start);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const classes: Record<string, EdgeClass> = {};
    const stack: string[] = [];
    const order: string[] = [];
    const roots: string[] = [];
    let time = 0;
    let focusVertex: string | null = null;
    let focusEdge: string | null = null;
    let focusFrom: string | null = null;
    const label = ctx.label;
    const kinds: Record<EdgeClass, number> = { tree: 0, back: 0, forward: 0, cross: 0 };

    const state = (): GraphState => buildState({
      kind: 'dfs', ctx, start, rows, roles, focusVertex, focusEdge, focusFrom,
      containers: [{
        id: 'stack', title: 'Call stack', left: 'bottom', right: 'top',
        items: stack.map((id, i) => ({
          text: label(id), kind: 'normal', note: `visit(${label(id)}), entered at time ${rowOf(rows, id).entry ?? 0}${i === stack.length - 1 ? ', the running call' : ''}`,
        })),
      }],
      facts: [
        { label: 'Clock', value: String(time) },
        { label: 'Tree edges', value: String(kinds.tree) },
        { label: 'Back edges', value: String(kinds.back) },
        ...(ctx.directed ? [{ label: 'Forward edges', value: String(kinds.forward) }, { label: 'Cross edges', value: String(kinds.cross) }] : []),
      ],
    });
    const stackText = (): string => (stack.length === 0 ? 'the call stack is empty' : `the call stack is ${names(ctx, stack)} (bottom to top)`);

    const classify = (eid: string, kind: EdgeClass, sentence: () => string): void => {
      classes[eid] = kind;
      roles[eid] = kind;
      kinds[kind] += 1;
      t.event('compare', [`edge:${eid}`], kind);
      t.step({ lines: [kind], say: sentence, state });
    };

    const visit = (u: string): void => {
      const row = rowOf(rows, u);
      time += 1;
      row.entry = time;
      row.status = 'discovered';
      stack.push(u);
      order.push(u);
      focusVertex = u;
      focusEdge = null;
      focusFrom = null;
      t.count('visits');
      t.event('call', [`node:${u}`]);
      t.step({
        lines: ['enter'],
        say: () => `Call visit(${label(u)}): its entry time is ${time}, and ${stackText()}.`,
        state,
      });
      for (const arc of ctx.adj[u] ?? []) {
        const v = arc.to;
        const target = rowOf(rows, v);
        const eid = arc.edgeId;
        focusVertex = u;
        focusEdge = eid;
        focusFrom = u;
        t.count('edge-checks');
        const name = ctx.arcName(u, v);
        if (target.status === 'undiscovered') {
          target.parent = u;
          classify(eid, 'tree', () => `The edge ${name} reaches ${label(v)}, which is undiscovered, so it is a tree edge and visit(${label(v)}) is called.`);
          visit(v);
          focusVertex = u;
          focusEdge = null;
          focusFrom = null;
        } else if (!ctx.directed && roles[eid] !== undefined) {
          const wasTree = roles[eid] === 'tree' && target.id === row.parent;
          t.event('compare', [`edge:${eid}`], 'skip');
          t.step({
            lines: ['skip'],
            say: () => (wasTree
              ? `The edge ${name} is the tree edge that led from ${label(v)} down to ${label(u)}, so it is skipped and is not a back edge.`
              : `The edge ${name} was already classified as a ${roles[eid] ?? 'tree'} edge when it was met from ${label(v)}, so it is skipped.`),
            state,
          });
        } else if (target.status === 'discovered') {
          classify(eid, 'back', () => (v === u
            ? `The edge ${name} is a self-loop, and ${label(u)} is still on the call stack, so it is a back edge.`
            : `The edge ${name} reaches ${label(v)}, which is still on the call stack, so it is a back edge and closes a cycle.`));
        } else if (ctx.directed && (row.entry ?? 0) < (target.entry ?? 0)) {
          classify(eid, 'forward', () => `The edge ${name} reaches ${label(v)}, which is finished and was entered later (time ${target.entry ?? 0}) than ${label(u)} (time ${row.entry ?? 0}), so it is a forward edge.`);
        } else if (ctx.directed) {
          classify(eid, 'cross', () => `The edge ${name} reaches ${label(v)}, which is finished and was entered earlier (time ${target.entry ?? 0}) than ${label(u)} (time ${row.entry ?? 0}), so it is a cross edge.`);
        } else {
          // Unreachable: in an undirected graph the first look at a non-tree edge is from the descendant, whose
          // other end is an open ancestor. Kept as a safe default rather than a crash.
          classify(eid, 'back', () => `The edge ${name} joins ${label(u)} to ${label(v)}, so it is classified as a back edge.`);
        }
      }
      time += 1;
      row.exit = time;
      row.status = 'processed';
      stack.pop();
      focusVertex = null;
      focusEdge = null;
      focusFrom = null;
      t.event('return', [`node:${u}`]);
      t.step({
        lines: ['exit'],
        say: () => `Every edge of ${label(u)} is handled, so visit(${label(u)}) finishes at time ${time} and ${label(u)} leaves the call stack.`,
        state,
      });
    };

    t.step({
      lines: ['signature', 'init'],
      say: start === null
        ? 'The graph has no vertices, so there is nothing to search.'
        : `Search ${countsText(ctx)} depth-first from ${startNote(ctx, input.start, start)}; the clock starts at 0 and every vertex is undiscovered.`,
      state,
    });
    const candidates = start === null ? [] : [start, ...ctx.ids.filter((id) => id !== start)];
    for (const r of candidates) {
      if (rowOf(rows, r).status !== 'undiscovered') continue;
      roots.push(r);
      focusVertex = r;
      t.step({
        lines: ['call-root'],
        say: roots.length === 1
          ? `${label(r)} is undiscovered, so visit(${label(r)}) starts the first tree.`
          : `${label(r)} is still undiscovered, so visit(${label(r)}) starts tree ${roots.length}.`,
        state,
      });
      visit(r);
    }
    focusVertex = null;
    const record = <V>(pick: (id: string) => V): Record<string, V> => Object.fromEntries(ctx.ids.map((id) => [id, pick(id)]));
    return t.finish({
      lines: ['return'],
      say: start === null
        ? 'There were no vertices, so the search returns nothing.'
        : `Every vertex is finished after ${plural(roots.length, 'tree')} and ${time} clock ticks, with ${plural(ctx.graph.edges.length, 'edge')} classified.`,
      state,
      result: {
        order, entry: record((id) => rowOf(rows, id).entry), exit: record((id) => rowOf(rows, id).exit),
        parent: record((id) => rowOf(rows, id).parent), classes, roots,
      },
    });
  },
});
