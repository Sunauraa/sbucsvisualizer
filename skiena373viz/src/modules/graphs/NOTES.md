# Graphs module (packet A): notes and requests

## Contract change requests

1. **`ModulePage` view links drop the URL parameters** (`viewHref(module, view)` builds `params: {}`), so a graph typed in one
   view would be lost when the learner uses the shell's view tabs. Local workaround: every view shows a "Same graph in:" row of
   links that carry the parameters (`g`, `d`, `w`, `s`, `p`), and `useGraphModel.ts` keeps the latest parameters in a
   module-level variable so that arriving on a view with no parameters restores the graph. Proposal: let a module name URL
   keys to carry over (`ModuleManifest.carryParams?: readonly string[]`), and have `ModulePage` copy those keys into its
   view links.
2. **`GraphView` has a boolean `dashed` only** (`EdgeMark`, `SvgEdge`). DFS needs four distinguishable edge styles (tree solid,
   back dashed, forward dotted, cross dash-dot) so that edge classes never depend on colour. Local workaround:
   `GraphCanvas.tsx` redraws edges with `edgeGeometry` and `arrowPoints` from `@ui` and an `EdgeMark.dash` string. Proposal:
   `EdgeMark.dash?: string` (an SVG dash array) in `GraphView`/`SvgEdge`, plus an optional `halo` flag for "being examined".
   `GraphCanvas` could then be deleted.
3. No other requests. No shared bug found.

## Deviations and decisions

* **Input checks are frames, but not counted.** Prim, Kruskal and Dijkstra start with a `check` frame (directed? weighted?
   negative edge?). A failing check ends the trace as `rejected` with one sentence naming the edge and the reason. The
   check's scan is not added to `edge-checks`, so the counts mean "adjacency entries looked at by the algorithm proper".
* **Mismatches are never repaired silently.** A refused run shows a notice with the algorithm's sentence and one-click buttons
  ("Make the graph undirected", "Make the graph weighted (every weight 1)", "Make the graph directed"); the drawing is changed
  only when the student presses one.
* **Integer weights only** in the editor and the text field (-999 to 999), to keep sums exact. The algorithms accept any
  finite weight; only the UI limits it.
* **Kruskal stops early** once V-1 edges are kept (a `stop` frame says how many edges were skipped); union by size, no path
  compression, so the forest drawn is exactly the data structure.
* **Prim / Dijkstra queues use lazy deletion.** The queue is drawn smallest first; an entry is *stale* when its vertex is already
  final or a smaller key was found later. Stale entries show a ✗, the swap tone and "stale: ..." in the list under the cells.
  Heap comparisons are counted by `heap.ts` (`MinHeap`): one per level on insert; per level on extract-min one to choose the
  smaller child and one against the sinking entry.
* **DFS / topological sort restart order:** the start vertex first (DFS only), then label order. Topological sort ignores the
  start vertex. BFS and DFS number their components / trees.
* **Frame loops:** loop headers (`roots`, `loop`, `scan`, `visit`) are not lit as steps of their own. A frame lights the line
  whose condition decided what happened.
* **Edge direction while examining:** an undirected edge examined from one end gets an arrowhead toward the other end in the
  frame where it is examined, so the sentence "A has the edge A-B" can be followed on the drawing.
* **Positions are part of the input.** Moving a vertex makes a new trace and returns to frame 0 (as every edit does).
  Dragging and arrow-key moves are previewed locally and committed on release (arrow keys after 350 ms of quiet), so the URL is
  written at a sane rate.
* **Growth:** sparse (E = 2V) and dense (complete graph) for all six algorithms, n = V. Kruskal's dense case claims only Ω(n²)
  for sort comparisons, because a merge sort makes about E log E of them and the plot has no n² log n curve.
* Stretch items (Kahn's algorithm, component colouring, two-colouring, adjacency matrix panel) are not done.
