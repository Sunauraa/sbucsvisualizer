/** The standard page for one algorithm: inputs, stage, player, sentence, pseudocode, counts. */
import type { ComponentType, ReactNode } from 'react';
import { frameAt } from '@core';
import type { Algorithm, Frame, Trace } from '@core';
import { Notice } from './Field';
import { Caption, ComplexityPanel, OpsPanel, PseudocodePanel } from './panels';
import { PlayerControls } from './PlayerControls';
import { usePlayer, usePlayerKeys } from './usePlayer';
import type { Player } from './usePlayer';

/** THE RENDERER INTERFACE. A renderer is a pure component of one frame. */
export interface RendererProps<S, R = unknown> {
  readonly frame: Frame<S>;
  /** The frame before, for describing a change. Null on frame 0. Never required to draw. */
  readonly previous: Frame<S> | null;
  /** For trace-wide constants such as a fixed viewBox. Do not look ahead at later frames' answers. */
  readonly trace: Trace<S, R>;
}

export type FrameRenderer<S, R = unknown> = ComponentType<RendererProps<S, R>>;

export interface WorkbenchContext<S> {
  readonly player: Player;
  readonly frame: Frame<S>;
}

export interface WorkbenchProps<I, S, R> {
  readonly algorithm: Algorithm<I, S, R>;
  /** Memoise it: a new object restarts the player. */
  readonly trace: Trace<S, R>;
  readonly Renderer: FrameRenderer<S, R>;
  /** Input controls, above the stage. */
  readonly inputs?: ReactNode;
  /** Key, under the stage. */
  readonly legend?: ReactNode;
  /** Quiz gate. See usePlayer. */
  readonly gated?: (index: number) => boolean;
  /** Extra panel beside the stage that needs the player or frame: quiz, queue contents, recursion tree. */
  readonly aside?: (context: WorkbenchContext<S>) => ReactNode;
  /** Full-width content under everything: growth panel, notes. */
  readonly children?: ReactNode;
}

export function Workbench<I, S, R>({
  algorithm, trace, Renderer, inputs, legend, gated, aside, children,
}: WorkbenchProps<I, S, R>) {
  const player = usePlayer({ frameCount: trace.frames.length, source: trace, ...(gated ? { gated } : {}) });
  usePlayerKeys(player);
  const frame = frameAt(trace.frames, player.index);
  const previous = player.index > 0 ? frameAt(trace.frames, player.index - 1) : null;
  return (
    <div className="workbench">
      {inputs ? <section className="workbench-inputs" aria-label="Input">{inputs}</section> : null}
      <div className="workbench-grid">
        <div className="workbench-main">
          <section className="stage" aria-label={`${algorithm.title}: current step`}>
            <Renderer frame={frame} previous={previous} trace={trace} />
          </section>
          <PlayerControls player={player} />
          <Caption text={frame.explanation} playing={player.playing} />
          <TraceNotices trace={trace} atEnd={player.atEnd} />
          {legend}
        </div>
        <div className="workbench-side">
          {aside ? aside({ player, frame }) : null}
          <PseudocodePanel pseudocode={algorithm.pseudocode} lit={frame.lines} />
          <OpsPanel ops={algorithm.ops} counts={frame.ops} />
          <ComplexityPanel claims={algorithm.complexity} />
        </div>
      </div>
      {children}
    </div>
  );
}

/** Truncation and rejection messages. The rejection notice points at the caption; it does not repeat it. Use it in custom layouts too (race, side-by-side). */
export function TraceNotices<S, R>({ trace, atEnd }: { readonly trace: Trace<S, R>; readonly atEnd: boolean }) {
  return (
    <>
      {trace.truncated ? (
        <Notice tone="warning">
          This run is long, so {trace.droppedFrames} steps just before the last one are not shown. The final step and the final counts are exact.
        </Notice>
      ) : null}
      {/* The caption already shows the refusal sentence on the last frame; repeating it would be announced twice. */}
      {trace.status === 'rejected' && atEnd ? <Notice tone="warning">This input was refused; the step above says why.</Notice> : null}
    </>
  );
}
