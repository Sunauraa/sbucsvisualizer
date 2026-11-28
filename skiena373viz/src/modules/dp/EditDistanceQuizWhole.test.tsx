// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cellName } from './algorithms/editDistance';
import { questionAt, quizGates } from './algorithms/quiz';
import { answerRight, atQuestion, cellAt, click, open, pageText, position, quizParams, traceOf } from './testKit';

describe('quiz mode: the whole table, and nothing leaks at any gate', () => {
  it('fill the whole table by quiz: every question answered, score kept, then Retake asks them all again', async () => {
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
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
});
