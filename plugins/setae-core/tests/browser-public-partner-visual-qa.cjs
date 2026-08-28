const assert = require('node:assert/strict');
const { launchBrowser, openFixture, capturePage, captureRegistration, captureThemeReset, doubleText, writeEvidence } = require('./browser-v248-helpers.cjs');
const results = [];
(async () => {
  const browser = await launchBrowser();
  try {
    for (const width of [320,360,390,768,1024,1440]) {
      for (const colorScheme of ['light','dark']) {
        const opened = await openFixture('partner-guest', { browser, viewport: { width, height: 1000 }, colorScheme });
        await capturePage(opened, `partner-${width}-${colorScheme}`, results);
        if ([390,1440].includes(width)) { await opened.page.locator('.setae-public-partner-copy-kit').scrollIntoViewIfNeeded(); await capturePage(opened, `partner-copy-kit-${width}-${colorScheme}`, results, { fullPage: false }); }
        await opened.context.close();
      }
    }
    for (const state of ['logged-in','disabled','long']) {
      const opened = await openFixture('partner-' + state, { browser, viewport: { width: 320, height: 1000 } });
      await capturePage(opened, 'partner-state-' + state, results);
      if (state !== 'long') assert.equal(await opened.page.locator('[data-public-registration]').count(), 0);
      await opened.context.close();
    }
    for (const mode of ['text-200','forced-colors']) {
      const opened = await openFixture('partner-long', { browser, viewport: { width: mode === 'text-200' ? 320 : 390, height: 1100 }, forcedColors: mode === 'forced-colors' ? 'active' : 'none' });
      if (mode === 'text-200') await doubleText(opened.page);
      await capturePage(opened, 'partner-' + mode, results);
      await opened.page.locator('.setae-public-partner-copy-kit').scrollIntoViewIfNeeded(); await capturePage(opened, 'partner-copy-kit-' + mode, results, { fullPage: false });
      await captureRegistration(opened, 'partner-registration-' + mode, results); await opened.context.close();
    }
    const theme = await openFixture('partner-theme-reset', { browser, viewport: { width: 320, height: 1100 } });
    await captureThemeReset(theme, 'partner-theme-font-reset-320', results, 32); await theme.context.close();
    writeEvidence('browser-public-partner-visual-qa.json', { status: 'PASS', cases: results.length, verification: 'Actual production renderers, automated geometry/accessibility and PerformanceObserver lab CLS. Screenshots require visual review; no physical-device claim.', results });
    console.log(`Public Partner visual QA passed (${results.length} cases)`);
  } catch (error) { writeEvidence('browser-public-partner-visual-qa.json', { status: 'FAIL', error: error.stack, results }); throw error; }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
