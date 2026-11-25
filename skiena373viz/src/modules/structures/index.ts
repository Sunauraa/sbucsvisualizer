import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'structures',
  views: [
    {
      id: 'bst',
      title: 'Binary search tree',
      summary: 'Search, insert and delete on an unbalanced tree, with the three delete cases and the successor in transit.',
      lectures: [5],
      load: () => import('./BstView'),
    },
    {
      id: 'heap',
      title: 'Heap',
      summary: 'A min-heap as a tree and an array: insert with sift-up, extract-min with sift-down, and two ways to build.',
      lectures: [8],
      load: () => import('./HeapView'),
    },
    {
      id: 'hash-chaining',
      title: 'Hashing: chaining',
      summary: 'Keys that collide share a chain; the hash is shown as arithmetic, so negative keys work.',
      lectures: [6],
      load: () => import('./HashChainingView'),
    },
    {
      id: 'hash-probing',
      title: 'Hashing: linear probing',
      summary: 'Open addressing with tombstones: a search passes over them, an insert checks for a duplicate before reusing one.',
      lectures: [6],
      load: () => import('./HashProbingView'),
    },
  ],
  loadExperiments: () => import('./algorithms/experiments'),
};

export default manifest;
