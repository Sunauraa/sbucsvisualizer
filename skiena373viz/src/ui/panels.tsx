/** The text panels around a stage. */
import { TONES } from '@core';
import type { ComplexityClaim, OpCounts, OpDef, Pseudocode, Tone } from '@core';
import { ScrollX } from './ScrollX';

/** Pseudocode with the frame's anchors lit. Lit lines also get a marker and aria-current. */
export function PseudocodePanel({ pseudocode, lit }: { readonly pseudocode: Pseudocode; readonly lit: readonly string[] }) {
  return (
    <section className="panel" aria-label="Pseudocode">
      <h3>Pseudocode</h3>
      <ScrollX label="Pseudocode" className="code-box"><ol className="code" aria-label="Pseudocode lines">
        {pseudocode.lines.map((line) => {
          const on = lit.includes(line.anchor);
          return (
            <li key={line.anchor} data-anchor={line.anchor} className={on ? 'lit' : undefined} aria-current={on ? 'step' : undefined}>
              <span className="code-mark" aria-hidden="true">{on ? '▸' : ''}</span>
              <code style={{ paddingLeft: `${line.indent * 1.4}em` }}>{line.text}</code>
            </li>
          );
        })}
      </ol></ScrollX>
    </section>
  );
}

export function OpsPanel({ ops, counts }: { readonly ops: readonly OpDef[]; readonly counts: OpCounts }) {
  return (
    <section className="panel" aria-label="Operation counts">
      <h3>Operation counts</h3>
      <dl className="ops">
        {ops.map((op) => (
          <div key={op.id} title={op.counts}>
            <dt>{op.label}</dt>
            <dd>{counts[op.id] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>What is counted</summary>
        <ul>{ops.map((op) => <li key={op.id}><strong>{op.label}:</strong> {op.counts}</li>)}</ul>
      </details>
    </section>
  );
}

/** The frame's sentence. Announced when paused; silent during playback so it never floods a reader. */
export function Caption({ text, playing }: { readonly text: string; readonly playing: boolean }) {
  return <p className="caption" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">{text}</p>;
}

export function ComplexityPanel({ claims }: { readonly claims: readonly ComplexityClaim[] }) {
  return (
    <section className="panel" aria-label="Complexity">
      <h3>Complexity</h3>
      <ul className="claims">
        {claims.map((claim) => (
          <li key={`${claim.resource} ${claim.when}`}>
            <strong>{claim.bound}</strong> {claim.resource}, {claim.when}: <span className="muted">{claim.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Key to the tones a stage uses. Pass only the ones that can appear. */
export function Legend({ tones, labels = {} }: { readonly tones: readonly Tone[]; readonly labels?: Partial<Record<Tone, string>> }) {
  return (
    <ul className="legend" aria-label="Key">
      {tones.map((tone) => (
        <li key={tone}>
          <span className="legend-chip" aria-hidden="true" style={{ borderColor: TONES[tone].color, background: TONES[tone].soft, color: TONES[tone].ink }}>{TONES[tone].glyph}</span>
          {labels[tone] ?? `${tone}: ${TONES[tone].meaning}`}
        </li>
      ))}
    </ul>
  );
}
