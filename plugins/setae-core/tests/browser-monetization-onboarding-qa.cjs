const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
process.env.SETAE_QA_EVIDENCE ||= path.resolve(__dirname, '../../../../release-evidence/v1.0.251/monetization-onboarding');
const { launchBrowser, openFixture, screenshotPath, writeEvidence } = require('./browser-v246-helpers.cjs');
const root = path.resolve(__dirname, '..');
const sourceFiles = ['assets/app/app.js', 'assets/app/features/onboarding/model.js', 'assets/app/features/onboarding/view.js',
  'assets/app/features/onboarding/arrival.js', 'assets/app/features/settings/plan.js', 'assets/app/features/settings/plan-controller.js',
  'assets/app/components/app-frame.js', 'assets/app/features/analytics/client-context.js', 'tests/helpers/monetization-app-fixture.js'];
sourceFiles.push('assets/app/styles/components.css', 'assets/app/styles/screens/settings.css', 'assets/app/styles/screens/specimen-intake.css');
const hashes = () => Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const initialHashes = hashes();
const results = [];
const caseFilter = process.env.SETAE_QA_CASE || '';
const limitations = 'Production app/controllers and native DOM events; synthetic loopback API only. No live WordPress, real authentication/email/Stripe payment, physical camera or performance-budget certification.';
const photo = { name: 'local-gate-photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lVQAAAAASUVORK5CYII=', 'base64') };
const snapshot = page => page.evaluate(() => window.__setaeMonetizationApp.snapshot());
const calls = page => page.evaluate(() => window.__setaeMonetizationFixture.calls());
const action = (page, name) => page.locator(`[data-action="${name}"]:visible`).first();
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function geometry(page) {
  const value = await page.evaluate(() => ({ viewport: innerWidth, client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth, focusedTag: document.activeElement?.tagName }));
  assert.ok(value.scroll <= value.client + 1, 'Page must not overflow horizontally: ' + JSON.stringify(value));
  return value;
}
async function scaleComponentText(page, selector, factor) {
  const sample = await page.locator(selector).evaluate((root, factor) => {
    const text = [root, ...root.querySelectorAll('*')].filter(node => node instanceof HTMLElement)
      .map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
    text.forEach(([node, size]) => { node.style.fontSize = (size * factor) + 'px'; });
    const example = text.find(([node]) => node.tagName === 'P') || text[0];
    return { beforePx: example[1], afterPx: parseFloat(getComputedStyle(example[0]).fontSize), nodes: text.length };
  }, factor);
  assert.equal(sample.afterPx, sample.beforePx * factor);
  await frames(page);
  return { factor, method: 'Computed text sizes multiplied inside the new component only; not whole-browser or physical-device zoom.', ...sample };
}
async function planRowGeometry(page) {
  const rows = await page.locator('[data-plan-summary] .data-row').evaluateAll(nodes => nodes.map(node => {
    const fragments = element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    };
    const [label, value] = [...node.children];
    const left = fragments(label), right = fragments(value);
    const overlaps = left.some(a => right.some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
    return { label: label.textContent, value: value.textContent, overlaps, labelFragments: left, valueFragments: right };
  }));
  assert.ok(rows.length >= 7, 'Actual plan usage rows must be present for layout checks');
  assert.deepEqual(rows.filter(row => row.overlaps), [], 'Plan labels and values must not overlap at the requested text size');
  return rows;
}
async function capture(page, name, fullPage = true) { const file = screenshotPath(name + '.png'); await page.screenshot({ path: file, fullPage }); return file; }
async function runCase(browser, name, options, inspect) {
  if (caseFilter && name !== caseFilter) return;
  console.log('RUN ' + name);
  const opened = await openFixture('monetization-app.html', { browser, ...options });
  try {
    assert.equal(await opened.page.evaluate(() => window.__setaeMonetizationFixture.sourceSha256), initialHashes['assets/app/app.js']);
    const details = await inspect(opened.page);
    assert.deepEqual(await opened.page.evaluate(() => window.__setaeMonetizationFixture.unexpected()), []);
    assert.deepEqual(opened.issues, []);
    results.push({ name, status: 'PASS', ...details });
    console.log('PASS ' + name);
  } catch (error) {
    const screenshot = await capture(opened.page, name + '-failure');
    results.push({ name, status: 'FAIL', message: error.message, screenshot });
    throw error;
  } finally { await opened.context.close(); }
}

