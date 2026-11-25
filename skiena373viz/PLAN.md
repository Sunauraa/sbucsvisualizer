# Skiena373Viz: plan and contract

An interactive visualizer for CSE 373 (Fall 2026), built to study for the final on 12/17. Phase 1 (this commit) is the scaffold, the
contract, the shell and one worked example. Phase 2 is five work packets, A to E, done in parallel by five workers who share one working
tree.

**Read in this order:** sections 1 to 4, then `src/modules/example/` (three small files plus tests; it is the pattern to copy), then
your packet in section 6. Skim section 5 before writing UI.

**If time runs short:** B (DP), A (graphs) and C (reductions) come first; then D and E.

---

## 1. Architecture

```
input ──run()──▶ Trace { frames[], totals, result } ──frame──▶ Renderer (React + SVG)
 JSON            pure, deterministic, JSON, frozen              pure function of ONE frame
```

* An **algorithm** is a pure function. It never touches React, the DOM, clocks or unseeded randomness (ESLint enforces this).
* A **frame** is one moment: lit pseudocode anchors, one sentence, cumulative operation counts, and the complete state.
* The **player** only moves an index. Stepping back is showing an earlier frame, so it is always exact.
* The same counts feed the **growth plot**: `run(input, { mode: 'counts' })` at many sizes, against n, n log n, n².

```
src/core/      pure contract, no React at run time   import from '@core'  (tests also: '@core/testing')
src/ui/        shared React components and hooks     import from '@ui'    (tests also: '@ui/testing')
src/app/       shell: router, registry, pages, theme.css (private)
src/modules/<id>/
    index.ts                manifest only; auto-discovered, nobody edits a registry
    algorithms/*.ts         pure zone: algorithms, parsing, experiments, quiz logic
    algorithms/*.test.ts    fast node tests
    *View.tsx, *.tsx        views and renderers
    *.module.css            styles, if needed
    NOTES.md                your notes and contract change requests
```

| File | What is in it |
| --- | --- |
| `core/trace.ts` | `Frame`, `TraceEvent`, `Trace`, `Recorder`, `Finished`, `Algorithm`, `ComplexityClaim`, `Preset`, `RunOptions` |
| `core/recorder.ts` | `defineAlgorithm` (snapshots and freezes every frame, checks anchors, truncates) |
| `core/pseudocode.ts` | `definePseudocode`, `AnchorOf` |
| `core/ops.ts` | `OpDef`, `OpCounts`, `defineOps`, `OpOf`, `OpCounter` |
| `core/json.ts` | `Dist` (null = ∞), `formatDist`, `distLess`, `distAdd`, `snapshot`, `jsonProblems`, `deepFreeze` |
| `core/validate.ts` | `validateTrace`, `checkAlgorithm`, `describeProblems`, `unlitAnchors` (via `@core/testing`) |
| `core/player.ts` | pure player state machine with gates, `frameAt` |
| `core/growth.ts` | `GrowthExperiment`, `experimentFor`, `measureAt`, `GROWTH_FNS`, `scaleToLast`, `ratios`, `experimentProblems` |
| `core/graph.ts`, `graphLayout.ts` | `Graph`, `adjacency`, `nodesInOrder`, `parseGraph`, `formatGraph`, `graphProblems`; `forceLayout` (the only D3) |
| `core/rng.ts`, `input.ts`, `theme.ts` | `createRng`; `Result`, `ok`, `fail`, `parseIntList`, `parseBoundedInt`; `Tone`, `TONES`, `SURFACE`, `SERIES` |
| `core/syllabus.ts`, `manifest.ts` | `LECTURES`, `SYLLABUS`; `ModuleManifest`, `ViewManifest`, `ViewProps` |
| `ui/Workbench.tsx` | `Workbench` (the standard page), `RendererProps`, `FrameRenderer`, `TraceNotices` |
| `ui/usePlayer.ts` | `usePlayer` (with `gated`), `Player`, `usePlayerKeys`, `usePrefersReducedMotion` |
| `ui/PlayerControls.tsx`, `panels.tsx` | `PlayerControls`; `PseudocodePanel`, `OpsPanel`, `Caption`, `ComplexityPanel`, `Legend` |
| `ui/Svg.tsx`, `Cells.tsx`, `GraphView.tsx` | `SvgStage`, `SvgNode`, `SvgEdge`, `SvgArrow`, `Halo`, `ToneGlyph`, `activatable`; `CellRow`, `CellGrid`; `GraphView`, `toSvgPoint` |
| `ui/Field.tsx`, `ScrollX.tsx`, `ErrorBoundary.tsx` | `Field` (label + announced error), `Notice`; `ScrollX`; `ErrorBoundary` |
| `ui/GrowthPlot.tsx`, `GrowthPanel.tsx` | `GrowthPlot` (any series), `GrowthPanel` (experiments), `useGrowthRows` |
| `ui/ModulesContext.ts` | `useModules` (every loaded manifest) |
| `ui/testing.tsx` | `checkRenderer` (renders every frame; run it on every preset) |

