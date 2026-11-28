# Analysis (packet D): notes

## Contract change requests

1. **`GrowthPanel` could accept an optional `title`/`heading` and render without its own `.panel` frame** (low priority). The `measured` view puts one `GrowthPanel` per module under
   its own header, and the panel's built-in "Measured counts against theory" heading is repeated for every module. Proposed: `heading?: string` (default as now). Local workaround: none needed; it reads fine.
2. **`GrowthPlot` has no way to start the y axis from a non-zero value or to cap it.** The rates plot in `growth-rates` therefore has its own SVG component (`RatesPlot`), because it needs a
   fixed ceiling with curves cut where they cross it. No change needed unless other modules want the same.

## Deviations and decisions

* **`measured`** gathers every module's experiments with `Promise.allSettled` over `useModules()` (`gatherExperiments`): a rejected or throwing loader, a module without `loadExperiments`, an
  empty list, an invalid experiment (`experimentProblems`) and a repeated id each become a visible note and never an error. The result is tied to the module list it was gathered for, so a module
  that arrives later in the context triggers a fresh gather. Plots per module are collapsed on demand (the first is open) so that many modules do not all measure at once.
* The comparison plot finds the three sorts **by experiment id** (`sorting-heapsort-growth`, `sorting-mergesort-growth`, `sorting-quicksort-growth`), never by import, and offers only the cases and ops all of
  them share. Every sort sees the same list per size (`measureAt` seeds one generator per (seed, n)).
* **Binary search** counts one three-way comparison per probe; the precondition check is a separate op (`order-checks`) so that `comparisons <= floor(lg n) + 1` holds. A valid array shows the check as one
  frame; an unsorted one is rejected at the first out-of-order pair, named in the sentence. With duplicates any matching index may be returned, and the sentence says so when equal keys sit beside it.
* **Insertion sort** (`analysis-insertion-sort`) is a full trace-contract algorithm (hole plus held key, tested with `conserved`) but only feeds the growth experiments; it has no view of its own.
* **growth-rates** never prints a raw `Infinity`/`NaN`: values are formatted from their logarithm (`formatSteps`, `timeAt`), so `2ⁿ` at n = 5000 reads `1.41 × 10¹⁵⁰⁵`. A curve that rises past the chart is
  cut at the exact crossing point, named above the chart, and listed under it with the n where it leaves and the value it would reach.
* The "how big an n" table uses 10⁹ steps per second and a selectable budget. For one year (3.15 × 10¹⁶ steps) floating-point precision limits the boundary to roughly 15 digits.

## Phase 4 changes

* **Binary search guard (R3).** The `check` line reads "check A is sorted (input guard for this page, Θ(n): real binary search assumes it)". Both time claims say "comparisons in the search loop".
  The Halving view says that the order check costs n − 1 comparisons and is there only to refuse unsorted input.
* **Growth rates (R8).** The dominance list says "grows slowest", "grows fastest" and "grows faster than the one before it".
* **Measured and the worked example (R14).** Measured will stop counting the worked example once the shell filters it out of `useModules()` (packet F, `App.tsx`). No change is needed in this module.

## Not done (stretch)

Big-O explorer with draggable c and n0.
