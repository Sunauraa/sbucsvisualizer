import { expect, it } from 'vitest';
import { measureAt } from '@core';
import { experiments } from './algorithms/experiments';

it('one whole sweep of any case takes well under the 200 ms budget (generous 600 ms here for slow machines)', () => {
  for (const experiment of experiments) {
    for (const c of experiment.cases) {
      const begin = performance.now();
      for (const n of experiment.sizes) measureAt(experiment, c.id, n, 7);
      expect(performance.now() - begin, `${experiment.id}/${c.id}`).toBeLessThan(600);
    }
  }
});