---

## 2. Contract guide

### 2.1 An algorithm

Abridged from `src/modules/example/algorithms/linearSearch.ts`; read the real file.

```ts
const PSEUDOCODE = definePseudocode([
  ['signature', 0, 'linear-search(A[0..n-1], target)'],   // [anchor, indent, text]
  ['compare',   2, 'if A[i] = target'],
  ['found',     3, 'return i'],
]);
const OPS = defineOps([{ id: 'comparisons', label: 'Comparisons', counts: 'One each time A[i] is compared with the target.' }]);
type T = Recorder<State, AnchorOf<typeof PSEUDOCODE>, OpOf<typeof OPS>>;   // typos in anchors/ops do not compile

export const linearSearch = defineAlgorithm({
  id: 'example-linear-search', title, summary, pseudocode: PSEUDOCODE, ops: OPS, complexity: [...], presets: [...],
  execute({ items, target }: Input, t: T): Finished<number | null> {
    const state = (): State => ({ items, target, cursor, ruledOut, foundAt });  // one state builder
    t.step({ lines: ['signature'], say: `Search ${items.length} items for ${target}.`, state });   // frame 0: no work yet
    ...
      t.count('comparisons');                       // count first
      t.event('compare', [`A[${i}]`, 'target']);    // then events (optional)
      t.step({ lines: ['compare'], say: `A[${i}] is ${items[i]}, not ${target}.`, state });  // then the frame showing it
    ...
    return t.finish({ lines: ['found'], say: `Return index ${i}.`, state, result: i });      // always return finish/reject
  },
});
```

* `state` is a thunk. Whatever it returns is deep-copied and frozen on the spot, so keeping live mutable arrays inside `execute` is fine.
* `say` may be a string or a thunk. Use a thunk if building it is costly or reads something that may be missing.
* `t.reject({...})` ends the trace with status `rejected`: the algorithm's own check refused the input. Record the check itself as frames
  (light the check line, count its work), then reject with a sentence naming the offending value. `run()` never throws.
* In `mode: 'counts'` neither thunk runs and `frames` is empty. Never put algorithm work inside a thunk.
* Traces are capped at `maxFrames` (1500). Beyond it the trace is `truncated`: first frames and final frame are kept, counts stay exact,
  `Workbench` says so. Cap UI inputs so that this is exceptional.

### 2.2 Frame invariants (checked by `validateTrace`)

1. `index` equals the position; at least one lit line; every line is an existing anchor, listed once.
2. `explanation` is exactly one sentence: ends in `.`, `!` or `?`; no earlier sentence end followed by a capital letter (so avoid "e.g. A"); at most
   260 characters; never shows `undefined`, `NaN` or `Infinity`. Name the actual values: "Key 7 is less than 9, so go left."
3. `ops` has exactly the declared keys, non-negative integers, never decreasing. **Frame 0 is all zeros**: set the scene, do no work.
4. The frame survives a JSON round trip. No `Infinity`, `NaN`, `-0`, `undefined`, `Set`, `Map`, class instances, functions. Infinite distance is `null` (`Dist`).
5. Everything is deeply frozen. The final frame's ops equal `trace.totals`.
6. `run()` is deterministic, does not mutate its input, and `'counts'` mode gives the same totals and result.

Checked by review, not by machine:

7. **A frame is self-contained.** Highlights, pointers, queue contents, "chosen" flags are in the state; a renderer never re-runs the algorithm, reads another
   frame to draw, or consults module-level variables.
8. **A value never vanishes between two frames.** A key lifted out of an array lives in an explicit in-transit field (`held`, `aux`). Pass `conserved` to
   `checkAlgorithm` to prove it wherever the set of values is fixed (sorting). Where operations
   add and remove keys (structures), use `invariant(frame, previous)`: keys in the structure plus keys in transit may change only in a frame whose event is
   `insert` or `remove` of exactly that key.
9. **Light the line that ran.** A failed condition lights only the condition line. Several anchors only when one step really spans several lines.
10. Ids (module, view, algorithm, preset, anchor, op, case, experiment) are stable: they appear in URLs and links. Kebab-case; algorithm and
    experiment ids are prefixed with the module id.

### 2.3 Tests every algorithm has

```ts
expect(describeProblems(algorithm)).toEqual([]);
checkAlgorithm(algorithm, input, { conserved, invariant });      // every preset AND every edge case; returns the trace
expect(unlitAnchors(algorithm, presetTraces)).toEqual([...]);    // only lines you can justify, such as a loop header
checkRenderer(Renderer, trace);                                  // every preset, from '@ui/testing'
```

