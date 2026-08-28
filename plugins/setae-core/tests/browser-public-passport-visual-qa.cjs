const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser, openFixture, inspectPage, validatePage, screenshotPath, writeEvidence, evidenceDir } = require('./browser-v247-helpers.cjs');

const widths = [320, 390, 768, 1024, 1440];
const states = ['private', 'private-owner', 'transfer', 'transfer-logged-in', 'transfer-requested', 'basic', 'life-history', 'owner-basic', 'owner', 'no-photos', 'one-photo', 'nine-photos', 'no-history', 'one-history', 'many-history', 'missing-species', 'long-identity', 'undetermined', 'species-fallback', 'registration-disabled'];
const results = [];

async function doubleComputedText(page) {
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body,body *:not(script):not(style)')].map((node) => [node, parseFloat(getComputedStyle(node).fontSize)]);
    sizes.forEach(([node, size]) => { if (Number.isFinite(size)) node.style.fontSize = `${size * 2}px`; });
  });
}

async function capture(opened, name) {
  // Full-page screenshots do not automatically load offscreen lazy images.
  // Visit each through normal scrolling, then return to the top for capture.
  const lazy = opened.page.locator('img[loading="lazy"]');
  for (let index = 0; index < await lazy.count(); index++) {
    await lazy.nth(index).scrollIntoViewIfNeeded();
    await lazy.nth(index).evaluate((image) => {
      if (image.complete) return;
      return new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); });
    });
  }
  await opened.page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await inspectPage(opened.page);
  const file = screenshotPath('passport-' + name + '.png');
  await opened.page.screenshot({ path: file, fullPage: true });
  results.push({ name, screenshot: path.relative(evidenceDir, file), geometry });
  validatePage(geometry, name);
  assert.deepEqual(opened.issues, [], name + ': no runtime errors');
  if (name === '1440-light' || name === '390-dark' || name === 'text-only-200-percent-at-320') {
    const gallery = opened.page.locator('.setae-qr-public-gallery');
    if (await gallery.count()) {
      await gallery.scrollIntoViewIfNeeded();
      await opened.page.screenshot({ path: screenshotPath('passport-' + name + '-gallery-viewport.png'), fullPage: false });
    }
  }
}

async function captureOverlay(opened, name, kind) {
  const { page } = opened;
  const selector = kind === 'photo' ? '[data-setae-public-photo-dialog]' : '[data-public-registration]';
  const dialog = page.locator(selector);
  await page.locator(kind === 'photo' ? '[data-public-photo-index="0"]' : '[data-public-register]').first().click();
  await dialog.waitFor({ state: 'visible' });
  if (kind === 'photo') {
    await dialog.locator('img').evaluate((image) => image.complete ? undefined : new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true });
    }));
  }
  // Use keyboard modality so the screenshot and measurements include the real
  // focus-visible treatment. Only scroll the open dialog, never background media.
  await page.keyboard.press('Tab');
  await dialog.locator(kind === 'photo' ? '[data-setae-public-photo-close]' : '[data-public-register-close]').first().focus();
  await dialog.evaluate((node) => { node.scrollTop = 0; });
  const geometry = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const visible = (element) => {
      const box = element.getBoundingClientRect(); const css = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' && !element.closest('[hidden]');
    };
    const accessibleName = (element) => (element.getAttribute('aria-label') ||
      (element.labels ? [...element.labels].map((label) => label.textContent).join(' ') : '') || element.textContent || '').trim();
    const controls = [...node.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea')].filter(visible).map((element) => {
      const target = element.matches('input[type="checkbox"],input[type="radio"]') ? element.closest('label') || element : element;
      const box = target.getBoundingClientRect();
      return { label: accessibleName(element).slice(0, 100), width: box.width, height: box.height,
        horizontalClipping: box.left < rect.left - 1 || box.right > rect.right + 1 };
    });
    const active = document.activeElement;
    const focusStyle = active ? getComputedStyle(active) : null;
    const labelIds = (node.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    const descriptionIds = (node.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      modal: node.matches(':modal'),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      horizontalOverflow: node.scrollWidth > node.clientWidth + 1,
      scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
      label: labelIds.map((id) => document.getElementById(id)?.textContent.trim() || '').join(' ').trim(),
      missingAriaReferences: [...labelIds, ...descriptionIds].filter((id) => !document.getElementById(id)),
      controls,
      focus: { inside: node.contains(active), visible: !!active?.matches(':focus-visible'),
        outlineStyle: focusStyle?.outlineStyle, outlineWidth: parseFloat(focusStyle?.outlineWidth || '0'),
        outlineColor: focusStyle?.outlineColor, foreground: focusStyle?.color },
      background: getComputedStyle(node).backgroundColor, foreground: getComputedStyle(node).color,
      brokenImages: [...node.querySelectorAll('img')].filter((image) => image.complete && !image.naturalWidth).length
    };
  });
  const file = screenshotPath('passport-' + name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  const result = { name, kind, screenshot: path.relative(evidenceDir, file), geometry };
  results.push(result);
  assert.equal(geometry.modal, true, name + ': native top-layer dialog');
  assert.ok(geometry.rect.left >= -1 && geometry.rect.top >= -1 && geometry.rect.right <= geometry.viewport.width + 1 && geometry.rect.bottom <= geometry.viewport.height + 1, name + ': dialog fits the viewport');
  assert.equal(geometry.documentOverflow, false, name + ': no document horizontal overflow');
  assert.equal(geometry.horizontalOverflow, false, name + ': no dialog horizontal overflow');
  assert.ok(geometry.label.length > 0, name + ': dialog has an accessible label');
  assert.deepEqual(geometry.missingAriaReferences, [], name + ': intact dialog ARIA references');
  assert.deepEqual(geometry.controls.filter((control) => !control.label || control.width < 43.5 || control.height < 43.5 || control.horizontalClipping), [], name + ': labelled controls remain at least 44px and horizontally contained');
  assert.equal(geometry.focus.inside, true, name + ': focus stays in the dialog');
  assert.equal(geometry.focus.visible, true, name + ': keyboard focus-visible state');
  assert.ok(geometry.focus.outlineWidth >= 2 && geometry.focus.outlineStyle !== 'none', name + ': visible keyboard focus outline');
  assert.equal(geometry.brokenImages, 0, name + ': loaded overlay image');
  assert.deepEqual(opened.issues, [], name + ': no runtime errors');

  if (geometry.scrollHeight > geometry.clientHeight + 1) {
    const lastControl = dialog.locator(kind === 'photo' ? '[data-setae-public-photo-next]' : '[data-public-register-submit]');
    await lastControl.focus();
    await lastControl.scrollIntoViewIfNeeded();
    const bottom = await lastControl.boundingBox();
    assert.ok(bottom && bottom.y >= geometry.rect.top && bottom.y + bottom.height <= geometry.rect.bottom + 1, name + ': final action is reachable by dialog scrolling');
    const bottomFile = screenshotPath('passport-' + name + '-bottom.png');
    await page.screenshot({ path: bottomFile, fullPage: false });
    result.bottomScreenshot = path.relative(evidenceDir, bottomFile);
    result.finalControlReachable = true;
  }
}

