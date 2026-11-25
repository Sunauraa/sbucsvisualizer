/** Pure geometry for edges, so it can be unit-tested. */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface EdgeGeometry {
  /** SVG path data. */
  readonly path: string;
  /** Where a label goes. */
  readonly mid: Pt;
  /** Tip of the arrowhead, and the direction it points, in radians. */
  readonly tip: Pt;
  readonly angle: number;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Edge from a to b between circles of radius r. `bend` pushes the curve sideways (0 = straight); use
 * opposite-direction edges with the same positive bend and they separate. a === b gives a self-loop.
 */
export function edgeGeometry(a: Pt, b: Pt, radius: number, bend = 0, gap = 2): EdgeGeometry {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    const top = { x: a.x, y: a.y - radius };
    const path = `M ${r1(a.x - radius * 0.6)} ${r1(a.y - radius * 0.8)} C ${r1(a.x - radius * 2)} ${r1(a.y - radius * 2.8)}, `
      + `${r1(a.x + radius * 2)} ${r1(a.y - radius * 2.8)}, ${r1(a.x + radius * 0.6)} ${r1(a.y - radius * 0.8)}`;
    return { path, mid: { x: a.x, y: top.y - radius * 1.25 }, tip: { x: a.x + radius * 0.6, y: a.y - radius * 0.8 }, angle: 2.1 };
  }
  const normal = { x: -dy / length, y: dx / length };
  const control = { x: (a.x + b.x) / 2 + normal.x * bend * 2, y: (a.y + b.y) / 2 + normal.y * bend * 2 };
  const start = toward(a, control, radius + gap);
  const tip = toward(b, control, radius + gap);
  const path = bend === 0
    ? `M ${r1(start.x)} ${r1(start.y)} L ${r1(tip.x)} ${r1(tip.y)}`
    : `M ${r1(start.x)} ${r1(start.y)} Q ${r1(control.x)} ${r1(control.y)} ${r1(tip.x)} ${r1(tip.y)}`;
  const mid = { x: (start.x + 2 * control.x + tip.x) / 4, y: (start.y + 2 * control.y + tip.y) / 4 };
  return { path, mid, tip, angle: Math.atan2(tip.y - control.y, tip.x - control.x) };
}

function toward(from: Pt, to: Pt, distance: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

/** Polygon points of an arrowhead whose tip is at `tip`. */
export function arrowPoints(tip: Pt, angle: number, size = 10): string {
  const corner = (offset: number): string =>
    `${r1(tip.x - size * Math.cos(angle + offset))},${r1(tip.y - size * Math.sin(angle + offset))}`;
  return `${r1(tip.x)},${r1(tip.y)} ${corner(0.42)} ${corner(-0.42)}`;
}

/** Moves label positions apart so neighbours are at least `gap` apart; keeps order and input indexing. */
export function spreadLabels(positions: readonly number[], gap: number, low: number, high: number): number[] {
  const order = positions.map((y, i) => ({ y, i })).sort((p, q) => p.y - q.y);
  let floor = low;
  for (const item of order) {
    item.y = Math.max(item.y, floor);
    floor = item.y + gap;
  }
  let ceiling = high;
  for (const item of [...order].reverse()) {
    item.y = Math.min(item.y, ceiling);
    ceiling = item.y - gap;
  }
  const out = [...positions];
  for (const item of order) out[item.i] = item.y;
  return out;
}
