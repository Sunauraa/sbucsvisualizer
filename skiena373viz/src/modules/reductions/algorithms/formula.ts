/**
 * 3-CNF formulas: the data type, a forgiving parser that names the position of every mistake, a
 * formatter, evaluation, and the size limits the page enforces. Pure; no UI imports.
 */
import { compareLabels, fail, ok } from '@core';
import type { Result } from '@core';

export interface Literal {
  readonly variable: string;
  readonly negated: boolean;
}

/** Exactly three literals. Repeated literals are legal. */
export type Clause = readonly [Literal, Literal, Literal];

export interface Formula {
  readonly clauses: readonly Clause[];
}

/** An assignment: variable name to truth value. A missing variable counts as false. */
export type Assignment = Readonly<Record<string, boolean>>;

export const positive = (variable: string): Literal => ({ variable, negated: false });
export const negative = (variable: string): Literal => ({ variable, negated: true });

/** The variables that appear, without repeats, in the shared label order (x2 before x10). */
export function variablesOf(clauses: readonly (readonly Literal[])[]): string[] {
  const seen = new Set<string>();
  for (const clause of clauses) for (const literal of clause) seen.add(literal.variable);
  return [...seen].sort(compareLabels);
}

export const formulaVariables = (formula: Formula): string[] => variablesOf(formula.clauses);

/** Own-property lookup, so that a variable called "constructor" is an ordinary variable. */
export function valueOf(assignment: Assignment, variable: string): boolean {
  return Object.hasOwn(assignment, variable) && assignment[variable] === true;
}

export const literalIsTrue = (literal: Literal, assignment: Assignment): boolean =>
  valueOf(assignment, literal.variable) !== literal.negated;

/** Index of the first true literal of a clause (the one the reduction leaves out), or null. */
export function firstTrueLiteral(clause: Clause, assignment: Assignment): number | null {
  const index = clause.findIndex((literal) => literalIsTrue(literal, assignment));
  return index < 0 ? null : index;
}

export const clauseIsSatisfied = (clause: Clause, assignment: Assignment): boolean => firstTrueLiteral(clause, assignment) !== null;

/** Indices of the clauses that no literal satisfies. */
export function unsatisfiedClauses(formula: Formula, assignment: Assignment): number[] {
  return formula.clauses.flatMap((clause, i) => (clauseIsSatisfied(clause, assignment) ? [] : [i]));
}

export const satisfies = (formula: Formula, assignment: Assignment): boolean => unsatisfiedClauses(formula, assignment).length === 0;

// ---------------------------------------------------------------------------------------------
// Text

export interface FormulaLimits {
  readonly maxVariables: number;
  readonly maxClauses: number;
  readonly maxNameLength: number;
}

/** What the page accepts (PLAN.md section 5: formulas 5 variables and 8 clauses). */
export const UI_LIMITS: FormulaLimits = { maxVariables: 5, maxClauses: 8, maxNameLength: 8 };
export const NO_LIMITS: FormulaLimits = { maxVariables: Infinity, maxClauses: Infinity, maxNameLength: Infinity };

const literalText = (literal: Literal, style: 'ascii' | 'unicode'): string =>
  `${literal.negated ? (style === 'ascii' ? '!' : '¬') : ''}${literal.variable}`;

/** The text of one literal: `!x1` (ascii) or `¬x1` (unicode). */
export const formatLiteral = (literal: Literal, style: 'ascii' | 'unicode' = 'unicode'): string => literalText(literal, style);

export function formatClause(clause: readonly Literal[], style: 'ascii' | 'unicode' = 'unicode'): string {
  return `(${clause.map((literal) => literalText(literal, style)).join(style === 'ascii' ? ' | ' : ' ∨ ')})`;
}

/** `(x1 | !x2 | x3) & (...)`; the ascii form is what the URL and the text field hold. */
export function formatClauses(clauses: readonly (readonly Literal[])[], style: 'ascii' | 'unicode' = 'ascii'): string {
  return clauses.map((clause) => formatClause(clause, style)).join(style === 'ascii' ? ' & ' : ' ∧ ');
}

export const formatFormula = (formula: Formula, style: 'ascii' | 'unicode' = 'ascii'): string => formatClauses(formula.clauses, style);

