// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAPH_HEIGHT, GRAPH_WIDTH } from '@core';
import { inputOf } from './algorithms/fixtures';
import { CANVAS_MIN_WIDTH, GraphCanvas, NARROW_BELOW, NARROW_LOOK, WIDE_LOOK } from './GraphCanvas';

type Callback = () => void;
let callbacks: Callback[] = [];
let boxWidth = 640;

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: Callback) { callbacks.push(callback); }
    observe(): void { /* the test calls the callbacks itself */ }
    disconnect(): void { /* nothing to release */ }
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => boxWidth });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

const graph = inputOf('A-B, B-C').graph;
const radii = (container: HTMLElement): string[] => [...container.querySelectorAll('circle')].filter((c) => c.getAttribute('fill') !== '#fff').map((c) => c.getAttribute('r') ?? '');
const labelSizes = (container: HTMLElement): string[] => [...container.querySelectorAll('text')].filter((t) => ['A', 'B', 'C'].includes(t.textContent ?? '')).map((t) => t.getAttribute('font-size') ?? '');
const measure = (): void => act(() => { for (const callback of callbacks) callback(); });

describe('the graph canvas on a narrow screen', () => {
  it('may shrink to 300 CSS pixels before it scrolls (it was 440, which hid a quarter of the drawing on a phone)', () => {
    expect(CANVAS_MIN_WIDTH).toBe(300);
    const { container } = render(<GraphCanvas graph={graph} title="t" />);
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('min-width: 300px');
  });

  it('draws vertices at radius 24 with 15 px labels when the box is under 480 px, and at 21 and 14 otherwise', () => {
    expect(NARROW_BELOW).toBe(480);
    expect(NARROW_LOOK).toMatchObject({ radius: 24, label: 15 });
    expect(WIDE_LOOK).toMatchObject({ radius: 21, label: 14 });
    boxWidth = 324;
    const narrow = render(<GraphCanvas graph={graph} title="t" />);
    measure();
    expect(radii(narrow.container)).toEqual(['24', '24', '24']);
    expect(labelSizes(narrow.container)).toEqual(['15', '15', '15']);
    narrow.unmount();
    callbacks = [];
    boxWidth = 900;
    const wide = render(<GraphCanvas graph={graph} title="t" />);
    measure();
    expect(radii(wide.container)).toEqual(['21', '21', '21']);
    expect(labelSizes(wide.container)).toEqual(['14', '14', '14']);
  });

  it('the stage size is the logical canvas whatever the box width, so it never depends on the frame or the screen', () => {
    boxWidth = 324;
    const { container } = render(<GraphCanvas graph={graph} title="t" />);
    measure();
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`);
  });
});
