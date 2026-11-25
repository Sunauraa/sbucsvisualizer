/** Measured counts against theory curves. One axis pair, direct labels, keyboard readout, data table. */
import { useId, useState } from 'react';
import { growthFn, scaleToLast, SERIES, SURFACE } from '@core';
import type { GrowthFnId, Point } from '@core';
import { spreadLabels } from './geometry';
import { ScrollX } from './ScrollX';

export interface GrowthSeries {
  readonly id: string;
  readonly label: string;
  readonly points: readonly Point[];
}

export interface GrowthPlotProps {
  readonly title: string;
  readonly xLabel: string;
  readonly yLabel: string;
  /** At most 4. Colour follows position, so keep each series at a fixed position. */
  readonly series: readonly GrowthSeries[];
  readonly curves: readonly GrowthFnId[];
  /** 'fit' scales each curve to meet the last point of series[0]; 'raw' uses constant 1. */
  readonly scaling?: 'fit' | 'raw';
  readonly logLog?: boolean;
}

const W = 680;
const H = 380;
const M = { left: 62, right: 118, top: 16, bottom: 46 };
const DASHES: Readonly<Record<GrowthFnId, string>> = {
  '1': '1 5', 'log n': '2 4', n: '7 4', 'n log n': '10 3 2 3', 'n²': '3 3', 'n³': '12 4', '2^n': '6 2 1 2',
};
const MARKERS = ['circle', 'square', 'triangle', 'diamond'] as const;

export const compactNumber = (v: number): string => {
  if (!Number.isFinite(v)) return 'too large';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e9) return v.toExponential(1);
  if (Math.abs(v) >= 1e6) return `${trim(v / 1e6)}M`;
  if (Math.abs(v) >= 1e4) return `${trim(v / 1e3)}k`;
  if (Math.abs(v) >= 100 || Number.isInteger(v)) return String(Math.round(v));
  return trim(v);
};
const trim = (v: number): string => String(Number(v.toPrecision(3)));

function ticks(max: number, log: boolean, min: number): number[] {
  if (log) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e += 1) out.push(10 ** e);
    return out.filter((t) => t >= min && t <= max);
  }
  const step = niceStep(max / 5);
  return Array.from({ length: Math.floor(max / step + 1e-9) + 1 }, (_, i) => i * step);
}

function niceStep(raw: number): number {
  const base = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const factor = [1, 2, 5, 10].find((f) => f * base >= raw) ?? 10;
  return factor * base;
}

