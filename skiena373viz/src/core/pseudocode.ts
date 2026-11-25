/**
 * Pseudocode is data. Every line has a stable, unique, named anchor; frames refer to anchors and never
 * to line numbers, so inserting a line can never silently shift a highlight.
 */
export interface PseudoLine<A extends string = string> {
  readonly anchor: A;
  readonly indent: number;
  readonly text: string;
}

export interface Pseudocode<A extends string = string> {
  readonly lines: readonly PseudoLine<A>[];
}

/** The union of anchor names of a pseudocode constant: AnchorOf<typeof PSEUDO>. */
export type AnchorOf<P> = P extends Pseudocode<infer A> ? A : never;

/**
 * definePseudocode([
 *   ['signature', 0, 'search(A, x)'],
 *   ['loop',      1, 'for i = 0 to n - 1'],
 * ])
 * Anchors are literal types, so a typo in a frame is a compile error.
 */
export function definePseudocode<const A extends string>(
  rows: readonly (readonly [anchor: A, indent: number, text: string])[],
): Pseudocode<A> {
  const seen = new Set<string>();
  for (const [anchor, indent, text] of rows) {
    if (!/^[a-z][a-z0-9-]*$/.test(anchor)) throw new Error(`Anchor "${anchor}" must be kebab-case`);
    if (seen.has(anchor)) throw new Error(`Anchor "${anchor}" is used twice`);
    if (!Number.isInteger(indent) || indent < 0) throw new Error(`Bad indent on "${anchor}"`);
    if (text.trim() === '') throw new Error(`Empty pseudocode text on "${anchor}"`);
    seen.add(anchor);
  }
  return { lines: rows.map(([anchor, indent, text]) => ({ anchor, indent, text })) };
}
