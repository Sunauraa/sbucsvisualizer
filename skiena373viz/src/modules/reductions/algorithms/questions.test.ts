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

it('never states a reduction backwards ("only if"), and the exponential-time option says "if 3-SAT is"', () => {
  for (const question of QUESTIONS) {
    expect(question.prompt, question.id).not.toMatch(/only if/i);
    for (const option of question.options) {
      expect(option.text, `${question.id}/${option.id}`).not.toMatch(/only if/i);
      expect(option.why, `${question.id}/${option.id}`).not.toMatch(/only if/i);
    }
  }
  const option = QUESTIONS.flatMap((question) => question.options).find((candidate) => candidate.id === 'vc-needs-exponential');
  expect(option?.why).toContain('if 3-SAT is');
  expect(option?.why).toContain('Vertex Cover is hard if 3-SAT is');
});
