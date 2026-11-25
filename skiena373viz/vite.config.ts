import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative by default, so the build works at any subpath (GitHub Pages project sites included).
  // Override with VITE_BASE=/some/path/ only if absolute asset URLs are needed.
  base: process.env['VITE_BASE'] ?? './',
  // Parallel dev servers must not share an optimiser cache: give each its own VITE_CACHE_DIR.
  cacheDir: process.env['VITE_CACHE_DIR'] ?? 'node_modules/.vite',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@core$/, replacement: at('./src/core/index.ts') },
      { find: /^@core\//, replacement: at('./src/core/') },
      { find: /^@ui$/, replacement: at('./src/ui/index.ts') },
      { find: /^@ui\//, replacement: at('./src/ui/') },
    ],
  },
  test: {
    // Pure algorithm tests stay in node (fast). Component tests start with
    // the docblock: // @vitest-environment jsdom
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 5000,
  },
});
