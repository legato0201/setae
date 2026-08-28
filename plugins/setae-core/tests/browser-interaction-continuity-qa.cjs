const assert = require('node:assert/strict');
const { openRuntime, round, writeEvidence } = require('./browser-v243-helpers.cjs');

(async () => {
  const runtime = await openRuntime({ viewport: { width: 1280, height: 760 } });
  const { browser, page } = runtime;
  const results = [];
  try {
    for (const kind of ['records', 'nursery']) {
      const result = await page.evaluate(async (listKind) => {
        const h = window.v243Harness;
        if (listKind === 'nursery') h.mountNursery(100);
        else h.mountRecords(100);
        const action = listKind === 'nursery' ? 'show-more-nursery-items' : 'show-more-records';
        const firstSelector = listKind === 'nursery' ? '[data-nursery-item-code]' : '[data-record-id]';
        const first = document.querySelector(firstSelector);
        const button = document.querySelector(`[data-action="${action}"]`);
        window.scrollTo(0, Math.max(0, button.getBoundingClientRect().top + window.scrollY - 300));
        button.focus({ preventScroll: true });
        const beforeScroll = window.scrollY;
        const response = await h.loadMoreWithContinuity(listKind);
        return {
          kind: listKind,
          beforeScroll,
          afterScroll: response.scrollY,
          focusAction: response.activeAction,
          firstIdentity: first === document.querySelector(firstSelector),
          count: response.count
        };
      }, kind);
      assert.ok(Math.abs(result.beforeScroll - result.afterScroll) <= 1, `${kind}: scroll moved`);
      assert.equal(result.focusAction, kind === 'nursery' ? 'show-more-nursery-items' : 'show-more-records');
      assert.equal(result.firstIdentity, true);
      assert.equal(result.count, 200);
      results.push({ ...result, beforeScroll: round(result.beforeScroll), afterScroll: round(result.afterScroll), status: 'PASS' });
    }

    const backRestore = await page.evaluate(() => {
      const h = window.v243Harness;
      h.mountRecords(100);
      h.addRecords();
      window.scrollTo(0, 900);
      const route = { limit: h.recordsLimit(), scrollY: window.scrollY };
      h.mountContinuity();
      h.mountRecords(route.limit);
      window.scrollTo(0, route.scrollY);
      return {
        savedLimit: route.limit,
        restoredRows: document.querySelectorAll('[data-record-id]').length,
        savedScroll: route.scrollY,
        restoredScroll: window.scrollY
      };
    });
    assert.equal(backRestore.savedLimit, 200);
    assert.equal(backRestore.restoredRows, 200);
    assert.ok(Math.abs(backRestore.savedScroll - backRestore.restoredScroll) <= 1);
    results.push({ operation: 'route-back-restore', ...backRestore, status: 'PASS' });

    const transient = await page.evaluate(() => {
      const h = window.v243Harness;
      h.mountContinuity();
      window.scrollTo(0, 1100);
      const pageRoot = document.querySelector('[data-app-page-root]');
      const draft = document.querySelector('#runtime-draft');
      const video = document.querySelector('#runtime-camera');
      const stream = video.runtimeStream;
      draft.focus({ preventScroll: true });
      draft.value = '入力途中の観察記録';
      draft.setSelectionRange(2, 7);
      const scrollY = window.scrollY;
      const scrolls = ['modal', 'toast', 'sync', 'update'].map((name) => {
        h.transient(name, true);
        return { name, scrollY: window.scrollY };
      });
      return {
        pageIdentity: pageRoot === document.querySelector('[data-app-page-root]'),
        draftIdentity: draft === document.querySelector('#runtime-draft'),
        videoIdentity: video === document.querySelector('#runtime-camera'),
        streamIdentity: stream === document.querySelector('#runtime-camera').runtimeStream,
        activeIdentity: draft === document.activeElement,
        value: draft.value,
        selectionStart: draft.selectionStart,
        selectionEnd: draft.selectionEnd,
        scrollBefore: scrollY,
        scrollAfter: window.scrollY,
        scrolls
      };
    });
    assert.equal(transient.pageIdentity, true);
    assert.equal(transient.draftIdentity, true);
    assert.equal(transient.videoIdentity, true);
    assert.equal(transient.streamIdentity, true);
    assert.equal(transient.activeIdentity, true);
    assert.equal(transient.value, '入力途中の観察記録');
    assert.equal(transient.selectionStart, 2);
    assert.equal(transient.selectionEnd, 7);
    assert.ok(Math.abs(transient.scrollBefore - transient.scrollAfter) <= 1,
      `transient scroll moved ${transient.scrollBefore} -> ${transient.scrollAfter}: ${JSON.stringify(transient.scrolls)}`);
    results.push({ operation: 'transient-continuity', ...transient, status: 'PASS' });

    writeEvidence('browser-interaction-continuity-qa.json', { results });
    console.log(`Interaction continuity browser QA passed (${results.length} checks)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
