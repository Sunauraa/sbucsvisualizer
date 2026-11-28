// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkRenderer } from '@ui/testing';
import { bst } from './algorithms/bst';
import { hashChaining } from './algorithms/hashChaining';
import { hashProbing } from './algorithms/hashProbing';
import { heap } from './algorithms/heap';
import BstView from './BstView';
import { BstRenderer } from './BstRenderer';
import { ChainingRenderer } from './ChainingRenderer';
import HashChainingView from './HashChainingView';
import HashProbingView from './HashProbingView';
import { HeapRenderer } from './HeapRenderer';
import HeapView from './HeapView';
import manifest from './index';
import { ProbingRenderer } from './ProbingRenderer';

describe('renderers draw every frame of every preset', () => {
  it.each(bst.presets.map((p) => [p.id, p.input] as const))('binary search tree: %s', (_id, input) => {
    checkRenderer(BstRenderer, bst.run(input));
  });
  it.each(heap.presets.map((p) => [p.id, p.input] as const))('heap: %s', (_id, input) => {
    checkRenderer(HeapRenderer, heap.run(input));
  });
  it.each(hashChaining.presets.map((p) => [p.id, p.input] as const))('chaining: %s', (_id, input) => {
    checkRenderer(ChainingRenderer, hashChaining.run(input));
  });
  it.each(hashProbing.presets.map((p) => [p.id, p.input] as const))('probing: %s', (_id, input) => {
    checkRenderer(ProbingRenderer, hashProbing.run(input));
  });
});

describe('manifest', () => {
  it('declares four views that load', async () => {
    expect(manifest.views.map((v) => v.id)).toEqual(['bst', 'heap', 'hash-chaining', 'hash-probing']);
    for (const view of manifest.views) expect(typeof (await view.load()).default).toBe('function');
    const { experiments } = (await manifest.loadExperiments?.()) ?? { experiments: [] };
    expect(experiments.map((e) => e.id)).toEqual([
      'structures-bst-growth', 'structures-heap-build-growth', 'structures-hash-chaining-growth', 'structures-hash-probing-growth',
    ]);
  });
});

const views = [
  ['bst', BstView, 'insert 99'],
  ['heap', HeapView, 'insert 99'],
  ['chaining', HashChainingView, 'insert 99'],
  ['probing', HashProbingView, 'insert 99'],
] as const;

describe.each(views)('%s view', (_name, View, text) => {
  it('explains bad operations instead of crashing, and keeps the last good run', () => {
    render(<View params={{ o: 'insert 5, frobnicate 3' }} setParams={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown operation "frobnicate" in "frobnicate 3"');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('explains a missing key and too many operations', () => {
    const { unmount } = render(<View params={{ o: 'insert' }} setParams={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('"insert" needs a key, such as "insert 5".');
    unmount();
    render(<View params={{ o: Array.from({ length: 25 }, (_, i) => `insert ${i}`).join(', ') }} setParams={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('That is 25 operations; the limit is 24.');
  });

  it('explains a bad starting list', () => {
    render(<View params={{ s: '1, two' }} setParams={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Starting key "two" is not a whole number.');
  });

  it('appends one operation with a button, through the URL', () => {
    const setParams = vi.fn();
    render(<View params={{ o: 'search 1' }} setParams={setParams} />);
    fireEvent.change(screen.getByLabelText('Key to add'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '+ insert' }));
    expect(setParams).toHaveBeenCalledWith({ o: `search 1, ${text}` });
  });

  it('keeps the buttons that need a key disabled until the key is a number', () => {
    render(<View params={{}} setParams={() => undefined} />);
    expect(screen.getByRole('button', { name: '+ insert' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Key to add'), { target: { value: '12x' } });
    expect(screen.getByRole('alert')).toHaveTextContent('needs a whole number');
  });

  it('draws a stage, the operation list and the growth plot', () => {
    render(<View params={{}} setParams={() => undefined} />);
    expect(screen.getByRole('region', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Growth plot' })).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('a new random input writes a seed to the URL', () => {
    const setParams = vi.fn();
    render(<View params={{ r: '4' }} setParams={setParams} />);
    fireEvent.click(screen.getByRole('button', { name: 'New random input' }));
    expect(setParams.mock.calls[0]?.[0]).toMatchObject({ r: '5' });
  });
});

describe('hash views', () => {
  it('offer table sizes from 1 to 13 and write the choice to the URL', () => {
    const setParams = vi.fn();
    render(<HashProbingView params={{}} setParams={setParams} />);
    const select = screen.getByLabelText('Table size m') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(Array.from({ length: 13 }, (_, i) => String(i + 1)));
    fireEvent.change(select, { target: { value: '13' } });
    expect(setParams).toHaveBeenCalledWith({ m: '13' });
  });
});

describe('heap view: a way forward from the refusal (R13)', () => {
  const NOTICE = /The starting array is not a min-heap, so insert and extract will be refused/;
  it('warns for start 3 1 2 with insert 9, and says "Not a heap yet" beside the start field', () => {
    render(<HeapView params={{ s: '3 1 2', o: 'insert 9' }} setParams={() => undefined} />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByLabelText('Starting array')).toHaveAccessibleDescription(/Not a heap yet\./);
  });
  it('the button puts build first in the operation list, through the URL', () => {
    const setParams = vi.fn();
    render(<HeapView params={{ s: '3 1 2', o: 'insert 9' }} setParams={setParams} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add build first' }));
    expect(setParams).toHaveBeenCalledWith({ o: 'build, insert 9' });
  });
  it('after the change the first operation is build, and the notice is gone', () => {
    const { rerender } = render(<HeapView params={{ s: '3 1 2', o: 'insert 9' }} setParams={() => undefined} />);
    rerender(<HeapView params={{ s: '3 1 2', o: 'build, insert 9' }} setParams={() => undefined} />);
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Operations' }) as HTMLTextAreaElement).value.startsWith('build')).toBe(true);
  });
  it('is silent for a valid heap, for a build that comes first, and when no insert or extract is listed', () => {
    for (const params of [{ s: '1 2 3', o: 'insert 9' }, { s: '3 1 2', o: 'build, insert 9' }, { s: '3 1 2', o: 'rebuild, extract' }, { s: '3 1 2', o: '' }, { s: '3 1 2', o: 'build' }]) {
      const { unmount } = render(<HeapView params={params} setParams={() => undefined} />);
      expect(screen.queryByText(NOTICE), JSON.stringify(params)).toBeNull();
      unmount();
    }
    render(<HeapView params={{ s: '1 2 3' }} setParams={() => undefined} />);
    expect(screen.getByLabelText('Starting array')).not.toHaveAccessibleDescription(/Not a heap yet/);
  });
  it('still warns when an extract comes before the build, and keeps working with an empty operation prefix', () => {
    const setParams = vi.fn();
    render(<HeapView params={{ s: '3 1 2', o: 'extract, build' }} setParams={setParams} />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add build first' }));
    expect(setParams).toHaveBeenCalledWith({ o: 'build, extract, build' });
  });
});

describe('heap view', () => {
  it('compares the two ways to build the starting keys', () => {
    render(<HeapView params={{ s: '5, 4, 3, 2, 1', o: 'build' }} setParams={() => undefined} />);
    const section = screen.getByRole('region', { name: 'Two ways to build' });
    expect(section).toHaveTextContent('Build by sift-down');
    expect(section).toHaveTextContent('Build by repeated insertion');
  });
});
