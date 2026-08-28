const assert = require('node:assert/strict');
const { openFixture, writeEvidence } = require('./browser-v245-helpers.cjs');

(async () => {
  const { browser, context, page, issues } = await openFixture('modal-action-boundary-v245.html');
  const results = [];
  try {
    const title = page.locator('#fixture-title');
    assert.equal(await title.getAttribute('data-form-dirty'), null);
    assert.equal(await page.evaluate(() => window.__setaeModal245.dirty()), 'false');
    await title.fill('編集中');
    await page.getByRole('button', { name: '閉じる' }).click();
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await title.inputValue(), '編集中');
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.getByRole('button', { name: '変更を破棄' }).click();
    assert.equal(await page.evaluate(() => window.__setaeModal245.isOpen()), false);
    assert.equal(await page.evaluate(() => window.__setaeModal245.safety.activeCount()), 0);
    results.push({ check: 'dirty-close-continue-and-discard', status: 'PASS' });

    await page.evaluate(() => {
      window.__setaeModal245.setInitial('サーバー更新後');
      window.__setaeModal245.open();
    });
    assert.equal(await page.locator('#fixture-title').inputValue(), 'サーバー更新後');
    assert.equal(await page.evaluate(() => window.__setaeModal245.dirty()), 'false');
    await page.locator('.modal-backdrop:not(.form-safety-backdrop)').click({ position: { x: 4, y: 4 } });
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert.equal(await page.evaluate(() => window.__setaeModal245.isOpen()), false);
    results.push({ check: 'clean-close-and-reopen-baseline-reset', status: 'PASS' });

    await page.evaluate(() => {
      window.__setaeModal245.open();
      window.__setaeModal245.setMultiple(true);
    });
    await page.locator('#fixture-title').fill('変更1');
    await page.locator('#fixture-secondary').fill('変更2');
    await page.getByRole('button', { name: '画面移動' }).click();
    const dialog = page.getByRole('alertdialog');
    assert.equal(await dialog.count(), 1);
    await dialog.getByText('保存していない入力が2件あります。', { exact: false }).waitFor();
    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await page.locator('#fixture-title').inputValue(), '変更1');
    assert.equal(await page.locator('#fixture-secondary').inputValue(), '変更2');
    await page.getByRole('button', { name: '画面移動' }).click();
    await page.getByRole('button', { name: '変更を破棄' }).click();
    assert.equal(await page.evaluate(() => window.__setaeModal245.navigationCount()), 1);
    assert.equal(await page.locator('[data-role="fixture-form"]').getAttribute('data-form-dirty'), 'false');
    assert.equal(await page.locator('[data-role="fixture-second-form"]').getAttribute('data-form-dirty'), 'false');
    results.push({ check: 'multiple-dirty-forms-one-dialog-and-one-discard', status: 'PASS' });

    assert.deepEqual(issues, []);
    writeEvidence('browser-form-safety-regression-v245-qa.json', { results });
    console.log(`Form Safety v245 browser regression passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
