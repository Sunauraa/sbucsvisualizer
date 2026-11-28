# Skiena373Viz: fix-and-improve plan (Phase 4)

This plan comes from [REVIEW.md](REVIEW.md); each item cites a review id (R1 to R27). There are two packets, F and G, for two workers
working in parallel in one tree. Each packet should fit one session.

**Order of value for the 12/17 exam:** first, correctness and clarity of DP, graphs and reductions; then anything a student could
memorise wrongly; then usability; then polish.

**Already done (review commit):** `ModuleManifest.carryParams?: readonly string[]` (in `src/core/manifest.ts`, checked by
`manifestProblems`), and `ModulePage` view tabs that copy those keys from the current URL. It is tested in `src/app/app.test.tsx`. There
is no cross-packet dependency left: each packet only has to add `carryParams` to its own manifests.

## Rules for both packets

* PLAN.md sections 2 to 5 still hold: contract, design rules, original prose, one sentence per frame of at most 260 characters.
* Edit only the paths your packet owns (below). The two lists are disjoint. If you need something in the other packet's files, write it
  in your module's `NOTES.md` and work around it locally.
* Git, as in PLAN.md section 4.6: no push, stash, reset, rebase, branch or config changes. Stage and commit only your own paths:
  `git commit -m "..." -- <your paths>`.
* Check yourself with `npm run check -- <modules>` while working, and with `npm run lint && npm test` at the end. Build only into
  `dist-<packet>` (`npx vite build --outDir dist-f --emptyOutDir`) and delete it afterwards.
* Look at every view you touched in headless Chrome at 1280 px and at 390 px (device emulation). Look at the first, middle and last
  frames, by keyboard only. There must be no console errors and no page overflow.
* Every wording fix gets a test that pins the corrected text, or that forbids the wrong text, so it cannot silently come back.

---

## Packet F: shell, shared UI, dynamic programming, reductions

**Owns (and only these):**
* `skiena373viz/src/core/**`
* `skiena373viz/src/ui/**`
* `skiena373viz/src/app/**` (including `theme.css`)
* `skiena373viz/src/test/**`
* `skiena373viz/src/modules/dp/**`
* `skiena373viz/src/modules/reductions/**`
* `skiena373viz/src/modules/example/**` (only if a shared change breaks it)
* `skiena373viz/public/**`
* `skiena373viz/README.md`

### Items, in order

1. **R1 (bug): fix the backwards statement.** In `reductions/algorithms/questions.ts`, option `vc-needs-exponential`: "It shows that
   Vertex Cover is hard *if* 3-SAT is …". Re-read every `why` in `QUESTIONS` and every paragraph of `DirectionView.tsx` against
   "A ≤p B: B at least as hard as A".
   * *Test* (`questions.test.ts`): no option text or `why` contains "only if".
   * *Test:* the `vc-needs-exponential` explanation contains "if 3-SAT is".
2. **R2, R16 (bug): reductions carries its formula.**
   * Add `carryParams: ['f']` to `reductions/index.ts`.
   * Delete `SameFormulaLinks.tsx` and its uses; the shell tabs now carry the formula.
   * View-specific keys (`a`, `s`, `dir`) are not carried.
   * *Test* (`views.test.tsx`, or a manifest test): `manifest.carryParams` equals `['f']`; no view renders "Keep this formula".
3. **R7 (risk): rewrite `DirectionView.tsx:85-86`** with the wording in REVIEW.md R7. *Test:* the paragraph contains
   "polynomial time" and "keeps the yes/no answer".
4. **R11 (UX, DP): show the finished table's marks.** In `EditStage.tsx`, `marksVisible` follows one rule:
   * **Quiz off:** every written inner cell shows its marks in every frame.
   * **Quiz on:** during `trace-start` and `trace-move`, keep today's behaviour (only cells the traceback has left show marks). At
     `done`, show every written inner cell's marks; no question is asked after `done`.
   * Pass `quizOn` through `StageContext`. The renderer still reads only its frame plus that page setting.
   * *Tests:* the no-leak test still passes at every gated frame. With the quiz off, the final frame shows marks on an off-path cell
     (kitten/sitting `D[1][2]`). With the quiz on, the `done` frame shows them too.
