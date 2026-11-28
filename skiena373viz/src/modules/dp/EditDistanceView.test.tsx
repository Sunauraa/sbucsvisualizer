// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkRenderer } from '@ui/testing';
import { cellName, editDistance } from './algorithms/editDistance';
import type { EditInput } from './algorithms/editDistance';
import { questionAt, quizGates } from './algorithms/quiz';
import type { EditTrace, Question } from './algorithms/quiz';
import EditDistanceView from './EditDistanceView';
import { cellText, EditDetails, EditStage, marksVisible } from './EditStage';
import type { RendererProps } from '@ui';
import type { EditState } from './algorithms/editDistance';

const noop = (): void => undefined;
const open = (params: Record<string, string>, setParams: (p: Record<string, string | null>) => void = noop) =>
  render(<EditDistanceView params={params} setParams={setParams} />);
const quizParams = (p: string, t: string, k = 1, extra: Record<string, string> = {}): Record<string, string> => ({ p, t, quiz: '1', k: String(k), ...extra });
const traceOf = (p: string, t: string): EditTrace => editDistance.run({ pattern: p, text: t });

const position = (): number => Number(/^(\d+) \//.exec(screen.getByText(/^\d+ \/ \d+$/).textContent ?? '')?.[1]) - 1;
const click = (name: RegExp | string): void => { fireEvent.click(screen.getByRole('button', { name })); };
const atQuestion = (): boolean => screen.queryByRole('group', { name: /^Question \d+ of \d+$/ }) !== null;
const feedback = (): string => within(screen.getByLabelText('Quiz')).getAllByRole('status').map((n) => n.textContent ?? '').join(' ');

const cellAt = (i: number, j: number): string | null => document.querySelector(`[data-cell="${i},${j}"]`)?.textContent ?? null;

/** Everything a reader or a screen reader could get from the page: text, accessible names and titles. */
function pageText(): string {
  const names = [...document.body.querySelectorAll('[aria-label],[title]')].map((el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`);
  return `${document.body.textContent ?? ''}\n${names.join('\n')}`;
}

/** Answers the open question correctly, the way a learner would. */
async function answerRight(user: ReturnType<typeof userEvent.setup>, q: Question): Promise<void> {
  if (q.kind === 'value' || q.kind === 'base') {
    await user.type(screen.getByLabelText('Your answer'), String(q.answer));
    await user.click(screen.getByRole('button', { name: 'Check' }));
  } else if (q.kind === 'cell') {
    await user.type(screen.getByLabelText(/^Row/), String(q.cell[0]));
    await user.type(screen.getByLabelText(/^Column/), String(q.cell[1]));
    await user.click(screen.getByRole('button', { name: 'Check' }));
  } else if (q.kind === 'move') {
    const dir = q.followed;
    await user.click(screen.getByRole('button', { name: new RegExp(dir === 'diag' ? 'diagonal' : dir === 'left' ? 'left' : 'up') }));
  }
}

describe('renderers', () => {
  const stages = [['stage', EditStage], ['details', EditDetails]] as const;
  it.each(stages.flatMap(([name, R]) => editDistance.presets.map((p) => [name, p.id, p.input, R] as const)))(
    '%s renders every frame of preset %s',
    (_name, _id, input, Renderer) => {
      checkRenderer(Renderer as (props: RendererProps<EditState>) => React.JSX.Element, editDistance.run(input));
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
});

describe('quiz mode', () => {
  it('the gate holds: stepping, playing, scrubbing and End cannot pass an unanswered question', async () => {
    const user = userEvent.setup();
    const trace = traceOf('kit', 'si');
    const gates = quizGates(trace, { every: 1, seed: 1 });
    open(quizParams('kit', 'si'));
    click('End');
    expect(position()).toBe(gates[0]);
    expect(atQuestion()).toBe(true);
    click(/^Step/);
    click('Play');
    fireEvent.change(screen.getByRole('slider'), { target: { value: String(trace.frames.length - 1) } });
    await user.keyboard('{End}');
    expect(position()).toBe(gates[0]);
    expect(screen.getByText(/Answer this question, or press Show me/)).toBeInTheDocument();
    click('Back');
    expect(position()).toBe(gates[0] as number - 1);
  });

  it('a right answer releases the gate, a wrong one does not, hints come in turn and Show me appears after two misses', async () => {
    const user = userEvent.setup();
    const trace = traceOf('abc', 'abd');
    const gates = quizGates(trace, { every: 1, seed: 1 });
    // Go to the first question about a value.
    open(quizParams('abc', 'abd'));
    let q = questionAt(trace, gates[0] ?? 0);
    while (q && q.kind !== 'value') {
      click('End');
      await answerRight(user, q);
      q = questionAt(trace, gates[gates.indexOf(q.index) + 1] ?? 0);
      click(/^Step/);
    }
    click('End');
    if (!q || q.kind !== 'value') throw new Error('no value question');
    const box = screen.getByLabelText('Your answer');
    const wrong = String(q.answer + 3);
    await user.type(box, `${wrong}{enter}`);
    expect(atQuestion()).toBe(true);
    expect(document.activeElement).toBe(box);
    expect(feedback()).toContain('Not quite (try 1)');
    expect(feedback()).toContain('D[i][j] = min(D[i-1][j-1] + c');
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
    await user.type(box, '{enter}');
    expect(feedback()).toContain('Not quite (try 2)');
    expect(feedback()).toMatch(/diagonal \d+ \+ [01] = \d+/);
    expect(document.activeElement).toBe(box);
    expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    expect(atQuestion()).toBe(true);
    // The right answer now releases it.
    await user.clear(box);
    await user.type(box, `${q.answer}{enter}`);
    expect(atQuestion()).toBe(false);
    expect(feedback()).toContain('Correct');
    // The player can move on, and the answered question is not asked again after stepping back.
    const at = position();
    const tallyBefore = screen.getByLabelText('Quiz').textContent;
    click(/^Step/);
    expect(position()).toBe(at + 1);
    click('Back');
    expect(atQuestion()).toBe(false);
    expect(screen.getByLabelText('Quiz').textContent).toBe(tallyBefore);
  });

  it('a typed non-number is not a wrong answer', async () => {
    const user = userEvent.setup();
    open(quizParams('kit', 'si'));
    click('End');
    await user.type(screen.getByLabelText('Your answer'), 'x{enter}');
    expect(feedback()).toContain('whole number');
    await user.type(screen.getByLabelText('Your answer'), '{enter}');
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
    expect(screen.getByLabelText('Quiz')).toHaveTextContent('Streak0 (best 0)');
  });

  it('Show me reveals the answer, counts as a miss and releases the gate', async () => {
    const user = userEvent.setup();
    const trace = traceOf('kit', 'si');
    const gates = quizGates(trace, { every: 1, seed: 1 });
    const q = questionAt(trace, gates[0] ?? 0);
    if (q?.kind !== 'base') throw new Error('expected a base question first');
    open(quizParams('kit', 'si'));
    click('End');
    for (let k = 0; k < 2; k += 1) await user.type(screen.getByLabelText('Your answer'), `${q.answer + 4}{enter}`);
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(atQuestion()).toBe(false);
    expect(feedback()).toContain(q.why);
    expect(screen.getByLabelText('Quiz')).toHaveTextContent('0 of 1 answered');
  });

  it('Which cell is written next: clicking a wrong cell gets cell-specific feedback; the right cell passes', async () => {
    const user = userEvent.setup();
    const trace = traceOf('abcd', 'abde');
    const gates = quizGates(trace, { every: 1, seed: 2 });
    open(quizParams('abcd', 'abde', 1, { qs: '2' }));
    let q: Question | null = null;
    for (const g of gates) {
      q = questionAt(trace, g);
      click('End');
      if (q?.kind === 'cell' && q.cell[0] >= 2 && q.cell[1] >= 2) break;
      if (q) await answerRight(user, q);
      click(/^Step/);
    }
    if (q?.kind !== 'cell') throw new Error('no cell question');
    const [r, c] = q.cell;
    // Already written.
    await user.click(screen.getByRole('button', { name: /^row 1, column 1: \d/ }));
    expect(feedback()).toContain('already written');
    // A far-away cell.
    await user.click(screen.getByRole('button', { name: `row ${r + 2}, column ${c + 2}: empty` }));
    expect(feedback()).toContain('cannot be computed yet');
    expect(atQuestion()).toBe(true);
    // The cell below the previous row, whose neighbours are ready.
    await user.click(screen.getByRole('button', { name: `row ${r + 1}, column 1: empty` }));
    expect(feedback()).toContain('Not quite');
    await user.click(screen.getByRole('button', { name: `row ${r}, column ${c}: empty` }));
    expect(atQuestion()).toBe(false);
    expect(feedback()).toContain('Correct');
  });

  it('Which cell is written next can be answered with Tab, the arrow keys and Enter, from one tab stop', async () => {
    const user = userEvent.setup();
    const trace = traceOf('abcd', 'abde');
    const gates = quizGates(trace, { every: 1, seed: 2 });
    open(quizParams('abcd', 'abde', 1, { qs: '2' }));
    let q: Question | null = null;
    for (const g of gates) {
      q = questionAt(trace, g);
      click('End');
      if (q?.kind === 'cell' && q.cell[0] >= 1 && q.cell[1] >= 1) break;
      if (q) await answerRight(user, q);
      click(/^Step/);
    }
    if (q?.kind !== 'cell') throw new Error('no cell question');
    const [r, c] = q.cell;
    const stops = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('svg [data-rc][tabindex="0"]')];
    expect(stops()).toHaveLength(1);
    const cellButton = (i: number, j: number): HTMLElement => screen.getByRole('button', { name: new RegExp(`^row ${i}, column ${j}:`) });
    cellButton(0, 0).focus();
    for (let k = 0; k < r; k += 1) await user.keyboard('{ArrowDown}');
    for (let k = 0; k < c; k += 1) await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cellButton(r, c));
    expect(position()).toBe(q.index);
    await user.keyboard('{Enter}');
    expect(atQuestion()).toBe(false);
    expect(feedback()).toContain('Correct');
  });

  it('the page has one tab stop in the table, whatever the size (12 by 12, quiz off)', () => {
    open({ p: 'abcdefghijkl', t: 'mnopqrstuvwx' });
    expect(document.querySelectorAll('svg [data-rc]')).toHaveLength(169);
    expect(document.querySelectorAll('svg [data-rc][tabindex="0"]')).toHaveLength(1);
    expect(screen.getByRole('table', { name: /Edit distance table, 13 rows by 13 columns/ }).querySelectorAll('th, td')).toHaveLength(14 * 14);
  });

  it('traceback question: every optimal parent is accepted, others are explained', async () => {
    const user = userEvent.setup();
    const trace = traceOf('ab', 'ba');
    const gates = quizGates(trace, { every: 1, seed: 1 });
    open(quizParams('ab', 'ba'));
    let seen = 0;
    for (const g of gates) {
      const q = questionAt(trace, g);
      click('End');
      if (!q) continue;
      if (q.kind === 'move') {
        const wrongDir = (['diag', 'left', 'up'] as const).find((d) => !q.accepted.includes(d));
        if (wrongDir) {
          await user.click(screen.getByRole('button', { name: new RegExp(wrongDir === 'diag' ? 'diagonal' : wrongDir) }));
          expect(atQuestion()).toBe(true);
          expect(feedback()).toContain('Not quite');
        }
        const accepted = q.accepted[q.accepted.length - 1];
        await user.click(screen.getByRole('button', { name: new RegExp(accepted === 'diag' ? 'diagonal' : accepted ?? 'left') }));
        expect(atQuestion()).toBe(false);
        seen += 1;
      } else {
        await answerRight(user, q);
      }
      click(/^Step/);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('fill the whole table by quiz: every question answered, score kept, then Retake asks them all again', async () => {
    const user = userEvent.setup();
    const trace = traceOf('kit', 'si');
    const gates = quizGates(trace, { every: 1, seed: 1 });
    open(quizParams('kit', 'si'));
    for (const g of gates) {
      click('End');
      expect(position()).toBe(g);
      const q = questionAt(trace, g);
      if (!q) throw new Error('gate without a question');
      await answerRight(user, q);
      click(/^Step/);
    }
    click('End');
    expect(position()).toBe(trace.frames.length - 1);
    expect(screen.getByLabelText('Quiz')).toHaveTextContent(`Quiz complete: ${gates.length} of ${gates.length} right on the first try`);
    // No question is asked after the final frame, so every written cell shows its marks again (R11).
    expect(cellAt(1, 2)).toMatch(/[↖←↑]/);
    click('Retake');
    expect(position()).toBe(0);
    click('End');
    expect(position()).toBe(gates[0]);
    expect(atQuestion()).toBe(true);
    expect(screen.getByLabelText('Quiz')).toHaveTextContent('0 of 0 answered');
  });

  it('nothing on the page reveals the answer at any gated frame (text, accessible names, titles)', async () => {
    const user = userEvent.setup();
    const trace = traceOf('abc', 'abd');
    const gates = quizGates(trace, { every: 1, seed: 3 });
    open(quizParams('abc', 'abd', 1, { qs: '3' }));
    expect(gates.length).toBeGreaterThan(15);
    const kinds = new Set<string>();
    for (const g of gates) {
      click('End');
      expect(position()).toBe(g);
      const q = questionAt(trace, g);
      const next = trace.frames[g + 1];
      if (!q || !next) throw new Error('gate without a question');
      kinds.add(q.kind);
      const text = pageText();
      expect(text, `explanation of the next frame at ${g}`).not.toContain(next.explanation);
      if (q.kind === 'value' || q.kind === 'base') {
        const [i, j] = q.cell;
        expect(text).not.toMatch(new RegExp(`D\\[${i}\\]\\[${j}\\]\\s*=\\s*${q.answer}\\b`));
        expect(text, 'candidate totals').not.toMatch(/\d+ \+ [01] = \d+/);
        expect(cellAt(i, j)).toBe('empty');
      }
      if (q.kind === 'cell') {
        const [i, j] = q.cell;
        expect(text).not.toContain(cellName(i, j));
        expect(cellAt(i, j)).toBe('empty');
      }
      if (q.kind === 'move') {
        const [i, j] = q.cell;
        expect(cellAt(i, j)).not.toMatch(/[↖←↑]/);
      }
      await answerRight(user, q);
      click(/^Step/);
    }
    expect([...kinds].sort()).toEqual(['base', 'cell', 'move', 'value']);
  });

  it('switching the quiz off gives a clean trace again', () => {
    const { unmount } = open(quizParams('kit', 'si'));
    unmount();
    open({ p: 'kit', t: 'si' });
    click('End');
    expect(position()).toBe(traceOf('kit', 'si').frames.length - 1);
  });

  it('empty strings have nothing to ask and say so', () => {
    open(quizParams('', ''));
    expect(screen.getByLabelText('Quiz')).toHaveTextContent('There is nothing to ask');
    click('End');
    expect(atQuestion()).toBe(false);
  });
});
