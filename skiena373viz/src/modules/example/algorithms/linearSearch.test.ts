import { describe, expect, it } from 'vitest';
import { experimentProblems, measureAt } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { experiments, linearSearch } from './linearSearch';

describe('linear search', () => {
  it('is described completely', () => {
    expect(describeProblems(linearSearch)).toEqual([]);
  });

  // checkAlgorithm proves the whole contract; the invariant and `conserved` are yours to choose.
  const check = (items: number[], target: number) =>
    checkAlgorithm(linearSearch, { items, target }, {
      conserved: (state) => state.items,
      invariant: ({ state }) => (state.ruledOut > state.items.length ? 'ruled out too many' : null),
    });

  it.each(linearSearch.presets.map((p) => [p.id, p.input] as const))('preset %s keeps the contract', (_id, input) => {
    checkAlgorithm(linearSearch, input);
  });

  it('presets light every pseudocode line except the loop header', () => {
    expect(unlitAnchors(linearSearch, linearSearch.presets.map((p) => linearSearch.run(p.input)))).toEqual(['loop']);
  });

  it.each([
    ['empty', [], 1, null, 0],
    ['single hit', [1], 1, 0, 1],
    ['single miss', [2], 1, null, 1],
    ['duplicates: first index', [5, 2, 2], 2, 1, 2],
    ['last position', [1, 2, 3], 3, 2, 3],
  ] as const)('%s', (_name, items, target, result, comparisons) => {
    const trace = check([...items], target);
    expect(trace.status).toBe('completed');
    expect(trace.result).toBe(result);
    expect(trace.totals['comparisons']).toBe(comparisons);
  });

  it('growth experiment matches theory', () => {
    const [experiment] = experiments;
    expect(experimentProblems(experiment!)).toEqual([]);
    expect(measureAt(experiment!, 'missing', 64, 1)['comparisons']).toBe(64);
    expect(measureAt(experiment!, 'first', 64, 1)['comparisons']).toBe(1);
  });
});
