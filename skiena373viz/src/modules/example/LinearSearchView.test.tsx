// @vitest-environment jsdom
// Only tests that click or type need jsdom. Renderer checks alone can stay in the fast node environment.
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { checkRenderer } from '@ui/testing';
import { linearSearch } from './algorithms/linearSearch';
import LinearSearchView, { LinearSearchRenderer } from './LinearSearchView';

it.each(linearSearch.presets.map((p) => [p.id, p.input] as const))('every frame of preset %s renders', (_id, input) => {
  checkRenderer(LinearSearchRenderer, linearSearch.run(input));
});

it('explains bad input instead of crashing', () => {
  render(<LinearSearchView params={{ a: '1, two' }} setParams={() => undefined} />);
  expect(screen.getByRole('alert')).toHaveTextContent('"two" is not a whole number.');
  expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
});

it('writes input to the URL', () => {
  const setParams = vi.fn();
  render(<LinearSearchView params={{}} setParams={setParams} />);
  fireEvent.change(screen.getByLabelText('Target'), { target: { value: '9' } });
  expect(setParams).toHaveBeenCalledWith({ x: '9' });
});
