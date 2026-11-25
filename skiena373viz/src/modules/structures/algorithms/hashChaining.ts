/**
 * Hash table with chaining: each bucket holds a list of keys. New keys go to the end of the chain,
 * because insert has to walk the whole chain to rule out a duplicate anyway.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder, Tone } from '@core';
import { hashArithmetic, hashStep, MIN_SIZE, validSize } from './hashing';
import type { HashInput, HashOperation, HashStep } from './hashing';
import { at, describeOperation, newLog, pluralize } from './operations';
import type { OperationLog } from './operations';

export interface ChainingState {
  readonly size: number;
  /** The chain of each bucket, head first. */
  readonly buckets: readonly (readonly number[])[];
  /** Keys stored. The load factor is n / size. */
  readonly n: number;
  readonly hash: HashStep | null;
  /** Tone of highlighted buckets (key: bucket index) and chain entries (key: "bucket:position"). */
  readonly bucketMarks: Readonly<Record<string, Tone>>;
  readonly entryMarks: Readonly<Record<string, Tone>>;
  readonly log: OperationLog;
}

export interface ChainingResult {
  /** Final keys, sorted. */
  readonly keys: readonly number[];
  readonly outcomes: readonly string[];
}

const PSEUDOCODE = definePseudocode([
  ['dispatch', 0, 'for each operation (insert, search or delete) with its key'],
  ['hash', 1, 'b = ((key mod m) + m) mod m'],
  ['scan', 1, 'for each entry e of chain b, head first: compare key with e'],
  ['hit', 2, 'key = e: stop at e'],
  ['miss', 1, 'the chain has ended: the key is absent'],
  ['insert-append', 2, 'insert, key absent: append key to the end of chain b'],
  ['insert-dup', 2, 'insert, key present: change nothing'],
  ['delete-unlink', 2, 'delete, key present: unlink e from chain b'],
  ['done', 0, 'every operation has run'],
]);

const OPS = defineOps([
  { id: 'comparisons', label: 'Key comparisons', counts: 'One each time the operation key is compared with a key stored in a chain. Computing the hash and reaching the bucket are not counted.' },
]);

type T = Recorder<ChainingState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const op = (kind: HashOperation['kind'], key: number): HashOperation => ({ kind, key });

