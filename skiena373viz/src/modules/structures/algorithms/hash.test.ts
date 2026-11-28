import { describe, expect, it } from 'vitest';
import { createRng } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import type { Frame, Trace } from '@core';
import { hashChaining } from './hashChaining';
import type { ChainingResult, ChainingState } from './hashChaining';
import { hashArithmetic, hashStep } from './hashing';
import type { HashInput, HashOperation } from './hashing';
import { hashProbing } from './hashProbing';
import type { ProbingResult, ProbingState } from './hashProbing';
import { probingExperiment } from './experiments';
import { parseHashOperations } from './inputs';
import { keyChangeProblem, settledFrames } from './testHelpers';

const parse = (text: string): HashOperation[] => {
  const ops = parseHashOperations(text);
  if (!ops.ok) throw new Error(ops.message);
  return ops.value;
};

const chainKeys = (s: ChainingState): number[] => s.buckets.flat();
function chainingProblem(frame: Frame<ChainingState>, previous: Frame<ChainingState> | null): string | null {
  const s = frame.state;
  if (s.buckets.length !== s.size) return 'bucket count differs from the size';
  for (const [b, chain] of s.buckets.entries()) {
    for (const key of chain) if (hashStep(key, s.size).bucket !== b) return `key ${key} is in bucket ${b} but hashes elsewhere`;
  }
  if (s.n !== chainKeys(s).length) return 'n disagrees with the chains';
  return keyChangeProblem(chainKeys(s), previous ? chainKeys(previous.state) : null, frame.events, true);
}
const liveKeys = (s: ProbingState): number[] => s.slots.flatMap((slot) => (slot.key === null ? [] : [slot.key]));
function probingProblem(frame: Frame<ProbingState>, previous: Frame<ProbingState> | null): string | null {
  const s = frame.state;
  const m = s.size;
  if (s.slots.length !== m) return 'slot count differs from the size';
  if (s.live !== liveKeys(s).length) return 'live count disagrees with the slots';
  if (s.used !== s.slots.filter((slot) => slot.status !== 'empty').length) return 'used count disagrees with the slots';
  if (s.path.length > m) return `the probe path is ${s.path.length} long in a table of ${m}`;
  for (const slot of s.slots) {
    if ((slot.status === 'live') !== (slot.key !== null)) return 'a slot has a key without being live, or the reverse';
  }
  // Every live key is reachable: no never-used slot between its home and where it sits.
  for (const [at, slot] of s.slots.entries()) {
    if (slot.key === null) continue;
    for (let p = hashStep(slot.key, m).bucket; p !== at; p = (p + 1) % m) {
      if (s.slots[p]?.status === 'empty') return `key ${slot.key} is unreachable: slot ${p} before it is empty`;
    }
  }
  // The probe path walks home, home+1, ... without a gap.
  if (s.hash !== null) {
    s.path.forEach((slot, k) => {
      if (slot !== (s.hash!.bucket + k) % m) throw new Error(`probe ${k} is slot ${slot}, expected ${(s.hash!.bucket + k) % m}`);
    });
  }
  return keyChangeProblem(liveKeys(s), previous ? liveKeys(previous.state) : null, frame.events, true);
}

const runChain = (size: number, start: number[], text: string): Trace<ChainingState, ChainingResult> =>
  checkAlgorithm(hashChaining, { size, start, operations: parse(text) }, { invariant: chainingProblem });
const runProbe = (size: number, start: number[], text: string): Trace<ProbingState, ProbingResult> =>
  checkAlgorithm(hashProbing, { size, start, operations: parse(text) }, { invariant: probingProblem });
const last = <S, R>(trace: Trace<S, R>): S => trace.frames[trace.frames.length - 1]!.state;

