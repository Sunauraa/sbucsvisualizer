/** Test-only. Like checkRenderer from '@ui/testing', but draws only the first frame, the last and every `every`-th one, so large inputs stay fast. */
import { renderToStaticMarkup } from 'react-dom/server';
import type { Trace } from '@core';
import type { FrameRenderer } from '@ui';

export function checkSampled<S, R>(Renderer: FrameRenderer<S, R>, trace: Trace<S, R>, every = 4): void {
  const last = trace.frames.length - 1;
  const picks = trace.frames.map((_frame, i) => i).filter((i) => i === 0 || i === last || i % every === 0);
  const draw = (i: number): string => {
    const frame = trace.frames[i];
    if (!frame) throw new Error(`no frame ${i}`);
    return renderToStaticMarkup(<Renderer frame={frame} previous={trace.frames[i - 1] ?? null} trace={trace} />);
  };
  const boxes = (markup: string): string => (markup.match(/viewBox="[^"]*"/g) ?? []).join(' ');
  const first = boxes(draw(0));
  for (const i of picks) {
    const markup = draw(i);
    const leak = /NaN|\bundefined\b|\[object |\bInfinity\b/.exec(markup);
    if (leak) throw new Error(`${trace.algorithmId} frame ${i} renders "${leak[0]}"`);
    if (boxes(markup) !== first) throw new Error(`${trace.algorithmId} frame ${i} changes an SVG viewBox`);
  }
}
