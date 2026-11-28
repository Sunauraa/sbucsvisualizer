// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkRenderer } from '@ui/testing';
import type { RendererProps } from '@ui';
import { editDistance } from './algorithms/editDistance';
import type { EditInput, EditState } from './algorithms/editDistance';
import { quizGates } from './algorithms/quiz';
import type { EditTrace } from './algorithms/quiz';
import { cellText, EditDetails, EditStage, marksVisible } from './EditStage';
import { cellAt, click, open, position, traceOf } from './testKit';

/**
 * Keeps every frame a question can be asked at (a gate: the leak-sensitive ones), the first and last frames and every 5th frame. A renderer
 * draws from its own frame only, so the frames in between add no information; the no-leak tests below still cover every gate.
 */
function sampled(trace: EditTrace): EditTrace {
  const gates = new Set(quizGates(trace, { every: 3, seed: 1 }));
  const last = trace.frames.length - 1;
  return { ...trace, frames: trace.frames.filter((_frame, i) => i === 0 || i === last || i % 5 === 0 || gates.has(i)) };
}

describe('renderers', () => {
  const stages = [['stage', EditStage], ['details', EditDetails]] as const;
  it.each(stages.flatMap(([name, R]) => editDistance.presets.map((p) => [name, p.id, p.input, R] as const)))(
    '%s renders the first, last, every 5th and every gated frame of preset %s',
    (_name, _id, input, Renderer) => {
      checkRenderer(Renderer as (props: RendererProps<EditState>) => React.JSX.Element, sampled(editDistance.run(input)));
    },
  );

  it('renders every frame of a trace with spaces, an emoji and an empty string', () => {
    for (const input of [{ pattern: 'a b', text: ' ' }, { pattern: '😀x', text: 'x😀' }, { pattern: '', text: '' }, { pattern: 'abc', text: '' }] as EditInput[]) {
      const trace = editDistance.run(input);
      checkRenderer(EditStage, trace);
      checkRenderer(EditDetails, trace);
    }
  });

  it('draws only from the frame: with every other frame removed, a gated frame looks the same', () => {
    const trace = traceOf('kitten', 'sitting');
    const stages = checkRenderer(EditStage, trace);
    const details = checkRenderer(EditDetails, trace);
    for (const g of quizGates(trace, { every: 2, seed: 1 })) {
      const frame = trace.frames[g];
      if (!frame) continue;
      const alone = { ...trace, frames: [frame] } as unknown as EditTrace;
      expect(checkRenderer(EditStage, alone)[0]).toBe(stages[g]);
      expect(checkRenderer(EditDetails, alone)[0]).toBe(details[g]);
    }
  });
});