function Marker({ kind, x, y, color }: { readonly kind: (typeof MARKERS)[number]; readonly x: number; readonly y: number; readonly color: string }) {
  const shared = { fill: color, stroke: '#fff', strokeWidth: 1.5 };
  if (kind === 'circle') return <circle cx={x} cy={y} r={4.5} {...shared} />;
  if (kind === 'square') return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} {...shared} />;
  if (kind === 'triangle') return <polygon points={`${x},${y - 5.5} ${x + 5.5},${y + 4.5} ${x - 5.5},${y + 4.5}`} {...shared} />;
  return <polygon points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`} {...shared} />;
}

export function GrowthPlot({ title, xLabel, yLabel, series, curves, scaling = 'fit', logLog = false }: GrowthPlotProps) {
  const clipId = `clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [picked, setPicked] = useState<number | null>(null);
  const shown = series.slice(0, SERIES.length);
  const all = shown.flatMap((s) => s.points).filter((p) => !logLog || (p.n > 0 && p.value > 0));
  if (all.length === 0) return <p className="muted">No measurements to plot yet.</p>;

  const reference = shown[0]?.points ?? [];
  const maxN = Math.max(...all.map((p) => p.n));
  const minN = logLog ? Math.min(...all.map((p) => p.n)) : 0;
  const maxValue = Math.max(1, ...all.map((p) => p.value));
  const minValue = logLog ? Math.max(0.5, Math.min(...all.map((p) => p.value))) : 0;
  const maxY = logLog ? maxValue * 2 : maxValue * 1.12;
  const minY = logLog ? minValue / 2 : 0;

  const scale = (v: number, low: number, high: number, log: boolean): number =>
    (log ? (Math.log(v) - Math.log(low)) / (Math.log(high) - Math.log(low) || 1) : (v - low) / (high - low || 1));
  const x = (n: number): number => M.left + scale(n, minN, maxN, logLog) * (W - M.left - M.right);
  const y = (v: number): number => H - M.bottom - scale(Math.min(v, maxY * 4), minY, maxY, logLog) * (H - M.top - M.bottom);

  const theory = curves.map((id) => {
    const { f } = growthFn(id);
    const c = scaling === 'fit' ? scaleToLast(reference, f) : 1;
    const samples = Array.from({ length: 121 }, (_, i) =>
      (logLog ? minN * (maxN / Math.max(minN, 1e-9)) ** (i / 120) : (maxN * i) / 120));
    const points = c === null ? [] : samples
      .map((n) => ({ n, value: c * f(n) }))
      .filter((p) => Number.isFinite(p.value) && (!logLog || p.value > minY / 8));
    const end = [...points].reverse().find((p) => p.value <= maxY) ?? points[0];
    return { id, c, points, end };
  }).filter((curve) => curve.points.length > 1);

  const line = (points: readonly Point[]): string =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  const labels = [
    ...shown.map((s, i) => ({ text: s.label, y: y(s.points[s.points.length - 1]?.value ?? 0), color: SERIES[i] ?? SURFACE.ink, bold: true })),
    ...theory.map((t) => ({ text: t.id, y: t.end ? y(Math.min(t.end.value, maxY)) : M.top, color: SURFACE.muted, bold: false })),
  ];
  const labelY = spreadLabels(labels.map((l) => l.y), 15, M.top + 4, H - M.bottom);

  const sizes = [...new Set(all.map((p) => p.n))].sort((a, b) => a - b);
  const selected = picked !== null && sizes.includes(picked) ? picked : null;
  const move = (delta: number): void => {
    const at = selected === null ? (delta > 0 ? -1 : sizes.length) : sizes.indexOf(selected);
    setPicked(sizes[Math.min(sizes.length - 1, Math.max(0, at + delta))] ?? null);
  };
  const readout = selected === null ? null : [
    ...shown.map((s) => `${s.label}: ${compactNumber(s.points.find((p) => p.n === selected)?.value ?? 0)}`),
    ...theory.map((t) => `${coefficient(t.c)}${t.id}: ${compactNumber((t.c ?? 1) * growthFn(t.id).f(selected))}`),
  ].join(' · ');

  return (
    <figure className="growth">
      <figcaption>{title}</figcaption>
      <ScrollX label={title}>
      <svg viewBox={`0 0 ${W} ${H}`} className="svg-stage growth-svg" role="img" tabIndex={0} data-player-keys="off"
        aria-label={`${title}. Left and right arrow keys read out values; a table follows.`}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          move(event.key === 'ArrowRight' ? 1 : -1);
        }}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (box.width === 0) return;
          const px = ((event.clientX - box.left) / box.width) * W;
          setPicked(sizes.reduce((best, n) => (Math.abs(x(n) - px) < Math.abs(x(best) - px) ? n : best), sizes[0] ?? 0));
        }}
        onPointerLeave={() => setPicked(null)}>
        <defs><clipPath id={clipId}><rect x={M.left} y={M.top - 6} width={W - M.left - M.right + 8} height={H - M.top - M.bottom + 6} /></clipPath></defs>
        {ticks(maxY, logLog, Math.max(minY, 1e-9)).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={SURFACE.grid} />
            <text x={M.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={12} fill={SURFACE.muted}>{compactNumber(t)}</text>
          </g>
        ))}
        {(logLog ? sizes : ticks(maxN, false, 0)).map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill={SURFACE.muted}>{compactNumber(t)}</text>
        ))}
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke={SURFACE.line} />
        <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" fontSize={13} fill={SURFACE.ink}>{xLabel}{logLog ? ' (log scale)' : ''}</text>
        <text transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill={SURFACE.ink}>{yLabel}{logLog ? ' (log scale)' : ''}</text>
        <g clipPath={`url(#${clipId})`}>
          {shown.map((s, i) => <path key={s.id} d={line(s.points.filter((p) => !logLog || (p.n > 0 && p.value > 0)))} fill="none" stroke={SERIES[i]} strokeWidth={2} />)}
          {theory.map((t) => <path key={t.id} d={line(t.points)} fill="none" stroke={SURFACE.muted} strokeWidth={1.75} strokeDasharray={DASHES[t.id]} />)}
        </g>
        {selected === null ? null : <line x1={x(selected)} x2={x(selected)} y1={M.top} y2={H - M.bottom} stroke={SURFACE.muted} />}
        {shown.map((s, i) => s.points.filter((p) => !logLog || (p.n > 0 && p.value > 0)).map((p) => (
          <Marker key={`${s.id}${p.n}`} kind={MARKERS[i] ?? 'circle'} x={x(p.n)} y={y(p.value)} color={SERIES[i] ?? SURFACE.ink} />
        )))}
        {labels.map((l, i) => (
          <g key={l.text + String(i)}>
            <line x1={W - M.right + 8} x2={W - M.right + 22} y1={labelY[i]} y2={labelY[i]} stroke={l.color} strokeWidth={l.bold ? 3 : 1.75}
              strokeDasharray={l.bold ? undefined : DASHES[theory[i - shown.length]?.id ?? 'n']} />
            <text x={W - M.right + 27} y={labelY[i]} dy="0.35em" fontSize={12} fontWeight={l.bold ? 700 : 500} fill={SURFACE.ink}>{l.text}</text>
          </g>
        ))}
      </svg>
      </ScrollX>
      <p className="growth-readout" aria-live="polite">{selected === null ? 'Point at the plot, or focus it and use the arrow keys, to read values.' : `n = ${selected} · ${readout ?? ''}`}</p>
      <details>
        <summary>Data table and ratios</summary>
        <ScrollX label="Measurements">
          <table>
            <thead>
              <tr>
                <th scope="col">n</th>
                {shown.map((s) => <th scope="col" key={s.id}>{s.label}</th>)}
                {curves.map((id) => <th scope="col" key={id}>{shown[0]?.label ?? 'measured'} ÷ {id}</th>)}
              </tr>
            </thead>
            <tbody>
              {sizes.map((n) => {
                const base = reference.find((p) => p.n === n)?.value;
                return (
                  <tr key={n}>
                    <th scope="row">{n}</th>
                    {shown.map((s) => <td key={s.id}>{s.points.find((p) => p.n === n)?.value ?? '–'}</td>)}
                    {curves.map((id) => {
                      const f = growthFn(id).f(n);
                      return <td key={id}>{base === undefined || f <= 0 || !Number.isFinite(f) ? '–' : trim(base / f)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollX>
        <p className="muted">A ratio column that settles to a constant is the sign of a matching growth rate. It is evidence, not a proof.</p>
      </details>
    </figure>
  );
}

const coefficient = (c: number | null): string => (c === null || c === 1 ? '' : `${trim(c)}·`);
