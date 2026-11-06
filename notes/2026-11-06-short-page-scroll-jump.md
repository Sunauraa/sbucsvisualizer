# Hiding boxes made the page jump, and the first fix broke the animations (2026-11-06)

- **Area:** UI / browser layout / testing
- **Situation:** every box except the visualizer was made to start hidden, so module pages became much shorter.
- **Problem 1:** a test that steps the playground on a phone-width page started failing: "stepping never moves the
  page" (it moved on 147 of 150 steps). Nothing had touched the playground.
- **Root cause 1:** measuring each element around the step that moved showed the **caption** under the player going
  from 4 lines to 2 (92 → 51 px). The page got shorter, and since the reader was scrolled to the very bottom, the
  browser *had* to pull the scroll position up. Before, the long open Study notes below gave enough room that this
  never showed. Changing one feature (hidden boxes) exposed a latent bug somewhere else.
- **First guess (wrong):** the playground's stage shrinking. I added a fix there; the test still failed, so I removed
  it and measured instead of guessing.
- **Fix 1, first try:** "the caption may grow but never shrink during one run": read `note.offsetHeight` after each
  step and keep the maximum as `min-height`.
- **Problem 2:** that broke a motion test: on a bubble-sort swap, all 20 bars slid instead of 2. A first theory
  (the read happens too early) was only half right. Moving it later didn't help.
- **Root cause 2:** the test jumps (`goto`) and steps in the same task. A jump changes bar heights with a CSS
  transition. Reading `offsetHeight` in between forced a synchronous layout that *started* that transition, so
  motion.js's "before" snapshot caught every bar mid-transition (dy of 27, 49 and 112 px). Without the forced read,
  the browser would have merged both changes into one layout.
- **Fix 2:** no layout reads at all. A `ResizeObserver` on the caption reports its size after the browser's own
  layout, and the largest size seen becomes the `min-height`. A new run or a new window width resets it.
  Result: 0 page moves in 150 steps, exactly 2 bars sliding on a swap, 864 checks passing.
- **Lessons / interview angle:**
  - **Measure, then fix.** Two plausible guesses were wrong. Logging every element's height before and after the
    step found the real culprit in one run.
  - **Forced synchronous layout** (reading `offsetHeight` after a write) isn't just slow, it changes *behaviour*:
    transitions, FLIP animations, anything that compares before and after. Prefer `ResizeObserver` or batching
    reads before writes.
  - **A change can expose a bug far away.** The bug was in the shared player all along; the long page hid it.
    Good tests catch these because they check outcomes ("the page doesn't move") rather than implementation.
