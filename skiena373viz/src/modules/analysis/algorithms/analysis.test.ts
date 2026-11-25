import { describe, expect, it } from 'vitest';
import { createRng, experimentProblems, GROWTH_FNS, measureAt, ratios } from '@core';
import type { GrowthExperiment, GrowthFnId, ModuleManifest } from '@core';
import { checkAlgorithm, describeProblems, unlitAnchors } from '@core/testing';
import { binarySearch, binarySearchExperiment, halvingChain, worstComparisons } from './binarySearch';
import { experiments } from './experiments';
import { commonChoices, findSortExperiments, gatherExperiments, measureSeries, shortTitle } from './gather';
import { insertionSort, insertionSortExperiment } from './insertionSort';
import {
  BUDGETS, describeMaxSize, dominanceLines, formatDuration, formatSteps, leavesAt, log10Of, maxSizeWithin, overtakesFrom, RATE_IDS, ratesFromCodes, RATE_CODE, timeAt,
} from './rates';

const lg = (n: number): number => Math.floor(Math.log2(n));

describe('binary search', () => {
  const run = (items: number[], target: number) => checkAlgorithm(binarySearch, { items, target }, { conserved: (s) => s.items });
  const input = { items: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91] };

  it('is described completely and its presets light the code', () => {
    expect(describeProblems(binarySearch)).toEqual([]);
    const traces = binarySearch.presets.map((p) => checkAlgorithm(binarySearch, p.input));
    expect(unlitAnchors(binarySearch, traces)).toEqual([]);
  });
  it('empty array', () => {
    const trace = run([], 4);
    expect(trace.result).toBeNull();
    expect(trace.totals['comparisons']).toBe(0);
    expect(trace.status).toBe('completed');
  });
  it('single item, hit and miss', () => {
    expect(run([7], 7).result).toBe(0);
    expect(run([7], 7).totals['comparisons']).toBe(1);
    expect(run([7], 3).result).toBeNull();
    expect(run([7], 9).totals['comparisons']).toBe(1);
  });
  it('missing below, between and above', () => {
    for (const target of [1, 20, 100]) {
      const trace = run(input.items, target);
      expect(trace.result).toBeNull();
      expect(trace.totals['comparisons']).toBeLessThanOrEqual(lg(10) + 1);
      expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('absent');
    }
  });
  it('finds every present item', () => {
    input.items.forEach((value, index) => expect(run(input.items, value).result).toBe(index));
  });
  it('duplicates: any matching index is returned, and the sentence says so', () => {
    const trace = run([1, 3, 3, 3, 3, 3, 3, 9], 3);
    expect(trace.result).not.toBeNull();
    expect([1, 2, 3, 4, 5, 6]).toContain(trace.result);
    expect(trace.frames[trace.frames.length - 1]?.explanation).toContain('any matching position is a correct answer');
    expect(binarySearch.summary + JSON.stringify(binarySearch.complexity)).not.toContain('undefined');
  });
  it('unsorted input is rejected by its own check, naming the offending pair', () => {
    const trace = run([4, 9, 7, 12, 15], 12);
    expect(trace.status).toBe('rejected');
    const last = trace.frames[trace.frames.length - 1]!;
    expect(last.explanation).toContain('9 at position 1 is larger than 7 at position 2');
    expect(last.state.offending).toEqual([1, 2]);
    expect(last.lines).toEqual(['check']);
    expect(trace.totals['order-checks']).toBe(2);
    expect(trace.totals['comparisons']).toBe(0);
  });
  it('equal neighbours are in order (sorted allows duplicates)', () => {
    expect(run([2, 2, 2], 2).status).toBe('completed');
  });
  it('a key that is not a number is refused rather than crashing', () => {
    const trace = binarySearch.run({ items: [1, Number.NaN, 3], target: 1 });
    expect(trace.status).toBe('rejected');
    expect(trace.frames.every((f) => !/NaN/.test(f.explanation))).toBe(true);
    expect(binarySearch.run({ items: [1, 2], target: Infinity }).status).toBe('rejected');
  });
  it('comparisons never exceed ⌊lg n⌋ + 1, and the result agrees with a linear scan, on 300 seeded inputs', () => {
    const rng = createRng(373);
    for (let round = 0; round < 300; round += 1) {
      const n = rng.int(0, 40);
      const items = Array.from({ length: n }, () => rng.int(-20, 20)).sort((a, b) => a - b);
      const target = rng.int(-25, 25);
      const trace = binarySearch.run({ items, target }, { mode: 'counts' });
      expect(trace.totals['comparisons']).toBeLessThanOrEqual(n === 0 ? 0 : lg(n) + 1);
      const at = trace.result;
      if (items.includes(target)) expect(items[at as number]).toBe(target);
      else expect(at).toBeNull();
    }
  });
  it('the worst case is exactly ⌊lg n⌋ + 1 when the target is above everything', () => {
    for (let n = 1; n <= 200; n += 1) {
      const items = Array.from({ length: n }, (_, i) => i);
      expect(binarySearch.run({ items, target: n }, { mode: 'counts' }).totals['comparisons']).toBe(lg(n) + 1);
    }
  });
  it('the halving chain and its length are ⌊lg n⌋ + 1', () => {
    expect(halvingChain(16)).toEqual([16, 8, 4, 2, 1]);
    expect(halvingChain(10)).toEqual([10, 5, 2, 1]);
    expect(halvingChain(1)).toEqual([1]);
    expect(halvingChain(0)).toEqual([]);
    for (let n = 1; n < 300; n += 1) expect(worstComparisons(n)).toBe(lg(n) + 1);
  });
  it('candidates never grow and each step at least halves them', () => {
    const trace = binarySearch.run({ items: Array.from({ length: 50 }, (_, i) => i), target: 49 });
    const searching = trace.frames.filter((f) => f.lines.includes('less') || f.lines.includes('init'));
    searching.forEach((f, i) => {
      if (i > 0) expect(f.state.remaining).toBeLessThanOrEqual(Math.floor(searching[i - 1]!.state.remaining / 2));
    });
  });
});

