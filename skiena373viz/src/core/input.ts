/** Parsing user input: never throw, always come back with a message a student can act on. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (message: string): Result<never> => ({ ok: false, message });

export interface IntListRules {
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
  /** Default true: an empty list is a legitimate edge case. */
  readonly allowEmpty?: boolean;
}

/** '5, 3 8' becomes [5, 3, 8]. Commas and spaces both separate. */
export function parseIntList(text: string, rules: IntListRules = {}): Result<number[]> {
  const { min = -999, max = 999, maxLength = 64, allowEmpty = true } = rules;
  const parts = text.split(/[\s,]+/).filter((part) => part !== '');
  if (parts.length === 0 && !allowEmpty) return fail('Enter at least one number.');
  if (parts.length > maxLength) return fail(`That is ${parts.length} numbers; the limit here is ${maxLength}.`);
  const values: number[] = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return fail(`"${part}" is not a whole number.`);
    const value = Number(part) + 0;
    if (value < min || value > max) return fail(`${part} is outside ${min} to ${max}.`);
    values.push(value === 0 ? 0 : value);
  }
  return ok(values);
}

export function parseBoundedInt(text: string, name: string, min: number, max: number): Result<number> {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return fail(`${name} must be a whole number.`);
  const value = Number(trimmed);
  if (value < min || value > max) return fail(`${name} must be between ${min} and ${max}.`);
  return ok(value === 0 ? 0 : value);
}
