const assert = require('node:assert/strict');
const { launchBrowser, openFixture, openShare, registrationFlow, writeEvidence } = require('./browser-v248-helpers.cjs');
const results = [];
(async () => {
  const browser = await launchBrowser();
  try {
    const opened = await openFixture('care-photo', { browser, viewport: { width: 390, height: 1000 } }); const { page } = opened;
    assert.equal(await page.locator('main h1').textContent(), '給餌の記録');
    assert.equal(await page.locator('.setae-care-share-responses').count(), 1); assert.equal(await page.locator('.setae-care-share-comment').count(), 3);
    const profile = await page.locator('.setae-care-share-profile-link').getAttribute('href'); assert.match(profile, /setae-user\//);
    assert.equal(await page.locator('main .setae-public-button.is-primary').count(), 1);
    results.push({ check: 'record-first-structure-approved-comments-profile-link-primary', status: 'PASS' });
    await openShare(page); const menu = page.locator('[data-public-share-menu]');
    await menu.locator('[data-public-share-action="link"]').focus(); await page.keyboard.press('Escape');
    assert.equal(await menu.evaluate((node) => node.open), false); assert.equal(await menu.locator('summary').evaluate((node) => node === document.activeElement), true);
    await openShare(page); await page.locator('h1').click(); assert.equal(await menu.evaluate((node) => node.open), false);
    results.push({ check: 'share-menu-keyboard-escape-focus-return-and-outside-close', status: 'PASS' });
    results.push(await registrationFlow(opened, 'public_care_share')); await opened.context.close();
    for (const state of ['logged-in','disabled','not-found']) {
      const statePage = await openFixture('care-' + state, { browser });
      assert.equal(await statePage.page.locator('[data-public-register],[data-public-registration]').count(), 0);
      if (state === 'not-found') assert.equal(await statePage.page.locator('[data-public-share-action]').count(), 0);
      results.push({ check: state + '-no-registration-or-private-interactions', status: 'PASS' }); await statePage.context.close();
    }
    writeEvidence('browser-public-care-share-interaction-qa.json', { status: 'PASS', results }); console.log(`Public Care Share interaction QA passed (${results.length} groups)`);
  } catch (error) { writeEvidence('browser-public-care-share-interaction-qa.json', { status: 'FAIL', error: error.stack, results }); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