describe('insertion sort', () => {
  const run = (items: number[]) => checkAlgorithm(insertionSort, { items }, { conserved: (s) => [...s.items.filter((v): v is number => v !== null), ...(s.held === null ? [] : [s.held])] });
  it('is described completely and the presets light every line', () => {
    expect(describeProblems(insertionSort)).toEqual([]);
    const traces = insertionSort.presets.map((p) => run([...p.input.items]));
    expect(unlitAnchors(insertionSort, traces)).toEqual([]);
  });
  it.each([0, 1, 2, 3, 10, 33])('sorted input of length %i makes exactly n − 1 comparisons (none for n < 2)', (n) => {
    const trace = insertionSort.run({ items: Array.from({ length: n }, (_, i) => i) }, { mode: 'counts' });
    expect(trace.totals['comparisons']).toBe(Math.max(0, n - 1));
  });
  it.each([0, 1, 2, 3, 10, 33])('reversed input of length %i makes exactly n(n − 1)/2 comparisons', (n) => {
    const trace = insertionSort.run({ items: Array.from({ length: n }, (_, i) => n - i) }, { mode: 'counts' });
    expect(trace.totals['comparisons']).toBe((n * (n - 1)) / 2 + 0);
  });
  it('sorts 300 seeded lists like the built-in sort, with duplicates and negatives', () => {
    const rng = createRng(9);
    for (let round = 0; round < 300; round += 1) {
      const items = Array.from({ length: rng.int(0, 25) }, () => rng.int(-9, 9));
      expect(insertionSort.run({ items }, { mode: 'counts' }).result).toEqual([...items].sort((a, b) => a - b));
    }
  });
  it('the contract holds on 20 seeded lists, frame by frame', () => {
    const rng = createRng(2);
    for (let round = 0; round < 20; round += 1) run(Array.from({ length: rng.int(0, 9) }, () => rng.int(-3, 3)));
  });
  it('a swap-free count: writes are shifts plus one placement per inserted key', () => {
    expect(insertionSort.run({ items: [3, 2, 1] }, { mode: 'counts' }).totals['writes']).toBe(3 + 2);
  });
  it('a non-finite key is tolerated', () => {
    expect(() => insertionSort.run({ items: [1, Number.NaN] })).not.toThrow();
  });
});

