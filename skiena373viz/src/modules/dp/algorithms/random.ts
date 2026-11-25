/** "New random input": a related pair, so the table has something to say. Seeded, so the URL can carry it. */
import { createRng } from '@core';
import { MAX_CHARS } from './editDistance';
import type { EditInput } from './editDistance';

const LETTERS = 'abcdeo';

export function randomPair(seed: number): EditInput {
  const rng = createRng(seed);
  const length = rng.int(4, 8);
  const pattern = Array.from({ length }, () => LETTERS.charAt(rng.int(0, LETTERS.length - 1)));
  // The text is the pattern after a few random edits, so the two strings share structure.
  const text = [...pattern];
  for (let edits = rng.int(2, 4); edits > 0; edits -= 1) {
    const kind = rng.int(0, 2);
    const at = rng.int(0, Math.max(0, text.length - 1));
    if (kind === 0 && text.length > 0) text[at] = LETTERS.charAt(rng.int(0, LETTERS.length - 1));
    else if (kind === 1 && text.length < MAX_CHARS) text.splice(at, 0, LETTERS.charAt(rng.int(0, LETTERS.length - 1)));
    else if (text.length > 1) text.splice(at, 1);
  }
  return { pattern: pattern.join(''), text: text.join('') };
}
