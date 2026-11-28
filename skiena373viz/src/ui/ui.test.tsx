// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAlgorithm, defineOps, definePseudocode, parseGraph, TONE_NAMES, TONES } from '@core';
import type { GrowthExperiment, Recorder } from '@core';
import { arrowPoints, CellGrid, CellRow, compactNumber, edgeGeometry, ErrorBoundary, GraphView, GrowthPanel, GrowthPlot, PseudocodePanel, spreadLabels, SvgNode, TraceNotices, Workbench } from '.';
import type { RendererProps } from '.';
import { checkRenderer } from './testing';

const counter = defineAlgorithm({
  id: 'test-count', title: 'Count', summary: 'Counts.',
  pseudocode: definePseudocode([['start', 0, 'count()'], ['tick', 1, 'tick']]),
  ops: defineOps([{ id: 'ticks', label: 'Ticks', counts: 'One per tick.' }]),
  complexity: [{ resource: 'time', when: 'every case', bound: 'Θ(n)', why: 'one tick each.' }],
  presets: [],
  execute(n: number, t: Recorder<{ i: number }, 'start' | 'tick', 'ticks'>) {
    t.step({ lines: ['start'], say: 'Start at 0.', state: () => ({ i: 0 }) });
    for (let i = 1; i < n; i += 1) { t.count('ticks'); t.step({ lines: ['tick'], say: `Tick ${i}.`, state: () => ({ i }) }); }
    t.count('ticks');
    return t.finish({ lines: ['tick'], say: `Tick ${n}.`, state: () => ({ i: n }), result: n });
  },
});
const Show = ({ frame }: RendererProps<{ i: number }>) => <output>{frame.state.i}</output>;
const trace = counter.run(5);
const value = () => screen.getByRole('status').textContent;