5. **R9 (UX, shared): pseudocode wraps.** In `src/ui/panels.tsx` and `theme.css`:
   * remove `ScrollX` from `PseudocodePanel`;
   * set `.code li` to `white-space: pre-wrap; overflow-wrap: anywhere`, with a hanging indent (`padding-left: calc(indent*1.4em +
     1.4em)` and `text-indent: -1.4em` on the code);
   * drop `min-width: max-content`.
   * *Test* (`ui.test.tsx`): `PseudocodePanel` renders no `scroll-x` box.
   * *Browser:* at 390 px no `.code-box` overflows; DFS and BFS lines are fully visible at 1280 px.
6. **R10 (UX, shared and DP): one tab stop for `CellGrid`.**
   * In `src/ui/Cells.tsx`, `CellGrid` with `onCell` uses a roving tabindex: exactly one cell has `tabIndex 0` (the last focused one,
     initially `[0,0]`, or the first cell for which `isFocusTarget(r,c)` returns true if that optional prop is given).
   * Arrow keys move focus and are not passed to the player; set `data-player-keys="off"` on the grid group.
   * Home and End go to the row ends; Enter or Space activates.
   * Add an optional prop `accessibleTable?: { caption: string; rowHeader(r): string; colHeader(c): string }` that renders the
     visually hidden `<table>` now hand-built in `dp/EditStage.tsx:114-129`, and switch DP to it.
   * `CellRow` is unchanged.
   * *Tests:* a 13×13 grid has exactly one tab stop; ArrowRight and ArrowDown move focus; Enter calls `onCell`; the hidden table has
     (rows+1)×(cols+1) cells.
   * *DP test:* the quiz "Which cell" question can be answered with the arrow keys and Enter.
7. **R14 (UX): the worked example stops being a module in the UI.**
   * `App.tsx`: the nav skips `isExample` modules, and `ModulesContext` gets the list without the example, so analysis Measured drops
     it with no analysis change.
   * `Home.tsx`: the example card becomes one line with a link under "How it fits together".
   * The route `#/example` keeps working.
   * *Tests* (`app.test.tsx`): the nav has 6 links; `useModules()` never contains `example`; `#/example/linear-search` still renders.
8. **R18 (UX): no repeated refusal sentence.** `TraceNotices`, when `status === 'rejected' && atEnd`, says "This input was refused;
   the step above says why." instead of repeating the caption. *Test* (`ui.test.tsx`).
9. **R17 (UX, reductions): fixed checkbox labels.** `CertificatesView.tsx:78`: label "x1 true" (checked means true), with the value
   word `aria-hidden` beside it. *Test:* the role checkbox with name "x2 true" toggles; update the existing test.
10. **R22 (polish, DP): quiz wording.**
    * Base prompt "What value goes into D[i][j]?".
    * `baseHint` uses `plural` ("the first 1 text character").
    * *Tests* (`quiz.test.ts`).
11. **R24 (polish):** key `ComplexityPanel` items by index.
12. **R23 (polish): ship the licence notices.** Add `public/THIRD_PARTY_LICENSES.txt` (the React MIT notice, and the d3-force,
    d3-dispatch, d3-quadtree and d3-timer ISC notices, copied from `node_modules/*/LICENSE`). Add a footer link "Licences" in
    `App.tsx` and a README line. *Check:* the file is in `dist-f/`.
13. **R21 (polish, DP): cut `EditDistanceView.test.tsx` below 4 s.** Render each gated frame once, and sample non-gated frames (first,
    last, every 5th). Keep the leak test exhaustive over gated frames.
14. **R27 (polish, DP, if time):** left-align the alignment table; size the recurrence panel's reserved height to the three-row table.

### Acceptance (F)

* `npm run lint && npm test && npm run build` pass. The `dp`, `reductions` and `app` suites each run under 4 s
  (`npx vitest run src/modules/dp`).
* In the browser, at 1280 px and at 390 px:
  * DP kitten/sitting final frame shows marks off the path with the quiz off.
  * The quiz still never shows the answer at a gate.
  * The DP page has at most 40 tab stops at 12×12 with the quiz off.
  * No pseudocode panel scrolls sideways.
  * A formula typed on Build the graph is still there after clicking the Certificates tab.
  * The nav has six modules.
