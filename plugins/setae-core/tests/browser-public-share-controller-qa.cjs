const assert = require('node:assert/strict');
const { launchBrowser, openFixture, openShare, writeEvidence } = require('./browser-v248-helpers.cjs');
const results = [];
const statusFor = (control) => control.locator('xpath=ancestor::*[@data-public-share-controls][1]').locator('[data-public-share-status]');
(async () => {
  const browser = await launchBrowser();
  try {
    for (const [fixture, prefix, viewEvent] of [['care-photo','care_share','care_share_view'],['partner-guest','partner','partner_page_view']]) {
      let opened = await openFixture(fixture, { browser }); let page = opened.page; await openShare(page);
      const main = page.locator('main'); const expectedUrl = await main.getAttribute('data-share-url'); const expectedText = await main.getAttribute('data-share-copy-text'); assert.ok(expectedText);
      for (const action of ['link','text']) {
        const button = page.locator(`[data-public-share-action="${action}"]`).first(); const label = await button.textContent(); const width = (await button.boundingBox()).width;
        await button.click(); await statusFor(button).filter({ hasText: 'コピーしました' }).waitFor();
        assert.equal((await page.evaluate(() => window.__setaePublic248.copied())).at(-1).text, action === 'text' ? expectedText : expectedUrl);
        assert.equal(await button.textContent(), label); assert.equal((await button.boundingBox()).width, width, 'Copy result must not resize its control.');
        results.push({ surface: prefix, check: action + '-clipboard-static-status-stable-label-width', status: 'PASS' });
      }
      const native = page.locator('[data-public-share-action="native"]').first(); assert.equal(await native.isVisible(), true); await native.click();
      await page.waitForFunction(() => window.__setaePublic248.shares().length > 0);
      const payload = (await page.evaluate(() => window.__setaePublic248.shares())).at(-1);
      assert.equal(payload.url, expectedUrl); assert.equal(payload.title, await main.getAttribute('data-share-title')); assert.equal(payload.text, await main.getAttribute('data-share-text'));
      for (const action of ['x','line']) {
        const anchor = page.locator(`[data-public-share-action="${action}"]`).first(); const href = new URL(await anchor.getAttribute('href'));
        assert.equal(href.protocol, 'https:'); assert.equal(href.searchParams.get('url'), expectedUrl); assert.equal(await anchor.getAttribute('target'), '_blank'); assert.match(await anchor.getAttribute('rel'), /noopener/);
        // Observe analytics while preventing an external navigation in this fixture test.
        await anchor.evaluate((node) => node.addEventListener('click', (event) => event.preventDefault(), { once: true })); await anchor.click();
      }
      const events = (await page.evaluate(() => window.__setaePublic248.events())).map((event) => event.name);
      for (const name of [viewEvent, `${prefix}_native_share`, `${prefix}_link_copy`, `${prefix}_text_copy`, `${prefix}_x_click`, `${prefix}_line_click`]) assert.ok(events.includes(name), 'Optional analytics contract ' + name);
      results.push({ surface: prefix, check: 'native-payload-x-line-real-links-and-optional-analytics', status: 'PASS' }); await opened.context.close();

      for (const mode of ['none','error']) {
        opened = await openFixture(fixture, { browser, query: { clipboard: mode, analytics: 'none' } }); page = opened.page; await openShare(page);
        const button = page.locator('[data-public-share-action="text"]').first(); await button.click(); await statusFor(button).filter({ hasText: 'コピーしました' }).waitFor();
        const copied = (await page.evaluate(() => window.__setaePublic248.copied())).at(-1); assert.equal(copied.method, 'execCommand'); assert.equal(copied.text, expectedText);
        assert.equal(await page.locator('textarea.setae-public-copy-helper').count(), 0); assert.equal(await button.evaluate((node) => node === document.activeElement), true);
        assert.deepEqual(opened.issues, []); results.push({ surface: prefix, check: 'clipboard-' + mode + '-DOM-fallback-cleanup-focus-without-analytics', status: 'PASS' }); await opened.context.close();
      }
      for (const mode of ['none','abort','error']) {
        opened = await openFixture(fixture, { browser, query: { native: mode } }); page = opened.page; await openShare(page);
        const button = page.locator('[data-public-share-action="native"]').first();
        if (mode === 'none') assert.equal(await button.isVisible(), false);
        else {
          await button.click(); await page.waitForFunction(() => window.__setaePublic248.shares().length > 0);
          if (mode === 'abort') { assert.equal((await statusFor(button).textContent()).trim(), ''); assert.deepEqual(await page.evaluate(() => window.__setaePublic248.copied()), []); }
          else { await statusFor(button).filter({ hasText: 'リンクをコピーしました' }).waitFor(); assert.equal((await page.evaluate(() => window.__setaePublic248.copied())).at(-1).text, expectedUrl); }
        }
        results.push({ surface: prefix, check: 'native-' + mode, status: 'PASS' }); await opened.context.close();
      }
      opened = await openFixture(fixture, { browser, query: { clipboard: 'none' } }); page = opened.page; await openShare(page); await page.evaluate(() => window.__setaePublic248.setFallback(false));
      const retry = page.locator('[data-public-share-action="link"]').first(); await retry.click(); await statusFor(retry).filter({ hasText: 'コピーできませんでした' }).waitFor();
      assert.equal(await page.locator('textarea.setae-public-copy-helper').count(), 0);
      await page.evaluate(() => window.__setaePublic248.setFallback(true)); await retry.click(); await statusFor(retry).filter({ hasText: 'コピーしました' }).waitFor();
      assert.deepEqual(opened.issues, []); results.push({ surface: prefix, check: 'fallback-error-cleanup-and-retry', status: 'PASS' }); await opened.context.close();
    }
    writeEvidence('browser-public-share-controller-qa.json', { status: 'PASS', results, scope: 'Mocked Clipboard, native-share and analytics APIs; real production share controller and anchor URLs, no OS share sheet or external site navigation.' }); console.log(`Public share controller QA passed (${results.length} checks)`);
  } catch (error) { writeEvidence('browser-public-share-controller-qa.json', { status: 'FAIL', error: error.stack, results }); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
