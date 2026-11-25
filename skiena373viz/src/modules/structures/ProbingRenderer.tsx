import { useId } from 'react';
import { SURFACE, TONES } from '@core';
import { Halo, SvgStage, ToneGlyph } from '@ui';
import type { RendererProps } from '@ui';
import { hashArithmetic } from './algorithms/hashing';
import type { ProbingResult, ProbingState } from './algorithms/hashProbing';
import { fixed } from './ChainingRenderer';
import css from './structures.module.css';

const CELL = 50;
const BOX_W = 44;
const BOX_H = 46;
const ROW = 84;

export const probingColumns = (size: number): number => Math.min(size, 7);

export function describeProbing(state: ProbingState): string {
  const parts = state.slots.map((slot, i) => `slot ${i}: ${slot.status === 'live' ? slot.key : slot.status === 'tombstone' ? 'tombstone' : 'empty'}`);
  return `Hash table with ${state.size} slots, ${state.live} keys and ${state.used - state.live} tombstones. ${parts.join('; ')}`;
}

export function ProbingRenderer({ frame }: RendererProps<ProbingState, ProbingResult>) {
  const s = frame.state;
  const hatch = useId();
  const columns = probingColumns(s.size);
  const rows = Math.ceil(s.size / columns);
  const width = columns * CELL + 8;
  const height = rows * ROW + 4;
  const home = s.hash?.bucket ?? null;
  return (
    <div>
      <p className={css['status']} aria-hidden="true">
        <span>
          m = <strong>{s.size}</strong> slots; live load = {s.live}/{s.size} = <strong>{fixed(s.live / s.size)}</strong>
        </span>
        <span>
          used load, keys plus tombstones = {s.used}/{s.size} = <strong>{fixed(s.used / s.size)}</strong>
          <span className={css['muted']}>{' '}(probing slows down with the used load)</span>
        </span>
      </p>
      <p className={css['math']} aria-hidden="true">{s.hash ? `hash(${s.hash.key}) = ${hashArithmetic(s.hash)}` : ' '}</p>
      <SvgStage width={width} height={height} title={describeProbing(s)}>
        <defs>
          <pattern id={hatch} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={8} height={8} fill="#f1f5f9" />
            <rect width={3} height={8} fill="#94a3b8" />
          </pattern>
        </defs>
        {s.slots.map((slot, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const x = 4 + col * CELL + (CELL - BOX_W) / 2;
          const y = 4 + row * ROW + 18;
          const tone = s.marks[String(i)] ?? 'idle';
          const style = TONES[tone];
          const order = s.path.indexOf(i);
          const fill = slot.status === 'tombstone' ? `url(#${hatch})` : slot.status === 'live' ? style.soft : '#ffffff';
          return (
            <g key={i}>
              <text x={x + BOX_W / 2} y={y - 6} textAnchor="middle" fontSize={11} fill={SURFACE.muted}>{i}</text>
              <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={5} fill={fill} stroke={tone === 'idle' ? (slot.status === 'empty' ? SURFACE.muted : '#334155') : style.color}
                strokeWidth={tone === 'idle' ? (slot.status === 'tombstone' ? 2.5 : 1.5) : 3.5} strokeDasharray={slot.status === 'empty' ? '5 4' : undefined} />
              {slot.status === 'live' ? <text x={x + BOX_W / 2} y={y + BOX_H / 2} dy="0.35em" textAnchor="middle" fontSize={15} fontWeight={700} fill={SURFACE.ink}>{slot.key}</text> : null}
              {slot.status === 'tombstone' ? <Halo x={x + BOX_W / 2} y={y + BOX_H / 2} size={17}>†</Halo> : null}
              {slot.status === 'empty' ? <text x={x + BOX_W / 2} y={y + BOX_H / 2} dy="0.35em" textAnchor="middle" fontSize={10} fill={SURFACE.muted}>empty</text> : null}
              <ToneGlyph x={x + BOX_W - 6} y={y + 6} tone={tone} r={6.5} />
              {order >= 0 ? (
                <g aria-hidden="true">
                  <circle cx={x + 7} cy={y + BOX_H + 12} r={8} fill="#fff" stroke={SURFACE.ink} strokeWidth={1.5} />
                  <text x={x + 7} y={y + BOX_H + 12} dy="0.36em" textAnchor="middle" fontSize={11} fontWeight={700} fill={SURFACE.ink}>{order + 1}</text>
                </g>
              ) : null}
              {i === home ? <text x={x + BOX_W / 2 + 6} y={y + BOX_H + 13} fontSize={11} fontWeight={700} fill={SURFACE.ink} textAnchor="middle">home</text> : null}
              {i === s.reusable ? <text x={x + BOX_W / 2 + 6} y={y + BOX_H + 26} fontSize={10} fontWeight={700} fill={SURFACE.ink} textAnchor="middle">reuse?</text> : null}
            </g>
          );
        })}
      </SvgStage>
      <ul className={css['swatches']} aria-label="Slot kinds">
        <li><span className={`${css['swatch']} ${css['swatchLive']}`} aria-hidden="true" />holds a key</li>
        <li><span className={`${css['swatch']} ${css['swatchTomb']}`} aria-hidden="true" />† tombstone: deleted, still blocks probing</li>
        <li><span className={`${css['swatch']} ${css['swatchEmpty']}`} aria-hidden="true" />never used: ends a search</li>
      </ul>
    </div>
  );
}
