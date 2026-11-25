import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { lectureLabel, moduleInfo } from '@core';
import type { ModuleManifest, ViewManifest, ViewProps } from '@core';
import { ErrorBoundary } from '@ui';
import { viewHref } from './Home';
import { replaceParams } from './route';
import type { Route } from './route';

export function ModulePage({ module, route }: { readonly module: ModuleManifest; readonly route: Route }) {
  const info = moduleInfo(module.id);
  const view = module.views.find((v) => v.id === route.viewId) ?? (route.viewId === null ? module.views[0] : undefined);
  return (
    <>
      <p className="eyebrow">{info && info.unit > 0 ? `Unit ${info.unit} · ` : ''}{info?.unitTitle}</p>
      <h1 tabIndex={-1}>{view ? view.title : info?.title}</h1>
      {module.views.length > 1 ? (
        <nav className="views" aria-label={`${info?.title ?? module.id} views`}>
          {module.views.map((v) => (
            <a key={v.id} href={viewHref(module.id, v.id)} aria-current={v.id === view?.id ? 'page' : undefined}>{v.title}</a>
          ))}
        </nav>
      ) : null}
      {view ? (
        <>
          <p className="lead">{view.summary} <span className="muted small">{view.lectures.map(lectureLabel).join(', ')}</span></p>
          <ErrorBoundary resetKey={`${module.id}/${view.id}`}>
            <ViewHost key={`${module.id}/${view.id}`} view={view} params={route.params} />
          </ErrorBoundary>
        </>
      ) : <p>There is no view called “{route.viewId}” here. Pick one above.</p>}
    </>
  );
}

/** Loads the view once per mount. A failed load throws to the boundary, whose "Try again" remounts this. */
function ViewHost({ view, params }: { readonly view: ViewManifest; readonly params: Route['params'] }) {
  const [loaded, setLoaded] = useState<{ View: ComponentType<ViewProps> } | { error: unknown } | null>(null);
  useEffect(() => {
    let live = true;
    view.load().then(
      (found) => live && setLoaded({ View: found.default }),
      (error: unknown) => live && setLoaded({ error }),
    );
    return () => {
      live = false;
    };
  }, [view]);
  if (loaded === null) return <p className="muted" role="status">Loading…</p>;
  if ('error' in loaded) throw loaded.error;
  return <loaded.View params={params} setParams={replaceParams} />;
}
