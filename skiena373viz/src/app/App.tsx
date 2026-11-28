import { useEffect, useMemo, useRef, useState } from 'react';
import { isExample, moduleInfo } from '@core';
import { ErrorBoundary, ModulesContext } from '@ui';
import { Home } from './Home';
import { ModulePage } from './ModulePage';
import { loadRegistry } from './registry';
import type { Registry } from './registry';
import { parseHash, useHash } from './route';

export function App({ load = loadRegistry }: { readonly load?: () => Promise<Registry> }) {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const main = useRef<HTMLElement>(null);
  const place = `${route.moduleId ?? ''}/${route.viewId ?? ''}`;
  const shown = useRef(place);

  useEffect(() => {
    let live = true;
    void load().then((found) => {
      if (live) setRegistry(found);
    });
    return () => {
      live = false;
    };
  }, [load]);

  const module = registry?.modules.find((m) => m.id === route.moduleId);
  // The worked example is scaffolding: it stays reachable at #/example, but is not a course module in the nav or in useModules().
  const courseModules = useMemo(() => (registry?.modules ?? []).filter((m) => !isExample(m.id)), [registry]);
  const title = route.moduleId === null ? null : (moduleInfo(route.moduleId)?.title ?? null);
  useEffect(() => {
    document.title = title ? `${title} · Skiena373Viz` : 'Skiena373Viz';
  }, [title]);

  // Real navigation moves focus to the heading; parameter updates do not touch focus or scroll.
  useEffect(() => {
    if (shown.current === place) return;
    shown.current = place;
    window.scrollTo(0, 0);
    main.current?.querySelector('h1')?.focus({ preventScroll: true });
  }, [place]);

  return (
    <ModulesContext.Provider value={courseModules}>
      <button type="button" className="skip" onClick={() => main.current?.focus()}>Skip to content</button>
      <header className="topbar">
        <a className="brand" href="#/">Skiena373Viz</a>
        <nav aria-label="Modules">
          {courseModules.map((m) => (
            <a key={m.id} href={`#/${m.id}`} aria-current={m.id === route.moduleId ? 'page' : undefined}>{moduleInfo(m.id)?.title ?? m.id}</a>
          ))}
        </nav>
      </header>
      <main ref={main} tabIndex={-1}>
        <ErrorBoundary resetKey={place}>
          {registry === null ? <p className="muted" role="status">Loading…</p> : null}
          {registry && route.moduleId === null ? <Home modules={registry.modules} failures={registry.failures} /> : null}
          {module ? <ModulePage module={module} route={route} /> : null}
          {registry && route.moduleId !== null && !module ? <Missing id={route.moduleId} registry={registry} /> : null}
        </ErrorBoundary>
      </main>
      <footer>
        An independent study aid. Not affiliated with, or endorsed by, Stony Brook University or Prof. Steven Skiena. Explanations and
        pseudocode here are original; the course textbook is <cite>The Algorithm Design Manual</cite> (3rd ed.).
      </footer>
    </ModulesContext.Provider>
  );
}

function Missing({ id, registry }: { readonly id: string; readonly registry: Registry }) {
  const failure = registry.failures.find((f) => f.folder === id);
  const info = moduleInfo(id);
  return (
    <>
      <h1 tabIndex={-1}>{info?.title ?? 'Page not found'}</h1>
      <p>
        {failure ? `This module could not load: ${failure.problems.join('; ')}.` : null}
        {!failure && info ? 'This module is not built yet.' : null}
        {!failure && !info ? `There is no module called “${id}”.` : null}
      </p>
      <p><a href="#/">All modules</a></p>
    </>
  );
}
