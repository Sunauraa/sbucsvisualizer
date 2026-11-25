/**
 * validateTrace: the mechanical half of the contract. Every algorithm's tests must call checkAlgorithm
 * (import from '@core/testing') on every preset and every edge case.
 */
import { deepFreeze, isDeepFrozen, jsonProblems } from './json';
import type { Algorithm, Frame, RunOptions, Trace } from './trace';

export interface ValidateOptions<S> {
  /**
   * The multiset of values that must never vanish between frames (include the ones "in transit").
   * Return the same values, in any order, for every frame.
   */
  readonly conserved?: (state: S) => readonly (string | number)[];
  /** Extra per-frame invariant. Return a problem description, or null. */
  readonly invariant?: (frame: Frame<S>, previous: Frame<S> | null) => string | null;
  readonly maxExplanationLength?: number;
}

/** One sentence: ends in . ! or ?, and has no earlier sentence end followed by a capital letter. */
export function sentenceProblem(text: string, maxLength = 260): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'explanation is empty';
  if (trimmed !== text) return 'explanation has surrounding whitespace';
  if (/[\n\r]/.test(text)) return 'explanation contains a line break';
  if (!/[.!?]["')\]]?$/.test(text)) return 'explanation must end with . ! or ?';
  if (/[.!?]["')\]]?\s+\p{Lu}/u.test(text)) return 'explanation must be exactly one sentence';
  if (/undefined|NaN|\[object |Infinity/.test(text)) return 'explanation leaks a raw value';
  if (text.length > maxLength) return `explanation is ${text.length} characters (max ${maxLength})`;
  return null;
}

/** Returns every contract violation found; an empty array means the trace is valid. */
export function validateTrace<I, S, R>(
  algorithm: Algorithm<I, S, R>,
  trace: Trace<S, R>,
  options: ValidateOptions<S> = {},
): string[] {
  const problems: string[] = [];
  const bad = (problem: string): void => {
    if (problems.length < 25) problems.push(problem);
  };
  const anchors = new Set(algorithm.pseudocode.lines.map((line) => line.anchor));
  const opIds = algorithm.ops.map((op) => op.id).sort();
  const { frames } = trace;

  if (trace.algorithmId !== algorithm.id) bad(`algorithmId is "${trace.algorithmId}", expected "${algorithm.id}"`);
  if (frames.length === 0) return [...problems, 'trace has no frames'];
  if (trace.truncated !== trace.droppedFrames > 0) bad('truncated flag disagrees with droppedFrames');
  if (!Object.isFrozen(frames)) bad('frames array is not frozen');
  jsonProblems(trace.result, 'result').forEach(bad);

  const expected = options.conserved ? sortedKey(options.conserved(first(frames).state)) : null;
  frames.forEach((frame, i) => {
    const previous = i === 0 ? null : (frames[i - 1] ?? null);
    const at = (problem: string): void => bad(`frame ${i}: ${problem}`);

    if (frame.index !== i) at(`index is ${frame.index}`);
    if (frame.lines.length === 0) at('no pseudocode line is lit');
    if (new Set(frame.lines).size !== frame.lines.length) at('a pseudocode line is listed twice');
    for (const line of frame.lines) if (!anchors.has(line)) at(`unknown anchor "${line}"`);
    const sentence = sentenceProblem(frame.explanation, options.maxExplanationLength);
    if (sentence !== null) at(sentence);

    if (JSON.stringify(Object.keys(frame.ops).sort()) !== JSON.stringify(opIds)) at('ops keys differ from the declared ops');
    for (const [op, value] of Object.entries(frame.ops)) {
      if (!Number.isInteger(value) || value < 0) at(`op "${op}" is ${value}`);
      if (previous && value < (previous.ops[op] ?? 0)) at(`op "${op}" decreased`);
      if (!previous && value !== 0) at(`op "${op}" is ${value}, but frame 0 must show the setup before any work`);
    }

    const unsafe = jsonProblems(frame, `frame ${i}`);
    unsafe.forEach(bad);
    if (unsafe.length === 0 && !sameJson(frame, JSON.parse(JSON.stringify(frame)))) at('does not survive a JSON round trip');
    if (!isDeepFrozen(frame)) at('is not deeply frozen');

    if (expected !== null && options.conserved && sortedKey(options.conserved(frame.state)) !== expected) {
      at('a value vanished or appeared (conserved values differ from frame 0)');
    }
    const custom = options.invariant?.(frame, previous) ?? null;
    if (custom !== null) at(custom);
  });

  if (!sameJson(frames[frames.length - 1]?.ops, trace.totals)) bad('totals differ from the last frame ops');
  if (trace.status === 'completed' && frames.length < 2) bad('a completed trace needs a setup frame and a final frame');
  return problems;
}

/**
 * Runs an algorithm on one input and checks everything: valid trace, deterministic, input untouched,
 * 'counts' mode agrees with 'frames' mode. Returns the trace; throws an Error listing the violations.
 */
export function checkAlgorithm<I, S, R>(
  algorithm: Algorithm<I, S, R>,
  input: I,
  options: ValidateOptions<S> & { readonly run?: RunOptions } = {},
): Trace<S, R> {
  const before = JSON.stringify(input);
  deepFreeze(input);
  const trace = algorithm.run(input, options.run);
  const problems = validateTrace(algorithm, trace, options);

  if (JSON.stringify(input) !== before) problems.push('run() mutated its input');
  if (!sameJson(trace, algorithm.run(input, options.run))) problems.push('run() is not deterministic');
  const counted = algorithm.run(input, { mode: 'counts' });
  if (!sameJson(counted.totals, trace.totals)) problems.push("'counts' mode totals differ from 'frames' mode");
  if (!sameJson(counted.result, trace.result)) problems.push("'counts' mode result differs from 'frames' mode");
  if (counted.frames.length !== 0) problems.push("'counts' mode recorded frames");

  if (problems.length > 0) {
    throw new Error(`${algorithm.id} breaks the trace contract:\n  - ${problems.join('\n  - ')}`);
  }
  return trace;
}

/** Static checks on the description itself: ids, presets, complexity wording, pseudocode coverage. */
export function describeProblems<I, S, R>(algorithm: Algorithm<I, S, R>): string[] {
  const problems: string[] = [];
  const kebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  if (!kebab.test(algorithm.id)) problems.push(`id "${algorithm.id}" is not kebab-case`);
  if (algorithm.title.trim() === '' || algorithm.summary.trim() === '') problems.push('title and summary are required');
  if (algorithm.presets.length === 0) problems.push('at least one preset is required (the first is the default)');
  if (new Set(algorithm.presets.map((p) => p.id)).size !== algorithm.presets.length) problems.push('preset ids repeat');
  if (!algorithm.complexity.some((c) => c.resource === 'time')) problems.push('a time complexity claim is required');
  for (const claim of algorithm.complexity) {
    if (!/^[OΘΩ]\(.+\)$/.test(claim.bound)) problems.push(`bound "${claim.bound}" must look like Θ(n), O(n²) or Ω(1)`);
    if (claim.when.trim() === '' || claim.why.trim() === '') problems.push('complexity claims need "when" and "why"');
  }
  return problems;
}

/** Anchors that no frame of the given traces ever lights. Use it to prove presets cover the code. */
export function unlitAnchors<I, S, R>(algorithm: Algorithm<I, S, R>, traces: readonly Trace<S, R>[]): string[] {
  const lit = new Set(traces.flatMap((trace) => trace.frames.flatMap((frame) => frame.lines)));
  return algorithm.pseudocode.lines.map((line) => line.anchor).filter((anchor) => !lit.has(anchor));
}

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('empty');
  return item;
}

function sortedKey(values: readonly (string | number)[]): string {
  return JSON.stringify(values.map((v) => `${typeof v}:${v}`).sort());
}

/** Structural equality of JSON values, independent of key order. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => Object.hasOwn(b, key)
    && sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
