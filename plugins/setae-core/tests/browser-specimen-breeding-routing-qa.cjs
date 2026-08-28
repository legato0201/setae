const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v245-helpers.cjs');

(async () => {
  const { browser, context, page, issues } = await openFixture('specimen-breeding-v245.html', { viewport: { width: 390, height: 844 } });
  const results = [];
  try {
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(), 1);
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), '繁殖');
    const pairingButton = page.getByRole('button', { name: 'ペアリングを記録' });
    assert.equal(await pairingButton.getAttribute('data-record-type'), 'pairing');
    assert.equal(await pairingButton.getAttribute('data-animal-id'), '14');
    await pairingButton.click();

    const sheet = page.getByRole('dialog', { name: 'ペアリング' });
    await sheet.waitFor();
    assert.equal(await sheet.locator('[name="animal_id"]').inputValue(), '14');
    assert.equal(await sheet.locator('[name="partner_name"]').count(), 1);
    assert.equal(await sheet.locator('[name="result"]').count(), 1);
    assert.equal(await sheet.locator('[name="label"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__setaeBreeding245.state().quickRecord.type), 'pairing');
    results.push({ check: 'breeding-button-opens-pairing-form', status: 'PASS' });

    await sheet.locator('[name="date"]').fill('2026-08-27');
    await sheet.locator('[name="partner_name"]').fill('C021');
    await sheet.locator('[name="result"]').selectOption('successful');
    await sheet.locator('[name="note"]').fill('交接を確認');
    await sheet.getByRole('button', { name: '記録する' }).click();
    const saved = await page.evaluate(() => window.__setaeBreeding245.state());
    assert.equal(saved.lastPayload.type, 'pairing');
    assert.equal(saved.lastPayload.data.partner_name, 'C021');
    assert.equal(saved.lastPayload.data.result, 'successful');
    assert.equal(Object.hasOwn(saved.lastPayload.data, 'label'), false);
    assert.equal(saved.animal.last_pairing, '2026-08-27');
    assert.equal(saved.specimenTab, 'breeding');
    assert.equal(saved.events[0].type, 'pairing');
    await page.getByText('C021', { exact: true }).waitFor();
    results.push({ check: 'pairing-payload-history-and-tab-preserved', status: 'PASS' });

    await page.getByRole('tab', { name: '概要' }).click();
    const recordMenu = page.locator('details.action-menu').filter({ has: page.getByText('記録', { exact: true }) });
    await recordMenu.locator('summary').click();
    await recordMenu.getByRole('menuitem', { name: 'ペアリング' }).click();
    assert.equal(await page.getByRole('dialog', { name: 'ペアリング' }).count(), 1);
    assert.equal(await page.evaluate(() => window.__setaeBreeding245.state().quickRecord.type), 'pairing');
    results.push({ check: 'identity-record-menu-routes-pairing', status: 'PASS' });

    await page.getByRole('button', { name: '閉じる' }).click();
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByRole('tab', { name: '繁殖' }).click();
    const geometry = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('ペアリングを記録'));
      const rect = button.getBoundingClientRect();
      return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, left: rect.left, right: rect.right, width: rect.width };
    });
    assert.ok(geometry.documentWidth <= geometry.viewport + 1);
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport + 1 && geometry.width > 0);
    results.push({ check: 'breeding-header-fits-320px', status: 'PASS', geometry });

    const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
    const screenshotCases = new Set(['320-light', '390-dark', '768-light', '1440-dark']);
    fs.mkdirSync(evidenceDir, { recursive: true });
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, colorScheme);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
        const responsive = await page.evaluate(() => {
          const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('ペアリングを記録'));
          const rect = button?.getBoundingClientRect();
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewport: innerWidth,
            activeTabs: document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
            button: rect ? { left: rect.left, right: rect.right, width: rect.width, height: rect.height } : null
          };
        });
        assert.ok(responsive.documentWidth <= responsive.viewport + 1, `${width}px ${colorScheme} overflows horizontally`);
        assert.equal(responsive.activeTabs, 1, `${width}px ${colorScheme} must have one active tab`);
        assert.ok(responsive.button && responsive.button.left >= 0 && responsive.button.right <= responsive.viewport + 1);
        if (width <= 430) assert.ok(responsive.button.height >= 44, `${width}px touch target is too small`);
        results.push({ check: `responsive-${width}-${colorScheme}`, status: 'PASS', geometry: responsive });
        if (screenshotCases.has(`${width}-${colorScheme}`)) {
          await page.screenshot({
            path: path.join(evidenceDir, `specimen-breeding-${width}-${colorScheme}.png`),
            fullPage: true
          });
        }
      }
    }

    assert.deepEqual(issues, []);
    writeEvidence('browser-specimen-breeding-routing-qa.json', { results });
    console.log(`Specimen breeding browser QA passed (${results.length} checks)`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
