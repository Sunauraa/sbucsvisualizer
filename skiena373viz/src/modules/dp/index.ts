import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'dp',
  views: [
    {
      id: 'edit-distance',
      title: 'Edit distance',
      summary: 'Fill the table cell by cell with dependency arrows, trace the edits back, or switch on quiz mode and predict each step.',
      lectures: [18, 19, 21],
      load: () => import('./EditDistanceView'),
    },
  ],
  loadExperiments: () => import('./algorithms/editDistance'),
};

export default manifest;
