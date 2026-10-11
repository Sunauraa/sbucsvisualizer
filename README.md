# DSA Visualizer: CSE 214 / CSE 373

Interactive data structure and algorithm visualizers. Pure static HTML/CSS/JS: no build step, no
dependencies, no framework. Drop it on GitHub Pages and it works.

**Live pages:** `index.html` → course picker → CSE 214 → eight modules.

## What's built

| Module | File | Contents |
|---|---|---|
| Arrays & Lists | `cse214/arrays.html` | fixed array; dynamic array with ×2 (geometric) vs +2 (arithmetic) growth and a capacity history; 2-D array with row-major memory layout; singly, doubly and circularly linked lists |
| Recursion | `cse214/recursion.html` | call stack (one card per frame, with its variables and what it waits on) + recursion tree for 8 functions, each with an iterative version and a side-by-side mode; the trace rebuilds as you type, negative inputs run the error checks |
| Stacks, Queues & Deques | `cse214/stacks-queues.html` | array stack; plain array queue; circular array queue (with ring view); circular deque; side-by-side plain-array vs circular queue; bracket checker; postfix evaluator; LIFO / FIFO definitions |
| Trees | `cse214/trees.html` | four traversals and recursive height / size with a live call stack; BST insert/search/delete as loops or as recursion, predecessor / successor, two-child delete by successor or predecessor; AVL with all four rotation cases; (2,4)-trees; B-trees of order 3–7 |
| Priority Queues | `cse214/priority-queues.html` | unsorted list, sorted list, array-based heap, linked tree-based heap; bottom-up heapify vs build-by-insertion; PQ-sort as selection / insertion / heap sort |
| Hash Tables | `cse214/hashtables.html` | separate chaining, linear probing, quadratic probing; load factor, tombstones, rehashing; integer and string keys |
| Graphs | `cse214/graphs.html` | click-to-build graph editor (add/delete, drag vertices in any mode, even mid-traversal, directed toggle, 7 presets); BFS with live queue; DFS with live stack and discovery/finish times; DFS forest; synchronised adjacency matrix and list |
| Sorting | `cse214/sorting.html` | bubble, selection, insertion, heap, merge, quick, two-third and counting sort; negative and decimal values (bars grow down from a zero line) |

Every module shares the same layout: tabs → toolbar → **code dock** (worst-case time/space badge, spec, the class
the method belongs to, and the running line highlighted in pseudocode or Java) → stage → player → legend → notes →
LeetCode practice.

The code dock starts **collapsed**: a newcomer sees only the running operation's name and its time/space badge.
"show code" opens the spec, class and listing, and that choice is remembered from page to page (`localStorage`
key `dsa.codeHidden.v3`). The side-by-side comparison panes always show their code.

