# Packet B (dp): notes and contract requests

## Status
Required scope is done: `dp-edit-distance` (view `edit-distance`), table with dependency arrows, parent marks, traceback, alignment strip, edit
script, cell inspector, quiz mode (four question kinds, gates, hints, show-me, score, retake), growth experiments, tests.
No stretch items (LCS, LIS, Fibonacci call tree) were done.

## Contract change requests
1. **`CellGrid`: keyboard path and accessible names.** `onCell` turns every cell into a tab stop (up to 169 for 12 x 12). Proposal: a roving
   tabindex (one tab stop, arrow keys move between cells, Enter activates). Without `onCell` the cells have no accessible name at all (the SVG is
   one `role="img"`), so this module adds a visually hidden `<table>` with the cell values next to the SVG. Proposal: `CellGrid` renders that
   table itself.
2. **`CellGrid`: per-cell `pointer` / sub-label and a way to highlight header cells.** The compared characters are shown in two `CellRow`s above
   the table because headers are plain strings. Proposal: `rowHeaderTone` / `colHeaderTone`, or header specs of type `CellSpec`.
3. **`SvgArrow` labels sit on top of the cell borders.** A label such as "3" on a short grid arrow collides with the neighbouring cell's value
   and tone badge, so this module draws arrows without labels. Proposal: an option to draw the label offset from the arrow, or a `compact` mode.
4. **`Workbench` cannot put the quiz panel in the main column.** `aside` always lands in the side column, which on a phone is below the
   pseudocode. This module composes its own page from `usePlayer`, `usePlayerKeys`, `PlayerControls`, `Caption`, `TraceNotices` and the panels.
   Proposal: an `asideSlot: 'main' | 'side'` prop, or a `belowControls` slot.
5. **`PseudocodePanel` clips long lines.** The scroll box has no visible scrollbar on macOS, so lines wider than the panel look cut off.
   This module keeps its pseudocode lines short (about 40 characters) instead.
6. **`player.release()` then `forward()` is two dispatches**, and `forward` cancels a resumed playback. A `release({ advance: true })` option
   would let a quiz show the answered step in one go. Not needed now: the quiz leaves the learner on the gated frame with a "Continue" button.

## Decisions worth knowing
* Frame plan (the quiz depends on it): setup, base cells (`D[0][0]`, row 0, then column 0; one frame each), two frames per inner cell
  (`look`, `write`), `trace-start`, one frame per traceback move, `done`. `state.step.kind` names each one.
* `look` frames have `candidates: null`, no value for the cell and no parents. `write` frames carry the three candidate totals, the minimum,
  the tie flag, all optimal parents (`state.parents`, in tie-break order, first = chosen) and the chosen parent.
* The grid hides the parent marks of cells the traceback has not left yet, because the marks of the current cell are the answer to the
  traceback question. They appear when the traceback leaves the cell.
* `questionAt(trace, index)` reads frame `index + 1`; `quizGates(trace, {every, seed})` picks the frames where the player stops. A truncated
  trace has no quiz (the UI cap of 12 characters keeps traces under 400 frames).
* "Every k-th cell": three independent streams (base cells, inner cells, traceback moves), each asked at ordinals 0, k, 2k, ...; `D[0][0]`
  is never asked. An inner cell is asked either as "which cell is next" (gate on the frame before its look) or "what value" (gate on its
  look frame), chosen from the seed.
* Wrong answers: first miss gets hint 1 (the recurrence with this cell's neighbours), the second gets the three candidate totals, and from
  the second miss on "Show me" appears. A typed non-number is not an attempt.
* Characters are code points (`Array.from`); a combining accent is its own character (tested: `é` precomposed vs `e` + U+0301).
* The algorithm accepts any length (it truncates long traces and keeps exact counts); only the view enforces the 12-character limit.
