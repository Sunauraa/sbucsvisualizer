import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'sorting',
  views: [
    {
      id: 'race',
      title: 'Race: heapsort, mergesort, quicksort',
      summary: 'Three sorts on the same input, one tick per key comparison, with live counts and a finishing order.',
      lectures: [8, 9],
      load: () => import('./RaceView'),
    },
    {
      id: 'heapsort',
      title: 'Heapsort',
      summary: 'The array and the heap tree together: build a max-heap, then extract the maximum again and again.',
      lectures: [8],
      load: () => import('./HeapsortView'),
    },
    {
      id: 'mergesort',
      title: 'Mergesort',
      summary: 'Top-down mergesort with its buffer drawn: a key is in the array or in the buffer, never both.',
      lectures: [9],
      load: () => import('./MergesortView'),
    },
    {
      id: 'quicksort',
      title: 'Quicksort',
      summary: 'Lomuto partitioning with the less, not-less and unseen zones drawn, and a choice of pivot rule.',
      lectures: [9],
      load: () => import('./QuicksortView'),
    },
    {
      id: 'recursion-tree',
      title: 'Recursion tree',
      summary: 'The call tree of mergesort or quicksort as it grows, with the cost of every level beside it.',
      lectures: [9],
      load: () => import('./RecursionTreeView'),
    },
  ],
  loadExperiments: () => import('./algorithms/experiments'),
};

export default manifest;