describe('parent marks of the finished table (R11)', () => {
  const kitten = traceOf('kitten', 'sitting');
  const last = kitten.frames[kitten.frames.length - 1] as (typeof kitten.frames)[number];
  const MARK = /[↖←↑]/;

  it('with the quiz off, every written inner cell shows its marks in every frame', () => {
    for (const frame of kitten.frames) {
      const state = frame.state;
      for (let r = 1; r < state.table.length; r += 1) {
        for (let c = 1; c < (state.table[0]?.length ?? 0); c += 1) {
          const written = state.table[r]?.[c] != null;
          expect(marksVisible(state, r, c, false), `frame ${frame.index} D[${r}][${c}]`).toBe(written);
        }
      }
    }
  });

  it('the final frame shows marks on an off-path cell, D[1][2] of kitten/sitting, with the quiz off and with it on', () => {
    expect(last.state.step.kind).toBe('done');
    expect(last.state.path.some((p) => p[0] === 1 && p[1] === 2)).toBe(false);
    for (const quizOn of [false, true]) {
      expect(cellText(last.state, 1, 2, quizOn), `quiz ${quizOn ? 'on' : 'off'}`).toMatch(MARK);
    }
  });

  it('with the quiz on, a traceback frame still hides the marks of every cell the traceback has not left (and all of them at trace-start)', () => {
    let checked = 0;
    for (const frame of kitten.frames) {
      const state = frame.state;
      for (let r = 1; r < state.table.length; r += 1) {
        for (let c = 1; c < (state.table[0]?.length ?? 0); c += 1) {
          const visible = marksVisible(state, r, c, true);
          if (state.step.kind === 'trace-start') expect(visible).toBe(false);
          if (state.step.kind === 'trace-move') {
            expect(visible, `frame ${frame.index} D[${r}][${c}]`).toBe(state.moves.some((m) => m.from[0] === r && m.from[1] === c));
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the page, quiz off, final frame: an off-path cell has marks in the visible table text', () => {
    open({ p: 'kitten', t: 'sitting' });
    click('End');
    expect(cellAt(1, 2)).toMatch(MARK);
  });
});

describe('the page without the quiz', () => {
  it('shows the table, is a clean trace to the end, and has no quiz panel', () => {
    open({ p: 'kit', t: 'si' });
    expect(screen.queryByLabelText('Quiz')).toBeNull();
    click('End');
    const trace = traceOf('kit', 'si');
    expect(position()).toBe(trace.frames.length - 1);
    expect(screen.getByText(/The traceback is back at D\[0\]\[0\]/)).toBeInTheDocument();
    expect(screen.getByLabelText('Edit script')).toHaveTextContent('Edit script');
  });

  it('clicking a filled cell says where its value came from, in words', async () => {
    const user = userEvent.setup({ delay: null });
    open({ p: 'kit', t: 'si' });
    click('End');
    await user.click(screen.getByRole('button', { name: /^row 3, column 2:/ }));
    const panel = screen.getByLabelText('Cell inspector');
    expect(panel).toHaveTextContent('D[3][2] = 2');
    expect(panel).toHaveTextContent('the cheapest way to turn “kit” into “si” costs 2');
    expect(panel).toHaveTextContent('a parent');
    await user.keyboard('{Escape}');
  });

  it('an unwritten cell is said to be unwritten; the row and column fields work by keyboard', async () => {
    const user = userEvent.setup({ delay: null });
    open({ p: 'kit', t: 'si' });
    await user.type(screen.getByLabelText(/^Row/), '3');
    await user.type(screen.getByLabelText(/^Column/), '2');
    expect(screen.getByLabelText('Cell inspector')).toHaveTextContent('D[3][2] is not written yet');
    click('End');
    expect(screen.getByLabelText('Cell inspector')).toHaveTextContent('D[3][2] = 2');
  });

  it('bad input is explained and the last good run stays', () => {
    open({ p: 'a'.repeat(13), t: 'si' });
    expect(screen.getByRole('alert')).toHaveTextContent('The pattern has 13 characters; the limit here is 12.');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('writes input to the URL and offers random input, swap and quiz toggle', () => {
    const setParams = vi.fn();
    open({ p: 'kit', t: 'si' }, setParams);
    fireEvent.change(screen.getByLabelText('Pattern (rows)'), { target: { value: 'kitty' } });
    expect(setParams).toHaveBeenLastCalledWith({ p: 'kitty' });
    click('Swap the two strings');
    expect(setParams).toHaveBeenLastCalledWith({ p: 'si', t: 'kit' });
    click('New random input');
    const call = setParams.mock.calls[setParams.mock.calls.length - 1]?.[0] as Record<string, string>;
    expect(call['r']).toBe('1');
    expect(call['p']?.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Quiz mode'));
    expect(setParams).toHaveBeenLastCalledWith({ quiz: '1' });
  });

  it('the page has one tab stop in the table, whatever the size (12 by 12, quiz off)', () => {
    open({ p: 'abcdefghijkl', t: 'mnopqrstuvwx' });
    expect(document.querySelectorAll('svg [data-rc]')).toHaveLength(169);
    expect(document.querySelectorAll('svg [data-rc][tabindex="0"]')).toHaveLength(1);
    expect(screen.getByRole('table', { name: /Edit distance table, 13 rows by 13 columns/ }).querySelectorAll('th, td')).toHaveLength(14 * 14);
  });
});
