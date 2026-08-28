const assert = require('node:assert/strict');
const { openRuntime, round, writeEvidence } = require('./browser-v243-helpers.cjs');

(async () => {
  const runtime = await openRuntime({ viewport: { width: 1280, height: 900 } });
  const { browser, page } = runtime;
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('runtime-media=')) requests.push(request.url());
  });
  try {
    await page.evaluate(() => {
      window.__v243Cls = 0;
      if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
        new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) window.__v243Cls += entry.value;
        })).observe({ type: 'layout-shift', buffered: true });
      }
      window.v243Harness.mountMedia();
    });
    const geometryBefore = await page.locator('[data-media-index="0"] .setae-media-frame').boundingBox();
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const hero = document.querySelector('[data-media-index="0"] [data-media-image]');
      const listImage = document.querySelector('[data-media-index="1"] [data-media-image]');
      const offscreen = document.querySelector('[data-media-index="99"] [data-media-image]');
      const brokenFrame = document.querySelector('[data-broken-media] [data-setae-media]');
      return {
        imageCount: document.querySelectorAll('[data-media-image]').length,
        hero: {
          loading: hero.loading,
          decoding: hero.decoding,
          fetchPriority: hero.fetchPriority,
          width: Number(hero.getAttribute('width')),
          height: Number(hero.getAttribute('height'))
        },
        list: {
          loading: listImage.loading,
          decoding: listImage.decoding,
          fetchPriority: listImage.fetchPriority,
          width: Number(listImage.getAttribute('width')),
          height: Number(listImage.getAttribute('height'))
        },
        offscreenState: offscreen.dataset.mediaLoadState || '',
        offscreenFallbackHidden: offscreen.closest('[data-setae-media]').querySelector('[data-media-fallback]').hidden,
        brokenState: brokenFrame.querySelector('[data-media-image]').dataset.mediaLoadState || '',
        brokenFallbackVisible: !brokenFrame.querySelector('[data-media-fallback]').hidden,
        cls: window.__v243Cls || 0
      };
    });
    const geometryAfter = await page.locator('[data-media-index="0"] .setae-media-frame').boundingBox();
    const initialRequestCount = requests.length;

    assert.equal(result.imageCount, 101);
    assert.deepEqual(result.hero, { loading: 'eager', decoding: 'async', fetchPriority: 'high', width: 800, height: 800 });
    assert.deepEqual(result.list, { loading: 'lazy', decoding: 'async', fetchPriority: 'low', width: 800, height: 800 });
    assert.equal(result.offscreenState, 'idle');
    assert.equal(result.offscreenFallbackHidden, true);
    assert.ok(['error', 'timeout'].includes(result.brokenState));
    assert.equal(result.brokenFallbackVisible, true);
    assert.ok(initialRequestCount < 100, `all media requested eagerly: ${initialRequestCount}`);
    assert.ok(result.cls < 0.1, `CLS ${result.cls}`);
    assert.ok(Math.abs(geometryBefore.height - geometryAfter.height) < 1, 'media frame height shifted');

    const print = await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      return [...document.querySelectorAll('[data-media-image]')].every((image) => image.loading === 'eager');
    });
    assert.equal(print, true);
    await page.waitForTimeout(300);
    const requestsAfterPrint = requests.length;

    writeEvidence('browser-media-loading-qa.json', {
      initialRequestedImages: initialRequestCount,
      requestedImagesAfterPrintPreparation: requestsAfterPrint,
      totalImages: result.imageCount,
      attributes: { hero: result.hero, list: result.list },
      offscreen: { state: result.offscreenState, fallbackHidden: result.offscreenFallbackHidden },
      broken: { state: result.brokenState, fallbackVisible: result.brokenFallbackVisible },
      cls: round(result.cls),
      frameHeightBefore: round(geometryBefore.height),
      frameHeightAfter: round(geometryAfter.height),
      printPromotedLazyImages: print
    });
    console.log(`Media loading browser QA passed (${initialRequestCount}/${result.imageCount} initial requests)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
