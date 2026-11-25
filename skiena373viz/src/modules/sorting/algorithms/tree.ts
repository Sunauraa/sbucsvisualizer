/** Recursion-tree layout and per-level costs. Pure: a function of the call nodes in a frame. */
import type { CallNode } from './common';

export interface PlacedNode {
  readonly node: CallNode;
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

export interface TreeLayout {
  readonly width: number;
  readonly height: number;
  readonly rowHeight: number;
  readonly boxHeight: number;
  /** Indexed by node id. */
  readonly placed: readonly PlacedNode[];
  readonly depthCount: number;
}

const GAP = 8;
const LEAF = 36;
const LEAN = 12;
const MARGIN = 8;
const ROW = 46;
const TOP = 22;

/** A box wide enough for the range and a few values; larger calls get wider boxes, up to a limit. */
export const boxWidth = (node: CallNode): number => (node.hi - node.lo <= 1 ? LEAF : Math.min(230, Math.max(58, (node.hi - node.lo) * 14 + 28)));

interface Shape {
  readonly left: number;
  readonly right: number;
  readonly center: number;
  readonly offsets: ReadonlyMap<number, number>;
}

/**
 * Lays out the complete tree (pass the nodes of the FINAL frame, so that the picture never moves while
 * the trace grows). Children sit side by side; a parent sits above the middle of its children, and a lone child
 * hangs slightly to the side it came from, so a lopsided tree leans.
 */
export function layoutTree(nodes: readonly CallNode[]): TreeLayout {
  const children = new Map<number | null, CallNode[]>();
  for (const node of nodes) children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  const shape = (node: CallNode): Shape => {
    const w = boxWidth(node);
    const kids = (children.get(node.id) ?? []).sort((a, b) => a.lo - b.lo).map((kid) => ({ kid, s: shape(kid) }));
    if (kids.length === 0) return { left: 0, right: w, center: w / 2, offsets: new Map([[node.id, w / 2]]) };
    const offsets = new Map<number, number>();
    let cursor = 0;
    const centers: number[] = [];
    for (const { s } of kids) {
      for (const [id, x] of s.offsets) offsets.set(id, x + cursor - s.left);
      centers.push(s.center + cursor - s.left);
      cursor += s.right - s.left + GAP;
    }
    const first = kids[0];
    const center = kids.length === 1 && first
      ? (centers[0] ?? 0) + (first.kid.lo === node.lo ? LEAN : -LEAN)
      : ((centers[0] ?? 0) + (centers[centers.length - 1] ?? 0)) / 2;
    offsets.set(node.id, center);
    return {
      left: Math.min(0, center - w / 2),
      right: Math.max(cursor - GAP, center + w / 2),
      center,
      offsets,
    };
  };
  const roots = children.get(null) ?? [];
  const root = roots[0];
  if (!root) return { width: 2 * MARGIN, height: 2 * MARGIN, rowHeight: ROW, boxHeight: 34, placed: [], depthCount: 0 };
  const s = shape(root);
  const placed: PlacedNode[] = [];
  for (const node of nodes) {
    placed[node.id] = { node, x: MARGIN + (s.offsets.get(node.id) ?? 0) - s.left, y: TOP + node.depth * ROW, w: boxWidth(node) };
  }
  const depthCount = Math.max(...nodes.map((node) => node.depth)) + 1;
  return { width: s.right - s.left + 2 * MARGIN, height: TOP + depthCount * ROW, rowHeight: ROW, boxHeight: 34, placed, depthCount };
}

export interface LevelCost {
  readonly depth: number;
  /** Calls at this level so far. */
  readonly calls: number;
  /** Items in those calls, added up. */
  readonly items: number;
  /** Comparisons spent by those calls' own work (merging or partitioning). */
  readonly comparisons: number;
}

export function levelCosts(nodes: readonly CallNode[]): LevelCost[] {
  const rows: { calls: number; items: number; comparisons: number }[] = [];
  for (const node of nodes) {
    const row = rows[node.depth] ?? { calls: 0, items: 0, comparisons: 0 };
    row.calls += 1;
    row.items += node.hi - node.lo;
    row.comparisons += node.cost;
    rows[node.depth] = row;
  }
  return Array.from({ length: rows.length }, (_, depth) => ({ depth, ...(rows[depth] ?? { calls: 0, items: 0, comparisons: 0 }) }));
}

/** Levels times work per level, in one sentence. */
export function levelSummary(nodes: readonly CallNode[], n: number): string {
  const costs = levelCosts(nodes);
  if (costs.length === 0) return 'No calls yet.';
  const total = costs.reduce((sum, row) => sum + row.comparisons, 0);
  const worst = Math.max(...costs.map((row) => row.comparisons));
  return `${costs.length} ${costs.length === 1 ? 'level' : 'levels'} of calls so far, at most ${worst} comparisons on any one level, ${total} comparisons in all (n = ${n}).`;
}
