// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { questionAt, quizGates } from './algorithms/quiz';
import type { Question } from './algorithms/quiz';
import { answerRight, atQuestion, click, feedback, open, position, quizParams, traceOf } from './testKit';

describe('quiz mode: cell and traceback questions, and no leaks', () => {
  it('Which cell is written next: clicking a wrong cell gets cell-specific feedback; the right cell passes', async () => {
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
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
});
