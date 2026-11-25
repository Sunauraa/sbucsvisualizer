import { describe, expect, it } from 'vitest';
import { createRng, experimentProblems, measureAt, ratios, GROWTH_FNS } from '@core';
import type { GrowthFnId } from '@core';
import { heapsort } from './heapsort';
import { mergesort } from './mergesort';
import { quicksort } from './quicksort';
import { experiments, sortInputFor } from './experiments';
import { generateKeys, INPUT_KINDS, MAX_ITEMS, parseSortItems, seedFrom, sizeFrom } from './inputs';
import { describeRanking, finishTick, laneIndex, raceLength, rankLanes } from './race';
import { layoutTree, levelCosts, levelSummary } from './tree';

const frames = (...comparisons: number[]) => comparisons.map((c) => ({ ops: { comparisons: c } }));

describe('race alignment', () => {
  const lane = frames(0, 0, 1, 1, 1, 2, 3, 3);
  it('one tick is one comparison: the lane shows its last frame with at most that many comparisons', () => {
    expect(laneIndex(lane, 0, 'comparisons')).toBe(1);
    expect(laneIndex(lane, 1, 'comparisons')).toBe(4);
    expect(laneIndex(lane, 2, 'comparisons')).toBe(5);
    expect(laneIndex(lane, 3, 'comparisons')).toBe(7);
  });
  it('a lane that is done stays on its final frame', () => {
    expect(laneIndex(lane, 99, 'comparisons')).toBe(7);
    expect(laneIndex(lane, 99, 'steps')).toBe(7);
  });
  it('steps mode shows frame t', () => {
    expect(laneIndex(lane, 3, 'steps')).toBe(3);
    expect(laneIndex(lane, -4, 'steps')).toBe(0);
  });
  it('the finish tick is the total comparisons, or the last step', () => {
    expect(finishTick(lane, 'comparisons')).toBe(3);
    expect(finishTick(lane, 'steps')).toBe(7);
  });
  it('the race lasts until the slowest lane is done', () => {
    expect(raceLength([lane, frames(0, 5)], 'comparisons')).toBe(6);
    expect(raceLength([lane, frames(0, 5)], 'steps')).toBe(8);
    expect(raceLength([], 'steps')).toBe(1);
  });
  it('a lane with no comparisons at all (one item) is done at tick 0', () => {
    expect(laneIndex(frames(0, 0), 0, 'comparisons')).toBe(1);
    expect(finishTick(frames(0, 0), 'comparisons')).toBe(0);
  });
  it('works on real traces: at every tick the shown frame has at most that many comparisons, and it is the last such', () => {
    const items = createRng(3).shuffle(Array.from({ length: 12 }, (_, i) => i));
    for (const algorithm of [heapsort, mergesort, quicksort]) {
      const { frames: f } = algorithm.run({ items });
      for (let tick = 0; tick <= 60; tick += 1) {
        const at = laneIndex(f, tick, 'comparisons');
        expect(f[at]!.ops['comparisons']).toBeLessThanOrEqual(tick);
        if (at + 1 < f.length) expect(f[at + 1]!.ops['comparisons']).toBeGreaterThan(tick);
      }
    }
  });
});

describe('race ranking in words', () => {
  const lanes = [{ name: 'Heapsort', tick: 30 }, { name: 'Mergesort', tick: 20 }, { name: 'Quicksort', tick: 30 }];
  it('nobody has finished at the start', () => {
    expect(rankLanes(lanes, 0)).toEqual([]);
    expect(describeRanking(lanes, 0, 'comparisons')).toEqual(['Still running: Heapsort, Mergesort and Quicksort.']);
  });
  it('places are shared on a tie', () => {
    expect(rankLanes(lanes, 40).map((g) => [g.place, g.names])).toEqual([[1, ['Mergesort']], [2, ['Heapsort', 'Quicksort']]]);
  });
  it('the sentences name the winner, the tie and the units', () => {
    expect(describeRanking(lanes, 40, 'comparisons')).toEqual([
      '1st: Mergesort, after 20 comparisons.',
      '2nd, tied: Heapsort and Quicksort, each after 30 comparisons.',
    ]);
    expect(describeRanking(lanes, 25, 'steps')).toEqual(['1st: Mergesort, after 20 steps.', 'Still running: Heapsort and Quicksort.']);
  });
  it('a tie for first puts the next lane third', () => {
    const tied = [{ name: 'A', tick: 1 }, { name: 'B', tick: 1 }, { name: 'C', tick: 2 }];
    expect(rankLanes(tied, 5).map((g) => g.place)).toEqual([1, 3]);
    expect(describeRanking([{ name: 'A', tick: 1 }], 1, 'comparisons')).toEqual(['1st: A, after 1 comparison.']);
  });
});

