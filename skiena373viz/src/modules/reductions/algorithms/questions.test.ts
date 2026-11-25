import { expect, it } from 'vitest';
import { QUESTIONS } from './questions';

it('every question has exactly one correct option and an explanation for every option', () => {
  expect(QUESTIONS).toHaveLength(3);
  for (const question of QUESTIONS) {
    expect(question.options.filter((option) => option.correct), question.id).toHaveLength(1);
    expect(new Set(question.options.map((option) => option.id)).size).toBe(question.options.length);
    for (const option of question.options) expect(option.why.length, `${question.id}/${option.id}`).toBeGreaterThan(40);
  }
  expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(QUESTIONS.length);
});
