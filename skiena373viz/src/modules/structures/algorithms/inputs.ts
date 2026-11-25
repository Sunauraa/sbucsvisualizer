/** Text forms of the operation lists, one per structure. The verbs are what a student types. */
import type { Result } from '@core';
import { ok } from '@core';
import type { BstOperation, BstOpKind } from './bst';
import type { HashOperation, HashOpKind } from './hashing';
import type { HeapOperation, HeapOpKind } from './heap';
import { keyed, parseOperations } from './operations';
import type { VerbSpec } from './operations';

export const BST_VERBS: readonly VerbSpec<BstOpKind>[] = [
  { verb: 'insert', takesKey: true },
  { verb: 'delete', takesKey: true },
  { verb: 'search', takesKey: true },
];

export const HEAP_VERBS: readonly VerbSpec<HeapOpKind>[] = [
  { verb: 'insert', takesKey: true },
  { verb: 'extract', takesKey: false },
  { verb: 'build', takesKey: false },
  { verb: 'rebuild', takesKey: false },
];

export const HASH_VERBS: readonly VerbSpec<HashOpKind>[] = [
  { verb: 'insert', takesKey: true },
  { verb: 'search', takesKey: true },
  { verb: 'delete', takesKey: true },
];

export function parseBstOperations(text: string): Result<BstOperation[]> {
  const parsed = parseOperations(text, BST_VERBS, { remove: 'delete', find: 'search' });
  return parsed.ok ? ok(keyed(parsed.value)) : parsed;
}

export function parseHeapOperations(text: string): Result<HeapOperation[]> {
  return parseOperations(text, HEAP_VERBS, { 'extract-min': 'extract', pop: 'extract', heapify: 'build' });
}

export function parseHashOperations(text: string): Result<HashOperation[]> {
  const parsed = parseOperations(text, HASH_VERBS, { remove: 'delete', find: 'search', lookup: 'search' });
  return parsed.ok ? ok(keyed(parsed.value)) : parsed;
}
