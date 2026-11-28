/** The race: one player, three lanes of different lengths. Pure alignment, so it can be tested. */
import type { OpCounts } from '@core';

export type AlignMode = 'comparisons' | 'steps';

/** The only part of a frame the race needs. */
export interface TimedFrame {
  readonly ops: OpCounts;
}

const comps = (frame: TimedFrame | undefined): number => frame?.ops['comparisons'] ?? 0;

/**
 * Which frame of a lane to show at a tick.
 * 'comparisons': tick c shows the LAST frame with at most c comparisons, so the lane has done everything
 * that happens before its next comparison (swaps and writes included).
 * 'steps': tick t shows frame t, or the last frame once the lane is done.
 */
export function laneIndex(frames: readonly TimedFrame[], tick: number, mode: AlignMode): number {
  const last = Math.max(0, frames.length - 1);
  const wanted = Math.max(0, Math.floor(tick));
  if (mode === 'steps') return Math.min(wanted, last);
  let low = 0;
  let high = last;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (comps(frames[middle]) <= wanted) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The first tick at which the lane shows its final frame. */
export function finishTick(frames: readonly TimedFrame[], mode: AlignMode): number {
  return mode === 'steps' ? Math.max(0, frames.length - 1) : comps(frames[frames.length - 1]);
}

/** Number of player positions for a race: ticks 0 .. the slowest lane's finish. */
export function raceLength(lanes: readonly (readonly TimedFrame[])[], mode: AlignMode): number {
  return Math.max(0, ...lanes.map((frames) => finishTick(frames, mode))) + 1;
}

export interface RankedGroup {
  readonly place: number;
  readonly names: readonly string[];
  readonly tick: number;
}

/** Lanes that have finished by `tick`, best first; lanes with the same finish tick share a place. */
export function rankLanes(lanes: readonly { readonly name: string; readonly tick: number }[], tick: number): RankedGroup[] {
  const done = lanes.filter((lane) => lane.tick <= tick).sort((a, b) => a.tick - b.tick);
  const groups: { place: number; names: string[]; tick: number }[] = [];
  for (const lane of done) {
    const group = groups[groups.length - 1];
    if (group && group.tick === lane.tick) group.names.push(lane.name);
    else groups.push({ place: group ? group.place + group.names.length : 1, names: [lane.name], tick: lane.tick });
  }
  return groups;
}

const ORDINAL = ['', '1st', '2nd', '3rd'];
const joinNames = (names: readonly string[]): string => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** The ranking as sentences. 'unit' is 'comparisons' or 'steps'. */
export function describeRanking(
  lanes: readonly { readonly name: string; readonly tick: number }[], tick: number, mode: AlignMode,
): string[] {
  const unit = mode === 'comparisons' ? 'comparisons' : 'steps';
  const groups = rankLanes(lanes, tick);
  const lines = groups.map((group) => {
    const count = `${group.tick} ${group.tick === 1 ? unit.replace(/s$/, '') : unit}`;
    const place = ORDINAL[group.place] ?? `${group.place}th`;
    return group.names.length > 1
      ? `${place}, tied: ${joinNames(group.names)}, each after ${count}.`
      : `${place}: ${group.names[0]}, after ${count}.`;
  });
  const waiting = lanes.filter((lane) => lane.tick > tick).map((lane) => lane.name);
  if (waiting.length > 0) lines.push(`Still running: ${joinNames(waiting)}.`);
  return lines;
}
