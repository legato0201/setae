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
    const sharedFrameDisplay = await page.locator('[data-media-index="0"] .setae-media-frame')
      .evaluate((frame) => getComputedStyle(frame).display);
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
    assert.equal(sharedFrameDisplay, 'grid', 'Shared media frames outside Collection thumbnails retain their grid layout');

    const print = await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      return [...document.querySelectorAll('[data-media-image]')].every((image) => image.loading === 'eager');
    });
    assert.equal(print, true);
    await page.waitForTimeout(300);
    const requestsAfterPrint = requests.length;

    const mountedCollectionRows = await page.evaluate(async () => {
      const viewUrl = new URL('../../assets/app/features/collection/view.js', location.href).href;
      const { renderCollectionSearchResults } = await import(viewUrl);
      const asset = new URL('../../assets/app/icons/setae-icon-192.png?runtime-media=collection-success', location.href).href;
      const missing = new URL('./missing-collection-thumbnail.png?runtime-media=collection-broken', location.href).href;
      const animals = [
        { id: 9001, individual_code: 'MEDIA-OK', species_name: 'Typhochlaena seladonia', classification: 'tarantula', image_url: asset, status: 'normal' },
        { id: 9002, individual_code: 'MEDIA-ERROR', species_name: 'Typhochlaena seladonia', classification: 'tarantula', image_url: missing, status: 'normal' },
        { id: 9003, individual_code: 'MEDIA-EMPTY', species_name: 'Typhochlaena seladonia', classification: 'tarantula', status: 'normal' }
      ];
      document.querySelector('[data-app-page-root]').innerHTML = `<main class="page"><div data-collection-search-media>${renderCollectionSearchResults({
        animals,
        mode: 'table',
        search: 'seladonia',
        activeView: { id: 'all', title: 'すべて', query: {} },
        selection: { selectedId: null, selectedIds: [], selectionMode: false }
      })}</div></main>`;
      return document.querySelectorAll('[data-collection-search-media] [data-collection-animal]').length;
    });
    assert.equal(mountedCollectionRows, 3, 'The real Collection search renderer must retain every matching media case');
    await page.waitForFunction(() => {
      const success = document.querySelector('[data-animal-id="9001"] [data-media-image]');
      const broken = document.querySelector('[data-animal-id="9002"] [data-setae-media]');
      return success?.complete && success.naturalWidth > 0 && broken?.classList.contains('is-media-error');
    }, null, { timeout: 5000 });
    const collection = await page.evaluate(() => ({
      resultCount: document.querySelector('[data-collection-search-media] [data-role="collection-result-count"] strong')?.textContent || '',
      items: [...document.querySelectorAll('[data-collection-search-media] [data-collection-animal]')].map((row) => {
        const thumbnail = row.querySelector('.registry-thumbnail');
        const frame = thumbnail.querySelector('.setae-media-frame');
        const visual = frame.querySelector('.setae-media-visual');
        const image = frame.querySelector('[data-media-image]');
        const fallback = frame.querySelector('[data-media-fallback]');
        const rect = (node) => {
          const bounds = node.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        };
        return {
          id: row.dataset.animalId,
          rowIndex: row.getAttribute('aria-rowindex'),
          selected: row.getAttribute('aria-selected'),
          tabIndex: row.tabIndex,
          frameDisplay: getComputedStyle(frame).display,
          captions: frame.querySelectorAll('figcaption').length,
          thumbnail: rect(thumbnail),
          frame: rect(frame),
          visual: rect(visual),
          imagePresent: Boolean(image),
          imageHidden: image?.hidden ?? null,
          imageAlt: image?.alt || '',
          imageState: image?.dataset.mediaLoadState || '',
          loading: image?.loading || '',
          decoding: image?.decoding || '',
          fetchPriority: image?.fetchPriority || '',
          fallbackHidden: fallback.hidden,
          fallbackRole: fallback.getAttribute('role'),
          fallbackLabel: fallback.getAttribute('aria-label')
        };
      })
    }));
    assert.equal(collection.resultCount, '3');
    assert.deepEqual(collection.items.map((item) => item.id), ['9001', '9002', '9003']);
    for (const [index, item] of collection.items.entries()) {
      assert.equal(item.rowIndex, String(index + 2));
      assert.equal(item.selected, 'false');
      assert.equal(item.tabIndex, 0);
      assert.equal(item.frameDisplay, 'block');
      assert.equal(item.captions, 0);
      assert.ok(item.thumbnail.width >= 44 && item.thumbnail.height >= 44);
      assert.ok(Math.abs(item.thumbnail.width - item.frame.width) < 0.5 && Math.abs(item.thumbnail.height - item.frame.height) < 0.5);
      assert.ok(Math.abs(item.thumbnail.width - item.visual.width) < 0.5 && Math.abs(item.thumbnail.height - item.visual.height) < 0.5);
      assert.equal(item.fallbackRole, 'img');
      assert.equal(item.fallbackLabel, '標本写真は未登録です');
    }
    assert.deepEqual(collection.items.slice(1).map((item) => item.thumbnail),
      [collection.items[0].thumbnail, collection.items[0].thumbnail], 'Success, error and empty thumbnails retain identical dimensions');
    assert.deepEqual({ present: collection.items[0].imagePresent, hidden: collection.items[0].imageHidden,
      alt: collection.items[0].imageAlt, state: collection.items[0].imageState, loading: collection.items[0].loading,
      decoding: collection.items[0].decoding, priority: collection.items[0].fetchPriority,
      fallbackHidden: collection.items[0].fallbackHidden },
    { present: true, hidden: false, alt: 'MEDIA-OK', state: 'loaded', loading: 'lazy', decoding: 'async',
      priority: 'low', fallbackHidden: true });
    assert.equal(collection.items[1].imagePresent, true);
    assert.equal(collection.items[1].imageHidden, true);
    assert.ok(['error', 'timeout'].includes(collection.items[1].imageState));
    assert.equal(collection.items[1].fallbackHidden, false);
    assert.deepEqual({ present: collection.items[2].imagePresent, hidden: collection.items[2].imageHidden,
      alt: collection.items[2].imageAlt, state: collection.items[2].imageState },
    { present: false, hidden: null, alt: '', state: '' });
    assert.equal(collection.items[2].fallbackHidden, false);

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
      sharedFrameDisplay,
      printPromotedLazyImages: print,
      collectionSearchThumbnails: collection
    });
    console.log(`Media loading browser QA passed (${initialRequestCount}/${result.imageCount} initial requests)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
