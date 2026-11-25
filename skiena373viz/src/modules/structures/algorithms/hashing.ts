/** What both hash tables share: the hash arithmetic, table sizes and the operation type. */
import type { KeyedOperation } from './operations';

export type HashOpKind = 'insert' | 'search' | 'delete';
export type HashOperation = KeyedOperation<HashOpKind>;

export interface HashInput {
  /** Number of buckets or slots, a whole number from MIN_SIZE up (the views allow up to MAX_SIZE). */
  readonly size: number;
  /** Keys inserted, in this order and without being traced, before the first operation. */
  readonly start: readonly number[];
  readonly operations: readonly HashOperation[];
}

export const MIN_SIZE = 1;
export const MAX_SIZE = 13;

export const validSize = (size: number): boolean => Number.isInteger(size) && size >= MIN_SIZE;

/** The hash of a key shown as arithmetic, so students can follow negative keys too. */
export interface HashStep {
  readonly key: number;
  readonly size: number;
  /** key % size as most languages compute it: it has the sign of the key. */
  readonly remainder: number;
  /** ((key mod m) + m) mod m, always in 0..m-1. */
  readonly bucket: number;
}

export function hashStep(key: number, size: number): HashStep {
  const remainder = (key % size) + 0;
  return { key, size, remainder, bucket: (remainder + size) % size };
}

export function hashArithmetic({ key, size, remainder, bucket }: HashStep): string {
  return `((${key} mod ${size}) + ${size}) mod ${size} = (${remainder} + ${size}) mod ${size} = ${bucket}`;
}
