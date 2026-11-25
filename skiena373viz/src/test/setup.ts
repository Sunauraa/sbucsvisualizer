// Runs before every test file. Stays cheap in the node environment; adds the DOM matchers and
// cleanup only when a file opted in to jsdom with "// @vitest-environment jsdom".
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
