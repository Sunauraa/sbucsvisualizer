/**
 * The honest, exponential solver: try every assignment. Used by the solver panel and by tests as the
 * reference answer. It is deliberately separate from construct.ts, which never calls it.
 */
import { formulaVariables, satisfies, unsatisfiedClauses } from './formula';
import type { Assignment, Formula } from './formula';

/** Every assignment of the variables, first variable as the most significant bit, false before true. */
export function allAssignments(variables: readonly string[]): Assignment[] {
  const n = variables.length;
  return Array.from({ length: 2 ** n }, (_, row) => Object.fromEntries(
    variables.map((variable, i) => [variable, ((row >> (n - 1 - i)) & 1) === 1]),
  ));
}

export interface SolveReport {
  readonly variables: readonly string[];
  /** 2^n: the number of assignments tried. */
  readonly tried: number;
  /** How many clauses each assignment (in allAssignments order) leaves unsatisfied. */
  readonly rows: readonly { readonly assignment: Assignment; readonly unsatisfied: readonly number[] }[];
  readonly satisfying: readonly Assignment[];
}

export const MAX_SOLVER_VARIABLES = 16;

/** Tries every assignment. Null when 2^n would be too many to enumerate here. */
export function solve(formula: Formula): SolveReport | null {
  const variables = formulaVariables(formula);
  if (variables.length > MAX_SOLVER_VARIABLES) return null;
  const rows = allAssignments(variables).map((assignment) => ({ assignment, unsatisfied: unsatisfiedClauses(formula, assignment) }));
  return {
    variables,
    tried: rows.length,
    rows,
    satisfying: rows.filter((row) => row.unsatisfied.length === 0).map((row) => row.assignment),
  };
}

export const isSatisfiable = (formula: Formula): boolean => allAssignments(formulaVariables(formula)).some((a) => satisfies(formula, a));
