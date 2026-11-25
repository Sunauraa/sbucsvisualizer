/**
 * Open addressing with linear probing and tombstones. A delete leaves a tombstone, which a search
 * passes over, so a key stored beyond it can still be found; only a never-used slot ends a search.
 * An insert keeps looking for a duplicate past the first tombstone, and only then reuses it.
 */
import { defineAlgorithm, defineOps, definePseudocode } from '@core';
import type { AnchorOf, Finished, OpOf, Recorder, Tone } from '@core';
import { hashArithmetic, hashStep, MIN_SIZE, validSize } from './hashing';
import type { HashInput, HashOperation, HashStep } from './hashing';
import { at, describeOperation, newLog, pluralize } from './operations';
import type { OperationLog } from './operations';

export type SlotStatus = 'empty' | 'live' | 'tombstone';

export interface ProbeSlot {
  readonly status: SlotStatus;
  /** The stored key for a live slot, otherwise null. */
  readonly key: number | null;
}

export interface ProbingState {
  readonly size: number;
  readonly slots: readonly ProbeSlot[];
  /** Slots holding a key, and slots ever used (keys plus tombstones). The two loads are live/size and used/size. */
  readonly live: number;
  readonly used: number;
  readonly hash: HashStep | null;
  /** Slots looked at by the current operation, in order. Numbered on the table. */
  readonly path: readonly number[];
  /** First tombstone seen on the path, which an insert may reuse. */
  readonly reusable: number | null;
  readonly marks: Readonly<Record<string, Tone>>;
  readonly log: OperationLog;
}

export interface ProbingResult {
  readonly keys: readonly number[];
  readonly outcomes: readonly string[];
}

const PSEUDOCODE = definePseudocode([
  ['dispatch', 0, 'for each operation (insert, search or delete) with its key'],
  ['hash', 1, 'h = ((key mod m) + m) mod m;  probe slots h, h+1, h+2, ... (mod m), at most m of them'],
  ['empty-slot', 2, 'slot never used: the key is absent; stop'],
  ['tombstone', 2, 'slot is a tombstone: remember the first one, keep going'],
  ['live-match', 2, 'slot holds the key: found; stop'],
  ['live-other', 2, 'slot holds another key: keep going'],
  ['exhausted', 1, 'm slots seen and none was empty: the key is absent'],
  ['insert-place', 2, 'insert, absent: store in the first tombstone seen, else in this empty slot'],
  ['insert-dup', 2, 'insert, present: change nothing'],
  ['insert-full', 2, 'insert, absent, no tombstone, no empty slot: the table is full, refuse'],
  ['delete-mark', 2, 'delete, found: turn the slot into a tombstone'],
  ['done', 0, 'every operation has run'],
]);

const OPS = defineOps([
  { id: 'probes', label: 'Probes', counts: 'One each time a slot is looked at. Computing the hash is not counted.' },
]);

type T = Recorder<ProbingState, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;

const op = (kind: HashOperation['kind'], key: number): HashOperation => ({ kind, key });