Also compare `trace.result` with an independent brute force on a few hundred seeded random inputs (`createRng`), run in `'counts'` mode so it is fast. Keep each
module's suite under about 3 seconds. Tests run in node by default; only tests that click or type start with `// @vitest-environment jsdom`.

### 2.4 A view

Copy `LinearSearchView.tsx`. A view is the default export of its file, takes `ViewProps`, keeps its input in URL params (short keys), parses with `Result`, and while the
input is invalid keeps showing the last valid run plus a message in `Field error`. **Memoise the trace** (`useMemo`): a new trace object restarts the player.

`Workbench` gives you player, keyboard, caption, pseudocode, counts and complexity. Put extra panels that need the current frame in `aside`, the key in `legend`, inputs in `inputs`,
and a `GrowthPanel` in `children`. For layouts with several lanes use `usePlayer`, `usePlayerKeys` (once per page), `PlayerControls`, `Caption`, `TraceNotices` and `frameAt` directly.

**Gate** (quiz): pass `gated: (index) => boolean`, memoised. The player cannot pass a gated frame by stepping, playing, scrubbing or jumping. While `player.atGate` show the question; `player.release()`
opens it and resumes playback if the gate interrupted it. `player.rearm()` closes all gates for a retake. Going back is always allowed.

### 2.5 A manifest

`src/modules/<id>/index.ts` default-exports a `ModuleManifest`: `id` (equal to the folder), `views` (lazy `load`), optional `loadExperiments`. Import nothing else there. Titles, units and module-level
lecture numbers already live in `core/syllabus.ts`. Routes: `#/<module>/<view>?key=value`; the first view is the module's landing page. `src/app/modules.contract.test.ts` checks your manifest
automatically.

### 2.6 Growth experiments

`experimentFor(algorithm, {...})` turns an algorithm into a `GrowthExperiment` (copy the example). Declare cases with honest claims ("worst case", "on average over random inputs"). At least 4 increasing sizes; whole
sweep under about 200 ms. Export them as `experiments` from one file and point `loadExperiments` at it; the analysis module picks them up with no import between modules.

---

## 3. Design and accessibility rules

* **One palette**, through `tone`: active `#2563eb` processed now; compare `#d97706` inspected; swap `#dc2626` changing, removed or rejected; done `#16a34a` final; visited `#7c3aed` seen, not final; target `#0891b2` goal, source or
  chosen; idle. Every primitive also draws the tone's glyph. **Never colour alone**: add a label, glyph, dash or shape. Show a `Legend` saying what each tone means here.
* Text uses `SURFACE.ink`/`muted` or `TONES[x].ink`, not the bright tone colours. Light theme only. Use the CSS variables in `theme.css`; module styles go in `*.module.css`.
* **No horizontal page overflow at 390 px.** Wide things scroll in their own box (`SvgStage minWidth`, `ScrollX`). Grid and flex children need `min-width: 0`.
* **Scrubbing never moves the page.** `SvgStage` width and height come from the input, never from the frame (`checkRenderer` fails otherwise); reserve room for variable-height panels
  (`CellRow slots`, `min-height`).
* Keyboard: space plays, arrows step, Home/End jump; never hijacked in fields, buttons, links or `role="button"` shapes. A region with its own keys sets `data-player-keys="off"` (or `"arrows"`).
* Everything clickable is keyboard-operable with a name (`activatable`, or the `onNode`/`onCell` props). Visible focus. Respect reduced motion (no `requestAnimationFrame` loops; CSS transitions are already disabled
  globally under that setting).
* Never `autoplay`. Never an empty stage: empty inputs show a labelled empty state.
* **Bounds**: Θ only when tight for the stated case; otherwise O or Ω. Always say which case ("worst case", "expected, random pivot"). Say what is being counted.
* Write original explanations and pseudocode. Do not copy text, pseudocode or code from the textbook, slides, or any other project. Plain words, present tense, no exclamation marks.

---

## 4. Working rules

1. Edit **only** your own directories (section 6). Never edit `src/core`, `src/ui`, `src/app`, `src/test`, `src/modules/example`, root config, `package.json`, `package-lock.json`, `PLAN.md`,
   `README.md`, or anything outside `skiena373viz/`. Install nothing; everything needed is installed. D3 is only reachable through `forceLayout`.
2. Modules never import each other (lint enforces it). Analysis gets other modules' experiments through `useModules()`.
3. If the contract is in your way, do not work around it in shared files: write a request in **`NOTES.md` inside your own module directory** (what, why, proposed signature), and use a local
   helper in the meantime. A genuine shared bug is reported the same way with a minimal reproduction. Also log deviations and stretch work there.
