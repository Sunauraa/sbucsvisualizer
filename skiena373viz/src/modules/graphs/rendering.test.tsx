import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GRAPH_HEIGHT, GRAPH_WIDTH } from '@core';
import { checkRenderer } from '@ui/testing';
import { inputOf } from './algorithms/fixtures';
import { KINDS, VIEW_LINKS } from './kinds';
import { GraphRenderer } from './GraphRenderer';
import { edgeMarks, vertexMarks } from './marks';
import { slotsFor, StructurePanel } from './StructurePanel';
import type { GraphState } from './algorithms/types';
import manifest from './index';

const cases = Object.values(KINDS).flatMap((config) => config.algorithm.presets.map((p) => [config.kind, p.id, config] as const));

describe('the stage and the structure panel', () => {
  it.each(cases)('every frame of %s preset %s renders, keeps its viewBox, and leaks no raw value', (_kind, _id, config) => {
    const preset = config.algorithm.presets.find((p) => p.id === _id);
    if (!preset) throw new Error('missing preset');
    const trace = config.algorithm.run(preset.input);
    checkRenderer(GraphRenderer, trace as never);
    const slots = slotsFor(trace.frames as readonly { state: GraphState }[]);
    for (const frame of trace.frames) {
      const html = renderToStaticMarkup(<StructurePanel state={frame.state as GraphState} slots={slots} />);
      expect(html).not.toMatch(/NaN|undefined|\[object |Infinity/);
    }
  });

  it('the stage viewBox is the logical canvas for every view', () => {
    const config = KINDS.bfs;
    const trace = config.algorithm.run(config.algorithm.presets[0]?.input ?? inputOf(''));
    const html = checkRenderer(GraphRenderer, trace as never)[0] ?? '';
    expect(html).toContain(`viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}"`);
  });

  it('the structure panel keeps the same row width while stepping (slots come from the whole trace)', () => {
    const config = KINDS.dijkstra;
    const trace = config.algorithm.run(config.algorithm.presets[1]?.input ?? inputOf(''));
    const slots = slotsFor(trace.frames as readonly { state: GraphState }[]);
    const widths = new Set(trace.frames.map((f) => {
      const html = renderToStaticMarkup(<StructurePanel state={f.state as GraphState} slots={slots} />);
      return /viewBox="0 0 (\d+) /.exec(html)?.[1];
    }));
    expect(widths.size).toBe(1);
  });

  it('shows the priority queue with its ends named and stale entries marked in words, not colour', () => {
    const config = KINDS.dijkstra;
    const trace = config.algorithm.run(config.algorithm.presets[1]?.input ?? inputOf(''));
    const staleFrame = trace.frames.find((f) => (f.state as GraphState).containers[0]?.items.some((i) => i.kind === 'stale'));
    expect(staleFrame).toBeDefined();
    const html = renderToStaticMarkup(<StructurePanel state={staleFrame?.state as GraphState} slots={slotsFor(trace.frames as readonly { state: GraphState }[])} />);
    expect(html).toContain('front');
    expect(html).toContain('✗');
    expect(html).toContain('stale: ');
  });

  it('edge classes carry a label and a dash, not just a colour', () => {
    const trace = KINDS.dfs.algorithm.run(KINDS.dfs.algorithm.presets[0]?.input ?? inputOf(''));
    const last = trace.frames[trace.frames.length - 1]?.state as GraphState;
    const marks = edgeMarks(last);
    const byLabel = Object.values(marks).map((m) => `${m.label?.split(' ')[0]}|${m.dash ?? 'solid'}`).sort();
    expect(byLabel).toEqual(['back|7 5', 'cross|10 4 2 4', 'fwd|2 5', 'tree|solid', 'tree|solid', 'tree|solid']);
    expect(Object.keys(vertexMarks(last))).toHaveLength(4);
  });

  it('the manifest lists exactly the six views, in the order the "same graph in" links use', () => {
    expect(manifest.views.map((v) => v.id)).toEqual(VIEW_LINKS.map((v) => v.id));
    expect(manifest.views.map((v) => v.id)).toEqual(['bfs', 'dfs', 'topological-sort', 'prim', 'kruskal', 'dijkstra']);
  });
});
