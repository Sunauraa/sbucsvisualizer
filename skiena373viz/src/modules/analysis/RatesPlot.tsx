/** The seven growth curves on one pair of axes. Curves that rise past the chart are cut where they cross it, and named. */
import { growthFn, SURFACE } from '@core';
import type { GrowthFnId } from '@core';
import { compactNumber, spreadLabels } from '@ui';
import { crossing, RATE_IDS, RATE_LABEL } from './algorithms/rates';

const W = 700;
const H = 400;
const M = { left: 64, right: 96, top: 40, bottom: 48 };

/** One colour per curve, a dash pattern too, and always a direct label. */
const LOOK: Readonly<Record<GrowthFnId, { readonly color: string; readonly dash: string | undefined }>> = {
  '1': { color: '#64748b', dash: '2 4' },
  'log n': { color: '#0d9488', dash: '8 4' },
  n: { color: '#2563eb', dash: undefined },
  'n log n': { color: '#a21caf', dash: '10 3 2 3' },
  'n²': { color: '#ea580c', dash: '4 3' },
  'n³': { color: '#92400e', dash: '12 4' },
  '2^n': { color: '#0f172a', dash: '6 2 1 2' },
};

export interface RatesPlotProps {
  readonly ids: readonly GrowthFnId[];
  readonly maxN: number;
  readonly logLog: boolean;
  readonly ceiling: number;
  /** The n marked on the chart (and in the table). */
  readonly n: number;
  readonly onPick: (n: number) => void;
}

function decadeTicks(low: number, high: number): number[] {
  const out: number[] = [];
  for (let e = Math.ceil(Math.log10(Math.max(low, 1e-9))); 10 ** e <= high * 1.0001; e += 1) out.push(10 ** e);
  return out;
}

function niceTicks(max: number): number[] {
  const raw = max / 5;
  const base = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const step = ([1, 2, 5, 10].find((factor) => factor * base >= raw) ?? 10) * base;
  return Array.from({ length: Math.floor(max / step + 1e-9) + 1 }, (_, i) => i * step);
}