4. Check yourself with `npm run check -- <module>` (packet D: `npm run check -- sorting analysis`): it lints and tests only your folder plus the shared code and hides type errors that belong to neighbours. Do not "fix" a neighbour.
5. Look at your work: `VITE_CACHE_DIR=node_modules/.vite-<packet> npm run dev -- --port <port> --strictPort --host 127.0.0.1` (ports A 5181, B 5182, C 5183, D 5184, E 5185), headless Chrome screenshots at 1280 px and in a 390 px wide iframe (headless Chrome windows do not go below 500 px). Stop the
   server afterwards. Do not run `npm run build` into `dist/` while others work; use `npx vite build --outDir dist-<packet> --emptyOutDir` and delete it. Temporary files go in your scratch directory, not the repo.
6. Git: no push, stash, reset, checkout, rebase, branch or config changes. If told to commit, stage only your paths (`git add skiena373viz/src/modules/<dir>`) and commit only those paths (`git commit -m "..." -- skiena373viz/src/modules/<dir>`). Never `git add -A`.
7. TypeScript is strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (`import type`). No `any`, no `!` outside tests, no `eslint-disable` without a reason on the same line. React hooks lint includes the compiler rules: do not set state
   in effects to mirror props (see the `lastGood` pattern), do not read refs during render.
8. Scope is the required list. "Stretch" items only once every acceptance criterion is met.

**Definition of done, every packet:** `npm run check -- <module>` passes; every required test exists and is named for its edge case; every view was looked at in a browser at 1280 px and 390 px, first, middle and last frames, with no console
errors and no page overflow; every view works by keyboard alone; `NOTES.md` exists (it may say "no requests") and the final report lists what was verified.

---

## 5. Shared decisions (so that five modules feel like one)

* Vertices and ties are ordered by `compareLabels`; `adjacency()` and `nodesInOrder()` already do it. Say the tie-break in the explanation when a tie happens.
* Arrays are 0-based. DP tables are 0-based with row 0 and column 0 as the empty prefix.
* Op ids: reuse `comparisons`, `swaps`, `writes`, `relaxations`, `edge-checks`, `probes`, `cells`, `calls` where they mean the same thing.
* A sequence of operations on a structure ("insert 5, delete 3") is one trace: frame 0 shows the starting structure, then each operation runs; an operation that cannot be done (delete a missing key, extract from empty, insert into a full
  table) is explained in a frame and the sequence continues. A whole input that cannot be run (negative edge, cycle) is `reject`.
* Seeds: random inputs come from a visible "New random input" button that changes a seed kept in the URL.
* Size limits in the UI: graphs 12 vertices and 30 edges; strings 12 characters each; formulas 5 variables and 8 clauses; sorting 24 items (race); structures 24 operations and keys from -99 to 999. Over the limit: a message, not a crash.

---

## 6. Work packets

### Packet A: graphs — owns `src/modules/graphs/`

Unit 4, lectures 10 to 14. Port 5181.

**Input:** `GraphInput { graph: Graph; start: string | null }`. **Output:** traces from six algorithms; one shared renderer, one editor.

**Algorithms** (`algorithms/`; ids `graphs-bfs`, `graphs-dfs`, `graphs-topological-sort`, `graphs-prim`, `graphs-kruskal`, `graphs-dijkstra`; view ids `bfs`, `dfs`, `topological-sort`, `prim`, `kruskal`, `dijkstra`):

| | Must show in state | Ops | Claims |
| --- | --- | --- | --- |
| BFS | queue (front first), state of each vertex (undiscovered, discovered, processed), parent, level; tree edges; restarts per component, numbering components | `visits`, `edge-checks` | Θ(V+E) every case, adjacency lists |
| DFS | call stack (bottom to top), entry/exit times, parent; each edge classified tree / back (undirected), plus forward / cross (directed), as a label and a dash pattern, not just a colour | `visits`, `edge-checks` | Θ(V+E) |
| Topological sort (DFS finish order) | call stack, finish stack, the order growing from the right | `visits`, `edge-checks` | Θ(V+E) |
| Prim | priority queue contents sorted by (key, label) with stale entries visibly marked, tree edges, key and parent per vertex, weight so far | `edge-checks`, `relaxations`, `queue-comparisons` | O(E log V) with a binary heap and lazy deletion |
| Kruskal | edges sorted by weight with a cursor, union-find forest (parent and size; component label on each vertex), accepted and rejected edges, weight so far | `comparisons` (sorting), `finds`, `unions` | O(E log E), which is O(E log V) |
| Dijkstra | priority queue as in Prim, dist (`Dist`) and parent per vertex, finalized set, shortest-path tree | `edge-checks`, `relaxations`, `queue-comparisons` | O((V+E) log V) with a binary heap and lazy deletion |

`relaxations` counts successful improvements; `edge-checks` counts every adjacency entry looked at. Write one small pure binary heap for the queue, counting its comparisons.

