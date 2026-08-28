const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = (mode) => `${baseUrl}/tests/fixtures/product-ux-v242.html?mode=${mode}`;

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(fixture('onboarding'));
    await page.waitForSelector('body[data-fixture-ready="true"]');
    await page.getByRole('button', { name: '次へ' }).click();
    await page.getByRole('heading', { name: '最初に何をしますか？' }).waitFor();
    await page.getByRole('button', { name: '個体を登録する' }).click();
    await page.getByRole('button', { name: 'この内容で始める' }).click();
    await page.locator('form[data-role="animal-form"] input[name="title"]').fill('C001');
    await page.locator('form[data-role="animal-form"] input[name="species_name"]').fill('Typhochlaena seladonia');
    await page.locator('form[data-role="animal-form"] button[type="submit"]').click();
    assert.equal(await page.locator('body').getAttribute('data-collection-count'), '1');
    await page.getByRole('button', { name: /最初の記録を追加/ }).click();
    await page.locator('form[data-role="record-form"] button[type="submit"]').click();
    assert.equal(await page.locator('body').getAttribute('data-record-count'), '1');
    await page.getByText('SETAEの基本設定が完了しました。').waitFor();
    assert.equal(await page.locator('.getting-started').count(), 0);
    results.push({ flow: 'new-user', status: 'PASS' });

    await page.goto(fixture('undo'));
    assert.equal(await page.locator('[data-saved-views] > div').count(), 3);
    await page.locator('[data-saved-views] [data-action="delete-saved-view"]').first().click();
    assert.equal(await page.locator('[data-saved-views] > div').count(), 2);
    await page.getByRole('button', { name: '元に戻す' }).click();
    assert.equal(await page.locator('[data-saved-views] > div').count(), 3);
    assert.equal(await page.locator('[data-widgets] > div').count(), 2);
    await page.locator('[data-widgets] [data-action="delete-widget"]').first().click();
    assert.equal(await page.locator('[data-widgets] > div').count(), 1);
    await page.getByRole('button', { name: '元に戻す' }).click();
    assert.equal(await page.locator('[data-widgets] > div').count(), 2);
    results.push({ flow: 'undo', status: 'PASS' });

    await page.goto(fixture('filter'));
    await page.locator('[data-role="fixture-collection-search"]').fill('Z999');
    await page.getByText('条件に一致する個体はありません').waitFor();
    assert.equal(await page.locator('[data-collection-count]').textContent(), '0件');
    await page.getByRole('button', { name: '条件をクリア' }).click();
    assert.equal(await page.locator('[data-collection-count]').textContent(), '2件');
    await page.getByRole('button', { name: '脱皮' }).click();
    await page.getByText('この種類の記録はありません').waitFor();
    await page.getByRole('button', { name: 'すべての記録を表示' }).click();
    assert.equal(await page.locator('[data-record-count]').textContent(), '1件');
    results.push({ flow: 'filter-recovery', status: 'PASS' });

    await page.goto(fixture('delete'));
    const confirm = page.locator('[data-action="confirm-modal"]');
    assert.equal(await confirm.isDisabled(), true);
    await page.locator('[data-role="confirm-phrase"]').fill('C013');
    assert.equal(await confirm.isDisabled(), true);
    await page.locator('[data-role="confirm-phrase"]').fill('C014');
    assert.equal(await confirm.isEnabled(), true);
    results.push({ flow: 'typed-confirmation', status: 'PASS' });

    fs.writeFileSync(path.join(evidenceDir, 'browser-product-ux-qa.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`Product UX browser QA passed (${results.length} flows)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
