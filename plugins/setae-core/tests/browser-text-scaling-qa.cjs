const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

const views = ['today', 'collection', 'intake', 'quick', 'records', 'nursery', 'husbandry', 'qr', 'settings', 'modal', 'sheet'];

(async () => {
  const results = [];
  for (const view of views) {
    const { browser, page } = await openFixture({ view, viewport: { width: 390, height: 844 } });
    try {
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await page.waitForTimeout(80);
      const result = await page.evaluate(() => {
        const ignored = (element) => Boolean(element.closest('.label-preview-canvas,[data-field-label]'));
        const visible = (element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const clippedButtons = [...document.querySelectorAll('button')].filter((button) => visible(button) && !ignored(button) && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)).map((button) => button.textContent.trim());
        const outsideInputs = [...document.querySelectorAll('input,select,textarea')].filter((field) => visible(field) && !ignored(field)).filter((field) => {
          const rect = field.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }).map((field) => field.name || field.id || field.type);
        const mobileBar = document.querySelector('.mobile-app-bar');
        const firstPageContent = document.querySelector('[data-app-page-root] > *');
        const mobileBarRect = visible(mobileBar) ? mobileBar.getBoundingClientRect() : null;
        const firstPageRect = firstPageContent?.getBoundingClientRect?.() || null;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          clippedButtons,
          outsideInputs,
          mobileBarBottom: mobileBarRect?.bottom || 0,
          firstPageTop: firstPageRect?.top || 0,
          topContentClear: !mobileBarRect || !firstPageRect || firstPageRect.top >= mobileBarRect.bottom - 1,
          scrollHeight: document.documentElement.scrollHeight,
          importantVisible: document.querySelectorAll('h1,[role="dialog"],.quick-record-shell,.qr-workspace').length > 0
        };
      });
      assert.ok(result.scrollWidth <= result.viewportWidth + 1, `${view}: horizontal overflow ${result.scrollWidth}/${result.viewportWidth}`);
      assert.deepEqual(result.clippedButtons, [], `${view}: clipped button labels`);
      assert.deepEqual(result.outsideInputs, [], `${view}: fields outside viewport`);
      assert.equal(result.topContentClear, true, `${view}: page content overlaps the mobile app bar`);
      assert.equal(result.importantVisible, true, `${view}: primary content hidden`);
      results.push({ view, status: 'PASS', ...result });
      if (view === 'quick' || view === 'collection') await page.screenshot({ path: path.join(evidenceDir, `text-scaling-${view}-200.png`), fullPage: true });
    } finally {
      await browser.close();
    }
  }

  const { browser, page } = await openFixture({ view: 'semantic', viewport: { width: 320, height: 800 } });
  try {
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    const zoom = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(zoom.scrollWidth <= zoom.viewportWidth + 1, `400% equivalent overflow ${zoom.scrollWidth}/${zoom.viewportWidth}`);
    results.push({ view: '400%-equivalent', status: 'PASS', ...zoom });
  } finally {
    await browser.close();
  }

  writeEvidence('browser-text-scaling-qa.json', { status: 'PASS', rootFontScale: '200%', results });
  console.log(`Text scaling browser QA passed (${results.length} surfaces)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
