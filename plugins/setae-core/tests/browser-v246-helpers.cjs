const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8872').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE
  || path.resolve(__dirname, '../../../../release-evidence/v1.0.246');
const screenshotDir = path.join(evidenceDir, 'screenshots');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function writeEvidence(name, report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
  return file;
}

function screenshotPath(name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  return path.join(screenshotDir, name);
}

async function launchBrowser() {
  return chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
}

async function openFixture(name, {
  query = {},
  viewport = { width: 390, height: 844 },
  hasTouch = viewport.width <= 767,
  colorScheme = 'light',
  reducedMotion = 'reduce',
  forcedColors = 'none',
  browser = null
} = {}) {
  const ownedBrowser = browser || await launchBrowser();
  const context = await ownedBrowser.newContext({ viewport, hasTouch, colorScheme, reducedMotion, forcedColors });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const source = message.location().url || '';
    if (message.type() === 'error' && !source.endsWith('/favicon.ico')) issues.push(`console: ${message.text()}`);
  });
  const params = new URLSearchParams(query);
  await page.goto(`${baseUrl}/tests/fixtures/${name}${params.size ? `?${params}` : ''}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (issues.length) throw new Error(issues.join(' | '));
  return { browser: ownedBrowser, owned: !browser, context, page, issues };
}

module.exports = { baseUrl, evidenceDir, screenshotDir, screenshotPath, launchBrowser, openFixture, writeEvidence };
