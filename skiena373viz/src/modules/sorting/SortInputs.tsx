/** The input controls shared by every sorting view, and the hook that turns URL parameters into a valid list. */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Result } from '@core';
import { Field } from '@ui';
import { PIVOT_RULES } from './algorithms/common';
import type { PivotRule, SortInput } from './algorithms/common';
import {
  generateKeys, INPUT_KINDS, isInputKind, isPivotRule, MAX_ITEMS, parseSortItems, seedFrom, sizeFrom,
} from './algorithms/inputs';
import type { InputKind } from './algorithms/inputs';
import { PIVOT_LABELS } from './algorithms/quicksort';
import css from './sorting.module.css';

type Params = Readonly<Record<string, string>>;
type SetParams = (patch: Readonly<Record<string, string | null>>) => void;

export interface SortSetup {
  /** The list being sorted: the last valid one while the text is invalid. */
  readonly keys: readonly number[];
  readonly text: string;
  readonly error: string | null;
  readonly kind: InputKind | null;
  readonly size: number;
  readonly seed: number;
  readonly pivot: PivotRule;
  readonly pivotSeed: number;
  /** The input for quicksort and friends. */
  readonly input: SortInput;
}

export interface SortDefaults {
  readonly items: readonly number[];
  readonly pivot?: PivotRule;
}

const sameList = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

/** URL keys: a (typed list), kind, n, seed (generated list), pv (pivot rule), ps (pivot seed). */
export function useSortSetup(params: Params, defaults: SortDefaults): SortSetup {
  const kind = isInputKind(params['kind']) ? params['kind'] : null;
  const size = sizeFrom(params['n'], 12);
  const seed = seedFrom(params['seed']);
  const typed = params['a'] ?? defaults.items.join(', ');
  const parsed: Result<number[]> = useMemo(
    () => (kind ? { ok: true, value: generateKeys(kind, size, seed) } : parseSortItems(typed)),
    [kind, size, seed, typed],
  );
  const [lastGood, setLastGood] = useState<readonly number[]>(parsed.ok ? parsed.value : defaults.items);
  if (parsed.ok && !sameList(parsed.value, lastGood)) setLastGood(parsed.value);
  const pivot = isPivotRule(params['pv']) ? params['pv'] : (defaults.pivot ?? 'last');
  const pivotSeed = seedFrom(params['ps']);
  const keys = parsed.ok ? parsed.value : lastGood;
  const input = useMemo<SortInput>(() => ({ items: keys, pivot, seed: pivotSeed }), [keys, pivot, pivotSeed]);
  return {
    keys, text: kind ? keys.join(', ') : typed, error: parsed.ok ? null : parsed.message, kind, size, seed, pivot, pivotSeed, input,
  };
}

export interface PresetChoice {
  readonly id: string;
  readonly label: string;
  readonly input: SortInput;
}

export function SortInputFields({ setup, setParams, presets, withPivot = false }: {
  readonly setup: SortSetup;
  readonly setParams: SetParams;
  readonly presets: readonly PresetChoice[];
  readonly withPivot?: boolean;
}) {
  const { kind, size, seed, pivot, pivotSeed } = setup;
  return (
    <div className="field-row">
      <Field label="Items" error={setup.error} hint={`Up to ${MAX_ITEMS} whole numbers from -999 to 999`}>
        {(props) => (
          <input {...props} type="text" value={setup.text} spellCheck={false}
            onChange={(event) => setParams({ a: event.target.value, kind: null })} />
        )}
      </Field>
      <Field label="Shape of the input">
        {(props) => (
          <select {...props} value={kind ?? 'typed'} onChange={(event) => {
            const next = event.target.value;
            if (isInputKind(next)) setParams({ kind: next, a: null, n: String(kind ? size : Math.min(MAX_ITEMS, Math.max(setup.keys.length, 2))) });
            else setParams({ kind: null, a: setup.keys.join(', ') });
          }}>
            <option value="typed">The list I typed</option>
            {INPUT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        )}
      </Field>
      {kind ? (
        <Field label={`How many (0 to ${MAX_ITEMS})`}>
          {(props) => (
            <input {...props} type="number" min={0} max={MAX_ITEMS} value={size} style={{ width: '6em' }}
              onChange={(event) => setParams({ n: String(sizeFrom(event.target.value, size)) })} />
          )}
        </Field>
      ) : null}
      <Field label="Examples">
        {(props) => (
          <select {...props} value="" onChange={(event) => {
            const preset = presets.find((p) => p.id === event.target.value);
            if (!preset) return;
            setParams({ a: preset.input.items.join(', '), kind: null, ...(withPivot ? { pv: preset.input.pivot ?? 'last', ps: String(preset.input.seed ?? 373) } : {}) });
          }}>
            <option value="">Choose an example</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
      </Field>
      <ButtonCell>
        <button type="button" onClick={() => setParams({ kind: kind ?? 'random', a: null, n: String(kind ? size : 12), seed: String(seed + 1) })}>
          New random input
        </button>
      </ButtonCell>
      {withPivot ? (
        <>
          <Field label="Quicksort pivot">
            {(props) => (
              <select {...props} value={pivot} onChange={(event) => setParams({ pv: event.target.value })}>
                {PIVOT_RULES.map((rule) => <option key={rule} value={rule}>{PIVOT_LABELS[rule]}</option>)}
              </select>
            )}
          </Field>
          {pivot === 'random' ? (
            <ButtonCell>
              <button type="button" onClick={() => setParams({ ps: String(pivotSeed + 1) })}>New pivot seed ({pivotSeed})</button>
            </ButtonCell>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** A button that lines up with labelled fields beside it. */
function ButtonCell({ children }: { readonly children: ReactNode }) {
  return <div className="field"><div aria-hidden="true" className={css['spacer']} />{children}</div>;
}