**Features**
1. Editor shared by all six views: modes select/move, add vertex, add edge, delete; click and touch; drag to move; weight editing; directed / weighted switches; start vertex; presets; clear; auto layout (`forceLayout`). Each algorithm sets what it needs (Prim and Kruskal: weighted undirected; topological sort: directed; Dijkstra: weighted) and
   explains a mismatch rather than silently changing the drawing.
2. The same graph as text (`parseGraph`/`formatGraph`) in a field, two-way with the drawing: this is the keyboard path, with full editing power. The graph, its switches and the start vertex live in the URL and carry over between the six views (positions included, in a compact parameter).
3. Editing recomputes the trace and returns to frame 0. Vertex labels are assigned A, B, C, ... reusing freed letters.
4. Aside panel: the queue / stack / priority queue as a `CellRow` with stable room, named ends (front/back, top), plus a vertex table (parent, level or dist or key, times).
5. `GrowthPanel` on each view. Experiments: sparse (E = 2V) and dense (complete) cases for BFS, Prim or Kruskal, and Dijkstra, n = V.

**Edge cases and required tests** (each is one named test): empty graph; single vertex; self-loop; disconnected (BFS and DFS cover every component; Prim reports the unreached vertices and that no spanning tree exists; Kruskal returns a forest; Dijkstra leaves `null`, shown as ∞);
directed cycle in topological sort is rejected and the sentence names the cycle, such as "B → D → C → B" (test the cycle is real); undirected input to topological sort is rejected; a two-vertex directed cycle; antiparallel edges; DFS edge classification on a directed graph having all four kinds; DFS on an undirected graph never reports forward or
cross edges and does not call the edge to the parent a back edge; negative edge for Dijkstra is rejected **by its own check**, naming the edge and why greedy finality fails; zero weights accepted; negative weights accepted by Prim and Kruskal (they are fine there, say so); equal weights (Prim and Kruskal total weights agree on 200 seeded random graphs;
compare with brute force over spanning trees for V ≤ 5); Dijkstra equals Bellman-Ford or Floyd-Warshall on 200 seeded random graphs; BFS levels equal unweighted shortest distances; every returned topological order respects every edge; start vertex deleted; duplicate edge and malformed text give messages; vertex cap. Editor logic is a pure reducer with its own tests.

**Acceptance:** a student can draw a graph from nothing with mouse, touch or text only, run all six, and at every frame read off the queue / stack / priority queue and why the step happened.

**Stretch:** Kahn's algorithm, connected-component colouring, two-colouring, adjacency matrix and list side panel.

### Packet B: DP and quiz — owns `src/modules/dp/`

Unit 5, lectures 18, 19, 21. Port 5182. First priority.

**Input:** `EditInput { pattern: string; text: string }` (characters compared exactly, by code point; spaces shown as ␣). **Output:** `{ distance, operations[] }`, where operations transform pattern into text.

**Algorithm** `dp-edit-distance` (view `edit-distance`): rows i = prefix of pattern, columns j = prefix of text; unit costs for substitution, insertion, deletion, 0 for a match. Base row and column first, then row by row.
Recurrence from three neighbours: diagonal (match / substitute), left (insert `text[j]`), up (delete `pattern[i]`). **Tie-break: diagonal, then left (insert), then up (delete)**; state it in the pseudocode, and record *all* optimal parents in the state as well as the chosen one.

Each inner cell takes exactly two frames, which the quiz relies on:
* **look**: the cell is highlighted and its three dependencies are marked with arrows; characters being compared are highlighted; the cell is still empty and no candidate totals are in the state.
* **write**: three candidate totals, the minimum, the tie if any, and the value written.

Then traceback from the bottom-right corner: one frame per move, arrows and the growing alignment (pattern over text, with gaps) and edit script; the script is in forward order in the last frame. Ops: `cells` (values written, (m+1)(n+1) in total), `comparisons` (character comparisons, mn), `traceback-steps`. Claims: Θ(mn) time every case, Θ(mn) space with
traceback; a distance-only version needs Θ(min(m, n)) space (say so in "why").

**Features**
1. `CellGrid` table with headers, dependency arrows, done / active / compare tones and parent marks; the recurrence with the current numbers substituted; alignment strip that reserves its room.
2. Click or focus a filled cell (when not in quiz mode): show where its value came from and the sub-problem in words ("cheapest way to turn "kit" into "si"").
3. **Quiz mode** (toggle, in the URL). Uses `gated`. Two question kinds, derived by a pure function `questionAt(trace, index)` that reads frame `index + 1`:
   * *Which cell is written next?* Gate the previous **write** (or last base-case) frame; answer by clicking or keyboard-choosing a cell. A wrong cell whose three dependencies are ready gets its own feedback: computable now, but this pseudocode goes row by row. A cell whose dependencies are missing is told which.
   * *What value is written?* Gate the **look** frame; answer by typing a number. Wrong answers get a hint using the recurrence with this cell's neighbours, then a second hint, then "Show me".
   Setting: ask about every k-th cell (default 3) with a seeded choice of kind. Nothing on the page reveals the answer at a gated frame (caption, candidates, counts, arrows, accessible names): test this. Score, streak, per-kind accuracy, "Retake" (`rearm`). Wrong answers are announced politely; focus stays where the learner is typing.
   Back-stepping, scrubbing and playing respect the gate; answered questions are not asked again until retake.
