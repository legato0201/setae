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

    for (const width of [320, 390]) {
      const mobile = await context.newPage();
      await mobile.setViewportSize({ width, height: 844 });
      await mobile.goto(fixture);
      const sync = mobile.locator('.mobile-app-sync');
      await sync.getByRole('button', { name: /オフライン/ }).waitFor();
      assert.equal(await sync.isVisible(), true);
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await mobile.getByRole('button', { name: 'オンラインへ戻す' }).click();
      await mobile.locator('body[data-sync-status="idle"]').waitFor();
      await mobile.getByRole('button', { name: '一部失敗を再現' }).click();
      const failure = sync.getByRole('button', { name: /1件未同期/ });
      await failure.waitFor();
      assert.equal(await failure.isVisible(), true, 'Online sync failure must remain visible on mobile');
      const geometry = await mobile.evaluate(() => {
        const bar = document.querySelector('.mobile-app-bar').getBoundingClientRect();
        const status = document.querySelector('.mobile-sync-button').getBoundingClientRect();
        const heading = document.querySelector('[data-app-main] h1').getBoundingClientRect();
        return { barBottom: bar.bottom, top: status.top, bottom: status.bottom, width: status.width,
          height: status.height, headingTop: heading.top, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.ok(geometry.height >= 44 && geometry.width >= 44);
      assert.ok(geometry.bottom <= geometry.barBottom + 1);
      assert.ok(geometry.headingTop >= geometry.barBottom - 1, 'Status row must not cover page content');
      assert.equal(geometry.overflow, false);
      await mobile.screenshot({ path: path.join(evidenceDir, 'mobile-sync-failure-' + width + '.png'), fullPage: false });
      results.push({ check: 'mobile-offline-and-sync-failure-' + width, status: 'PASS', geometry });
      await mobile.close();
    }

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
