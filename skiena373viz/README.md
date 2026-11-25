# Skiena373Viz

Interactive, step-by-step algorithm traces for studying CSE 373 (Analysis of Algorithms): analysis, data structures, sorting,
graphs, dynamic programming and NP reductions. Static site, no backend. TypeScript, React, Vite, SVG.

**Independent study aid.** Not affiliated with, or endorsed by, Stony Brook University or Prof. Steven Skiena. Explanations and
pseudocode are original; nothing is copied from the textbook, the lecture slides or other visualizers.

## Run

Needs Node 22.12 or newer.

```
npm ci
npm run dev        # development server
npm test           # all tests
npm run lint
npm run build      # typecheck, then build into dist/
npm run preview    # serve dist/
npm run check -- graphs   # lint + types + tests for one module and the shared code
```

How it is put together, and how to add a module: [PLAN.md](PLAN.md).

## Deploy to GitHub Pages

`npm run build` produces `dist/`, which uses relative URLs and hash routes, so it works from any subpath without rewrite rules
(`dist/.nojekyll` is included). Publish the contents of `dist/` as the Pages source, for example as the root of a `gh-pages` branch or of
a separate repository. Set `VITE_BASE=/some/path/` at build time only if absolute asset URLs are needed. There is no CI; deploys
are manual. The parent repository's Vercel site ignores this folder (`.vercelignore`).

## Third-party licences

Shipped in the build: React and React DOM (MIT); d3-force, d3-dispatch, d3-quadtree, d3-timer (ISC). Build and test only: Vite,
Vitest, ESLint, typescript-eslint, jsdom, Testing Library, DefinitelyTyped types (MIT); TypeScript (Apache-2.0); Lightning CSS, used by
Vite (MPL-2.0).