4. Base-case questions too: what is `D[i][0]`, and why. Traceback question: which of the three moves comes next (all optimal parents are accepted as optimal, with the tie-break named).
5. `GrowthPanel`: `cells` against n² with |pattern| = |text| = n, and with |pattern| = 8 fixed against n.

**Edge cases and required tests:** both empty; one empty each way; equal strings (distance 0, all-match traceback); single characters equal and different; complete mismatch; repeated letters ("aaa" / "aa"); a tie in the fill and a tie in the traceback (tie-break obeyed, all parents recorded); spaces, accented letters and an emoji (code points, not UTF-16 halves); over-long input gives a message; `kitten`/`sitting` = 3;
`intention`/`execution` = 5; applying the edit script to pattern yields text and costs exactly `distance` on 300 seeded random pairs; distance equals a memoised recursion on them; symmetric in its arguments; two frames per inner cell, in order; `questionAt` on every frame index of a trace (answers match the next frame; null elsewhere); quiz component tests: gate holds, right answer releases, wrong answer does not, hints, show-me, retake, no leak.

**Acceptance:** a student can take an unseen pair, fill the whole table by quiz, and the tool explains every mistake; switching the quiz off gives a clean trace.

**Stretch:** longest common subsequence or longest increasing subsequence with the same table and quiz; recursion-versus-memo call tree on Fibonacci.

### Packet C: NP reductions — owns `src/modules/reductions/`

Unit 6, lectures 22 to 25. Port 5183.

**Input:** a 3-CNF formula, as text such as `(x1 | !x2 | x3) & (!x1 | x2 | x2)`; also accept `∨ ∧ ¬ ~ -`, `or/and/not`, any letters-plus-digits names. Exactly three literals per clause; repeated literals are legal. A clause with one or two literals is explained, with a button that pads it by repeating a literal. Variables are those that appear, in `compareLabels` order.

**Algorithm** `reductions-3sat-vertex-cover` (view `construct`): for n variables and m clauses build G and k = n + 2m. Variable gadget: an edge x — ¬x. Clause gadget: a triangle with one corner per literal. Cross edges: each corner to its literal. Sizes: 2n + 3m vertices, n + 6m edges. Frames: one per variable gadget, one per triangle, one per cross edge, then k with
the reason for each term (one per variable edge, two per triangle). State carries formula, graph so far, highlights on both sides, k, and running totals. Ops: `vertices`, `edges`, `literals-read`. Claim: Θ(n + m) time. Deterministic layout of your own: variable pairs in a top row, triangles below; size fixed by the input.

**Second algorithm** `reductions-certificates` (view `certificates`), both directions as traces: assignment → cover (true literal of each pair; in each triangle leave out one corner whose literal is true, take the other two) and cover → assignment (counting argument shows one per pair and two per triangle, read off the true literals). Each frame names the edge or clause being justified; a wrong certificate is shown failing at a
specific uncovered edge or unsatisfied clause.

**Features**
1. Formula and graph side by side (stacked at 390 px); hovering, focusing or selecting a clause, literal, vertex or edge highlights its counterpart on the other side, with the mapping in words.
2. Interactive certificates: toggle variables and see the formula, satisfied clauses and the matching cover update; click vertices to choose a cover and see uncovered edges, size against k, and the assignment it induces (or exactly why it induces none).
3. Solver panel, honest about exponential time: enumerate assignments (count shown), say satisfiable or not; for unsatisfiable formulas show, for a chosen assignment, the failing clause and that the corresponding cover attempt needs more than k vertices.
4. A "which way does it go?" panel: reducing 3-SAT **to** Vertex Cover shows Vertex Cover is at least as hard; membership in NP is a separate step (verify a cover in polynomial time); what a reduction in the other direction would and would not show. Short original prose, plus three self-check questions with explanations.
5. Presets: satisfiable, uniquely satisfiable, unsatisfiable (small, with repeated literals), all eight sign patterns on three variables (unsatisfiable), tautological clause, single clause.

