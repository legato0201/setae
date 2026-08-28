const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

(async () => {
  const { browser, page } = await openFixture({ view: 'semantic', forcedColors: 'active', viewport: { width: 1280, height: 900 } });
  try {
    await page.getByRole('button', { name: '記録を保存する' }).focus();
    const audit = await page.evaluate(() => {
      const button = document.querySelector('.button.primary');
      const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]');
      const selectedRow = document.querySelector('.v244-selected-row');
      const checkbox = document.querySelector('#fixture-choice');
      const focus = getComputedStyle(button);
      const indicator = getComputedStyle(selectedTab, '::after');
      return {
        forcedColors: matchMedia('(forced-colors: active)').matches,
        buttonBorder: getComputedStyle(button).borderStyle,
        focusOutline: focus.outlineStyle,
        focusOutlineWidth: focus.outlineWidth,
        tabIndicatorHeight: indicator.height,
        tabIndicatorColor: indicator.backgroundColor,
        selectedRowBorder: getComputedStyle(selectedRow).borderStyle,
        checkboxVisible: checkbox.getClientRects().length > 0
      };
    });
    assert.equal(audit.forcedColors, true);
    assert.notEqual(audit.buttonBorder, 'none');
    assert.notEqual(audit.focusOutline, 'none');
    assert.notEqual(audit.focusOutlineWidth, '0px');
    assert.notEqual(audit.tabIndicatorHeight, '0px');
    assert.notEqual(audit.selectedRowBorder, 'none');
    assert.equal(audit.checkboxVisible, true);
    await page.screenshot({ path: path.join(evidenceDir, 'forced-colors-active.png'), fullPage: true });
    writeEvidence('browser-forced-colors-qa.json', { status: 'PASS', audit });
    console.log('Forced colors browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
