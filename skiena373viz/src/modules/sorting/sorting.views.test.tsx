// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRng } from '@core';
import { checkRenderer } from '@ui/testing';
import { heapsort } from './algorithms/heapsort';
import { mergesort } from './algorithms/mergesort';
import { quicksort } from './algorithms/quicksort';
import { heapLayout } from './HeapTree';
import HeapsortView, { HeapsortRenderer } from './HeapsortView';
import MergesortView, { MergesortRenderer } from './MergesortView';
import QuicksortView, { QuicksortRenderer } from './QuicksortView';
import RaceView from './RaceView';
import RecursionTreeView, { MergeTreeRenderer, QuickTreeRenderer } from './RecursionTreeView';
import { checkSampled } from './sampledRenderer';
import manifest from './index';

const noop = () => undefined;
const twenty4 = createRng(4).shuffle(Array.from({ length: 24 }, (_, i) => i - 5));

// The first preset of each sort is drawn frame by frame; the others at the first frame, the last and every 4th (the full 24-item run below covers the rest).
const each = <I,>(presets: readonly { readonly id: string; readonly input: I }[]) => presets.map((p, i) => [p.id, p.input, i === 0] as const);
describe('renderers draw every frame of every preset without leaking raw values or moving the page', () => {
  it.each(each(heapsort.presets))('heapsort %s', (_id, input, full) => { (full ? checkRenderer : checkSampled)(HeapsortRenderer, heapsort.run(input)); });
  it.each(each(mergesort.presets))('mergesort %s', (_id, input, full) => {
    const check = full ? checkRenderer : checkSampled;
    check(MergesortRenderer, mergesort.run(input));
    check(MergeTreeRenderer, mergesort.run(input));
  });
  it.each(each(quicksort.presets))('quicksort %s', (_id, input, full) => {
    const check = full ? checkRenderer : checkSampled;
    check(QuicksortRenderer, quicksort.run(input));
    check(QuickTreeRenderer, quicksort.run(input));
  });
  it('the full 24-item limit, with duplicates, negatives and every pivot rule (every 4th frame; every frame of the array view of the last-item rule)', () => {
    const keys = twenty4.map((key, i) => (i % 5 === 0 ? 3 : key));
    checkSampled(HeapsortRenderer, heapsort.run({ items: keys }));
    checkSampled(MergesortRenderer, mergesort.run({ items: keys }));
    for (const pivot of ['random', 'median-of-three'] as const) {
      checkSampled(QuicksortRenderer, quicksort.run({ items: keys, pivot }));
      checkSampled(QuickTreeRenderer, quicksort.run({ items: keys, pivot }));
    }
    checkRenderer(QuicksortRenderer, quicksort.run({ items: keys, pivot: 'last' }));
    checkSampled(QuickTreeRenderer, quicksort.run({ items: keys, pivot: 'last' }), 2);
  });
  it('empty, single and rejected inputs', () => {
    for (const items of [[], [4]]) {
      checkRenderer(HeapsortRenderer, heapsort.run({ items }));
      checkRenderer(MergesortRenderer, mergesort.run({ items }));
      checkRenderer(QuicksortRenderer, quicksort.run({ items }));
      checkRenderer(MergeTreeRenderer, mergesort.run({ items }));
    }
    checkRenderer(QuicksortRenderer, quicksort.run({ items: [1, Number.NaN] }));
  });
  it('the heap layout depends on n only and keeps nodes apart', () => {
    for (const n of [0, 1, 2, 7, 24]) {
      const layout = heapLayout(n);
      expect(layout.at).toHaveLength(n);
      const bottom = layout.at.filter((p) => p.y === Math.max(...layout.at.map((q) => q.y)));
      for (let i = 1; i < bottom.length; i += 1) expect(bottom[i]!.x - bottom[i - 1]!.x).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('the manifest', () => {
  it('lists the race first, so it is the landing page, then the four other views', () => {
    expect(manifest.views.map((view) => view.id)).toEqual(['race', 'heapsort', 'mergesort', 'quicksort', 'recursion-tree']);
  });
});

describe.each([
  ['heapsort', HeapsortView], ['mergesort', MergesortView], ['quicksort', QuicksortView], ['recursion tree', RecursionTreeView], ['race', RaceView],
])('%s view', (_name, View) => {
  it('explains a bad list instead of crashing, and keeps showing the last valid run', () => {
    render(<View params={{ a: '3, one, 2' }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('"one" is not a whole number.');
    expect(screen.getByRole('button', { name: /Play/ })).toBeInTheDocument();
  });
  it('says what the limit is when the list is too long', () => {
    render(<View params={{ a: Array.from({ length: 25 }, (_, i) => i).join(' ') }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('limit here is 24');
  });
  it('writes the input to the URL, and the generated list shows in the field', () => {
    const setParams = vi.fn();
    const { unmount } = render(<View params={{ kind: 'reversed', n: '5' }} setParams={setParams} />);
    expect(screen.getByLabelText('Items')).toHaveValue('5, 4, 3, 2, 1');
    fireEvent.change(screen.getByLabelText('Items'), { target: { value: '9 8' } });
    expect(setParams).toHaveBeenCalledWith({ a: '9 8', kind: null });
    fireEvent.click(screen.getByRole('button', { name: 'New random input' }));
    expect(setParams).toHaveBeenCalledWith({ kind: 'reversed', a: null, n: '5', seed: '374' });
    unmount();
  });
  it('an empty list is a labelled empty state with the player still usable', () => {
    render(<View params={{ a: '' }} setParams={noop} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText(/empty|nothing to sort/i).length).toBeGreaterThan(0);
  });
});

describe('race view', () => {
  const lane = (name: RegExp) => screen.getByRole('region', { name });
  const comparisons = (region: HTMLElement) => Number(within(region).getByText('Comparisons').nextSibling?.textContent);

  it('starts at tick 0 with three lanes, nobody finished, no lane ahead', () => {
    render(<RaceView params={{ a: '4 3 2 1' }} setParams={noop} />);
    expect(screen.getAllByText('running')).toHaveLength(3);
    expect(comparisons(lane(/Heapsort lane/))).toBe(0);
    expect(screen.getByText(/Still running: Heapsort, Mergesort and Quicksort/)).toBeInTheDocument();
  });

  it('one tick is one comparison: no lane ever shows more comparisons than the tick', () => {
    render(<RaceView params={{ a: '5 2 9 1 7 3 8 4 6' }} setParams={noop} />);
    const step = screen.getByRole('button', { name: /Step/ });
    for (let tick = 1; tick <= 12; tick += 1) {
      fireEvent.click(step);
      for (const name of [/Heapsort lane/, /Mergesort lane/, /Quicksort .* lane/]) {
        expect(comparisons(lane(name))).toBeLessThanOrEqual(tick);
      }
    }
  });

  it('at the end every lane is finished and the finishing order names all three', () => {
    render(<RaceView params={{ a: '5 2 9 1 7 3 8 4 6' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(screen.getAllByText('✓ finished')).toHaveLength(3);
    const order = screen.getByRole('region', { name: 'Finishing order' }).textContent ?? '';
    expect(order).toMatch(/1st/);
    for (const name of ['Heapsort', 'Mergesort', 'Quicksort']) expect(order).toContain(name);
    expect(order).not.toMatch(/Still running/);
  });

  it('sorted input: quicksort with the last pivot is ranked last', () => {
    render(<RaceView params={{ a: '1 2 3 4 5 6 7 8 9 10 11 12' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    const items = within(screen.getByRole('region', { name: 'Finishing order' })).getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items[items.length - 1]).toMatch(/Quicksort/);
  });

  it('switching to recorded steps writes align=steps to the URL, and steps mode shows frame t', () => {
    const setParams = vi.fn();
    const { rerender } = render(<RaceView params={{ a: '3 1 2' }} setParams={setParams} />);
    fireEvent.click(screen.getByLabelText(/one recorded step/));
    expect(setParams).toHaveBeenCalledWith({ align: 'steps' });
    rerender(<RaceView params={{ a: '3 1 2', align: 'steps' }} setParams={setParams} />);
    expect(screen.getByLabelText(/one recorded step/)).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Step/ }));
    expect(screen.getByText(/Step 1:/)).toBeInTheDocument();
  });

  it('an empty list and a single item finish at once without errors', () => {
    const { unmount } = render(<RaceView params={{ a: '' }} setParams={noop} />);
    expect(screen.getAllByText('✓ finished')).toHaveLength(3);
    unmount();
    render(<RaceView params={{ a: '7' }} setParams={noop} />);
    expect(screen.getAllByText('✓ finished')).toHaveLength(3);
  });
});

describe('recursion tree view', () => {
  it('the cost table has the same number of rows at the first and the last step, so the page never jumps', () => {
    render(<RecursionTreeView params={{ alg: 'quicksort', a: '1 2 3 4 5 6' }} setParams={noop} />);
    const rows = () => within(screen.getByRole('table')).getAllByRole('row').length;
    const before = rows();
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(rows()).toBe(before);
  });
  it('shows the cost table and a quicksort path for a sorted list', () => {
    render(<RecursionTreeView params={{ alg: 'quicksort', a: '1 2 3 4 5 6' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText(/6 levels of calls so far/)).toBeInTheDocument();
  });
  it('mergesort shows about log n levels', () => {
    render(<RecursionTreeView params={{ a: '8 7 6 5 4 3 2 1' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(screen.getByText(/4 levels of calls so far/)).toBeInTheDocument();
  });
});
