const assert = require('node:assert/strict');
const { median, openRuntime, round, writeEvidence } = require('./browser-v243-helpers.cjs');

const iterations = Number(process.env.SETAE_PERF_ITERATIONS || 15);

(async () => {
  const runtime = await openRuntime();
  const { browser, page } = runtime;
  const results = [];
  const imageRequests = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image') imageRequests.push(request.url());
  });
  try {
    for (const operation of ['toast', 'modal', 'sync', 'update', 'error']) {
      const imagesBefore = imageRequests.length;
      const result = await page.evaluate(({ name, sampleCount }) => {
        const pageRoot = document.querySelector('[data-app-page-root]');
        const firstRow = document.querySelector('[data-record-id]');
        let pageMutations = 0;
        const durations = [];
        const observer = new MutationObserver((mutations) => { pageMutations += mutations.length; });
        observer.observe(pageRoot, { childList: true, subtree: true, attributes: true });
        for (let index = 0; index < sampleCount; index += 1) {
          durations.push(window.v243Harness.transient(name, true));
          window.v243Harness.transient(name, false);
        }
        observer.disconnect();
        return {
          operation: name,
          durations,
          pageIdentity: pageRoot === document.querySelector('[data-app-page-root]'),
          firstRowIdentity: firstRow === document.querySelector('[data-record-id]'),
          pageMutations,
          rowCount: document.querySelectorAll('[data-record-id]').length
        };
      }, { name: operation, sampleCount: iterations });
      await page.waitForTimeout(20);
      result.imageRequests = imageRequests.length - imagesBefore;
      assert.equal(result.pageIdentity, true, `${operation}: page root changed`);
      assert.equal(result.firstRowIdentity, true, `${operation}: first row changed`);
      assert.equal(result.pageMutations, 0, `${operation}: page mutated`);
      assert.equal(result.rowCount, 100, `${operation}: row count changed`);
      assert.equal(result.imageRequests, 0, `${operation}: image requested again`);
      const medianMs = round(median(result.durations));
      if (operation === 'toast') assert.ok(medianMs <= 16, `Toast ${medianMs}ms`);
      if (operation === 'modal') assert.ok(medianMs <= 50, `Modal ${medianMs}ms`);
      results.push({ ...result, durations: undefined, iterations, medianMs, status: 'PASS' });
    }

    const continuity = await page.evaluate(() => {
      window.v243Harness.mountContinuity();
      const pageRoot = document.querySelector('[data-app-page-root]');
      const draft = document.querySelector('#runtime-draft');
      const video = document.querySelector('#runtime-camera');
      const stream = video.runtimeStream;
      draft.focus();
      draft.value = '脱皮前の兆候を確認中';
      draft.setSelectionRange(4, 9);
      const activeBefore = document.activeElement;
      ['toast', 'sync', 'update', 'error'].forEach((name) => window.v243Harness.transient(name, true));
      return {
        pageIdentity: pageRoot === document.querySelector('[data-app-page-root]'),
        draftIdentity: draft === document.querySelector('#runtime-draft'),
        videoIdentity: video === document.querySelector('#runtime-camera'),
        streamIdentity: stream === document.querySelector('#runtime-camera').runtimeStream,
        activeIdentity: activeBefore === document.activeElement,
        value: draft.value,
        selectionStart: draft.selectionStart,
        selectionEnd: draft.selectionEnd
      };
    });
    assert.deepEqual(continuity, {
      pageIdentity: true,
      draftIdentity: true,
      videoIdentity: true,
      streamIdentity: true,
      activeIdentity: true,
      value: '脱皮前の兆候を確認中',
      selectionStart: 4,
      selectionEnd: 9
    });
    results.push({ operation: 'draft-camera-continuity', ...continuity, status: 'PASS' });

    writeEvidence('browser-render-islands-qa.json', { iterations, results });
    console.log(`Render island browser QA passed (${results.length} checks)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
