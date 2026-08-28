const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

process.env.SETAE_QA_EVIDENCE ||= path.resolve(__dirname, '../../../../release-evidence/v1.0.250/collection-window');
const { launchBrowser, openFixture, screenshotPath, writeEvidence, evidenceDir } = require('./browser-v246-helpers.cjs');

const itemSelector = '[data-role="collection-items"] [data-collection-animal]';
const moreSelector = '[data-action="show-more-collection"]';
const searchSelector = '[data-role="animal-search"]';
const footerSelector = '[data-role="collection-progressive-footer"]';
const items = (page) => page.locator(itemSelector);
const idsThrough = (count) => Array.from({ length: count }, (_, index) => String(index + 1));
const oddIds = (count) => idsThrough(count).filter((id) => Number(id) % 2 === 1);
const nextFrame = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = (page) => page.evaluate(() => window.__setaeIntakeApp.snapshot());
const root = path.resolve(__dirname, '..');
const sourceHashes = Object.fromEntries([
  'assets/app/app.js', 'assets/app/features/collection/view.js', 'assets/app/features/collection/list-window.js',
  'assets/app/features/collection/workspace-controller.js', 'assets/app/features/collection/search.js',
  'assets/app/components/progressive-list.js', 'tests/helpers/specimen-intake-app-fixture.js'
].map((file) => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const limitations = 'Real app.js, imported production controllers/renderers and native DOM events; API responses and animals are local synthetic fixtures. No WordPress persistence, real account, physical-device or performance-budget certification.';
const positionPolicy = { tolerancePx: 2,
  tableAppend: 'Numeric window.scrollY at native click capture versus after two animation frames.',
  galleryAppend: 'The same visible card top at native click capture versus after two animation frames; raw scrollY is also recorded because content-visibility can change intrinsic heights above the viewport.',
  historyReturn: 'Numeric window.scrollY and the restored route window must match the pre-navigation state.' };

async function assertWindow(page, expectedIds, total, limit) {
  await page.waitForFunction(({ selector, count, total }) => {
    const countNode = document.querySelector('[data-role="collection-result-count"] strong');
    return document.querySelectorAll(selector).length === count && Number(countNode?.textContent) === total;
  }, { selector: itemSelector, count: expectedIds.length, total });
  const actual = await items(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId));
  assert.deepEqual(actual, expectedIds, 'Rendered items must retain the complete query order without duplicates or omissions.');
  assert.equal(new Set(actual).size, actual.length);
  const state = await snapshot(page);
  assert.equal(state.page, 'animals');
  assert.equal(state.collectionWindow.limit, limit);
  assert.equal(state.collectionWindow.initial, 50);
  assert.equal(state.collectionWindow.step, 50);
  if (expectedIds.length) {
    assert.equal(await page.locator('[data-role="collection-items"]').getAttribute('data-collection-total'), String(total));
    assert.match(await page.locator(footerSelector + ' .progressive-list-count').textContent(),
      new RegExp('^' + expectedIds.length + ' / ' + total + '匹を表示$'));
    if (state.animalView === 'table') {
      assert.equal(await page.locator('.collection-registry-table').getAttribute('aria-rowcount'), String(total + 1));
      assert.deepEqual(await items(page).evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('aria-rowindex')))),
        expectedIds.map((_, index) => index + 2));
    }
  }
  assert.equal(await page.locator(moreSelector).count(), expectedIds.length < total ? 1 : 0);
  return state;
}

async function rememberNodes(page) {
  return page.evaluate(({ itemSelector, searchSelector }) => {
    const first = document.querySelector(itemSelector);
    window.__setaeCollectionWindowNodes = { first, input: document.querySelector(searchSelector),
      checkbox: first?.querySelector('[data-action="toggle-collection-selection"]') || null,
      container: document.querySelector('[data-role="collection-items"]') };
    return { firstId: first?.dataset.animalId, hasSearch: Boolean(window.__setaeCollectionWindowNodes.input),
      hasCheckbox: Boolean(window.__setaeCollectionWindowNodes.checkbox) };
  }, { itemSelector, searchSelector });
}