describe('hash arithmetic', () => {
  it('maps negative keys into 0..m-1 with ((k mod m) + m) mod m', () => {
    expect(hashStep(-7, 5)).toEqual({ key: -7, size: 5, remainder: -2, bucket: 3 });
    expect(hashStep(-5, 5)).toEqual({ key: -5, size: 5, remainder: 0, bucket: 0 });
    expect(hashStep(12, 5).bucket).toBe(2);
    expect(hashStep(0, 7).bucket).toBe(0);
    expect(hashStep(-4, 1).bucket).toBe(0);
    expect(Object.is(hashStep(-5, 5).remainder, -0)).toBe(false);
    expect(hashArithmetic(hashStep(-7, 5))).toBe('((-7 mod 5) + 5) mod 5 = (-2 + 5) mod 5 = 3');
  });

  it('stays in range for every key and size in the interface limits', () => {
    for (let m = 1; m <= 13; m += 1) for (let k = -99; k <= 999; k += 7) {
      const { bucket } = hashStep(k, m);
      expect(bucket >= 0 && bucket < m && Number.isInteger(bucket)).toBe(true);
    }
  });
});

describe('hash table with chaining', () => {
  it('is described completely', () => {
    expect(describeProblems(hashChaining)).toEqual([]);
  });

  it.each(hashChaining.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract', (_id, input) => {
    checkAlgorithm(hashChaining, input, { invariant: chainingProblem });
  });

  it('presets light every pseudocode line', () => {
    expect(unlitAnchors(hashChaining, hashChaining.presets.map((p) => hashChaining.run(p.input)))).toEqual([]);
  });

  it('collisions share a bucket; a key joins the end of the chain after comparing with each entry', () => {
    const trace = runChain(5, [3, 8], 'insert 13, search 8, insert 4, search 18');
    expect(last(trace).buckets).toEqual([[], [], [], [3, 8, 13], [4]]);
    expect(trace.result.outcomes).toEqual(['inserted (collision)', 'found', 'inserted', 'not found']);
    // insert 13: compares with 3 and 8 (2); search 8: 3 then 8 (2); insert 4: empty bucket (0); search 18: 3, 8, 13 (3).
    expect(trace.totals['comparisons']).toBe(2 + 2 + 0 + 3);
  });

  it('m = 1: every key is in one chain, which is a plain list', () => {
    const trace = runChain(1, [4, 8], 'insert 15, search 15, delete 4');
    expect(last(trace).buckets).toEqual([[8, 15]]);
    expect(trace.totals['comparisons']).toBe(2 + 3 + 1);
  });

  it('negative keys land in the bucket the arithmetic names', () => {
    const trace = runChain(5, [], 'insert -7, insert -2, insert 3, search -2, delete -7');
    expect(trace.frames.some((f) => f.explanation.includes('((-7 mod 5) + 5) mod 5 = (-2 + 5) mod 5 = 3'))).toBe(true);
    expect(last(trace).buckets).toEqual([[], [], [], [-2, 3], []]);
  });

  it('a duplicate insert changes nothing', () => {
    const trace = runChain(4, [5, 9], 'insert 9');
    expect(trace.result.outcomes).toEqual(['duplicate, unchanged']);
    expect(last(trace).buckets).toEqual([[], [5, 9], [], []]);
  });

  it('delete of a missing key is explained and changes nothing', () => {
    const trace = runChain(4, [5, 9], 'delete 13');
    expect(trace.result.outcomes).toEqual(['not found, unchanged']);
    expect(last(trace).n).toBe(2);
    expect(trace.frames.some((f) => /nothing to delete/.test(f.explanation))).toBe(true);
  });

  it('deleting the head, the middle and the tail of a chain', () => {
    const trace = runChain(1, [1, 2, 3, 4, 5], 'delete 1, delete 3, delete 5, delete 2, delete 4');
    expect(trace.result.outcomes).toEqual(['deleted (head)', 'deleted (middle)', 'deleted (tail)', 'deleted (head)', 'deleted (only entry)']);
    expect(last(trace).buckets).toEqual([[]]);
  });

  it('searching an empty bucket takes no comparisons', () => {
    const trace = runChain(4, [], 'search 7');
    expect(trace.totals['comparisons']).toBe(0);
    expect(trace.result.outcomes).toEqual(['not found']);
  });

  it('rejects a table size below 1 by its own check', () => {
    for (const size of [0, -3, 2.5, Number.NaN]) {
      const trace = hashChaining.run({ size, start: [], operations: [] });
      expect(trace.status).toBe('rejected');
      expect(trace.frames[trace.frames.length - 1]!.explanation).toMatch(/whole number of at least 1/);
    }
  });

  it('matches a reference set on 200 seeded random sequences', () => {
    const rng = createRng(31);
    for (let round = 0; round < 200; round += 1) {
      const size = rng.int(1, 7);
      const start = Array.from({ length: rng.int(0, 6) }, () => rng.int(-12, 25));
      const operations = Array.from({ length: rng.int(1, 14) }, () => ({ kind: rng.pick(['insert', 'insert', 'search', 'delete'] as const), key: rng.int(-12, 25) }));
      const input: HashInput = { size, start, operations };
      const trace = round < 40 ? checkAlgorithm(hashChaining, input, { invariant: chainingProblem }) : hashChaining.run(input);
      const set = new Set(start);
      const expected: string[] = [];
      const after: number[][] = [[...set].sort((a, b) => a - b)];
      for (const { kind, key } of operations) {
        const present = set.has(key);
        if (kind === 'insert') expected.push(present ? 'duplicate, unchanged' : 'inserted');
        if (kind === 'search') expected.push(present ? 'found' : 'not found');
        if (kind === 'delete') expected.push(present ? 'deleted' : 'not found, unchanged');
        if (kind === 'insert') set.add(key);
        if (kind === 'delete') set.delete(key);
        after.push([...set].sort((a, b) => a - b));
      }
      expect(trace.result.outcomes.map((o) => o.replace(/ \(.*\)$/, ''))).toEqual(expected);
      expect(trace.result.keys).toEqual(after[after.length - 1]);
      settledFrames(trace.frames).forEach((frame, i) => expect([...chainKeys(frame.state)].sort((a, b) => a - b)).toEqual(after[i]));
    }
  });
});

