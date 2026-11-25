/** Array rows and 2-D tables. Both are drawn at fixed cell sizes inside a constant viewBox. */
import { SURFACE, TONES } from '@core';
import type { Tone } from '@core';
import { activatable, Halo, SvgArrow, SvgStage, ToneGlyph } from './Svg';

export interface CellSpec {
  /** '' draws an empty cell. */
  readonly text: string;
  readonly tone?: Tone;
  /** Small text under the cell, e.g. a pointer name 'i' or 'pivot'. */
  readonly pointer?: string;
}

function CellBox({ x, y, w, h, cell, label, onActivate }: {
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly cell: CellSpec; readonly label: string; readonly onActivate?: () => void;
}) {
  const tone = cell.tone ?? 'idle';
  const { color, soft } = TONES[tone];
  const inset = tone === 'idle' ? 0.75 : 1.5;
  return (
    <g {...activatable(label, onActivate)}>
      <rect x={x + inset} y={y + inset} width={w - 2 * inset} height={h - 2 * inset} rx={4}
        fill={soft} stroke={tone === 'idle' ? SURFACE.line : color} strokeWidth={tone === 'idle' ? 1.5 : 3} />
      <text x={x + w / 2} y={y + h / 2} dy="0.35em" textAnchor="middle" fontWeight={600} fill={SURFACE.ink}
        fontSize={cell.text.length > 4 ? 11 : 15}>{cell.text}</text>
      <ToneGlyph x={x + w - 8} y={y + 8} tone={tone} r={6.5} />
    </g>
  );
}

export interface CellRowProps {
  readonly title: string;
  readonly cells: readonly CellSpec[];
  /** Constant for the whole trace: how many slots to reserve room for. Default cells.length. */
  readonly slots?: number;
  readonly showIndexes?: boolean;
  /** Where index labels start. Default 0. */
  readonly firstIndex?: number;
  readonly cellWidth?: number;
  readonly emptyText?: string;
  readonly onCell?: (index: number) => void;
}

/** One array, queue, stack or list. Also right for showing an auxiliary array or a priority queue. */
export function CellRow({
  title, cells, slots = cells.length, showIndexes = true, firstIndex = 0, cellWidth = 46, emptyText = 'empty', onCell,
}: CellRowProps) {
  const h = 42;
  const top = showIndexes ? 20 : 6;
  const width = Math.max(1, slots, cells.length) * cellWidth + 8;
  return (
    <SvgStage width={width} height={top + h + 24} title={title} minWidth={width > 360 ? Math.min(width, 900) : undefined} interactive={onCell !== undefined}>
      {cells.length === 0 ? <Halo x={width / 2} y={top + h / 2} fill={SURFACE.muted}>{emptyText}</Halo> : null}
      {cells.map((cell, i) => {
        const x = 4 + i * cellWidth;
        return (
          <g key={i}>
            {showIndexes ? <text x={x + cellWidth / 2} y={13} textAnchor="middle" fontSize={11} fill={SURFACE.muted}>{firstIndex + i}</text> : null}
            <CellBox x={x} y={top} w={cellWidth - 2} h={h} cell={cell}
              label={`position ${firstIndex + i}: ${cell.text === '' ? 'empty' : cell.text}`}
              onActivate={onCell ? () => onCell(i) : undefined} />
            {cell.pointer ? <text x={x + cellWidth / 2 - 1} y={top + h + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={SURFACE.ink}>{cell.pointer}</text> : null}
          </g>
        );
      })}
    </SvgStage>
  );
}

export interface GridArrow {
  readonly from: readonly [row: number, col: number];
  readonly to: readonly [row: number, col: number];
  readonly tone?: Tone;
  readonly label?: string;
}

export interface CellGridProps {
  readonly title: string;
  readonly rows: number;
  readonly cols: number;
  readonly cell: (row: number, col: number) => CellSpec;
  readonly rowHeader?: (row: number) => string;
  readonly colHeader?: (col: number) => string;
  readonly arrows?: readonly GridArrow[];
  readonly cellSize?: number;
  readonly onCell?: (row: number, col: number) => void;
}

/** A DP table, matrix or any 2-D array, with optional arrows between cells. */
export function CellGrid({ title, rows, cols, cell, rowHeader, colHeader, arrows = [], cellSize = 48, onCell }: CellGridProps) {
  const left = rowHeader ? 46 : 4;
  const top = colHeader ? 34 : 4;
  const width = left + cols * cellSize + 4;
  const height = top + rows * cellSize + 4;
  const center = ([r, c]: readonly [number, number]) => ({ x: left + c * cellSize + cellSize / 2, y: top + r * cellSize + cellSize / 2 });
  return (
    <SvgStage width={width} height={height} title={title} minWidth={width > 340 ? Math.round(width * 0.8) : undefined} interactive={onCell !== undefined}>
      {colHeader ? Array.from({ length: cols }, (_, c) => (
        <text key={`c${c}`} x={left + c * cellSize + cellSize / 2} y={21} textAnchor="middle" fontSize={14} fontWeight={700} fill={SURFACE.ink}>{colHeader(c)}</text>
      )) : null}
      {rowHeader ? Array.from({ length: rows }, (_, r) => (
        <text key={`r${r}`} x={left - 8} y={top + r * cellSize + cellSize / 2} dy="0.35em" textAnchor="end" fontSize={14} fontWeight={700} fill={SURFACE.ink}>{rowHeader(r)}</text>
      )) : null}
      {Array.from({ length: rows * cols }, (_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const spec = cell(r, c);
        return (
          <CellBox key={k} x={left + c * cellSize} y={top + r * cellSize} w={cellSize - 1} h={cellSize - 1} cell={spec}
            label={`row ${r}, column ${c}: ${spec.text === '' ? 'empty' : spec.text}`}
            onActivate={onCell ? () => onCell(r, c) : undefined} />
        );
      })}
      {arrows.map((arrow, i) => (
        <SvgArrow key={i} from={center(arrow.from)} to={center(arrow.to)} tone={arrow.tone ?? 'active'} label={arrow.label} trim={cellSize * 0.28} />
      ))}
    </SvgStage>
  );
}
