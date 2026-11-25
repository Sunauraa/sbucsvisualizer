import { expect, it } from 'vitest';
import { assignmentFromBits, bitsFromAssignment, coverFromParam, coverToParam, toggleInCover } from './params';

it('reads and writes assignments as bit strings, treating anything missing as false', () => {
  const vars = ['x1', 'x2', 'x3'];
  expect(assignmentFromBits(vars, '101')).toEqual({ x1: true, x2: false, x3: true });
  expect(assignmentFromBits(vars, '1')).toEqual({ x1: true, x2: false, x3: false });
  expect(assignmentFromBits(vars, 'zz1')).toEqual({ x1: false, x2: false, x3: true });
  expect(bitsFromAssignment(vars, { x1: true, x3: true })).toBe('101');
  expect(bitsFromAssignment([], {})).toBe('');
});

it('reads and writes covers as comma lists, dropping blanks and repeats', () => {
  expect(coverFromParam('x1, !x2,,c1.1,x1')).toEqual(['x1', '!x2', 'c1.1']);
  expect(coverFromParam('')).toEqual([]);
  expect(coverToParam(['x1', '!x2'])).toBe('x1,!x2');
});

it('toggles membership', () => {
  expect(toggleInCover(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggleInCover(['a', 'b'], 'a')).toEqual(['b']);
});