/** A clause of any length, as typed, with where it starts (1-based character position). */
export interface RawClause {
  readonly literals: readonly Literal[];
  readonly at: number;
}

interface Token {
  readonly kind: 'open' | 'close' | 'or' | 'and' | 'not' | 'name';
  readonly text: string;
  /** 1-based character position. */
  readonly at: number;
}

const WORDS: Readonly<Record<string, Token['kind']>> = { or: 'or', and: 'and', not: 'not' };

function tokenize(text: string): Result<Token[]> {
  const tokens: Token[] = [];
  let i = 0;
  const push = (kind: Token['kind'], length: number): void => {
    tokens.push({ kind, text: text.slice(i, i + length), at: i + 1 });
    i += length;
  };
  while (i < text.length) {
    const c = text.charAt(i);
    if (/\s/.test(c)) i += 1;
    else if (c === '(') push('open', 1);
    else if (c === ')') push('close', 1);
    else if (c === '|') push('or', text.charAt(i + 1) === '|' ? 2 : 1);
    else if (c === '∨') push('or', 1);
    else if (c === '&') push('and', text.charAt(i + 1) === '&' ? 2 : 1);
    else if (c === '∧' || c === '^') push('and', 1);
    else if (c === '!' || c === '¬' || c === '~' || c === '-') push('not', 1);
    else if (/[A-Za-z0-9]/.test(c)) {
      const word = /^[A-Za-z0-9]+/.exec(text.slice(i))?.[0] ?? c;
      if (/^[0-9]/.test(word)) return fail(`Position ${i + 1}: "${word}" is not a variable name; names start with a letter, like x1.`);
      const lower = word.toLowerCase();
      push(Object.hasOwn(WORDS, lower) ? (WORDS[lower] ?? 'name') : 'name', word.length);
    } else {
      return fail(`Position ${i + 1}: unexpected character "${c}". Use letters and digits for variables, ! for not, | for or, & for and.`);
    }
  }
  return ok(tokens);
}

const describe = (token: Token | undefined): string => (token ? `"${token.text}"` : 'the end of the text');

/**
 * Parses a CNF formula of clauses of any length (at least one literal each). The grammar:
 *   formula := (clause ('&' clause)*)?     clause := '(' lits ')' | lits     lits := literal ('|' literal)*
 *   literal := '!' name | name
 * Accepts `!`, `¬`, `~`, `-`, `not` for negation, `|`, `||`, `∨`, `or` for or, and `&`, `&&`, `∧`, `^`, `and` for and.
 * Every failure names the 1-based character position.
 */
export function parseRawClauses(text: string): Result<RawClause[]> {
  const lexed = tokenize(text);
  if (!lexed.ok) return lexed;
  const tokens = lexed.value;
  const endAt = text.length + 1;
  let p = 0;
  const clauses: RawClause[] = [];

  const literal = (): Result<Literal> => {
    let token = tokens[p];
    let negated = false;
    if (token?.kind === 'not') {
      negated = true;
      p += 1;
      token = tokens[p];
      if (token?.kind === 'not') return fail(`Position ${token.at}: a literal has at most one negation.`);
    }
    if (token?.kind !== 'name') return fail(`Position ${token?.at ?? endAt}: expected a variable name, found ${describe(token)}.`);
    p += 1;
    return ok({ variable: token.text, negated });
  };

  const literals = (closeAt: 'close' | 'end'): Result<Literal[]> => {
    const list: Literal[] = [];
    for (;;) {
      const lit = literal();
      if (!lit.ok) return lit;
      list.push(lit.value);
      const next = tokens[p];
      if (next?.kind === 'or') {
        p += 1;
        continue;
      }
      if (closeAt === 'close' && next?.kind === 'close') return ok(list);
      if (closeAt === 'end' && (next === undefined || next.kind === 'and')) return ok(list);
      if (closeAt === 'close' && next === undefined) return fail(`Position ${endAt}: the clause is missing its closing ")".`);
      if (next?.kind === 'close') return fail(`Position ${next.at}: this ")" has no matching "(".`);
      if (next?.kind === 'name' || next?.kind === 'not') return fail(`Position ${next.at}: write | (or) between literals, found ${describe(next)}.`);
      return fail(`Position ${next?.at ?? endAt}: unexpected ${describe(next)} inside a clause.`);
    }
  };

  while (p < tokens.length) {
    const start = tokens[p];
    if (!start) break;
    if (start.kind === 'open') {
      p += 1;
      if (tokens[p]?.kind === 'close') return fail(`Position ${tokens[p]?.at ?? endAt}: this clause is empty; put at least one literal inside the parentheses.`);
      const inner = literals('close');
      if (!inner.ok) return inner;
      p += 1;
      clauses.push({ literals: inner.value, at: start.at });
    } else {
      const bare = literals('end');
      if (!bare.ok) return bare;
      clauses.push({ literals: bare.value, at: start.at });
    }
    const next = tokens[p];
    if (next === undefined) break;
    if (next.kind === 'close') return fail(`Position ${next.at}: this ")" has no matching "(".`);
    if (next.kind !== 'and') {
      return fail(`Position ${next.at}: write & (and) between clauses, found ${describe(next)}.`);
    }
    p += 1;
    if (p >= tokens.length) return fail(`Position ${endAt}: nothing follows the "&"; a clause is missing.`);
  }
  return ok(clauses);
}