async function assertRememberedNodes(page) {
  const identity = await page.evaluate(({ itemSelector, searchSelector }) => {
    const saved = window.__setaeCollectionWindowNodes;
    const first = document.querySelector(itemSelector);
    return { first: saved.first === first, input: saved.input === document.querySelector(searchSelector),
      container: saved.container === document.querySelector('[data-role="collection-items"]'),
      checkbox: saved.checkbox === (first?.querySelector('[data-action="toggle-collection-selection"]') || null) };
  }, { itemSelector, searchSelector });
  assert.deepEqual(identity, { first: true, input: true, container: true, checkbox: true },
    'Appending must keep the first row/card, its checkbox, the container and the search input.');
  return identity;
}

async function appendOnce(page, expectedIds, total) {
  const before = await snapshot(page);
  const more = page.locator(moreSelector);
  await more.scrollIntoViewIfNeeded();
  const historyLength = await page.evaluate(() => history.length);
  const bounds = await more.boundingBox();
  const minimumHeight = page.viewportSize().width <= 767 ? 44 : 40;
  assert.ok(bounds.width >= 44 && bounds.height >= minimumHeight,
    'The progressive action follows the existing desktop 40px / mobile 44px control contract: ' + JSON.stringify(bounds));
  // Existing content-visibility can settle a gallery card between scrolling the
  // action into view and Playwright's actual click. Observe the native event's
  // position before the app handler, without preventing or replacing the click.
  await page.evaluate(({ selector, itemSelector }) => {
    window.__setaeCollectionAppendAtClick = null;
    const observe = (event) => {
      if (!event.target.closest(selector)) return;
      const visible = [...document.querySelectorAll(itemSelector)].find((node) => {
        const box = node.getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight;
      });
      window.__setaeCollectionAppendAtClick = { scrollY: window.scrollY,
        anchor: visible ? { id: visible.dataset.animalId, top: visible.getBoundingClientRect().top } : null };
      document.removeEventListener('click', observe, true);
    };
    document.addEventListener('click', observe, true);
  }, { selector: moreSelector, itemSelector });
  await more.click();
  const beforeScroll = await page.evaluate(() => window.__setaeCollectionAppendAtClick.scrollY);
  const limit = Math.min(before.collectionWindow.limit + 50, total);
  await assertWindow(page, expectedIds.slice(0, limit), total, limit);
  await nextFrame(page);
  const after = await snapshot(page);
  assert.equal(after.collectionWindow.queryKey, before.collectionWindow.queryKey);
  assert.equal(after.historyState.context.collectionWindow.limit, limit, 'Appends must persist the window into route history.');
  assert.equal(after.historyState.index, before.historyState.index, 'Appending replaces, rather than pushes, the route.');
  assert.equal(await page.evaluate(() => history.length), historyLength);
  const afterScroll = await page.evaluate(() => window.scrollY);
  const anchor = await page.evaluate((itemSelector) => {
    const before = window.__setaeCollectionAppendAtClick.anchor;
    const item = before && [...document.querySelectorAll(itemSelector)].find((node) => node.dataset.animalId === before.id);
    return before ? { ...before, afterTop: item?.getBoundingClientRect().top } : null;
  }, itemSelector);
  // Gallery content-visibility can correct intrinsic heights above the viewport.
  // In that case the browser's numeric scroll offset is not the visual position:
  // require the same visible card to stay within the same 2px tolerance. Tables
  // retain the exact numeric scroll check; history restoration is checked below.
  const positionDelta = before.animalView === 'gallery' && anchor
    ? Math.abs(anchor.afterTop - anchor.top) : Math.abs(afterScroll - beforeScroll);
  assert.ok(positionDelta <= 2,
    'Appending must not move the visible position: ' + JSON.stringify({ beforeScroll, afterScroll,
      beforeLimit: before.collectionWindow.limit, limit, savedScroll: after.historyState.scrollY, anchor, positionDelta }));
  const focus = await page.evaluate(({ moreSelector, footerSelector }) => {
    const target = document.querySelector(moreSelector) || document.querySelector(footerSelector + ' .progressive-list-count');
    return { same: target === document.activeElement, terminal: target?.tagName === 'OUTPUT' };
  }, { moreSelector, footerSelector });
  assert.equal(focus.same, true, 'Focus must move to the renewed action, or the terminal count when complete.');
  assert.equal(focus.terminal, limit === total);
  assert.match(await page.locator(footerSelector + ' [aria-live="polite"]').textContent(), /匹を追加しました/);
  await assertRememberedNodes(page);
  return { limit, scrollRetained: true, beforeScroll, afterScroll, anchor, positionDelta, terminalFocus: focus.terminal };
}

