# Phase 3 review

Reviewed at `f3f9ba5` (all five Phase 2 packets merged) on branch `skiena373viz`, 2026-11-27. The fix plan is in [PLAN_v2.md](PLAN_v2.md).

## Summary

`npm run lint`, `npm test` (40 files, 996 tests, 12.1 s) and `npm run build` all pass. The built app was served under a subpath
(`/course/skiena373/`, like a GitHub Pages project site) and driven in headless Chrome 158 over the DevTools protocol. Results:

* Every view of every module at 1280 px and 390 px: no console errors or warnings, no horizontal page overflow (`scrollWidth` equal to
  `innerWidth`) on the first frame or the last.
* Stepping back reproduces earlier frames exactly. For all 19 views with a player, the DOM of `<main>` was recorded at every frame while
  stepping forward (up to 60 frames) and compared after stepping back and after scrubbing with the range input. Every frame matched once
  attribute order was normalised. The only differences left were an empty `style=""` that React leaves behind in reductions, and DP quiz
  mode, where the gate correctly stopped forward stepping.
* Keyboard: Space plays and pauses, the arrow keys step, Home and End jump, and none of them move the page (`scrollY` stays 0). I
  answered the DP quiz by keyboard alone: typed numbers, picked a cell with Tab and Enter, chose traceback moves with buttons. The gate
  holds against End and the scrubber. Focus stays in the answer box after a wrong answer and moves to "Continue" after a right one.
  Every focusable element has a visible 3 px outline.
* Algorithms, checked against code I wrote myself in a scratch suite (not in the repo). All of these pass:
  * Dijkstra against Floyd–Warshall: 400 graphs, directed and undirected, zero weights and self-loops included.
  * Dijkstra rejects any negative edge.
  * Prim and Kruskal against an independent minimum spanning forest: 400 graphs with negative weights, ties and disconnected parts.
  * BFS levels against unweighted distances.
  * DFS edge classes against the entry/exit-interval rules, directed and undirected.
  * Every topological order respects every edge, and every reported cycle is real.
  * Edit distance against my own DP, emoji included. At every quiz gate (k = 1) the asked cell is still empty and has no candidates.
  * 3-SAT to Vertex Cover: 120 formulas with sizes 2n+3m vertices, n+6m edges and k = n+2m. A brute-force minimum vertex cover is
    always at least k, and equals k exactly when the formula is satisfiable.
  * Sorting: the three sorts and all pivot rules against the built-in sort. Mergesort is stable and stays within its comparison bound.
    Quicksort (last pivot) makes n(n−1)/2 comparisons on sorted input and also on all-equal input. No trace is truncated at 24 items.
  * BST, heap, linear probing and chaining against reference sets on 200 seeded sequences each.
  * Binary search makes at most ⌊lg n⌋+1 comparisons.
* Performance is fine. Scrubbing renders in 10–30 ms at the largest UI inputs: DP 12×12 (328 frames), Prim on 12 vertices and 30 edges
  (114 frames), sorting 24 items. No module's frame count comes near the 1500 cap.
* Licences: the shipped dependencies are MIT (React) and ISC (d3-force and its helpers). Dev-only dependencies include Apache-2.0,
  BSD, MPL-2.0 (lightningcss, build only), BlueOak, CC-BY-4.0 (caniuse-lite data, build only) and CC0. Nothing copyleft ships. See R23
  for notices.

**Findings: 2 bugs, 6 correctness risks, 11 UX, 8 polish (27 in all).** One polish item, R21, includes a flaky test that made
`npm test` fail in 4 of 6 runs late in this review, under machine load. It is listed under polish because no product behaviour is
wrong, but packet G fixes it second. None of the algorithm outputs is wrong. The worst problems are
in the explanatory text (R1) and in the shell (R2).

**Small blocking fix in this commit** (both packets depend on it): `ModuleManifest.carryParams` plus a `ModulePage` that copies those
keys into its view tabs. Files: `src/core/manifest.ts`, `src/app/Home.tsx`, `src/app/ModulePage.tsx`, and three tests in
`src/app/app.test.tsx`. Modules have not opted in yet; that is packet work (F2, G1, G10).

---

## Bugs

