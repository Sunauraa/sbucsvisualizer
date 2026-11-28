# Sorting (packet D): notes

## Contract change requests

None. Everything needed was in `@core` and `@ui`.

## Deviations and decisions

* **Half-open ranges.** Calls work on `A[lo..hi-1]` (`hi` exclusive) in both mergesort and quicksort, so a call on one item is `hi - lo = 1`.
* **Quicksort never draws empty calls.** A call on zero items (for example the right side of a sorted list) has no frame and no tree node, so a
  degenerate run is a clean path of n nodes. The `left`/`right` anchors are lit in the first frame of the child call.
* **Quicksort pivot rules.** `last` (default), `random` (from `seed`, default 373, one generator per run), `median-of-three` (positions lo, middle, hi-1;
  ties go to the earlier position; its 2 or 3 key comparisons ARE counted; ranges of fewer than 3 items use the last item). The chosen pivot is swapped to `hi-1`
  (a counted swap unless it is already there). `Lomuto` uses strict `<`, so keys equal to the pivot stay in the "not less" zone.
* **Frame invariant for the partition.** `store` and `j` are always the boundaries of the zones: `lo..store-1` less, `store..j-1` not less, `j..hi-2` unseen.
  A key that turns out to be less keeps `j` on itself in the compare frame and moves `j` in its swap frame, so the invariant holds in EVERY frame (tested).
* **Mergesort buffer.** One buffer with the same positions as the array. The merge copies the whole range out (holes in the array), then each item
  moves back exactly once (hole in the buffer). Writes are therefore 2 per item per merge, with no swaps. The `conserved` test counts array plus buffer.
* **Heapsort.** `settled` is true only when the heap property holds on the whole heap (after the build and after each finished sift in the extraction
  phase); it is false during the build, where only subtrees are heaps. Unlit anchors by design: `extract-loop`, `sift-head`, `children` (loop header, function header, arithmetic).
* **Stability.** Mergesort is stable. Pinned counterexamples: heapsort on `[2, 2, 1]`, quicksort (last pivot) on `[2, 1, 1]`.
* **Race.** One tick is one key comparison by default: a lane shows its last frame with at most that many comparisons (`laneIndex`, pure and tested).
  A lane with no comparisons at all (n < 2) is finished at tick 0. The alternative aligns by recorded step. The ranking uses competition ranking (1st, 1st, 3rd) with ties named.
* **Input limit.** 24 items in every sorting view (traces stay below 1000 frames at 24 items for every pivot rule: tested, no truncation).
* **Growth experiments** (`sorting-heapsort-growth`, `sorting-mergesort-growth`, `sorting-quicksort-growth`): all three build their input with the same `sortInputFor`
  (distinct keys), so on one seed and size the three sorts see the same list. The analysis module finds them by those ids through `useModules()`.
  Quicksort has two extra cases (`sorted-random-pivot`, `sorted-median`) that only its own panel shows.
* The recursion-tree view's per-level table counts comparisons made by each call's *own* work (a merge or a partition), so the levels add up to the total.
* A non-finite key (NaN, Infinity) cannot be typed in the UI, but `run()` rejects it with a sentence instead of throwing.

## Phase 4 changes

* **`carryParams`** is `a`, `kind`, `n`, `seed`, `pv`, `ps`. Every view reads them through `useSortSetup`, so a list typed or generated in one view is the list in the next (R2).
* **Wording (R4, R5).** The reversed-input claim says every pivot is the smallest or largest key of its range (the last-item pivot alternates between the two on `[5,4,3,2,1]`).
  The quicksort notes say that keys equal to the pivot go right, so equal keys are Θ(n²) for every pivot rule. Measured at n = 24: last and random pivot 276 comparisons;
  median of three 320 (276 plus 2 per range of three or more items, 44 in all, for choosing the median), so it does not help.
* **Test speed (R21).** `sampledRenderer.tsx` is a test helper that draws the first frame, the last and every 4th. The views test draws one preset per sort in full and the rest sampled,
  and the 24-item test draws every frame of the last-item array view. `sorts.test.ts` runs the contract check on 8 lists instead of 25 (the 300-list loops already use `counts` mode).

## Not done (stretch)

Bucket sort lane; big-O explorer with draggable c and n0.
