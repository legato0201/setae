const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = `${baseUrl}/tests/fixtures/product-ux-v242.html?mode=offline`;

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const context = await browser.newContext();
  const results = [];
  try {
    const desktop = await context.newPage();
    await desktop.setViewportSize({ width: 1280, height: 900 });
    await desktop.goto(fixture);
    await desktop.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('setae.gui.v2.offlineQueue.242')).forEach((key) => localStorage.removeItem(key)));
    await desktop.reload();
    await desktop.getByText(/オフラインです。操作はこの端末に保存し/).waitFor();
    await desktop.getByRole('button', { name: '給餌を記録' }).click();
    assert.equal(await desktop.locator('body').getAttribute('data-queue-count'), '1');
    await desktop.getByText(/操作をオフラインで保存しました/).first().waitFor();
    await desktop.getByRole('button', { name: '同期待ちを見る' }).waitFor();
    results.push({ check: 'desktop-offline-enqueue', status: 'PASS' });

    await desktop.getByRole('button', { name: 'オンラインへ戻す' }).click();
    assert.equal(await desktop.locator('body').getAttribute('data-sync-status'), 'syncing');
    await desktop.locator('body[data-sync-status="idle"]').waitFor();
    assert.equal(await desktop.locator('body').getAttribute('data-queue-count'), '0');
    await desktop.getByText('1件を同期しました。').waitFor();
    results.push({ check: 'online-auto-sync', status: 'PASS' });

    await desktop.getByRole('button', { name: '一部失敗を再現' }).click();
    assert.equal(await desktop.locator('body').getAttribute('data-sync-status'), 'error');
    await desktop.getByText('2件を同期しました。1件は再送が必要です。').waitFor();
    await desktop.getByText('1件未同期').first().waitFor();
    results.push({ check: 'partial-failure-visible', status: 'PASS' });

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(fixture);
    await mobile.getByText(/オフラインです。操作はこの端末に保存し/).waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    results.push({ check: 'mobile-status-no-overflow', status: 'PASS' });

    fs.writeFileSync(path.join(evidenceDir, 'browser-offline-task-flow-qa.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`Offline task-flow browser QA passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