**Edge cases and required tests:** empty formula (no clauses: satisfiable, empty graph, k = 0); single clause; repeated literal in a clause; three times the same literal; a clause with x and ¬x; unsatisfiable `(x|x|x) & (!x|!x|!x)`; a variable appearing with one sign only; malformed text (position named), two or four literals; size caps; vertex and edge count formulas on 100 seeded formulas; **brute-force
equivalence**: satisfiable ⇔ a vertex cover of size ≤ k exists, over every formula with n ≤ 2, m ≤ 2 (clauses as literal multisets: 20 of them, so 400 pairs) and 200 seeded formulas with n ≤ 3, m ≤ 3 (at most 15 vertices); no cover smaller than k ever exists; **both certificate maps**: every satisfying assignment maps to a valid cover of size exactly k, every cover of size k maps to a satisfying assignment, and assignment → cover → assignment is the identity;
wrong certificates are refused with the right witness; construction never looks at satisfiability (it is the same code path for both).

**Acceptance:** given a formula, a student can build the graph by hand using the trace, convert certificates both ways, and say why the direction matters.

**Stretch:** 3-SAT → Clique; Vertex Cover ↔ Independent Set ↔ Clique by complement.

### Packet D: sorting and analysis — owns `src/modules/sorting/` and `src/modules/analysis/`

Units 3 and 1; lectures 8, 9 and 2, 3. Port 5184. Two manifests.

**Sorting algorithms** (input `{ items: number[], pivot?: 'last' | 'random' | 'median-of-three', seed? }`; ids `sorting-heapsort`, `sorting-mergesort`, `sorting-quicksort`). Items in state are `{ key, id }`, the id giving original order; equal keys are shown as 5a, 5b. Ops, same ids in all three so that the race is fair: `comparisons` (of keys), `swaps`, `writes` (array or buffer element writes; a swap
is also two writes).
* Heapsort: bottom-up max-heap build, then repeated extraction; show the array and the heap tree together, with the sorted suffix done.
* Mergesort: top-down, stable (left first on ties), buffers drawn; a key in a buffer is *not* also in the array (the slot is an explicit hole), so nothing is duplicated or lost.
* Quicksort: one clearly written partition scheme (Lomuto, first-class invariants drawn: less / not less / unseen / pivot); pivot rule selectable; random pivot from the seed.

`result` is the sorted list of `{ key, id }`. Claims: mergesort Θ(n log n) every case; heapsort Θ(n log n) worst case (Θ(n) build); quicksort Θ(n²) worst case, Θ(n log n) expected with random pivots; space claims (Θ(n) buffers; Θ(1) extra; stack depth Θ(n) worst case).

**Sorting views:** `race` (landing): three lanes, same input, one player, aligned so that one tick is one key comparison (a lane shows its last frame with at most that many comparisons), with a switch to align by recorded step; per-lane counts, finish ranking in words, bars or cells with labels, no lane changes height. `heapsort`, `mergesort`, `quicksort`: `Workbench` each. `recursion-tree`: the call tree of mergesort or
quicksort growing with the trace: node = range and values, active path, returned nodes done; per-level cost totals beside the tree (levels × cost per level is the point); a degenerate quicksort visibly becomes a path. The tree's viewBox is fixed from the finished trace. Inputs: typed list, random (seeded), sorted, reversed, few distinct, all equal, nearly sorted.

**Sorting tests:** empty; single; two in and out of order; duplicates; all equal; already sorted; reversed; negative keys; odd and power-of-two lengths; output is a sorted permutation and equals the built-in sort on 300 seeded lists for all three and all pivot rules; `conserved` ids in every frame of all three; **stability**: mergesort keeps equal keys in original order on 200 seeded lists with many ties, and a pinned counterexample input shows heapsort and
quicksort do not; heap property after the build frame; partition invariant in every partition frame; mergesort comparisons ≤ n⌈lg n⌉ − 2^⌈lg n⌉ + 1; quicksort with last pivot on a sorted list makes exactly n(n−1)/2 comparisons; heap build makes at most 2n comparisons; the same seed gives the same trace; race alignment is a pure tested function; frame cap respected at the UI limit (no truncation at 24 items).

**Analysis views:** `growth-rates` (landing): 1, log n, n, n log n, n², n³, 2ⁿ with toggles, n range, linear / log-log, value table at chosen n, "how big an n in one second at 10⁹ steps per second" table, and dominance order in words; values too large to draw are said, not drawn as a wall. `measured`: every module's experiments gathered with `useModules()` and `loadExperiments()` (`Promise.allSettled`; a module that fails or
has none is skipped with a note), grouped by module, plotted with `GrowthPanel`; plus a comparison plot (`GrowthPlot`, up to 4 series) with the three sorts on the same inputs (these come from the sorting experiments via `useModules`, not by import). `halving`: binary search trace `analysis-binary-search` next to the number of times n can be halved. Own experiments: binary search (best Θ(1), worst Θ(log n)), insertion sort counts (best Θ(n), worst Θ(n²), random Θ(n²)).

