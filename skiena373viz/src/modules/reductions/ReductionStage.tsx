/** The side-by-side picture: formula on one side, graph on the other, linked by pointing. */
import { useMemo, useState } from 'react';
import { counterparts, sameSubject } from './algorithms/mapping';
import type { Counterparts, Subject } from './algorithms/mapping';
import { FormulaPanel } from './FormulaPanel';
import type { Interaction } from './FormulaPanel';
import { ReductionGraph } from './ReductionGraph';
import type { StageData } from './stages';
import css from './reductions.module.css';

export interface SubjectLink {
  readonly interaction: Interaction;
  readonly selected: Subject | null;
  readonly clear: () => void;
  /** The pointer, focus or selection, in that order of priority. */
  readonly active: Subject | null;
}

/** Hover or focus wins over a selection; clicking a selected thing again unselects it. */
export function useSubjectLink(): SubjectLink {
  const [selected, setSelected] = useState<Subject | null>(null);
  const [hovered, setHovered] = useState<Subject | null>(null);
  return useMemo(() => ({
    interaction: {
      selected,
      onHover: setHovered,
      onPick: (subject: Subject) => setSelected((current) => (sameSubject(current, subject) ? null : subject)),
    },
    selected,
    clear: () => setSelected(null),
    active: hovered ?? selected,
  }), [selected, hovered]);
}

/** What the active subject stands for in this frame, or null. */
export function linkedFor(data: StageData, active: Subject | null): Counterparts | null {
  return active ? counterparts(active, data.clauses, data.nodes, data.edges) : null;
}

export interface ReductionStageProps {
  readonly data: StageData;
  readonly linked?: Counterparts | null;
  readonly interaction?: Interaction;
  readonly onToggleVertex?: (id: string) => void;
  readonly graphTitle?: string;
  readonly emptyText?: string;
}

export function ReductionStage({ data, linked = null, interaction, onToggleVertex, graphTitle = 'Graph', emptyText }: ReductionStageProps) {
  return (
    <div className={css['sideBySide']}>
      <FormulaPanel
        clauses={data.clauses} variables={data.variables} literalMarks={data.literalMarks} clauseMarks={data.clauseMarks}
        variableMarks={data.variableMarks} linked={linked} {...(interaction ? { interaction } : {})}
      />
      <div className={css['graphBox']}>
        <h3>{graphTitle}</h3>
        <ReductionGraph
          size={data.size} nodes={data.nodes} edges={data.edges} nodeMarks={data.nodeMarks} edgeMarks={data.edgeMarks}
          title={graphTitle} linked={linked} {...(interaction ? { interaction } : {})}
          {...(onToggleVertex ? { onToggleVertex } : {})} {...(emptyText ? { emptyText } : {})}
        />
      </div>
    </div>
  );
}
