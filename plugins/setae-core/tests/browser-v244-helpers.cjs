const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE
  || path.resolve(__dirname, '../../../../release-evidence/v1.0.244');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function writeEvidence(name, report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
  return file;
}

async function openFixture({
  view = 'semantic',
  query = {},
  viewport = { width: 1280, height: 900 },
  forcedColors = 'none'
} = {}) {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport, forcedColors });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    const source = message.location().url || '';
    if (message.type() === 'error' && !source.endsWith('/favicon.ico')) issues.push(message.text());
  });
  const params = new URLSearchParams({ view, ...query });
  await page.goto(`${baseUrl}/tests/fixtures/native-v244.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
  if (issues.length) throw new Error(issues.join(' | '));
  return { browser, context, page, issues };
}

module.exports = { baseUrl, evidenceDir, openFixture, writeEvidence };
