/** One page for each structure: input fields, operation buttons, the Workbench, the growth plot. */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { parseBoundedInt } from '@core';
import type { Algorithm, Frame, GrowthExperiment, Result, ViewProps } from '@core';
import { Field, GrowthPanel, Workbench } from '@ui';
import type { FrameRenderer } from '@ui';
import { KEY_MAX, KEY_MIN, parseKey, parseStartKeys } from './algorithms/operations';
import type { OperationLog } from './algorithms/operations';
import type { RandomInput } from './algorithms/random';
import { OperationsPanel } from './OperationsPanel';
import css from './structures.module.css';

export interface VerbButton {
  readonly verb: string;
  readonly takesKey: boolean;
}

export interface StructureConfig<I, S extends { readonly log: OperationLog }, R, O> {
  readonly algorithm: Algorithm<I, S, R>;
  readonly Renderer: FrameRenderer<S, R>;
  readonly legend: ReactNode;
  readonly experiments: readonly GrowthExperiment[];
  readonly verbs: readonly VerbButton[];
  readonly parseOperations: (text: string) => Result<O[]>;
  readonly build: (start: number[], operations: O[], size: number) => I;
  readonly toParams: (input: I) => { readonly start: string; readonly operations: string; readonly size: number };
  readonly random: (seed: number) => RandomInput;
  readonly startLabel: string;
  readonly startHint: string;
  readonly withSize?: boolean;
  /** A short warning about the starting keys, shown beside the start field (for example "Not a heap yet"). */
  readonly startNote?: (start: readonly number[]) => string | null;
  /** A notice above the stage about the current valid input, with a way to fix the operation list. */
  readonly notice?: (input: I, fix: { readonly prependOperation: (text: string) => void }) => ReactNode;
  /** Extra panels in the side column, above the pseudocode. */
  readonly aside?: (frame: Frame<S>) => ReactNode;
  /** Extra content under the stage and the side column, above the growth plot. */
  readonly footer?: (input: I) => ReactNode;
}

const SIZES = Array.from({ length: 13 }, (_, i) => i + 1);

export function StructureView<I, S extends { readonly log: OperationLog }, R, O>({
  params, setParams, config,
}: ViewProps & { readonly config: StructureConfig<I, S, R, O> }) {
  const { algorithm } = config;
  const first = algorithm.presets[0];
  const defaults = first ? config.toParams(first.input) : { start: '', operations: '', size: 5 };
  const startText = params['s'] ?? defaults.start;
  const opsText = params['o'] ?? defaults.operations;
  const sizeText = params['m'] ?? String(defaults.size);
  const [keyText, setKeyText] = useState('');

  const start = useMemo(() => parseStartKeys(startText), [startText]);
  const operations = useMemo(() => config.parseOperations(opsText), [config, opsText]);
  const size = useMemo(() => (config.withSize ? parseBoundedInt(sizeText, 'Table size', 1, 13) : { ok: true as const, value: 5 }), [config.withSize, sizeText]);
  const parsed = useMemo(
    () => (start.ok && operations.ok && size.ok ? config.build(start.value, operations.value, size.value) : null),
    [config, start, operations, size],
  );
  // While the input is invalid, keep showing the last valid run and say what is wrong.
  const [lastGood, setLastGood] = useState<I | null>(parsed);
  if (parsed !== null && parsed !== lastGood) setLastGood(parsed);
  const input = lastGood ?? parsed ?? first?.input;
  const trace = useMemo(() => (input === undefined ? null : algorithm.run(input)), [algorithm, input]);
  if (trace === null || input === undefined) return <p className="muted">This structure has no examples yet.</p>;

  const append = (text: string): void => {
    const base = opsText.trim().replace(/[,;\s]+$/, '');
    setParams({ o: base === '' ? text : `${base}, ${text}` });
  };
  const prependOperation = (text: string): void => {
    const rest = opsText.trim().replace(/^[,;\s]+/, '');
    setParams({ o: rest === '' ? text : `${text}, ${rest}` });
  };
  const startNote = start.ok ? config.startNote?.(start.value) ?? null : null;
  const key = parseKey(keyText.trim(), 'the key box');
  const keyError = keyText.trim() === '' ? null : key.ok ? null : key.message;

  return (
    <Workbench
      algorithm={algorithm}
      trace={trace}
      Renderer={config.Renderer}
      legend={config.legend}
      inputs={
        <div className={css['stack']}>
          {parsed !== null ? config.notice?.(parsed, { prependOperation }) : null}
          <div className="field-row">
            <Field label={config.startLabel} error={start.ok ? null : start.message} hint={startNote ? `${startNote} ${config.startHint}` : config.startHint}>
              {(props) => <input {...props} type="text" value={startText} onChange={(event) => setParams({ s: event.target.value })} />}
            </Field>
            {config.withSize ? (
              <Field label="Table size m" error={size.ok ? null : size.message} hint="1 to 13 slots">
                {(props) => (
                  <select {...props} value={sizeText} onChange={(event) => setParams({ m: event.target.value })}>
                    {!SIZES.some((n) => String(n) === sizeText) ? <option value={sizeText}>{sizeText}</option> : null}
                    {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </Field>
            ) : null}
            <Field label="Example">
              {(props) => (
                <select {...props} value="" onChange={(event) => {
                  const preset = algorithm.presets.find((p) => p.id === event.target.value);
                  if (!preset) return;
                  const p = config.toParams(preset.input);
                  setParams({ s: p.start, o: p.operations, ...(config.withSize ? { m: String(p.size) } : {}), r: null });
                }}>
                  <option value="">Choose an example</option>
                  {algorithm.presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              )}
            </Field>
          </div>
          <Field label="Operations" error={operations.ok ? null : operations.message} hint={`Up to 24, separated by commas. Keys run from ${KEY_MIN} to ${KEY_MAX}.`}>
            {(props) => <textarea {...props} rows={2} spellCheck={false} value={opsText} onChange={(event) => setParams({ o: event.target.value })} />}
          </Field>
          <div className={css['appendRow']} role="group" aria-label="Add one operation">
            {config.verbs.some((v) => v.takesKey) ? (
              <div className={css['keyField']}>
                <Field label="Key to add" error={keyError} hint={keyError ? undefined : '-99 to 999'}>
                  {(props) => <input {...props} type="text" inputMode="numeric" value={keyText} onChange={(event) => setKeyText(event.target.value)} />}
                </Field>
              </div>
            ) : null}
            <div className={css['appendButtons']}>
              {config.verbs.map((v) => (
                <button key={v.verb} type="button" disabled={v.takesKey && !key.ok} onClick={() => append(v.takesKey && key.ok ? `${v.verb} ${key.value}` : v.verb)}>
                  + {v.verb}
                </button>
              ))}
              <button type="button" onClick={() => setParams({ o: '' })}>Clear operations</button>
              <button type="button" onClick={() => {
                const seed = (Number.parseInt(params['r'] ?? '0', 10) || 0) + 1;
                const next = config.random(seed);
                setParams({ s: next.start, o: next.operations, ...(config.withSize && next.size !== undefined ? { m: String(next.size) } : {}), r: String(seed) });
              }}>New random input</button>
            </div>
          </div>
        </div>
      }
      aside={({ frame }) => (
        <>
          <OperationsPanel log={frame.state.log} />
          {config.aside?.(frame)}
        </>
      )}
    >
      {config.footer?.(input)}
      <GrowthPanel experiments={config.experiments} />
    </Workbench>
  );
}