export function RatesPlot({ ids, maxN, logLog, ceiling, n, onPick }: RatesPlotProps) {
  const shown = RATE_IDS.filter((id) => ids.includes(id));
  const xLow = 1;
  const yLow = logLog ? 1 : 0;
  const yHigh = ceiling;
  const frac = (v: number, low: number, high: number, log: boolean): number =>
    (log ? (Math.log(Math.max(v, low)) - Math.log(low)) / (Math.log(high) - Math.log(low) || 1) : (v - low) / (high - low || 1));
  const x = (value: number): number => M.left + frac(value, xLow, maxN, logLog) * (W - M.left - M.right);
  const y = (value: number): number => H - M.bottom - Math.min(1.02, Math.max(0, frac(value, yLow, yHigh, logLog))) * (H - M.top - M.bottom);

  const curves = shown.map((id) => {
    const { f } = growthFn(id);
    const exit = crossing(id, ceiling, maxN);
    const last = exit ?? maxN;
    const points: { n: number; v: number }[] = [];
    for (let k = 1; k <= Math.floor(last); k += 1) {
      const v = f(k);
      if (logLog && v < 1) continue;
      points.push({ n: k, v });
    }
    if (exit !== null) points.push({ n: exit, v: ceiling });
    else if (Math.floor(maxN) < maxN) points.push({ n: maxN, v: f(maxN) });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    return { id, path, exit, end: points[points.length - 1] };
  });

  const inside = curves.filter((curve) => curve.exit === null && curve.end);
  const labelYs = spreadLabels(inside.map((curve) => y(curve.end?.v ?? 0)), 15, M.top, H - M.bottom);
  const leaving = curves.filter((curve) => curve.exit !== null);
  const pick = Math.min(maxN, Math.max(1, Math.round(n)));
  const xTicks = logLog ? decadeTicks(xLow, maxN) : niceTicks(maxN).filter((t) => t >= 1 || t === 0);
  const yTicks = logLog ? decadeTicks(1, yHigh) : niceTicks(yHigh);

  const readout = shown.map((id) => `${RATE_LABEL[id]}: ${compactNumber(growthFn(id).f(pick))}`).join(' · ');
  return (
    <figure className="growth" style={{ margin: 0 }}>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} className="svg-stage" role="img" tabIndex={0} data-player-keys="off"
          style={{ minWidth: 560, maxWidth: 820 }}
          aria-label={`Growth curves ${shown.map((id) => RATE_LABEL[id]).join(', ') || 'none'} for n from 1 to ${maxN}. Left and right arrow keys move the marked n; a table follows.`}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            onPick(Math.min(maxN, Math.max(1, pick + (event.key === 'ArrowRight' ? 1 : -1))));
          }}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            if (box.width === 0) return;
            const px = ((event.clientX - box.left) / box.width) * W;
            const t = Math.min(1, Math.max(0, (px - M.left) / (W - M.left - M.right)));
            onPick(Math.round(logLog ? Math.exp(t * Math.log(maxN)) : 1 + t * (maxN - 1)));
          }}>
          <defs><clipPath id="rates-clip"><rect x={M.left} y={M.top - 8} width={W - M.left - M.right + 4} height={H - M.top - M.bottom + 10} /></clipPath></defs>
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={SURFACE.grid} />
              <text x={M.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={12} fill={SURFACE.muted}>{compactNumber(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={x(Math.max(t, 1))} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill={SURFACE.muted}>{compactNumber(t)}</text>
          ))}
          <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke={SURFACE.line} />
          <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" fontSize={13} fill={SURFACE.ink}>n{logLog ? ' (log scale)' : ''}</text>
          <text transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill={SURFACE.ink}>steps{logLog ? ' (log scale)' : ''}</text>
          <g clipPath="url(#rates-clip)">
            {curves.map((curve) => (
              <path key={curve.id} d={curve.path} fill="none" stroke={LOOK[curve.id].color} strokeWidth={2.25} strokeDasharray={LOOK[curve.id].dash} />
            ))}
          </g>
          <line x1={x(pick)} x2={x(pick)} y1={M.top} y2={H - M.bottom} stroke={SURFACE.muted} strokeDasharray="3 3" />
          {shown.map((id) => {
            const v = growthFn(id).f(pick);
            return v <= ceiling && (!logLog || v >= 1)
              ? <circle key={`dot${id}`} cx={x(pick)} cy={y(v)} r={4.5} fill={LOOK[id].color} stroke="#fff" strokeWidth={1.5} />
              : null;
          })}
          {inside.map((curve, i) => (
            <g key={`label${curve.id}`}>
              <line x1={W - M.right + 8} x2={W - M.right + 22} y1={labelYs[i]} y2={labelYs[i]} stroke={LOOK[curve.id].color} strokeWidth={2.25} strokeDasharray={LOOK[curve.id].dash} />
              <text x={W - M.right + 27} y={labelYs[i]} dy="0.35em" fontSize={12} fontWeight={700} fill={SURFACE.ink}>{RATE_LABEL[curve.id]}</text>
            </g>
          ))}
          {leaving.map((curve, i) => {
            const at = x(curve.exit ?? maxN);
            return (
              <g key={`leave${curve.id}`}>
                <text x={Math.min(at, W - M.right - 30)} y={M.top - 12 - (i % 2) * 14} textAnchor="middle" fontSize={12} fontWeight={700} fill={SURFACE.ink}>{RATE_LABEL[curve.id]} ↑</text>
                <line x1={at} x2={at} y1={M.top - (i % 2 === 0 ? 8 : 0)} y2={M.top} stroke={LOOK[curve.id].color} strokeWidth={2.25} />
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="growth-readout" aria-live="polite">n = {pick}: {readout || 'no curve selected'}</figcaption>
    </figure>
  );
}
