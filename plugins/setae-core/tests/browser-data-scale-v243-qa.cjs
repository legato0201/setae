const assert = require('node:assert/strict');
const { median, openRuntime, round, writeEvidence } = require('./browser-v243-helpers.cjs');

const iterations = Number(process.env.SETAE_PERF_ITERATIONS || 15);

(async () => {
  const runtime = await openRuntime();
  const { browser, page } = runtime;
  try {
    await page.evaluate(() => {
      window.__v243LongTasks = [];
      if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        new PerformanceObserver((list) => window.__v243LongTasks.push(...list.getEntries().map((entry) => entry.duration)))
          .observe({ type: 'longtask', buffered: true });
      }
    });

    const samples = { recordsInitial: [], recordsAdd: [], nurseryInitial: [], nurseryAdd: [], search: [] };
    const identity = { recordsIdentity: true, nurseryIdentity: true };
    for (let index = 0; index < iterations; index += 1) {
      samples.recordsInitial.push(await page.evaluate(() => {
        const startedAt = performance.now();
        window.v243Harness.mountRecords(100);
        document.querySelector('[data-app-page-root]').offsetHeight;
        return performance.now() - startedAt;
      }));
      const recordAdd = await page.evaluate(() => {
        const first = document.querySelector('[data-record-id]');
        const result = window.v243Harness.addRecords();
        return { ...result, identity: first === document.querySelector('[data-record-id]') };
      });
      samples.recordsAdd.push(recordAdd.duration);
      identity.recordsIdentity &&= recordAdd.identity;

      samples.nurseryInitial.push(await page.evaluate(() => {
        const startedAt = performance.now();
        window.v243Harness.mountNursery(100);
        document.querySelector('[data-app-page-root]').offsetHeight;
        return performance.now() - startedAt;
      }));
      const nurseryAdd = await page.evaluate(() => {
        const first = document.querySelector('[data-nursery-item-code]');
        const result = window.v243Harness.addNursery();
        return { ...result, identity: first === document.querySelector('[data-nursery-item-code]') };
      });
      samples.nurseryAdd.push(nurseryAdd.duration);
      identity.nurseryIdentity &&= nurseryAdd.identity;
      await page.evaluate(() => window.v243Harness.nextFrame());
    }
    await page.evaluate(() => window.v243Harness.mountSearch());
    for (let index = 0; index < iterations; index += 1) {
      samples.search.push(await page.evaluate(() => window.v243Harness.search('seladonia').duration));
      await page.evaluate(() => window.v243Harness.nextFrame());
    }

    const summary = await page.evaluate(() => {
      const h = window.v243Harness;
      h.mountRecords(100);
      const recordsInitialRows = document.querySelectorAll('[data-record-id]').length;
      h.addRecords();
      const recordsAddedRows = document.querySelectorAll('[data-record-id]').length;
      h.mountNursery(100);
      const nurseryInitialRows = document.querySelectorAll('[data-nursery-item-code]').length;
      const nurseryTables = document.querySelectorAll('.nursery-specimen-registry table').length;
      h.addNursery();
      return {
        counts: {
          recordsInitialRows,
          recordsAddedRows,
          recordsTotal: h.records.length,
          nurseryInitialRows,
          nurseryAddedRows: document.querySelectorAll('[data-nursery-item-code]').length,
          nurseryTotal: h.nursery.items.length,
          nurseryTables
        },
        bulkTargetsWholeGroup: Boolean(document.querySelector('[data-action="baby-bulk"][data-group-id="3"]'))
      };
    });
    const measurement = { samples, identity, ...summary };

    await page.waitForTimeout(150);
    const longTasks = await page.evaluate(() => window.__v243LongTasks || []);
    const performance = {
      recordsInitialMedianMs: round(median(measurement.samples.recordsInitial)),
      recordsInitialMaxMs: round(Math.max(...measurement.samples.recordsInitial)),
      recordsAddMedianMs: round(median(measurement.samples.recordsAdd)),
      nurseryInitialMedianMs: round(median(measurement.samples.nurseryInitial)),
      nurseryAddMedianMs: round(median(measurement.samples.nurseryAdd)),
      collectionSearchMedianMs: round(median(measurement.samples.search)),
      collectionSearchTargetMs: 16,
      collectionSearchBaselineMs: 21.8,
      longTasksOver100Ms: longTasks.filter((duration) => duration > 100).map(round)
    };
    performance.collectionSearchTargetMet = performance.collectionSearchMedianMs <= performance.collectionSearchTargetMs;
    performance.collectionSearchImproved = performance.collectionSearchMedianMs < performance.collectionSearchBaselineMs;
    // Keep raw samples even when a strict gate fails below; this is measurement, not a PASS report.
    writeEvidence('browser-data-scale-v243-measurements.json', {
      iterations,
      ...measurement,
      performance
    });

    assert.deepEqual(measurement.counts, {
      recordsInitialRows: 100,
      recordsAddedRows: 200,
      recordsTotal: 1000,
      nurseryInitialRows: 100,
      nurseryAddedRows: 200,
      nurseryTotal: 500,
      nurseryTables: 1
    });
    assert.equal(measurement.identity.recordsIdentity, true);
    assert.equal(measurement.identity.nurseryIdentity, true);
    assert.equal(measurement.bulkTargetsWholeGroup, true);
    assert.ok(performance.recordsInitialMedianMs <= 80, `Records initial ${performance.recordsInitialMedianMs}ms`);
    assert.ok(performance.recordsInitialMaxMs < 100, `Records max ${performance.recordsInitialMaxMs}ms`);
    assert.ok(performance.recordsAddMedianMs <= 50, `Records add ${performance.recordsAddMedianMs}ms`);
    assert.ok(performance.nurseryInitialMedianMs <= 60, `Nursery initial ${performance.nurseryInitialMedianMs}ms`);
    assert.ok(performance.nurseryAddMedianMs <= 40, `Nursery add ${performance.nurseryAddMedianMs}ms`);
    assert.ok(performance.collectionSearchTargetMet || performance.collectionSearchImproved,
      `Search ${performance.collectionSearchMedianMs}ms did not improve on ${performance.collectionSearchBaselineMs}ms`);
    assert.equal(performance.longTasksOver100Ms.length, 0);

    const responsive = [];
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width <= 430 ? 844 : 1000 });
      await page.evaluate(() => window.v243Harness.mountNursery(100));
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        tables: document.querySelectorAll('.nursery-specimen-registry table').length,
        rows: document.querySelectorAll('[data-nursery-item-code]').length
      }));
      assert.equal(geometry.overflow, false, `${width}px overflow`);
      assert.equal(geometry.tables, 1, `${width}px duplicate table`);
      responsive.push(geometry);
    }

    writeEvidence('browser-data-scale-v243-qa.json', {
      iterations,
      counts: measurement.counts,
      identity: measurement.identity,
      bulkTargetsWholeGroup: measurement.bulkTargetsWholeGroup,
      performance,
      responsive
    });
    console.log(`Data scale browser QA passed (${iterations} samples)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
