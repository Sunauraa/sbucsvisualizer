/** Shared by the three EditDistance*.test.tsx files (split so that vitest runs them in parallel). Not a test file itself. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { editDistance } from './algorithms/editDistance';
import type { EditTrace, Question } from './algorithms/quiz';
import EditDistanceView from './EditDistanceView';

export const noop = (): void => undefined;
export const open = (params: Record<string, string>, setParams: (p: Record<string, string | null>) => void = noop) =>
  render(<EditDistanceView params={params} setParams={setParams} />);
export const quizParams = (p: string, t: string, k = 1, extra: Record<string, string> = {}): Record<string, string> => ({ p, t, quiz: '1', k: String(k), ...extra });
export const traceOf = (p: string, t: string): EditTrace => editDistance.run({ pattern: p, text: t });

export const position = (): number => Number(/^(\d+) \//.exec(screen.getByText(/^\d+ \/ \d+$/).textContent ?? '')?.[1]) - 1;
export const click = (name: RegExp | string): void => { fireEvent.click(screen.getByRole('button', { name })); };
export const atQuestion = (): boolean => screen.queryByRole('group', { name: /^Question \d+ of \d+$/ }) !== null;
export const feedback = (): string => within(screen.getByLabelText('Quiz')).getAllByRole('status').map((n) => n.textContent ?? '').join(' ');

export const cellAt = (i: number, j: number): string | null => document.querySelector(`[data-cell="${i},${j}"]`)?.textContent ?? null;

/** Everything a reader or a screen reader could get from the page: text, accessible names and titles. */
export function pageText(): string {
  const names = [...document.body.querySelectorAll('[aria-label],[title]')].map((el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`);
  return `${document.body.textContent ?? ''}\n${names.join('\n')}`;
}

/** Answers the open question correctly, the way a learner would. */
export async function answerRight(user: ReturnType<typeof userEvent.setup>, q: Question): Promise<void> {
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

