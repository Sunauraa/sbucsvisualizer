import type { ViewProps } from '@core';
import { Legend } from '@ui';
import { bst } from './algorithms/bst';
import type { BstOperation, BstResult, BstState, DeleteCase } from './algorithms/bst';
import { bstExperiment } from './algorithms/experiments';
import { parseBstOperations } from './algorithms/inputs';
import { formatKeys, formatOperations } from './algorithms/operations';
import { randomBst } from './algorithms/random';
import { BstRenderer } from './BstRenderer';
import { StructureView } from './StructureView';
import type { StructureConfig } from './StructureView';
import css from './structures.module.css';

const CASES: readonly { readonly id: DeleteCase; readonly title: string; readonly what: string; readonly why: string }[] = [
  {
    id: 'leaf',
    title: 'Case 1: no children (a leaf)',
    what: 'The parent drops the node.',
    why: 'Nothing hangs below the node, so no other key moves and every ancestor still has smaller keys on its left and larger keys on its right.',
  },
  {
    id: 'one-child',
    title: 'Case 2: one child',
    what: 'The parent points to the child instead (splice).',
    why: 'The whole subtree under the child lay on one side of each ancestor already, so it may take the deleted node’s place without any key changing sides.',
  },
  {
    id: 'two-children',
    title: 'Case 3: two children',
    what: 'The in-order successor (leftmost node of the right subtree) is lifted out and put where the node was.',
    why: 'The successor is the smallest key larger than the deleted one: it is above everything in the left subtree and below everything else in the right subtree. Having no left child, it is easy to cut out.',
  },
];

function CasesPanel({ state }: { readonly state: BstState }) {
  return (
    <section className="panel" aria-label="Delete cases">
      <h3>Delete: which case, and why order survives</h3>
      <ul className={css['cases']}>
        {CASES.map((c) => (
          <li key={c.id} aria-current={state.deleteCase === c.id ? 'true' : undefined}>
            <strong>{c.title}{state.deleteCase === c.id ? ' (this operation)' : ''}</strong>
            {c.what} <span className="muted">{c.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CONFIG: StructureConfig<{ start: readonly number[]; operations: readonly BstOperation[] }, BstState, BstResult, BstOperation> = {
  algorithm: bst,
  Renderer: BstRenderer,
  legend: (
    <Legend
      tones={['compare', 'visited', 'target', 'done', 'active', 'swap']}
      labels={{
        compare: 'node being compared with the key',
        visited: 'on the path so far',
        target: 'matched node, or the successor',
        done: 'search succeeded',
        active: 'new node, or node that was relinked',
        swap: 'node being replaced, or parent whose pointer changed',
      }}
    />
  ),
  experiments: [bstExperiment],
  verbs: [{ verb: 'insert', takesKey: true }, { verb: 'delete', takesKey: true }, { verb: 'search', takesKey: true }],
  parseOperations: (text) => parseBstOperations(text),
  build: (start, operations) => ({ start, operations }),
  toParams: (input) => ({ start: formatKeys(input.start), operations: formatOperations(input.operations), size: 5 }),
  random: randomBst,
  startLabel: 'Starting keys',
  startHint: 'Inserted in this order before the operations, at most 16',
  aside: (frame) => <CasesPanel state={frame.state} />,
};

export default function BstView(props: ViewProps) {
  return <StructureView {...props} config={CONFIG} />;
}
