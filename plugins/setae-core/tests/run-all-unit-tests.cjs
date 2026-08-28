/**
 * Run every first-party JS/PHP unit test in an isolated process.
 * No dependencies are downloaded and no browser/server is launched.
 * PHP_BIN can point to a portable PHP binary when php is not on PATH.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspace = path.resolve(__dirname, '../../../..');
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.join(workspace, 'release-evidence/v1.0.248');
const php = process.env.PHP_BIN || 'php';
const phpProbe = spawnSync(php, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
const phpAvailable = !phpProbe.error && phpProbe.status === 0;
const results = [];

function run(name, binary, args, cwd) {
  const start = Date.now();
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const status = result.status === 0 && !result.error ? 'PASS' : 'FAIL';
  const entry = { name, status, durationMs: Date.now() - start, exitCode: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message || '' };
  results.push(entry);
  console.log(`${status} ${name}`);
  if (status === 'FAIL') console.error((entry.stderr || entry.stdout || entry.error).slice(0, 4000));
}

for (const name of fs.readdirSync(__dirname).filter((name) => /-unit\.(?:js|php)$/.test(name)).sort()) {
  if (name.endsWith('.php') && !phpAvailable) {
    results.push({ name: `plugin/${name}`, status: 'NOT RUN', reason: `PHP runtime unavailable. Set PHP_BIN to an installed binary. ${phpProbe.error?.message || phpProbe.stderr || ''}` });
    console.log(`NOT RUN plugin/${name} (PHP runtime unavailable)`);
    continue;
  }
  run(`plugin/${name}`, name.endsWith('.php') ? php : process.execPath, [path.join(__dirname, name)], path.dirname(__dirname));
}

const gui = path.join(workspace, 'setae-gui-v2');
if (fs.existsSync(path.join(gui, 'tests'))) {
  const names = fs.readdirSync(path.join(gui, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort();
  for (const name of names) run(`gui/${name}`, process.execPath, ['--test', path.join(gui, 'tests', name)], gui);
}

const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT RUN'].map((status) => [status, results.filter((result) => result.status === status).length]));
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'All first-party plugin *-unit.js / *-unit.php and setae-gui-v2 *.test.mjs. Each file executes separately; vendor and browser suites are not included.',
  nodeVersion: process.version,
  phpVersion: phpAvailable ? phpProbe.stdout.trim() : null,
  status: counts.FAIL ? 'FAIL' : counts['NOT RUN'] ? 'INCOMPLETE' : 'PASS',
  counts,
  results
};
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'all-unit-tests.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, ...counts, report: path.join(evidenceDir, 'all-unit-tests.json') }));
process.exitCode = counts.FAIL ? 1 : counts['NOT RUN'] ? 2 : 0;
