import { SURFACE } from '@core';
import type { Trace } from '@core';
import { Halo, SvgArrow, SvgNode, SvgStage } from '@ui';
import type { RendererProps } from '@ui';
import { hashArithmetic } from './algorithms/hashing';
import type { ChainingResult, ChainingState } from './algorithms/hashChaining';
import css from './structures.module.css';

const ROW = 44;
const CELL = 54;
const R = 16;
const LEFT = 44;

const longest = new WeakMap<object, number>();
function longestChain(trace: Trace<ChainingState, ChainingResult>): number {
  let found = longest.get(trace.frames);
  if (found === undefined) {
    found = Math.max(3, ...trace.frames.flatMap((f) => f.state.buckets.map((chain) => chain.length)));
    longest.set(trace.frames, found);
  }
  return found;
}

export function describeChaining(state: ChainingState): string {
  const parts = state.buckets.map((chain, b) => `bucket ${b}: ${chain.length === 0 ? 'empty' : chain.join(' then ')}`);
  return `Hash table with ${state.size} buckets and ${state.n} keys. ${parts.join('; ')}`;
}

export const fixed = (x: number): string => x.toFixed(2);

export function ChainingRenderer({ frame, trace }: RendererProps<ChainingState, ChainingResult>) {
  const s = frame.state;
  const columns = longestChain(trace);
  const width = LEFT + columns * CELL + 24;
  const height = s.size * ROW + 8;
  const y = (b: number): number => 6 + ROW * b + ROW / 2;
  const x = (p: number): number => LEFT + 16 + p * CELL + CELL / 2;
  return (
    <div>
      <p className={css['status']} aria-hidden="true">
        <span>
          m = <strong>{s.size}</strong> {s.size === 1 ? 'bucket' : 'buckets'}, n = <strong>{s.n}</strong> {s.n === 1 ? 'key' : 'keys'}, load factor α = n/m = <strong>{fixed(s.n / s.size)}</strong>
        </span>
        <span className={css['muted']}>Each new key goes to the end of its chain.</span>
      </p>
      <p className={css['math']} aria-hidden="true">{s.hash ? `hash(${s.hash.key}) = ${hashArithmetic(s.hash)}` : ' '}</p>
      <SvgStage width={width} height={height} title={describeChaining(s)} minWidth={width > 340 ? Math.round(width * 0.9) : undefined}>
        {s.buckets.map((chain, b) => (
          <g key={b}>
            {chain.length === 0 ? <Halo x={LEFT + 16 + 34} y={y(b)} size={11} fill={SURFACE.muted}>empty</Halo> : null}
            {chain.length > 0 ? <SvgArrow from={{ x: 28, y: y(b) }} to={{ x: x(0), y: y(b) }} trim={R} tone={s.bucketMarks[String(b)] ? 'active' : 'idle'} /> : null}
            {chain.slice(1).map((_key, p) => (
              <SvgArrow key={`a${p}`} from={{ x: x(p), y: y(b) }} to={{ x: x(p + 1), y: y(b) }} trim={R} tone="idle" />
            ))}
            <SvgNode x={28} y={y(b)} r={R} shape="square" label={String(b)} tone={s.bucketMarks[String(b)] ?? 'idle'} />
            {chain.map((key, p) => (
              <SvgNode key={`k${p}`} x={x(p)} y={y(b)} r={R} label={String(key)} tone={s.entryMarks[`${b}:${p}`] ?? 'idle'} />
            ))}
          </g>
        ))}
      </SvgStage>
    </div>
  );
}
