/**
 * Shared pieces of all four structure algorithms: the operation list as text, its limits, and the
 * per-operation log that every state carries so a renderer can show "operation 3 of 7".
 */
import { fail, ok } from '@core';
import type { Result } from '@core';

export const MAX_OPERATIONS = 24;
export const KEY_MIN = -99;
export const KEY_MAX = 999;
/** Keys already in the structure before the first operation. */
export const MAX_START_KEYS = 16;

/** One operation. `key` is null for operations that take none (extract, build). */
export interface Operation<K extends string = string> {
  readonly kind: K;
  readonly key: number | null;
}

export interface KeyedOperation<K extends string = string> {
  readonly kind: K;
  readonly key: number;
}

/** What every state records about the operation list. All plain JSON. */
export interface OperationLog {
  /** Text of each operation, such as "insert 5". */
  readonly texts: readonly string[];
  /** The outcome of each finished operation, null while it has not happened yet. */
  readonly outcomes: readonly (string | null)[];
  /** The operation being run, or null before the first and after the last. */
  readonly current: number | null;
}

export interface VerbSpec<K extends string> {
  readonly verb: K;
  readonly takesKey: boolean;
}

export function describeOperation(op: Operation): string {
  return op.key === null ? op.kind : `${op.kind} ${op.key}`;
}

export function formatOperations(ops: readonly Operation[]): string {
  return ops.map(describeOperation).join(', ');
}

export const formatKeys = (keys: readonly number[]): string => keys.join(', ');

const pluralize = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
export { pluralize };

function listVerbs(verbs: readonly { readonly verb: string }[]): string {
  const names = verbs.map((v) => v.verb);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Parses one key such as "5" or "-3"; the message names the piece that is wrong. */
export function parseKey(text: string, within = `"${text}"`): Result<number> {
  if (!/^[+-]?\d+$/.test(text)) return fail(`${within} needs a whole number, and "${text}" is not one.`);
  const value = Number(text) + 0;
  if (value < KEY_MIN || value > KEY_MAX) return fail(`${text} in ${within} is outside ${KEY_MIN} to ${KEY_MAX}.`);
  return ok(value);
}

/** '5, 3 8' becomes [5, 3, 8], within the key range and the start-list limit. */
export function parseStartKeys(text: string, maxLength = MAX_START_KEYS): Result<number[]> {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== '');
  if (parts.length > maxLength) return fail(`That is ${parts.length} starting keys; the limit here is ${maxLength}.`);
  const keys: number[] = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return fail(`Starting key "${part}" is not a whole number.`);
    const value = Number(part) + 0;
    if (value < KEY_MIN || value > KEY_MAX) return fail(`Starting key ${part} is outside ${KEY_MIN} to ${KEY_MAX}.`);
    keys.push(value);
  }
  return ok(keys);
}

/**
 * "insert 5, delete 3, search 8" becomes operations. Separators are commas, semicolons or new lines.
 * Every failure names the piece at fault: the unknown verb, the missing key, the surplus operation.
 */
export function parseOperations<K extends string>(
  text: string,
  verbs: readonly VerbSpec<K>[],
  aliases: Readonly<Record<string, K>> = {},
): Result<Operation<K>[]> {
  const pieces = text.split(/[,;\n]+/).map((piece) => piece.trim()).filter((piece) => piece !== '');
  if (pieces.length > MAX_OPERATIONS) return fail(`That is ${pieces.length} operations; the limit is ${MAX_OPERATIONS}.`);
  const operations: Operation<K>[] = [];
  for (const piece of pieces) {
    const [word = '', ...rest] = piece.split(/\s+/);
    const lower = word.toLowerCase();
    const spec = verbs.find((v) => v.verb === lower) ?? verbs.find((v) => v.verb === aliases[lower]);
    if (!spec) return fail(`Unknown operation "${word}" in "${piece}". Use ${listVerbs(verbs)}.`);
    if (!spec.takesKey) {
      if (rest.length > 0) return fail(`"${spec.verb}" takes no key, but "${piece}" has "${rest.join(' ')}".`);
      operations.push({ kind: spec.verb, key: null });
      continue;
    }
    if (rest.length === 0) return fail(`"${piece}" needs a key, such as "${spec.verb} 5".`);
    if (rest.length > 1) return fail(`"${piece}" has more than one key; write one operation per comma.`);
    const key = parseKey(rest[0] ?? '', `"${piece}"`);
    if (!key.ok) return key;
    operations.push({ kind: spec.verb, key: key.value });
  }
  return ok(operations);
}

/** Keeps only operations that carry a key; used by structures whose operations all take one. */
export function keyed<K extends string>(ops: readonly Operation<K>[]): KeyedOperation<K>[] {
  return ops.flatMap((op) => (op.key === null ? [] : [{ kind: op.kind, key: op.key }]));
}

export function newLog(operations: readonly Operation[]): { texts: string[]; outcomes: (string | null)[] } {
  return { texts: operations.map(describeOperation), outcomes: operations.map(() => null) };
}

/** `array[i]`, or a loud error: algorithms index only where they have checked. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`index ${index} is outside 0..${items.length - 1}`);
  return item;
}