(async () => {
  const browser = await launchBrowser();
  try {
    for (const width of widths) {
      const colors = [];
      for (const colorScheme of ['light', 'dark']) {
        const opened = await openFixture('life-history', { browser, viewport: { width, height: 1000 }, colorScheme });
        await capture(opened, `${width}-${colorScheme}`);
        colors.push((await inspectPage(opened.page)).themeBackground);
        await opened.context.close();
      }
      assert.notEqual(colors[0], colors[1], `${width}: dark scheme changes the public canvas`);
    }
    for (const name of states) {
      const opened = await openFixture(name, { browser, viewport: { width: name === 'long-identity' ? 320 : 390, height: 1000 } });
      await capture(opened, 'state-' + name);
      if (name === 'basic') assert.equal(await opened.page.locator('.setae-qr-history').count(), 0);
      if (name === 'life-history' || name === 'many-history') assert.equal(await opened.page.locator('.setae-qr-history-item').count(), 20);
      if (name === 'one-history') assert.equal(await opened.page.locator('.setae-qr-history-item').count(), 1);
      if (name === 'no-history') assert.equal(await opened.page.locator('.setae-qr-history-item').count(), 0);
      if (name === 'no-photos') assert.equal(await opened.page.locator('.setae-qr-profile-media .setae-specimen-placeholder').count(), 1);
      if (name === 'registration-disabled') assert.equal(await opened.page.locator('[data-public-registration],[data-public-register]').count(), 0);
      if (name === 'private') assert.doesNotMatch(await opened.page.content(), /SPECIMEN_ID_247|Phormingochilus|passport-247-photo|PRIVATE_KEEPER/);
      await opened.context.close();
    }

    // Computed text-only scaling, not CSS zoom. Measurements are recorded as
    // emulation; they do not establish physical Safari/Android support.
    const scaled = await openFixture('long-identity', { browser, viewport: { width: 320, height: 1100 } });
    await doubleComputedText(scaled.page);
    await capture(scaled, 'text-only-200-percent-at-320');
    await scaled.context.close();

    for (const name of ['life-history', 'transfer-logged-in']) {
      const forced = await openFixture(name, { browser, viewport: { width: 390, height: 1000 }, forcedColors: 'active' });
      await forced.page.locator('button:visible,a:visible').first().focus();
      await capture(forced, 'forced-colors-' + name);
      await forced.context.close();
    }
    const overlays = [
      { name: '320-light', viewport: { width: 320, height: 844 }, colorScheme: 'light' },
      { name: '390-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
      { name: '390-forced-colors', viewport: { width: 390, height: 844 }, forcedColors: 'active' },
      { name: '320-text-only-200-percent', viewport: { width: 320, height: 1100 }, textScale: true }
    ];
    for (const options of overlays) {
      for (const kind of ['photo', 'registration']) {
        const opened = await openFixture(kind === 'photo' ? 'life-history' : 'transfer', { browser, ...options });
        if (options.textScale) await doubleComputedText(opened.page);
        await captureOverlay(opened, 'overlay-' + kind + '-' + options.name, kind);
        await opened.context.close();
      }
    }
    writeEvidence('browser-public-passport-visual-qa.json', { status: 'PASS', verification: 'Automated DOM/geometry checks and captured screenshots. Visual appearance requires review of those screenshots.', cases: results.length, results });
    console.log(`Public passport visual geometry QA passed (${results.length} cases)`);
  } catch (error) {
    writeEvidence('browser-public-passport-visual-qa.json', { status: 'FAIL', error: error.stack, cases: results.length, results });
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
