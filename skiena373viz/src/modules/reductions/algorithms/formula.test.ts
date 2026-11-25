import { describe, expect, it } from 'vitest';
import { analyzeFormula, formatFormula, formulaFrom, formulaVariables, NO_LIMITS, padClauses, parseFormula, parseRawClauses, UI_LIMITS } from './formula';
import type { Formula } from './formula';

const lit = (variable: string, negated = false) => ({ variable, negated });
const must = (text: string, limits = NO_LIMITS): Formula => {
  const parsed = parseFormula(text, limits);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};
const message = (text: string, limits = UI_LIMITS): string => {
  const parsed = parseFormula(text, limits);
  if (parsed.ok) throw new Error(`"${text}" parsed`);
  return parsed.message;
};

describe('parsing', () => {
  const expected: Formula = { clauses: [[lit('x1'), lit('x2', true), lit('x3')], [lit('x1', true), lit('x2'), lit('x2')]] };

  it.each([
    ['ascii', '(x1 | !x2 | x3) & (!x1 | x2 | x2)'],
    ['unicode', '(x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ x2)'],
    ['words', '(x1 or not x2 or x3) and (not x1 or x2 or x2)'],
    ['tilde and dash', '(x1 | ~x2 | x3) & (-x1 | x2 | x2)'],
    ['doubled operators, caret, odd spacing', '( x1 || !x2||x3 )&&(!x1 |x2| x2)'],
    ['uppercase words', '(x1 OR NOT x2 OR x3) AND (NOT x1 OR x2 OR x2)'],
    ['no parentheses around a clause', 'x1 | !x2 | x3 & !x1 | x2 | x2'],
  ])('reads %s notation', (_name, text) => {
    expect(must(text)).toEqual(expected);
  });

  it('accepts any letters-plus-digits names, case-sensitively', () => {
    const f = must('(Alpha | b2 | !Alpha) & (B2 | b2 | c)');
    expect(formulaVariables(f)).toEqual(['Alpha', 'B2', 'b2', 'c']);
  });

  it('orders variables by the shared label order, so x2 comes before x10', () => {
    expect(formulaVariables(must('(x10 | x2 | x1)'))).toEqual(['x1', 'x2', 'x10']);
  });

  it('treats the empty text as the empty formula', () => {
    expect(must('')).toEqual({ clauses: [] });
    expect(must('   ')).toEqual({ clauses: [] });
  });

  it('keeps repeated literals and a clause with x and ¬x', () => {
    expect(must('(x | x | x) & (x | !x | y)').clauses).toHaveLength(2);
  });

  it('allows a variable that is called constructor', () => {
    expect(formulaVariables(must('(constructor | !toString | constructor)'))).toEqual(['constructor', 'toString']);
  });

  it('round-trips through the formatter in both styles', () => {
    const f = must('(x1 | !x2 | x3) & (!x1 | x2 | x2)');
    expect(formatFormula(f)).toBe('(x1 | !x2 | x3) & (!x1 | x2 | x2)');
    expect(formatFormula(f, 'unicode')).toBe('(x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ x2)');
    expect(must(formatFormula(f, 'unicode'))).toEqual(f);
  });
});

describe('malformed text names the position', () => {
  it.each([
    ['(x1 | x2 | x3', 'Position 14', 'closing'],
    ['(x1 | x2 | x3))', 'Position 15', 'no matching'],
    ['(x1 | x2 $ x3)', 'Position 10', 'unexpected character'],
    ['(x1 | | x3)', 'Position 7', 'expected a variable name'],
    ['(x1 x2 | x3)', 'Position 5', 'between literals'],
    ['(x1 | x2 | x3) (x1 | x2 | x3)', 'Position 16', 'between clauses'],
    ['(x1 | x2 | x3) &', 'Position 17', 'nothing follows'],
    ['(x1 | !!x2 | x3)', 'Position 8', 'at most one negation'],
    ['(x1 | 2x | x3)', 'Position 7', 'start with a letter'],
    ['()', 'Position 2', 'empty'],
    ['(x1 | x2 | )', 'Position 12', 'expected a variable name'],
  ])('%s', (text, position, fragment) => {
    const found = message(text);
    expect(found).toContain(position);
    expect(found).toContain(fragment);
  });
});

describe('the three-literal rule', () => {
  it('names a clause with two literals and offers padding', () => {
    const analysis = analyzeFormula('(x1 | x2 | x3) & (x1 | !x2)');
    expect(analysis.formula.ok).toBe(false);
    expect(analysis.formula.ok ? '' : analysis.formula.message).toBe(
      'Clause 2 (starting at position 18) has two literals, but 3-SAT needs exactly three. Repeating a literal is legal and changes nothing, so you can pad it.',
    );
    expect(analysis.short).toEqual([1]);
  });

  it('names a clause with one literal', () => {
    expect(message('(x1 | x2 | x3) & x1')).toContain('Clause 2 (starting at position 18) has one literal');
  });

  it('names a clause with four literals', () => {
    expect(message('(x1 | x2 | x3 | x1)')).toBe('Clause 1 (starting at position 1) has four literals; 3-SAT allows exactly three, so remove 1 or split the clause.');
  });

  it('pads by repeating the last literal, and only the clauses asked for', () => {
    const analysis = analyzeFormula('(x1) & (x1 | !x2) & (x3 | x3 | x3)');
    expect(analysis.raw).not.toBeNull();
    const raw = analysis.raw ?? [];
    expect(formatFormula({ clauses: padClauses(raw) as never })).toBe('(x1 | x1 | x1) & (x1 | !x2 | !x2) & (x3 | x3 | x3)');
    const first = padClauses(raw, [0]);
    expect(first.map((clause) => clause.length)).toEqual([3, 2, 3]);
    expect(parseFormula(formatFormula({ clauses: padClauses(raw) as never }), NO_LIMITS).ok).toBe(true);
  });
});

describe('size caps', () => {
  it('refuses more than 5 variables', () => {
    expect(message('(a | b | c) & (d | e | f)')).toBe('The formula uses 6 variables (a, b, c, d, e, f); the limit here is 5.');
  });
  it('accepts exactly 5 variables and exactly 8 clauses', () => {
    const clauses = Array.from({ length: 8 }, (_, i) => `(x${(i % 5) + 1} | x${((i + 1) % 5) + 1} | x${((i + 2) % 5) + 1})`).join(' & ');
    expect(parseFormula(clauses).ok).toBe(true);
  });
  it('refuses 9 clauses', () => {
    const nine = Array.from({ length: 9 }, () => '(x | x | x)').join(' & ');
    expect(message(nine)).toBe('The formula has 9 clauses; the limit here is 8.');
  });
  it('refuses a very long variable name', () => {
    expect(message('(abcdefghijk | x | x)')).toContain('"abcdefghijk" has 11 characters');
  });
  it('the construction itself has no cap: NO_LIMITS accepts a large formula', () => {
    const big = Array.from({ length: 40 }, (_, i) => `(v${i} | v${i + 1} | v${i + 2})`).join(' & ');
    expect(parseFormula(big, NO_LIMITS).ok).toBe(true);
  });
});

it('formulaFrom throws on bad presets, so a typo cannot ship', () => {
  expect(() => formulaFrom('(x |')).toThrow();
});

it('parseRawClauses reports where each clause starts', () => {
  const parsed = parseRawClauses('(a | b | c) & d');
  expect(parsed.ok && parsed.value.map((clause) => clause.at)).toEqual([1, 15]);
});
