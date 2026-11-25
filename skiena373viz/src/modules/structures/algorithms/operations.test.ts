import { describe, expect, it } from 'vitest';
import { parseBstOperations, parseHashOperations, parseHeapOperations } from './inputs';
import { formatOperations, MAX_OPERATIONS, parseStartKeys } from './operations';
import { randomBst, randomHash, randomHeap } from './random';
import { experimentProblems, measureAt } from '@core';
import { bstExperiment, chainingExperiment, experiments, heapExperiment, probingExperiment } from './experiments';

const message = (result: { ok: boolean; message?: string }): string => (result.ok ? '' : (result.message ?? ''));

describe('operation parsing', () => {
  it('reads a list of operations separated by commas, semicolons or new lines', () => {
    const parsed = parseBstOperations('insert 5, delete 3; search 8\ninsert -2,');
    expect(parsed).toEqual({ ok: true, value: [
      { kind: 'insert', key: 5 }, { kind: 'delete', key: 3 }, { kind: 'search', key: 8 }, { kind: 'insert', key: -2 },
    ] });
  });

  it('accepts an empty list and round-trips through formatOperations', () => {
    expect(parseBstOperations('  ')).toEqual({ ok: true, value: [] });
    const text = 'insert 5, delete 3, search 8';
    const parsed = parseBstOperations(text);
    expect(parsed.ok && formatOperations(parsed.value)).toBe(text);
  });

  it('names an unknown verb and lists the real ones', () => {
    expect(message(parseBstOperations('insert 5, frobnicate 3'))).toBe('Unknown operation "frobnicate" in "frobnicate 3". Use insert, delete or search.');
    expect(message(parseHeapOperations('peek'))).toBe('Unknown operation "peek" in "peek". Use insert, extract, build or rebuild.');
  });

  it('names an operation that is missing its key', () => {
    expect(message(parseBstOperations('insert 5, delete'))).toBe('"delete" needs a key, such as "delete 5".');
    expect(message(parseHashOperations('search'))).toBe('"search" needs a key, such as "search 5".');
  });

  it('names a key that is not a whole number or is out of range', () => {
    expect(message(parseBstOperations('insert x'))).toBe('"insert x" needs a whole number, and "x" is not one.');
    expect(message(parseBstOperations('insert 2.5'))).toContain('"2.5" is not one');
    expect(message(parseBstOperations('insert 1000'))).toBe('1000 in "insert 1000" is outside -99 to 999.');
    expect(message(parseBstOperations('insert -100'))).toBe('-100 in "insert -100" is outside -99 to 999.');
    expect(parseBstOperations('insert 999, insert -99').ok).toBe(true);
  });

  it('names an operation with a surplus key, and a keyless operation given one', () => {
    expect(message(parseBstOperations('insert 5 6'))).toContain('"insert 5 6" has more than one key');
    expect(message(parseHeapOperations('extract 3'))).toBe('"extract" takes no key, but "extract 3" has "3".');
  });

  it('rejects more than 24 operations and accepts exactly 24', () => {
    const many = (n: number): string => Array.from({ length: n }, (_, i) => `insert ${i}`).join(', ');
    expect(parseBstOperations(many(MAX_OPERATIONS)).ok).toBe(true);
    expect(message(parseBstOperations(many(MAX_OPERATIONS + 1)))).toBe('That is 25 operations; the limit is 24.');
  });

  it('accepts friendly aliases and any letter case', () => {
    expect(parseBstOperations('INSERT 3, remove 3, find 3')).toEqual({ ok: true, value: [
      { kind: 'insert', key: 3 }, { kind: 'delete', key: 3 }, { kind: 'search', key: 3 },
    ] });
    expect(parseHeapOperations('extract-min, heapify')).toEqual({ ok: true, value: [{ kind: 'extract', key: null }, { kind: 'build', key: null }] });
  });

  it('never turns "-0" into a negative zero', () => {
    const parsed = parseBstOperations('insert -0');
    expect(parsed.ok && Object.is(parsed.value[0]?.key, -0)).toBe(false);
  });

  it('reads starting keys and names the piece that is wrong', () => {
    expect(parseStartKeys('5, 3 8')).toEqual({ ok: true, value: [5, 3, 8] });
    expect(parseStartKeys('')).toEqual({ ok: true, value: [] });
    expect(message(parseStartKeys('5, five'))).toBe('Starting key "five" is not a whole number.');
    expect(message(parseStartKeys('5, 5000'))).toBe('Starting key 5000 is outside -99 to 999.');
    expect(message(parseStartKeys(Array.from({ length: 17 }, (_, i) => i).join(',')))).toBe('That is 17 starting keys; the limit here is 16.');
  });
});

describe('random inputs', () => {
  it('are deterministic in the seed, valid, and within the limits', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const make of [randomBst, randomHeap, randomHash]) {
        const a = make(seed);
        expect(make(seed)).toEqual(a);
        expect(parseStartKeys(a.start).ok).toBe(true);
      }
      expect(parseBstOperations(randomBst(seed).operations).ok).toBe(true);
      expect(parseHeapOperations(randomHeap(seed).operations).ok).toBe(true);
      const hash = randomHash(seed);
      expect(parseHashOperations(hash.operations).ok).toBe(true);
      expect(hash.size).toBeGreaterThanOrEqual(1);
      expect(hash.size).toBeLessThanOrEqual(13);
    }
    expect(randomBst(1)).not.toEqual(randomBst(2));
  });
});

describe('growth experiments', () => {
  it('are well formed and quick', () => {
    for (const experiment of experiments) expect(experimentProblems(experiment)).toEqual([]);
    const started = Date.now();
    for (const experiment of experiments) {
      for (const c of experiment.cases) for (const n of experiment.sizes) measureAt(experiment, c.id, n, 1);
    }
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('match the arithmetic of the theory', () => {
    // Sorted inserts: n(n-1)/2 comparisons exactly.
    expect(measureAt(bstExperiment, 'sorted', 64, 1)['comparisons']).toBe((64 * 63) / 2);
    // Random inserts stay well below n^2 / 2.
    expect(measureAt(bstExperiment, 'random', 256, 1)['comparisons']!).toBeLessThan(256 * 40);
    // Building within 2n; repeated insertion on decreasing keys costs more.
    expect(measureAt(heapExperiment, 'build-reversed', 256, 1)['comparisons']!).toBeLessThanOrEqual(512);
    expect(measureAt(heapExperiment, 'insert-reversed', 256, 1)['comparisons']!).toBeGreaterThan(1000);
    // One shared home: the i-th insert looks at i-1 chain entries, or i slots.
    expect(measureAt(chainingExperiment, 'same-home', 64, 1)['comparisons']).toBe((64 * 63) / 2);
    expect(measureAt(probingExperiment, 'same-home', 64, 1)['probes']).toBe((64 * 65) / 2);
    // At load factor 1/2 the random cases stay linear.
    expect(measureAt(probingExperiment, 'random', 256, 1)['probes']!).toBeLessThan(256 * 4);
    expect(measureAt(chainingExperiment, 'random', 256, 1)['comparisons']!).toBeLessThan(256 * 2);
  });
});