const WORD_COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n: number): string => WORD_COUNT[n] ?? String(n);

export interface FormulaAnalysis {
  /** The 3-CNF formula, or the message to show. */
  readonly formula: Result<Formula>;
  /** The clauses as typed, when the text is at least well formed. */
  readonly raw: readonly RawClause[] | null;
  /** 0-based indices of clauses with fewer than three literals: these can be padded. */
  readonly short: readonly number[];
}

/** Parse + the 3-literal rule + size limits, keeping what the page needs to offer a "pad" button. */
export function analyzeFormula(text: string, limits: FormulaLimits = UI_LIMITS): FormulaAnalysis {
  const parsed = parseRawClauses(text);
  if (!parsed.ok) return { formula: parsed, raw: null, short: [] };
  const raw = parsed.value;
  const short = raw.flatMap((clause, i) => (clause.literals.length < 3 ? [i] : []));
  for (const [i, clause] of raw.entries()) {
    const size = clause.literals.length;
    if (size === 3) continue;
    const where = `Clause ${i + 1} (starting at position ${clause.at}) has ${count(size)} literal${size === 1 ? '' : 's'}`;
    const message = size < 3
      ? `${where}, but 3-SAT needs exactly three. Repeating a literal is legal and changes nothing, so you can pad it.`
      : `${where}; 3-SAT allows exactly three, so remove ${size - 3} or split the clause.`;
    return { formula: fail(message), raw, short };
  }
  const clauses = raw.flatMap((clause): Clause[] => {
    const [a, b, c] = clause.literals;
    return a && b && c ? [[a, b, c]] : [];
  });
  const variables = variablesOf(clauses);
  const longName = variables.find((name) => name.length > limits.maxNameLength);
  if (longName !== undefined) {
    return { formula: fail(`The variable name "${longName}" has ${longName.length} characters; the limit here is ${limits.maxNameLength}.`), raw, short };
  }
  if (variables.length > limits.maxVariables) {
    return { formula: fail(`The formula uses ${variables.length} variables (${variables.join(', ')}); the limit here is ${limits.maxVariables}.`), raw, short };
  }
  if (clauses.length > limits.maxClauses) {
    return { formula: fail(`The formula has ${clauses.length} clauses; the limit here is ${limits.maxClauses}.`), raw, short };
  }
  return { formula: ok({ clauses }), raw, short };
}

export const parseFormula = (text: string, limits: FormulaLimits = UI_LIMITS): Result<Formula> => analyzeFormula(text, limits).formula;

/** Pads the given clauses (all short ones by default) to three literals by repeating their last literal. */
export function padClauses(raw: readonly RawClause[], which?: readonly number[]): Literal[][] {
  return raw.map((clause, i) => {
    const list = [...clause.literals];
    const last = list[list.length - 1];
    if (!last || list.length >= 3 || (which && !which.includes(i))) return list;
    while (list.length < 3) list.push(last);
    return list;
  });
}

/** Builds a formula from text that must be valid; for presets and tests. Throws on a mistake in the text. */
export function formulaFrom(text: string): Formula {
  const parsed = parseFormula(text, NO_LIMITS);
  if (!parsed.ok) throw new Error(`Bad formula "${text}": ${parsed.message}`);
  return parsed.value;
}