describe('the analysis experiments', () => {
  it.each(experiments)('$id is a valid experiment', (experiment) => {
    expect(experimentProblems(experiment)).toEqual([]);
    for (const { id } of experiment.cases) expect(measureAt(experiment, id, experiment.sizes[0] ?? 1, 3)).toEqual(measureAt(experiment, id, experiment.sizes[0] ?? 1, 3));
  });

  const points = (experiment: GrowthExperiment, caseId: string, op = experiment.primaryOp) => measureSeries(experiment, caseId, op, 11);
  const f = (id: GrowthFnId) => GROWTH_FNS.find((fn) => fn.id === id)!.f;
  const spread = (values: readonly (number | null)[]): number => {
    const clean = values.filter((v): v is number => v !== null);
    return Math.max(...clean) / Math.min(...clean);
  };

  it('binary search: best case counts exactly 1, worst case exactly ⌊lg n⌋ + 1', () => {
    expect(points(binarySearchExperiment, 'best').every((p) => p.value === 1)).toBe(true);
    for (const p of points(binarySearchExperiment, 'worst')) expect(p.value).toBe(lg(p.n) + 1);
  });
  it('binary search: the worst-case ratio column settles for log n and drifts for n and for 1', () => {
    const worst = points(binarySearchExperiment, 'worst');
    const settled = ratios(worst, f('log n')).slice(5);
    expect(spread(settled)).toBeLessThan(1.1);
    expect(spread(ratios(worst, f('n')))).toBeGreaterThan(100);
    expect(spread(ratios(worst, f('1')))).toBeGreaterThan(1.5);
    expect(spread(ratios(points(binarySearchExperiment, 'best'), f('1')))).toBe(1);
  });
  it('binary search on random present targets is also logarithmic, and below the worst case', () => {
    const random = points(binarySearchExperiment, 'random');
    const worst = points(binarySearchExperiment, 'worst');
    random.forEach((p, i) => expect(p.value).toBeLessThanOrEqual(worst[i]!.value));
    expect(spread(ratios(random, f('log n')).slice(4))).toBeLessThan(1.5);
  });
  it('insertion sort: best case n − 1, worst case n(n − 1)/2, and the ratios follow', () => {
    for (const p of points(insertionSortExperiment, 'sorted')) expect(p.value).toBe(p.n - 1);
    for (const p of points(insertionSortExperiment, 'reversed')) expect(p.value).toBe((p.n * (p.n - 1)) / 2);
    const sorted = points(insertionSortExperiment, 'sorted');
    expect(spread(ratios(sorted, f('n')).slice(2))).toBeLessThan(1.15);
    expect(spread(ratios(sorted, f('n²')))).toBeGreaterThan(30);
    const reversed = points(insertionSortExperiment, 'reversed');
    expect(spread(ratios(reversed, f('n²')).slice(2))).toBeLessThan(1.1);
    expect(spread(ratios(reversed, f('n')))).toBeGreaterThan(10);
  });
  it('insertion sort on random orders is quadratic: about n²/4', () => {
    const random = points(insertionSortExperiment, 'random');
    expect(spread(ratios(random, f('n²')).slice(4))).toBeLessThan(1.2);
    const last = random[random.length - 1]!;
    expect(last.value).toBeGreaterThan(0.2 * last.n * last.n);
    expect(last.value).toBeLessThan(0.3 * last.n * last.n);
  });
});

