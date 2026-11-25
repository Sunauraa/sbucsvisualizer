/** Growth experiments for the construction: work against the number of clauses. */
import { experimentFor } from '@core';
import { threeSatToVertexCover } from './construct';
import type { Clause, Literal } from './formula';

/** m clauses over `variables` names; literal p of clause j uses variable (3j + p) mod variables, so all appear. */
function makeFormula(m: number, variables: number, rng: { next(): number }): { clauses: Clause[] } {
  const literal = (j: number, p: number): Literal => ({ variable: `x${((3 * j + p) % variables) + 1}`, negated: rng.next() < 0.5 });
  return { clauses: Array.from({ length: m }, (_, j): Clause => [literal(j, 0), literal(j, 1), literal(j, 2)]) };
}

export const experiments = [
  experimentFor(threeSatToVertexCover, {
    id: 'reductions-3sat-vertex-cover-growth',
    title: '3-SAT to Vertex Cover (construction)',
    sizeMeaning: 'number of clauses m',
    primaryOp: 'edges',
    sizes: [4, 8, 16, 32, 64, 128, 256],
    cases: [
      { id: 'shared-variables', label: 'About m/2 variables, so variables repeat', claim: { symbol: 'Θ', fn: 'n', when: 'every case, with n + m = Θ(m)' } },
      { id: 'fresh-variables', label: 'Three times m variables, so every literal is a new variable', claim: { symbol: 'Θ', fn: 'n', when: 'every case, with n + m = Θ(m)' } },
    ],
    makeInput(m, caseId, rng) {
      return makeFormula(m, caseId === 'fresh-variables' ? 3 * m : Math.max(3, Math.ceil(m / 2)), rng);
    },
  }),
];
