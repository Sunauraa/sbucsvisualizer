import type { ViewProps } from '@core';
import { Legend } from '@ui';
import { probingExperiment } from './algorithms/experiments';
import { hashProbing } from './algorithms/hashProbing';
import type { ProbingResult, ProbingState } from './algorithms/hashProbing';
import type { HashInput, HashOperation } from './algorithms/hashing';
import { parseHashOperations } from './algorithms/inputs';
import { formatKeys, formatOperations } from './algorithms/operations';
import { randomHash } from './algorithms/random';
import { ProbingRenderer } from './ProbingRenderer';
import { StructureView } from './StructureView';
import type { StructureConfig } from './StructureView';

const CONFIG: StructureConfig<HashInput, ProbingState, ProbingResult, HashOperation> = {
  algorithm: hashProbing,
  Renderer: ProbingRenderer,
  legend: (
    <Legend
      tones={['active', 'compare', 'visited', 'target', 'done', 'swap']}
      labels={{
        active: 'home slot, or slot just filled',
        compare: 'slot being looked at',
        visited: 'slot probed earlier (numbered in order)',
        target: 'slot that matches the key',
        done: 'search succeeded',
        swap: 'slot that just became a tombstone',
      }}
    />
  ),
  experiments: [probingExperiment],
  verbs: [{ verb: 'insert', takesKey: true }, { verb: 'search', takesKey: true }, { verb: 'delete', takesKey: true }],
  parseOperations: parseHashOperations,
  build: (start, operations, size) => ({ size, start, operations }),
  toParams: (input) => ({ start: formatKeys(input.start), operations: formatOperations(input.operations), size: input.size }),
  random: randomHash,
  startLabel: 'Starting keys',
  startHint: 'Inserted in this order before the operations, at most 16',
  withSize: true,
};

export default function HashProbingView(props: ViewProps) {
  return <StructureView {...props} config={CONFIG} />;
}
