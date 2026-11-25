// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BfsView from './BfsView';
import DfsView from './DfsView';
import DijkstraView from './DijkstraView';
import PrimView from './PrimView';
import TopologicalSortView from './TopologicalSortView';
import { carriedPatch, resetCarried } from './useGraphModel';

const noop = (): void => undefined;
const text = (): HTMLTextAreaElement => screen.getByLabelText('Graph as text');
const stageTable = (): HTMLElement => screen.getByRole('table');
const rowLabels = (): string[] => within(stageTable()).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('rowheader')[0]?.textContent ?? '');
const vertexButton = (label: string): HTMLElement => screen.getByRole('button', { name: `vertex ${label}` });

beforeEach(resetCarried);
afterEach(cleanup);

describe('the graph page', () => {
  it('draws a graph from nothing with text only: the stage, the table and the counts follow every keystroke', () => {
    render(<BfsView params={{ g: '' }} setParams={noop} />);
    expect(screen.getAllByText('The graph is empty').length).toBeGreaterThan(0);
    fireEvent.change(text(), { target: { value: 'A-B, B-C' } });
    expect(rowLabels()).toEqual(['A', 'B', 'C']);
    expect(screen.getByRole('button', { name: 'vertex A' })).toBeInTheDocument();
    fireEvent.change(text(), { target: { value: 'A-B, B-C, C-' } });
    expect(screen.getByRole('alert')).toHaveTextContent('"C-" is not a vertex or an edge');
    expect(rowLabels()).toEqual(['A', 'B', 'C']); // the last good graph stays
  });

  it('draws a graph from nothing with buttons and clicks only (keyboard-operable): vertices, then an edge', () => {
    const setParams = vi.fn();
    render(<BfsView params={{ g: '' }} setParams={setParams} />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Add vertex' }));
    expect(rowLabels()).toEqual(['A', 'B', 'C']);
    fireEvent.click(screen.getByRole('radio', { name: 'Add edge' }));
    fireEvent.click(vertexButton('A'));
    expect(screen.getByRole('status')).toHaveTextContent('Edge from A');
    fireEvent.click(vertexButton('C'));
    expect(text().value).toBe('B, A-C');
    expect(screen.getByRole('status')).toHaveTextContent('Added the edge A-C');
    // the same edge again is refused politely
    fireEvent.click(vertexButton('C'));
    fireEvent.click(vertexButton('A'));
    expect(screen.getByRole('status')).toHaveTextContent('already exists');
  });

  it('Enter and Space on a focused vertex select it, and Delete mode removes it with its edges', () => {
    render(<BfsView params={{ g: 'A-B, B-C' }} setParams={noop} />);
    fireEvent.keyDown(vertexButton('B'), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Delete B' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Delete' }));
    fireEvent.click(vertexButton('B'));
    expect(rowLabels()).toEqual(['A', 'C']);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted vertex B and 2 edges.');
  });

  it('arrow keys move a focused vertex in Select mode, and the move reaches the link', async () => {
    const setParams = vi.fn();
    render(<BfsView params={{ g: 'A-B', p: 'A.100.100_B.300.100' }} setParams={setParams} />);
    fireEvent.keyDown(vertexButton('A'), { key: 'ArrowRight' });
    fireEvent.keyDown(vertexButton('A'), { key: 'ArrowDown' });
    await waitFor(() => expect(setParams).toHaveBeenCalled());
    const last = setParams.mock.calls[setParams.mock.calls.length - 1]?.[0] as Record<string, string | null>;
    expect(last['p']).toBe('A.112.112_B.300.100');
  });

  it('writes the graph, switches and start vertex to the URL after a short pause, and keeps a copy for the next view', async () => {
    const setParams = vi.fn();
    render(<DijkstraView params={{ g: 'A>B:2', d: '1', w: '1' }} setParams={setParams} />);
    fireEvent.change(screen.getByLabelText('Start vertex'), { target: { value: 'B' } });
    await waitFor(() => expect(setParams).toHaveBeenCalled());
    const patch = setParams.mock.calls[setParams.mock.calls.length - 1]?.[0] as Record<string, string | null>;
    expect(patch).toMatchObject({ g: 'A>B:2', d: '1', w: '1', s: 'B' });
    expect(carriedPatch()).toMatchObject({ g: 'A>B:2', s: 'B' });
  });

  it('carries the graph to another view even when the shell link drops the parameters', () => {
    const first = render(<BfsView params={{ g: '' }} setParams={noop} />);
    fireEvent.change(text(), { target: { value: 'X-Y, Y-Z' } });
    first.unmount();
    render(<DfsView params={{}} setParams={noop} />);
    expect(text().value).toBe('X-Y, Y-Z');
    expect(rowLabels()).toEqual(['X', 'Y', 'Z']);
  });

  it('a damaged link says so and shows an example instead of crashing', () => {
    render(<BfsView params={{ g: 'A-B,,%%' }} setParams={noop} />);
    expect(screen.getByText(/could not be read/)).toBeInTheDocument();
    expect(rowLabels().length).toBeGreaterThan(0);
  });

  it('every view offers the other five with the current graph in the link', () => {
    render(<BfsView params={{ g: 'A-B' }} setParams={noop} />);
    const nav = screen.getByRole('navigation', { name: 'Run this graph with another algorithm' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['BFS', 'DFS', 'Topological sort', 'Prim', 'Kruskal', 'Dijkstra']);
    expect(links[1]?.getAttribute('href')).toMatch(/^#\/graphs\/dfs\?g=A-B&p=A\./);
  });

  it('topological sort on an undirected graph is refused up front, explained, and one button fixes it', () => {
    render(<TopologicalSortView params={{ g: 'A-B, B-C' }} setParams={noop} />);
    expect(screen.getByText(/This run is refused/)).toBeInTheDocument();
    expect(screen.getAllByText(/undirected, so its edges have no direction/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Make the graph directed' }));
    expect(text().value).toBe('A>B, B>C');
    expect(screen.queryByText(/This run is refused/)).toBeNull();
  });

  it('Prim on an unweighted graph offers weights, and says nothing was changed silently', () => {
    render(<PrimView params={{ g: 'A-B, B-C' }} setParams={noop} />);
    expect(screen.getByText(/This run is refused/)).toBeInTheDocument();
    expect(text().value).toBe('A-B, B-C');
    fireEvent.click(screen.getByRole('button', { name: /Make the graph weighted/ }));
    expect(text().value).toBe('A-B:1, B-C:1');
  });

  it('Dijkstra with a negative edge is refused by its own check, and the page names the edge', () => {
    render(<DijkstraView params={{ g: 'A>B:2, B>C:-3', d: '1', w: '1' }} setParams={noop} />);
    expect(screen.getAllByText(/B→C has weight -3/).length).toBeGreaterThan(0);
  });

  it('editing returns the player to frame 0', () => {
    render(<BfsView params={{ g: 'A-B, B-C' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Step/ }));
    fireEvent.click(screen.getByRole('button', { name: /Step/ }));
    expect(screen.getByText(/^3 \/ \d+$/)).toBeInTheDocument();
    fireEvent.change(text(), { target: { value: 'A-B, B-C, C-D' } });
    expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument();
  });

  it('weights: selecting an edge offers its weight, and a bad weight is explained', () => {
    render(<PrimView params={{ g: 'A-B:4', w: '1' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'edge A and B, weight 4' }));
    const field = screen.getByLabelText('Weight of A-B');
    fireEvent.change(field, { target: { value: '9' } });
    expect(text().value).toBe('A-B:9');
    fireEvent.change(field, { target: { value: 'x' } });
    expect(screen.getByRole('status')).toHaveTextContent('not a whole number');
    expect(text().value).toBe('A-B:9');
  });

  it('the vertex cap shows a message instead of a 13th vertex', () => {
    render(<BfsView params={{ g: Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).join(',') }} setParams={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vertex' }));
    expect(screen.getByRole('status')).toHaveTextContent('12 vertices');
    expect(rowLabels()).toHaveLength(12);
  });

  it('the start vertex deleted: the start falls back to the first label', () => {
    render(<BfsView params={{ g: 'A-B, B-C', s: 'B' }} setParams={noop} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Delete' }));
    fireEvent.click(vertexButton('B'));
    expect((screen.getByLabelText('Start vertex') as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('start vertex');
  });
});
