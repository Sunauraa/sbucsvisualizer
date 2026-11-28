// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { manifestProblems } from '@core';
import type { ModuleManifest } from '@core';
import { App } from './App';
import { loadRegistry } from './registry';
import { formatHash, parseHash, replaceParams } from './route';

const manifest: ModuleManifest = {
  id: 'dp',
  views: [{ id: 'demo', title: 'Demo view', summary: 'A demo.', lectures: [18], load: () => Promise.resolve({ default: ({ params }) => <p>param {params['q'] ?? 'none'}</p> }) }],
};

beforeEach(() => { window.history.replaceState(null, '', '/'); window.scrollTo = vi.fn(); });

describe('routes', () => {
  it('round-trips', () => {
    const route = { moduleId: 'dp', viewId: 'edit-distance', params: { a: 'kit ten&?', b: '' } };
    expect(parseHash(formatHash(route))).toEqual(route);
    expect(parseHash('')).toEqual({ moduleId: null, viewId: null, params: {} });
    expect(parseHash('#/%E0%A4%A')).toMatchObject({ moduleId: '%E0%A4%A' });
  });
  it('replaceParams merges and removes without adding history', () => {
    window.history.replaceState(null, '', '#/dp/demo?a=1&b=2');
    const before = window.history.length;
    replaceParams({ a: null, c: '3' });
    expect(window.location.hash).toBe('#/dp/demo?b=2&c=3');
    expect(window.history.length).toBe(before);
  });
});

describe('registry', () => {
  it('keeps good modules and reports bad ones', async () => {
    const { modules, failures } = await loadRegistry({
      '../modules/dp/index.ts': () => Promise.resolve(manifest),
      '../modules/graphs/index.ts': () => Promise.reject(new Error('syntax')),
      '../modules/sorting/index.ts': () => Promise.resolve({ ...manifest, views: [] }),
      '../modules/mystery/index.ts': () => Promise.resolve({ ...manifest, id: 'mystery' }),
    });
    expect(modules.map((m) => m.id)).toEqual(['dp']);
    expect(failures.map((f) => f.folder).sort()).toEqual(['graphs', 'mystery', 'sorting']);
  });
});

describe('App', () => {
  const load = () => Promise.resolve({ modules: [manifest], failures: [{ folder: 'graphs', problems: ['syntax'] }] });
  it('lists all six modules, built or not, and reports failures', async () => {
    render(<App load={load} />);
    expect(await screen.findByText(/graphs module could not load: syntax/)).toBeInTheDocument();
    expect(screen.getAllByText('Not built yet')).toHaveLength(6);
    expect(screen.getByRole('heading', { name: 'Dynamic programming' })).toBeInTheDocument();
  });
  it('opens a view with its URL parameters', async () => {
    window.history.replaceState(null, '', '#/dp/demo?q=42');
    render(<App load={load} />);
    expect(await screen.findByText('param 42')).toBeInTheDocument();
    expect(document.title).toBe('Dynamic programming · Skiena373Viz');
  });
  it('view tabs carry only the keys the module lists in carryParams', async () => {
    const twoViews: ModuleManifest = {
      ...manifest,
      carryParams: ['q'],
      views: [...manifest.views, { ...manifest.views[0]!, id: 'other', title: 'Other view' }],
    };
    window.history.replaceState(null, '', '#/dp/demo?q=42&x=1');
    render(<App load={() => Promise.resolve({ modules: [twoViews], failures: [] })} />);
    expect(await screen.findByText('param 42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Other view' })).toHaveAttribute('href', '#/dp/other?q=42');
    expect(screen.getByRole('link', { name: 'Demo view' })).toHaveAttribute('href', '#/dp/demo?q=42');
  });
  it('view tabs carry nothing when the module lists no carryParams', async () => {
    const twoViews: ModuleManifest = { ...manifest, views: [...manifest.views, { ...manifest.views[0]!, id: 'other', title: 'Other view' }] };
    window.history.replaceState(null, '', '#/dp/demo?q=42');
    render(<App load={() => Promise.resolve({ modules: [twoViews], failures: [] })} />);
    expect(await screen.findByText('param 42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Other view' })).toHaveAttribute('href', '#/dp/other');
  });
  it('rejects a malformed carryParams', () => {
    expect(manifestProblems({ ...manifest, carryParams: [''] }, 'dp')).toEqual(['carryParams must be a list of non-empty URL parameter keys']);
    expect(manifestProblems({ ...manifest, carryParams: ['g', 'p'] }, 'dp')).toEqual([]);
  });
  it('explains unknown and unbuilt modules', async () => {
    window.history.replaceState(null, '', '#/sorting');
    const view = render(<App load={load} />);
    expect(await screen.findByText('This module is not built yet.')).toBeInTheDocument();
    view.unmount();
    window.history.replaceState(null, '', '#/nope');
    render(<App load={load} />);
    expect(await screen.findByText(/no module called “nope”/)).toBeInTheDocument();
  });
});
