const assert = require('node:assert/strict');
const { openFixture, writeEvidence } = require('./browser-v245-helpers.cjs');

(async () => {
  const { browser, context, page, issues } = await openFixture('modal-action-boundary-v245.html');
  const results = [];
  try {
    const title = page.locator('#fixture-title');
    await title.fill('変更中の個体');
    const safeTargets = [
      title,
      page.getByText('管理名', { exact: true }),
      page.locator('.date-field-frame'),
      page.locator('#fixture-note'),
      page.locator('#fixture-status'),
      page.locator('[data-fixture-region="description"]'),
      page.locator('[data-fixture-region="blank"]'),
      page.locator('[data-fixture-region="header"] h2')
    ];
    for (const target of safeTargets) {
      await target.click({ force: true });
      assert.equal(await page.evaluate(() => window.__setaeModal245.guardCount()), 0);
      assert.equal(await page.evaluate(() => window.__setaeModal245.isOpen()), true);
      assert.equal(await title.inputValue(), '変更中の個体');
    }
    await page.locator('[data-fixture-region="footer"]').evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.locator('.fixture-modal-body').first().evaluate((element) => { element.scrollTop = 80; element.dispatchEvent(new Event('scroll')); });
    assert.equal(await page.evaluate(() => window.__setaeModal245.guardCount()), 0);
    assert.equal(await title.inputValue(), '変更中の個体');
    results.push({ check: 'ten-internal-interactions-no-close-or-guard', status: 'PASS' });

    await title.focus();
    await page.locator('.modal-backdrop:not(.form-safety-backdrop)').click({ position: { x: 4, y: 4 } });
    assert.equal(await page.getByRole('alertdialog').count(), 1);
    assert.equal(await title.inputValue(), '変更中の個体');
    results.push({ check: 'backdrop-only-opens-one-guard', status: 'PASS' });

    await page.getByRole('button', { name: '編集を続ける' }).click();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert.equal(await title.inputValue(), '変更中の個体');
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'fixture-title');
    results.push({ check: 'continue-keeps-form-value-and-focus', status: 'PASS' });

    assert.deepEqual(issues, []);
    writeEvidence('browser-modal-action-boundary-qa.json', { results });
    console.log(`Modal action boundary browser QA passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
