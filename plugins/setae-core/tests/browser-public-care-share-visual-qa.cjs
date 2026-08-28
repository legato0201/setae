const assert = require('node:assert/strict');
const { launchBrowser, openFixture, capturePage, captureRegistration, captureThemeReset, doubleText, openShare, writeEvidence } = require('./browser-v248-helpers.cjs');
const results = [];
(async () => {
  const browser = await launchBrowser();
  try {
    for (const width of [320,360,390,768,1024,1440]) {
      for (const colorScheme of ['light','dark']) {
        const opened = await openFixture('care-photo', { browser, viewport: { width, height: 1000 }, colorScheme });
        await capturePage(opened, `care-${width}-${colorScheme}`, results); await opened.context.close();
      }
    }
    for (const state of ['no-photo','no-note','no-reactions','no-comments','long','logged-in','disabled','not-found','plant','avatar-setae','avatar-wordpress','avatar-mystery']) {
      const opened = await openFixture('care-' + state, { browser, viewport: { width: state === 'long' ? 320 : 390, height: 1000 } });
      await capturePage(opened, 'care-state-' + state, results);
      if (state === 'not-found') assert.equal(await opened.page.locator('[data-public-share-root],[data-public-registration]').count(), 0);
      if (state === 'disabled' || state === 'logged-in') assert.equal(await opened.page.locator('[data-public-registration]').count(), 0);
      await opened.context.close();
    }
    for (const mode of ['text-200','forced-colors']) {
      const opened = await openFixture('care-long', { browser, viewport: { width: mode === 'text-200' ? 320 : 390, height: 1100 }, forcedColors: mode === 'forced-colors' ? 'active' : 'none' });
      if (mode === 'text-200') await doubleText(opened.page);
      await capturePage(opened, 'care-' + mode, results);
      await openShare(opened.page); await opened.page.locator('[data-public-share-menu]').scrollIntoViewIfNeeded();
      await capturePage(opened, 'care-share-menu-' + mode, results, { fullPage: false });
      await opened.page.locator('[data-public-share-menu] summary').click();
      await captureRegistration(opened, 'care-registration-' + mode, results); await opened.context.close();
    }
    const theme = await openFixture('care-theme-reset', { browser, viewport: { width: 320, height: 1100 } });
    await captureThemeReset(theme, 'care-theme-font-reset-320', results, 30); await theme.context.close();
    writeEvidence('browser-public-care-share-visual-qa.json', { status: 'PASS', cases: results.length, verification: 'Actual production renderers, automated geometry/accessibility and PerformanceObserver lab CLS. Screenshots require visual review; no physical-device claim.', results });
    console.log(`Public Care Share visual QA passed (${results.length} cases)`);
  } catch (error) { writeEvidence('browser-public-care-share-visual-qa.json', { status: 'FAIL', error: error.stack, results }); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