async function emptyFlow(page, name) {
  assert.equal((await snapshot(page)).page, 'today');
  assert.equal((await snapshot(page)).setupOpen, false);
  assert.equal(await page.locator('[data-acquisition-start]').count(), 1);
  assert.equal(await page.locator('[data-acquisition-start] [data-action="start-qr-acquisition"]').count(), 1);
  assert.equal(await page.locator('[data-acquisition-start] [data-action="add-animal"]').count(), 1);
  assert.equal(await page.locator('[role="dialog"]:visible').count(), 0, 'Style setup must not block the first two choices');
  const before = await geometry(page);
  const todayImage = await capture(page, name + '-today');
  const controls = await page.locator('[data-acquisition-start] .onboarding-step').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { width: r.width, height: r.height };
  }));
  assert.ok(controls.every(box => box.width >= 44 && box.height >= 44));
  await action(page, 'start-qr-acquisition').click();
  await page.locator('[data-role="qr-resolve-form"] [name="code"]').waitFor();
  assert.equal((await snapshot(page)).recordsView, 'qr');
  await page.locator('[data-role="qr-resolve-form"] [name="code"]').fill('LOCAL-ONLY-CODE');
  await page.locator('[data-role="qr-resolve-form"] [name="code"]').fill('');
  await page.locator('[data-nav="animals"]:visible').first().click();
  await page.locator('[data-acquisition-start]').waitFor();
  assert.equal((await snapshot(page)).page, 'animals');
  await action(page, 'add-animal').click();
  await page.locator('form[data-specimen-intake-root]').waitFor();
  assert.equal(await page.locator('[name="name"]').count(), 1);
  assert.equal(await page.locator('[data-role="species-combobox-input"]').count(), 1);
  assert.equal((await snapshot(page)).setupOpen, false);
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  const sessionEvents = (await calls(page)).filter(call => call.path === '/metrics/events' && call.payload.event === 'app_session_started');
  assert.equal(sessionEvents.length, 1, 'Navigating within one session must not emit duplicate session starts');
  return { geometry: before, controls, screenshot: todayImage, sessionEvents: sessionEvents.length };
}

