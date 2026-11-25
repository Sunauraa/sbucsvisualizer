/** Pure: turns one frame's state into what the bars show. Shared by the single views and the race lanes. */
import type { Tone } from '@core';
import type { BarModel, BarSpec, Mark, Pointer } from './SortBars';
import type { HeapsortState } from './algorithms/heapsort';
import type { MergesortState } from './algorithms/mergesort';
import type { QuicksortState } from './algorithms/quicksort';
import type { Item } from './algorithms/common';

const bar = (item: Item, labels: readonly string[], tone: Tone): BarSpec => ({ label: labels[item.id] ?? String(item.key), key: item.key, tone });

/** The tone of heap position p: sorted suffix, just swapped, being compared, being sifted, or idle. */
export function heapTone(state: HeapsortState, p: number): Tone {
  if (state.phase === 'done' || (state.phase === 'extract' && p >= state.heapSize)) return 'done';
  if (state.swapped.includes(p)) return 'swap';
  if (state.compare.includes(p)) return 'compare';
  if (p === state.sift) return 'active';
  return 'idle';
}

export function heapModel(state: HeapsortState): BarModel {
  const { items, labels, heapSize, phase, sift, big } = state;
  const pointers: Pointer[] = [];
  if (sift !== null) pointers.push({ at: sift, text: 'i' });
  if (big !== null && big !== sift) pointers.push({ at: big, text: 'big' });
  const marks: Mark[] = [];
  if (phase === 'extract' || phase === 'done') {
    if (heapSize > 0) marks.push({ from: 0, to: heapSize, text: 'heap', tone: 'active' });
    if (heapSize < items.length) marks.push({ from: heapSize, to: items.length, text: 'sorted', tone: 'done' });
  }
  return { bars: items.map((item, p) => bar(item, labels, heapTone(state, p))), pointers, marks, band: null };
}

const lastNode = (state: { readonly nodes: readonly { readonly id: number; readonly lo: number; readonly hi: number }[]; readonly stack: readonly number[] }) =>
  state.nodes.find((node) => node.id === state.stack[state.stack.length - 1]) ?? null;

const inRun = (runs: readonly (readonly [number, number])[], p: number): boolean => runs.some(([lo, hi]) => p >= lo && p < hi);

export function mergeArrayModel(state: MergesortState): BarModel {
  const { items, labels, merging, k, taken, runs, phase, stack } = state;
  const node = lastNode(state);
  const bandRange: readonly [number, number] | null = merging ?? (node && stack.length > 0 ? [node.lo, node.hi] : null);
  const bars = items.map((item, p): BarSpec | null => {
    if (item === null) return null;
    let tone: Tone = 'idle';
    if (phase === 'done') tone = 'done';
    else if (p === taken) tone = 'swap';
    else if (merging && k !== null && p >= merging[0] && p < k) tone = 'active';
    else if (inRun(runs, p)) tone = 'visited';
    return bar(item, labels, tone);
  });
  const pointers: Pointer[] = k !== null && merging && k < items.length ? [{ at: k, text: 'k' }] : [];
  const band = bandRange && phase !== 'done'
    ? { from: bandRange[0], to: bandRange[1], text: merging ? `merging A[${merging[0]}..${merging[1] - 1}]` : `call on A[${bandRange[0]}..${bandRange[1] - 1}]` }
    : null;
  return { bars, pointers, marks: [], band };
}

export function mergeBufferModel(state: MergesortState): BarModel {
  const { buffer, labels, merging, mid, i, j, compare } = state;
  const bars = buffer.map((item, p): BarSpec | null => (item === null ? null : bar(item, labels, compare.includes(p) ? 'compare' : 'visited')));
  const pointers: Pointer[] = [];
  if (merging) {
    if (i !== null && mid !== null && i < mid) pointers.push({ at: i, text: 'i' });
    if (j !== null && j < merging[1]) pointers.push({ at: j, text: 'j' });
  }
  const marks: Mark[] = merging && mid !== null
    ? [
      { from: merging[0], to: mid, text: 'left run', tone: 'visited' },
      { from: mid, to: merging[1], text: 'right run', tone: 'visited', dashed: true },
    ]
    : [];
  return { bars, pointers, marks, band: null };
}

export function quickModel(state: QuicksortState): BarModel {
  const { items, labels, range, store, j, pivotPos, phase, compare, swapped, candidates, settled } = state;
  const bars = items.map((item, p) => {
    let tone: Tone = 'idle';
    if (phase === 'done' || settled[p]) tone = 'done';
    if (p === pivotPos && phase !== 'place' && phase !== 'done') tone = 'target';
    if (compare.includes(p) && p !== pivotPos) tone = 'compare';
    if (swapped.includes(p)) tone = 'swap';
    if (candidates.includes(p) && tone === 'idle') tone = 'compare';
    return bar(item, labels, tone);
  });
  const pointers: Pointer[] = [];
  const marks: Mark[] = [];
  if (range && store !== null && j !== null && pivotPos !== null && phase !== 'return') {
    const [lo, hi] = range;
    const scanEnd = phase === 'place' ? hi : hi - 1;
    const placed = phase === 'place';
    pointers.push({ at: Math.min(store, items.length - 1), text: 'store' });
    if (!placed && j < hi - 1 && j !== store) pointers.push({ at: j, text: 'j' });
    if (store > lo) marks.push({ from: lo, to: store, text: '< p', tone: 'done' });
    if (placed) {
      marks.push({ from: store, to: store + 1, text: 'p', tone: 'target' });
      if (store + 1 < hi) marks.push({ from: store + 1, to: hi, text: '≥ p', tone: 'swap', dashed: true });
    } else {
      if (j > store) marks.push({ from: store, to: j, text: '≥ p', tone: 'swap', dashed: true });
      if (j < scanEnd) marks.push({ from: j, to: scanEnd, text: '?', tone: 'idle', dashed: true });
      marks.push({ from: hi - 1, to: hi, text: 'p', tone: 'target' });
    }
  }
  const band = range && phase !== 'done' ? { from: range[0], to: range[1], text: `partitioning A[${range[0]}..${range[1] - 1}]` } : null;
  return { bars, pointers, marks, band };
}
