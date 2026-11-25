/** The formula as clauses of literal buttons. Pointing at, focusing or selecting one lights its counterpart in the graph. */
import { Fragment } from 'react';
import { TONES } from '@core';
import type { Tone } from '@core';
import { formatLiteral } from './algorithms/formula';
import type { Clause } from './algorithms/formula';
import type { Highlight } from './algorithms/gadgets';
import type { Subject } from './algorithms/mapping';
import { sameSubject } from './algorithms/mapping';
import css from './reductions.module.css';

/** How a thing is drawn right now: a tone (colour plus glyph) and a short word saying the same. */
export interface Mark {
  readonly tone?: Tone;
  readonly note?: string;
}

export interface Interaction {
  readonly selected: Subject | null;
  readonly onHover: (subject: Subject | null) => void;
  readonly onPick: (subject: Subject) => void;
}

export interface FormulaPanelProps {
  readonly clauses: readonly Clause[];
  readonly variables: readonly string[];
  /** Keyed `${clause}.${position}`, both 0-based. */
  readonly literalMarks?: Readonly<Record<string, Mark>>;
  readonly clauseMarks?: Readonly<Record<number, Mark>>;
  readonly variableMarks?: Readonly<Record<string, Mark>>;
  /** What the pointer is on, as counterparts: these get the dashed link outline. */
  readonly linked?: Pick<Highlight, 'clauses' | 'literals' | 'variables'> | null;
  readonly interaction?: Interaction;
  readonly title?: string;
}

function chipStyle(tone: Tone | undefined): { borderColor: string; background: string; color: string } | undefined {
  if (!tone || tone === 'idle') return undefined;
  const style = TONES[tone];
  return { borderColor: style.color, background: style.soft, color: style.ink };
}

function Chip({ text, label, mark, linked, subject, interaction, className }: {
  readonly text: string;
  readonly label: string;
  readonly mark: Mark | undefined;
  readonly linked: boolean;
  readonly subject: Subject;
  readonly interaction: Interaction | undefined;
  readonly className?: string;
}) {
  const tone = mark?.tone;
  const glyph = tone ? TONES[tone].glyph : '';
  return (
    <button
      type="button"
      className={`${css['chip']} ${className ?? ''}`}
      style={chipStyle(tone)}
      data-linked={linked ? 'true' : undefined}
      aria-pressed={interaction ? sameSubject(interaction.selected, subject) : undefined}
      aria-label={mark?.note ? `${label}, ${mark.note}` : label}
      onPointerEnter={() => interaction?.onHover(subject)}
      onPointerLeave={() => interaction?.onHover(null)}
      onFocus={() => interaction?.onHover(subject)}
      onBlur={() => interaction?.onHover(null)}
      onClick={() => interaction?.onPick(subject)}
    >
      {text}
      {glyph ? <span className={css['glyph']} aria-hidden="true">{glyph}</span> : null}
    </button>
  );
}

export function FormulaPanel({ clauses, variables, literalMarks = {}, clauseMarks = {}, variableMarks = {}, linked = null, interaction, title = 'Formula' }: FormulaPanelProps) {
  return (
    <section className={`panel ${css['formula']}`} aria-label={title}>
      <h3>{title}</h3>
      {clauses.length === 0 ? (
        <p className={css['empty']}>No clauses. The empty formula is satisfied by every assignment.</p>
      ) : (
        <ol className={css['clauses']}>
          {clauses.map((clause, i) => {
            const mark = clauseMarks[i];
            return (
              <li key={i} className={css['clause']} data-linked={linked?.clauses.includes(i) ? 'true' : undefined}>
                <Chip text={`C${i + 1}`} label={`clause ${i + 1}`} mark={mark} linked={false} subject={{ kind: 'clause', clause: i }} interaction={interaction} className={css['clauseName']} />
                <span className={css['literals']}>
                  <span className={css['punct']} aria-hidden="true">(</span>
                  {clause.map((literal, position) => (
                    <Fragment key={position}>
                      {position > 0 ? <span className={css['punct']} aria-hidden="true">∨</span> : null}
                      <Chip
                        text={formatLiteral(literal)}
                        label={`literal ${formatLiteral(literal)}, clause ${i + 1}, position ${position + 1}`}
                        mark={literalMarks[`${i}.${position}`]}
                        linked={Boolean(linked?.literals.some((l) => l.clause === i && l.position === position))}
                        subject={{ kind: 'literal', clause: i, position }}
                        interaction={interaction}
                      />
                    </Fragment>
                  ))}
                  <span className={css['punct']} aria-hidden="true">)</span>
                </span>
                <p className={css['note']}>{mark?.note ?? ''}</p>
              </li>
            );
          })}
        </ol>
      )}
      {variables.length > 0 ? (
        <div className={css['variables']}>
          <strong>Variables</strong>
          {variables.map((variable) => (
            <Chip key={variable} text={variable} label={`variable ${variable}`} mark={variableMarks[variable]}
              linked={Boolean(linked?.variables.includes(variable))} subject={{ kind: 'variable', variable }} interaction={interaction} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