### R1. A self-check answer states the reduction backwards
`src/modules/reductions/algorithms/questions.ts:36` (question "what-it-shows", option `vc-needs-exponential`).
* **What is wrong.** The explanation says "Vertex Cover is hard **only if** 3-SAT is". 3-SAT ≤p VC gives *if 3-SAT is hard, then VC is
  hard*, which is the same as "VC easy ⇒ 3-SAT easy". "VC hard only if 3-SAT hard" means VC hard ⇒ 3-SAT hard. That is the converse,
  and it would need VC ≤p 3-SAT. This is exactly the direction confusion the page exists to clear up, and a student could memorise it.
* **How confirmed.** I read the text against the definition. The page shows it when a student picks that option.
* **Fix.** "A reduction transfers difficulty; it does not create it. It shows that Vertex Cover is hard *if* 3-SAT is, and nobody has
  proved 3-SAT needs more than polynomial time (that is P versus NP)." Add a test that no explanation in `QUESTIONS` contains
  "only if".

### R2. The shell's view tabs dropped the module's input
`src/app/ModulePage.tsx:20` (before this commit), `src/app/Home.tsx:7`, `src/modules/graphs/useGraphModel.ts:12,78`,
`src/modules/reductions/SameFormulaLinks.tsx`.
* **What is wrong.** View tabs linked with `params: {}`.
  * **Graphs** works around this with a module-level `carried` variable. That variable is only set when the learner *edits*. A graph
    that arrived by link (`#/graphs/bfs?g=P-Q, Q-R`) and was never edited is replaced by the next view's own example after a tab click.
  * **Reductions:** the formula is lost on a tab click, so a student who typed a formula on "Build the graph" sees the default formula
    on "Certificates".
  * **Sorting:** the typed list is lost between race, heapsort, mergesort, quicksort and recursion tree.
