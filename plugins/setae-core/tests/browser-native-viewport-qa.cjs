const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

(async () => {
  const { browser, page } = await openFixture({ view: 'quick', viewport: { width: 390, height: 844 } });
  try {
    const opened = await page.evaluate(() => window.v244Harness.runViewportMock({ layoutHeight: 800, visualHeight: 500 }));
    assert.equal(opened.snapshot.keyboardOpen, true);
    assert.equal(opened.snapshot.keyboardInset, 300);
    assert.equal(opened.snapshot.standalone, true);
    assert.equal(opened.keyboardAttribute, 'true');
    assert.equal(opened.values['--setae-visual-viewport-height'], '500px');
    assert.equal(opened.values['--setae-keyboard-inset'], '300px');
    assert.ok(opened.scrolled >= 1);

    const closed = await page.evaluate(() => window.v244Harness.runViewportMock({ layoutHeight: 800, visualHeight: 700 }));
    assert.equal(closed.snapshot.keyboardOpen, false);
    assert.equal(closed.snapshot.keyboardInset, 0);

    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      document.documentElement.dataset.setaeKeyboardOpen = 'true';
      document.documentElement.style.setProperty('--setae-visual-viewport-height', '500px');
      document.documentElement.style.setProperty('--setae-visual-viewport-offset-top', '0px');
      const nav = document.querySelector('.mobile-navigation');
      const sheet = document.querySelector('.quick-record-shell');
      const backdrop = document.querySelector('.quick-record-backdrop');
      const frame = document.querySelector('.date-field-frame');
      const input = frame?.querySelector('.date-field-control');
      const sheetRect = sheet?.getBoundingClientRect();
      const backdropRect = backdrop?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      const inputRect = input?.getBoundingClientRect();
      const sheetStyle = sheet ? getComputedStyle(sheet) : null;
      return {
        navVisibility: getComputedStyle(nav).visibility,
        sheetTop: sheetRect?.top || 0,
        sheetBottom: sheetRect?.bottom || 0,
        sheetHeight: sheetRect?.height || 0,
        sheetMaxHeight: sheetStyle?.maxHeight || '',
        sheetBoxSizing: sheetStyle?.boxSizing || '',
        sheetBorderBlock: sheetStyle ? `${sheetStyle.borderTopWidth}/${sheetStyle.borderBottomWidth}` : '',
        backdropTop: backdropRect?.top || 0,
        backdropBottom: backdropRect?.bottom || 0,
        backdropHeight: backdropRect?.height || 0,
        frameRect: frameRect ? { left: frameRect.left, right: frameRect.right, scrollWidth: frame.scrollWidth, clientWidth: frame.clientWidth } : null,
        inputRect: inputRect ? { left: inputRect.left, right: inputRect.right } : null,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth
      };
    });
    assert.equal(geometry.navVisibility, 'hidden');
    assert.ok(geometry.sheetBottom <= 501, `sheet geometry ${JSON.stringify(geometry)}`);
    assert.ok(geometry.backdropHeight <= 501, `backdrop height ${geometry.backdropHeight}`);
    assert.ok(geometry.documentScrollWidth <= geometry.viewportWidth + 1);
    await page.screenshot({ path: path.join(evidenceDir, 'native-viewport-keyboard.png'), fullPage: false });
    writeEvidence('browser-native-viewport-qa.json', { status: 'PASS', opened, closed, geometry });
    console.log('Native viewport browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