Inputs take negative and decimal numbers. Java listings use `double` for stored values (indices stay `int`); where
the Java parameter is an `int` (recursion's n, hash-table keys, counting sort keys) a decimal is rejected with a
message saying why, and counting sort runs its own "not an integer" error branch.

CSE 373 (`cse373/index.html`) is a placeholder listing the planned modules.

## How it works

Every visualizer uses the same pattern, which lives in `assets/js/core.js`:

1. The algorithm runs **to completion** and records a *frame* at each interesting step
   (`DSA.Recorder`). A frame is a plain object: a snapshot of the data plus a caption.
2. A `DSA.Player` scrubs that frame list, play/pause, step forward *and back*, speed 0.35×–4×,
   drag the timeline anywhere. The step controls stay **hidden until the reader runs something** (an operation
   button, a function or algorithm tab, or an edited input); loading a single still frame (page load, tab switch,
   clear) hides them again, and the keyboard shortcuts only work while they are shown.
3. A per-module `render(frame)` paints the current frame.

Recording up front (instead of animating live) is what makes stepping backwards and scrubbing
free. Keyboard: <kbd>space</kbd> play/pause, <kbd>←</kbd>/<kbd>→</kbd> step.

### Code listings

A frame may carry `code` (which listing) and `line` (which line). Listings are plain text in two languages,
pseudocode and Java; a line ending in `@@name` is an anchor, and `highlight("name")` lights every line with that
anchor in whichever language is showing, so the languages never need index maps. Rules every module follows:

- a frame names only the line(s) actually executing in that step (an array such as `["dec", "put"]` lights several);
- `"name^"` lights just the first line with that anchor, i.e. the condition of an `if`/`while` whose body did
  not run ("not the base case", "there is room");
- if/else branches get separate anchors, so only the branch taken lights up;
- a step lists every check it evaluates, including the ones that fail: `["loop", "found^", "goL"]` is "n is not
  null, k ≠ n.key, k < n.key, so go left";
- `Rec.at()` persists, so a summary frame after the last step must call `.at(null)` explicitly;
- the final "done" frame uses `line: null` and clears the highlight;
- every listing must carry the same set of anchors in both languages, and every anchor must be reachable from
  some input (both checked by the test harness).

### Specs, classes, calls and practice

- **Spec box.** Every listing carries a `spec` (`does`, `params`, `returns`, `errors`, `time`, `space`), attached
  with `D.specs(CODE, {...})` and shown above the code. `time` and `space` are **worst-case** bounds written with
  O (no Θ/Ω, no amortized bounds); text after ": " is the explanation, and the part before it is shown as a badge
  in the dock header so it stays visible when the code is hidden.
- **Classes.** `D.classes(CODE, [{ name, pseudo, java, note, keys }])` attaches the class a method belongs to
  (fields, constructor, and a full `Node` class for linked structures). The dock shows it above the method with a
  short "how objects work" note written with the page's own names (`list.addFirst(…)`, `this.head`). A listing
  shared by two tabs can have its `cls` reassigned when the tab changes.
- **Call line.** The dock writes the call in the selected language from each listing's first line (its signature),
  e.g. `double x = arr.remove(2);` / `x ← remove(2)`. A Java method without `static` is called on the receiver
  (`stack.push(5)`); a `static` one is called bare. Values come from the operation's opening caption
  (`<b>remove(2)</b>: …`), from the page's `args` hook (Recursion reads its input boxes), or from `callVals` defaults;
  otherwise the parameter names are shown. Pass `recv` to `CodeDock` to name the object (`arr`, `list`, `stack`, …).
- **Call stacks.** `D.callStack(frames, opts)` draws one card per stack frame (label, variables, what it is
  waiting on, the value it returns). Recursion and the recursive tree operations use it.
- **LeetCode practice.** Each page registers `D.Practice({ part: { label, items } })` and calls `D.practiceShow(part)`
  when the tab changes; the panel appears under the visualizer. Every problem's number, title, difficulty and free
  status was checked against LeetCode.
- **Hash tables with String keys.** The *keys* switch picks Integers or Strings. String mode uses `String` / `equals`
  versions of every listing and steps through `hash(s)` (h = 31·h + code(c), the same value as Java's
  `String.hashCode`) before each operation.

### Errors and edge cases run for real

Toolbars only reject input that is not a number. An out-of-range index, a pop from an empty stack or a put into a
full table runs the operation, lights the listing's own check line (`if i < 0 or i ≥ n: error`) and explains the
error in the caption; the structure is left unchanged.

### What the stage shows mid-operation

A value never disappears between two steps. Renderers decide which slots are live from the data itself (a slot
holding a value is live, and every removal clears its slot), not from a size counter that the code updates a line
later. A key that is between two structures (PQ-sort moving a key from S to P) is drawn in an "in transit" slot.


```js
const CODE = {
  push: {
    title: "push(x)",
    pseudo: ["push(x):", "  t ← t + 1 @@inc", "  S[t] ← x @@write"],
    java:   ["void push(double x) {", "  t++; @@inc", "  data[t] = x; @@write", "}"],
  },
};
const dock = D.CodeDock("#code", CODE);                       // sits above the stage
const player = new D.Player({ mount: "#player", render, code: dock });
const r = D.Rec(() => snapshot());                           // recorder that tags frames
r.code("push").at("inc").snap({ note: "t ← t + 1" });
```

```
index.html              course picker
cse214/*.html           the eight modules
cse373/index.html       planned
assets/css/style.css    one stylesheet for everything
assets/js/core.js       player, recorder, code dock (spec, class, call line), call-stack cards, cells/heap-tree drawing, tabs, compare helper
assets/js/*.js          one file per module
```

All paths are relative, so the site works from a repository subpath
(`username.github.io/repo/`) as well as from the domain root or a local `file://` open.

## Publishing to GitHub Pages

From this folder:

```sh
git init -b main
git add .
git commit -m "DSA visualizer: CSE 214 modules"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
The site appears at `https://<you>.github.io/<repo>/` within a minute or two.

`.nojekyll` is included so GitHub serves the files as-is.

**After every update, bump the asset version.** Every page loads `style.css` and the scripts as `…?v=202610042131`.
GitHub Pages lets browsers cache files for about 10 minutes, and a new page running next to an old cached
`core.js` breaks. Changing the number makes every browser fetch the matching files:

```sh
NEW=$(date +%Y%m%d%H%M); sed -i '' -E "s/\?v=[0-9]+/?v=$NEW/g" index.html cse214/*.html cse373/index.html
```

## Feedback button

Every page has a **Send feedback** button (top bar and footer) that opens a form in a new tab. To connect it,
open `assets/js/core.js` and paste the Google Form link near the top:

```js
DSA.FEEDBACK_URL = "https://docs.google.com/forms/d/e/…/viewform";
DSA.FEEDBACK_PAGE_FIELD = "";   // optional, see below
```

Until the link is set, the button tells readers the form isn't connected yet.

Optional: to have the form pre-filled with where the reader was (e.g. `Trees · CSE 214 · tab: AVL (balanced) ·
running: insert(k) · AVL`), add a short-answer question such as "Where were you?", then in the form editor use
**⋮ → Get pre-filled link**, type anything into that question, click **Get link**, and copy the
`entry.123456789` part of the copied link into `FEEDBACK_PAGE_FIELD`.

## Extending it

To add a visualizer:

1. Copy any `cse214/*.html` as a starting shell (topbar, `#code`, `#stage`, `#player`, legend).
2. Write `assets/js/yourmodule.js`:

```js
(function () {
  const D = window.DSA;
  const player = new D.Player({ mount: "#player", render: (f) => { /* paint f */ } });
  function run() {
    const R = new D.Recorder(4000);
    R.push({ note: "step one", /* ...state... */ });
    player.load(R.frames, true);
  }
})();
```

Reuse the shared state classes so colours mean the same thing everywhere: `active` (current),
`cmp` (comparing), `swap` (moving), `done` (settled), `visit` (seen), `target` (the answer).

## Testing

Two headless-Chrome scripts drive real clicks on every page:

- **Fuzzer**: every tab, every toolbar button, every select and mode switch, with empty, negative, decimal, zero,
  out-of-range and non-numeric input. It walks every frame and flags: uncaught errors and console errors; a frame
  whose highlighted anchor is missing from its listing in either language; `undefined` / `NaN` / `[object …]`
  reaching the stage or captions; horizontal overflow at a 390 px phone width.
- **Static checks**: every listing has the same anchor set in pseudocode and Java, no other languages, and a spec
  with both `time` and `space`.
- **Scenarios**: scripted sequences (fill a dynamic array until it grows, AVL deletes for each rotation case, hash
  tables filled until probing fails, every recursion function with negative input, counting sort with a decimal …)
  so that, together with the fuzzer, **every anchor of every listing is reached**, error branches included.

Earlier model checks still apply: BST / AVL / (2,4) / B-tree invariants after random operations, all sorts verified
sorted on many input shapes, priority queues and lists against reference models, BFS distances and DFS
parenthesis structure on every preset.
