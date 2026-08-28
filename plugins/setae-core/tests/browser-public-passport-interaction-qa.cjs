const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser, openFixture, writeEvidence, outsideDialogPoint, assertFocusTrap } = require('./browser-v247-helpers.cjs');
const results = [];
const pass = (check, details = {}) => results.push({ check, status: 'PASS', ...details });

(async () => {
  const browser = await launchBrowser();
  try {
    let opened = await openFixture('life-history', { browser, viewport: { width: 1024, height: 900 } });
    let { page } = opened;
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    await page.locator('[data-setae-public-copy]').first().click();
    await page.locator('[data-setae-public-toast]').filter({ hasText: 'リンクをコピーしました' }).waitFor();
    assert.equal((await page.evaluate(() => window.__setaePublic247.copied())).at(-1), canonical);
    assert.equal(await page.locator('[data-setae-public-toast]').getAttribute('aria-live'), 'polite');
    pass('copy-canonical-url-and-polite-status');

    await page.evaluate(() => window.__setaePublic247.setNativeShare('success'));
    await page.locator('[data-setae-public-share]').first().click();
    await page.waitForFunction(() => window.__setaePublic247.shares().length === 1);
    assert.equal((await page.evaluate(() => window.__setaePublic247.shares()[0])).url, canonical);
    pass('native-share-api-branch', { note: 'navigator.share mocked; OS share sheet not exercised' });
    await page.evaluate(() => window.__setaePublic247.setNativeShare('none'));
    await page.locator('[data-setae-public-share]').first().click();
    await page.waitForFunction(() => window.__setaePublic247.copied().length === 2);
    pass('share-unavailable-copy-fallback');
    await page.evaluate(() => window.__setaePublic247.setNativeShare('error'));
    await page.locator('[data-setae-public-share]').first().click();
    await page.waitForFunction(() => window.__setaePublic247.copied().length === 3);
    pass('share-error-copy-fallback');

    const trigger = page.locator('[data-public-photo-index="0"]');
    await trigger.click();
    const dialog = page.locator('[data-setae-public-photo-dialog]');
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.locator('[data-setae-public-photo-count]').textContent(), /写真1\s*\/\s*9点/);
    assert.equal(await dialog.locator('[data-setae-public-photo-close]').evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press('ArrowRight');
    assert.match(await dialog.locator('[data-setae-public-photo-count]').textContent(), /写真2\s*\/\s*9点/);
    assert.match(await dialog.locator('[data-setae-public-photo-date]').textContent(), /2026\.08\.27/);
    await page.keyboard.press('ArrowLeft');
    assert.match(await dialog.locator('[data-setae-public-photo-count]').textContent(), /写真1\s*\/\s*9点/);
    await dialog.locator('[data-setae-public-photo-next]').click();
    assert.match(await dialog.locator('[data-setae-public-photo-count]').textContent(), /写真2\s*\/\s*9点/);
    await dialog.locator('[data-setae-public-photo-prev]').click();
    assert.match(await dialog.locator('[data-setae-public-photo-count]').textContent(), /写真1\s*\/\s*9点/);
    pass('photo-open-next-previous-keyboard-count-caption-date');
    await assertFocusTrap(page, dialog);
    pass('photo-focus-trap');
    await dialog.locator('[data-setae-public-photo-image]').click();
    assert.equal(await dialog.evaluate((node) => node.open), true, 'Image click is not a backdrop click.');
    const bounds = await dialog.boundingBox();
    await page.mouse.click(bounds.x + 2, bounds.y + 2);
    assert.equal(await dialog.evaluate((node) => node.open), true, 'Clicking dialog padding must not dismiss.');
    const outside = await outsideDialogPoint(dialog, page);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(outside.x, outside.y); await page.mouse.up();
    assert.equal(await dialog.evaluate((node) => node.open), true, 'Dragging from image to backdrop must not dismiss.');
    await page.mouse.click(outside.x, outside.y);
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-public-photo-index') === '0');
    pass('photo-backdrop-boundary-and-focus-return');
    await trigger.click(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    pass('photo-escape-close-and-focus-return');
    const gallerySources = await page.locator('.setae-qr-gallery-grid img').evaluateAll((images) => images.map((image) => image.getAttribute('src')));
    const heroSource = await page.locator('.setae-qr-profile-media img').getAttribute('src');
    assert.equal(gallerySources.includes(heroSource), false);
    assert.equal(await page.locator('img[fetchpriority="high"]').count(), 1);
    pass('gallery-excludes-hero-and-only-one-high-priority-image');
    await opened.context.close();

    opened = await openFixture('life-history', { browser }); page = opened.page;
    await page.evaluate(() => window.__setaePublic247.setNativeShare('abort'));
    await page.locator('[data-setae-public-share]').first().click();
    await page.waitForFunction(() => window.__setaePublic247.shares().length === 1);
    assert.deepEqual(await page.evaluate(() => window.__setaePublic247.copied()), []);
    assert.equal((await page.locator('[data-setae-public-toast]').textContent()).trim(), '');
    pass('share-abort-does-not-report-an-error-or-copy');
    await opened.context.close();

    opened = await openFixture('one-photo', { browser }); page = opened.page;
    await page.locator('[data-public-photo-index="0"]').click();
    assert.equal(await page.locator('[data-setae-public-photo-prev],[data-setae-public-photo-next]').count(), 0);
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('[data-setae-public-photo-count]').textContent(), /写真1\s*\/\s*1点/);
    await page.keyboard.press('Escape');
    pass('single-photo-keeps-single-count-and-no-navigation-controls');
    await opened.context.close();

    opened = await openFixture('transfer-logged-in', { browser }); page = opened.page;
    let received;
    let releaseResponse;
    const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
    const requestReady = new Promise((resolve) => { received = resolve; });
    await page.route('**/r4k7m/', async (route) => {
      received(Object.fromEntries(new URLSearchParams(route.request().postData() || '')));
      await responseGate;
      await route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, 'fixtures/passport-v247/passport-transfer-requested.html'), 'utf8') });
    });
    const claim = page.locator('[data-setae-public-claim]');
    assert.equal((await claim.getAttribute('method')).toLowerCase(), 'post');
    let reportBusy;
    const busyReady = new Promise((resolve) => { reportBusy = resolve; });
    await page.exposeFunction('__setaeReportClaimBusy', (snapshot) => reportBusy(snapshot));
    await claim.evaluate((form) => {
      // Registered after the production submit handler. Observe its synchronous
      // busy state before the native navigation starts; do not prevent submit.
      form.addEventListener('submit', () => window.__setaeReportClaimBusy({
        busy: form.getAttribute('aria-busy'),
        disabled: form.querySelector('button[type="submit"]').disabled,
        status: form.querySelector('[data-setae-public-claim-status]').textContent
      }), { once: true });
    });
    await claim.locator('button[type="submit"]').click({ noWaitAfter: true });
    const payload = await requestReady;
    assert.equal(payload.setae_qr_claim, '1');
    assert.equal(payload.setae_qr_claim_nonce, 'fixture-nonce-setae_qr_claim_r4k7m');
    const busyState = await busyReady;
    assert.equal(busyState.busy, 'true');
    assert.equal(busyState.disabled, true);
    assert.match(busyState.status, /引き継ぎ申請を送信/);
    releaseResponse();
    await page.waitForURL('**/r4k7m/');
    await page.getByRole('status').filter({ hasText: '所有者の承認待ちです' }).waitFor();
    assert.equal(await page.locator('[data-setae-public-claim]').count(), 0);
    pass('native-transfer-post-fields-and-busy', { note: 'HTTP response intercepted; real pending/idempotent manager behavior covered by PHP unit test' });
    await opened.context.close();

    writeEvidence('browser-public-passport-interaction-qa.json', { status: 'PASS', results });
    console.log(`Public passport interaction QA passed (${results.length} checks)`);
  } catch (error) {
    writeEvidence('browser-public-passport-interaction-qa.json', { status: 'FAIL', error: error.stack, results });
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
