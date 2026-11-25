/** Finds every src/modules/<id>/index.ts(x). A module that fails to load is reported, never fatal. */
import { EXAMPLE_MODULE, manifestProblems, SYLLABUS } from '@core';
import type { ModuleManifest } from '@core';

export interface ModuleFailure {
  readonly folder: string;
  readonly problems: readonly string[];
}

export interface Registry {
  readonly modules: readonly ModuleManifest[];
  readonly failures: readonly ModuleFailure[];
}

type Loader = () => Promise<unknown>;

export const discovered: Readonly<Record<string, Loader>> = import.meta.glob('../modules/*/index.{ts,tsx}', { import: 'default' });

export const folderOf = (path: string): string => /modules\/([^/]+)\//.exec(path)?.[1] ?? path;

export async function loadRegistry(loaders: Readonly<Record<string, Loader>> = discovered): Promise<Registry> {
  const modules: ModuleManifest[] = [];
  const failures: ModuleFailure[] = [];
  await Promise.all(Object.entries(loaders).map(async ([path, load]) => {
    const folder = folderOf(path);
    try {
      const manifest = await load();
      const problems = manifestProblems(manifest, folder);
      if (problems.length > 0) failures.push({ folder, problems });
      else modules.push(manifest as ModuleManifest);
    } catch (error) {
      failures.push({ folder, problems: [error instanceof Error ? error.message : String(error)] });
    }
  }));
  const order = [...SYLLABUS.map((module) => module.id), EXAMPLE_MODULE.id];
  modules.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { modules, failures };
}
