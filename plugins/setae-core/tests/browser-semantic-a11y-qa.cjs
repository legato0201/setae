const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { baseUrl, evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

const auditedViews = ['today', 'collection', 'intake', 'quick', 'records', 'nursery', 'husbandry', 'qr', 'settings', 'modal', 'sheet'];

async function semanticAudit(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const brokenReferences = [];
    document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],label[for]').forEach((element) => {
      ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        value.split(/\s+/).forEach((id) => { if (!document.getElementById(id)) brokenReferences.push(`${attribute}:${id}`); });
      });
    });
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((element) => Number(element.tagName.slice(1)));
    const headingSkips = headings.filter((level, index) => index > 0 && level > headings[index - 1] + 1);
    const visibleNavLabels = [...document.querySelectorAll('nav')].filter(visible).map((element) => element.getAttribute('aria-label') || '');
    const tablists = [...document.querySelectorAll('[role="tablist"]')].filter(visible);
    return {
      mainCount: document.querySelectorAll('main').length,
      visibleMainCount: [...document.querySelectorAll('main')].filter(visible).length,
      visibleH1Count: [...document.querySelectorAll('h1')].filter(visible).length,
      duplicateIds,
      brokenReferences,
      headingSkips,
      positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter((element) => Number(element.getAttribute('tabindex')) > 0).length,
      visibleNavLabels,
      tablistSelectionCounts: tablists.map((tablist) => [...tablist.querySelectorAll('[role="tab"]')].filter((tab) => tab.getAttribute('aria-selected') === 'true').length),
      tablistCount: tablists.length
    };
  });
}

function assertAudit(audit, label) {
  assert.equal(audit.mainCount, 1, `${label}: main count`);
  assert.equal(audit.visibleMainCount, 1, `${label}: visible main count`);
  assert.equal(audit.visibleH1Count, 1, `${label}: visible h1 count`);
  assert.deepEqual(audit.duplicateIds, [], `${label}: duplicate IDs`);
  assert.deepEqual(audit.brokenReferences, [], `${label}: broken references`);
  assert.deepEqual(audit.headingSkips, [], `${label}: heading skips`);
  assert.equal(audit.positiveTabindex, 0, `${label}: positive tabindex`);
  assert.ok(audit.tablistSelectionCounts.every((count) => count === 1), `${label}: each tablist must have one selected tab`);
  assert.equal(new Set(audit.visibleNavLabels).size, audit.visibleNavLabels.length, `${label}: visible navigation labels must be unique`);
}

