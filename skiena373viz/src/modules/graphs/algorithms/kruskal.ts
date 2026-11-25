/** Kruskal's minimum spanning forest: sort the edges, then keep each edge that joins two different sets. */
import { compareLabels, defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, GraphEdge, OpOf, Recorder } from '@core';
import { buildState, countsText, fmt, makeCtx, makeRows, plural, rowOf } from './common';
import type { Ctx, Row } from './common';
import { presetsFor } from './presets';
import type { ContainerItem, EdgeRole, GraphInput, GraphState } from './types';

export interface KruskalResult {
  /** Kept edge ids, in the order they were kept. */
  readonly edges: readonly string[];
  readonly weight: number;
  /** Number of connected components (1 means a spanning tree). */
  readonly components: number;
  readonly spanning: boolean;
}

const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'kruskal(G)'],
  ['check', 1, 'check that G is undirected and every edge has a weight'],
  ['sort', 1, 'sort the edges by (weight, endpoint labels)'],
  ['init', 1, 'make every vertex its own set: parent[v] = v, size[v] = 1'],
  ['loop', 1, 'for each edge (u, v, w) in sorted order'],
  ['stop', 2, 'if V - 1 edges are kept: stop'],
  ['find', 2, 'ru = find(u); rv = find(v)'],
  ['cycle', 2, 'if ru = rv: reject the edge, it would close a cycle'],
  ['accept', 2, 'else: union by size; keep the edge; total += w'],
  ['return', 1, 'return the kept edges and their total weight'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Sort comparisons', counts: 'Comparisons between two edges made while sorting them by weight (a merge sort: ties are settled by endpoint labels).' },
  { id: 'finds', label: 'Finds', counts: 'One for each call to find(v); two per edge examined. A find walks parent pointers up to the root.' },
  { id: 'unions', label: 'Unions', counts: 'One each time two different sets are merged, which is the same as one kept edge.' },
]);

type T = Recorder<GraphState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const EMPTY: KruskalResult = { edges: [], weight: 0, components: 0, spanning: false };

/** Merge sort that counts comparisons through `before`. Stable and deterministic. */
function sortCounting<X>(items: readonly X[], before: (a: X, b: X) => boolean, onCompare: () => void): X[] {
  if (items.length <= 1) return [...items];
  const mid = items.length >> 1;
  const left = sortCounting(items.slice(0, mid), before, onCompare);
  const right = sortCounting(items.slice(mid), before, onCompare);
  const out: X[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    onCompare();
    if (before(right[j] as X, left[i] as X)) out.push(right[j++] as X);
    else out.push(left[i++] as X);
  }
  while (i < left.length) out.push(left[i++] as X);
  while (j < right.length) out.push(right[j++] as X);
  return out;
}

const edgeBefore = (ctx: Ctx) => (a: GraphEdge, b: GraphEdge): boolean => {
  const wa = a.weight ?? 0;
  const wb = b.weight ?? 0;
  if (wa !== wb) return wa < wb;
  const ends = (e: GraphEdge): [string, string] => {
    const x = ctx.label(e.source);
    const y = ctx.label(e.target);
    return compareLabels(x, y) <= 0 ? [x, y] : [y, x];
  };
  const [a1, a2] = ends(a);
  const [b1, b2] = ends(b);
  return (compareLabels(a1, b1) || compareLabels(a2, b2) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) < 0;
};

