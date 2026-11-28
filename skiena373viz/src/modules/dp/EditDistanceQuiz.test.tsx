// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { questionAt, quizGates } from './algorithms/quiz';
import { answerRight, atQuestion, click, feedback, open, position, quizParams, traceOf } from './testKit';

describe('quiz mode: gates, answers and hints', () => {
  it('the gate holds: stepping, playing, scrubbing and End cannot pass an unanswered question', async () => {
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
    open(quizParams('kit', 'si'));
    click('End');
    await user.type(screen.getByLabelText('Your answer'), 'x{enter}');
    expect(feedback()).toContain('whole number');
    await user.type(screen.getByLabelText('Your answer'), '{enter}');
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
    expect(screen.getByLabelText('Quiz')).toHaveTextContent('Streak0 (best 0)');
  });

  it('Show me reveals the answer, counts as a miss and releases the gate', async () => {
    const user = userEvent.setup({ delay: null });
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

  it('traceback question: every optimal parent is accepted, others are explained', async () => {
    const user = userEvent.setup({ delay: null });
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
