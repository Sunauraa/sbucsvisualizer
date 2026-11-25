/** Test-only: import { checkRenderer } from '@ui/testing'. Runs in the node environment (no jsdom needed). */
import { renderToStaticMarkup } from 'react-dom/server';
import type { Trace } from '@core';
import type { FrameRenderer } from './Workbench';

/**
 * Renders every frame of a trace, forwards then backwards, and throws if a frame shows a raw value
 * (NaN, undefined, Infinity, [object Object]), if any SVG viewBox changes during the trace (the page
 * would jump), or if a frame renders differently the second time. Returns the markup of each frame.
 */
export function checkRenderer<S, R>(Renderer: FrameRenderer<S, R>, trace: Trace<S, R>): string[] {
  const draw = (i: number): string => {
    const frame = trace.frames[i];
    if (!frame) throw new Error(`no frame ${i}`);
    return renderToStaticMarkup(<Renderer frame={frame} previous={trace.frames[i - 1] ?? null} trace={trace} />);
  };
  const boxes = (markup: string): string => (markup.match(/viewBox="[^"]*"/g) ?? []).join(' ');
  const markups = trace.frames.map((_frame, i) => {
    const markup = draw(i);
    const leak = /NaN|\bundefined\b|\[object |\bInfinity\b/.exec(markup);
    if (leak) throw new Error(`${trace.algorithmId} frame ${i} renders "${leak[0]}"`);
    return markup;
  });
  markups.forEach((markup, i) => {
    if (boxes(markup) !== boxes(markups[0] ?? '')) {
      throw new Error(`${trace.algorithmId} frame ${i} changes an SVG viewBox: size the stage from the input, not the frame`);
    }
  });
  for (let i = trace.frames.length - 1; i >= 0; i -= 1) {
    if (draw(i) !== markups[i]) throw new Error(`${trace.algorithmId} frame ${i} renders differently when revisited`);
  }
  return markups;
}