describe('hash table with linear probing and tombstones', () => {
  it('is described completely', () => {
    expect(describeProblems(hashProbing)).toEqual([]);
  });

  it.each(hashProbing.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract', (_id, input) => {
    checkAlgorithm(hashProbing, input, { invariant: probingProblem });
  });

  it('presets light every pseudocode line', () => {
    expect(unlitAnchors(hashProbing, hashProbing.presets.map((p) => hashProbing.run(p.input)))).toEqual([]);
  });

  const keysAt = (s: ProbingState): (number | string | null)[] => s.slots.map((slot) => (slot.status === 'tombstone' ? 'T' : slot.key));

  it('collisions move to the next slot, and the probe path wraps around the end', () => {
    const trace = runProbe(5, [3, 8], 'insert 13, insert 18, insert 4');
    // 3 -> slot 3; 8 collides -> 4; 13 collides at 3, 4 and wraps to 0; 18 -> 3, 4, 0, 1; 4 -> 4, 0, 1, 2.
    expect(keysAt(last(trace))).toEqual([13, 18, 4, 3, 8]);
    expect(trace.result.outcomes[0]).toBe('inserted in slot 0');
    expect(trace.result.outcomes[1]).toBe('inserted in slot 1');
    expect(trace.result.outcomes[2]).toBe('inserted in slot 2');
    const wrap = trace.frames.find((f) => f.state.path.join() === '3,4,0');
    expect(wrap).toBeDefined();
    expect(trace.totals['probes']).toBe(3 + 4 + 4);
  });

  it('m = 1: one slot, a second key is refused, the table stays consistent', () => {
    const trace = runProbe(1, [], 'insert 4, insert 9, search 9, delete 4, insert 9');
    expect(trace.result.outcomes).toEqual(['inserted in slot 0', 'refused: table full', 'not found', 'deleted, tombstone in slot 0', 'inserted in slot 0 (reused a tombstone)']);
  });

  it('negative keys', () => {
    const trace = runProbe(5, [], 'insert -7, insert -2, search 3, delete -7');
    expect(last(trace).slots[3]?.status).toBe('tombstone');
    expect(last(trace).slots[4]?.key).toBe(-2);
    expect(trace.frames.some((f) => f.explanation.includes('(-2 + 5) mod 5 = 3'))).toBe(true);
  });

  it('a duplicate insert changes nothing', () => {
    const trace = runProbe(5, [2, 7], 'insert 7');
    expect(trace.result.outcomes).toEqual(['duplicate, unchanged']);
    expect(trace.result.keys).toEqual([2, 7]);
  });

  it('delete of a missing key is explained and changes nothing', () => {
    const trace = runProbe(5, [2], 'delete 9');
    expect(trace.result.outcomes).toEqual(['not found, unchanged']);
    expect(trace.frames.some((f) => /never been used/.test(f.explanation))).toBe(true);
    expect(last(trace).live).toBe(1);
  });

  it('insert into a full table is explained, changes nothing, and stops after m probes', () => {
    const trace = runProbe(4, [1, 2, 3, 4], 'insert 9');
    expect(trace.result.outcomes).toEqual(['refused: table full']);
    expect(trace.totals['probes']).toBe(4);
    expect(trace.result.keys).toEqual([1, 2, 3, 4]);
    expect(trace.frames.some((f) => /table is full/.test(f.explanation))).toBe(true);
  });

  it('search in a full table for a missing key terminates after m probes', () => {
    const trace = runProbe(4, [1, 2, 3, 4], 'search 9, delete 10');
    expect(trace.result.outcomes).toEqual(['not found', 'not found, unchanged']);
    expect(trace.totals['probes']).toBe(8);
  });

  it('a tombstone is passed over by a search, which still finds the key beyond it', () => {
    const trace = runProbe(7, [7, 14, 21], 'delete 14, search 21, search 28');
    expect(trace.result.outcomes).toEqual(['deleted, tombstone in slot 1', 'found in slot 2', 'not found']);
    // delete 14: slots 0, 1 (2 probes); search 21: slots 0, 1 (tombstone), 2 (3 probes); search 28: 0, 1, 2, 3 (empty) (4 probes).
    expect(trace.totals['probes']).toBe(2 + 3 + 4);
    expect(trace.frames.some((f) => /tombstone, a deleted key that still blocks the way/.test(f.explanation))).toBe(true);
  });

  it('a search stops at a never-used slot, not at a tombstone', () => {
    const trace = runProbe(7, [7, 14], 'delete 7, search 28');
    // slot 0 tombstone, slot 1 holds 14, slot 2 empty: the search for 28 probes 0, 1, 2 and stops.
    expect(trace.totals['probes']).toBe(1 + 3);
  });

  it('an insert reuses the first tombstone, after looking for a duplicate to the end of the run', () => {
    const trace = runProbe(7, [7, 14, 21], 'delete 14, insert 28, search 28');
    expect(trace.result.outcomes[1]).toBe('inserted in slot 1 (reused a tombstone)');
    expect(keysAt(last(trace))).toEqual([7, 28, 21, null, null, null, null]);
    // insert 28 probed slots 0, 1, 2 and 3 (the empty slot that ends the duplicate search).
    expect(trace.totals['probes']).toBe(2 + 4 + 2);
  });

  it('no duplicate is created past a tombstone', () => {
    const trace = runProbe(7, [7, 14, 21], 'delete 14, insert 21');
    expect(trace.result.outcomes[1]).toBe('duplicate, unchanged');
    expect(trace.result.keys).toEqual([7, 21]);
    expect(keysAt(last(trace))).toEqual([7, 'T', 21, null, null, null, null]);
  });

  it('a table holding only tombstones: search ends after m probes and insert reuses the first tombstone on its path', () => {
    const trace = runProbe(3, [1, 2, 3], 'delete 1, delete 2, delete 3, search 5, insert 5');
    expect(trace.result.outcomes.slice(3)).toEqual(['not found', 'inserted in slot 2 (reused a tombstone)']);
    expect(last(trace).live).toBe(1);
    expect(last(trace).used).toBe(3);
  });

  it('live load and used load differ once tombstones exist', () => {
    const trace = runProbe(10, [1, 2, 3, 4], 'delete 2, delete 3');
    expect([last(trace).live, last(trace).used]).toEqual([2, 4]);
  });

  it('rejects a table size below 1 by its own check', () => {
    const trace = hashProbing.run({ size: 0, start: [], operations: [] });
    expect(trace.status).toBe('rejected');
  });

  it('matches a reference set on 200 seeded random sequences, tombstones and full tables included', () => {
    const rng = createRng(2027);
    for (let round = 0; round < 200; round += 1) {
      const size = rng.int(1, 8);
      const start = Array.from({ length: rng.int(0, 5) }, () => rng.int(-10, 25));
      const operations = Array.from({ length: rng.int(1, 20) }, () => ({ kind: rng.pick(['insert', 'insert', 'search', 'delete'] as const), key: rng.int(-10, 25) }));
      const input: HashInput = { size, start, operations };
      const trace = round < 60 ? checkAlgorithm(hashProbing, input, { invariant: probingProblem }) : hashProbing.run(input);
      // The starting keys are loaded by the same rule, so a start list that does not fit loses its tail.
      const set = new Set<number>();
      for (const key of start) if (set.size < size) set.add(key);
      const expected: string[] = [];
      const after: number[][] = [[...set].sort((a, b) => a - b)];
      for (const { kind, key } of operations) {
        const present = set.has(key);
        if (kind === 'insert') {
          expected.push(present ? 'duplicate, unchanged' : set.size >= size ? 'refused: table full' : 'inserted');
          if (!present && set.size < size) set.add(key);
        } else if (kind === 'search') expected.push(present ? 'found' : 'not found');
        else {
          expected.push(present ? 'deleted' : 'not found, unchanged');
          set.delete(key);
        }
        after.push([...set].sort((a, b) => a - b));
      }
      expect(trace.result.outcomes.map((o) => o.replace(/, tombstone in slot \d+$/, '').replace(/ in slot \d+.*$/, ''))).toEqual(expected);
      expect(trace.result.keys).toEqual(after[after.length - 1]);
      settledFrames(trace.frames).forEach((frame, i) => expect([...liveKeys(frame.state)].sort((a, b) => a - b)).toEqual(after[i]));
      // A search for a missing key never probes more than m slots.
      const maxProbes = operations.length * size;
      expect(trace.totals['probes']!).toBeLessThanOrEqual(maxProbes);
    }
  });

  it('stays within the frame cap at the interface limits', () => {
    const operations = Array.from({ length: 24 }, (_, i) => ({ kind: i % 2 === 0 ? 'insert' : 'delete', key: i * 13 }) as const);
    expect(hashProbing.run({ size: 13, start: [0, 13, 26, 39, 52, 65, 78, 91, 104, 117, 130, 143], operations }).truncated).toBe(false);
  });
});

describe('linear probing: the expected-time claim names the right assumption (R6)', () => {
  const claim = hashProbing.complexity.find((c) => c.resource === 'time' && c.when.startsWith('expected'));
  it("states that each key's home slot is uniformly random and independent, with load at most ½, and not \"uniform hashing\"", () => {
    expect(claim?.when).toBe("expected, assuming each key's home slot is uniformly random and independent (linear probing), used load at most ½");
    expect(claim?.when).not.toMatch(/uniform hashing/);
    expect(claim?.why).toContain('½(1 + 1/(1−α)²)');
  });
  it('the growth experiment does not say "uniform hashing" for probing either; chaining keeps the textbook "simple uniform hashing"', () => {
    for (const c of probingExperiment.cases) expect(c.claim.when).not.toMatch(/uniform hashing/);
    expect(hashChaining.complexity.some((c) => /simple uniform hashing/.test(c.when))).toBe(true);
  });
});
