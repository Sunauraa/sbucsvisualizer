/**
 * The player as a pure state machine. usePlayer (in @ui) adds only the timer.
 *
 * Gates: a gated frame holds the player. Nothing (step, play, scrub, jump to end) moves past a gated
 * frame until it is released. Quiz mode gates the frame BEFORE a write, asks, then releases it.
 */
export interface PlayerState {
  readonly index: number;
  readonly playing: boolean;
  readonly speed: number;
  /** True when the last attempt to advance was stopped by a gate at `index`. */
  readonly held: boolean;
  /** True when the player was playing when the gate stopped it, so release() resumes. */
  readonly resumeOnRelease: boolean;
  readonly released: readonly number[];
}

export interface PlayerEnv {
  readonly frameCount: number;
  /** True when the player must stop at this frame until released. */
  readonly gated: (index: number) => boolean;
}

export type PlayerAction =
  | { readonly type: 'play' }
  | { readonly type: 'pause' }
  | { readonly type: 'toggle' }
  | { readonly type: 'tick' }
  | { readonly type: 'forward' }
  | { readonly type: 'back' }
  | { readonly type: 'seek'; readonly index: number }
  | { readonly type: 'reset' }
  | { readonly type: 'end' }
  | { readonly type: 'speed'; readonly speed: number }
  | { readonly type: 'release'; readonly index: number }
  | { readonly type: 'rearm' }
  | { readonly type: 'load' };

/** Milliseconds per step at speed 1. */
export const BASE_INTERVAL = 900;
export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export const initialPlayer: PlayerState = {
  index: 0, playing: false, speed: 1, held: false, resumeOnRelease: false, released: [],
};

export function playerReducer(state: PlayerState, action: PlayerAction, env: PlayerEnv): PlayerState {
  const last = Math.max(0, env.frameCount - 1);
  const open = (i: number): boolean => !env.gated(i) || state.released.includes(i);

  /** Move toward `target`, stopping at the first closed gate on the way forward. */
  const go = (target: number, playing: boolean): PlayerState => {
    const wanted = Math.min(last, Math.max(0, Math.round(target)));
    if (wanted <= state.index) {
      return { ...state, index: wanted, playing: playing && wanted < last, held: false, resumeOnRelease: false };
    }
    let i = state.index;
    while (i < wanted && open(i)) i += 1;
    const held = i < wanted;
    return { ...state, index: i, held, resumeOnRelease: held && playing, playing: playing && !held && i < last };
  };

  switch (action.type) {
    case 'play': {
      if (state.playing || last === 0) return state;
      // Playing from the end starts over, as every media player does.
      if (state.index >= last) return { ...state, index: 0, playing: true, held: false, resumeOnRelease: false };
      if (!open(state.index)) return { ...state, held: true, resumeOnRelease: true };
      return { ...state, playing: true, held: false };
    }
    case 'pause':
      return { ...state, playing: false, resumeOnRelease: false };
    case 'toggle':
      return playerReducer(state, { type: state.playing ? 'pause' : 'play' }, env);
    case 'tick':
      return state.playing ? go(state.index + 1, true) : state;
    case 'forward':
      return go(state.index + 1, false);
    case 'back':
      return go(state.index - 1, false);
    case 'seek':
      return go(action.index, false);
    case 'reset':
      return { ...state, index: 0, playing: false, held: false, resumeOnRelease: false };
    case 'end':
      return go(last, false);
    case 'speed':
      return Number.isFinite(action.speed) && action.speed > 0 ? { ...state, speed: action.speed } : state;
    case 'release': {
      if (state.released.includes(action.index)) return state;
      const next = { ...state, released: [...state.released, action.index] };
      if (action.index !== state.index) return next;
      return { ...next, held: false, resumeOnRelease: false, playing: state.resumeOnRelease && state.index < last };
    }
    case 'rearm':
      return { ...state, released: [], held: false, playing: false, resumeOnRelease: false };
    case 'load':
      return { ...initialPlayer, speed: state.speed };
  }
}

/** The frame at an index, clamped. Lets several traces of different lengths share one player. */
export function frameAt<T>(frames: readonly T[], index: number): T {
  const frame = frames[Math.min(Math.max(index, 0), frames.length - 1)];
  if (frame === undefined) throw new Error('A trace must have at least one frame');
  return frame;
}