* Every item above has the tests listed with it.

---

## Packet G: graphs, sorting, data structures, analysis

**Owns (and only these):**
* `skiena373viz/src/modules/graphs/**`
* `skiena373viz/src/modules/sorting/**`
* `skiena373viz/src/modules/structures/**`
* `skiena373viz/src/modules/analysis/**`

### Items, in order

1. **R2, R16, R20 (bug, graphs): carry the graph through the shell.**
   * Add `carryParams: ['g', 'd', 'w', 's', 'p']` to `graphs/index.ts`.
   * Delete the module-level `carried` variable, `resetCarried`, `carriedPatch` and the restore branch in `useGraphModel.ts`.
   * Delete the "Same graph in:" row in `GraphPage.tsx:42`, and update `GraphPage.test.tsx`.
   * The shell tab hrefs now carry these keys (tested in `src/app`).
   * *Test:* a graph arriving by link with no edit; the manifest's `carryParams` holds exactly those keys.
   * *Browser:* `#/graphs/bfs?g=P-Q, Q-R`, then the DFS tab, shows `P-Q, Q-R`.
2. **R21 (flaky test, sorting): do this early, because it can make the whole `npm test` fail.**
   * "the full 24-item limit, with duplicates, negatives and every pivot rule" in `sorting.views.test.tsx` runs about 4.9 s against the
     5 s timeout, and timed out in 4 of 6 full runs. Cut its work rather than raising the timeout: render the first, last and every 4th
     frame, plus every frame of one pivot rule.
   * Item 12 below finishes the suite speed-up.
   * *Check:* 5 consecutive `npm test` runs pass.
3. **R19 (UX, graphs): keep check sentences short.** In `prim.ts:106` and `kruskal.ts:152`, list at most three negative edges, then
   "and N more". *Test:* a 12-vertex graph with 30 negative edges passes `validateTrace` for both (every explanation at most 260
   characters).
4. **R12 (UX, graphs): fit the drawing on a phone.**
   * In `GraphCanvas.tsx`, `minWidth` goes from 440 to 300.
   * When the stage is under about 480 CSS px, draw nodes at r = 24 with 15 px labels. Read the width with a `ResizeObserver` in the
     page, not in the renderer's frame logic; the radius may depend on the box width but never on the frame.
   * *Browser* at 390 px: the editor canvas and the stage do not scroll sideways; all of the default graph is visible; dragging still
     works.
   * *Test:* `rendering.test.tsx` checks that the stage size does not depend on the frame (it already does), plus the new `minWidth`.
5. **R15 (UX, graphs): text field before the drawing.** In `GraphEditor.tsx`, put "Graph as text", the switches and the mode buttons
   before the canvas in DOM order (CSS grid can keep the visual order). *Test:* in `GraphPage.test.tsx`, the textarea comes before the
   first `vertex` button in `document.querySelectorAll('[tabindex], textarea, input, button, select')`.
6. **R3 (risk, analysis): name the binary-search input guard.**
   * In `binarySearch.ts`, the check line reads "check A is sorted (input guard for this page, Θ(n): real binary search assumes it)".
   * Both time claims' `why` say "comparisons in the search loop".
   * Add one sentence under the Halving view: "The order check costs n − 1 comparisons and is here only to refuse unsorted input;
     binary search itself trusts its precondition."
   * *Tests:* the pseudocode line contains "guard"; the claims mention "search loop".
7. **R4, R5 (risk, sorting): accurate quicksort wording.**
   * `experiments.ts:61`: "worst case: every pivot is the smallest or largest key of its range, so one side is always empty."
   * `QuicksortView.tsx` notes: add "With this partition, keys equal to the pivot go right, so a list of equal keys is also Θ(n²) for
     every pivot rule. Three-way partitioning fixes that."
   * *Tests:*
     * all-equal n = 24 gives 276 comparisons for all three rules (if median-of-three's own comparisons make it differ, pin the exact
       numbers and say so in the note);
     * the note's text;
     * the reversed claim does not contain "always the smallest".
8. **R6 (risk, structures):** the `hashProbing.ts:71` claim's `when` becomes "expected, assuming each key's home slot is uniformly
   random and independent (linear probing), used load at most ½". *Test:* the claim text no longer says "uniform hashing".
