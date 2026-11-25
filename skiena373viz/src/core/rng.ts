/** Seeded pseudo-random numbers (mulberry32). Math.random is banned in the pure zone. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [low, high], both inclusive. */
  int(low: number, high: number): number;
  /** A uniformly chosen item. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1));
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() from an empty array');
      return items[int(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
  };
}
