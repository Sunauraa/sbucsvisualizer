import { describe, expect, it } from 'vitest';
import { frameAt, initialPlayer, playerReducer } from './player';
import type { PlayerAction, PlayerState } from './player';

const play = (actions: PlayerAction[], frameCount = 10, gates: number[] = [], from: PlayerState = initialPlayer): PlayerState =>
  actions.reduce((s, a) => playerReducer(s, a, { frameCount, gated: (i) => gates.includes(i) }), from);

describe('player', () => {
  it('steps, clamps, seeks, resets', () => {
    expect(play([{ type: 'back' }]).index).toBe(0);
    expect(play([{ type: 'forward' }, { type: 'forward' }, { type: 'back' }]).index).toBe(1);
    expect(play([{ type: 'seek', index: 99 }]).index).toBe(9);
    expect(play([{ type: 'end' }, { type: 'reset' }]).index).toBe(0);
    expect(play([{ type: 'forward' }], 0).index).toBe(0);
  });
  it('plays to the end, stops, and replays from the start', () => {
    const end = play([{ type: 'play' }, { type: 'tick' }, { type: 'tick' }], 3);
    expect([end.index, end.playing]).toEqual([2, false]);
    expect(play([{ type: 'play' }], 3, [], end)).toMatchObject({ index: 0, playing: true });
    expect(play([{ type: 'play' }], 1).playing).toBe(false);
  });
  it('ignores a late tick after pause', () => {
    expect(play([{ type: 'play' }, { type: 'pause' }, { type: 'tick' }]).index).toBe(0);
  });
  it('manual moves pause', () => {
    expect(play([{ type: 'play' }, { type: 'forward' }]).playing).toBe(false);
  });
});

describe('gate', () => {
  it('holds every way forward at the first closed gate', () => {
    for (const action of [{ type: 'end' }, { type: 'seek', index: 8 }] as const) {
      expect(play([action], 10, [3, 5])).toMatchObject({ index: 3, held: true });
    }
    expect(play([{ type: 'seek', index: 3 }], 10, [3])).toMatchObject({ index: 3, held: false });
    expect(play([{ type: 'seek', index: 3 }, { type: 'forward' }], 10, [3])).toMatchObject({ index: 3, held: true });
  });
  it('interrupts playback and resumes on release', () => {
    const held = play([{ type: 'play' }, { type: 'tick' }, { type: 'tick' }], 10, [1]);
    expect(held).toMatchObject({ index: 1, playing: false, held: true });
    expect(play([{ type: 'release', index: 1 }], 10, [1], held)).toMatchObject({ index: 1, playing: true, held: false });
  });
  it('does not resume if the learner paused or stepped', () => {
    const held = play([{ type: 'play' }, { type: 'tick' }, { type: 'tick' }, { type: 'pause' }, { type: 'release', index: 1 }], 10, [1]);
    expect(held.playing).toBe(false);
    const stepped = play([{ type: 'seek', index: 1 }, { type: 'forward' }, { type: 'release', index: 1 }], 10, [1]);
    expect(stepped).toMatchObject({ playing: false, held: false });
  });
  it('play on a closed gate arms resume', () => {
    expect(play([{ type: 'play' }, { type: 'release', index: 0 }], 10, [0]).playing).toBe(true);
  });
  it('allows going back, and stays released until rearm or load', () => {
    const past = play([{ type: 'release', index: 2 }, { type: 'seek', index: 6 }], 10, [2]);
    expect(past.index).toBe(6);
    expect(play([{ type: 'reset' }, { type: 'end' }], 10, [2], past).index).toBe(9);
    expect(play([{ type: 'reset' }, { type: 'rearm' }, { type: 'end' }], 10, [2], past).index).toBe(2);
    expect(play([{ type: 'speed', speed: 2 }, { type: 'load' }], 10, [2], past)).toEqual({ ...initialPlayer, speed: 2 });
  });
  it('a gate on the last frame holds nothing', () => {
    expect(play([{ type: 'end' }], 4, [3])).toMatchObject({ index: 3, held: false });
  });
});

it('frameAt clamps', () => {
  expect([frameAt(['a', 'b'], -1), frameAt(['a', 'b'], 9)]).toEqual(['a', 'b']);
  expect(() => frameAt([], 0)).toThrow();
});
