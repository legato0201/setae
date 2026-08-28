const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = `${baseUrl}/tests/fixtures/product-ux-v242.html?mode=draft`;
const draftKey = 'setae.gui.v2.formDraft.242.animal.new';

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const results = [];
  try {
    await page.goto(fixture);
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('setae.gui.v2.formDraft.242.')).forEach((key) => localStorage.removeItem(key)));
    await page.reload();
    const title = page.locator('input[name="title"]');
    await title.fill('C242');
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), true);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || 'null')?.values.title === 'C242', draftKey);
    await page.evaluate(() => window.__setaeFixtureSafety.sync());
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => window.__setaeFixtureSafety.sync());
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
    assert.equal(await title.inputValue(), 'C242');
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), true);
    results.push({ check: 'current-autosave-and-resize-do-not-offer-recovery', status: 'PASS' });
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await title.inputValue(), 'C242');
    results.push({ check: 'close-guard-continue', status: 'PASS' });

    await page.getByRole('button', { name: '戻る操作' }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '編集を続ける' }).click();
    await page.getByRole('button', { name: 'スワイプで戻る' }).click();
    await page.getByRole('button', { name: '変更を破棄' }).click();
    assert.equal(await page.locator('body').getAttribute('data-guard-continuation'), 'guard-edge');
    results.push({ check: 'back-edge-navigation-guard', status: 'PASS' });

    await page.goto(fixture);
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('setae.gui.v2.formDraft.242.')).forEach((key) => localStorage.removeItem(key)));
    await page.reload();
    await page.locator('input[name="title"]').fill('C500');
    await page.locator('input[name="api_token"]').fill('secret-token');
    await page.locator('input[name="password"]').fill('secret-password');
    await page.waitForTimeout(380);
    const stored = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('setae.gui.v2.formDraft.242.')) || null);
    assert.ok(stored);
    assert.doesNotMatch(stored[1], /secret-token|secret-password/);
    await page.goto(fixture);
    await page.getByText('前回の入力を復元できます').waitFor();
    assert.equal(await page.locator('input[name="title"]').inputValue(), '');
    const screenshotDir = path.join(evidenceDir, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'draft-recovery-320-light.png'), fullPage: true });
    await page.getByRole('button', { name: '復元' }).click();
    assert.equal(await page.locator('input[name="title"]').inputValue(), 'C500');
    await page.evaluate(() => { window.__setaeFixtureSafety.sync(); window.__setaeFixtureSafety.sync(); });
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), true);
    assert.equal(await page.locator('input[name="title"]').evaluate((control) => control === document.activeElement), true);
    results.push({ check: 'draft-persist-explicit-restore-sensitive-exclusion', status: 'PASS' });

    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('form').getAttribute('data-submitted'), 'true');
    const remainingDraft = await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('setae.gui.v2.formDraft.242.')));
    assert.equal(remainingDraft, false);
    results.push({ check: 'successful-submit-clears-draft', status: 'PASS' });

    const openStoredDraft = async (values, extra = {}) => {
      await page.evaluate(({ key, values, extra }) => {
        localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), values, checks: {}, selections: {}, ...extra }));
      }, { key: draftKey, values, extra });
      await page.reload();
      await page.locator('input[name="title"]').waitFor();
    };

    await openStoredDraft({ title: '前回の個体' });
    await page.getByText('前回の入力を復元できます').waitFor();
    await title.fill('今回の個体');
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
    await page.evaluate(() => window.__setaeFixtureSafety.sync());
    assert.equal(await title.inputValue(), '今回の個体');
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), true);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || 'null')?.values.title === '今回の個体', draftKey);
    await title.fill('');
    await page.evaluate(() => window.__setaeFixtureSafety.sync());
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0, 'Acknowledged recovery must not reappear after reverting a field');
    results.push({ check: 'new-input-dismisses-previous-draft-for-current-session', status: 'PASS' });

    await openStoredDraft({ title: '破棄する下書き' });
    await page.getByRole('button', { name: '下書きを破棄' }).click();
    assert.equal(await title.inputValue(), '');
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey), null);
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), false);
    await title.fill('破棄後の新しい入力');
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await title.inputValue(), '破棄後の新しい入力');
    results.push({ check: 'discard-old-draft-preserves-new-input-protection', status: 'PASS' });

    await openStoredDraft({ title: '古い入力' });
    await title.evaluate((control) => { control.value = '未通知の現在入力'; });
    await page.getByRole('button', { name: '下書きを破棄' }).click();
    assert.equal(await title.inputValue(), '未通知の現在入力');
    assert.equal(await page.evaluate(() => window.__setaeFixtureSafety.hasDirty()), true);
    results.push({ check: 'discard-recovery-does-not-clear-current-dirty-baseline', status: 'PASS' });

    await openStoredDraft({ title: '' }, { hadFiles: true });
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
    assert.equal(await page.evaluate((key) => Boolean(localStorage.getItem(key)), draftKey), true);
    results.push({ check: 'file-only-draft-does-not-offer-impossible-recovery', status: 'PASS' });

    await openStoredDraft({ removed_field: '古い項目', api_token: 'excluded', password: 'excluded' });
    assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
    assert.equal(await title.inputValue(), '');
    results.push({ check: 'unmatched-or-forbidden-fields-do-not-offer-recovery', status: 'PASS' });

    fs.writeFileSync(path.join(evidenceDir, 'browser-form-safety-qa.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`Form Safety browser QA passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