describe('Workbench and player', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const bench = (gated?: (i: number) => boolean) => render(
    <Workbench algorithm={counter} trace={trace} Renderer={Show} {...(gated ? { gated } : {})} inputs={<input aria-label="box" />}
      aside={({ player }) => (player.atGate ? <button type="button" onClick={() => player.release()}>Answer</button> : null)} />,
  );
  const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

  it('steps, back-steps, seeks and resets; pseudocode, counts and caption follow', () => {
    bench();
    click(/Step/);
    click(/Step/);
    expect(value()).toBe('2');
    expect(screen.getByText('tick').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Ticks', { selector: 'dt' }).nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Tick 2.')).toHaveAttribute('aria-live', 'polite');
    click('Back');
    expect(value()).toBe('1');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } });
    expect(value()).toBe('4');
    click('Reset');
    expect(value()).toBe('0');
  });
  it('plays at the chosen speed and stops at the end', () => {
    bench();
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '2' } });
    click('Play');
    act(() => { vi.advanceTimersByTime(451); });
    expect(value()).toBe('1');
    for (let i = 0; i < 6; i += 1) act(() => { vi.advanceTimersByTime(451); });
    expect(value()).toBe('5');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });
  it('keyboard works on the page but not while typing or on a button', () => {
    bench();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(value()).toBe('1');
    fireEvent.keyDown(screen.getByLabelText('box'), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reset' }), { key: ' ' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
    expect(value()).toBe('1');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(value()).toBe('0');
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
  it('a scrolling box keeps its arrows, but space still plays', () => {
    render(<Workbench algorithm={counter} trace={trace} Renderer={Show} inputs={<p data-player-keys="arrows">wide</p>} />);
    fireEvent.keyDown(screen.getByText('wide'), { key: 'ArrowRight' });
    expect(value()).toBe('0');
    fireEvent.keyDown(screen.getByText('wide'), { key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
  it('a gate holds the player until released', () => {
    const gated = (i: number) => i === 2;
    bench(gated);
    click('End');
    expect(value()).toBe('2');
    click(/Step/);
    expect(value()).toBe('2');
    click('Answer');
    click('End');
    expect(value()).toBe('5');
  });
  it('a new trace restarts; truncated traces say so', () => {
    const view = bench();
    click('End');
    const short = counter.run(40, { maxFrames: 4 });
    view.rerender(<Workbench algorithm={counter} trace={short} Renderer={Show} />);
    expect(value()).toBe('0');
    expect(screen.getByRole('note')).toHaveTextContent('37 steps');
  });
});

describe('PseudocodePanel', () => {
  it('wraps long lines instead of scrolling sideways, with a hanging indent, and marks the lit line', () => {
    const long = 'else if the graph is undirected and the edge leads back to the parent of the current vertex then skip it';
    const pseudocode = definePseudocode([['a', 0, 'first()'], ['b', 2, long]]);
    const { container } = render(<PseudocodePanel pseudocode={pseudocode} lit={['b']} />);
    expect(container.querySelector('.scroll-x')).toBeNull();
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    const code = container.querySelectorAll('code');
    expect((code[0] as HTMLElement).style.paddingLeft).toBe('1.4em');
    expect((code[1] as HTMLElement).style.paddingLeft).toBe('4.2em');
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent(long);
  });
});

describe('TraceNotices', () => {
  it('a rejected trace points at the caption instead of repeating its sentence', () => {
    const refuser = defineAlgorithm({
      id: 'test-refuse', title: 'Refuse', summary: 'Refuses.',
      pseudocode: definePseudocode([['start', 0, 'check()']]),
      ops: defineOps([{ id: 'ticks', label: 'Ticks', counts: 'One per tick.' }]),
      complexity: [{ resource: 'time', when: 'every case', bound: 'Θ(1)', why: 'one check.' }],
      presets: [],
      execute(_n: number, t: Recorder<{ i: number }, 'start', 'ticks'>) {
        t.step({ lines: ['start'], say: 'Check the input.', state: () => ({ i: 0 }) });
        return t.reject({ lines: ['start'], say: 'The value 7 is not allowed here.', state: () => ({ i: 1 }), result: null });
      },
    });
    const rejected = refuser.run(1);
    expect(rejected.status).toBe('rejected');
    const early = render(<TraceNotices trace={rejected} atEnd={false} />);
    expect(early.container).toBeEmptyDOMElement();
    early.unmount();
    const { container } = render(<TraceNotices trace={rejected} atEnd />);
    expect(container).toHaveTextContent('This input was refused; the step above says why.');
    expect(container).not.toHaveTextContent('The value 7 is not allowed here.');
  });
});

describe('checkRenderer', () => {
  it('accepts a steady renderer and rejects leaks and moving viewBoxes', () => {
    expect(checkRenderer(Show, trace)).toHaveLength(6);
    expect(() => checkRenderer(() => <p>{String(NaN)}</p>, trace)).toThrow(/renders "NaN"/);
    expect(() => checkRenderer(({ frame }) => <svg viewBox={`0 0 ${frame.index} 9`} />, trace)).toThrow(/viewBox/);
  });
});

describe('primitives', () => {
  it('every tone but idle has a glyph, so colour is never alone', () => {
    for (const tone of TONE_NAMES) {
      const { container, unmount } = render(<svg><SvgNode x={0} y={0} label="A" tone={tone} /></svg>);
      expect(container.textContent).toBe(`A${TONES[tone].glyph}`);
      unmount();
    }
    expect(new Set(TONE_NAMES.map((t) => TONES[t].glyph)).size).toBe(TONE_NAMES.length);
  });
  it('cells and grids render, empty ones included, and are operable by keyboard', async () => {
    const onCell = vi.fn();
    render(<>
      <CellRow title="queue" cells={[]} />
      <CellGrid title="table" rows={2} cols={2} cell={(r, c) => ({ text: `${r}${c}` })} onCell={onCell} arrows={[{ from: [0, 0], to: [1, 1] }]} />
    </>);
    expect(screen.getByText('empty')).toBeInTheDocument();
    screen.getByRole('button', { name: 'row 1, column 0: 10' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onCell).toHaveBeenCalledWith(1, 0);
  });
  it('GraphView draws antiparallel edges apart, and empty graphs', () => {
    const parsed = parseGraph('A>B:1, B>A:2, C>C:3', { directed: true, weighted: true });
    if (!parsed.ok) throw new Error(parsed.message);
    const { container } = render(<GraphView graph={parsed.value} title="g" nodes={{ A: { tone: 'done', sub: 'd=0' } }} />);
    expect(container.querySelectorAll('polygon')).toHaveLength(3);
    expect(container.querySelector('path')?.getAttribute('d')).toContain('Q');
    render(<GraphView graph={{ directed: false, weighted: false, nodes: [], edges: [] }} title="none" />);
    expect(screen.getByText('The graph is empty')).toBeInTheDocument();
  });
  it('geometry is finite and trimmed to the rim', () => {
    const g = edgeGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect([g.path, g.tip.x, g.angle]).toEqual(['M 22 0 L 78 0', 78, 0]);
    expect(edgeGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 20).path).not.toContain('NaN');
    expect(arrowPoints({ x: 0, y: 0 }, 0)).not.toContain('NaN');
    expect(spreadLabels([10, 11, 12], 15, 0, 100)).toEqual([10, 25, 40]);
    expect(spreadLabels([99, 98], 15, 0, 100)).toEqual([100, 85]);
  });
  it('ErrorBoundary contains a crash and recovers on a new key', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = (): never => { throw new Error('kaboom'); };
    const view = render(<ErrorBoundary resetKey="a"><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    view.rerender(<ErrorBoundary resetKey="b"><p>fine</p></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeInTheDocument();
    quiet.mockRestore();
  });
});

describe('growth', () => {
  const experiment: GrowthExperiment = {
    id: 'sq', title: 'Squares', sizeMeaning: 'size', primaryOp: 'ops', sizes: [1, 2, 4, 8],
    ops: [{ id: 'ops', label: 'Ops', counts: 'All.' }],
    cases: [{ id: 'all', label: 'All', claim: { symbol: 'Θ', fn: 'n²', when: 'every case' } }],
    measure: (n) => ({ ops: n * n }),
  };
  it('measures every size and tabulates', async () => {
    render(<GrowthPanel experiments={[experiment]} />);
    expect(await screen.findByText('64')).toBeInTheDocument();
    expect(screen.getByText('Θ(n²)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('log-log axes'));
    fireEvent.click(screen.getByLabelText(/constant 1/));
    expect(document.body.innerHTML).not.toContain('NaN');
  });
  it('survives zero, single and empty data, and reads out by keyboard', () => {
    const plot = (points: { n: number; value: number }[], logLog = false) => render(
      <GrowthPlot title="t" xLabel="n" yLabel="ops" series={[{ id: 's', label: 'measured', points }]} curves={['n', 'n log n', 'n²', '2^n']} logLog={logLog} />);
    plot([]);
    plot([{ n: 0, value: 0 }]);
    plot([{ n: 1, value: 0 }], true);
    plot([{ n: 2, value: 4 }, { n: 4, value: 16 }], true);
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);
    const svg = screen.getAllByRole('img').at(-1)!;
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(screen.getByText(/^n = 2 ·/)).toBeInTheDocument();
  });
  it('formats numbers compactly', () => {
    expect([0, 0.5, 12, 999, 12500, 3.2e6, 2e12, Infinity].map(compactNumber)).toEqual(['0', '0.5', '12', '999', '12.5k', '3.2M', '2.0e+12', 'too large']);
  });
});
