/** Where each module sits in CSE 373 (Fall 2026 unit plan). Lecture titles are the course's own topics. */
export const LECTURES: Readonly<Record<number, string>> = {
  1: 'Introduction to algorithms',
  2: 'Asymptotic notation',
  3: 'Logarithms and more',
  4: 'Elementary data structures',
  5: 'Dictionary data structures',
  6: 'Hashing',
  7: 'Applications of sorting',
  8: 'Heapsort / priority queues',
  9: 'Mergesort / quicksort / binsort',
  10: 'Data structures for graphs',
  11: 'Breadth-first search',
  12: 'Topological sort / connectivity',
  13: 'Minimum spanning trees',
  14: 'Shortest paths',
  15: 'Exploiting graph algorithms',
  16: 'Combinatorial search',
  17: 'Program optimization',
  18: 'Elements of dynamic programming',
  19: 'Examples of dynamic programming',
  20: 'Limitations of dynamic programming',
  21: 'Dynamic programming review',
  22: 'Reductions',
  23: 'Easy reductions',
  24: 'Harder reductions',
  25: 'The NP-completeness challenge',
};

export interface SyllabusModule {
  readonly id: string;
  readonly unit: number;
  readonly unitTitle: string;
  readonly title: string;
  readonly summary: string;
  readonly lectures: readonly number[];
}

/** The six modules, in course order. A module's id is its folder name under src/modules. */
export const SYLLABUS: readonly SyllabusModule[] = [
  {
    id: 'analysis', unit: 1, unitTitle: 'Foundations', title: 'Analysis', lectures: [2, 3],
    summary: 'Growth rates side by side, and measured operation counts against what theory predicts.',
  },
  {
    id: 'structures', unit: 2, unitTitle: 'Data Structures', title: 'Data structures', lectures: [5, 6, 8],
    summary: 'Search-tree insert and delete, heap sift-up and sift-down, and hash collisions.',
  },
  {
    id: 'sorting', unit: 3, unitTitle: 'Sorting', title: 'Sorting', lectures: [8, 9],
    summary: 'Heapsort, mergesort and quicksort raced on the same input, with the recursion tree.',
  },
  {
    id: 'graphs', unit: 4, unitTitle: 'Graphs', title: 'Graphs', lectures: [10, 11, 12, 13, 14],
    summary: 'Draw a graph, then step through BFS, DFS, topological sort, Prim, Kruskal and Dijkstra.',
  },
  {
    id: 'dp', unit: 5, unitTitle: 'Search & Dynamic Programming', title: 'Dynamic programming', lectures: [18, 19, 21],
    summary: 'The edit distance table with dependency arrows and traceback, plus a quiz mode.',
  },
  {
    id: 'reductions', unit: 6, unitTitle: 'Intractability', title: 'NP-completeness', lectures: [22, 23, 24, 25],
    summary: 'Turn a 3-SAT formula into a graph, and watch solutions map across in both directions.',
  },
];

export const lectureLabel = (n: number): string => `L${n}\u00a0·\u00a0${LECTURES[n] ?? 'unknown lecture'}`;
