const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SETAE_QA_EVIDENCE ||= path.resolve(__dirname, '../../../../release-evidence/v1.0.248');
process.env.SETAE_QA_FIXTURES ||= path.join(__dirname, 'fixtures/public-v248');
process.env.SETAE_QA_FIXTURE_ROUTE ||= '/tests/fixtures/public-v248/';
const base = require('./browser-v247-helpers.cjs');

async function doubleText(page) {
  const initial = await page.evaluate(() => window.__setaePublic248.layout());
  assert.equal(initial.supported, true);
  assert.ok(initial.value < 0.1, 'Initial loading CLS remains below 0.1 before intentional text-size emulation.');
  await page.evaluate(() => {
    window.__setaePublic248.beginLayoutPhase('intentional_200_percent_text_setup_excluded_from_loading_CLS');
    const sizes = [...document.querySelectorAll('body,body *:not(script):not(style)')].map((node) => [node, parseFloat(getComputedStyle(node).fontSize)]);
    sizes.forEach(([node, size]) => { if (Number.isFinite(size)) node.style.fontSize = `${size * 2}px`; });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => window.__setaePublic248.beginLayoutPhase('after_text_setup'));
}
async function openShare(page) {
  const menu = page.locator('[data-public-share-menu]');
  if (await menu.count() && !(await menu.evaluate((node) => node.open))) await menu.locator('summary').click();
}
async function inspectLayout(page) {
  const geometry = await base.inspectPage(page);
  const extra = await page.evaluate(() => {
    const media = document.querySelector('.setae-care-share-media')?.getBoundingClientRect();
    const main = document.querySelector('main');
    const region = main?.getBoundingClientRect();
    const copy = document.querySelector('.setae-public-partner-invite-text');
    return { mediaRatio: media?.height ? media.width / media.height : null,
      mainGutter: region ? Math.min(region.left, innerWidth - region.right) : null,
      copyKit: copy ? { readOnly: copy.readOnly, label: [...copy.labels].map((label) => label.textContent.trim()).join(' '), horizontalOverflow: copy.scrollWidth > copy.clientWidth + 1 } : null,
      cls: window.__setaePublic248.layout() };
  });
  return { ...geometry, ...extra };
}
async function capturePage(opened, name, results, { fullPage = true } = {}) {
  const { page } = opened;
  if (fullPage) {
    const lazy = page.locator('img[loading="lazy"]');
    for (let index = 0; index < await lazy.count(); index++) {
      await lazy.nth(index).scrollIntoViewIfNeeded();
      await lazy.nth(index).evaluate((image) => image.complete ? undefined : new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const geometry = await inspectLayout(page);
  const file = base.screenshotPath(name + '.png');
  await page.screenshot({ path: file, fullPage });
  results.push({ name, screenshot: path.relative(base.evidenceDir, file), geometry });
  base.validatePage(geometry, name);
  assert.equal(geometry.cls.supported, true, name + ': actual PerformanceObserver layout-shift support');
  assert.ok(geometry.cls.value < 0.1, `${name}: measured lab CLS ${geometry.cls.value} must remain below 0.1`);
  const minimumGutter = geometry.viewport <= 767 ? 16 : geometry.viewport <= 1199 ? 24 : 32;
  if (geometry.mainGutter !== null) assert.ok(geometry.mainGutter >= minimumGutter - 1, name + ': shared responsive page gutter');
  if (geometry.copyKit) { assert.equal(geometry.copyKit.readOnly, true); assert.ok(geometry.copyKit.label); assert.equal(geometry.copyKit.horizontalOverflow, false, name + ': copy text reflows'); }
  assert.deepEqual(opened.issues, [], name + ': browser errors');
}
async function captureRegistration(opened, name, results) {
  const { page } = opened;
  const dialog = page.locator('[data-public-registration]');
  await page.locator('[data-public-register]').first().click();
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Tab'); await dialog.locator('[data-public-register-close]').first().focus();
  await dialog.evaluate((node) => { node.scrollTop = 0; });
  const geometry = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const controls = [...node.querySelectorAll('a[href],button,input:not([type="hidden"])')].filter((element) => element.getClientRects().length && !element.closest('[hidden]')).map((element) => {
      const target = element.type === 'checkbox' ? element.closest('label') : element;
      const box = target.getBoundingClientRect();
      return { width: box.width, height: box.height, label: (element.getAttribute('aria-label') || (element.labels ? [...element.labels].map((label) => label.textContent).join(' ') : '') || element.textContent).trim(), clipped: box.left < rect.left - 1 || box.right > rect.right + 1 };
    });
    const active = document.activeElement; const style = getComputedStyle(active);
    return { modal: node.matches(':modal'), fits: rect.left >= 0 && rect.top >= 0 && rect.right <= document.documentElement.clientWidth + 1 && rect.bottom <= innerHeight + 1,
      horizontalOverflow: node.scrollWidth > node.clientWidth + 1, controls,
      typography: { titleSize: parseFloat(getComputedStyle(node.querySelector('h2')).fontSize),
        inputSizes: [...node.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')].map((input) => parseFloat(getComputedStyle(input).fontSize)),
        labelSizes: [...node.querySelectorAll('.setae-public-field > span')].map((label) => parseFloat(getComputedStyle(label).fontSize)) },
      focusVisible: node.contains(active) && active.matches(':focus-visible') && parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== 'none',
      scrolls: node.scrollHeight > node.clientHeight + 1, cls: window.__setaePublic248.layout() };
  });
  const file = base.screenshotPath(name + '.png'); await page.screenshot({ path: file });
  const result = { name, screenshot: path.relative(base.evidenceDir, file), geometry }; results.push(result);
  assert.equal(geometry.modal && geometry.fits, true, name + ': native dialog fits viewport');
  assert.equal(geometry.horizontalOverflow, false, name + ': dialog reflow');
  assert.deepEqual(geometry.controls.filter((control) => control.width < 43.5 || control.height < 43.5 || !control.label || control.clipped), [], name + ': all named controls >=44px');
  assert.equal(geometry.focusVisible, true, name + ': keyboard focus ring');
  assert.ok(geometry.cls.value < 0.1, name + ': dialog must not shift the page');
  if (geometry.scrolls) {
    const submit = dialog.locator('[data-public-register-submit]'); await submit.focus(); await submit.scrollIntoViewIfNeeded();
    const box = await submit.boundingBox(); const viewport = page.viewportSize();
    assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, 'Final submit reachable in internally scrolling dialog.');
    const bottom = base.screenshotPath(name + '-bottom.png'); await page.screenshot({ path: bottom }); result.bottomScreenshot = path.relative(base.evidenceDir, bottom);
  }
  if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
    const submit = dialog.locator('[data-public-register-submit]');
    await submit.scrollIntoViewIfNeeded(); await submit.hover(); await submit.focus();
    result.forcedColorsSubmit = await submit.evaluate((node) => {
      const css = getComputedStyle(node); const dialogCss = getComputedStyle(node.closest('dialog'));
      return { hovered: node.matches(':hover'), focused: node === document.activeElement, label: node.textContent.trim(),
        background: css.backgroundColor, foreground: css.color, canvas: dialogCss.backgroundColor, canvasText: dialogCss.color,
        focusVisible: node.matches(':focus-visible') && parseFloat(css.outlineWidth) >= 2 && css.outlineStyle !== 'none' };
    });
    const hoverFile = base.screenshotPath(name + '-submit-hover.png'); await page.screenshot({ path: hoverFile });
    result.forcedColorsSubmit.screenshot = path.relative(base.evidenceDir, hoverFile);
    assert.equal(result.forcedColorsSubmit.hovered && result.forcedColorsSubmit.focused && result.forcedColorsSubmit.focusVisible, true, name + ': forced-colors primary hover/focus exercised');
    assert.equal(result.forcedColorsSubmit.background, result.forcedColorsSubmit.canvas, name + ': primary hover retains system Canvas background');
    assert.equal(result.forcedColorsSubmit.foreground, result.forcedColorsSubmit.canvasText, name + ': primary hover retains readable CanvasText foreground');
    assert.notEqual(result.forcedColorsSubmit.foreground, result.forcedColorsSubmit.background);
  }
  assert.deepEqual(opened.issues, []);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  return result;
}
async function captureThemeReset(opened, name, results, headingSize) {
  const theme = await opened.page.evaluate(() => {
    const sheets = [...document.styleSheets];
    const themeIndex = sheets.findIndex((sheet) => (sheet.href || '').includes('/public-theme-hostile-v248.css'));
    const sheet = sheets[themeIndex]; const htmlRule = [...(sheet?.cssRules || [])].find((rule) => rule.selectorText === 'html');
    const bodyCss = getComputedStyle(document.body);
    return { retainedTheme: !!sheet, themeFontRule: htmlRule?.style.fontSize,
      loadedAfterProduction: themeIndex > sheets.findIndex((sheet) => (sheet.href || '').includes('/assets/css/public-foundation.css')),
      rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize), bodySize: parseFloat(bodyCss.fontSize), bodyFont: bodyCss.fontFamily,
      bodyMargin: bodyCss.margin, titleSize: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) };
  });
  await capturePage(opened, name, results); results.at(-1).theme = theme;
  assert.equal(theme.retainedTheme && theme.loadedAfterProduction, true, name + ': representative theme asset stays loaded after production CSS');
  assert.equal(theme.themeFontRule, '62.5%', name + ': real conflicting root font rule is present');
  assert.equal(theme.rootSize, 16, name + ': document owns rem baseline');
  assert.equal(theme.bodySize, 16); assert.equal(theme.bodyMargin, '0px'); assert.match(theme.bodyFont, /system-ui/);
  assert.equal(theme.titleSize, headingSize, name + ': heading has not shrunk with the theme rem baseline');
  const registration = await captureRegistration(opened, name + '-registration', results);
  assert.equal(registration.geometry.typography.titleSize, 24);
  assert.deepEqual(registration.geometry.typography.inputSizes, [16,16,16], name + ': form inputs retain 16px text');
  assert.deepEqual(registration.geometry.typography.labelSizes, [14,14,14], name + ': labels retain design font size');
}
async function registrationFlow(opened, source) {
  const { page } = opened;
  const trigger = page.locator('[data-public-register]').first(); const dialog = page.locator('[data-public-registration]');
  await trigger.click(); await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.getAttribute('data-source'), source);
  await base.assertFocusTrap(page, dialog);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await trigger.click();
  const bounds = await dialog.boundingBox(); await page.mouse.click(bounds.x + 2, bounds.y + 2);
  assert.equal(await dialog.evaluate((node) => node.open), true, 'Dialog padding is not backdrop.');
  const outside = await base.outsideDialogPoint(dialog, page); await page.mouse.click(outside.x, outside.y); await dialog.waitFor({ state: 'hidden' });
  await trigger.click();
  const submit = dialog.locator('[data-public-register-submit]');
  await submit.click(); await dialog.locator('[data-public-register-error]').waitFor({ state: 'visible' });
  assert.equal((await page.evaluate(() => window.__setaePublic247.requests())).length, 0, 'Invalid input does not submit.');
  await dialog.locator('[name="email"]').fill('keeper248@example.test');
  await dialog.locator('[name="password"]').fill('fixture-password-248');
  await dialog.locator('[name="referral_code"]').fill('REF248');
  await dialog.locator('[name="terms_accepted"]').check();
  await page.evaluate(() => window.__setaePublic247.setRegistrationMode('pending')); await submit.click();
  await page.waitForFunction(() => document.querySelector('[data-public-registration]').dataset.busy === 'true');
  const payload = (await page.evaluate(() => window.__setaePublic247.requests())).at(-1);
  const expectedFields = ['action','username','email','password','referral_code','referral_source','terms_accepted','terms_version','qr_claim_code'];
  if (source === 'public_partner') expectedFields.push('return_url');
  assert.deepEqual(Object.keys(payload).sort(), expectedFields.sort());
  if (source === 'public_partner') assert.equal(payload.return_url, `${base.baseUrl}/?setae_plan=breeder_trial`);
  assert.equal(payload.action, 'setae_register_user'); assert.equal(payload.referral_source, source); assert.equal(payload.qr_claim_code, ''); assert.equal(payload.terms_version, '2026-03-01');
  assert.equal(await dialog.locator('button:not([disabled]),input:not([disabled])').count(), 0);
  await page.keyboard.press('Escape'); await page.mouse.click(outside.x, outside.y); assert.equal(await dialog.evaluate((node) => node.open), true);
  await page.evaluate(() => window.__setaePublic247.completePending(false)); await dialog.locator('[data-public-register-error]').filter({ hasText: 'このメールアドレスは使用できません' }).waitFor();
  assert.equal(await dialog.locator('[name="password"]').inputValue(), 'fixture-password-248'); assert.equal(await dialog.locator('[name="email"]').inputValue(), 'keeper248@example.test');
  await page.evaluate(() => window.__setaePublic247.setRegistrationMode('success')); await submit.click(); await dialog.waitFor({ state: 'hidden' });
  await page.locator('[data-public-register-notice]').filter({ hasText: '認証メール' }).waitFor();
  assert.equal(await dialog.locator('[name="password"]').inputValue(), ''); assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  assert.deepEqual(opened.issues, []);
  return { source, status: 'PASS', checks: ['focus-trap','focus-return','padding/backdrop','validation','exact-payload','busy-lock','error-retention','retry-success'], scope: 'Mocked registration HTTP; no SMTP or real account created.' };
}
module.exports = { ...base, doubleText, openShare, inspectLayout, capturePage, captureRegistration, captureThemeReset, registrationFlow };
