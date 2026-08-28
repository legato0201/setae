const assert = require('node:assert/strict');
const { openFixture, writeEvidence } = require('./browser-v245-helpers.cjs');

async function pointerGesture(page, selector, points, pointerId = 1) {
  await page.locator(selector).evaluate((element, input) => {
    const [first, ...rest] = input.points;
    const dispatch = (type, point) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: input.pointerId,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: point.x,
      clientY: point.y
    }));
    dispatch('pointerdown', first);
    rest.slice(0, -1).forEach((point) => dispatch('pointermove', point));
    dispatch('pointerup', rest.at(-1));
  }, { points, pointerId });
}

(async () => {
  const { browser, context, page, issues } = await openFixture('mobile-gestures-v245.html');
  const results = [];
  try {
    await pointerGesture(page, '[data-app-main]', [{ x: 8, y: 180 }, { x: 20, y: 270 }, { x: 24, y: 300 }]);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 0);
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#fixture-root').evaluate((element) => element.classList.contains('is-edge-swipe-tracking') || element.classList.contains('is-edge-swipe-settling')), false);
    await pointerGesture(page, '[data-app-main]', [{ x: 8, y: 180 }, { x: 70, y: 182 }, { x: 130, y: 184 }], 2);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 1);
    results.push({ check: 'edge-threshold-and-vertical-cancel', status: 'PASS' });

    await page.locator('#gesture-page-input').fill('未保存');
    await pointerGesture(page, '[data-app-main]', [{ x: 8, y: 180 }, { x: 80, y: 182 }, { x: 132, y: 184 }], 3);
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 1);
    assert.equal(await page.locator('#fixture-root').evaluate((element) => element.classList.contains('is-edge-swipe-tracking')), false);
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await page.locator('#gesture-page-input').inputValue(), '未保存');
    await pointerGesture(page, '[data-app-main]', [{ x: 8, y: 180 }, { x: 80, y: 182 }, { x: 132, y: 184 }], 4);
    await page.getByRole('button', { name: '変更を破棄' }).click();
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 2);
    results.push({ check: 'edge-dirty-guard-and-focus-return', status: 'PASS' });

    await page.getByRole('button', { name: 'Sheetを開く', exact: true }).click();
    await pointerGesture(page, '.sheet-handle', [{ x: 195, y: 20 }, { x: 195, y: 90 }, { x: 195, y: 150 }], 5);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().sheetOpen), false);
    results.push({ check: 'sheet-down-swipe-dismiss', status: 'PASS' });

    await page.getByRole('button', { name: 'Sheetを開く', exact: true }).click();
    await page.locator('#gesture-sheet-input').fill('入力中');
    await pointerGesture(page, '.sheet-handle', [{ x: 195, y: 20 }, { x: 195, y: 100 }, { x: 195, y: 160 }], 6);
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().sheetOpen), true);
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await page.locator('#gesture-sheet-input').inputValue(), '入力中');
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.getByRole('button', { name: '変更を破棄' }).click();
    results.push({ check: 'dirty-sheet-uses-existing-guard', status: 'PASS' });

    await page.getByRole('button', { name: 'Busy Sheetを開く' }).click();
    await pointerGesture(page, '.sheet-handle', [{ x: 195, y: 20 }, { x: 195, y: 110 }, { x: 195, y: 170 }], 7);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().sheetOpen), true);
    await page.evaluate(() => window.__setaeGestures245.closeSheet());
    results.push({ check: 'busy-sheet-blocks-drag', status: 'PASS' });

    await page.getByRole('button', { name: 'Sheetを開く', exact: true }).click();
    await page.locator('#gesture-sheet-input').focus();
    await page.evaluate(() => window.__setaeGestures245.setKeyboard(true));
    await pointerGesture(page, '.sheet-handle', [{ x: 195, y: 20 }, { x: 195, y: 80 }, { x: 195, y: 140 }], 8);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().sheetOpen), true);
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'gesture-sheet-input');
    await page.evaluate(() => window.__setaeGestures245.setKeyboard(false));
    await pointerGesture(page, '.sheet-handle', [{ x: 195, y: 20 }, { x: 195, y: 90 }, { x: 195, y: 150 }], 9);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().sheetOpen), false);
    results.push({ check: 'keyboard-first-drag-only-blurs', status: 'PASS' });

    await page.evaluate(() => window.__setaeGestures245.setTab('overview'));
    await pointerGesture(page, '[data-specimen-tab-content]', [{ x: 310, y: 420 }, { x: 220, y: 422 }, { x: 150, y: 424 }], 10);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().activeTab), 'timeline');
    await pointerGesture(page, '[data-specimen-tab-content]', [{ x: 90, y: 420 }, { x: 170, y: 422 }, { x: 250, y: 424 }], 11);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().activeTab), 'overview');
    await pointerGesture(page, '[data-specimen-tab-content]', [{ x: 90, y: 420 }, { x: 180, y: 422 }, { x: 260, y: 424 }], 12);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().activeTab), 'overview');
    results.push({ check: 'tab-next-previous-and-first-boundary', status: 'PASS' });

    await pointerGesture(page, '.fixture-horizontal-scroll', [{ x: 160, y: 520 }, { x: 90, y: 522 }, { x: 30, y: 524 }], 13);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().activeTab), 'overview');
    await pointerGesture(page, '#gesture-page-input', [{ x: 5, y: 120 }, { x: 80, y: 122 }, { x: 150, y: 124 }], 14);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 2);
    results.push({ check: 'blocked-control-and-horizontal-scroller', status: 'PASS' });

    await page.evaluate(() => {
      window.__setaeGestures245.setStandalone(false);
      window.__setaeGestures245.setReducedMotion(true);
    });
    await pointerGesture(page, '[data-app-main]', [{ x: 8, y: 180 }, { x: 80, y: 182 }, { x: 140, y: 184 }], 15);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().backCount), 2);
    await pointerGesture(page, '[data-specimen-tab-content]', [{ x: 310, y: 420 }, { x: 220, y: 422 }, { x: 150, y: 424 }], 16);
    assert.equal(await page.evaluate(() => window.__setaeGestures245.state().activeTab), 'timeline');
    assert.equal(await page.locator('[data-specimen-tab-content]').evaluate((element) => element.classList.contains('is-tab-swipe-tracking') || element.classList.contains('is-tab-swipe-settling')), false);
    results.push({ check: 'browser-edge-disabled-and-reduced-motion-cleanup', status: 'PASS' });

    assert.deepEqual(issues, []);
    writeEvidence('browser-mobile-gestures-qa.json', { results, diagnostic: await page.evaluate(() => window.__setaeGestures245.gestures.snapshot()) });
    console.log(`Mobile gesture browser QA passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
