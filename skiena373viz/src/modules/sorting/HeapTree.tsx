/** The heap drawn as a binary tree. Positions follow the array: the children of p are 2p + 1 and 2p + 2. */
import { SvgEdge, SvgNode, SvgStage } from '@ui';
import type { Tone } from '@core';
import type { Item } from './algorithms/common';

const R = 15;
const SLOT = 40;
const ROW = 54;

export interface HeapLayout {
  readonly width: number;
  readonly height: number;
  readonly at: readonly { readonly x: number; readonly y: number }[];
}

/** Pure: node positions for n items. The width and height depend on n only. */
export function heapLayout(n: number): HeapLayout {
  const levels = n <= 0 ? 1 : Math.floor(Math.log2(n)) + 1;
  const width = 2 ** (levels - 1) * SLOT + 8;
  const at = Array.from({ length: n }, (_, p) => {
    const level = Math.floor(Math.log2(p + 1));
    const index = p + 1 - 2 ** level;
    return { x: 4 + ((index + 0.5) * (width - 8)) / 2 ** level, y: 30 + level * ROW };
  });
  return { width, height: 30 + levels * ROW - 10, at };
}

export function HeapTree({ items, labels, tones, heapSize, title }: {
  readonly items: readonly Item[];
  readonly labels: readonly string[];
  readonly tones: readonly Tone[];
  readonly heapSize: number;
  readonly title: string;
}) {
  const layout = heapLayout(items.length);
  return (
    <SvgStage width={layout.width} height={layout.height} title={title} minWidth={items.length > 8 ? Math.round(layout.width * 0.8) : undefined}>
      {items.map((_item, p) => {
        if (p === 0 || p >= heapSize) return null;
        const parent = Math.floor((p - 1) / 2);
        const from = layout.at[parent];
        const to = layout.at[p];
        return from && to ? <SvgEdge key={`e${p}`} from={from} to={to} r={R} /> : null;
      })}
      {items.map((item, p) => {
        const pos = layout.at[p];
        if (!pos) return null;
        return <SvgNode key={item.id} x={pos.x} y={pos.y} r={R} label={labels[item.id] ?? String(item.key)} tone={tones[p] ?? 'idle'} sub={String(p)} />;
      })}
    </SvgStage>
  );
}
