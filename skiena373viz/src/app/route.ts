/** Hash routing: #/<module>/<view>?key=value. Works at any subpath with no server rules. */
import { useSyncExternalStore } from 'react';

export interface Route {
  readonly moduleId: string | null;
  readonly viewId: string | null;
  readonly params: Readonly<Record<string, string>>;
}

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split(/\?(.*)/s);
  const [moduleId, viewId] = path.split('/').filter((part) => part !== '').map(decode);
  return { moduleId: moduleId ?? null, viewId: viewId ?? null, params: Object.fromEntries(new URLSearchParams(query)) };
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function formatHash(route: Route): string {
  const path = [route.moduleId, route.viewId].filter((part): part is string => part !== null).map(encodeURIComponent).join('/');
  const query = new URLSearchParams(route.params).toString();
  return `#/${path}${query === '' ? '' : `?${query}`}`;
}

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
  };
}

/** The current hash. Stable string, so useSyncExternalStore never loops. */
export const useHash = (): string => useSyncExternalStore(subscribe, () => window.location.hash);

/** replaceState: no history entry, no scroll, no focus change. */
export function replaceParams(patch: Readonly<Record<string, string | null>>): void {
  const route = parseHash(window.location.hash);
  const params: Record<string, string> = { ...route.params };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) Reflect.deleteProperty(params, key);
    else params[key] = value;
  }
  const next = formatHash({ ...route, params });
  if (next === window.location.hash) return;
  window.history.replaceState(window.history.state, '', next);
  emit();
}
