/**
 * THE CONTRACT. An algorithm is a pure function from an input to a Trace; a trace is an array of
 * self-contained frames; a renderer draws one frame. See PLAN.md, "Contract guide".
 */
import type { Pseudocode } from './pseudocode';
import type { OpCounts, OpDef } from './ops';

/** What happened during a step. Semantic, not visual: useful to tests, captions and quizzes. */
export type EventKind =
  | 'compare' | 'read' | 'write' | 'swap' | 'move'
  | 'visit' | 'discover' | 'finish'
  | 'enqueue' | 'dequeue' | 'push' | 'pop' | 'peek'
  | 'insert' | 'remove' | 'link' | 'unlink'
  | 'relax' | 'select' | 'reject' | 'union' | 'find'
  | 'call' | 'return' | 'probe' | 'assign' | 'note';

export interface TraceEvent {
  readonly kind: EventKind;
  /** Ids of the things involved, as the renderer knows them: 'node:A', 'cell:2,3', 'A[4]'. */
  readonly targets: readonly string[];
  /** Optional short detail, e.g. '7 < 9'. Leave the key out when there is none. */
  readonly detail?: string;
}

/** One moment of a run. Deep-frozen, JSON-safe, and complete: a renderer needs nothing else. */
export interface Frame<S> {
  /** Position in trace.frames. */
  readonly index: number;
  /** Pseudocode anchors lit in this frame. At least one, usually exactly one. */
  readonly lines: readonly string[];
  /** Exactly one sentence, in present tense, naming the actual values involved. */
  readonly explanation: string;
  /** Cumulative counts after this step. All zero in frame 0. */
  readonly ops: OpCounts;
  /** The whole data-structure state after this step, highlights included. */
  readonly state: S;
  /** What happened in this step. May be empty. */
  readonly events: readonly TraceEvent[];
}

/** 'rejected' means the algorithm's own check refused the input; the last frame says why. */
export type TraceStatus = 'completed' | 'rejected';

export interface Trace<S, R = unknown> {
  readonly algorithmId: string;
  readonly status: TraceStatus;
  readonly frames: readonly Frame<S>[];
  /** JSON-safe answer, so tests never have to dig it out of the last frame's state. */
  readonly result: R;
  /** Final counts. Equal to the last frame's ops. */
  readonly totals: OpCounts;
  /** True when steps were dropped to respect maxFrames. First frames and the final frame are kept. */
  readonly truncated: boolean;
  readonly droppedFrames: number;
}

export interface RunOptions {
  /**
   * 'frames' (default) records everything. 'counts' records no frames (frames is empty) and skips
   * evaluating state/explanation thunks: use it for growth plots at large n.
   */
  readonly mode?: 'frames' | 'counts';
  /** Default DEFAULT_MAX_FRAMES. At least 2. */
  readonly maxFrames?: number;
}

export const DEFAULT_MAX_FRAMES = 1500;

/** One recorded step. `say` and `state` are thunks so that 'counts' mode costs almost nothing. */
export interface StepSpec<S, A extends string> {
  readonly lines: readonly A[];
  readonly say: string | (() => string);
  readonly state: () => S;
}

/** Token returned by finish()/reject(). execute() must return it, so every path ends on purpose. */
export interface Finished<R> {
  readonly status: TraceStatus;
  readonly result: R;
}

/** Handed to execute(). Records frames; owns the counters. */
export interface Recorder<S, A extends string = string, O extends string = string> {
  /** Count work. Call it BEFORE the step that shows that work. */
  count(op: O, by?: number): void;
  /** Queue an event for the next step. */
  event(kind: EventKind, targets: readonly string[], detail?: string): void;
  /** Record a frame. `state` is copied and frozen immediately; later mutation cannot affect it. */
  step(spec: StepSpec<S, A>): void;
  /** Record the final frame and stop. Never dropped by truncation. */
  finish<R>(spec: StepSpec<S, A> & { readonly result: R }): Finished<R>;
  /** Like finish(), but the algorithm's own check refused this input. */
  reject<R>(spec: StepSpec<S, A> & { readonly result: R }): Finished<R>;
}

/** A correct, honest statement of cost. Write the case out in words. */
export interface ComplexityClaim {
  readonly resource: 'time' | 'space';
  /** 'worst case', 'best case', 'expected (random pivot)', 'every case'. */
  readonly when: string;
  /** 'Θ(n log n)', 'O(E log V)'. Θ only for a tight bound in that case; otherwise O or Ω. */
  readonly bound: string;
  /** One short sentence of justification. */
  readonly why: string;
}

/** A named input the UI offers. The first one is the default. */
export interface Preset<I> {
  readonly id: string;
  readonly label: string;
  readonly input: I;
}

export interface Algorithm<I, S, R = unknown> {
  /** Stable kebab-case id, unique across the app, prefixed by module: 'dp-edit-distance'. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly pseudocode: Pseudocode;
  readonly ops: readonly OpDef[];
  readonly complexity: readonly ComplexityClaim[];
  readonly presets: readonly Preset<I>[];
  /** Pure and deterministic. Never throws on any value of type I; never mutates its input. */
  run(input: I, options?: RunOptions): Trace<S, R>;
}