export const kruskal = defineAlgorithm({
  id: 'graphs-kruskal',
  title: "Kruskal's algorithm",
  summary: 'Go through the edges from lightest to heaviest and keep each one that joins two different components.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'with sorting and union by size', bound: 'O(E log E)', why: 'sorting costs O(E log E); each find walks at most log V parents, so the E edges add O(E log V), and log E = O(log V) because E < V².' },
    { resource: 'space', when: 'every case', bound: 'Θ(V + E)', why: 'the sorted edge list plus a parent and a size per vertex.' },
  ],
  presets: presetsFor('kruskal'),
  execute(input: GraphInput, t: T): Finished<KruskalResult> {
    const ctx = makeCtx(input);
    const rows = makeRows(ctx);
    const roles: Record<string, EdgeRole> = {};
    const label = ctx.label;
    const n = ctx.ids.length;
    let list: GraphEdge[] = [];
    // `done` maps an examined edge id to what happened to it; `cursor` is the edge being examined.
    const outcome: Record<string, 'kept' | 'rejected'> = {};
    let cursor: string | null = null;
    let weight = 0;
    const kept: string[] = [];

    const find = (id: string): string => {
      let at = id;
      while (rowOf(rows, at).parent !== at) at = rowOf(rows, at).parent as string;
      return at;
    };
    let forestReady = false;
    const refresh = (): void => {
      if (forestReady) for (const id of ctx.ids) rowOf(rows, id).root = find(id);
    };
    const sizeOf = (id: string): number => rowOf(rows, find(id)).size ?? 1;

    const state = (): GraphState => {
      refresh();
      const items: ContainerItem[] = list.map((edge) => {
        const kind = outcome[edge.id];
        const here = edge.id === cursor;
        const name = `${ctx.arcName(edge.source, edge.target)} ${fmt(edge.weight)}`;
        return {
          text: `${label(edge.source)}-${label(edge.target)} ${fmt(edge.weight)}`,
          kind: here ? 'current' : kind === 'kept' ? 'kept' : kind === 'rejected' ? 'rejected' : 'normal',
          note: `${name}${here ? ', being examined' : kind === 'kept' ? ', kept' : kind === 'rejected' ? ', rejected: it would close a cycle' : ''}`,
        };
      });
      return buildState({
        kind: 'kruskal', ctx, start: null, rows, roles, focusEdge: cursor,
        focusFrom: null,
        containers: [{ id: 'edges', title: 'Edges in sorted order', left: 'lightest', right: 'heaviest', items }],
        facts: [
          { label: 'Forest weight so far', value: fmt(weight) },
          { label: 'Edges kept', value: `${kept.length} of ${Math.max(0, n - 1)} needed` },
          { label: 'Components', value: String(n - kept.length) },
        ],
      });
    };

    t.step({
      lines: ['signature'],
      say: n === 0 ? 'The graph has no vertices, so there is nothing to span.' : `Build a minimum spanning forest of ${countsText(ctx)} by sorting the edges.`,
      state,
    });
    const missing = ctx.graph.edges.find((e) => e.weight === null || !Number.isFinite(e.weight));
    if (ctx.directed) {
      return t.reject({ lines: ['check'], say: 'This graph is directed, but a spanning tree is built from undirected edges, so the run stops.', state, result: EMPTY });
    }
    if (!ctx.graph.weighted || missing) {
      return t.reject({
        lines: ['check'],
        say: ctx.graph.weighted && missing ? `The edge ${ctx.edgeName(missing.id)} has no weight, so there is nothing to sort by and the run stops.` : 'This graph has no edge weights, so there is nothing to sort by and the run stops.',
        state, result: EMPTY,
      });
    }
    const negative = ctx.graph.edges.filter((e) => (e.weight ?? 0) < 0);
    t.step({
      lines: ['check'],
      say: negative.length > 0
        ? `The graph is undirected and weighted, and its negative weights (${negative.map((e) => `${ctx.edgeName(e.id)}: ${fmt(e.weight)}`).join(', ')}) are fine here because Kruskal only ranks single edges and never adds up paths.`
        : 'The graph is undirected and every edge has a weight, so Kruskal can run.',
      state,
    });

    let sortComparisons = 0;
    list = sortCounting(ctx.graph.edges, edgeBefore(ctx), () => { sortComparisons += 1; });
    t.count('comparisons', sortComparisons);
    t.event('compare', list.map((e) => `edge:${e.id}`), 'sorted');
    t.step({
      lines: ['sort'],
      say: () => `Sort the ${plural(list.length, 'edge')} by weight, settling ties by endpoint labels, which took ${plural(sortComparisons, 'comparison')}${list.length === 0 ? '' : ` and puts ${ctx.edgeName((list[0] as GraphEdge).id)} first`}.`,
      state,
    });

    for (const id of ctx.ids) {
      const row: Row = rowOf(rows, id);
      row.parent = id;
      row.size = 1;
      row.root = id;
    }
    forestReady = true;
    t.step({ lines: ['init'], say: n === 0 ? 'With no vertices there are no sets to make.' : `Every one of the ${plural(n, 'vertex', 'vertices')} starts as its own one-vertex set.`, state });

    for (let i = 0; i < list.length; i += 1) {
      const edge = list[i] as GraphEdge;
      if (kept.length === n - 1) {
        cursor = null;
        t.step({
          lines: ['stop'],
          say: `${plural(kept.length, 'edge')} ${kept.length === 1 ? 'is' : 'are'} already kept, enough to join all ${plural(n, 'vertex', 'vertices')}, so the remaining ${plural(list.length - i, 'edge')} cannot be added and the loop stops.`,
          state,
        });
        break;
      }
      const w = edge.weight ?? 0;
      cursor = edge.id;
      const ru = find(edge.source);
      const rv = find(edge.target);
      t.count('finds', 2);
      t.event('find', [`node:${edge.source}`, `node:${edge.target}`]);
      t.step({
        lines: ['find'],
        say: () => `Look at the edge ${ctx.edgeName(edge.id)} of weight ${fmt(w)}: find(${label(edge.source)}) is ${label(ru)} and find(${label(edge.target)}) is ${label(rv)}.`,
        state,
      });
      if (ru === rv) {
        outcome[edge.id] = 'rejected';
        roles[edge.id] = 'rejected';
        t.event('reject', [`edge:${edge.id}`], 'cycle');
        t.step({
          lines: ['cycle'],
          say: () => (edge.source === edge.target
            ? `The edge ${ctx.edgeName(edge.id)} is a self-loop, so both ends are in the set rooted at ${label(ru)} and it is rejected.`
            : `${label(edge.source)} and ${label(edge.target)} are already in the same set, rooted at ${label(ru)}, so the edge ${ctx.edgeName(edge.id)} would close a cycle and is rejected.`),
          state,
        });
      } else {
        // Union by size: the smaller set hangs under the larger; equal sizes: the smaller label stays the root.
        const a = rowOf(rows, ru);
        const b = rowOf(rows, rv);
        const aWins = (a.size ?? 1) > (b.size ?? 1) || ((a.size ?? 1) === (b.size ?? 1) && compareLabels(label(ru), label(rv)) <= 0);
        const [top, under] = aWins ? [a, b] : [b, a];
        const underSize = under.size ?? 1;
        under.parent = top.id;
        top.size = (top.size ?? 1) + underSize;
        outcome[edge.id] = 'kept';
        roles[edge.id] = 'tree';
        kept.push(edge.id);
        weight += w;
        t.count('unions');
        t.event('union', [`node:${ru}`, `node:${rv}`]);
        t.step({
          lines: ['accept'],
          say: () => `${label(edge.source)} and ${label(edge.target)} are in different sets, so the edge ${ctx.edgeName(edge.id)} is kept and the set of ${label(under.id)} (size ${underSize}) hangs under ${label(top.id)}, making ${plural(sizeOf(top.id), 'vertex', 'vertices')} and a forest weight of ${fmt(weight)}.`,
          state,
        });
      }
    }
    cursor = null;
    const components = n === 0 ? 0 : n - kept.length;
    const spanning = n > 0 && components === 1;
    return t.finish({
      lines: ['return'],
      say: n === 0
        ? 'There were no vertices, so the forest is empty.'
        : spanning
          ? `The ${plural(kept.length, 'kept edge')} join all ${plural(n, 'vertex', 'vertices')} into one minimum spanning tree of weight ${fmt(weight)}.`
          : `The ${plural(kept.length, 'kept edge')} form a minimum spanning forest of weight ${fmt(weight)} with ${components} components, so the graph is disconnected and has no spanning tree.`,
      state,
      result: { edges: kept, weight, components, spanning },
    });
  },
});
