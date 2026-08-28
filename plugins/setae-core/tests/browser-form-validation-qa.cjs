const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.SETAE_QA_BASE || 'http://127.0.0.1:8871').replace(/\/$/, '');
const evidenceDir = process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.242');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = `${baseUrl}/tests/fixtures/product-ux-v242.html?mode=validation`;

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [];
  try {
    await page.goto(fixture);
    await page.locator('button[type="submit"]').click();
    await page.getByText('入力内容を確認してください', { exact: true }).first().waitFor();
    assert.equal(await page.locator('input[name="title"]').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'title');
    assert.equal(await page.locator('form').getAttribute('data-submitted'), null);
    assert.equal(await page.locator('form').getAttribute('aria-busy'), null);
    results.push({ check: 'invalid-submit-focus-no-busy', status: 'PASS' });

    await page.locator('input[name="title"]').fill('C242');
    await page.locator('input[name="date"]').fill('2026-08-27');
    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('form').getAttribute('data-submitted'), 'true');
    results.push({ check: 'valid-submit', status: 'PASS' });

    await page.getByRole('button', { name: 'サーバーエラーを再現' }).click();
    await page.getByText('この個体名は既に使われています。').first().waitFor();
    const describedBy = await page.locator('input[name="title"]').getAttribute('aria-describedby');
    assert.match(describedBy || '', /-server-error/);
    assert.equal(await page.locator('input[name="title"]').getAttribute('aria-invalid'), 'true');
    results.push({ check: 'server-field-error', status: 'PASS' });

    fs.writeFileSync(path.join(evidenceDir, 'browser-form-validation-qa.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`Form Validation browser QA passed (${results.length} checks)`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