**Analysis tests:** binary search: empty, single, missing below / between / above, duplicates (any matching index, stated), unsorted input rejected by its own check with the offending pair; comparisons ≤ ⌊lg n⌋ + 1 (define one three-way comparison as one); insertion sort counts exactly n−1 on sorted and n(n−1)/2 on reversed; ratio columns settle for matching growth and drift for wrong ones (test `ratios` trends on real experiments); gathering experiments survives a rejected loader; tables never show `Infinity` or `NaN`.

**Acceptance:** a student can say, from the screen, why sorted input is quicksort's worst case here, where n log n comes from (levels × work per level), and which curve a measured count follows and how they know.

**Stretch:** bucket sort lane; big-O explorer with draggable c and n₀.

### Packet E: data structures — owns `src/modules/structures/`

Unit 2 (lectures 5, 6) and lecture 8 for heaps. Port 5185.

**Input:** `{ start: ..., operations: Op[] }` typed as text such as `insert 5, delete 3, search 8`, with buttons that append one operation. Operations run as one trace (section 5). Each frame's state has the whole structure, the current operation and its position in the list.

**Algorithms and views**
* `structures-bst` (view `bst`): search, insert, delete on an unbalanced binary search tree. Delete: leaf; one child (splice); two children (replace by in-order successor, then remove it; the successor's key is shown in transit). **Duplicate insert: no change, explained.** Node ids are stable across frames so nodes can be followed; layout by in-order position, fixed viewBox from the whole sequence. Show
  height and n. Ops `comparisons` (one three-way key comparison per visited node), `link-changes`. Claims: Θ(h) worst case per operation; h between ⌊lg n⌋ and n − 1.
* `structures-heap` (view `heap`): binary **min**-heap as tree and array together, linked highlights; insert (sift-up), extract-min (last to root, sift-down), build by sift-down from the last parent, and build by repeated insertion for contrast. Ops `comparisons`, `swaps`. Claims: insert and extract-min Θ(log n) worst case; bottom-up build Θ(n) worst case; repeated insertion Θ(n log n) worst case.
* `structures-hash-chaining` (view `hash-chaining`) and `structures-hash-probing` (view `hash-probing`): table size m from 1 to 13, hash shown as arithmetic, `((k mod m) + m) mod m` so negatives work. Chaining: insert (no duplicates), search, delete. Linear probing: insert, search, delete with **tombstones**; a search passes over tombstones and stops at a never-used slot; an insert must keep looking for a duplicate past the
  first tombstone before reusing it; probe path numbered on the table; live load and used load (with tombstones) shown. Ops `probes` (slots looked at) or `comparisons` (keys in a chain). Claims: expected Θ(1 + α) with simple uniform hashing for chaining; Θ(n) worst case; say the assumption.

**Edge cases and required tests:** BST: insert into empty; delete from empty; delete missing; delete leaf, one left child, one right child, two children (successor is the right child; successor is deeper; successor has a right child); delete the root in each of those cases; delete the only node; duplicate insert; sorted insertions give height n − 1; in-order listing sorted after every operation and equal to a reference set
on 200 seeded sequences; the BST property holds in **every** frame and no key is lost or doubled mid-operation (section 2.2, rule 8). Heap: insert into empty; extract from empty (explained, continues); single; two; duplicates; equal children (tie goes left, said); only a left child; already a heap; reversed; heap property after every completed operation; extraction order sorted; build comparisons ≤ 2n; no key lost or doubled in any frame. Hash: collisions; wrap-around; m = 1; negative keys; duplicates; delete missing; chain
head / middle / tail deletion; insert into a **full** table (explained, unchanged, terminates after m probes); search in a full table for a missing key terminates; tombstone then search past it; tombstone reuse; no duplicate created past a tombstone; a table of only tombstones; results equal a reference set on 200 seeded sequences for both schemes. Parsing: unknown verb, missing key, too many operations: message naming the piece.

`GrowthPanel`s: BST n inserts random Θ(n log n) expected versus sorted Θ(n²); heap build versus repeated insertion (reversed input is the worst case for a min-heap); hashing total probes at load 1/2 as n grows.

**Acceptance:** any operation sequence can be stepped both ways; for every deletion a student can say which case it is and see why order is preserved; tombstones are visibly different from empty slots without colour.

**Stretch:** double hashing; successor / predecessor queries; AVL rotation preview.

---

## 7. Integration (after the packets)

Merge check: `npm run lint && npm test && npm run build`; review each `NOTES.md` and apply contract requests in shared code; browse every view at 1280 px and 390 px; check the analysis `measured` view lists every module's experiments; then decide about publishing (the owner's call; nothing is pushed or deployed by workers).
