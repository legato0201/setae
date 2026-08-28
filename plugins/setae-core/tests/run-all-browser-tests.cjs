/* Execute repository browser suites in isolated headless processes. No downloads. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const evidence = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.248/all-browser');
const results = [];
const suites = fs.readdirSync(__dirname).filter((name) => /^browser-.+-qa\.cjs$/.test(name)).sort();
fs.mkdirSync(evidence, { recursive: true });

function run(name) {
  return new Promise((resolve) => {
    const started = Date.now();
    const output = [];
    const child = spawn(process.execPath, [path.join(__dirname, name)], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: { ...process.env, SETAE_QA_BASE: process.env.SETAE_QA_BASE || 'http://127.0.0.1:8872', SETAE_QA_EVIDENCE: path.join(evidence, name.replace(/\.cjs$/, '')) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let spawnError = '';
    child.stdout.on('data', (data) => output.push(data.toString()));
    child.stderr.on('data', (data) => output.push(data.toString()));
    child.on('error', (error) => { spawnError = error.message; });
    const deadline = setTimeout(() => child.kill(), 300000);
    child.on('close', (code, signal) => {
      clearTimeout(deadline);
      const log = output.join('');
      const result = { name, status: code === 0 && !spawnError ? 'PASS' : 'FAIL', code, signal, durationMs: Date.now() - started, error: spawnError, log };
      results.push(result);
      fs.writeFileSync(path.join(evidence, 'all-browser-tests.json'), JSON.stringify({ generatedAt: new Date().toISOString(), completed: results.length, total: suites.length, results }, null, 2) + '\n');
      console.log(`${result.status} ${name} (${result.durationMs}ms)`);
      if (result.status === 'FAIL') console.log(log.slice(-3500) || spawnError);
      resolve(result);
    });
  });
}

(async () => {
  // Avoid concurrent performance benchmarks or cross-suite CPU pressure.
  for (const name of suites) await run(name);
  const failures = results.filter((result) => result.status !== 'PASS');
  console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', passed: results.length - failures.length, failed: failures.length, total: suites.length }));
  process.exitCode = failures.length ? 1 : 0;
})();
