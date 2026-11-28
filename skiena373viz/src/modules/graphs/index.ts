import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'graphs',
  // The graph, its two switches, the start vertex and the vertex positions follow the learner between views.
  carryParams: ['g', 'd', 'w', 's', 'p'],
  views: [
    {
      id: 'bfs',
      title: 'Breadth-first search',
      summary: 'Explore level by level with a queue, and restart in every component.',
      lectures: [10, 11],
      load: () => import('./BfsView'),
    },
    {
      id: 'dfs',
      title: 'Depth-first search',
      summary: 'Follow edges deep with a call stack, with entry and exit times and every edge classified.',
      lectures: [11, 12],
      load: () => import('./DfsView'),
    },
    {
      id: 'topological-sort',
      title: 'Topological sort',
      summary: 'Order a directed acyclic graph by reversing depth-first finish order; a cycle stops the run and is named.',
      lectures: [12],
      load: () => import('./TopologicalSortView'),
    },
    {
      id: 'prim',
      title: "Prim's algorithm",
      summary: 'Grow a minimum spanning tree from one vertex with a priority queue.',
      lectures: [13],
      load: () => import('./PrimView'),
    },
    {
      id: 'kruskal',
      title: "Kruskal's algorithm",
      summary: 'Sort the edges and keep each one that joins two components, tracked by a union-find forest.',
      lectures: [13],
      load: () => import('./KruskalView'),
    },
    {
      id: 'dijkstra',
      title: "Dijkstra's algorithm",
      summary: 'Shortest paths from one vertex, finalizing vertices in order of distance.',
      lectures: [14],
      load: () => import('./DijkstraView'),
    },
  ],
  loadExperiments: () => import('./algorithms/experiments'),
};

export default manifest;