9. **R8 (risk, analysis):** in `GrowthRatesView.tsx:147`, "grows slowest", "grows fastest", "grows faster than the one before it".
   *Test* (`analysis.views.test.tsx`).
10. **R2 (bug, sorting): carry the list.** Add `carryParams: ['a', 'kind', 'n', 'seed', 'pv', 'ps']` to `sorting/index.ts`. Check that
   every sorting view reads those keys the same way (they share `useSortSetup`). *Test:* the manifest; *browser:* the list survives
   Race, then the Quicksort tab.
11. **R13 (UX, structures): a way forward from the heap refusal.**
    * In `HeapView.tsx` (or `StructureView` through a config hook), when `firstViolation(start) >= 0` and an `insert` or `extract`
      comes before any `build` or `rebuild`, show a `Notice` above the stage: "The starting array is not a min-heap, so insert and
      extract will be refused." Add a button "Add build first", which calls `setParams` with `build, ` prepended to `o`.
    * Add the hint "not a heap yet" beside the start field when that holds.
    * *Tests* (`views.test.tsx`): the notice appears for start `3 1 2` with ops `insert 9`; the button makes the first operation
      `build`; the notice does not appear for a valid heap.
12. **R21 (polish, sorting): speed up the suites.** `sorting.views.test.tsx` from 8 s and `sorts.test.ts` from 5.3 s, each to under
    3 s. Sample frames in the "every frame of every preset" renderer test (first, last, every 4th, plus every frame of one preset per
    sort), and run the 300-list brute-force loops in `counts` mode. Keep every required named test.
13. **Notes.** Update `graphs/NOTES.md` (request 1 resolved; request 2 deferred), `analysis/NOTES.md` (Measured no longer shows the
    example; that is packet F's shell change, so no code here), `sorting/NOTES.md` and `structures/NOTES.md`.

### Acceptance (G)

* `npm run check -- graphs sorting structures analysis` passes, and so do `npm run lint && npm test` on the whole tree. Each of the four
  module suites runs under 3 s (`npx vitest run src/modules/<m>`). Five consecutive full `npm test` runs pass (the R21 flake is gone).
* In the browser, at 1280 px and 390 px:
  * a linked graph survives every graphs tab;
  * the BFS drawing fits at 390 px without sideways scrolling;
  * Prim with many negative edges shows a short sentence;
  * the Halving view names the guard;
  * the quicksort notes mention equal keys;
  * the heap refusal notice and its button work by keyboard.
* No console errors; no page overflow.

---

## Won't fix, or later

| Item | Why not now |
| --- | --- |
| DP request 2 (header tones) | The two `CellRow`s above the table already show the compared characters. |
| DP request 3 (`SvgArrow` label offset) | No module needs labelled grid arrows. |
| DP request 4 (`Workbench` main-column slot) | DP's own composition works; this matters only for a future quiz module. |
| DP request 6 (`release({ advance })`) | The "Continue" button is clearer for learners. |
| R25, graphs request 2 (`EdgeMark.dash`, merge `GraphCanvas` into `GraphView`) | Pure refactor, with risk to the editor before the exam. |
| R26, analysis request 1 (`GrowthPanel` heading) | Cosmetic. It would need a shared change and a module change in different packets. |
| Analysis request 2 (`GrowthPlot` y cap) | `RatesPlot` covers it. |
| One shared heap in `@core` | The three heaps are different things (a utility queue and two traced algorithms). |
| Full roving tabindex in the graph editor canvas | Arrow keys already move vertices. R15 reorders the tab sequence instead. |
| Structures `carryParams` | BST, heap and hash views use the same keys with different grammars. |
| Stretch items from PLAN.md (LCS and LIS, Kahn, 3-SAT to Clique, VC/IS/Clique, bucket sort, big-O explorer, AVL, double hashing) | After the exam fixes, if wanted. |
| Screen-reader pass (VoiceOver/NVDA), real touch devices, Safari and Firefox | Needs hardware or a person; do it before publishing. |
| Originality check against the textbook and slides | Needs the course materials; the reviewer found nothing suspicious in the text. |
