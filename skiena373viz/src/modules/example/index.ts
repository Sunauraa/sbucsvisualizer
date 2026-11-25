import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'example',
  views: [
    {
      id: 'linear-search',
      title: 'Linear search',
      summary: 'The smallest complete trace: one array, one pointer, one counter.',
      lectures: [1, 2],
      load: () => import('./LinearSearchView'),
    },
  ],
  loadExperiments: () => import('./algorithms/linearSearch'),
};

export default manifest;
