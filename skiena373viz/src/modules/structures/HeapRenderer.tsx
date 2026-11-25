import { SURFACE } from '@core';
import type { Trace } from '@core';
import { CellRow, Halo, SvgEdge, SvgNode, SvgStage } from '@ui';
import type { CellSpec, RendererProps } from '@ui';
import { heapExtent, heapPlace } from './algorithms/heap';
import type { HeapResult, HeapState } from './algorithms/heap';
import css from './structures.module.css';

const SLOT = 36;
const LEVEL = 60;
const R = 16;

const sizes = new WeakMap<object, number>();
function sizeOf(trace: Trace<HeapState, HeapResult>): number {
  let found = sizes.get(trace.frames);
  if (found === undefined) {
    found = heapExtent(trace.frames);
    sizes.set(trace.frames, found);
  }
  return found;
}

export function describeHeap(state: HeapState): string {
  if (state.array.length === 0) return 'Empty heap';
  return `Min-heap array with ${state.array.length} ${state.array.length === 1 ? 'key' : 'keys'}: ${state.array.join(', ')}`;
}

/** The heap as a tree and as an array, with the same highlight on both. */
export function HeapRenderer({ frame, trace }: RendererProps<HeapState, HeapResult>) {
  const s = frame.state;
  const size = sizeOf(trace);
  const levels = Math.floor(Math.log2(size)) + 1;
  const leaves = 2 ** (levels - 1);
  const width = Math.max(leaves * SLOT + 24, 300);
  const height = (levels - 1) * LEVEL + 2 * R + 36;
  const pos = (i: number): { x: number; y: number } => {
    const { depth, offset } = heapPlace(i);
    return { x: 12 + ((width - 24) / 2 ** depth) * (offset + 0.5), y: R + 10 + depth * LEVEL };
  };
  const bad = new Set(s.violations);
  const cells: CellSpec[] = s.array.map((key, i) => ({ text: String(key), tone: s.marks[String(i)] ?? 'idle' }));
  return (
    <div>
      <p className={css['status']} aria-hidden="true">
        <span>
          size n = <strong>{s.array.length}</strong>
          {s.heapFrom !== null ? <>; every index from {s.heapFrom} up is already the root of a heap</> : null}
        </span>
        <span>
          {s.violations.length === 0
            ? 'Heap property holds: every key is at least its parent.'
            : <>Heap property fails at {s.violations.map((i) => `index ${i} (${s.array[i]} below its parent ${s.array[Math.floor((i - 1) / 2)]})`).join(', ')}.</>}
        </span>
      </p>
      <div className={css['transit']} aria-hidden="true">
        {s.held !== null ? <span className={css['chip']}>{s.held}<span className={css['muted']}> in transit: the extracted minimum</span></span> : null}
        {s.pending.length > 0 ? <span>Waiting to be inserted: <strong>{s.pending.join(', ')}</strong></span> : null}
      </div>
      <SvgStage width={width} height={height} title={`${describeHeap(s)}, drawn as a tree`} minWidth={width > 340 ? Math.round(width * 0.85) : undefined}>
        {s.array.flatMap((_key, i) => (i === 0 ? [] : [
          <SvgEdge key={`e${i}`} from={pos(Math.floor((i - 1) / 2))} to={pos(i)} r={R} tone={bad.has(i) ? 'swap' : 'idle'} dashed={bad.has(i)} />,
        ]))}
        {s.array.map((key, i) => (
          <SvgNode key={`n${i}`} {...pos(i)} r={R} label={String(key)} tone={s.marks[String(i)] ?? 'idle'} sub={String(i)} />
        ))}
        {s.array.length === 0 ? <Halo x={width / 2} y={R + 10} fill={SURFACE.muted}>empty heap</Halo> : null}
      </SvgStage>
      <CellRow title={`${describeHeap(s)}, drawn as an array`} cells={cells} slots={size} emptyText="empty array" />
    </div>
  );
}
