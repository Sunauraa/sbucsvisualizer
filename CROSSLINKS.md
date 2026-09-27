# CSE 214 → CSE 373 crosslinks (to do)

CSE 373 gets its own pages, even where CSE 214 already covers the topic. Once a CSE 373 module is built, add a
"Going further in CSE 373 →" link from the matching CSE 214 page (and a "Review in CSE 214" link back).

The CSE 373 file names are planned names, so check them when the module is built. Tick a row once both links are in.

| CSE 214 page | CSE 373 module (unit · lectures) | Planned 373 file | What overlaps | Done |
|---|---|---|---|---|
| `cse214/arrays.html` | Elementary Structures & Dictionaries (U2 · L4–5) | `cse373/dictionaries.html` | arrays vs linked lists, dynamic array growth | ☐ |
| `cse214/stacks-queues.html` | Elementary Structures & Dictionaries (U2 · L4) | `cse373/dictionaries.html` | stacks, queues | ☐ |
| `cse214/trees.html` | Elementary Structures & Dictionaries (U2 · L5) | `cse373/dictionaries.html` | BST search/insert/delete, balanced (AVL) trees | ☐ |
| `cse214/hashtables.html` | Hashing (U2 · L6) | `cse373/hashing.html` | chaining, open addressing, load factor | ☐ |
| `cse214/priority-queues.html` | Heapsort, Mergesort, Quicksort, Binsort (U3 · L8) | `cse373/sorting.html` | heaps, heapify, heapsort | ☐ |
| `cse214/priority-queues.html` | Shortest Paths (U4 · L14) | `cse373/shortest-paths.html` | the heap behind Dijkstra (and Prim) | ☐ |
| `cse214/sorting.html` | Heapsort, Mergesort, Quicksort, Binsort (U3 · L8–9) | `cse373/sorting.html` | heap, merge, quick and counting sort | ☐ |
| `cse214/graphs.html` | Graph Traversal (U4 · L10–12) | `cse373/graph-traversal.html` | adjacency matrix/list, BFS, DFS, discovery/finish times, edge types | ☐ |
| `cse214/recursion.html` | Asymptotics & Logarithms (U1 · L3) | `cse373/asymptotics.html` | binary search halving → log n | ☐ |
| `cse214/recursion.html` | Backtracking (U5 · L16) | `cse373/backtracking.html` | permutations, recursion tree as a search tree | ☐ |
| `cse214/recursion.html` | Dynamic Programming (U5 · L18) | `cse373/dp.html` | Fibonacci: plain recursion vs memo vs bottom-up table | ☐ |

Once a row is done, also turn its CSE 373 card from a `div.card.planned` into an `a.card` in `cse373/index.html`.
