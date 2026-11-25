/** One array drawn as labelled bars. Width and height depend on the input only, never on the frame. */
import { SURFACE, TONES } from '@core';
import type { Tone } from '@core';
import { Halo, SvgStage, ToneGlyph } from '@ui';

/** One bar. A null slot is drawn as a hole. */
export interface BarSpec {
  readonly label: string;
  readonly key: number;
  readonly tone: Tone;
}

export interface Pointer {
  readonly at: number;
  readonly text: string;
}

/** A bracket under positions [from, to). */
export interface Mark {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly tone: Tone;
  readonly dashed?: boolean;
}

export interface Band {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

export interface BarModel {
  readonly bars: readonly (BarSpec | null)[];
  readonly pointers: readonly Pointer[];
  readonly marks: readonly Mark[];
  readonly band: Band | null;
}

export interface KeyRange {
  readonly min: number;
  readonly max: number;
}

export const keyRange = (keys: readonly number[]): KeyRange => ({ min: Math.min(0, ...keys), max: Math.max(0, ...keys) });

export interface SortBarsProps {
  readonly title: string;
  readonly model: BarModel;
  readonly range: KeyRange;
  /** Number of slots to draw; constant for a trace. Default: the number of bars. */
  readonly slots?: number;
  readonly slot?: number;
  readonly barHeight?: number;
  /** Reserve a row for the band, pointers and marks. Keep each constant for a trace. */
  readonly rows?: { readonly band?: boolean; readonly pointers?: boolean; readonly marks?: boolean };
  readonly emptyText?: string;
}

export function SortBars({ title, model, range, slots, slot = 36, barHeight = 110, rows = {}, emptyText = 'the array is empty' }: SortBarsProps) {
  const count = Math.max(slots ?? model.bars.length, 1);
  const width = count * slot + 8;
  const bandH = rows.band ? 20 : 0;
  const glyphH = 18;
  const labelH = 22;
  const pointerH = rows.pointers ? 20 : 0;
  const markH = rows.marks ? 26 : 0;
  const top = bandH + glyphH;
  const height = top + barHeight + labelH + pointerH + markH + 4;
  const span = range.max - range.min || 1;
  const zeroY = top + (barHeight * range.max) / span;
  const x = (p: number): number => 4 + p * slot;
  const barsY = top + barHeight;
  return (
    <SvgStage width={width} height={height} title={title} minWidth={count > 8 ? Math.round(width * 0.62) : undefined}>
      {model.band ? (
        <g aria-hidden="true">
          <rect x={x(model.band.from) + 1} y={bandH - 2} width={(model.band.to - model.band.from) * slot - 2} height={height - bandH - 2}
            rx={6} fill="#f1f5f9" stroke={SURFACE.line} strokeDasharray="4 3" />
          <text x={x(model.band.from) + 6} y={bandH - 7} fontSize={12} fontWeight={700} fill={SURFACE.muted}>{model.band.text}</text>
        </g>
      ) : null}
      {model.bars.length === 0 ? <Halo x={width / 2} y={top + barHeight / 2} fill={SURFACE.muted}>{emptyText}</Halo> : null}
      <line x1={4} x2={width - 4} y1={zeroY} y2={zeroY} stroke={SURFACE.line} />
      {model.bars.map((bar, p) => {
        const cx = x(p) + slot / 2;
        if (bar === null) {
          return (
            <g key={p} aria-hidden="true">
              <rect x={x(p) + 4} y={zeroY - 22} width={slot - 8} height={22} rx={4} fill="none" stroke={SURFACE.muted} strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={cx} y={zeroY - 11} dy="0.35em" textAnchor="middle" fontSize={13} fill={SURFACE.muted}>∅</text>
              <text x={cx} y={barsY + 13} textAnchor="middle" fontSize={11} fill={SURFACE.muted}>hole</text>
            </g>
          );
        }
        const style = TONES[bar.tone];
        const h = Math.max(5, (Math.abs(bar.key) / span) * barHeight);
        const y = bar.key >= 0 ? zeroY - h : zeroY;
        return (
          <g key={p}>
            <rect x={x(p) + 3} y={y} width={slot - 6} height={h} rx={3} fill={style.soft} stroke={bar.tone === 'idle' ? SURFACE.muted : style.color} strokeWidth={bar.tone === 'idle' ? 1.5 : 3} />
            <ToneGlyph x={cx} y={top - 9} tone={bar.tone} r={7} />
            <text x={cx} y={barsY + 14} textAnchor="middle" fontSize={bar.label.length > 3 ? 11 : 13} fontWeight={700} fill={SURFACE.ink}>{bar.label}</text>
          </g>
        );
      })}
      {model.pointers.map((pointer, k) => (
        <text key={`${pointer.text}${k}`} x={x(pointer.at) + slot / 2} y={barsY + labelH + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={SURFACE.ink}>
          {pointer.text}
        </text>
      ))}
      {model.marks.map((mark, k) => {
        const x1 = x(mark.from) + 4;
        const x2 = x(mark.to) - 2;
        const y = barsY + labelH + pointerH + 6;
        const { color, ink } = TONES[mark.tone];
        return (
          <g key={`${mark.text}${k}`} aria-hidden="true">
            <path d={`M ${x1} ${y - 4} V ${y} H ${x2} V ${y - 4}`} fill="none" stroke={color} strokeWidth={2} strokeDasharray={mark.dashed ? '4 3' : undefined} />
            <text x={(x1 + x2) / 2} y={y + 13} textAnchor="middle" fontSize={12} fontWeight={600} fill={ink}>{mark.text}</text>
          </g>
        );
      })}
    </SvgStage>
  );
}

/** A plain-words description of the bars, for the accessible name. */
export function describeBars(model: BarModel, tail = ''): string {
  const parts = model.bars.map((bar, p) => (bar === null ? `${p}: hole` : `${p}: ${bar.label}${bar.tone === 'idle' ? '' : ` (${bar.tone})`}`));
  return `${parts.join(', ') || 'empty'}${tail}`;
}
