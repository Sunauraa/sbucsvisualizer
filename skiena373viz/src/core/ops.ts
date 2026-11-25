/** Operation counting: the bridge from a trace to asymptotic analysis. */

export interface OpDef<O extends string = string> {
  /** Stable key used in OpCounts. Plural noun: 'comparisons', 'swaps', 'relaxations'. */
  readonly id: O;
  /** Short label for the count panel. */
  readonly label: string;
  /** Exactly what is (and is not) counted, in one sentence. Shown as help text. */
  readonly counts: string;
}

/** Cumulative counts since the start of the run. Every declared op is present in every frame. */
export type OpCounts = Readonly<Record<string, number>>;

/** OpOf<typeof OPS> gives the union of op ids. */
export type OpOf<D> = D extends readonly OpDef<infer O>[] ? O : never;

export function defineOps<const O extends string>(defs: readonly OpDef<O>[]): readonly OpDef<O>[] {
  const ids = new Set(defs.map((d) => d.id));
  if (defs.length === 0) throw new Error('Declare at least one operation');
  if (ids.size !== defs.length) throw new Error('Operation ids must be unique');
  return defs;
}

export class OpCounter<O extends string = string> {
  private readonly counts: Record<string, number> = {};

  constructor(defs: readonly OpDef<O>[]) {
    for (const def of defs) this.counts[def.id] = 0;
  }

  add(op: O, by = 1): void {
    const current = this.counts[op];
    if (current === undefined) throw new Error(`Operation "${op}" was not declared`);
    if (!Number.isInteger(by) || by < 0) throw new Error(`Cannot add ${by} to "${op}": counts only grow`);
    this.counts[op] = current + by;
  }

  get(op: O): number {
    return this.counts[op] ?? 0;
  }

  snapshot(): OpCounts {
    return Object.freeze({ ...this.counts });
  }
}
