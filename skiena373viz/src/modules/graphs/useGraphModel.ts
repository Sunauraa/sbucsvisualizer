/**
 * The graph the six views share. The model is local state, so rapid edits never read a stale copy; the URL
 * follows it a moment later (short parameters g, d, w, s, p), and a change to the URL from outside replaces it.
 * A copy of the latest parameters is kept for the session, so the shell's plain view links carry the graph over too.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeModel, encodeModel, GRAPH_KEYS, hasGraphParams } from './algorithms/graphUrl';
import type { GraphInput } from './algorithms/types';

type Patch = ReturnType<typeof encodeModel>;

let carried: Patch | null = null;

/** Forget the carried graph (tests start from a clean slate). */
export function resetCarried(): void {
  carried = null;
}

export function carriedPatch(): Patch | null {
  return carried;
}

const NONE = '\u0000';
const keyOf = (get: (key: (typeof GRAPH_KEYS)[number]) => string | null | undefined): string => GRAPH_KEYS.map((k) => get(k) ?? NONE).join('\u0001');

/** The URL parameters as a string that changes exactly when the graph does. */
export const paramsKey = (params: Readonly<Record<string, string>>): string => keyOf((k) => params[k]);
const patchKey = (patch: Patch): string => keyOf((k) => patch[k]);

const WRITE_DELAY = 250;

export interface GraphModel {
  readonly model: GraphInput;
  readonly setModel: (next: GraphInput) => void;
  /** Set when the link's graph could not be read; the previous graph stays on screen. */
  readonly linkError: string | null;
}

export function useGraphModel(
  params: Readonly<Record<string, string>>,
  setParams: (patch: Readonly<Record<string, string | null>>) => void,
  fallback: GraphInput,
): GraphModel {
  const key = paramsKey(params);
  const [initial] = useState(() => {
    const decoded = decodeModel(params);
    if (decoded.ok && decoded.value) return { model: decoded.value, error: null, restore: false };
    if (!decoded.ok) return { model: fallback, error: decoded.message, restore: false };
    // No graph in the link: the one carried from another view, else this view's example.
    const patch = carried;
    const restored = patch ? decodeModel(Object.fromEntries(Object.entries(patch).filter((e): e is [string, string] => e[1] !== null))) : null;
    if (restored?.ok && restored.value) return { model: restored.value, error: null, restore: true };
    return { model: fallback, error: null, restore: false };
  });
  const [model, setModelState] = useState<GraphInput>(initial.model);
  const [linkError, setLinkError] = useState<string | null>(initial.error);
  const [seen, setSeen] = useState(key);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The URL changed to something other than the graph on screen (a pasted link, an edited address): follow it.
  // A change that merely catches up with the model, because we wrote it, is not news.
  const modelKey = useMemo(() => patchKey(encodeModel(model)), [model]);
  if (key !== seen) {
    setSeen(key);
    if (key !== modelKey) {
      const decoded = decodeModel(params);
      if (decoded.ok) {
        setLinkError(null);
        if (decoded.value) setModelState(decoded.value);
      } else {
        setLinkError(decoded.message);
      }
    }
  }

  const write = (next: GraphInput): void => {
    const patch = encodeModel(next);
    carried = patch;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams(patch), WRITE_DELAY);
  };

  // A graph carried from another view is written into this view's link, so the link can be shared.
  const restoring = initial.restore;
  useEffect(() => {
    if (restoring && !hasGraphParams(params)) {
      setParams(encodeModel(initial.model));
    }
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival only: later URL changes are handled above
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useMemo(() => ({
    model,
    linkError,
    setModel: (next: GraphInput) => {
      setModelState(next);
      setLinkError(null);
      write(next);
    },
    // write only closes over refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }), [model, linkError]);
}
