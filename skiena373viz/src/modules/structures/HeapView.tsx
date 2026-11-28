import type { ViewProps } from '@core';
import { Legend, Notice, ScrollX } from '@ui';
import { heapExperiment } from './algorithms/experiments';
import { firstViolation, heap } from './algorithms/heap';
import type { HeapInput, HeapOperation, HeapResult, HeapState } from './algorithms/heap';
import { parseHeapOperations } from './algorithms/inputs';
import { formatKeys, formatOperations } from './algorithms/operations';
import { randomHeap } from './algorithms/random';
import { HeapRenderer } from './HeapRenderer';
import { StructureView } from './StructureView';
import type { StructureConfig } from './StructureView';

/** Both ways to build a heap from the same keys, counted without recording frames. */
function Contrast({ input }: { readonly input: HeapInput }) {
  const down = heap.run({ start: input.start, operations: [{ kind: 'build', key: null }] }, { mode: 'counts' }).totals;
  const up = heap.run({ start: input.start, operations: [{ kind: 'rebuild', key: null }] }, { mode: 'counts' }).totals;
  const n = input.start.length;
  return (
    <section className="panel" aria-label="Two ways to build">
      <h3>Two ways to build a heap from the starting keys</h3>
      <p className="muted small">
        The same {n} {n === 1 ? 'key' : 'keys'}, built once by sift-down from the last parent and once by inserting them one at a time.
        Build by sift-down never needs more than 2n comparisons; repeated insertion can need about n lg n, and the starting order decides how much.
        A decreasing order is the worst case for both.
      </p>
      <ScrollX label="Comparison of build methods"><table>
        <thead><tr><th scope="col">Method</th><th scope="col">Comparisons</th><th scope="col">Swaps</th></tr></thead>
        <tbody>
          <tr><th scope="row">Build by sift-down</th><td>{down['comparisons']}</td><td>{down['swaps']}</td></tr>
          <tr><th scope="row">Build by repeated insertion</th><td>{up['comparisons']}</td><td>{up['swaps']}</td></tr>
        </tbody>
      </table></ScrollX>
    </section>
  );
}

/** True when an insert or extract comes before any build or rebuild while the starting array is not a heap: it will be refused. */
export function refusalAhead(input: HeapInput): boolean {
  if (firstViolation(input.start) < 0) return false;
  const first = input.operations.findIndex((op) => op.kind === 'insert' || op.kind === 'extract');
  if (first < 0) return false;
  const builds = input.operations.findIndex((op) => op.kind === 'build' || op.kind === 'rebuild');
  return builds < 0 || builds > first;
}

const CONFIG: StructureConfig<HeapInput, HeapState, HeapResult, HeapOperation> = {
  algorithm: heap,
  Renderer: HeapRenderer,
  legend: (
    <Legend
      tones={['active', 'compare', 'swap', 'target', 'done', 'visited']}
      labels={{
        active: 'key being placed or sifted',
        compare: 'keys being compared',
        swap: 'keys that just swapped',
        target: 'root being extracted, or smaller child chosen',
        done: 'key has found its place',
        visited: 'parent that stopped the climb',
      }}
    />
  ),
  experiments: [heapExperiment],
  verbs: [{ verb: 'insert', takesKey: true }, { verb: 'extract', takesKey: false }, { verb: 'build', takesKey: false }, { verb: 'rebuild', takesKey: false }],
  parseOperations: parseHeapOperations,
  build: (start, operations) => ({ start, operations }),
  toParams: (input) => ({ start: formatKeys(input.start), operations: formatOperations(input.operations), size: 5 }),
  random: randomHeap,
  startLabel: 'Starting array',
  startHint: 'Taken exactly as written, at most 16 keys; it need not be a heap yet',
  startNote: (start) => (firstViolation(start) >= 0 ? 'Not a heap yet.' : null),
  notice: (input, fix) => (refusalAhead(input) ? (
    <Notice tone="warning">
      The starting array is not a min-heap, so insert and extract will be refused until a build runs.{' '}
      <button type="button" onClick={() => fix.prependOperation('build')}>Add build first</button>
    </Notice>
  ) : null),
  footer: (input) => <Contrast input={input} />,
};

export default function HeapView(props: ViewProps) {
  return <StructureView {...props} config={CONFIG} />;
}