export const hashProbing = defineAlgorithm({
  id: 'structures-hash-probing',
  title: 'Linear probing with tombstones',
  summary: 'Keys live in the table itself; a collision moves to the next slot, and a delete leaves a tombstone.',
  pseudocode: PSEUDOCODE,
  ops: OPS,
  complexity: [
    { resource: 'time', when: 'expected, assuming uniform hashing, used load (keys plus tombstones) at most ½', bound: 'Θ(1)', why: 'an unsuccessful search expects about ½(1 + 1/(1−α)²) probes, which is 2.5 at α = ½; tombstones count toward α because they still block probing.' },
    { resource: 'time', when: 'worst case', bound: 'Θ(n)', why: 'if every key hashes to the same slot, one operation can probe all n keys, and at most m slots in any case.' },
    { resource: 'space', when: 'every case', bound: 'Θ(m)', why: 'one table of m slots, tombstones included.' },
  ],
  presets: [
    { id: 'collisions', label: 'Collisions and wrap-around (m = 5)', input: { size: 5, start: [3, 8], operations: [op('insert', 13), op('insert', 18), op('insert', 4), op('search', 23)] } },
    { id: 'tombstone-search', label: 'A tombstone, then a search that passes over it', input: { size: 7, start: [7, 14, 21], operations: [op('delete', 14), op('search', 21), op('search', 28)] } },
    { id: 'tombstone-reuse', label: 'Reuse a tombstone, but only after checking for a duplicate', input: { size: 7, start: [7, 14, 21], operations: [op('delete', 14), op('insert', 21), op('insert', 28), op('search', 28)] } },
    { id: 'full', label: 'A full table: insert refused, search for a missing key still ends', input: { size: 4, start: [1, 2, 3, 4], operations: [op('insert', 9), op('search', 10), op('delete', 3), op('insert', 9)] } },
    { id: 'tombstones-only', label: 'A table holding only tombstones', input: { size: 3, start: [1, 2, 3], operations: [op('delete', 1), op('delete', 2), op('delete', 3), op('search', 5), op('insert', 5)] } },
    { id: 'negative', label: 'Negative keys', input: { size: 5, start: [], operations: [op('insert', -7), op('insert', -2), op('search', 3), op('delete', -7)] } },
    { id: 'empty', label: 'Empty table', input: { size: 5, start: [], operations: [op('search', 7), op('delete', 7), op('insert', 7)] } },
  ],
  execute({ size, start, operations }: HashInput, t: T): Finished<ProbingResult> {
    const valid = validSize(size);
    const m = valid ? size : MIN_SIZE;
    const slots: { status: SlotStatus; key: number | null }[] = Array.from({ length: m }, () => ({ status: 'empty', key: null }));
    let hash: HashStep | null = null;
    let path: number[] = [];
    let reusable: number | null = null;
    let current: number | null = null;
    let marked: readonly (readonly [number, Tone])[] = [];
    const { texts, outcomes } = newLog(operations);
    const live = (): number => slots.filter((slot) => slot.status === 'live').length;
    const used = (): number => slots.filter((slot) => slot.status !== 'empty').length;

    const state = (): ProbingState => ({
      size: m,
      slots: slots.map((slot) => ({ status: slot.status, key: slot.key })),
      live: live(),
      used: used(),
      hash,
      path: [...path],
      reusable,
      marks: Object.fromEntries(marked.map(([slot, tone]) => [String(slot), tone])),
      log: { texts, outcomes: [...outcomes], current },
    });
    const frame = (lines: readonly AnchorOf<typeof PSEUDOCODE>[], say: () => string, focus: readonly (readonly [number, Tone])[] = []): void => {
      marked = focus;
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

    // Loading the starting keys uses the same probing rule, quietly.
    const ignored: number[] = [];
    for (const key of start) {
      const h = hashStep(key, m).bucket;
      let place = -1;
      let duplicate = false;
      for (let k = 0; k < m && !duplicate; k += 1) {
        const slot = at(slots, (h + k) % m);
        if (slot.status === 'live' && slot.key === key) duplicate = true;
        else if (slot.status === 'empty') {
          place = (h + k) % m;
          break;
        }
      }
      if (duplicate || place < 0) ignored.push(key);
      else slots[place] = { status: 'live', key };
    }
    const total = operations.length;
    const stored = live();
    t.step({
      lines: ['dispatch'],
      say: () => `The table has ${pluralize(m, 'slot')} and ${stored === 0 ? 'starts empty' : `starts with ${pluralize(stored, 'key')}${ignored.length > 0 ? ` (ignored, duplicate or no room: ${ignored.join(', ')})` : ''}`}, and ${total === 0 ? 'there are no operations to run' : `then ${pluralize(total, 'operation')} run`}.`,
      state,
    });

    for (let i = 0; i < total; i += 1) {
      const operation = operations[i];
      if (!operation) continue;
      const { key, kind } = operation;
      current = i;
      hash = null;
      path = [];
      reusable = null;
      marked = [];
      t.step({ lines: ['dispatch'], say: () => `Operation ${i + 1} of ${total} is ${describeOperation(operation)}, and its home slot comes first.`, state });

      const step = hashStep(key, m);
      const h = step.bucket;
      hash = step;
      const order = Array.from({ length: m }, (_, k) => (h + k) % m);
      frame(
        ['hash'],
        () => `Hash ${key}: ${hashArithmetic(step)}, so probing starts at slot ${h} and may visit ${order.join(', ')} in that order.`,
        [[h, 'active']],
      );

      // The probe loop. `stop` records why it ended.
      let hit = -1;
      let emptyAt = -1;
      for (let k = 0; k < m; k += 1) {
        const s = at(order, k);
        const slot = at(slots, s);
        t.count('probes');
        t.event('probe', [`slot:${s}`], slot.status);
        path.push(s);
        const seen = path.slice(0, -1).map((q) => [q, 'visited'] as const);
        if (slot.status === 'empty') {
          emptyAt = s;
          frame(
            ['empty-slot'],
            () => (kind === 'insert'
              ? `Slot ${s} has never been used, so ${key} is not further along and the search for a duplicate ends.`
              : `Slot ${s} has never been used, so ${key} cannot be further along and is absent.`),
            [...seen, [s, 'compare']],
          );
          break;
        }
        if (slot.status === 'tombstone') {
          if (reusable === null) reusable = s;
          frame(
            ['tombstone'],
            () => (kind === 'insert'
              ? `Slot ${s} is a tombstone, so ${reusable === s ? 'it is remembered as reusable, but ' : ''}probing goes on, because ${key} could still be stored further along.`
              : `Slot ${s} is a tombstone, a deleted key that still blocks the way, so probing passes over it.`),
            [...seen, [s, 'compare']],
          );
          continue;
        }
        if (slot.key === key) {
          hit = s;
          const final = kind === 'search';
          if (final) outcomes[i] = `found in slot ${s}`;
          frame(['live-match'], () => `Slot ${s} holds ${key}, so ${key} is found.`, [...seen, [s, final ? 'done' : 'target']]);
          break;
        }
        frame(['live-other'], () => `Slot ${s} holds ${slot.key}, not ${key}, so probing goes on to the next slot.`, [...seen, [s, 'compare']]);
      }

      const visited = (): (readonly [number, Tone])[] => path.map((q) => [q, 'visited'] as const);
      if (hit >= 0) {
        if (kind === 'insert') {
          outcomes[i] = 'duplicate, unchanged';
          frame(['insert-dup'], () => `Insert ${key} changes nothing, because the table stores each key once.`, [...visited().slice(0, -1), [hit, 'target']]);
        } else if (kind === 'delete') {
          at(slots, hit).status = 'tombstone';
          at(slots, hit).key = null;
          t.event('remove', [`key:${key}`]);
          outcomes[i] = `deleted, tombstone in slot ${hit}`;
          frame(['delete-mark'], () => `Slot ${hit} becomes a tombstone, not an empty slot, so later searches still pass through it.`, [...visited().slice(0, -1), [hit, 'swap']]);
        }
        continue;
      }
      if (emptyAt < 0) {
        frame(['exhausted'], () => `All ${pluralize(m, 'slot')} have been looked at and none is empty, so ${key} is absent.`, visited());
      }
      if (kind !== 'insert') {
        outcomes[i] = kind === 'search' ? 'not found' : 'not found, unchanged';
        continue;
      }
      const target = reusable ?? (emptyAt >= 0 ? emptyAt : -1);
      if (target < 0) {
        outcomes[i] = 'refused: table full';
        frame(['insert-full'], () => `The table is full: every slot holds a key, so ${key} is refused and nothing changes.`, visited());
        continue;
      }
      const reuse = at(slots, target).status === 'tombstone';
      slots[target] = { status: 'live', key };
      t.event('insert', [`key:${key}`]);
      outcomes[i] = reuse ? `inserted in slot ${target} (reused a tombstone)` : `inserted in slot ${target}`;
      frame(
        ['insert-place'],
        () => (reuse
          ? `${key} is absent, so it reuses the tombstone in slot ${target}.`
          : `${key} is absent, so it is stored in the empty slot ${target}.`),
        [...visited().filter(([q]) => q !== target), [target, 'active']],
      );
    }

    current = null;
    hash = null;
    path = [];
    reusable = null;
    marked = [];
    const keys = slots.flatMap((slot) => (slot.key === null ? [] : [slot.key])).sort((x, y) => x - y);
    return t.finish({
      lines: ['done'],
      say: () => (total === 0 ? 'There were no operations, so the table is unchanged.' : `All ${total} operations are done, and the table holds ${pluralize(keys.length, 'key')}.`),
      state,
      result: { keys, outcomes: outcomes.map((o) => o ?? '') },
    });
  },
});
