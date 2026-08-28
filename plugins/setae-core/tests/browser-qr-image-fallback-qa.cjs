const assert = require('node:assert/strict');
const { openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

(async () => {
  const { browser, page } = await openFixture({ view: 'qr', viewport: { width: 390, height: 844 } });
  try {
    const result = await page.evaluate(() => window.v244Harness.runQrImageFallback());
    assert.equal(result.code, 'v24b');
    assert.ok(result.width > 0 && result.width <= 1400);
    assert.ok(result.height > 0 && result.height <= 1400);
    writeEvidence('browser-qr-image-fallback-qa.json', { status: 'PASS', path: 'HTMLImageElement/Object URL fallback', result });
    console.log('QR image fallback browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
