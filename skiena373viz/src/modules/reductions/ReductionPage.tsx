/** The page around a trace: inputs, the side-by-side stage, player, sentence, then notes beside the pseudocode. */
import type { ReactNode } from 'react';
import { frameAt } from '@core';
import type { Algorithm, Frame, Trace } from '@core';
import {
  Caption, ComplexityPanel, Legend, OpsPanel, PlayerControls, PseudocodePanel, TraceNotices, usePlayer, usePlayerKeys,
} from '@ui';
import type { Player } from '@ui';
import { linkedFor, ReductionStage, useSubjectLink } from './ReductionStage';
import type { StageData } from './stages';
import css from './reductions.module.css';

/** Tones that can appear, and what each means on these two pictures. */
export type LegendProps = Parameters<typeof Legend>[0];

export interface ReductionPageProps<I, S, R> {
  readonly algorithm: Algorithm<I, S, R>;
  /** Memoise it: a new trace restarts the player. */
  readonly trace: Trace<S, R>;
  readonly stageOf: (state: S) => StageData;
  readonly inputs?: ReactNode;
  readonly legend: LegendProps;
  /** One line under the legend about shapes and line styles. */
  readonly legendNote?: ReactNode;
  readonly graphTitle: string;
  readonly onToggleVertex?: (id: string) => void;
  /** Panels in the left column under the stage, given the current frame. */
  readonly notes?: (context: { readonly frame: Frame<S>; readonly player: Player; readonly words: ReactNode }) => ReactNode;
  readonly children?: ReactNode;
}

export function ReductionPage<I, S, R>({ algorithm, trace, stageOf, inputs, legend, legendNote, graphTitle, onToggleVertex, notes, children }: ReductionPageProps<I, S, R>) {
  const player = usePlayer({ frameCount: trace.frames.length, source: trace });
  usePlayerKeys(player);
  const link = useSubjectLink();
  const frame = frameAt(trace.frames, player.index);
  const data = stageOf(frame.state);
  const linked = linkedFor(data, link.active);
  const words = (
    <section className="panel" aria-label="What stands for what">
      <h3>What stands for what</h3>
      <p className={css['words']} aria-live="polite">
        {linked?.words ?? 'Point at, focus or click a clause, a literal, a variable, a vertex or an edge: its counterpart on the other side gets a dashed outline, and the correspondence is written here.'}
      </p>
      {link.selected ? <button type="button" onClick={link.clear}>Clear selection</button> : null}
    </section>
  );
  return (
    <div className={css['page']}>
      {inputs ? <section className="workbench-inputs" aria-label="Input">{inputs}</section> : null}
      <section className="stage" aria-label={`${algorithm.title}: current step`}>
        <ReductionStage data={data} linked={linked} interaction={link.interaction} graphTitle={graphTitle}
          {...(onToggleVertex ? { onToggleVertex } : {})} />
      </section>
      <PlayerControls player={player} />
      <Caption text={frame.explanation} playing={player.playing} />
      <TraceNotices trace={trace} atEnd={player.atEnd} />
      <Legend {...legend} />
      {legendNote ? <p className="muted small">{legendNote}</p> : null}
      <div className={css['twoCols']}>
        <div>{notes ? notes({ frame, player, words }) : words}</div>
        <div>
          <PseudocodePanel pseudocode={algorithm.pseudocode} lit={frame.lines} />
          <OpsPanel ops={algorithm.ops} counts={frame.ops} />
          <ComplexityPanel claims={algorithm.complexity} />
        </div>
      </div>
      {children}
    </div>
  );
}