* **How confirmed.** In the browser (`tabs.mjs`):
  * `#/graphs/bfs?g=P-Q, Q-R`, then the DFS tab, gives `A>B, B>C, …` (DFS's preset).
  * `#/reductions/construct?f=(a|b|c)`, then the Certificates tab, gives the default formula.
  * After an edit, graphs did keep the graph (the workaround).
* **Fix.** The shell part is done in this commit: `ModuleManifest.carryParams?: readonly string[]`, and `ModulePage` copies those keys
  from the current URL into every view tab. It is tested. Modules opt in:
  * graphs: `['g','d','w','s','p']`
  * reductions: `['f']`
  * sorting: `['a','kind','n','seed','pv','ps']`

  Then graphs deletes the `carried` variable, and both duplicate link rows go (R16). Structures does not opt in, because BST, heap and
  hashing read `s` and `o` with different grammars.

## Correctness risks

### R3. Binary search: the complexity claims do not match the algorithm shown
`src/modules/analysis/algorithms/binarySearch.ts:28` (pseudocode `check`), `:52-53` (claims).
* **What is wrong.** The traced algorithm starts with "for each i: require A[i] <= A[i+1]", which is n−1 order checks and Θ(n) time.
  The panel beside it claims "Θ(1) time, best case" and "Θ(log n) time, worst case". On the Halving view a student sees "Order checks"
  reach 63 for n = 64 next to "Comparisons 6", under a Θ(log n) *time* claim. The bound is right for binary search itself, but nothing
  says the check is not part of it.
* **How confirmed.** I read the code; the op counts in the measured panel show it too.
* **Fix.** Mark the pseudocode line "(input guard for this page, Θ(n); real binary search trusts that A is sorted)". Say "comparisons
  in the search loop" in both time claims' `why`. Add a sentence under the Halving view. Test that the claims' text mentions the guard.

### R4. Quicksort "reversed" claim says the wrong thing
`src/modules/sorting/algorithms/experiments.ts:61`.
* **What is wrong.** "worst case: the last item is always the smallest". With last-item pivot and Lomuto partitioning on [5,4,3,2,1]:
  1. The first pivot is 1 (smallest). The array becomes [1,4,3,2,5].
  2. The next range is [4,3,2,5], and its pivot 5 is the *largest*.

  The pivots alternate between smallest and largest. The Θ(n²) claim is right; the reason given is not.
* **How confirmed.** Hand simulation of the partition code. The scratch test confirms 15 comparisons for n = 6, which is n(n−1)/2.
* **Fix.** "worst case: every pivot is the smallest or the largest key of its range, so one side is always empty."

### R5. All-equal keys are also quicksort's worst case here, and the page never says so
`src/modules/sorting/QuicksortView.tsx:31-35`, `src/modules/sorting/algorithms/inputs.ts:17`.
* **What is wrong.** The view offers an "All equal" input. Lomuto partitioning with strict `<` puts every equal key on one side, so
  quicksort does n(n−1)/2 comparisons. The notes explain only sorted input, so a student watching the slow all-equal run is left
  guessing. A student might also believe, from the "median of three fixes it" bullet, that median of three helps here. It does not.
* **How confirmed.** Scratch test: last pivot on `Array(n).fill(4)` gives exactly n(n−1)/2 comparisons for n = 1, 2, 5, 10 and 24.
* **Fix.** Add a bullet: "With this partition (keys equal to the pivot go right), a list of equal keys is also Θ(n²), whatever the
  pivot rule. Three-way partitioning fixes it." Test the text.

### R6. Linear probing claim names the wrong assumption
`src/modules/structures/algorithms/hashProbing.ts:71`.
* **What is wrong.** "expected, assuming uniform hashing … about ½(1 + 1/(1−α)²) probes". That formula is Knuth's result for *linear
  probing* with a random hash function. In the textbook sense, "uniform hashing" (every probe sequence equally likely) gives
  1/(1−α), which is 2 at α = ½. Mixing the two names could cost marks.
* **How confirmed.** I read the text.
* **Fix.** "expected, assuming each key's home slot is uniformly random and independent (linear probing analysis)". Keep the formula.

### R7. "Which way does it go?" gives a muddled reason
`src/modules/reductions/DirectionView.tsx:85-86`.
* **What is wrong.** "The construction never asks whether the formula is satisfiable … That is why a fast Vertex Cover algorithm would
  decide satisfiability". A fast VC algorithm decides SAT because the construction is polynomial *and* preserves the yes/no answer
  both ways. "Never asks" is a property that keeps the construction polynomial; it is not the reason.
* **Fix.** "The construction only reads the shape of the formula, so it runs in polynomial time whether or not the formula is
  satisfiable. Because it also keeps the yes/no answer, a fast Vertex Cover algorithm plus this construction would decide 3-SAT fast."

### R8. Growth-rate list says "faster" and "slowest" without saying "grows"
`src/modules/analysis/GrowthRatesView.tsx:147`.
* **What is wrong.** "1: … the slowest here"; "2ⁿ: … the fastest here"; "n²: … faster than the one before it". In an algorithms
  course "faster" usually means a faster algorithm, which here would be the opposite. The heading "Which grows faster?" is two lines
  above; the bullets themselves are ambiguous.
* **Fix.** "grows slowest", "grows fastest", "grows faster than the one before it".

## UX

### R9. Pseudocode lines are cut off, at 1280 px as well as on phones
`src/ui/panels.tsx:5-24`, `src/app/theme.css:104-106` (`white-space: pre; min-width: max-content` inside `ScrollX`). This is DP
contract request 5.
* **What is wrong.** Long lines scroll sideways in a box with no visible scrollbar on macOS, so they look cut off.
  * At 1280 px the DFS rule line "else if the graph is undirected and the e…" is cut, and that line is the one about the edge to the
    parent.
  * DP's "# diagonal" is cut.
  * At 390 px the BFS pseudocode needs 724 px in a 328 px box, and hash probing needs 770 px.
* **How confirmed.** Screenshots (`graphs-dfs-1280`, `dp-edit-distance-390`, `graphs-bfs-390`), and `scrollWidth` against
  `clientWidth` of each `.scroll-x` box at 390 px.
* **Fix.** Wrap instead of scrolling: `white-space: pre-wrap; overflow-wrap: anywhere`, with a hanging indent (the indent as padding,
  plus a negative `text-indent` for continuation lines). Drop `ScrollX` from the panel. Keep the lit marker on the first visual line.

### R10. The DP table is up to 169 tab stops
`src/ui/Cells.tsx:112`, used by `src/modules/dp/EditStage.tsx:106-113`. This is DP contract request 1.
* **What is wrong.** With `onCell` set, every cell becomes its own tab stop. That is 56 for kitten/sitting, 169 at the 12×12 limit, all
  of them before the player controls. A keyboard user has to Tab through the whole table to reach Play.
* **How confirmed.** Tab-order dump in the browser: 12 grid stops for "kit"/"si", 91 tab stops on the default page.
* **Fix.** Roving tabindex in `CellGrid`:
  * one tab stop, and the arrow keys move between cells (the grid carries `data-player-keys="off"` while it has focus);
  * Enter or Space activates;
  * Home and End go to the row ends.

  Move DP's visually hidden table into `CellGrid` (an `accessibleTable` prop), so other grids get names too.

### R11. The finished DP table hides most parent marks
`src/modules/dp/EditStage.tsx:25-36` (`marksVisible`).
* **What is wrong.** During the traceback, and in the final frame, only cells the traceback has left show their ↖←↑ marks. Every
  off-path cell loses the marks it showed during the fill. On the last frame (screenshot `dp-last-1280`) a student cannot see the other
  optimal alignments or check a tie, even with the quiz off. The hiding is only needed so that a *gated* traceback question does not
  show its answer.
* **Fix.** At `done`, show all marks. During `trace-start` and `trace-move`, hide only the marks of the current position and of cells
  not yet visited on the path; or hide them only when the quiz is on (the stage already gets `StageContext`). Extend the existing
  "no leak at gated frame" test to the new rule.

### R12. The graph drawing is a quarter off-screen on phones
`src/modules/graphs/GraphCanvas.tsx:53` (`minWidth={440}`); also `src/ui/GraphView.tsx:51` (default `minWidth = 500`).
* **What is wrong.** At 390 px both the editor canvas and the stage show 324 of 440 px. The right quarter of the graph is hidden until
  the box is scrolled. Dragging near the edge competes with scrolling, and labels are small.
* **How confirmed.** `boxes.mjs` at 390 px gives "Graph editor canvas 324/440" and "Breadth-first search, step 1 328/440". Screenshot
  `graphs-bfs-390`.
* **Fix.** Let the graph canvas scale down to the box (`minWidth` about 300), and grow the node radius and label size when the stage
  is narrow. A 640×400 viewBox at 328 px is about 0.5 scale, so use r = 24 and 15 px labels. Lower `GraphView`'s default as well.

### R13. Heap: a typed starting array refuses insert and extract
`src/modules/structures/algorithms/heap.ts:220`.
* **What is wrong.** The starting array is taken literally. If it is not a min-heap, every `insert` and `extract` before a `build` is
  refused, one frame each. A student who types "5 3 8" and "insert 2" gets a refusal, not a sift-up. The behaviour is documented and
  tested, but the page gives no way forward except editing the operation list by hand.
* **How confirmed.** I read the code. The preset "Not a heap yet" demonstrates it.
* **Fix.** Keep the algorithm as it is. In the heap view, when the start is not a heap and an insert or extract comes before any
  build/rebuild, show a `Notice` above the stage with a button "Add build first", which prepends `build` to the operations (the same
  pattern as the graphs mismatch buttons). Also say "is not a heap" next to the starting array field. Test.

### R14. The worked example is still listed as a module
`src/app/App.tsx:48` (top nav), `src/app/Home.tsx:22-26`, plus every consumer of `useModules()`.
* **What is wrong.**
  * "Worked example" appears in the top navigation next to the six course modules.
  * The home page has a card for it.
  * The Measured view counts it: "19 experiments from 7 modules", with linear search plotted among the course modules.

  It was scaffolding for the workers.
* **Fix.** Filter `isExample` out of the nav and out of the `ModulesContext` value, so Measured skips it. On the home page, replace the
  card with one line in the "How it fits together" section. Keep the route working. Update the app tests.

### R15. Graph editor: every vertex and edge is a tab stop before the text field
`src/modules/graphs/GraphCanvas.tsx`, `GraphEditor.tsx`.
* **What is wrong.** There are 14 stops for the default graph and up to 42 at the limit, all before "Graph as text", which is the
  documented keyboard path.
* **How confirmed.** Tab-order dump of `graphs/bfs`.
* **Fix.** Arrow keys already move a focused vertex, so a roving tabindex would clash. Instead, put the text field and the mode
  controls before the canvas in DOM order, and give the canvas a single "Skip the drawing" link or a short tab-order note. A full
  roving tabindex is listed under later.

### R16. Two rows of view links with different behaviour
`src/modules/graphs/GraphPage.tsx:42` ("Same graph in:"), `src/modules/reductions/SameFormulaLinks.tsx`.
* **What is wrong.** Graphs and reductions each show the shell's view tabs and also a module row of links to the same views. One row
  kept the input and the other did not (R2).
* **Fix.** After opting into `carryParams`, delete both module rows.

### R17. Certificates: checkbox labels state the current value
`src/modules/reductions/CertificatesView.tsx:78`.
* **What is wrong.** An unchecked box is labelled "x1 is false", so a screen reader reads "x1 is false, checkbox, not checked". That
  reads like a double negative, and the name changes on every toggle.
* **Fix.** A fixed label "x1 true" (checked means true), with the current value shown beside it as `aria-hidden` text, or a
  two-option radio group per variable.

### R18. A rejected trace shows its sentence twice
`src/ui/Workbench.tsx:59-61` (`Caption`, then `TraceNotices`).
* **What is wrong.** On the last frame of a rejected trace the caption and a "Careful:" notice repeat the same sentence. Seen on
  certificates with a wrong cover, and on Dijkstra with a negative edge. A screen reader announces it twice.
* **Fix.** Have `TraceNotices` say only "This input was refused; the step above says why.", or skip the notice when the caption is
  shown next to it.

### R19. Prim and Kruskal sentences grow past the 260-character rule
`src/modules/graphs/algorithms/prim.ts:106`, `kruskal.ts:152-153`.
* **What is wrong.** The check frame lists *every* negative edge. With 30 negative edges the sentence is 472 characters, breaking
  contract rule 2. Tests only check presets.
* **How confirmed.** Scratch test with 30 negative edges: one explanation of 472 characters.
* **Fix.** List at most 3 edges, then "and N more". Test with the 30-edge maximum, through `validateTrace`.

## Polish

### R20. Module-level state in graphs
`src/modules/graphs/useGraphModel.ts:12` (`let carried`). Cross-view session state lives in module scope, outside the URL and the
contract. **Fix:** delete it once graphs opts into `carryParams` (R2).

### R21. Some suites run well over the 3-second guideline, and one test is flaky
**Flaky.** The test "renderers draw every frame of every preset … the full 24-item limit, with duplicates, negatives and every pivot
rule" (`src/modules/sorting/sorting.views.test.tsx`) takes about 4.9 s against the 5 s `testTimeout`. It **timed out in 4 of 6
full `npm test` runs** late in this review, with load average about 8. It passes when its file runs alone (4.9 s). The first full run of
the session passed. An exam-week `npm test` can therefore fail for no code reason.

Per-file times (vitest JSON reporter):

| File | Time |
| --- | --- |
| `dp/EditDistanceView.test.tsx` | 10.7 s |
| `sorting/sorting.views.test.tsx` | 8.0 s |
| `sorting/algorithms/sorts.test.ts` | 5.3 s |

The slowest single tests are "renderers draw every frame of every preset … 24-item limit" (4.9 s) and "stage renders every frame of
preset intention-execution" (2.0 s). The whole run is 12 s only because files run in parallel.

**Fix:** sample frames, keeping the first, the last, every gated frame and every 5th, or render with a shared root. Keep the no-leak
guarantee on every gated frame.

### R22. DP quiz wording
`src/modules/dp/algorithms/quiz.ts:52` and `:234-235`.
* The base-cell prompt "What is D[i][j], and why?" asks *why*, but only a number is checked. Use "What value goes into D[i][j]?" and
  show the why in the feedback, as it already does.
* The hints say "the first 1 text characters"; use the module's `plural` helper.

### R23. Third-party licence notices are not shipped
The README lists the licences, but the minified bundle strips the `@license` comments, and `dist/` has no notice file. React's MIT
licence asks for the notice in copies. **Fix:** `public/THIRD_PARTY_LICENSES.txt` with the MIT and ISC texts, copied into `dist/` by
Vite, and a footer link to it.

### R24. Complexity panel keys can collide
`src/ui/panels.tsx:57` uses the key `${resource} ${when}`. No module repeats a pair today, but two claims with the same resource and
case would collide. **Fix:** key by index.

### R25. Graphs keeps its own copy of the edge drawing (graphs contract request 2)
`src/modules/graphs/GraphCanvas.tsx` redraws edges because `GraphView` only has a boolean `dashed`. **Fix (later):**
`EdgeMark.dash?: string` in `GraphView`/`SvgEdge`, then shrink `GraphCanvas`.

### R26. Measured repeats the growth panel heading (analysis contract request 1)
"Measured counts against theory" appears once per module. **Fix (later):** `GrowthPanel` `heading?: string`.

### R27. DP layout leaves large empty areas
At 1280 px the alignment strip is right-aligned with a large empty area to its left, and the recurrence panel reserves about 180 px of
empty height on base-cell frames. This is deliberate (no layout shift) but looks unfinished. **Fix:** left-align the alignment table
inside its scroll box and lower the reserved height to the three-row table height.

---

## Contract change requests: decisions

| From | Request | Decision |
| --- | --- | --- |
| dp 1 | `CellGrid` roving tabindex plus built-in accessible table | **Accept**, F (R10) |
| dp 2 | header tones / `CellSpec` headers | Later (the two `CellRow`s work) |
| dp 3 | `SvgArrow` label offset | Won't fix (DP draws arrows without labels; nobody else needs it) |
| dp 4 | `Workbench` main-column aside slot | Later (DP composes its own page cleanly) |
| dp 5 | `PseudocodePanel` clips long lines | **Accept**, F (R9) |
| dp 6 | `release({ advance })` | Won't fix (the "Continue" button is clearer) |
| graphs 1 | carry URL keys between views | **Accepted and done** in this commit (`carryParams`); modules adopt it in F2, G1, G10 |
| graphs 2 | `EdgeMark.dash` | Later (R25) |
| analysis 1 | `GrowthPanel` heading | Later (R26) |
| analysis 2 | `GrowthPlot` y cap | No change needed (`RatesPlot` covers it) |

## Duplicated code: verdict

* **Three heaps.** These are not duplicates. `graphs/algorithms/heap.ts` is a small counting min-heap used as Prim's and Dijkstra's
  queue. `structures/algorithms/heap.ts` and `sorting/algorithms/heapsort.ts` are traced algorithms whose every step is a frame. Keep
  them.
* **Graph drawing.** There are three: `ui/GraphView` (used by graph renderers), `graphs/GraphCanvas` (dash patterns, editor), and
  `reductions/ReductionGraph` (square and round nodes, gadget boxes). Only `GraphCanvas` overlaps enough to merge, and that is R25,
  later.
* **Formula, graph and sorting link rows.** These duplicate the shell tabs (R16).

## Not found (checked and fine)

* Algorithms. Every independent comparison listed in the Summary passed. In addition:
  * Dijkstra's own check refuses negative edges and names the edge and the reason.
  * Prim and Kruskal accept negative weights and say why.
  * Prim reports unreached vertices on a disconnected graph; Kruskal returns a forest.
  * Topological sort rejects undirected input and names a real cycle.
  * DFS on undirected graphs reports only tree and back edges and never calls the parent edge a back edge.
  * DP ties follow diagonal, then left, then up, and all optimal parents are recorded.
  * 3-SAT to VC refuses wrong certificates at the right edge or clause.
  * BST deletion covers all its cases (unit-tested).
  * Probing and chaining match a reference set, including full tables and tombstones.
* Complexity claims. Every claim in every module was read; apart from R3, R4 and R6 they are correct and say which case they mean.
* Quiz leakage. At every gated frame the asked cell is empty: in the state, in the hidden table (`td[data-cell]` reads "empty"), in
  the caption and in the recurrence panel. Parent marks of the current traceback cell are hidden. The repository's own jsdom leak test
  also passes.
* Renderers draw only from their frame. The exception is DP's selected cell and click handler, passed through `StageContext`; that is
  interaction state, not trace state, which is acceptable.

## What I could not check

* No screen reader was run. I checked roles, names, live regions and tab order from the DOM only.
* No real touch device. Dragging on the graph canvas and scrolling inside the scroll boxes were not tried with fingers. The 390 px
  checks used device emulation.
* Only Chromium. Safari and Firefox were not tried, and neither were reduced-motion and forced-colours modes.
* Originality against the textbook, the slides and other visualizers (VisuAlgo, USFCA/Galles, OpenDSA, dpvis, algorithm-visualizer).
  I had none of them at hand. I read every pseudocode block and explanation and found no distinctive phrasing that looks copied:
  * The pseudocode uses the course's usual terms (discovered and processed, tree and back edges) in its own wording.
  * The 3-SAT gadget is the standard textbook construction, described in original words.
* A real GitHub Pages deploy. It was simulated with a static server under `/course/skiena373/`; relative assets and hash routes worked.
* Gate behaviour under fast autoplay at 4× was covered only by the player's unit tests, not watched in the browser.
