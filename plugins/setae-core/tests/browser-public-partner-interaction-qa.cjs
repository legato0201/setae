const assert = require('node:assert/strict');
const { launchBrowser, openFixture, registrationFlow, writeEvidence } = require('./browser-v248-helpers.cjs');
const results = [];
(async () => {
  const browser = await launchBrowser();
  try {
    const opened = await openFixture('partner-long', { browser, viewport: { width: 390, height: 1000 } }); const { page } = opened;
    const field = page.locator('.setae-public-partner-invite-text'); assert.equal(await field.getAttribute('readonly'), '');
    await field.focus(); await page.keyboard.press('Control+A');
    assert.equal(await field.evaluate((node) => node.selectionEnd - node.selectionStart), (await field.inputValue()).length, 'Read-only copy kit remains selectable.');
    assert.equal(await page.locator('main').getAttribute('data-share-copy-text'), await field.inputValue());
    assert.equal(await page.locator('main .setae-public-button.is-primary').count(), 1); assert.equal(await page.locator('ol.setae-public-partner-steps > li').count(), 3);
    results.push({ check: 'long-readonly-copy-kit-selection-exact-copy-context-one-primary-semantic-process', status: 'PASS' });
    const link = page.locator('[data-public-share-action="link"]'); const text = page.locator('[data-public-share-action="text"]');
    await link.click(); await page.locator('.setae-public-partner-hero-controls [data-public-share-status]').filter({ hasText: 'コピーしました' }).waitFor();
    assert.equal((await page.locator('.setae-public-partner-copy-kit [data-public-share-status]').textContent()).trim(), '');
    await text.click(); await page.locator('.setae-public-partner-copy-kit [data-public-share-status]').filter({ hasText: '案内文をコピーしました' }).waitFor();
    assert.equal((await page.evaluate(() => window.__setaePublic248.copied())).at(-1).text, await field.inputValue());
    results.push({ check: 'hero-and-copy-kit-have-independent-static-feedback', status: 'PASS' });
    results.push(await registrationFlow(opened, 'public_partner')); await opened.context.close();
    for (const state of ['logged-in','disabled']) {
      const statePage = await openFixture('partner-' + state, { browser });
      assert.equal(await statePage.page.locator('[data-public-register],[data-public-registration]').count(), 0);
      results.push({ check: state + '-no-guest-registration', status: 'PASS' }); await statePage.context.close();
    }
    writeEvidence('browser-public-partner-interaction-qa.json', { status: 'PASS', results }); console.log(`Public Partner interaction QA passed (${results.length} groups)`);
  } catch (error) { writeEvidence('browser-public-partner-interaction-qa.json', { status: 'FAIL', error: error.stack, results }); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
