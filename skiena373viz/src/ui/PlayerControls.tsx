import { SPEEDS } from '@core';
import type { Player } from './usePlayer';

/** Reset, back, play/pause, forward, end, scrubber, speed. Never changes size while playing. */
export function PlayerControls({ player }: { readonly player: Player }) {
  const { index, frameCount, playing, speed, atStart, atEnd } = player;
  return (
    <div className="controls" role="group" aria-label="Player">
      <div className="controls-buttons">
        <button type="button" onClick={player.reset} disabled={atStart && !playing} title="Reset (Home)">Reset</button>
        <button type="button" onClick={player.back} disabled={atStart} title="Step back (left arrow)"><span aria-hidden="true">◀ </span>Back</button>
        <button type="button" className="primary play" onClick={player.toggle} disabled={frameCount < 2} title="Play or pause (space)">
          <span aria-hidden="true">{playing ? '❚❚ ' : '► '}</span>{playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={player.forward} disabled={atEnd} title="Step forward (right arrow)">Step<span aria-hidden="true"> ▶</span></button>
        <button type="button" onClick={player.end} disabled={atEnd} title="Jump to the end (End)">End</button>
      </div>
      <div className="controls-track">
        <input type="range" aria-label="Step" min={0} max={Math.max(0, frameCount - 1)} step={1} value={index}
          aria-valuetext={`step ${index + 1} of ${frameCount}`} onChange={(event) => player.seek(Number(event.target.value))} />
        <span className="controls-count">{index + 1} / {frameCount}</span>
        <label className="controls-speed">
          Speed
          <select value={String(speed)} onChange={(event) => player.setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => <option key={value} value={String(value)}>{value}×</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
