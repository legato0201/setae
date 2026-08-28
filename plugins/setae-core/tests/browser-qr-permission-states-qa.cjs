const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

(async () => {
  const states = [];
  const { browser, page } = await openFixture({ view: 'qr', viewport: { width: 390, height: 844 } });
  try {
    await page.getByText('映像は端末内で処理され、アップロードされません。').waitFor();
    assert.equal(await page.locator('input[type="file"][data-role="qr-image-input"]').getAttribute('capture'), null);
    assert.equal(await page.locator('.qr-scan-frame').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('[data-role="qr-scan-status"]').getAttribute('aria-live'), 'polite');

    const names = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError', 'UnknownError'];
    for (const name of names) {
      const result = await page.evaluate((value) => window.v244Harness.renderCameraState(value), name);
      const rendered = await page.locator('[data-role="qr-scan-status"]').textContent();
      assert.equal(rendered, result.message);
      assert.equal(await page.locator('.qr-camera-stage').getAttribute('data-camera-state'), result.state);
      states.push({ name, ...result });
    }
    assert.deepEqual(states.map((item) => item.state), ['denied', 'unavailable', 'busy', 'unavailable', 'error']);
    await page.screenshot({ path: path.join(evidenceDir, 'qr-permission-error-state.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  const requesting = await openFixture({ view: 'qr', query: { camera: 'requesting' }, viewport: { width: 390, height: 844 } });
  try {
    const start = requesting.page.getByRole('button', { name: /準備中/ });
    assert.equal(await start.isDisabled(), true);
    assert.match(await requesting.page.locator('[data-role="qr-scan-status"]').textContent(), /準備しています/);
    writeEvidence('browser-qr-permission-states-qa.json', { status: 'PASS', states, requesting: 'PASS' });
    console.log('QR permission state browser QA passed');
  } finally {
    await requesting.browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
