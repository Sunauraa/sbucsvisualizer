/** Collects every module's growth experiments. A module that fails or has none is skipped with a note. */
import { experimentProblems, measureAt, moduleInfo } from '@core';
import type { GrowthExperiment, ModuleManifest, Point } from '@core';

export interface ExperimentGroup {
  readonly moduleId: string;
  readonly title: string;
  readonly experiments: readonly GrowthExperiment[];
}

export interface Gathered {
  readonly groups: readonly ExperimentGroup[];
  readonly notes: readonly string[];
}

const nameOf = (moduleId: string): string => moduleInfo(moduleId)?.title ?? moduleId;

/**
 * Calls loadExperiments() on every module with Promise.allSettled. Rejections, thrown errors, malformed
 * experiments and repeated ids become notes; nothing here throws.
 */
export async function gatherExperiments(modules: readonly ModuleManifest[]): Promise<Gathered> {
  const settled = await Promise.allSettled(modules.map(async (module) => {
    if (!module.loadExperiments) return null;
    return (await module.loadExperiments()).experiments;
  }));
  const groups: ExperimentGroup[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();
  settled.forEach((outcome, index) => {
    const module = modules[index];
    if (!module) return;
    const name = nameOf(module.id);
    if (outcome.status === 'rejected') {
      const reason: unknown = outcome.reason;
      notes.push(`${name}: its experiments could not be loaded (${reason instanceof Error ? reason.message : String(reason)}).`);
      return;
    }
    const found = outcome.value;
    if (found === null || !Array.isArray(found) || found.length === 0) {
      notes.push(`${name}: no growth experiments yet.`);
      return;
    }
    const good: GrowthExperiment[] = [];
    for (const experiment of found) {
      const problems = safeProblems(experiment);
      if (problems.length > 0) notes.push(`${name}: skipped "${String(experiment?.id)}" (${problems.join('; ')}).`);
      else if (seen.has(experiment.id)) notes.push(`${name}: skipped "${experiment.id}" because another module already uses that id.`);
      else {
        seen.add(experiment.id);
        good.push(experiment);
      }
    }
    if (good.length > 0) groups.push({ moduleId: module.id, title: name, experiments: good });
  });
  return { groups, notes };
}

function safeProblems(experiment: GrowthExperiment | undefined): string[] {
  if (!experiment || typeof experiment !== 'object' || typeof experiment.measure !== 'function') return ['not an experiment'];
  try {
    return experimentProblems(experiment);
  } catch (error) {
    return [error instanceof Error ? error.message : 'invalid'];
  }
}

/** One experiment, one case, one op, as points. The same seed gives the same inputs to every experiment. */
export function measureSeries(experiment: GrowthExperiment, caseId: string, opId: string, seed: number): Point[] {
  return experiment.sizes.map((n) => ({ n, value: measureAt(experiment, caseId, n, seed)[opId] ?? 0 }));
}

/** The three sorts, if the sorting module's experiments are present. Found by id, never imported. */
export const SORT_EXPERIMENT_IDS = ['sorting-heapsort-growth', 'sorting-mergesort-growth', 'sorting-quicksort-growth'] as const;

export function findSortExperiments(groups: readonly ExperimentGroup[]): GrowthExperiment[] {
  const all = groups.flatMap((group) => group.experiments);
  return SORT_EXPERIMENT_IDS.flatMap((id) => all.filter((experiment) => experiment.id === id));
}

/** Case ids and op ids that every given experiment has, in the first one's order, with labels from it. */
export function commonChoices(experiments: readonly GrowthExperiment[]): {
  readonly cases: readonly { readonly id: string; readonly label: string }[];
  readonly ops: readonly { readonly id: string; readonly label: string }[];
} {
  const [first, ...rest] = experiments;
  if (!first) return { cases: [], ops: [] };
  return {
    cases: first.cases.filter((c) => rest.every((e) => e.cases.some((d) => d.id === c.id))).map(({ id, label }) => ({ id, label })),
    ops: first.ops.filter((o) => rest.every((e) => e.ops.some((p) => p.id === o.id))).map(({ id, label }) => ({ id, label })),
  };
}

/** 'Quicksort (last-item pivot unless stated)' becomes 'Quicksort'. */
export const shortTitle = (title: string): string => title.split(' (')[0] ?? title;
