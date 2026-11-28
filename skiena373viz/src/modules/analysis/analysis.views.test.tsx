// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GrowthExperiment, ModuleManifest } from '@core';
import { ModulesContext } from '@ui';
import { checkRenderer } from '@ui/testing';
import { binarySearch } from './algorithms/binarySearch';
import { insertionSortExperiment } from './algorithms/insertionSort';
import GrowthRatesView from './GrowthRatesView';
import HalvingView, { BinarySearchRenderer } from './HalvingView';
import MeasuredView from './MeasuredView';
import analysis from './index';

const noop = () => undefined;
const noBadText = (): void => {
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/Infinity|NaN|undefined|\[object/);
};

describe('manifest', () => {
  it('lands on growth rates and has the three views', () => {
    expect(analysis.views.map((v) => v.id)).toEqual(['growth-rates', 'measured', 'halving']);
    expect(analysis.loadExperiments).toBeDefined();
  });
});

describe('binary search renderer', () => {
  it.each(binarySearch.presets.map((p) => [p.id, p.input] as const))('every frame of preset %s renders', (_id, input) => {
    checkRenderer(BinarySearchRenderer, binarySearch.run(input));
  });
});

describe('halving view', () => {
  it('says that the order check is only a guard, and that binary search trusts its precondition (R3)', () => {
    render(<HalvingView params={{}} setParams={noop} />);
    expect(screen.getByText('The order check costs n − 1 comparisons and is here only to refuse unsorted input; binary search itself trusts its precondition.')).toBeInTheDocument();
  });
});

describe('growth rates view', () => {
  it('shows every table without raw Infinity or NaN, at hostile settings too', () => {
    const cases: Record<string, string>[] = [
      {}, { fns: 'c,l,n,nl,n2,n3,e', max: '200', scale: 'log', n: '1000000000' },
      { fns: 'e', max: '4', n: '1' }, { fns: '', n: '5000' }, { fns: 'n3,e', max: '200', h: '100' }, { n: 'abc', max: 'zzz', h: 'q', t: 'nope' },
    ];
    for (const params of cases) {
      const { unmount } = render(<GrowthRatesView params={params} setParams={noop} />);
      noBadText();
      expect(screen.getAllByRole('table')).toHaveLength(2);
      unmount();
    }
  });
  it('the dominance list says "grows slowest", "grows fastest" and "grows faster than the one before it", never a bare "faster" or "slowest" (R8)', () => {
    render(<GrowthRatesView params={{}} setParams={noop} />);
    const panel = screen.getByRole('region', { name: 'Which grows faster' });
    const items = within(panel).getAllByRole('listitem').slice(0, 7).map((li) => li.textContent ?? '');
    expect(items).toHaveLength(7);
    expect(items[0]).toMatch(/; grows slowest\.$/);
    expect(items[6]).toMatch(/; grows fastest\.$/);
    for (const item of items.slice(1, 6)) expect(item).toMatch(/; grows faster than the one before it\.$/);
    const all = items.join(' ');
    expect(all).not.toMatch(/the slowest here|the fastest here/);
    expect(all).not.toMatch(/; faster than/);
  });
  it('says which curves leave the chart instead of drawing a wall', () => {
    render(<GrowthRatesView params={{ fns: 'n,n2,e', max: '60' }} setParams={noop} />);
    expect(screen.getByText(/2ⁿ rises past the top of the chart at n = \d+ and is not drawn beyond that point/)).toBeInTheDocument();
  });
  it('the one-second table and the value table agree with the arithmetic', () => {
    render(<GrowthRatesView params={{ n: '10' }} setParams={noop} />);
    const sizes = screen.getByRole('table', { name: /largest n/i });
    expect(within(sizes).getByText(/^n up to 31\s622$/)).toBeInTheDocument();
    expect(within(sizes).getByText('n up to 29')).toBeInTheDocument();
    const values = screen.getByRole('table', { name: /Steps f\(n\)/ });
    expect(within(values).getByText(/^1\s024$/)).toBeInTheDocument();
  });
  it('writes the choices to the URL', () => {
    const setParams = vi.fn();
    render(<GrowthRatesView params={{}} setParams={setParams} />);
    fireEvent.click(screen.getByLabelText('log-log'));
    expect(setParams).toHaveBeenCalledWith({ scale: 'log' });
    fireEvent.click(screen.getByLabelText('n³'));
    expect(setParams).toHaveBeenCalledWith({ fns: 'l,n,nl,n2,n3,e' });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'n' }), { target: { value: '50' } });
    expect(setParams).toHaveBeenCalledWith({ n: '50' });
    fireEvent.change(screen.getByLabelText('Time available, at 10⁹ steps per second'), { target: { value: 'h' } });
    expect(setParams).toHaveBeenCalledWith({ t: 'h' });
  });
  it('the chart is keyboard operable: arrows move the marked n', () => {
    const setParams = vi.fn();
    render(<GrowthRatesView params={{ n: '10' }} setParams={setParams} />);
    const chart = screen.getByRole('img', { name: /Growth curves/ });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(setParams).toHaveBeenCalledWith({ n: '11' });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(setParams).toHaveBeenCalledWith({ n: '9' });
  });
  it('an empty selection says so and does not crash', () => {
    render(<GrowthRatesView params={{ fns: '' }} setParams={noop} />);
    expect(screen.getByText(/no curve selected/)).toBeInTheDocument();
  });
});

