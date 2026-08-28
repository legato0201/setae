const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE
  || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const screenshotDir = path.join(evidenceDir, 'screenshots');
const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const allViewports = [
  { name: 'compact-320', width: 320, height: 844 },
  { name: 'compact-360', width: 360, height: 844 },
  { name: 'compact-375', width: 375, height: 844 },
  { name: 'compact-390', width: 390, height: 844 },
  { name: 'compact-430', width: 430, height: 932 },
  { name: 'medium-768', width: 768, height: 1024 },
  { name: 'medium-1024', width: 1024, height: 1024 },
  { name: 'wide-1280', width: 1280, height: 1000 },
  { name: 'wide-1440', width: 1440, height: 1200 }
];
const requestedWidths = new Set(String(process.env.SETAE_QA_WIDTHS || '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean));
const viewports = requestedWidths.size
  ? allViewports.filter((viewport) => requestedWidths.has(viewport.width))
  : allViewports;
const screenshotWidths = new Set([390, 768, 1440]);
const themes = ['light', 'dark'];
const harnessStates = [
  'app-frame', 'page-header', 'buttons', 'forms', 'tabs', 'registry',
  'ledger', 'photo-index', 'inspector', 'task', 'toast', 'empty',
  'loading', 'error', 'modal', 'sheet', 'auth', 'update-notice'
];
const productScreens = [
  { name: 'today', file: 'today-v4.html' },
  { name: 'collection-registry', file: 'ui-system-v4-collection-preview.html', query: 'view=table' },
  { name: 'collection-photo', file: 'ui-system-v4-collection-preview.html', query: 'view=gallery&card=photo' },
  { name: 'specimen', file: 'ui-system-v4-specimen-preview.html' },
  { name: 'quick-record', file: 'quick-record-v4.html' },
  { name: 'records', file: 'records-v4.html' },
  { name: 'nursery', file: 'nursery-v4.html', query: 'mode=detail' },
  { name: 'husbandry', file: 'husbandry-v4.html', query: 'mode=detail' },
  { name: 'qr', file: 'ui-system-v4-utility-preview.html', query: 'screen=qr&view=labels' },
  { name: 'community', file: 'ui-system-v4-utility-preview.html', query: 'screen=community&view=care' },
  { name: 'settings', file: 'ui-system-v4-utility-preview.html', query: 'screen=settings&view=profile' },
  { name: 'auth', file: 'ui-system-v4-visual-craft-harness.html', query: 'state=auth' }
];

function withTheme(file, query, theme) {
  const params = new URLSearchParams(query || '');
  params.set('theme', theme);
  return `${baseUrl}/tests/fixtures/${file}?${params.toString()}`;
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const visibleH1 = [...document.querySelectorAll('h1')].filter(visible);
    const nested = [...document.querySelectorAll('button button, button a, a button, label label')]
      .filter(visible);
    const controls = [...document.querySelectorAll('button, input:not([type="hidden"]), select, textarea')]
      .filter(visible)
      .filter((node) => !node.closest('.label-preview-stage, .physical-label-preview'));
    const effectiveControl = (node) => {
      if (node.matches('input[type="file"]') && node.getBoundingClientRect().height <= 1) return null;
      if (node.matches('input[type="checkbox"], input[type="radio"]')) {
        return node.closest('label, .checkbox-control, .radio-control') || node;
      }
      return node;
    };
    const undersizedControls = innerWidth <= 430
      ? controls
        .map(effectiveControl)
        .filter(Boolean)
        .filter((node) => node.getBoundingClientRect().height < 43.5)
      : [];
    const overflowingElements = [...document.body.querySelectorAll('*')]
      .filter(visible)
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .slice(0, 12)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          className: String(node.className || ''),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100
        };
      });
    return {
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      visibleH1: visibleH1.length,
      nestedInteractive: nested.length,
      undersizedControls: undersizedControls.slice(0, 8).map((node) => ({
        tag: node.tagName.toLowerCase(),
        className: String(node.className || ''),
        height: Math.round(node.getBoundingClientRect().height * 100) / 100
      })),
      overflowingElements,
      bodyState: { ...document.body.dataset }
    };
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function openFixture(page, url, attempts = 2) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
      await page.waitForFunction(
        () => document.readyState !== 'loading' && Boolean(document.querySelector('h1')),
        null,
        { timeout: 60000 }
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) break;
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 10000 });
      await page.waitForTimeout(250);
    }
  }

  throw lastError;
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  const results = [];

  try {
    for (const viewport of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const consoleIssues = [];
        page.on('console', (message) => {
          if (['error', 'warning'].includes(message.type())) {
            const sourceUrl = message.location().url || '';
            if (!sourceUrl.endsWith('/favicon.ico')) {
              consoleIssues.push(`${message.type()}: ${message.text()}${sourceUrl ? ` (${sourceUrl})` : ''}`);
            }
          }
        });
        page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));

        for (const state of harnessStates) {
          consoleIssues.length = 0;
          await openFixture(page, withTheme(
            'ui-system-v4-visual-craft-harness.html',
            `state=${encodeURIComponent(state)}`,
            theme
          ));
          await settle(page);
          const geometry = await inspectPage(page);
          results.push({ kind: 'harness', name: state, viewport, theme, consoleIssues: [...consoleIssues], ...geometry });
        }

        for (const screen of productScreens) {
          consoleIssues.length = 0;
          await openFixture(page, withTheme(screen.file, screen.query, theme));
          await settle(page);
          const geometry = await inspectPage(page);
          const screenshot = screenshotWidths.has(viewport.width)
            ? path.join(screenshotDir, `${viewport.name}-${theme}-${screen.name}.png`)
            : '';
          if (screenshot) await page.screenshot({ path: screenshot, fullPage: false });
          results.push({
            kind: 'product',
            name: screen.name,
            viewport,
            theme,
            screenshot: screenshot ? path.relative(evidenceDir, screenshot) : '',
            consoleIssues: [...consoleIssues],
            ...geometry
          });
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter((result) => (
    result.documentOverflow
    || result.visibleH1 !== 1
    || result.nestedInteractive !== 0
    || result.undersizedControls.length > 0
    || result.consoleIssues.length > 0
  ));
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    cases: results.length,
    harnessCases: results.filter((item) => item.kind === 'harness').length,
    productCases: results.filter((item) => item.kind === 'product').length,
    screenshots: results.filter((item) => item.screenshot).length,
    failures: failures.length,
    results
  };
  fs.writeFileSync(path.join(evidenceDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`Visual Craft browser QA passed (${report.cases} cases, ${report.screenshots} screenshots)`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
