// Runs every regression check in sequence. One command for CI and for
// pre-deploy sanity: any non-zero exit fails the whole run.
const { execFileSync } = require('child_process');
const path = require('path');

const CHECKS = [
  ['B-1 tap batching (pure logic)', path.join(__dirname, '..', 'selfcheck-tapbatch.js')],
  ['B-1 tap flow (end to end)',     path.join(__dirname, '..', 'tapflow-check.cjs')],
  ['B-2/B-3/B-4 lifecycle',         path.join(__dirname, 'lifecycle-check.cjs')],
  ['B-5/B-7 persistence',           path.join(__dirname, 'persistence-check.cjs')],
  ['MV-3 delete schedule',          path.join(__dirname, 'admin-delete-check.cjs')],
  ['MV-1 school logos',             path.join(__dirname, 'school-logo-check.cjs')],
];

let failed = 0;
for (const [name, file] of CHECKS) {
  console.log(`\n=== ${name} ===`);
  try {
    execFileSync(process.execPath, [file], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch {
    console.error(`FAILED: ${name}`);
    failed++;
  }
}
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
