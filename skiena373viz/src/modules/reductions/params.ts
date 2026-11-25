/** URL parameters of the certificate views: the assignment as a bit string, the cover as a list of vertex ids. */
import type { Assignment } from './algorithms/formula';

/** `101` over [x1, x2, x3] is x1 = T, x2 = F, x3 = T. Missing or unreadable characters mean false. */
export function assignmentFromBits(variables: readonly string[], bits: string): Assignment {
  return Object.fromEntries(variables.map((variable, i) => [variable, bits.charAt(i) === '1']));
}

export const bitsFromAssignment = (variables: readonly string[], assignment: Assignment): string =>
  variables.map((variable) => (Object.hasOwn(assignment, variable) && assignment[variable] === true ? '1' : '0')).join('');

/** `x1,!x2,c1.1` becomes a list of ids. Empty items are dropped; repeats are dropped, keeping the first. */
export function coverFromParam(text: string): string[] {
  return [...new Set(text.split(',').map((id) => id.trim()).filter((id) => id !== ''))];
}

export const coverToParam = (cover: readonly string[]): string => cover.join(',');

/** Adds the id to the cover if absent, removes it if present. */
export const toggleInCover = (cover: readonly string[], id: string): string[] =>
  (cover.includes(id) ? cover.filter((other) => other !== id) : [...cover, id]);
