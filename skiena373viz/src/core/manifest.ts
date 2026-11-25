/** What a module's index.ts default-exports. The shell discovers it; nobody edits a registry. */
import type { ComponentType } from 'react';
import type { GrowthExperiment } from './growth';
import { LECTURES, SYLLABUS } from './syllabus';

/** Passed to every view by the router. Parameters live in the URL, so a view can be linked to. */
export interface ViewProps {
  readonly params: Readonly<Record<string, string>>;
  /** Merges into the URL without adding history or moving focus/scroll. null removes a key. */
  readonly setParams: (patch: Readonly<Record<string, string | null>>) => void;
}

export interface ViewManifest {
  /** Stable kebab-case id, used in the URL: #/<module>/<view>. */
  readonly id: string;
  readonly title: string;
  /** One sentence for the module page. */
  readonly summary: string;
  /** Lecture numbers from LECTURES. */
  readonly lectures: readonly number[];
  readonly load: () => Promise<{ readonly default: ComponentType<ViewProps> }>;
}

export interface ModuleManifest {
  /** Must equal the folder name under src/modules, and a SYLLABUS id (or 'example'). */
  readonly id: string;
  readonly views: readonly ViewManifest[];
  /** Optional growth experiments, plotted by this module's GrowthPanel and by the analysis module. */
  readonly loadExperiments?: () => Promise<{ readonly experiments: readonly GrowthExperiment[] }>;
}

/** The worked example is not part of the syllabus, so it carries its own description. */
export const EXAMPLE_MODULE = {
  id: 'example', unit: 0, unitTitle: 'Worked example', title: 'Worked example', lectures: [1, 2],
  summary: 'Linear search: the smallest complete module, and the pattern the others copy.',
} as const;

export function moduleInfo(id: string): (typeof SYLLABUS)[number] | undefined {
  return id === EXAMPLE_MODULE.id ? EXAMPLE_MODULE : SYLLABUS.find((module) => module.id === id);
}

export const isExample = (id: string): boolean => id === EXAMPLE_MODULE.id;

/** Runtime check used by the registry and by the contract test. */
export function manifestProblems(manifest: unknown, folder: string): string[] {
  if (typeof manifest !== 'object' || manifest === null) return ['index.ts has no default-exported manifest'];
  const m = manifest as Partial<ModuleManifest>;
  const problems: string[] = [];
  if (m.id !== folder) problems.push(`id is "${String(m.id)}" but the folder is "${folder}"`);
  if (!moduleInfo(folder)) problems.push(`"${folder}" is not a module in src/core/syllabus.ts`);
  if (!Array.isArray(m.views) || m.views.length === 0) return [...problems, 'views must be a non-empty array'];
  const ids = new Set<string>();
  for (const view of m.views as readonly ViewManifest[]) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(view.id)) problems.push(`view id "${view.id}" is not kebab-case`);
    if (ids.has(view.id)) problems.push(`view id "${view.id}" repeats`);
    ids.add(view.id);
    if (!view.title || !view.summary) problems.push(`view "${view.id}" needs a title and a summary`);
    if (typeof view.load !== 'function') problems.push(`view "${view.id}" needs load()`);
    for (const lecture of view.lectures) if (!LECTURES[lecture]) problems.push(`view "${view.id}" cites unknown lecture ${lecture}`);
  }
  return problems;
}
