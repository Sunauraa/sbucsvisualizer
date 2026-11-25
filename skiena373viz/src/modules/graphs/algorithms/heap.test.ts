import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { MinHeap } from './heap';

const asc = (a: number, b: number): boolean => a < b;

describe('MinHeap', () => {
  it('pops in sorted order on 200 seeded random lists', () => {
    const rng = createRng(11);
    for (let round = 0; round < 200; round += 1) {
      const items = Array.from({ length: rng.int(0, 30) }, () => rng.int(-20, 20));
      const heap = new MinHeap<number>(asc);
      for (const x of items) heap.push(x);
      expect(heap.sorted()).toEqual([...items].sort((a, b) => a - b));
      const out: number[] = [];
      while (heap.size > 0) out.push(heap.pop() as number);
      expect(out).toEqual([...items].sort((a, b) => a - b));
      expect(heap.pop()).toBeUndefined();
    }
  });

  it('counts exactly the comparisons that sift-up and sift-down make (hand-worked example)', () => {
    const heap = new MinHeap<number>(asc);
    heap.push(5); // empty heap: no comparison
    expect(heap.comparisons).toBe(0);
    heap.push(3); // compared with parent 5, swaps up
    expect(heap.comparisons).toBe(1);
    heap.push(8); // compared with parent 3, stays
    expect(heap.comparisons).toBe(2);
    heap.push(1); // vs parent 5 (swap), then vs parent 3 (swap) at the root
    expect(heap.comparisons).toBe(4);
    // heap array is now [1, 3, 8, 5]; pop moves 5 to the root: children 3 and 8 (1 comparison), then 3 < 5 (1), leaf reached
    expect(heap.pop()).toBe(1);
    expect(heap.comparisons).toBe(6);
    expect(heap.peek()).toBe(3);
  });

  it('keeps sorted() free of counting and leaves the heap alone', () => {
    const heap = new MinHeap<number>(asc);
    [4, 2, 9].forEach((x) => heap.push(x));
    const before = heap.comparisons;
    heap.sorted();
    expect(heap.comparisons).toBe(before);
    expect(heap.size).toBe(3);
  });

  it('never makes more than log2(n) + 1 comparisons per push and 2 log2(n) per pop', () => {
    const rng = createRng(5);
    const heap = new MinHeap<number>(asc);
    for (let i = 0; i < 200; i += 1) {
      const before = heap.comparisons;
      heap.push(rng.int(0, 1000));
      expect(heap.comparisons - before).toBeLessThanOrEqual(Math.floor(Math.log2(heap.size)) + 1);
    }
    while (heap.size > 1) {
      const before = heap.comparisons;
      const size = heap.size;
      heap.pop();
      expect(heap.comparisons - before).toBeLessThanOrEqual(2 * Math.floor(Math.log2(size)));
    }
  });
});
