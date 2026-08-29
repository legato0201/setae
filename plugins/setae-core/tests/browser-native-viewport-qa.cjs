const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');
const { baseUrl } = require('./browser-v246-helpers.cjs');

async function checkIntakeKeyboard(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      const viewport = new EventTarget();
      Object.assign(viewport, { width: innerWidth, height: 500, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      window.__setaeKeyboardTestViewport = viewport;
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl + '/tests/fixtures/specimen-intake-app.html?edit=1');
    await page.waitForSelector('body[data-fixture-ready="true"]');
    const records = page.locator('details[data-specimen-intake-section="records"]');
    if (!await records.evaluate((node) => node.open)) await records.locator(':scope > summary').click();
    const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = () => page.evaluate(() => {
      const field = document.activeElement.getBoundingClientRect();
      const body = document.querySelector('.specimen-intake-body').getBoundingClientRect();
      const footer = document.querySelector('.specimen-intake-footer').getBoundingClientRect();
      return { keyboardOpen: document.documentElement.dataset.setaeKeyboardOpen, name: document.activeElement.name,
        top: field.top, bottom: field.bottom, bodyTop: body.top, bodyBottom: body.bottom,
        footerBottom: footer.bottom, visualHeight: visualViewport.height, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    await page.locator('[name="name"]').evaluate((node) => node.focus({ preventScroll: true }));
    await settle();
    await page.locator('[name="notes"]').evaluate((node) => node.focus({ preventScroll: true }));
    await settle();
    const afterFocus = await bounds();
    assert.equal(afterFocus.name, 'notes');
    assert.equal(afterFocus.keyboardOpen, 'true');
    assert.ok(afterFocus.top >= afterFocus.bodyTop - 1 && afterFocus.bottom <= afterFocus.bodyBottom + 1,
      'Changing fields must reveal the input above the save footer: ' + JSON.stringify(afterFocus));
    await page.evaluate(() => {
      window.__setaeKeyboardTestViewport.height = 440;
      window.__setaeKeyboardTestViewport.dispatchEvent(new Event('resize'));
    });
    await settle();
    const afterResize = await bounds();
    writeEvidence('native-intake-' + width + '-measurements.json', { afterFocus, afterResize,
      scope: 'Measurements only; assertions below determine pass/fail.' });
    assert.ok(afterResize.top >= afterResize.bodyTop - 1 && afterResize.bottom <= afterResize.bodyBottom + 1,
      'A taller keyboard must keep the focused input visible: ' + JSON.stringify(afterResize));
    assert.ok(afterResize.footerBottom <= afterResize.visualHeight + 1, 'Save footer must remain above keyboard: ' + JSON.stringify(afterResize));
    assert.equal(afterResize.overflow, false);
    assert.deepEqual(errors, []);
    const screenshot = 'native-intake-keyboard-' + width + '.png';
    await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: false });
    return { width, afterFocus, afterResize, screenshot,
      scope: 'Real application and DOM focus/scroll, synthetic VisualViewport keyboard. Not a physical device test.' };
  } finally {
    await context.close();
  }
}

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

    await page.locator('.quick-record-shell').evaluate((node) =>
      Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))));
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
    const intakeKeyboard = [];
    for (const width of [320, 390]) intakeKeyboard.push(await checkIntakeKeyboard(browser, width));
    writeEvidence('browser-native-viewport-qa.json', { status: 'PASS', opened, closed, geometry, intakeKeyboard });
    console.log('Native viewport browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
