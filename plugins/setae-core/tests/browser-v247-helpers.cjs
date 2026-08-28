/* Browser CI helpers. These scripts are not run by the unit-test runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const pluginRoot = path.resolve(__dirname, '..');
const fixtureDir = process.env.SETAE_QA_FIXTURES || path.join(__dirname, 'fixtures/passport-v247');
const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8872').replace(/\/$/, '');
const fixtureRoute = process.env.SETAE_QA_FIXTURE_ROUTE || '/tests/fixtures/passport-v247/';
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.248');
const screenshotDir = path.join(evidenceDir, 'screenshots');

function writeEvidence(name, report) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), environment: 'Desktop Chromium automation; synthetic WordPress datastore and network responses; no physical mobile, real registration, SMTP or installed WordPress verification.', ...report }, null, 2) + '\n');
  return file;
}
function screenshotPath(name) { fs.mkdirSync(screenshotDir, { recursive: true }); return path.join(screenshotDir, name); }
function currentManifest() {
  const file = path.join(fixtureDir, 'manifest.json');
  assert.ok(fs.existsSync(file), 'Generate actual PHP fixtures first: php tests/render-public-passport-fixtures.php');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [relative, expected] of Object.entries(manifest.sources)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(pluginRoot, relative))).digest('hex');
    assert.equal(actual, expected, `Stale PHP fixture source ${relative}; regenerate fixtures before browser QA.`);
  }
  return manifest;
}
async function launchBrowser() {
  const { chromium } = require('playwright');
  const candidates = [process.env.CHROME_PATH, process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
  const executablePath = candidates.find((file) => fs.existsSync(file));
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ['--disable-dev-shm-usage'] });
}
async function openFixture(name, { browser, viewport = { width: 390, height: 844 }, colorScheme = 'light', forcedColors = 'none', query = {} } = {}) {
  const manifest = currentManifest();
  const entry = manifest.fixtures[name];
  assert.ok(entry, `Unknown production fixture ${name}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtureDir, entry.file))).digest('hex');
  assert.equal(actual, entry.sha256, 'Generated document was changed after PHP rendering.');
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 767, colorScheme, forcedColors, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !(message.location().url || '').endsWith('/favicon.ico')) issues.push(message.text()); });
  const params = new URLSearchParams(query);
  await page.goto(`${baseUrl}${fixtureRoute}${entry.file}${params.size ? '?' + params : ''}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 10000 });
  assert.deepEqual(issues, [], 'No browser console/runtime errors.');
  return { context, page, issues, entry };
}
async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (node) => { const box = node.getBoundingClientRect(); const css = getComputedStyle(node); return box.width > 0 && box.height > 0 && css.visibility !== 'hidden' && css.display !== 'none' && !node.closest('[hidden]'); };
    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
    const headingLevels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((node) => Number(node.tagName.slice(1)));
    const controls = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary')].filter(visible);
    const targetIssues = controls.map((node) => {
      const box = (node.matches('input[type="checkbox"],input[type="radio"]') ? node.closest('label') || node : node).getBoundingClientRect();
      return { label: (node.getAttribute('aria-label') || node.textContent || node.name || '').trim().slice(0, 50), width: box.width, height: box.height };
    }).filter((box) => box.width < 43.5 || box.height < 43.5);
    const ariaMissing = [];
    for (const node of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-errormessage]')) {
      for (const name of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-errormessage']) {
        for (const id of (node.getAttribute(name) || '').split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) ariaMissing.push(`${name}:${id}`);
      }
    }
    const media = document.querySelector('.setae-qr-profile-media');
    const mediaRect = media?.getBoundingClientRect();
    return {
      viewport: innerWidth, documentClientWidth: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      mains: document.querySelectorAll('main').length,
      h1s: document.querySelectorAll('h1').length,
      headingSkips: headingLevels.slice(1).filter((level, index) => level > headingLevels[index] + 1),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      ariaMissing, targetIssues,
      positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter((node) => Number(node.getAttribute('tabindex')) > 0).length,
      nestedInteractive: document.querySelectorAll('a a,a button,button a,button button').length,
      highPriorityImages: document.querySelectorAll('img[fetchpriority="high"]').length,
      brokenImages: [...document.images].filter((image) => visible(image) && image.complete && image.naturalWidth === 0).map((image) => image.getAttribute('src')),
      mediaRatio: mediaRect && mediaRect.height ? mediaRect.width / mediaRect.height : null,
      themeBackground: getComputedStyle(document.body).backgroundColor,
      themeForeground: getComputedStyle(document.body).color,
    };
  });
}
function validatePage(result, name, { targets = true } = {}) {
  assert.equal(result.overflow, false, `${name}: horizontal overflow ${result.documentWidth}/${result.documentClientWidth ?? result.viewport}`);
  assert.equal(result.mains, 1, name + ': one main');
  assert.equal(result.h1s, 1, name + ': one h1');
  assert.deepEqual(result.headingSkips, [], name + ': no heading skips');
  assert.deepEqual(result.duplicateIds, [], name + ': unique IDs');
  assert.deepEqual(result.ariaMissing, [], name + ': intact ARIA references');
  assert.equal(result.positiveTabindex, 0, name + ': no positive tabindex');
  assert.equal(result.nestedInteractive, 0, name + ': no nested controls');
  assert.deepEqual(result.brokenImages, [], name + ': no broken images');
  assert.ok(result.highPriorityImages <= 1, name + ': only one high priority photo');
  if (targets) assert.deepEqual(result.targetIssues, [], name + ': 44px touch targets');
  if (result.mediaRatio !== null) assert.ok(Math.abs(result.mediaRatio - 4 / 3) < 0.035, name + ': main media 4:3');
}
async function outsideDialogPoint(dialog, page) {
  const box = await dialog.boundingBox();
  const size = page.viewportSize();
  if (box.x > 4) return { x: box.x / 2, y: Math.max(1, box.y + box.height / 2) };
  if (box.y > 4) return { x: box.x + box.width / 2, y: box.y / 2 };
  if (box.x + box.width < size.width - 4) return { x: size.width - 2, y: box.y + box.height / 2 };
  if (box.y + box.height < size.height - 4) return { x: box.x + box.width / 2, y: size.height - 2 };
  throw new Error('No backdrop area in this viewport; use a larger viewport for backdrop boundary QA.');
}
async function assertFocusTrap(page, dialog) {
  const focusables = dialog.locator('a[href]:visible,button:visible:not([disabled]),input:visible:not([type="hidden"]):not([disabled]),select:visible:not([disabled]),textarea:visible:not([disabled]),[tabindex="0"]:visible');
  const first = focusables.first(); const last = focusables.last();
  await first.focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await last.evaluate((node) => node === document.activeElement), true, 'Shift+Tab wraps to the last control.');
  await page.keyboard.press('Tab');
  assert.equal(await first.evaluate((node) => node === document.activeElement), true, 'Tab wraps to the first control.');
}
module.exports = { baseUrl, evidenceDir, screenshotPath, writeEvidence, currentManifest, launchBrowser, openFixture, inspectPage, validatePage, outsideDialogPoint, assertFocusTrap };
