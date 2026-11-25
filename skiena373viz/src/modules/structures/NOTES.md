# Structures (packet E): notes

## Contract change requests

None. Everything needed was in `@core` and `@ui`.

## Decisions and deviations (so the integrator does not have to rediscover them)

* **Input shape.** `start` is a list of keys; operations are text such as `insert 5, delete 3`. Limits: 24 operations, keys -99 to 999, and (my addition) at most 16 starting keys. Parsing lives in `algorithms/operations.ts` and `inputs.ts`; every message names the piece at fault.
* **BST starting keys** are inserted in the order given without frames (duplicates ignored, and frame 0 says so). Node ids are `n1, n2, ...` in creation order and a key keeps its id for life.
* **BST two-child delete.** The successor *node* (id and all) is lifted out (`held`), then linked into the deleted node's place; the deleted key leaves in the last frame (event `remove`). So keys in the tree plus the key in transit change only at an `insert` or `remove` frame, as rule 8 asks.
* **BST ops.** `comparisons` is one three-way comparison per visited node on the walk; the walk to the successor compares no keys. `link-changes` counts every child or root pointer assignment: insert 1, leaf 1, one child 1, two children 4 (lift 1, parent to successor 1, successor's two children 2).
* **Heap.** `start` is taken literally and need not be a heap. `insert` and `extract` on an array that is not a heap are refused with a sentence (the check is not counted); `build` (sift-down from the last parent) and `rebuild` (empty the heap, insert the keys in array order) work on any array. Extract holds the minimum in `held` until the final frame; `rebuild` keeps waiting keys in `pending`. Ties: the smaller child wins, the left child on equal keys; a key swaps only when strictly smaller than its parent.
* **Chaining.** New keys go to the end of the chain (insert already walks the whole chain to rule out a duplicate). Only `comparisons` is counted.
* **Probing.** Delete always leaves a tombstone (it never turns a slot back to empty), so used load only grows until a tombstone is reused. Starting keys use the same probing rule; keys that do not fit are dropped and said so. A tombstone does not remember the deleted key.
* **Table size.** The algorithms accept any whole size of at least 1 (the growth experiments use 2n slots); the views cap it at 13. A size below 1 is rejected by the algorithm itself.
* **Probing table layout** wraps at 7 slots per row (so 13 slots fit a phone); the picture says "home" under the first slot probed and numbers the probe path.
* **Mobile check.** At 390 px I used Chrome DevTools device emulation (`Emulation.setDeviceMetricsOverride`, 390 wide) rather than an iframe, because it reproduces the same viewport width.

## Stretch

Not done: double hashing, successor/predecessor queries, AVL rotation preview.
