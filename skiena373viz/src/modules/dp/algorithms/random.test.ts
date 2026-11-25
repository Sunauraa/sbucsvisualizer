import { describe, expect, it } from 'vitest';
import { codePoints, MAX_CHARS, parseEditInput } from './editDistance';
import { randomPair } from './random';

describe('randomPair', () => {
  it('is seeded: the same seed gives the same pair, different seeds mostly differ', () => {
    expect(randomPair(7)).toEqual(randomPair(7));
    const pairs = new Set(Array.from({ length: 30 }, (_x, k) => JSON.stringify(randomPair(k + 1))));
    expect(pairs.size).toBeGreaterThan(20);
  });

  it('always fits the UI limit and is never both empty, over 300 seeds', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const pair = randomPair(seed);
      expect(parseEditInput(pair.pattern, pair.text).ok, `seed ${seed}`).toBe(true);
      expect(codePoints(pair.pattern).length).toBeLessThanOrEqual(MAX_CHARS);
      expect(codePoints(pair.text).length).toBeLessThanOrEqual(MAX_CHARS);
      expect(pair.pattern.length + pair.text.length).toBeGreaterThan(0);
    }
  });
});
