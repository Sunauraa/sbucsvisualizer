import { EXAMPLE_MODULE, lectureLabel, SYLLABUS } from '@core';
import type { ModuleManifest } from '@core';
import { Notice } from '@ui';
import type { ModuleFailure } from './registry';
import { formatHash } from './route';

export const viewHref = (moduleId: string, viewId: string | null = null): string => formatHash({ moduleId, viewId, params: {} });

export function Home({ modules, failures }: { readonly modules: readonly ModuleManifest[]; readonly failures: readonly ModuleFailure[] }) {
  return (
    <>
      <h1 tabIndex={-1}>Every step of every algorithm, forwards and back</h1>
      <p className="lead">
        Interactive traces for studying CSE 373, Analysis of Algorithms. Each run is recorded first, then played: step either way, watch the
        pseudocode line and the data structure together, and see the operation counts that the asymptotic bounds are about.
      </p>
      {failures.map((failure) => (
        <Notice key={failure.folder} tone="error">The {failure.folder} module could not load: {failure.problems.join('; ')}.</Notice>
      ))}
      <ul className="cards">
        {SYLLABUS.map((info) => <Card key={info.id} info={info} module={modules.find((m) => m.id === info.id)} />)}
      </ul>
      <h2>How it fits together</h2>
      <ul className="cards">
        <Card info={EXAMPLE_MODULE} module={modules.find((m) => m.id === EXAMPLE_MODULE.id)} />
      </ul>
    </>
  );
}

function Card({ info, module }: { readonly info: (typeof SYLLABUS)[number]; readonly module: ModuleManifest | undefined }) {
  return (
    <li className={module ? 'card' : 'card card-planned'}>
      <p className="eyebrow">{info.unit > 0 ? `Unit ${info.unit} · ` : ''}{info.unitTitle}</p>
      <h3>{module ? <a href={viewHref(info.id)}>{info.title}</a> : info.title}</h3>
      <p>{info.summary}</p>
      <p className="muted small">{info.lectures.map(lectureLabel).join(', ')}</p>
      {module ? null : <p className="planned">Not built yet</p>}
      {module && module.views.length > 1 ? (
        <ul className="card-views">
          {module.views.map((view) => <li key={view.id}><a href={viewHref(info.id, view.id)}>{view.title}</a></li>)}
        </ul>
      ) : null}
    </li>
  );
}