async function gateFlow(page, name, textScale = 1) {
  await page.locator('[data-nav="animals"]:visible').first().click();
  await action(page, 'add-animal').click();
  const form = page.locator('form[data-specimen-intake-root]');
  await form.waitFor();
  const nameInput = form.locator('[name="name"]');
  await nameInput.fill('LOCAL-入力保持');
  await form.locator('[data-role="species-combobox-input"]').fill('セラ');
  await page.getByRole('option', { name: /セラドニア/ }).click();
  await form.locator('details[data-specimen-intake-section="records"] > summary').click();
  await form.locator('[name="notes"]').fill('制限の案内後もこの入力と写真を保持します。');
  await form.locator('[name="image"]').setInputFiles(photo);
  await nameInput.focus();
  await nameInput.evaluate(node => node.setSelectionRange(2, 6));
  await page.evaluate(() => {
    const form = document.querySelector('form[data-specimen-intake-root]');
    window.__gateNodes = { form, name: form.elements.name, note: form.elements.notes, image: form.elements.image,
      files: form.elements.image.files, selected: [form.elements.name.selectionStart, form.elements.name.selectionEnd] };
  });
  await page.keyboard.press('Enter');
  await form.locator('[data-plan-gate]').waitFor();
  await frames(page);
  const identity = await page.evaluate(() => {
    const old = window.__gateNodes, form = document.querySelector('form[data-specimen-intake-root]');
    return { form: old.form === form, name: old.name === form.elements.name, note: old.note === form.elements.notes,
      image: old.image === form.elements.image, files: old.files === form.elements.image.files,
      value: form.elements.name.value, noteValue: form.elements.notes.value, fileName: form.elements.image.files[0]?.name,
      focusedName: document.activeElement === form.elements.name,
      activeTag: document.activeElement?.tagName, activeName: document.activeElement?.getAttribute('name'),
      activeRole: document.activeElement?.getAttribute('role'), activeAction: document.activeElement?.dataset?.action,
      selection: [form.elements.name.selectionStart, form.elements.name.selectionEnd] };
  });
  assert.deepEqual({ form: identity.form, name: identity.name, note: identity.note, image: identity.image, files: identity.files },
    { form: true, name: true, note: true, image: true, files: true });
  assert.equal(identity.value, 'LOCAL-入力保持');
  assert.equal(identity.fileName, photo.name);
  assert.equal(identity.focusedName, true, 'A server gate must preserve the initiating text input focus: ' + JSON.stringify(identity));
  assert.deepEqual(identity.selection, [2, 6]);
  assert.match(await form.locator('[data-plan-gate]').textContent(), /QRからの受領は登録枠を使いません/);
  const scale = textScale > 1 ? await scaleComponentText(page, '[data-plan-gate]', textScale) : null;
  const initialGate = await form.locator('[data-plan-gate]').evaluate(node => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, viewportHeight: innerHeight,
      visibleHeight: Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(0, box.top)) };
  });
  const initialScreenshot = await capture(page, name + '-gate-initial', false);
  await form.locator('[data-plan-gate]').scrollIntoViewIfNeeded();
  const screenshot = await capture(page, name + '-gate');
  if (scale) {
    const panel = form.locator('[data-plan-gate]');
    const scroll = await panel.evaluate(node => ({ client: node.clientHeight, scroll: node.scrollHeight,
      width: node.clientWidth, scrollWidth: node.scrollWidth, max: parseFloat(getComputedStyle(node).maxBlockSize) }));
    assert.ok(scroll.client <= scroll.max + 1, 'The scaled plan gate remains height-bounded');
    assert.ok(scroll.scrollWidth <= scroll.width + 1, 'Scaled plan text/buttons must wrap without horizontal scrolling');
    for (const label of ['start-breeder-trial', 'view-breeder-starter', 'dismiss-plan-gate']) {
      const control = panel.locator(`[data-action="${label}"]`);
      await control.scrollIntoViewIfNeeded(); await control.focus();
      assert.equal(await control.evaluate(node => document.activeElement === node), true);
      const box = await control.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);
    }
    await action(page, 'dismiss-plan-gate').click();
    assert.equal(await nameInput.evaluate(node => document.activeElement === node), true);
    return { identity, scale, initialGate, initialScreenshot, screenshot, scroll, geometry: await geometry(page), syntheticTrialRequests: 0 };
  }
  await action(page, 'start-breeder-trial').click();
  await page.waitForFunction(() => window.__setaeMonetizationApp.snapshot().profile?.plan?.id === 'breeder_trial');
  await form.locator('[data-plan-gate][role="status"]').waitFor();
  assert.equal(await form.locator('[name="image"]').evaluate(node => node.files[0]?.name), photo.name);
  assert.equal(await nameInput.inputValue(), 'LOCAL-入力保持');
  assert.equal((await calls(page)).filter(call => call.path === '/spiders' && call.method === 'POST').length, 1, 'Trial success must not automatically resubmit the preserved form');
  assert.equal((await calls(page)).filter(call => call.path === '/plans/trial').length, 1);
  await action(page, 'dismiss-plan-gate').click();
  assert.equal(await form.locator('[data-plan-gate]').count(), 0);
  assert.equal(await form.locator('[name="notes"]').inputValue(), identity.noteValue);
  assert.equal(await nameInput.evaluate(node => document.activeElement === node), true, 'Dismissing a gate returns focus to the preserved input');
  return { identity, initialGate, initialScreenshot, screenshot, geometry: await geometry(page), syntheticTrialRequests: 1, automaticResubmits: 0 };
}

