/** Shared by Prim and Dijkstra: the lazy-deletion priority queue and how it is shown. */
import { compareLabels } from '@core';
import { entryBefore, MinHeap } from './heap';
import type { PqEntry } from './heap';
import { fmt, rowOf } from './common';
import type { Ctx, Row } from './common';
import type { Container } from './types';

export const newQueue = (ctx: Ctx): MinHeap<PqEntry> => new MinHeap<PqEntry>(entryBefore(ctx.label, compareLabels));

/** Number of heap comparisons since the last call, so each step counts exactly its own work. */
export class ComparisonMeter {
  private seen = 0;
  constructor(private readonly heap: MinHeap<PqEntry>) {}
  take(): number {
    const now = this.heap.comparisons;
    const used = now - this.seen;
    this.seen = now;
    return used;
  }
}

/**
 * The queue in pop order (smallest first). An entry is stale when its vertex is already final, or when a
 * smaller key for the vertex was found after the entry was inserted: it stays in the heap until popped.
 */
export function pqContainer(ctx: Ctx, heap: MinHeap<PqEntry>, rows: Map<string, Row>, prim: boolean): Container {
  const noun = prim ? 'key' : 'distance';
  return {
    id: 'pq',
    title: prim ? 'Priority queue (smallest key first)' : 'Priority queue (smallest distance first)',
    left: 'front', right: 'back',
    items: heap.sorted().map((entry) => {
      const row = rowOf(rows, entry.vertex);
      const finalNow = row.status === 'processed';
      const stale = finalNow || entry.key !== row.dist;
      const via = entry.via === null ? 'the start' : `via ${ctx.label(entry.via)}`;
      const why = finalNow
        ? `stale: ${ctx.label(entry.vertex)} is already ${prim ? 'in the tree' : 'final'}`
        : `stale: ${ctx.label(entry.vertex)} has a smaller ${noun} ${fmt(row.dist)} now`;
      return {
        text: `${ctx.label(entry.vertex)} ${fmt(entry.key)}`,
        kind: stale ? 'stale' as const : 'normal' as const,
        note: `${ctx.label(entry.vertex)}, ${noun} ${fmt(entry.key)}, ${via}${stale ? `; ${why}` : ''}`,
      };
    }),
  };
}

/** Index 1 ties with index 0 on key: the label decides, and a sentence should say so. */
export function tiedAtFront(heap: MinHeap<PqEntry>): boolean {
  const [first, second] = heap.sorted();
  return first !== undefined && second !== undefined && first.key === second.key;
}
