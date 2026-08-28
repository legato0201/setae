const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baselineUrl = process.env.SETAE_PERF_BASELINE_URL;
const currentUrl = process.env.SETAE_PERF_CURRENT_URL;
const evidenceDir = process.env.SETAE_QA_EVIDENCE
  || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const iterations = Number(process.env.SETAE_PERF_ITERATIONS || 15);
const scenarios = [
  { id: 'collection500', label: '500 animals Collection render' },
  { id: 'collectionSearch', label: 'Collection search update' },
  { id: 'specimenOpen', label: 'Open specimen' },
  { id: 'quickRecordOpen', label: 'Open Quick Record' },
  { id: 'nursery500', label: '500 baby register render' },
  { id: 'records1000', label: '1000 records ledger render' }
];

if (!baselineUrl || !currentUrl) {
  throw new Error('SETAE_PERF_BASELINE_URL and SETAE_PERF_CURRENT_URL are required.');
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function createBenchmarkPage(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    const sourceUrl = message.location().url || '';
    if (message.type() === 'error' && !sourceUrl.endsWith('/favicon.ico')) {
      issues.push(`${message.text()}${sourceUrl ? ` (${sourceUrl})` : ''}`);
    }
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.setaeBenchmarkReady === true, null, { timeout: 60000 });
  if (issues.length) throw new Error(`${url}: ${issues.join(' | ')}`);
  return { context, page };
}

async function run(page, scenario) {
  return page.evaluate((name) => window.runSetaeBenchmark(name), scenario);
}

async function collectSamples(browser, url, scenario, count) {
  if (count <= 0) {
    return { durations: [], scriptDurations: [], nodes: 0 };
  }

  const target = await createBenchmarkPage(browser, url);
  const durations = [];
  const scriptDurations = [];
  let nodes = 0;

  try {
    await run(target.page, scenario);
    for (let index = 0; index < count; index += 1) {
      const measurement = await run(target.page, scenario);
      durations.push(measurement.duration);
      scriptDurations.push(measurement.scriptDuration);
      nodes = measurement.nodes;
    }
  } finally {
    await target.context.close();
  }

  return { durations, scriptDurations, nodes };
}

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  const results = [];

  try {
    for (const scenario of scenarios) {
      const firstBatchSize = Math.ceil(iterations / 2);
      const secondBatchSize = Math.floor(iterations / 2);

      // Measure one active page at a time. The symmetric order prevents Chromium's
      // background-page throttling and run-order bias from becoming a false regression.
      const baselineFirst = await collectSamples(
        browser,
        baselineUrl,
        scenario.id,
        firstBatchSize
      );
      const currentFirst = await collectSamples(
        browser,
        currentUrl,
        scenario.id,
        firstBatchSize
      );
      const currentSecond = await collectSamples(
        browser,
        currentUrl,
        scenario.id,
        secondBatchSize
      );
      const baselineSecond = await collectSamples(
        browser,
        baselineUrl,
        scenario.id,
        secondBatchSize
      );
      const baselineSamples = [
        ...baselineFirst.durations,
        ...baselineSecond.durations
      ];
      const currentSamples = [
        ...currentFirst.durations,
        ...currentSecond.durations
      ];
      const currentScriptSamples = [
        ...currentFirst.scriptDurations,
        ...currentSecond.scriptDurations
      ];
      const nodeCounts = {
        baseline: baselineSecond.nodes || baselineFirst.nodes,
        current: currentSecond.nodes || currentFirst.nodes
      };

      const before = median(baselineSamples);
      const after = median(currentSamples);
      const changePercent = before > 0 ? ((after - before) / before) * 100 : 0;
      results.push({
        ...scenario,
        iterations,
        beforeMedianMs: Math.round(before * 100) / 100,
        afterMedianMs: Math.round(after * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        thresholdPercent: 15,
        passed: changePercent < 15,
        longTaskOver100Ms: currentScriptSamples.some((value) => value > 100),
        maxCurrentMs: Math.round(Math.max(...currentSamples) * 100) / 100,
        maxCurrentScriptMs: Math.round(Math.max(...currentScriptSamples) * 100) / 100,
        nodeCounts
      });
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter((result) => !result.passed);
  const report = {
    generatedAt: new Date().toISOString(),
    baselineUrl,
    currentUrl,
    iterations,
    failures: failures.length,
    results
  };
  fs.writeFileSync(path.join(evidenceDir, 'browser-performance-v242-qa.json'), `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`Performance QA passed (${results.length} scenarios, ${iterations} samples each)`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