function initialThemeScript(preference) {
  const workspacePhp = path.resolve(__dirname, '../../../../tmp/runtime-php-8.4.25/php.exe');
  const php = process.env.SETAE_PHP || process.env.PHP_BINARY || process.env.PHP_BIN
    || (fs.existsSync(workspacePhp) ? workspacePhp : 'php');
  const source = [
    'function get_current_user_id() { return 17; }',
    'function get_user_meta($id, $key, $single) { return $GLOBALS["preference"]; }',
    'function sanitize_key($key) { return preg_replace("/[^a-z0-9_\\-]/", "", strtolower($key)); }',
    'function wp_json_encode($value) { return json_encode($value); }',
    '$GLOBALS["preference"] = $argv[2];',
    'require $argv[1];',
    'echo Setae_App_Shell::render_initial_theme_script();'
  ].join('\n');
  return execFileSync(php, ['-r', source,
    path.resolve(__dirname, '../includes/frontend/class-setae-app-shell.php'), preference],
  { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
}

async function auditStartup(browser, {
  width, colorScheme, preference = 'system', expectedTheme = colorScheme, javaScriptEnabled = true
}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 }, colorScheme, reducedMotion: 'reduce', javaScriptEnabled
  });
  const themeScript = initialThemeScript(preference);
  let releaseModules;
  const modulesReady = new Promise((resolve) => { releaseModules = resolve; });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // app-shell-unit executes PHP and verifies this fixture's initial mount.
    // Insert the actual early-theme PHP output before the fixture styles.
    await page.route('**/tests/fixtures/runtime-v243.html', async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace('</title>', `</title>${themeScript}`);
      await route.fulfill({ response, body: html });
    });
    if (javaScriptEnabled) {
      // Hold a required module, not a timer: the server view must work before
      // the client can mount. This is separate from all performance tests.
      await page.route('**/assets/app/components/app-frame.js', async (route) => {
        await modulesReady;
        await route.continue();
      });
    }
    await page.goto(`${baseUrl}/tests/fixtures/runtime-v243.html`, { waitUntil: 'commit', timeout: 60000 });
    const selector = javaScriptEnabled ? '[data-app-startup]' : '[data-app-noscript]';
    await page.locator(selector).waitFor({ state: 'visible' });
    await page.waitForFunction((target) => {
      const node = document.querySelector(target);
      return node && getComputedStyle(node).display === 'grid';
    }, selector);
    const geometry = await page.locator(selector).evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const spinner = node.querySelector('.spinner');
      return {
        left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
        width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        background: getComputedStyle(node).backgroundColor,
        theme: document.documentElement.dataset.theme || '',
        spinnerAnimation: spinner ? getComputedStyle(spinner).animationName : null,
        busy: node.getAttribute('aria-busy'), live: node.getAttribute('aria-live'),
        text: node.textContent.replace(/\s+/g, ' ').trim(),
        initialMainDisplay: getComputedStyle(document.querySelector('[data-app-startup]')).display,
        initialized: document.body.dataset.fixtureReady === 'true'
      };
    });
    assert.equal(geometry.overflow, false, `${width}: startup overflow`);
    assert.ok(geometry.left >= -1 && geometry.right <= width + 1, `${width}: startup horizontal bounds`);
    assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.height + 1, `${width}: startup vertical bounds`);
    assert.equal(geometry.initialized, false, 'The initial view must be available before modules execute.');
    if (javaScriptEnabled) {
      assert.equal(geometry.theme, expectedTheme, 'Resolve the actual saved/system theme before styles display.');
      assert.match(geometry.text, /SETAE.*コレクションを準備しています/);
      assert.equal(geometry.busy, 'true');
      assert.equal(geometry.live, null, 'Do not duplicate the client loading announcement.');
      assert.equal(geometry.spinnerAnimation, 'none', 'Respect reduced motion before client startup.');
      assert.equal(await page.getByRole('main').count(), 1);
    } else {
      assert.match(geometry.text, /SETAEを利用するにはJavaScriptを有効にしてください。/);
      assert.equal(geometry.initialMainDisplay, 'none', 'Do not show an endless pending state without JavaScript.');
      assert.equal(await page.getByText('コレクションを準備しています', { exact: true }).isVisible(), false);
    }
    const screenshot = `startup-${width}-${preference}-${colorScheme}-${javaScriptEnabled ? 'pending' : 'noscript'}.png`;
    await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: false });
    let mounted = null;
    if (javaScriptEnabled) {
      releaseModules();
      await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
      assert.equal(await page.locator('[data-app-startup], [data-app-noscript]').count(), 0);
      await page.getByRole('heading', { level: 1, name: '記録履歴', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-record-id]').count(), 100, 'Initialize the expected records view, not another valid page.');
      mounted = await semanticAudit(page);
      assertAudit(mounted, `${width}: initialized startup fixture`);
      assert.equal(await page.locator('#app').count(), 1);
      assert.equal(await page.locator('#setae-gui-root').count(), 1);
    }
    assert.deepEqual(errors, []);
    return { width, colorScheme, preference, expectedTheme, javaScriptEnabled, geometry, mounted, screenshot,
      scope: 'Actual PHP mount verified by unit; real client render components in a controlled local fixture. Not a WordPress integration or physical device test.' };
  } finally {
    releaseModules();
    await context.close();
  }
}

(async () => {
  const { browser, page } = await openFixture({ view: 'semantic', viewport: { width: 1280, height: 900 } });
  try {
    const audit = await semanticAudit(page);
    assertAudit(audit, 'semantic');

    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('class'), 'skip-link');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'setae-main-content');

    await page.getByRole('tab', { name: '履歴' }).click();
    assert.equal(await page.getByRole('tab', { selected: true }).textContent(), '履歴');
    assert.match(await page.getByRole('tabpanel').textContent(), /記録履歴/);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { selected: true }).textContent(), '概要');

    await page.screenshot({ path: path.join(evidenceDir, 'semantic-a11y-1280.png'), fullPage: true });
    const viewAudits = [];
    for (const view of auditedViews) {
      await page.goto(`${baseUrl}/tests/fixtures/native-v244.html?view=${view}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
      const viewAudit = await semanticAudit(page);
      assertAudit(viewAudit, view);
      viewAudits.push({ view, ...viewAudit });
    }
    const startupAudits = [];
    for (const options of [
      { width: 320, colorScheme: 'light', preference: 'system', expectedTheme: 'light' },
      { width: 390, colorScheme: 'dark', preference: 'system', expectedTheme: 'dark' },
      { width: 320, colorScheme: 'light', preference: 'dark', expectedTheme: 'dark' },
      { width: 390, colorScheme: 'dark', preference: 'light', expectedTheme: 'light' },
      { width: 320, colorScheme: 'light', preference: 'system', javaScriptEnabled: false }
    ]) startupAudits.push(await auditStartup(browser, options));
    assert.notEqual(startupAudits[0].geometry.background, startupAudits[1].geometry.background,
      'Startup must use the selected theme.');
    writeEvidence('browser-semantic-a11y-qa.json', { status: 'PASS', audit, viewAudits, startupAudits });
    console.log('Semantic accessibility browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
