const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE
  || path.resolve(__dirname, '../../../../release-evidence/v1.0.243');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

async function openRuntime({ viewport = { width: 1440, height: 1000 } } = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    const sourceUrl = message.location().url || '';
    if (message.type() === 'error' && !sourceUrl.endsWith('/favicon.ico')) {
      issues.push(`${message.text()}${sourceUrl ? ` (${sourceUrl})` : ''}`);
    }
  });
  await page.goto(`${baseUrl}/tests/fixtures/runtime-v243.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
  if (issues.length) throw new Error(issues.join(' | '));
  return { browser, context, page, issues };
}

function writeEvidence(name, report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
  return file;
}

module.exports = { baseUrl, evidenceDir, median, openRuntime, round, writeEvidence };
