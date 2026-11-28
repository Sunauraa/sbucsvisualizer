# Reductions (packet C): notes

## Contract change requests

None. Everything needed was in `@core` and `@ui`.

## Deviations and decisions

* Views: `construct` (landing), `certificates`, `solver`, `direction`. The manifest sets `carryParams: ['f']`, so the shell's view tabs keep the
  formula; view-specific keys (`a`, `s`, `dir`) are not carried.
* Ids that appear in URLs (a chosen cover is `s=x1,!x2,c1.1,...`): literal vertex `x1` / `!x1`; corner `cI.J` (clause I, literal J, 1-based);
  edges `var:x1`, `tri:I:A-B`, `cross:I.J`. Documented in `algorithms/gadgets.ts`.
* Formula limits are enforced by the parser (`UI_LIMITS`: 5 variables, 8 clauses, names up to 8 characters), not by the algorithms: the
  construction and its growth experiment run on any size.
* Parser also accepts `&&`, `||`, `^` and bare clauses (without parentheses); every error names a 1-based character position.
* `reductions-3sat-vertex-cover`: `literals-read` counts the three literals read when a triangle is built (cross edges reuse the labels).
  The loop-header anchors `var-loop` and `clause-loop` are never lit (tested).
* `reductions-certificates`: one algorithm, two directions chosen by `direction`. A wrong certificate ends the trace with `reject` at the first
  failing clause (assignment to cover) or the first uncovered edge, or the size, when the cover is too big (cover to assignment). The result
  lists every unsatisfied clause. A failing assignment's attempted cover (all three corners of each failing clause) has exactly k plus the
  number of unsatisfied clauses vertices; this is brute-force tested (`assignmentToCover`, solver view).
* Keyboard: in the construct and solver views the graph is pointer-linked (hover, click) and every vertex or edge has a focusable counterpart
  in the formula panel (clause, literal or variable button), which do the same on focus and Enter. In the cover-to-assignment direction the
  vertices themselves are focusable toggle buttons, with a check box list as a second path.
* Tests: pure-zone tests are in `algorithms/*.test.ts` (brute force: 421 formulas with n <= 2, m <= 2, 200 seeded with n <= 3, m <= 3, every
  satisfying assignment, every cover of size k, 3000 random vertex subsets); view tests in `views.test.tsx` (jsdom).

## Known gaps

* Stretch items (3-SAT to Clique, Vertex Cover / Independent Set / Clique) are not done.
* No "New random formula" button (not required here).
* A formula with more than 5 variables or 8 clauses is refused by the page (message), though the algorithms accept it.
