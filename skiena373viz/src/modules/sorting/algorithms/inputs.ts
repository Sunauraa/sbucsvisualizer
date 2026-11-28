/** Input generators and parsing for the sorting views. Pure and seeded. */
import { createRng, ok, parseIntList } from '@core';
import type { Result } from '@core';
import { PIVOT_RULES } from './common';
import type { PivotRule } from './common';

/** Sorting views accept at most this many items, so that no trace is ever truncated. */
export const MAX_ITEMS = 24;

export type InputKind = 'random' | 'sorted' | 'reversed' | 'few' | 'equal' | 'nearly';

export const INPUT_KINDS: readonly { readonly id: InputKind; readonly label: string }[] = [
  { id: 'random', label: 'Random (seeded)' },
  { id: 'sorted', label: 'Already sorted' },
  { id: 'reversed', label: 'Reversed' },
  { id: 'few', label: 'Few distinct keys' },
  { id: 'equal', label: 'All equal' },
  { id: 'nearly', label: 'Nearly sorted' },
];

export const isInputKind = (text: string | undefined): text is InputKind => INPUT_KINDS.some((kind) => kind.id === text);

/** n keys of the given shape. The same (kind, n, seed) always gives the same list. */
export function generateKeys(kind: InputKind, n: number, seed: number): number[] {
  const rng = createRng(seed);
  const size = Math.max(0, Math.floor(n));
  const ascending = Array.from({ length: size }, (_, i) => i + 1);
  switch (kind) {
    case 'random':
      return Array.from({ length: size }, () => rng.int(1, 99));
    case 'sorted':
      return ascending;
    case 'reversed':
      return [...ascending].reverse();
    case 'few':
      return Array.from({ length: size }, () => rng.pick([3, 6, 9]));
    case 'equal':
      return Array.from({ length: size }, () => 7);
    case 'nearly': {
      const keys = [...ascending];
      for (let swaps = Math.max(1, Math.floor(size / 8)); swaps > 0 && size > 1; swaps -= 1) {
        const at = rng.int(0, size - 2);
        [keys[at], keys[at + 1]] = [keys[at + 1] as number, keys[at] as number];
      }
      return keys;
    }
  }
}

export function parseSortItems(text: string): Result<number[]> {
  return parseIntList(text, { maxLength: MAX_ITEMS });
}

export const isPivotRule = (text: string | undefined): text is PivotRule => PIVOT_RULES.some((rule) => rule === text);

/** Clamp a user-typed size to 0..MAX_ITEMS. */
export const sizeFrom = (text: string | undefined, fallback: number): number => {
  const value = Number(text);
  return text !== undefined && Number.isInteger(value) ? Math.min(MAX_ITEMS, Math.max(0, value)) : fallback;
};

/** The seed as a whole number from the URL. */
export const seedFrom = (text: string | undefined, fallback = 373): number => {
  const value = Number(text);
  return text !== undefined && Number.isInteger(value) && value >= 0 && value < 1e9 ? value : fallback;
};

export const noItems: Result<number[]> = ok([]);
