// Checks one module without being blocked by a neighbour's half-finished work:
//   npm run check -- graphs            (one or more module names)
// Lints and tests only those folders, and shows only type errors in them (or in shared code).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const names = process.argv.slice(2);
const usage = 'usage: npm run check -- <module> [module...]   e.g. npm run check -- graphs';
if (names.length === 0 || names.some((name) => !/^[a-z]+$/.test(name))) {
  console.error(usage);
  process.exit(2);
}
const dirs = names.map((name) => `src/modules/${name}`);
for (const dir of dirs) {
  if (!existsSync(`${root}${dir}`)) {
    console.error(`${dir} does not exist.\n${usage}`);
    process.exit(2);
  }
}

const bin = (name) => `${root}node_modules/.bin/${name}`;
const run = (name, args, stdio = 'inherit') => spawnSync(bin(name), args, { cwd: root, stdio, encoding: 'utf8' });
let failed = false;

console.log(`\n== lint ${dirs.join(' ')}`);
if (run('eslint', ['--max-warnings', '0', ...dirs]).status !== 0) failed = true;

console.log('\n== typecheck (errors in your folders and in shared code)');
const tsc = run('tsc', ['--noEmit', '--pretty', 'false'], 'pipe');
const lines = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.split('\n').filter(Boolean);
const foreign = new RegExp(`^src/modules/(?!(${names.join('|')})/)`);
let keep = true;
const mine = lines.filter((line) => {
  if (!line.startsWith(' ')) keep = !foreign.test(line);
  return keep;
});
if (mine.length > 0) {
  console.log(mine.join('\n'));
  failed = true;
} else {
  console.log('ok');
}

console.log(`\n== test ${dirs.join(' ')} + shared`);
process.env.CHECK_MODULES = names.join(',');
const tests = run('vitest', ['run', ...dirs.map((dir) => `${dir}/`), 'src/core/', 'src/ui/', 'src/app/']);
if (tests.status !== 0) failed = true;

console.log(failed ? '\nFAILED' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
