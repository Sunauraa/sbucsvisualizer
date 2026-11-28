// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { manifestProblems, SYLLABUS } from '@core';
import type { ModuleManifest } from '@core';
import { useModules } from '@ui';
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
    expect(screen.getAllByText('Not built yet')).toHaveLength(5); // the six course modules, minus dp, which loaded
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
  describe('the worked example is not a course module in the UI', () => {
    const exampleView = { ...manifest.views[0]!, id: 'linear-search', title: 'Linear search', load: () => Promise.resolve({ default: () => <p>example view</p> }) };
    const example: ModuleManifest = { ...manifest, id: 'example', views: [exampleView] };
    const seen: string[][] = [];
    const Probe = () => { seen.push(useModules().map((m) => m.id)); return <p>probe</p>; };
    const course = SYLLABUS.map((info): ModuleManifest => ({
      ...manifest, id: info.id,
      views: [{ ...manifest.views[0]!, load: () => Promise.resolve({ default: Probe }) }],
    }));
    const everything = () => Promise.resolve({ modules: [...course, example], failures: [] });

    it('the top navigation has the six course modules and no worked example; the home page keeps one line linking to it', async () => {
      render(<App load={everything} />);
      const nav = await screen.findByRole('navigation', { name: 'Modules' });
      expect(within(nav).getAllByRole('link')).toHaveLength(6);
      expect(within(nav).queryByText('Worked example')).toBeNull();
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
      expect(screen.getByRole('link', { name: 'The worked example' })).toHaveAttribute('href', '#/example');
    });

    it('useModules() never contains the example, so Measured cannot plot it', async () => {
      window.history.replaceState(null, '', '#/dp');
      seen.length = 0;
      render(<App load={everything} />);
      expect(await screen.findByText('probe')).toBeInTheDocument();
      expect(seen.length).toBeGreaterThan(0);
      for (const ids of seen) expect(ids).toEqual(SYLLABUS.map((info) => info.id));
    });

    it('#/example/linear-search still renders', async () => {
      window.history.replaceState(null, '', '#/example/linear-search');
      render(<App load={everything} />);
      expect(await screen.findByText('example view')).toBeInTheDocument();
    });
  });
  it('the footer links to the shipped licence notices, and the notices are in public/', async () => {
    render(<App load={load} />);
    expect(await screen.findByRole('link', { name: 'Licences' })).toHaveAttribute('href', 'THIRD_PARTY_LICENSES.txt');
    const notices = readFileSync(join(process.cwd(), 'public', 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    for (const name of ['react ', 'react-dom ', 'd3-force ', 'd3-dispatch ', 'd3-quadtree ', 'd3-timer ']) expect(notices, name).toContain(`\n${name}`);
    expect(notices).toContain('MIT License');
    expect(notices).toContain('Permission to use, copy, modify, and/or distribute this software for any purpose');
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
