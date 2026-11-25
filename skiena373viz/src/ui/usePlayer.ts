import { useEffect, useMemo, useReducer, useState } from 'react';
import { BASE_INTERVAL, initialPlayer, playerReducer } from '@core';
import type { PlayerAction, PlayerEnv, PlayerState } from '@core';

export interface PlayerOptions {
  readonly frameCount: number;
  /** When this changes identity (usually the trace object), the player goes back to frame 0. */
  readonly source: unknown;
  /**
   * The gate. Return true for frames the player must not move past until release(index) is called.
   * Memoise it (useCallback) or build it once; it must depend only on the index.
   */
  readonly gated?: (index: number) => boolean;
}

/** What controls and panels receive. Identical whether one trace or several lanes are playing. */
export interface Player {
  readonly index: number;
  readonly frameCount: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly playing: boolean;
  readonly speed: number;
  /** True while the current frame is gated and not yet released: show the quiz question now. */
  readonly atGate: boolean;
  /** True when the learner just tried to move past the closed gate: good moment for a nudge. */
  readonly held: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  forward(): void;
  back(): void;
  seek(index: number): void;
  reset(): void;
  end(): void;
  setSpeed(speed: number): void;
  /** Opens the gate at an index (default: the current one); resumes if the gate interrupted playback. */
  release(index?: number): void;
  /** Closes every released gate again, e.g. to retake a quiz. */
  rearm(): void;
}

const never = (): boolean => false;

export function usePlayer({ frameCount, source, gated = never }: PlayerOptions): Player {
  const env: PlayerEnv = useMemo(() => ({ frameCount, gated }), [frameCount, gated]);
  const [state, dispatch] = useReducer(
    (current: PlayerState, action: PlayerAction) => playerReducer(current, action, env),
    initialPlayer,
  );

  // New trace: restart in the same render, so no frame of the new trace is shown at the old index.
  const [loaded, setLoaded] = useState(source);
  if (loaded !== source) {
    setLoaded(source);
    dispatch({ type: 'load' });
  }

  useEffect(() => {
    if (!state.playing) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), BASE_INTERVAL / state.speed);
    return () => clearTimeout(timer);
  }, [state.playing, state.index, state.speed]);

  const last = Math.max(0, frameCount - 1);
  const index = Math.min(state.index, last);
  return useMemo<Player>(() => ({
    index,
    frameCount,
    atStart: index === 0,
    atEnd: index >= last,
    playing: state.playing,
    speed: state.speed,
    atGate: gated(index) && !state.released.includes(index),
    held: state.held,
    play: () => dispatch({ type: 'play' }),
    pause: () => dispatch({ type: 'pause' }),
    toggle: () => dispatch({ type: 'toggle' }),
    forward: () => dispatch({ type: 'forward' }),
    back: () => dispatch({ type: 'back' }),
    seek: (to) => dispatch({ type: 'seek', index: to }),
    reset: () => dispatch({ type: 'reset' }),
    end: () => dispatch({ type: 'end' }),
    setSpeed: (speed) => dispatch({ type: 'speed', speed }),
    release: (at) => dispatch({ type: 'release', index: at ?? index }),
    rearm: () => dispatch({ type: 'rearm' }),
  }), [index, frameCount, last, state, gated]);
}

/**
 * Elements that own their keys: typing fields, buttons, links, sliders, editors. Opt out a region with
 * data-player-keys="off" (all keys) or "arrows" (left/right only, e.g. a scrolling box). */
const OWNS_KEYS = 'input, textarea, select, button, a[href], summary, [contenteditable], [role="button"], [role="slider"], '
  + '[role="tab"], [role="radio"], [role="checkbox"], [role="menuitem"], [data-player-keys="off"]';

/** Space toggles, arrows step, Home/End jump. Mount once per page (Workbench does it for you). */
export function usePlayerKeys(player: Player): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(OWNS_KEYS)) return;
      if (event.key.startsWith('Arrow') && event.target instanceof Element && event.target.closest('[data-player-keys="arrows"]')) return;
      const run = { ' ': player.toggle, ArrowRight: player.forward, ArrowLeft: player.back, Home: player.reset, End: player.end }[event.key];
      if (!run) return;
      event.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);
}

/** Follows the operating system's reduced-motion setting. CSS transitions are already handled globally. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => media()?.matches ?? false);
  useEffect(() => {
    const query = media();
    if (!query) return undefined;
    const update = (): void => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

const media = (): MediaQueryList | null =>
  (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