export const hashChaining = defineAlgorithm({
  id: 'structures-hash-chaining',
  title: 'Hash table with chaining',
  summary: 'Keys that hash to the same bucket share a linked list; insert, search and delete walk that list.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'expected, assuming simple uniform hashing, load factor α = n/m', bound: 'Θ(1 + α)', why: 'if every key is equally likely to land in every bucket, independently, a chain has α keys on average, and reaching the bucket costs 1.' },
    { resource: 'time', when: 'worst case', bound: 'Θ(n)', why: 'if every key hashes to one bucket, that chain holds all n keys and a search walks all of them.' },
    { resource: 'space', when: 'every case', bound: 'Θ(m + n)', why: 'm bucket heads plus one list entry per key.' },
  ],
  presets: [
    { id: 'collisions', label: 'Collisions: keys 3, 8 and 13 share a bucket (m = 5)', input: { size: 5, start: [3, 8], operations: [op('insert', 13), op('search', 8), op('insert', 4), op('search', 18)] } },
    { id: 'delete-positions', label: 'Delete the head, middle and tail of a chain', input: { size: 3, start: [3, 6, 9, 12], operations: [op('delete', 3), op('delete', 9), op('delete', 12)] } },
    { id: 'negative', label: 'Negative keys', input: { size: 5, start: [], operations: [op('insert', -7), op('insert', -2), op('insert', 3), op('search', -2), op('delete', -7)] } },
    { id: 'duplicate-missing', label: 'Duplicate insert, missing delete', input: { size: 4, start: [5, 9], operations: [op('insert', 9), op('delete', 13), op('search', 1)] } },
    { id: 'one-bucket', label: 'One bucket (m = 1): a plain linked list', input: { size: 1, start: [4, 8], operations: [op('insert', 15), op('search', 15)] } },
    { id: 'empty', label: 'Empty table', input: { size: 4, start: [], operations: [op('search', 7), op('delete', 7), op('insert', 7)] } },
  ],
  execute({ size, start, operations }: HashInput, t: T): Finished<ChainingResult> {
    const valid = validSize(size);
    const m = valid ? size : MIN_SIZE;
    const buckets: number[][] = Array.from({ length: m }, () => []);
    let hash: HashStep | null = null;
    let current: number | null = null;
    let bucketMarks: readonly (readonly [number, Tone])[] = [];
    let entryMarks: readonly (readonly [string, Tone])[] = [];
    const { texts, outcomes } = newLog(operations);
    const count = (): number => buckets.reduce((sum, chain) => sum + chain.length, 0);

    const state = (): ChainingState => ({
      size: m,
      buckets: buckets.map((chain) => [...chain]),
      n: count(),
      hash,
      bucketMarks: Object.fromEntries(bucketMarks.map(([b, tone]) => [String(b), tone])),
      entryMarks: Object.fromEntries(entryMarks),
      log: { texts, outcomes: [...outcomes], current },
    });
    const frame = (
      lines: readonly AnchorOf<typeof PSEUDOCODE>[],
      say: () => string,
      focus: { readonly buckets?: readonly (readonly [number, Tone])[]; readonly entries?: readonly (readonly [number, number, Tone])[] } = {},
    ): void => {
      bucketMarks = focus.buckets ?? [];
      entryMarks = (focus.entries ?? []).map(([b, p, tone]) => [`${b}:${p}`, tone] as const);
      t.step({ lines, say, state });
    };

    if (!valid) {
      return t.reject({
        lines: ['dispatch'],
        say: 'The table size must be a whole number of at least 1, so nothing can run.',
        state,
        result: { keys: [], outcomes: [] },
      });
    }

    const ignored: number[] = [];
    for (const key of start) {
      const chain = at(buckets, hashStep(key, m).bucket);
      if (chain.includes(key)) ignored.push(key);
      else chain.push(key);
    }
    const total = operations.length;
    const stored = count();
    t.step({
      lines: ['dispatch'],
      say: () => `The table has ${pluralize(m, 'bucket')} and ${stored === 0 ? 'starts empty' : `starts with ${pluralize(stored, 'key')}${ignored.length > 0 ? ` (duplicates ignored: ${ignored.join(', ')})` : ''}`}, and ${total === 0 ? 'there are no operations to run' : `then ${pluralize(total, 'operation')} run`}.`,
      state,
    });

    for (let i = 0; i < total; i += 1) {
      const operation = operations[i];
      if (!operation) continue;
      const { key, kind } = operation;
      current = i;
      hash = null;
      bucketMarks = [];
      entryMarks = [];
      t.step({ lines: ['dispatch'], say: () => `Operation ${i + 1} of ${total} is ${describeOperation(operation)}, and its bucket comes first.`, state });

      const step = hashStep(key, m);
      const b = step.bucket;
      const chain = at(buckets, b);
      hash = step;
      frame(['hash'], () => `Hash ${key}: ${hashArithmetic(step)}, so look in bucket ${b}.`, { buckets: [[b, 'active']] });

      let found = -1;
      if (chain.length > 0) {
        for (let p = 0; p < chain.length; p += 1) {
          const stored = at(chain, p);
          t.count('comparisons');
          t.event('compare', [`entry:${b}:${p}`], `${key} vs ${stored}`);
          const earlier = Array.from({ length: p }, (_, q) => [b, q, 'visited'] as const);
          if (stored === key) {
            found = p;
            const final = kind === 'search';
            if (final) outcomes[i] = 'found';
            frame(['scan', 'hit'], () => `${key} equals the stored key ${stored}, so the walk stops at position ${p} of the chain.`, {
              buckets: [[b, 'active']],
              entries: [...earlier, [b, p, final ? 'done' : 'target']],
            });
            break;
          }
          frame(['scan'], () => `${key} is not ${stored}${p < chain.length - 1 ? ', so move to the next entry' : ', and that was the last entry'}.`, {
            buckets: [[b, 'active']],
            entries: [...earlier, [b, p, 'compare']],
          });
        }
      }

      if (found < 0) {
        const visited = chain.map((_, q) => [b, q, 'visited'] as const);
        if (kind === 'insert') {
          frame(['miss'], () => (chain.length === 0 ? `Bucket ${b} is empty, so ${key} is absent.` : `The chain in bucket ${b} ends without a match, so ${key} is absent.`), { buckets: [[b, 'active']], entries: visited });
          chain.push(key);
          t.event('insert', [`key:${key}`]);
          outcomes[i] = chain.length > 1 ? 'inserted (collision)' : 'inserted';
          frame(['insert-append'], () => (chain.length > 1 ? `${key} collides with ${pluralize(chain.length - 1, 'key')} already in bucket ${b}, so it is appended at the end of the chain.` : `${key} becomes the first entry of bucket ${b}.`), {
            buckets: [[b, 'active']],
            entries: [[b, chain.length - 1, 'active']],
          });
        } else {
          outcomes[i] = kind === 'search' ? 'not found' : 'not found, unchanged';
          frame(['miss'], () => `${chain.length === 0 ? `Bucket ${b} is empty` : `The chain in bucket ${b} ends without a match`}, so ${key} is absent${kind === 'delete' ? ' and there is nothing to delete' : ''}.`, { buckets: [[b, 'active']], entries: visited });
        }
      } else if (kind === 'insert') {
        outcomes[i] = 'duplicate, unchanged';
        frame(['insert-dup'], () => `Insert ${key} changes nothing, because the table stores each key once.`, { buckets: [[b, 'active']], entries: [[b, found, 'target']] });
      } else if (kind === 'delete') {
        const length = chain.length;
        const where = length === 1 ? 'only entry' : found === 0 ? 'head' : found === length - 1 ? 'tail' : 'middle';
        chain.splice(found, 1);
        t.event('remove', [`key:${key}`]);
        outcomes[i] = `deleted (${where})`;
        frame(['delete-unlink'], () => `${key} is the ${where} of the chain, so it is unlinked and its neighbours are joined${chain.length === 0 ? '; bucket ' + b + ' is now empty' : ''}.`, { buckets: [[b, 'swap']] });
      }
    }

    current = null;
    hash = null;
    bucketMarks = [];
    entryMarks = [];
    const keys = buckets.flat().sort((x, y) => x - y);
    return t.finish({
      lines: ['done'],
      say: () => (total === 0 ? 'There were no operations, so the table is unchanged.' : `All ${total} operations are done, and the table holds ${pluralize(keys.length, 'key')}.`),
      state,
      result: { keys, outcomes: outcomes.map((o) => o ?? '') },
    });
  },
});
