import type { ViewProps } from '@core';
import { Legend } from '@ui';
import { chainingExperiment } from './algorithms/experiments';
import { hashChaining } from './algorithms/hashChaining';
import type { ChainingResult, ChainingState } from './algorithms/hashChaining';
import type { HashInput, HashOperation } from './algorithms/hashing';
import { parseHashOperations } from './algorithms/inputs';
import { formatKeys, formatOperations } from './algorithms/operations';
import { randomHash } from './algorithms/random';
import { ChainingRenderer } from './ChainingRenderer';
import { StructureView } from './StructureView';
import type { StructureConfig } from './StructureView';

const CONFIG: StructureConfig<HashInput, ChainingState, ChainingResult, HashOperation> = {
  algorithm: hashChaining,
  Renderer: ChainingRenderer,
  legend: (
    <Legend
      tones={['active', 'compare', 'visited', 'target', 'done', 'swap']}
      labels={{
        active: 'bucket in use, or key just added',
        compare: 'entry being compared with the key',
        visited: 'entry already compared',
        target: 'entry that matches the key',
        done: 'search succeeded',
        swap: 'bucket whose chain changed (unlink)',
      }}
    />
  ),
  experiments: [chainingExperiment],
  verbs: [{ verb: 'insert', takesKey: true }, { verb: 'search', takesKey: true }, { verb: 'delete', takesKey: true }],
  parseOperations: parseHashOperations,
  build: (start, operations, size) => ({ size, start, operations }),
  toParams: (input) => ({ start: formatKeys(input.start), operations: formatOperations(input.operations), size: input.size }),
  random: randomHash,
  startLabel: 'Starting keys',
  startHint: 'Inserted in this order before the operations, at most 16',
  withSize: true,
};

export default function HashChainingView(props: ViewProps) {
  return <StructureView {...props} config={CONFIG} />;
}