describe('halving view', () => {
  it('explains a bad list instead of crashing', () => {
    render(<HalvingView params={{ a: '3, x' }} setParams={noop} />);
    expect(screen.getByRole('alert')).toHaveTextContent('"x" is not a whole number.');
  });
  it('refuses an unsorted array at its own check and names the pair', () => {
    render(<HalvingView params={{ a: '4, 9, 7, 12', t: '12' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(screen.getAllByText(/9 at position 1 is larger than 7 at position 2/).length).toBeGreaterThan(0);
  });
  it('shows the halving chain for n', () => {
    render(<HalvingView params={{ a: '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16', t: '16' }} setParams={noop} />);
    expect(screen.getByText('16 → 8 → 4 → 2 → 1')).toBeInTheDocument();
    expect(screen.getByText(/at most ⌊lg n⌋ \+ 1 = 5 comparisons/)).toBeInTheDocument();
  });
  it('the sort button writes the sorted list; an empty array is a labelled empty state', () => {
    const setParams = vi.fn();
    const { unmount } = render(<HalvingView params={{ a: '5, 1, 3' }} setParams={setParams} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort the list for me' }));
    expect(setParams).toHaveBeenCalledWith({ a: '1, 3, 5' });
    unmount();
    render(<HalvingView params={{ a: '' }} setParams={noop} />);
    expect(screen.getByText('nothing: n is 0')).toBeInTheDocument();
  });
});

describe('measured view', () => {
  const trio = ['heapsort', 'mergesort', 'quicksort'].map((name): GrowthExperiment => ({
    ...insertionSortExperiment, id: `sorting-${name}-growth`, title: name[0]?.toUpperCase() + name.slice(1),
  }));
  const module = (id: string, loadExperiments?: ModuleManifest['loadExperiments']): ModuleManifest => ({ id, views: [], ...(loadExperiments ? { loadExperiments } : {}) });
  const modules = (...list: ModuleManifest[]) => list;
  const show = (list: readonly ModuleManifest[]) => (
    <ModulesContext.Provider value={list}><MeasuredView params={{}} setParams={noop} /></ModulesContext.Provider>
  );

  it('says it is loading, then lists each module with its experiments and notes the others', async () => {
    render(show(modules(
      module('sorting', async () => ({ experiments: trio })),
      module('graphs', () => Promise.reject(new Error('chunk failed'))),
      module('dp'),
      module('analysis', async () => analysis.loadExperiments!()),
    )));
    expect(screen.getByText(/Loading experiments/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/5 experiments from 2 modules/)).toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Sorting experiments' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Analysis experiments' })).toBeInTheDocument();
    expect(screen.getByText(/Graphs: its experiments could not be loaded \(chunk failed\)/)).toBeInTheDocument();
    expect(screen.getByText(/Dynamic programming: no growth experiments yet/)).toBeInTheDocument();
    noBadText();
  });

  it('plots the three sorts together, and picks up a module that arrives later', async () => {
    const { rerender } = render(show(modules(module('analysis', async () => analysis.loadExperiments!()))));
    await waitFor(() => expect(screen.getByText(/2 experiments from 1 module\./)).toBeInTheDocument());
    expect(screen.getByText(/sorting module's experiments are not available/)).toBeInTheDocument();
    await act(async () => {
      rerender(show(modules(module('analysis', async () => analysis.loadExperiments!()), module('sorting', async () => ({ experiments: trio })))));
    });
    await waitFor(() => expect(screen.getByText(/5 experiments from 2 modules/)).toBeInTheDocument());
    const comparison = screen.getByRole('region', { name: 'Comparison of the three sorts' });
    expect(within(comparison).getByRole('img', { name: /Comparisons of the sorts/ })).toBeInTheDocument();
    for (const name of ['Heapsort', 'Mergesort', 'Quicksort']) expect(within(comparison).getAllByText(name).length).toBeGreaterThan(0);
  });

  it('with no modules at all it says so and does not crash', async () => {
    render(show([]));
    await waitFor(() => expect(screen.getByText(/0 experiments from 0 modules/)).toBeInTheDocument());
  });

  it('a new seed is written to the URL, and plots can be shown and hidden', async () => {
    const setParams = vi.fn();
    render(<ModulesContext.Provider value={modules(module('analysis', async () => analysis.loadExperiments!()))}><MeasuredView params={{ seed: '5' }} setParams={setParams} /></ModulesContext.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hide plots' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Measure again on new random inputs' }));
    expect(setParams).toHaveBeenCalledWith({ seed: '6' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide plots' }));
    expect(screen.getByRole('button', { name: 'Show plots' })).toHaveAttribute('aria-expanded', 'false');
  });
});
