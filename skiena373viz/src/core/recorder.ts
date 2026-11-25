import { snapshot } from './json';
import { OpCounter } from './ops';
import type { OpDef } from './ops';
import type { Pseudocode } from './pseudocode';
import { DEFAULT_MAX_FRAMES } from './trace';
import type {
  Algorithm, ComplexityClaim, EventKind, Finished, Frame, Preset, Recorder, RunOptions, StepSpec, Trace,
  TraceEvent, TraceStatus,
} from './trace';

class TraceRecorder<S, A extends string, O extends string> implements Recorder<S, A, O> {
  private readonly counter: OpCounter<O>;
  private readonly anchors: ReadonlySet<string>;
  private readonly frames: Frame<S>[] = [];
  private pending: TraceEvent[] = [];
  private dropped = 0;
  private done: { status: TraceStatus; result: unknown } | null = null;

  constructor(
    private readonly algorithmId: string,
    pseudocode: Pseudocode,
    ops: readonly OpDef<O>[],
    private readonly mode: 'frames' | 'counts',
    private readonly maxFrames: number,
  ) {
    this.counter = new OpCounter(ops);
    this.anchors = new Set(pseudocode.lines.map((line) => line.anchor));
  }

  count(op: O, by = 1): void {
    this.assertOpen();
    this.counter.add(op, by);
  }

  event(kind: EventKind, targets: readonly string[], detail?: string): void {
    this.assertOpen();
    if (this.mode === 'counts') return;
    this.pending.push(detail === undefined ? { kind, targets } : { kind, targets, detail });
  }

  step(spec: StepSpec<S, A>): void {
    this.assertOpen();
    if (this.mode === 'counts') return;
    // Always leave one slot for the final frame.
    if (this.frames.length >= this.maxFrames - 1) {
      this.dropped += 1;
      this.pending = [];
      return;
    }
    this.record(spec);
  }

  finish<R>(spec: StepSpec<S, A> & { readonly result: R }): Finished<R> {
    return this.close('completed', spec);
  }

  reject<R>(spec: StepSpec<S, A> & { readonly result: R }): Finished<R> {
    return this.close('rejected', spec);
  }

  toTrace<R>(returned: Finished<R>): Trace<S, R> {
    if (this.done === null || this.done !== (returned as unknown)) {
      throw new Error(`${this.algorithmId}: execute() must return t.finish(...) or t.reject(...)`);
    }
    return Object.freeze({
      algorithmId: this.algorithmId,
      status: returned.status,
      frames: Object.freeze(this.frames),
      result: returned.result,
      totals: this.counter.snapshot(),
      truncated: this.dropped > 0,
      droppedFrames: this.dropped,
    });
  }

  private close<R>(status: TraceStatus, spec: StepSpec<S, A> & { readonly result: R }): Finished<R> {
    this.assertOpen();
    if (this.mode === 'frames') this.record(spec);
    const finished: Finished<R> = Object.freeze({ status, result: snapshot(spec.result, `${this.algorithmId} result`) });
    this.done = finished;
    return finished;
  }

  private record(spec: StepSpec<S, A>): void {
    const index = this.frames.length;
    const where = `${this.algorithmId} frame ${index}`;
    for (const line of spec.lines) {
      if (!this.anchors.has(line)) throw new Error(`${where}: no pseudocode anchor "${line}"`);
    }
    const explanation = typeof spec.say === 'function' ? spec.say() : spec.say;
    this.frames.push(
      Object.freeze({
        index,
        lines: snapshot(spec.lines, `${where} lines`),
        explanation,
        ops: this.counter.snapshot(),
        state: snapshot(spec.state(), `${where} state`),
        events: snapshot(this.pending, `${where} events`),
      }),
    );
    this.pending = [];
  }

  private assertOpen(): void {
    if (this.done !== null) throw new Error(`${this.algorithmId}: recorder used after finish()/reject()`);
  }
}

/**
 * Builds an Algorithm from its description and an execute() function. Anchors and op ids are checked
 * at compile time; JSON safety and freezing are enforced at run time.
 */
export function defineAlgorithm<I, S, R, A extends string, O extends string>(spec: {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly pseudocode: Pseudocode<A>;
  readonly ops: readonly OpDef<O>[];
  readonly complexity: readonly ComplexityClaim[];
  readonly presets: readonly Preset<I>[];
  readonly execute: (input: I, t: Recorder<S, NoInfer<A>, NoInfer<O>>) => Finished<R>;
}): Algorithm<I, S, R> {
  const { execute, ...info } = spec;
  return {
    ...info,
    run(input: I, options: RunOptions = {}): Trace<S, R> {
      const maxFrames = Math.max(2, options.maxFrames ?? DEFAULT_MAX_FRAMES);
      const recorder = new TraceRecorder<S, A, O>(
        info.id, info.pseudocode, info.ops, options.mode ?? 'frames', maxFrames,
      );
      return recorder.toTrace(execute(input, recorder));
    },
  };
}