async function planFlow(page, id, textScale = 1) {
  await page.locator('[data-plan-summary]').waitFor();
  assert.equal((await snapshot(page)).settingsTab, 'plan');
  const text = await page.locator('[data-plan-summary]').textContent();
  assert.match(text, /QRで受け取った個体/);
  assert.match(text, /ベビー群/);
  assert.doesNotMatch(text, /NaN|undefined|無制限(?:匹|件|群)/);
  if (id === 'legacy_premium') assert.match(text, /無制限/);
  const pricing = page.locator('[data-plan-pricing]');
  if (['keeper_free', 'breeder_trial'].includes(id)) {
    await action(page, 'view-breeder-starter').click();
    assert.equal(await pricing.isVisible(), true);
    const checkout = pricing.locator('[data-action="billing-checkout"]');
    assert.equal(await checkout.isDisabled(), true);
    assert.match(await checkout.textContent(), /現在準備中/);
    assert.equal((await calls(page)).filter(call => call.path === '/metrics/events' && call.payload.event === 'pricing_viewed').length, 1);
  }
  const scale = textScale > 1 ? await scaleComponentText(page, '#settings-tabpanel', textScale) : null;
  assert.equal((await calls(page)).filter(call => call.path.startsWith('/stripe/')).length, 0);
  return { plan: id, scale, rows: await planRowGeometry(page), geometry: await geometry(page),
    screenshot: await capture(page, 'plan-' + id + (textScale > 1 ? '-text' + textScale : '')) };
}

(async () => {
  const browser = await launchBrowser();
  let failure;
  try {
    for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light']]) {
      const name = `empty-${width}-${theme}`;
      await runCase(browser, name, { viewport: { width, height: width === 1440 ? 1000 : 844 }, query: { theme } }, page => emptyFlow(page, name));
    }
    for (const width of [320, 1440]) {
      const name = 'gate-' + width;
      await runCase(browser, name, { viewport: { width, height: width === 320 ? 844 : 1000 }, query: { scenario: 'limit' } }, page => gateFlow(page, name));
    }
    for (const id of ['keeper_free', 'breeder_trial', 'breeder_starter', 'legacy_premium']) {
      await runCase(browser, 'plan-' + id, { viewport: { width: 390, height: 844 }, query: { plan: id, setae_plan: 'breeder_trial' } }, page => planFlow(page, id));
    }
    for (const scale of [2, 4]) {
      const name = 'gate-320-text' + scale;
      await runCase(browser, name, { viewport: { width: 320, height: 844 }, query: { scenario: 'limit' } }, page => gateFlow(page, name, scale));
      await runCase(browser, 'plan-320-text' + scale, { viewport: { width: 320, height: 844 },
        query: { setae_plan: 'breeder_trial' } }, page => planFlow(page, 'keeper_free', scale));
    }
    await runCase(browser, 'plan-forced-colors', { forcedColors: 'active', query: { setae_plan: 'breeder_trial' } }, async page => {
      const result = await planFlow(page, 'keeper_free');
      result.screenshot = await capture(page, 'plan-forced-colors');
      return { ...result, forcedColors: true };
    });
    await runCase(browser, 'arrival-390-dark', { query: { scenario: 'arrival', theme: 'dark' }, colorScheme: 'dark' }, async page => {
      const checklist = page.locator('[data-arrival-checklist]');
      await checklist.waitFor();
      assert.equal(await checklist.locator('.onboarding-step').count(), 4);
      assert.equal(await checklist.locator('.onboarding-step.is-complete').count(), 0, 'Inherited history cannot complete the recipient arrival checklist');
      const screenshot = await capture(page, 'arrival-390-dark');
      await checklist.locator('[data-action="smart-quick-record"]').first().click();
      await page.locator('[role="dialog"]:visible').waitFor();
      assert.equal((await snapshot(page)).records[0].event.recorded_by_current_user, false);
      return { screenshot, geometry: await geometry(page), inheritedRecordCount: 1, arrivalActions: 4 };
    });
    assert.equal(results.length, caseFilter ? 1 : 15, 'The requested case selection must actually execute');
    assert.deepEqual(hashes(), initialHashes, 'Production/fixture sources changed during the run');
  } catch (error) { failure = error; console.error(error); }
  finally {
    await browser.close();
    writeEvidence('browser-monetization-onboarding-qa.json', { status: failure ? 'FAIL' : 'PASS', limitations,
      sourceHashes: initialHashes, caseFilter: caseFilter || null, results, error: failure?.message || null });
  }
  if (failure) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
