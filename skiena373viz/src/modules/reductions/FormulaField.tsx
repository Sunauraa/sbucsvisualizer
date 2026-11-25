/** The formula text box, shared by every view: parsing, presets, and the pad buttons for short clauses. */
import { useMemo, useState } from 'react';
import type { Preset } from '@core';
import { Field } from '@ui';
import { analyzeFormula, formatClauses, formatFormula, padClauses, UI_LIMITS } from './algorithms/formula';
import type { Formula, FormulaAnalysis } from './algorithms/formula';
import { threeSatToVertexCover } from './algorithms/construct';

export const FORMULA_PRESETS: readonly Preset<Formula>[] = threeSatToVertexCover.presets;
const DEFAULT_FORMULA: Formula = FORMULA_PRESETS[0]?.input ?? { clauses: [] };

export interface FormulaState {
  readonly text: string;
  readonly analysis: FormulaAnalysis;
  /** The last valid formula: while the text is being edited the page keeps showing this one. */
  readonly formula: Formula;
  readonly valid: boolean;
}

/** The formula lives in the URL parameter `f`. While the text is invalid the last valid formula stays on screen. */
export function useFormula(params: Readonly<Record<string, string>>): FormulaState {
  const text = params['f'] ?? formatFormula(DEFAULT_FORMULA);
  const analysis = useMemo(() => analyzeFormula(text), [text]);
  const [lastGood, setLastGood] = useState<Formula>(analysis.formula.ok ? analysis.formula.value : DEFAULT_FORMULA);
  if (analysis.formula.ok && analysis.formula.value !== lastGood) setLastGood(analysis.formula.value);
  return { text, analysis, formula: analysis.formula.ok ? analysis.formula.value : lastGood, valid: analysis.formula.ok };
}

export interface FormulaFieldProps {
  readonly state: FormulaState;
  /** Called with the new formula text (also for presets and padding). */
  readonly onText: (text: string) => void;
}

export function FormulaField({ state, onText }: FormulaFieldProps) {
  const { text, analysis, valid } = state;
  const { raw, short } = analysis;
  const error = analysis.formula.ok ? null : analysis.formula.message;
  return (
    <div className="field-row">
      <div style={{ flex: '2 1 360px' }}>
        <Field label="Formula (3-CNF)" error={error}
          hint={`Exactly three literals per clause, up to ${UI_LIMITS.maxVariables} variables and ${UI_LIMITS.maxClauses} clauses. Example: (x1 | !x2 | x3) & (!x1 | x2 | x2)`}>
          {(props) => (
            <input {...props} type="text" spellCheck={false} autoComplete="off" value={text} onChange={(event) => onText(event.target.value)} />
          )}
        </Field>
        {!valid ? <p className="muted small">The pictures below still show the last valid formula.</p> : null}
        {raw && short.length > 0 ? (
          <p className="field-row" style={{ gap: 8, margin: '0 0 8px' }}>
            {short.slice(0, 4).map((index) => (
              <button key={index} type="button" onClick={() => onText(formatClauses(padClauses(raw, [index])))}>Pad clause {index + 1}</button>
            ))}
            {short.length > 1 ? <button type="button" onClick={() => onText(formatClauses(padClauses(raw)))}>Pad all short clauses</button> : null}
          </p>
        ) : null}
        <details>
          <summary>Accepted notation</summary>
          <p className="small">
            Literals are names made of letters and digits, such as <code>x1</code> or <code>rain</code>; negate with <code>!</code>, <code>¬</code>, <code>~</code>, <code>-</code> or <code>not</code>.
            Join literals with <code>|</code>, <code>∨</code> or <code>or</code>, and clauses with <code>&amp;</code>, <code>∧</code> or <code>and</code>.
            Repeating a literal inside a clause is legal. An empty box is the empty formula.
          </p>
        </details>
      </div>
      <Field label="Try an example">
        {(props) => (
          <select {...props} value="" onChange={(event) => {
            const preset = FORMULA_PRESETS.find((p) => p.id === event.target.value);
            if (preset) onText(formatFormula(preset.input));
          }}>
            <option value="">Choose an example</option>
            {FORMULA_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
      </Field>
    </div>
  );
}