describe('recursion-tree layout', () => {
  const finalNodes = (items: number[], pivot?: 'last' | 'median-of-three') => {
    const trace = quicksort.run({ items, ...(pivot ? { pivot } : {}) });
    return trace.frames[trace.frames.length - 1]!.state.nodes;
  };
  it('places every node, children below parents, siblings apart, nothing overlapping on a row', () => {
    const merge = mergesort.run({ items: createRng(2).shuffle(Array.from({ length: 13 }, (_, i) => i)) });
    for (const nodes of [merge.frames[merge.frames.length - 1]!.state.nodes, finalNodes([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5])]) {
      const layout = layoutTree(nodes);
      for (const node of nodes) {
        const at = layout.placed[node.id]!;
        expect(at.y).toBeGreaterThan(0);
        expect(at.x - at.w / 2).toBeGreaterThanOrEqual(-0.01);
        expect(at.x + at.w / 2).toBeLessThanOrEqual(layout.width + 0.01);
        if (node.parent !== null) expect(at.y).toBeGreaterThan(layout.placed[node.parent]!.y);
      }
      for (const a of nodes) {
        for (const b of nodes) {
          if (a.id >= b.id || a.depth !== b.depth) continue;
          const pa = layout.placed[a.id]!;
          const pb = layout.placed[b.id]!;
          expect(Math.abs(pa.x - pb.x), `nodes ${a.id} and ${b.id} overlap`).toBeGreaterThanOrEqual((pa.w + pb.w) / 2 - 0.01);
        }
      }
      expect(layout.height).toBeGreaterThan(Math.max(...nodes.map((node) => layout.placed[node.id]!.y)));
    }
  });
  it('a sorted list with the last pivot is a path: one node per level', () => {
    const layout = layoutTree(finalNodes([1, 2, 3, 4, 5, 6, 7]));
    expect(layout.depthCount).toBe(7);
    expect(layout.placed.length).toBe(7);
  });
  it('an empty tree has a layout too', () => {
    expect(layoutTree([]).placed).toEqual([]);
  });
  it('level costs add up to the total comparisons of the sort, and a level never costs more than its items', () => {
    for (const algorithm of [mergesort, quicksort]) {
      const trace = algorithm.run({ items: createRng(8).shuffle(Array.from({ length: 20 }, (_, i) => i)) });
      const last = trace.frames[trace.frames.length - 1]!;
      const rows = levelCosts(last.state.nodes);
      expect(rows.reduce((sum, row) => sum + row.comparisons, 0)).toBe(last.ops['comparisons']);
      for (const row of rows) expect(row.comparisons).toBeLessThanOrEqual(row.items);
      expect(rows[0]!.items).toBe(20);
    }
  });
  it('mergesort levels each handle every item, so levels × work per level is the cost', () => {
    const trace = mergesort.run({ items: Array.from({ length: 16 }, (_, i) => 16 - i) });
    const rows = levelCosts(trace.frames[trace.frames.length - 1]!.state.nodes);
    expect(rows.length).toBe(5);
    expect(rows.map((row) => row.items)).toEqual([16, 16, 16, 16, 16]);
    expect(levelSummary(trace.frames[trace.frames.length - 1]!.state.nodes, 16)).toContain('5 levels');
  });
  it('a degenerate quicksort level costs one fewer comparison each level', () => {
    const trace = quicksort.run({ items: [1, 2, 3, 4, 5] });
    expect(levelCosts(trace.frames[trace.frames.length - 1]!.state.nodes).map((row) => row.comparisons)).toEqual([4, 3, 2, 1, 0]);
  });
  it('quicksort nodes carry the pivot and are all done at the end; mergesort leaves are done at once', () => {
    const nodes = finalNodes([4, 2, 6, 1]);
    expect(nodes.every((node) => node.status === 'done' && node.out !== null)).toBe(true);
    expect(nodes.filter((node) => node.hi - node.lo > 1).every((node) => node.pivot !== null)).toBe(true);
    expect(levelSummary([], 0)).toBe('No calls yet.');
  });
});