describe('gathering experiments from modules', () => {
  const experiment = binarySearchExperiment;
  const module = (id: string, loadExperiments?: ModuleManifest['loadExperiments']): ModuleManifest => ({ id, views: [], ...(loadExperiments ? { loadExperiments } : {}) });

  it('groups by module and keeps the order of the modules', async () => {
    const gathered = await gatherExperiments([
      module('analysis', async () => ({ experiments: [experiment] })),
      module('sorting', async () => ({ experiments: [insertionSortExperiment] })),
    ]);
    expect(gathered.groups.map((g) => [g.moduleId, g.title, g.experiments.length])).toEqual([['analysis', 'Analysis', 1], ['sorting', 'Sorting', 1]]);
    expect(gathered.notes).toEqual([]);
  });
  it('survives a rejected loader, a loader that throws at once, and a module with none, each with a note', async () => {
    const gathered = await gatherExperiments([
      module('graphs', () => Promise.reject(new Error('chunk failed'))),
      module('dp', () => { throw new Error('exploded'); }),
      module('reductions'),
      module('structures', async () => ({ experiments: [] })),
      module('analysis', async () => ({ experiments: [experiment] })),
    ]);
    expect(gathered.groups.map((g) => g.moduleId)).toEqual(['analysis']);
    expect(gathered.notes).toHaveLength(4);
    expect(gathered.notes.join('\n')).toContain('chunk failed');
    expect(gathered.notes.join('\n')).toContain('exploded');
    expect(gathered.notes.join('\n')).toContain('NP-completeness: no growth experiments yet.');
  });
  it('skips malformed experiments and repeated ids with a note instead of failing', async () => {
    const broken = { ...experiment, id: 'bad-one', sizes: [1, 2] };
    const gathered = await gatherExperiments([
      module('analysis', async () => ({ experiments: [experiment, broken, { nonsense: true } as unknown as GrowthExperiment] })),
      module('sorting', async () => ({ experiments: [experiment] })),
    ]);
    expect(gathered.groups.map((g) => g.experiments.length)).toEqual([1]);
    expect(gathered.notes.join('\n')).toMatch(/bad-one.*at least 4 sizes/);
    expect(gathered.notes.join('\n')).toContain('another module already uses that id');
  });
  it('an empty module list gives an empty result', async () => {
    expect(await gatherExperiments([])).toEqual({ groups: [], notes: [] });
  });
  it('finds the three sorts by id (without importing the sorting module), and offers only the cases and ops they share', () => {
    const fake = (id: string, caseIds: string[], opIds: string[]): GrowthExperiment => ({
      ...insertionSortExperiment,
      id,
      title: `${id} (details)`,
      cases: caseIds.map((caseId) => ({ id: caseId, label: caseId, claim: { symbol: 'Θ', fn: 'n', when: 'x' } })),
      ops: opIds.map((opId) => ({ id: opId, label: opId, counts: 'x' })),
      primaryOp: opIds[0] ?? 'comparisons',
    });
    const group = {
      moduleId: 'sorting', title: 'Sorting',
      experiments: [
        fake('sorting-quicksort-growth', ['random', 'sorted', 'reversed', 'extra'], ['comparisons', 'swaps', 'writes']),
        fake('unrelated-growth', ['random'], ['comparisons']),
        fake('sorting-heapsort-growth', ['random', 'sorted', 'reversed'], ['comparisons', 'swaps', 'writes']),
        fake('sorting-mergesort-growth', ['sorted', 'random', 'reversed'], ['comparisons', 'writes']),
      ],
    };
    const trio = findSortExperiments([group]);
    expect(trio.map((e) => e.id)).toEqual(['sorting-heapsort-growth', 'sorting-mergesort-growth', 'sorting-quicksort-growth']);
    const common = commonChoices(trio);
    expect(common.cases.map((c) => c.id)).toEqual(['random', 'sorted', 'reversed']);
    expect(common.ops.map((o) => o.id)).toEqual(['comparisons', 'writes']);
    expect(commonChoices([])).toEqual({ cases: [], ops: [] });
    expect(findSortExperiments([])).toEqual([]);
    expect(shortTitle('Quicksort (last-item pivot unless stated)')).toBe('Quicksort');
  });
});

