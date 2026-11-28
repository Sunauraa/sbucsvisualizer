import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'analysis',
  views: [
    {
      id: 'growth-rates',
      title: 'Growth rates',
      summary: 'The seven standard growth curves side by side, with values at a chosen n and how big an n fits in a time budget.',
      lectures: [2, 3],
      load: () => import('./GrowthRatesView'),
    },
    {
      id: 'measured',
      title: 'Measured counts',
      summary: 'Operation counts from every module, plotted against theory, and the three sorts compared on the same inputs.',
      lectures: [2, 3],
      load: () => import('./MeasuredView'),
    },
    {
      id: 'halving',
      title: 'Halving: binary search',
      summary: 'Binary search step by step, next to how many times n can be halved: where log n comes from.',
      lectures: [3],
      load: () => import('./HalvingView'),
    },
  ],
  loadExperiments: () => import('./algorithms/experiments'),
};

export default manifest;
