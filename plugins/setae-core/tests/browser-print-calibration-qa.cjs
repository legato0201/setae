const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

const expectedPx = (millimeters) => millimeters * 96 / 25.4;
const within = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;

(async () => {
  const { browser, context, page } = await openFixture({ view: 'semantic', viewport: { width: 1280, height: 900 } });
  try {
    const documents = await page.evaluate(() => ({
      a4: window.v244Harness.buildPrintCalibrationDocument({ type: 'a4', version: '1.0.244' }).html,
      tape: window.v244Harness.buildPrintCalibrationDocument({ type: 'tape', version: '1.0.244' }).html
    }));
    assert.ok(documents.a4 && documents.tape);

    const a4Page = await context.newPage();
    await a4Page.setContent(documents.a4, { waitUntil: 'load' });
    const a4 = await a4Page.evaluate(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return { width: value.width, height: value.height };
      };
      return { horizontal: rect('.calibration-horizontal'), vertical: rect('.calibration-vertical'), square: rect('.calibration-square'), qr: rect('.calibration-qr') };
    });
    assert.ok(within(a4.horizontal.width, expectedPx(50), expectedPx(.5)));
    assert.ok(within(a4.vertical.height, expectedPx(50), expectedPx(.5)));
    assert.ok(within(a4.square.width, expectedPx(20), expectedPx(.3)));
    assert.ok(within(a4.square.height, expectedPx(20), expectedPx(.3)));
    assert.ok(within(a4.qr.width, expectedPx(25), expectedPx(.3)));
    await a4Page.screenshot({ path: path.join(evidenceDir, 'a4-calibration-browser.png'), fullPage: true });
    await a4Page.pdf({ path: path.join(evidenceDir, 'a4-calibration-browser.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });

    const tapePage = await context.newPage();
    await tapePage.setContent(documents.tape, { waitUntil: 'load' });
    const tape = await tapePage.evaluate(() => [...document.querySelectorAll('.tape-calibration-strip')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.querySelector('strong').textContent.trim(), width: rect.width, height: rect.height };
    }));
    assert.equal(tape.length, 5);
    [18, 24, 36, 50, 70].forEach((length, index) => {
      assert.equal(tape[index].label, `${length} × 12 mm`);
      assert.ok(within(tape[index].width, expectedPx(length), expectedPx(.5)));
      assert.ok(within(tape[index].height, expectedPx(12), expectedPx(.3)));
    });
    assert.equal(await tapePage.getByText('MICRO ID').count(), 1);
    await tapePage.screenshot({ path: path.join(evidenceDir, 'tape-calibration-browser.png'), fullPage: true });
    writeEvidence('browser-print-calibration-qa.json', { status: 'PASS', scope: 'browser CSS geometry only; physical print NOT RUN', a4, tape });
    console.log('Print calibration browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
