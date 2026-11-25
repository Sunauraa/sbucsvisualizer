/** A small binary min-heap that counts its own key comparisons. Pure: no clocks, no DOM. */

export class MinHeap<T> {
  private items: T[] = [];
  /** Total comparisons made by push and pop since construction. */
  comparisons = 0;

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  /** Append, then swap upward while the new item is smaller than its parent: one comparison per level. */
  push(item: T): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const parent = this.items[p] as T;
      if (!this.less(item, parent)) break;
      this.items[i] = parent;
      i = p;
    }
    this.items[i] = item;
  }

  /**
   * Remove the smallest. The last item moves to the root and sinks: at each level one comparison picks the
   * smaller child (when there are two) and one compares that child with the sinking item.
   */
  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (last === undefined || this.items.length === 0) return top;
    const n = this.items.length;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      let c = l;
      if (l + 1 < n && this.less(this.items[l + 1] as T, this.items[l] as T)) c = l + 1;
      const child = this.items[c] as T;
      if (!this.less(child, last)) break;
      this.items[i] = child;
      i = c;
    }
    this.items[i] = last;
    return top;
  }

  /** Contents in pop order, for display. Does not count comparisons and does not change the heap. */
  sorted(): T[] {
    return [...this.items].sort((a, b) => (this.before(a, b) ? -1 : this.before(b, a) ? 1 : 0));
  }

  private less(a: T, b: T): boolean {
    this.comparisons += 1;
    return this.before(a, b);
  }
}

/** One priority-queue entry of Prim's and Dijkstra's lazy-deletion queues. */
export interface PqEntry {
  readonly key: number;
  readonly vertex: string;
  /** The vertex this entry was reached from, or null for the start. */
  readonly via: string | null;
  /** The edge it was reached along, or null for the start. */
  readonly edge: string | null;
}

/** The queue order: key, then vertex label, then label of the vertex it came via. A total order. */
export function entryBefore(label: (id: string) => string, compare: (a: string, b: string) => number) {
  return (a: PqEntry, b: PqEntry): boolean => {
    if (a.key !== b.key) return a.key < b.key;
    const byVertex = compare(label(a.vertex), label(b.vertex));
    if (byVertex !== 0) return byVertex < 0;
    return compare(a.via === null ? '' : label(a.via), b.via === null ? '' : label(b.via)) < 0;
  };
}
