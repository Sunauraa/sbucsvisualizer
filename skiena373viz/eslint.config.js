import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const MODULES = 'graphs|dp|reductions|sorting|analysis|structures|example';

const noCrossModule = {
  regex: `^(\\.\\./)+(modules/)?(${MODULES})(/|$)`,
  message: 'Modules may not import each other. Share through @core / @ui, or ask in your NOTES.md.',
};
const noDeepApp = {
  regex: '^(\\.\\./)+(core|ui|app|test)(/|$)',
  message: 'Use the @core and @ui aliases; src/app is private to the shell.',
};

export default tseslint.config(
  { ignores: ['dist', 'dist-*', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noCrossModule, noDeepApp] }] },
  },
  {
    // Pure zone: the contract, and every module's algorithms/ folder. No React, no DOM, no clocks,
    // no unseeded randomness. This is what "trace-first" means in practice.
    files: ['src/core/**/*.ts', 'src/modules/*/algorithms/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
        'requestAnimationFrame', 'setTimeout', 'setInterval', 'performance', 'fetch',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use createRng(seed) from @core.' },
        { object: 'Date', property: 'now', message: 'Algorithms must be deterministic.' },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react-dom/*'], allowTypeImports: true, message: 'Pure zone: no React.' },
            { group: ['@ui', '@ui/*'], allowTypeImports: false, message: 'Pure zone: no UI imports.' },
            { group: ['*.css'], message: 'Pure zone: no styles.' },
            noCrossModule,
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'no-restricted-globals': 'off' },
  },
);
