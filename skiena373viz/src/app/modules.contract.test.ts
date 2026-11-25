// @vitest-environment jsdom
// Runs against every discovered module. Workers: this is your manifest's acceptance test; do not edit.
// `npm run check -- <module>` sets CHECK_MODULES so a neighbour's half-finished module cannot fail you.
import { describe, expect, it } from 'vitest';
import { experimentProblems, manifestProblems, measureAt } from '@core';
import type { ModuleManifest } from '@core';
import { discovered, folderOf } from './registry';

const only = process.env['CHECK_MODULES']?.split(',');
const entries = Object.entries(discovered)
  .map(([path, load]) => ({ folder: folderOf(path), load }))
  .filter(({ folder }) => !only || only.includes(folder));

describe.each(entries)('module $folder', ({ folder, load }) => {
  it('has a valid manifest and loadable views', async () => {
    const manifest = (await load()) as ModuleManifest;
    expect(manifestProblems(manifest, folder)).toEqual([]);
    for (const view of manifest.views) expect(typeof (await view.load()).default, view.id).toBe('function');
  }, 20_000);

  it('has valid growth experiments, if any', async () => {
    const manifest = (await load()) as ModuleManifest;
    const { experiments } = (await manifest.loadExperiments?.()) ?? { experiments: [] };
    expect(new Set(experiments.map((e) => e.id)).size).toBe(experiments.length);
    for (const experiment of experiments) {
      expect(experimentProblems(experiment), experiment.id).toEqual([]);
      const n = experiment.sizes[0] ?? 1;
      for (const { id } of experiment.cases) {
        expect(measureAt(experiment, id, n, 1), `${experiment.id}/${id} is seeded`).toEqual(measureAt(experiment, id, n, 1));
      }
    }
  }, 20_000);
});