describe('input generators and parsing', () => {
  it.each(INPUT_KINDS)('$id is deterministic, the right size and within bounds', ({ id }) => {
    const a = generateKeys(id, 12, 5);
    expect(a).toEqual(generateKeys(id, 12, 5));
    expect(a).toHaveLength(12);
    expect(a.every((key) => Number.isInteger(key) && key >= 1 && key <= 99)).toBe(true);
    expect(generateKeys(id, 0, 1)).toEqual([]);
    expect(generateKeys(id, 1, 1)).toHaveLength(1);
  });
  it('shapes: sorted, reversed, few distinct, all equal, nearly sorted, random differs by seed', () => {
    const sorted = [...generateKeys('sorted', 9, 1)];
    expect(generateKeys('reversed', 9, 1)).toEqual([...sorted].reverse());
    expect(new Set(generateKeys('few', 24, 1)).size).toBeLessThanOrEqual(3);
    expect(new Set(generateKeys('equal', 9, 1)).size).toBe(1);
    const nearly = generateKeys('nearly', 16, 3);
    expect(nearly).not.toEqual(generateKeys('sorted', 16, 3));
    expect(nearly.filter((key, i) => key !== i + 1).length).toBeLessThanOrEqual(8);
    expect(generateKeys('random', 12, 1)).not.toEqual(generateKeys('random', 12, 2));
  });
  it('the typed list is limited to 24 items and says what is wrong', () => {
    expect(parseSortItems('5, 3 8')).toEqual({ ok: true, value: [5, 3, 8] });
    expect(parseSortItems('')).toEqual({ ok: true, value: [] });
    const long = parseSortItems(Array.from({ length: MAX_ITEMS + 1 }, (_, i) => i).join(' '));
    expect(long.ok).toBe(false);
    expect(parseSortItems('4 x')).toMatchObject({ ok: false, message: '"x" is not a whole number.' });
    expect(parseSortItems('5000')).toMatchObject({ ok: false });
  });
  it('sizes and seeds from the URL fall back instead of failing', () => {
    expect(sizeFrom('9', 5)).toBe(9);
    expect(sizeFrom('99', 5)).toBe(MAX_ITEMS);
    expect(sizeFrom('-3', 5)).toBe(0);
    expect(sizeFrom('abc', 5)).toBe(5);
    expect(sizeFrom(undefined, 5)).toBe(5);
    expect(seedFrom('12')).toBe(12);
    expect(seedFrom('x')).toBe(373);
    expect(seedFrom('-1')).toBe(373);
  });
});

describe('sorting growth experiments', () => {
  it.each(experiments)('$id is valid and cheap', (experiment) => {
    expect(experimentProblems(experiment)).toEqual([]);
    const started = Date.now();
    for (const { id } of experiment.cases) for (const n of experiment.sizes) measureAt(experiment, id, n, 1);
    expect(Date.now() - started).toBeLessThan(800);
  });
  it('all three sorts see exactly the same list for the same seed, size and case', () => {
    const [heap, merge] = experiments;
    for (const caseId of ['random', 'sorted', 'reversed']) {
      const n = 32;
      const keys = sortInputFor(n, caseId, createRng(1 * 1_000_003 + n));
      expect(measureAt(merge!, caseId, n, 1)).toEqual(mergesort.run({ items: keys }, { mode: 'counts' }).totals);
      expect(measureAt(heap!, caseId, n, 1)).toEqual(heapsort.run({ items: keys }, { mode: 'counts' }).totals);
    }
  });
  it('quicksort on sorted input makes n(n−1)/2 comparisons, on random input far fewer', () => {
    const quick = experiments[2]!;
    expect(measureAt(quick, 'sorted', 64, 1)['comparisons']).toBe(64 * 63 / 2);
    expect(measureAt(quick, 'random', 256, 1)['comparisons']).toBeLessThan(256 * 255 / 2 / 4);
    expect(measureAt(quick, 'sorted-random-pivot', 256, 1)['comparisons']).toBeLessThan(256 * 255 / 2 / 4);
  });
  it('ratio columns settle for the claimed growth and drift for wrong ones', () => {
    const ratioFor = (id: string, caseId: string, fn: GrowthFnId): number[] => {
      const experiment = experiments.find((e) => e.id === id)!;
      const points = experiment.sizes.map((n) => ({ n, value: measureAt(experiment, caseId, n, 7)['comparisons']! }));
      return ratios(points, GROWTH_FNS.find((f) => f.id === fn)!.f) as number[];
    };
    const spread = (values: number[]): number => Math.max(...values) / Math.min(...values);
    // quicksort sorted: n² settles, n log n drifts upward a lot
    expect(spread(ratioFor('sorting-quicksort-growth', 'sorted', 'n²').slice(2))).toBeLessThan(1.15);
    expect(spread(ratioFor('sorting-quicksort-growth', 'sorted', 'n log n').slice(2))).toBeGreaterThan(3);
    // mergesort: n log n settles, n² collapses
    expect(spread(ratioFor('sorting-mergesort-growth', 'random', 'n log n').slice(2))).toBeLessThan(1.3);
    expect(spread(ratioFor('sorting-mergesort-growth', 'random', 'n²').slice(2))).toBeGreaterThan(5);
    // heapsort
    expect(spread(ratioFor('sorting-heapsort-growth', 'random', 'n log n').slice(2))).toBeLessThan(1.3);
  });
});