describe('growth-rate arithmetic', () => {
  it('how big an n fits in one second at 10⁹ steps per second', () => {
    const second = BUDGETS.find((b) => b.id === 's')!.seconds;
    const size = (id: GrowthFnId) => maxSizeWithin(id, second);
    expect(size('1')).toEqual({ kind: 'any' });
    expect(size('log n')).toEqual({ kind: 'exponent', exponent: 1e9 });
    expect(size('n')).toEqual({ kind: 'size', n: 1e9 });
    expect(size('n²')).toEqual({ kind: 'size', n: 31622 });
    expect(size('n³')).toEqual({ kind: 'size', n: 1000 });
    expect(size('2^n')).toEqual({ kind: 'size', n: 29 });
    const nlogn = (size('n log n') as { n: number }).n;
    expect(nlogn * Math.log2(nlogn)).toBeLessThanOrEqual(1e9);
    expect((nlogn + 1) * Math.log2(nlogn + 1)).toBeGreaterThan(1e9);
  });
  it('every budget gives a boundary: f(n) fits and f(n + 1) does not', () => {
    for (const budget of BUDGETS.filter((b) => b.seconds <= 86_400)) {
      for (const id of ['n', 'n log n', 'n²', 'n³'] as const) {
        const size = maxSizeWithin(id, budget.seconds);
        if (size.kind !== 'size') continue;
        const f = GROWTH_FNS.find((fn) => fn.id === id)!.f;
        if (size.n >= 1) expect(f(size.n)).toBeLessThanOrEqual(budget.seconds * 1e9);
        expect(f(size.n + 1)).toBeGreaterThan(budget.seconds * 1e9);
      }
    }
  });
  it('words for the sizes', () => {
    expect(describeMaxSize({ kind: 'any' })).toContain('never grows');
    expect(describeMaxSize({ kind: 'size', n: 31622 })).toBe('n up to 31 622');
    expect(describeMaxSize({ kind: 'size', n: 0 })).toBe('not even n = 1');
    expect(describeMaxSize({ kind: 'exponent', exponent: 1e9 })).toContain('2^1 000 000 000');
  });
  it('tables never show Infinity or NaN, however large or odd n is', () => {
    const sizes = [-5, 0, 0.5, 1, 2, 3, 10, 64, 100, 1023, 1024, 1025, 5000, 1e6, 1e9, 1e15, 1e100, 1e300, Number.MAX_VALUE, Infinity, Number.NaN];
    for (const n of sizes) {
      for (const id of RATE_IDS) {
        for (const text of [formatSteps(id, n), timeAt(id, n)]) expect(text, `${id} at ${n}`).not.toMatch(/Infinity|NaN|undefined/);
      }
    }
    for (const log of [null, -20, -9, -7, -3.2, -1, 0, 1, 2.5, 4.6, 7.5, 9, 12, 17, 50, 299, 301, 5000]) expect(formatDuration(log)).not.toMatch(/Infinity|NaN|undefined/);
  });
  it('the numbers are right at small n', () => {
    expect(formatSteps('2^n', 10)).toBe('1 024');
    expect(formatSteps('n²', 12)).toBe('144');
    expect(formatSteps('n log n', 8)).toBe('24');
    expect(formatSteps('log n', 8)).toBe('3');
    expect(formatSteps('1', 99)).toBe('1');
    expect(formatSteps('log n', 1)).toBe('0');
    expect(formatSteps('2^n', 100)).toBe('1.27 × 10³⁰');
    expect(formatSteps('n³', 1e6)).toBe('1.00 × 10¹⁸');
    expect(formatSteps('2^n', 5000)).toMatch(/^\d\.\d\d × 10¹⁵⁰⁵$/);
  });
  it('logarithms of the curves are consistent with the curves', () => {
    for (const id of RATE_IDS) {
      const f = GROWTH_FNS.find((fn) => fn.id === id)!.f;
      const value = f(40);
      expect(Math.abs(10 ** (log10Of(id, 40) ?? Number.NaN) / value - 1)).toBeLessThan(1e-9);
    }
    expect(log10Of('log n', 1)).toBeNull();
    expect(log10Of('n', 0)).toBeNull();
  });
  it('durations read naturally', () => {
    expect(timeAt('n', 1e9)).toBe('1 second');
    expect(timeAt('n', 1000)).toBe('1 µs');
    expect(timeAt('n²', 1e9)).toMatch(/years/);
    expect(timeAt('2^n', 100)).toMatch(/years$/);
    expect(timeAt('1', 5)).toBe('1 ns');
  });
  it('dominance: from which n each curve stays above the previous one', () => {
    expect(overtakesFrom('1', 'log n')).toBe(3);
    expect(overtakesFrom('log n', 'n')).toBe(1);
    expect(overtakesFrom('n', 'n log n')).toBe(3);
    expect(overtakesFrom('n log n', 'n²')).toBe(1);
    expect(overtakesFrom('n²', 'n³')).toBe(2);
    expect(overtakesFrom('n³', '2^n')).toBe(10);
    expect(overtakesFrom('n²', 'n')).toBeNull();
    expect(dominanceLines()).toHaveLength(6);
    expect(dominanceLines().join(' ')).not.toMatch(/Infinity|NaN/);
    expect(dominanceLines()[5]).toBe('2ⁿ is above n³ from n = 10 on, and for good.');
  });
  it('where a curve leaves the chart', () => {
    expect(leavesAt('n²', 100, 50)).toBe(11);
    expect(leavesAt('n', 100, 50)).toBeNull();
    expect(leavesAt('2^n', 1000, 64)).toBe(10);
  });
  it('URL codes round trip and unknown codes are ignored', () => {
    expect(ratesFromCodes(RATE_IDS.map((id) => RATE_CODE[id]).join(','), [])).toEqual(RATE_IDS);
    expect(ratesFromCodes('n,zzz,e', [])).toEqual(['n', '2^n']);
    expect(ratesFromCodes(undefined, ['n'])).toEqual(['n']);
    expect(ratesFromCodes('', ['n'])).toEqual([]);
  });
});
