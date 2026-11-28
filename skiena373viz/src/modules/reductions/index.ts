import type { ModuleManifest } from '@core';

/** Keep index.ts tiny: no algorithm or component imports, only lazy loaders. */
const manifest: ModuleManifest = {
  id: 'reductions',
  // The formula follows the learner between views; view-specific keys (a, s, dir) do not.
  carryParams: ['f'],
  views: [
    {
      id: 'construct',
      title: 'Build the graph',
      summary: 'Turn a 3-CNF formula into a graph and a bound k, one gadget at a time, with the formula and the graph side by side.',
      lectures: [22, 23, 24],
      load: () => import('./ConstructView'),
    },
    {
      id: 'certificates',
      title: 'Certificates',
      summary: 'Convert a satisfying assignment into a vertex cover of size k and back, and see wrong certificates fail at a specific edge or clause.',
      lectures: [23, 24],
      load: () => import('./CertificatesView'),
    },
    {
      id: 'solver',
      title: 'Solver',
      summary: 'Try every assignment, see how many satisfy, and see why an unsatisfiable formula gives a graph with no cover of size k.',
      lectures: [24, 25],
      load: () => import('./SolverView'),
    },
    {
      id: 'direction',
      title: 'Which way does it go?',
      summary: 'Why a reduction from 3-SAT to Vertex Cover shows hardness, what it does not show, and three self-check questions.',
      lectures: [22, 25],
      load: () => import('./DirectionView'),
    },
  ],
  loadExperiments: () => import('./algorithms/experiments'),
};

export default manifest;