async function appendToEnd(page, expectedIds) {
  const progression = [];
  while (await page.locator(moreSelector).count()) progression.push(await appendOnce(page, expectedIds, expectedIds.length));
  return progression;
}

async function search(page, query, expectedIds) {
  await page.locator(searchSelector).fill(query);
  await assertWindow(page, expectedIds.slice(0, 50), expectedIds.length, 50);
  assert.equal((await snapshot(page)).animalSearch, query);
}

async function assertMobileGeometry(page) {
  const geometry = await page.evaluate((selector) => {
    const row = document.querySelector(selector);
    const checkbox = row?.querySelector('.checkbox-control');
    const box = row?.getBoundingClientRect();
    const check = checkbox?.getBoundingClientRect();
    const modeButtons = [...document.querySelectorAll('[data-action="animal-card-mode"]')].map((button) => {
      const rect = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button.querySelector('span') || button);
      return { label: button.textContent.trim(), width: rect.width, height: rect.height,
        textLines: new Set([...range.getClientRects()].map((line) => line.top)).size };
    });
    return { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      row: box && { left: box.left, right: box.right, width: box.width, height: box.height },
      checkbox: check?.width > 0 && check?.height > 0 ? { width: check.width, height: check.height } : null, modeButtons };
  }, itemSelector);
  assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, 'The mobile collection must not overflow horizontally.');
  assert.ok(geometry.row.left >= -1 && geometry.row.right <= geometry.clientWidth + 1 && geometry.row.height >= 44);
  if (geometry.checkbox) assert.ok(geometry.checkbox.width >= 44 && geometry.checkbox.height >= 44,
    'Visible checkbox geometry: ' + JSON.stringify(geometry));
  assert.ok(geometry.modeButtons.every((button) => button.width >= 44 && button.height >= 44 && button.textLines === 1),
    'Mobile display modes need 44px controls and intact single-line labels: ' + JSON.stringify(geometry.modeButtons));
  return geometry;
}

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const onlyCase = process.env.SETAE_QA_CASE || '';
  let activeCase = '';
  async function runCase(name, options, inspect) {
    if (onlyCase && onlyCase !== name) return;
    activeCase = name;
    const opened = await openFixture('specimen-intake-app.html', { browser, query: { open: 'false', count: '123', ...options.query },
      viewport: options.viewport || { width: 1440, height: 1000 }, colorScheme: options.colorScheme || 'light' });
    try {
      const source = await opened.page.evaluate(() => window.__setaeIntakeFixture.sourceSha256);
      assert.equal(source, sourceHashes['assets/app/app.js'], 'The fixture must execute the current production app source.');
      const detail = await inspect(opened.page);
      const audit = await opened.page.evaluate(() => ({ unexpected: window.__setaeIntakeFixture.unexpected(),
        calls: window.__setaeIntakeFixture.calls(),
        fixtureCount: window.__setaeIntakeFixture.requestedCount }));
      assert.deepEqual(audit.unexpected, []);
      const sessionEvents = audit.calls.filter((call) => call.path === '/metrics/events');
      assert.equal(sessionEvents.length, 1, 'One app session must emit exactly one metrics request during collection browsing.');
      const sessionEvent = sessionEvents[0];
      assert.equal(sessionEvent.method, 'POST', 'Session analytics must use the exact POST /metrics/events contract.');
      assert.ok(sessionEvent.payload && typeof sessionEvent.payload === 'object' && !Array.isArray(sessionEvent.payload),
        'Session analytics must have an object payload.');
      assert.equal(typeof sessionEvent.payload.event, 'string');
      assert.equal(sessionEvent.payload.event, 'app_session_started', 'No other analytics event is allowed by this browsing test.');
      const mutations = audit.calls.filter((call) => call.method !== 'GET'
        && !(call.method === 'POST' && call.path === '/ui/preferences')
        && !(call.method === 'POST' && call.path === '/metrics/events' && call.payload?.event === 'app_session_started'));
      assert.deepEqual(mutations, [], 'Collection browsing and selection must not save specimen records.');
      assert.deepEqual(opened.issues, []);
      results.push({ check: name, status: 'PASS', fixtureCount: audit.fixtureCount,
        sessionEventCount: sessionEvents.length, specimenWriteCount: mutations.length, ...detail });
    } catch (error) {
      const file = screenshotPath(name + '-failure.png');
      try { await opened.page.screenshot({ path: file, fullPage: false, timeout: 5000 }); } catch {}
      throw error;
    } finally { await opened.context.close(); }
  }
  try {
    for (const variant of [
      { mode: 'table', width: 1440 }, { mode: 'gallery', width: 1440 },
      { mode: 'table', width: 320 }, { mode: 'gallery', width: 375 }
    ]) {
      await runCase('collection-' + variant.mode + '-' + variant.width + '-initial-and-complete-123', {
        query: { view: variant.mode }, viewport: { width: variant.width, height: 844 }
      }, async (page) => {
        const all = idsThrough(123);
        await assertWindow(page, all.slice(0, 50), 123, 50);
        assert.equal((await snapshot(page)).animalIds.length, 123, 'The window only limits rendering, not loaded query data.');
        await rememberNodes(page);
        const progression = await appendToEnd(page, all);
        assert.deepEqual(progression.map((entry) => entry.limit), [100, 123]);
        const input = await page.locator(searchSelector).elementHandle();
        const matched = oddIds(123);
        await search(page, 'Typhochlaena', matched);
        assert.equal(await input.evaluate((node, selector) => node === document.querySelector(selector), searchSelector), true,
          'Search updates only results and retains the input node.');
        await rememberNodes(page);
        const searchProgression = await appendToEnd(page, matched);
        assert.deepEqual(searchProgression.map((entry) => entry.limit), [62]);
        await page.locator('[data-action="clear-collection-search"]').click();
        await assertWindow(page, all.slice(0, 50), 123, 50);
        await search(page, 'Typhochlaena', matched);
        await page.locator('[data-action="clear-collection-search"]').click();
        await assertWindow(page, all.slice(0, 50), 123, 50);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
        await nextFrame(page);
        const geometry = variant.width < 768 ? await assertMobileGeometry(page) : null;
        const file = screenshotPath('collection-window-' + variant.mode + '-' + variant.width + '.png');
        await page.screenshot({ path: file, fullPage: false });
        return { ...variant, progression, searchTotal: 62, searchProgression, geometry, screenshot: path.relative(evidenceDir, file) };
      });
    }

    await runCase('collection-table-500-all-items-once', { query: { count: '500' } }, async (page) => {
      const expected = idsThrough(500);
      await assertWindow(page, expected.slice(0, 50), 500, 50);
      await rememberNodes(page);
      const progression = await appendToEnd(page, expected);
      assert.deepEqual(progression.map((entry) => entry.limit), [100, 150, 200, 250, 300, 350, 400, 450, 500]);
      return { progression, duplicateIds: 0, reachedAll: true };
    });

    await runCase('collection-unseen-query-selection-500', { query: { count: '500' } }, async (page) => {
      const expected = oddIds(500);
      await search(page, 'Typhochlaena', expected);
      await page.locator('[data-action="collection-selection-mode"]').click();
      await assertWindow(page, expected.slice(0, 50), 250, 50);
      const selectAll = page.locator('[data-action="toggle-collection-select-all"]');
      assert.match(await selectAll.locator('..').textContent(), /250匹をすべて選択/);
      await selectAll.locator('..').click();
      assert.equal(await selectAll.isChecked(), true);
      assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, expected);
      assert.equal(await page.locator(itemSelector + '[data-animal-id="499"]').count(), 0);
      assert.equal((await snapshot(page)).collectionSelection.selectedIds.includes('499'), true,
        'Select-all must include matching animals outside the rendered window.');
      await rememberNodes(page);
      const progression = [];
      while (await page.locator(moreSelector).count()) {
        progression.push(await appendOnce(page, expected, 250));
        assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, expected);
        assert.equal(await items(page).evaluateAll((nodes) => nodes.every((node) => node.getAttribute('aria-selected') === 'true'
          && node.querySelector('[data-action="toggle-collection-selection"]').checked)), true);
      }
      await page.locator('[data-action="toggle-collection-select-all"]').locator('..').click();
      assert.equal(await page.locator('[data-action="toggle-collection-select-all"]').isChecked(), false);
      assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, []);
      await assertWindow(page, expected, 250, 250);
      return { queryTotal: 250, initiallyRendered: 50, selectedBeforeReveal: 250, progression, deselectAll: true };
    });

    await runCase('collection-mode-and-selection-keep-window', {}, async (page) => {
      const expected = idsThrough(123);
      await items(page).first().click();
      await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().collectionSelection.selectedId === '1');
      await rememberNodes(page);
      await appendOnce(page, expected, 123);
      assert.equal((await snapshot(page)).collectionSelection.selectedId, '1', 'Appending preserves the inspector selection.');
      const queryKey = (await snapshot(page)).collectionWindow.queryKey;
      for (const mode of ['gallery', 'table', 'gallery']) {
        await page.locator('[data-action="animal-card-mode"][data-card-mode="' + mode + '"]').click();
        const state = await assertWindow(page, expected.slice(0, 100), 123, 100);
        assert.equal(state.animalView, mode);
        assert.equal(state.collectionWindow.queryKey, queryKey);
      }
      await page.locator('[data-action="collection-selection-mode"]').click();
      await assertWindow(page, expected.slice(0, 100), 123, 100);
      await page.locator(itemSelector + '[data-animal-id="1"] [data-action="toggle-collection-selection"]').locator('..').click();
      assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, ['1']);
      await rememberNodes(page);
      await appendOnce(page, expected, 123);
      assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, ['1']);
      assert.equal(await page.locator(itemSelector + '[data-animal-id="1"] input[type="checkbox"]').isChecked(), true);
      await page.locator('[data-action="clear-collection-selection"]').click();
      const end = await assertWindow(page, expected, 123, 123);
      assert.equal(end.collectionWindow.queryKey, queryKey);
      assert.equal(end.collectionSelection.selectionMode, false);
      return { modeLimit: 100, selectionLimit: 100, selectedMode: 'gallery', inspectorSelection: '1',
        appendWhileSelected: 123, exitSelectionLimit: 123 };
    });

    await runCase('collection-search-savedview-and-same-view-filter-reset-window', {}, async (page) => {
      const all = idsThrough(123);
      await rememberNodes(page);
      await appendOnce(page, all, 123);
      const allKey = (await snapshot(page)).collectionWindow.queryKey;
      await page.locator('[data-role="collection-view-filter"]').selectOption('qa-preserved');
      const saved = await assertWindow(page, all.slice(0, 50), 123, 50);
      assert.notEqual(saved.collectionWindow.queryKey, allKey, 'A saved-view change resets the window even if its current result is identical.');
      await rememberNodes(page);
      await appendOnce(page, all, 123);
      const savedKey = (await snapshot(page)).collectionWindow.queryKey;
      await page.locator('[data-action="edit-saved-view"]').click();
      const editor = page.locator('[data-role="saved-view-form"]');
      await editor.locator('[name="species"]').fill('Caribena');
      await editor.locator('button[type="submit"]').click();
      await editor.waitFor({ state: 'detached' });
      const even = all.filter((id) => Number(id) % 2 === 0);
      const filtered = await assertWindow(page, even.slice(0, 50), 61, 50);
      assert.equal(filtered.activeAnimalViewId, 'qa-preserved');
      assert.notEqual(filtered.collectionWindow.queryKey, savedKey, 'Editing the active view conditions must reset even with an unchanged ID.');
      await rememberNodes(page);
      await appendToEnd(page, even);
      await page.locator('[data-role="collection-view-filter"]').selectOption('all');
      await assertWindow(page, all.slice(0, 50), 123, 50);
      await search(page, 'Typhochlaena', oddIds(123));
      await rememberNodes(page);
      await appendToEnd(page, oddIds(123));
      await page.locator('[data-action="clear-collection-search"]').click();
      await assertWindow(page, all.slice(0, 50), 123, 50);
      assert.equal(await page.locator(searchSelector).inputValue(), '');
      assert.equal(await page.locator(searchSelector).evaluate((node) => node === document.activeElement), true);
      await search(page, 'Typhochlaena', oddIds(123));
      await page.locator('[data-action="clear-collection-search"]').click();
      await page.locator('[data-role="collection-view-filter"]').selectOption('qa-female');
      await assertWindow(page, oddIds(123).slice(0, 50), 62, 50);
      await search(page, 'LOCAL-NO-MATCH', []);
      await page.locator('[data-action="clear-collection-filters"]').click();
      const cleared = await assertWindow(page, all.slice(0, 50), 123, 50);
      assert.equal(cleared.activeAnimalViewId, 'all');
      assert.equal(await page.locator(searchSelector).inputValue(), '');
      await page.waitForFunction((selector) => document.querySelector(selector) === document.activeElement, searchSelector);
      await search(page, 'LOCAL-NO-MATCH', []);
      await page.locator('[data-action="clear-collection-search"]').click();
      await assertWindow(page, all.slice(0, 50), 123, 50);
      return { savedViewReset: true, sameViewFilterReset: true, searchReset: true, clearAndRepeatedQuery: true, conditionsClear: true };
    });

    for (const width of [320, 375]) {
      await runCase('collection-mobile-' + width + '-selection-keyboard-history', { viewport: { width, height: 844 } }, async (page) => {
        const expected = idsThrough(123);
        await page.locator('[data-action="collection-selection-mode"]').click();
        await items(page).first().focus();
        await page.keyboard.press('Space');
        await assertWindow(page, expected.slice(0, 50), 123, 50);
        assert.deepEqual((await snapshot(page)).collectionSelection.selectedIds, ['1']);
        await rememberNodes(page);
        await appendOnce(page, expected, 123);
        const selection = (await snapshot(page)).collectionSelection;
        assert.deepEqual(selection.selectedIds, ['1']);
        assert.equal(selection.selectedId, '1');
        assert.equal(await page.locator(itemSelector + '[data-animal-id="1"] input[type="checkbox"]').isChecked(), true);
        const geometry = await assertMobileGeometry(page);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
        await nextFrame(page);
        const file = screenshotPath('collection-window-' + width + '-selected-100.png');
        await page.screenshot({ path: file, fullPage: false });
        await page.locator('[data-action="clear-collection-selection"]').click();
        await assertWindow(page, expected.slice(0, 100), 123, 100);
        const target = page.locator(itemSelector + '[data-animal-id="76"]');
        await target.scrollIntoViewIfNeeded();
        await target.focus();
        const before = await snapshot(page);
        const scrollY = await page.evaluate(() => window.scrollY);
        assert.ok(scrollY > 0, 'The history test starts partway down the expanded collection.');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().page === 'animal-detail'
          && Number(window.__setaeIntakeApp.snapshot().selectedAnimalId) === 76 && !window.__setaeIntakeApp.snapshot().loadingEvents);
        assert.equal((await snapshot(page)).selectedAnimal.id, 76);
        assert.equal((await snapshot(page)).historyState.index, before.historyState.index + 1);
        await page.goBack();
        const after = await assertWindow(page, expected.slice(0, 100), 123, 100);
        await page.waitForFunction((expectedScroll) => Math.abs(window.scrollY - expectedScroll) <= 2, scrollY);
        assert.equal(after.historyState.index, before.historyState.index);
        assert.equal(after.historyState.context.collectionWindow.limit, 100);
        assert.equal(after.collectionWindow.queryKey, before.collectionWindow.queryKey);
        assert.equal(after.animalSearch, before.animalSearch);
        assert.equal(after.activeAnimalViewId, before.activeAnimalViewId);
        assert.equal(after.animalView, before.animalView);
        assert.deepEqual(after.collectionSelection, before.collectionSelection);
        assert.equal(after.error, null);
        return { width, selectionPreserved: true, geometry, detailId: 76, restoredLimit: 100, scrollY,
          restoredScrollY: await page.evaluate(() => window.scrollY), screenshot: path.relative(evidenceDir, file) };
      });
    }
    await runCase('collection-history-restored-query-accepts-previously-committed-text', { viewport: { width: 375, height: 844 } }, async (page) => {
      const firstQuery = oddIds(123);
      const secondQuery = idsThrough(123).filter((id) => Number(id) % 2 === 0);
      await search(page, 'Typhochlaena', firstQuery);
      await rememberNodes(page);
      await appendToEnd(page, firstQuery);
      await items(page).first().focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().page === 'animal-detail'
        && !window.__setaeIntakeApp.snapshot().loadingEvents);
      await page.locator('[data-nav="animals"]:visible').first().click();
      await assertWindow(page, firstQuery, 62, 62);
      await search(page, 'Caribena', secondQuery);
      await page.goBack();
      await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().page === 'animal-detail'
        && !window.__setaeIntakeApp.snapshot().loadingEvents);
      await page.goBack();
      await assertWindow(page, firstQuery, 62, 62);
      assert.equal(await page.locator(searchSelector).inputValue(), 'Typhochlaena');
      await page.locator(searchSelector).fill('Caribena');
      await nextFrame(page);
      const observed = { input: await page.locator(searchSelector).inputValue(), state: (await snapshot(page)).animalSearch,
        ids: await items(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId)) };
      assert.equal(observed.state, 'Caribena',
        'The restored route must reset search deduplication to its restored query: ' + JSON.stringify(observed));
      await assertWindow(page, secondQuery.slice(0, 50), 61, 50);
      return { restoredQuery: 'Typhochlaena', restoredWindow: 62, repeatedQuery: 'Caribena', resultTotal: 61, resetWindow: 50 };
    });
    assert.ok(results.length > 0, 'The requested collection QA case must exist.');
    writeEvidence('browser-collection-window-qa.json', { status: 'PASS', onlyCase, sourceHashes, positionPolicy, limitations, results });
    console.log('Collection progressive window QA passed (' + results.length + ' checks)');
  } catch (error) {
    writeEvidence('browser-collection-window-qa.json', { status: 'FAIL', failedCheck: activeCase, error: error.stack || String(error),
      onlyCase, sourceHashes, positionPolicy, limitations, results });
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
