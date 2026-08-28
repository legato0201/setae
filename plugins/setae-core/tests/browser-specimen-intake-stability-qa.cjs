const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const { launchBrowser, openFixture, screenshotPath, writeEvidence, evidenceDir } = require('./browser-v246-helpers.cjs');

const fixture = 'specimen-intake-preview.html';
const submitButton = (page) => page.locator('[data-specimen-intake-submit]');
const optionalSection = (page, name) => page.locator('details[data-specimen-intake-section="' + name + '"]');
const fixturePhoto = { name: 'local-qa-pixel.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lVQAAAAASUVORK5CYII=', 'base64') };

async function setOptionalOpen(page, name, open = true) {
  const section = optionalSection(page, name);
  assert.equal(await section.count(), 1, 'Expected one optional ' + name + ' section');
  if (await section.evaluate((node) => node.open) !== open) await section.locator(':scope > summary').click();
  assert.equal(await section.evaluate((node) => node.open), open);
}

async function openOptionalInputs(page) {
  for (const name of ['condition', 'husbandry', 'records']) await setOptionalOpen(page, name);
}

async function disclosureState(page) {
  return page.locator('details[data-specimen-intake-section]').evaluateAll((nodes) =>
    Object.fromEntries(nodes.map((node) => [node.dataset.specimenIntakeSection, node.open])));
}

async function withFullApp(browser, options, inspect) {
  const opened = await openFixture('specimen-intake-app.html', { browser, ...options });
  try {
    const result = await inspect(opened.page);
    assert.deepEqual(await opened.page.evaluate(() => window.__setaeIntakeFixture.unexpected()), []);
    assert.deepEqual(opened.issues, []);
    return result;
  } finally {
    await opened.context.close();
  }
}

async function specimenSaves(page) {
  return page.evaluate(() => window.__setaeIntakeFixture.calls()
    .filter((call) => call.method === 'POST' && /^\/spiders(?:\/|$)/.test(call.path)));
}

async function installEvidenceObservers(page) {
  await page.evaluate(() => {
    const nodes = window.__setaeSpecimenIntake246.nodes();
    const overlay = nodes.form.closest('[data-overlay-backdrop]');
    window.__setaeIntakeEvidence = {
      before: nodes,
      formChildList: 0,
      overlayChildList: 0,
      speciesChildList: 0,
      longTasks: []
    };
    new MutationObserver((records) => {
      window.__setaeIntakeEvidence.formChildList += records.filter((record) => record.type === 'childList').length;
    }).observe(nodes.form, { childList: true });
    new MutationObserver((records) => {
      window.__setaeIntakeEvidence.overlayChildList += records.filter((record) => record.type === 'childList').length;
    }).observe(overlay, { childList: true });
    new MutationObserver((records) => {
      window.__setaeIntakeEvidence.speciesChildList += records.filter((record) => record.type === 'childList').length;
    }).observe(nodes.species, { childList: true, subtree: true });
    try {
      new PerformanceObserver((list) => {
        window.__setaeIntakeEvidence.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch (error) {}
  });
}

async function identities(page) {
  return page.evaluate(() => {
    const before = window.__setaeIntakeEvidence.before;
    const after = window.__setaeSpecimenIntake246.nodes();
    return {
      form: before.form === after.form,
      name: before.name === after.name,
      date: before.date === after.date,
      photo: before.photo === after.photo,
      note: before.note === after.note,
      classification: before.classification === after.classification,
      speciesRegion: before.species === after.species
    };
  });
}

async function selectSpecies(page) {
  const input = page.locator('[data-role="species-combobox-input"]');
  await input.fill('セラ');
  await page.getByRole('option', { name: /セラドニア/ }).waitFor();
  await page.getByRole('option', { name: /セラドニア/ }).click();
}

function compareScreenshots(beforePath, afterPath) {
  const before = PNG.sync.read(fs.readFileSync(beforePath));
  const after = PNG.sync.read(fs.readFileSync(afterPath));
  assert.equal(before.width, after.width);
  assert.equal(before.height, after.height);
  const diff = new PNG({ width: before.width, height: before.height });
  const changed = pixelmatch(before.data, after.data, diff.data, before.width, before.height, { threshold: 0.14 });
  return { changed, total: before.width * before.height, ratio: changed / (before.width * before.height) };
}

async function backgroundState(page) {
  return page.evaluate(() => {
    const state = window.__setaeIntakeApp.snapshot();
    return { page: state.page, selectedAnimalId: state.selectedAnimalId, selectedAnimal: state.selectedAnimal,
      collectionSelection: state.collectionSelection, activeAnimalViewId: state.activeAnimalViewId,
      animalSearch: state.animalSearch, history: state.historyState, url: location.href };
  });
}

async function runFullApplicationRegression(browser, results) {
  for (const edit of [false, true]) {
    const opened = await openFixture('specimen-intake-app.html', { browser,
      viewport: edit ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
      query: edit ? { edit: '1' } : {} });
    const page = opened.page;
    try {
      assert.equal(await page.evaluate(() => window.__setaeIntakeFixture.kind), 'production-app-with-local-fixture-api');
      const sourceSha256 = await page.evaluate(() => window.__setaeIntakeFixture.sourceSha256);
      assert.match(sourceSha256, /^[0-9a-f]{64}$/);
      const before = await backgroundState(page);
      await openOptionalInputs(page);
      const name = page.locator('[data-specimen-intake-root] [name="name"]');
      await name.fill(edit ? 'LOCAL-EDITED' : 'LOCAL-CREATED');
      await name.press('Space');
      await page.locator('label:has([name="name"])').click({ position: { x: 12, y: 8 } });
      await page.locator('[name="notes"]').fill('入力中の背景を変更しない。');
      await page.locator('[name="notes"]').press('Space');
      await page.locator('[name="gender"]').selectOption('female');
      await page.locator('[name="acquired_date"]').fill('2026-08-28');
      await page.locator('.specimen-intake-header').click();
      await page.locator('.specimen-intake-footer').click({ position: { x: 4, y: 4 } });
      assert.deepEqual(await backgroundState(page), before, 'Full app ordinary inputs must keep route and active animal');
      assert.equal(await page.getByText('個体データを取得できませんでした。', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.__setaeIntakeFixture.calls().filter((call) => call.method === 'POST' && /^\/spiders(?:\/|$)/.test(call.path)).length), 0);

      if (!edit) {
        // Native Enter still belongs to the form. Missing species prevents a
        // save; the application must never reinterpret it as openAnimal('').
        await name.press('Enter');
        await page.locator('[data-specimen-intake-region="error"]:not([hidden])').waitFor();
        assert.deepEqual(await backgroundState(page), before);
        await page.locator('[data-action="specimen-species-manual"]').click();
        await page.locator('[name="custom_species"]').fill('未登録の入力');
        await page.locator('[data-action="specimen-species-catalog"]').click();
        await page.locator('[name="classification"]').selectOption('true_spider');
        await page.locator('[name="classification"]').selectOption('tarantula');
        await selectSpecies(page);
        await page.waitForFunction(() => document.activeElement?.dataset.action === 'change-specimen-species');
        assert.deepEqual(await backgroundState(page), before, 'Species/classification transitions must stay inside intake');
      }

      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('pending'));
      await submitButton(page).click();
      await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
      assert.deepEqual(await backgroundState(page), before, 'Pending mutation must retain the background route');
      assert.equal(await submitButton(page).isDisabled(), true);
      await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('api-error'));
      await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '保存できませんでした' }).waitFor();
      assert.deepEqual(await backgroundState(page), before, 'Rejected save must retain the background route');
      assert.equal((await name.inputValue()).trim(), edit ? 'LOCAL-EDITED' : 'LOCAL-CREATED');
      assert.equal(await submitButton(page).isEnabled(), true);

      await submitButton(page).click();
      await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
      assert.deepEqual(await backgroundState(page), before);
      await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('success'));
      await page.waitForFunction(() => !window.__setaeIntakeApp.snapshot().modal);
      if (edit) {
        await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().page === 'animal-detail' && Number(window.__setaeIntakeApp.snapshot().selectedAnimalId) === 1 && !window.__setaeIntakeApp.snapshot().loadingEvents);
        const saved = await page.evaluate(() => window.__setaeIntakeApp.snapshot().selectedAnimal);
        assert.equal(saved.id, 1);
        assert.equal(saved.title.trim(), 'LOCAL-EDITED');
      } else {
        await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().animalIds.includes(901));
        assert.deepEqual(await backgroundState(page), before, 'New registration refreshes the collection without unrelated navigation');
      }
      const network = await page.evaluate(() => ({ calls: window.__setaeIntakeFixture.calls(), unexpected: window.__setaeIntakeFixture.unexpected() }));
      assert.deepEqual(network.unexpected, []);
      const saves = network.calls.filter((call) => call.method === 'POST' && /^\/spiders(?:\/|$)/.test(call.path));
      assert.equal(saves.length, 2, 'One explicit error and one explicit successful retry');
      assert.ok(saves.every((call) => call.path === (edit ? '/spiders/1' : '/spiders')));
      assert.ok(!network.calls.some((call) => /^\/spider\/(?:$|undefined|null|NaN)/.test(call.path)));
      assert.deepEqual(opened.issues, []);
      results.push({ check: 'full-production-app-' + (edit ? 'edit' : 'new') + '-input-pending-error-success',
        status: 'PASS', sourceSha256, before, savePaths: saves.map((call) => call.path), remoteRequests: 0,
        limitation: 'Local fixture API only; production app, service envelopes and handlers are real, WordPress persistence is not exercised.' });
    } finally {
      await opened.context.close();
    }
  }

  for (const fail of [false, true]) {
    const opened = await openFixture('specimen-intake-app.html', { browser, query: { open: 'false' } });
    const page = opened.page;
    try {
      await page.evaluate(() => {
        window.__setaeIntakeFixture.holdAnimal(1);
        window.__setaeLateAnimalFinished = false;
        window.__setaeIntakeApp.openAnimal(1).finally(() => { window.__setaeLateAnimalFinished = true; });
      });
      await page.waitForFunction(() => window.__setaeIntakeFixture.pendingAnimalReads(1) === 2);
      await page.evaluate(async () => {
        await window.__setaeIntakeApp.navigate('animals');
        window.__setaeIntakeApp.openIntake({});
        window.__setaeLateIntakeForm = document.querySelector('[data-specimen-intake-root]');
      });
      const before = await backgroundState(page);
      await page.evaluate((failure) => window.__setaeIntakeFixture.releaseAnimal(1, failure), fail);
      await page.waitForFunction(() => window.__setaeLateAnimalFinished);
      assert.deepEqual(await backgroundState(page), before, 'Late detail response must not overwrite the new intake background');
      assert.equal(await page.evaluate(() => document.querySelector('[data-specimen-intake-root]') === window.__setaeLateIntakeForm), true);
      assert.equal(await page.evaluate(() => window.__setaeIntakeApp.snapshot().error), null);
      assert.deepEqual(await page.evaluate(() => window.__setaeIntakeFixture.unexpected()), []);
      assert.deepEqual(opened.issues, []);
      results.push({ check: 'full-production-app-stale-detail-' + (fail ? 'error' : 'success'), status: 'PASS', remoteRequests: 0 });
    } finally {
      await opened.context.close();
    }
  }

  const searchFixture = await openFixture('specimen-intake-app.html', { browser, query: { open: 'false' },
    viewport: { width: 1440, height: 1000 } });
  try {
    const page = searchFixture.page;
    const initialInput = page.locator('[data-role="animal-search"]');
    const initialClear = page.locator('[data-action="clear-collection-search"]');
    const initialRows = page.locator('[data-role="collection-results-body"] [data-collection-animal]:visible');
    const resetConditions = page.locator('[data-action="clear-collection-filters"]');
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.snapshot().activeAnimalViewId), 'all');
    assert.equal(await initialInput.inputValue(), '');
    await initialInput.fill('LOCAL-MISSING-NOMATCH');
    await resetConditions.waitFor({ state: 'visible' });
    assert.equal(await initialRows.count(), 0);
    await resetConditions.click();
    assert.equal(await initialInput.inputValue(), '', 'All-condition reset must clear the DOM even when the page render cache matches.');
    assert.equal(await initialClear.isHidden(), true);
    assert.deepEqual(await initialRows.evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId)), ['1', '2']);
    await page.waitForFunction(() => document.activeElement?.dataset.role === 'animal-search');
    await initialInput.fill('LOCAL-MISSING-NOMATCH');
    await resetConditions.waitFor({ state: 'visible' });
    assert.equal(await initialRows.count(), 0, 'The same nonmatching query must run after reset.');
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.snapshot().animalSearch), 'LOCAL-MISSING-NOMATCH');
    await initialClear.click();
    assert.equal(await initialInput.inputValue(), '');
    assert.equal(await initialRows.count(), 2);
    results.push({ check: 'full-production-app-clear-all-conditions-survives-render-cache-and-repeat-query', status: 'PASS' });

    await page.locator('[data-role="collection-view-filter"]').selectOption('qa-preserved');
    const input = page.locator('[data-role="animal-search"]');
    const clear = page.locator('[data-action="clear-collection-search"]');
    // Count user-facing rows; this also remains valid if a breakpoint uses
    // a different DOM representation.
    const rows = page.locator('[data-role="collection-results-body"] [data-collection-animal]:visible');
    await input.evaluate((node) => { window.__setaeStableCollectionSearch = node; });
    assert.equal(await clear.count(), 1, 'Clear action exists even before the first search');
    const emptyClear = await clear.evaluate((node) => ({ hidden: node.hidden,
      display: getComputedStyle(node).display,
      query: document.querySelector('[data-role="animal-search"]').value }));
    assert.equal(await clear.isHidden(), true, 'Empty search clear must be visually hidden: ' + JSON.stringify(emptyClear));
    const activeView = await page.evaluate(() => window.__setaeIntakeApp.snapshot().activeAnimalViewId);
    await input.fill('LOCAL-002');
    assert.equal(await clear.isVisible(), true);
    assert.equal(await rows.count(), 1);
    assert.deepEqual(await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId)), ['2']);
    await clear.click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await clear.isHidden(), true);
    assert.equal(await rows.count(), 2);
    assert.deepEqual(await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId)), ['1', '2']);
    assert.equal(await input.evaluate((node) => node === window.__setaeStableCollectionSearch && document.activeElement === node), true);
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.snapshot().activeAnimalViewId), activeView);
    await input.fill('LOCAL-002');
    assert.equal(await rows.count(), 1, 'The same query must work after clearing');
    assert.deepEqual(await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.animalId)), ['2']);
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.snapshot().animalSearch), 'LOCAL-002');
    assert.equal(await input.evaluate((node) => node === window.__setaeStableCollectionSearch), true);
    assert.deepEqual(searchFixture.issues, []);
    results.push({ check: 'full-production-app-search-clear-preserves-view-focus-and-repeat-query', status: 'PASS' });
  } finally {
    await searchFixture.context.close();
  }

  for (const origin of ['today', 'records']) {
    const opened = await openFixture('specimen-intake-app.html', { browser, query: { open: 'false' } });
    const page = opened.page;
    try {
      await page.evaluate(async (from) => {
        await window.__setaeIntakeApp.navigate('animals', { collectionTab: 'babies' });
        await window.__setaeIntakeApp.navigate(from);
        await window.__setaeIntakeApp.openAnimal(999);
      }, origin);
      const recovery = page.getByRole('button', { name: 'コレクションに戻る', exact: true });
      await recovery.waitFor({ state: 'visible' });
      assert.equal(await recovery.getAttribute('data-action'), 'recover-collection');
      const before = await page.evaluate(() => ({ state: window.__setaeIntakeApp.snapshot(), historyLength: history.length }));
      assert.equal(before.state.page, 'animal-detail');
      assert.equal(before.state.collectionTab, 'babies', 'Exercise a previous collection tab that the recovery must reset.');
      assert.equal(before.state.selectedAnimal, null);
      assert.ok(typeof before.state.error === 'string' && before.state.error.trim(), 'The failed detail request must populate the global error state.');
      const globalError = page.locator('.app-frame-error .error-banner[role="alert"]');
      assert.equal(await globalError.isVisible(), true, 'Verify the global error banner before recovery.');
      assert.ok((await globalError.textContent()).includes(before.state.error));
      await recovery.click();
      await page.waitForFunction(() => window.__setaeIntakeApp.snapshot().page === 'animals'
        && window.__setaeIntakeApp.snapshot().collectionTab === 'animals');
      await page.locator('[data-role="collection-results-body"]').waitFor({ state: 'visible' });
      const after = await page.evaluate(() => ({ state: window.__setaeIntakeApp.snapshot(), historyLength: history.length }));
      assert.equal(after.state.historyState.page, 'animals');
      assert.equal(after.state.historyState.subTab, 'animals');
      assert.equal(after.state.historyState.index, before.state.historyState.index, 'Recovery replaces the failed route.');
      assert.equal(after.historyLength, before.historyLength, 'Recovery must not push a duplicate history entry.');
      assert.equal(after.state.error, null, 'The failed detail error must not follow the user into the collection.');
      assert.equal(await page.locator('.app-frame-error').count(), 0, 'The global error banner is removed by recovery.');
      assert.deepEqual(await page.evaluate(() => window.__setaeIntakeFixture.unexpected()), []);
      assert.deepEqual(opened.issues, []);
      results.push({ check: 'full-production-app-missing-detail-recovers-collection-from-' + origin,
        status: 'PASS', priorCollectionTab: 'babies', recoveredCollectionTab: after.state.collectionTab,
        historyMode: 'replace', errorCleared: after.state.error === null, globalErrorBannerCount: 0, remoteRequests: 0 });
    } finally {
      await opened.context.close();
    }
  }
}

async function runOptionalIntakeRegression(browser, results) {
  const initialStates = [];
  for (const entry of [
    { query: {}, expected: { condition: false, husbandry: false, records: false } },
    { query: { edit: '1' }, expected: { condition: true, husbandry: true, records: true, administration: false } },
    { query: { edit: '1', variant: 'zero-photo' }, expected: { condition: true, husbandry: true, records: true, administration: false } }
  ]) {
    initialStates.push(await withFullApp(browser, { query: entry.query }, async (page) => {
      const state = await disclosureState(page);
      assert.deepEqual(state, entry.expected);
      assert.equal(await page.locator('section[aria-labelledby="intake-identity-title"]').isVisible(), true);
      assert.equal(await page.locator('[data-specimen-intake-root] input:disabled').count(), 0);
      if (entry.query.variant) {
        assert.equal(await page.locator('[name="instar"]').inputValue(), '0');
        assert.equal(await page.locator('[name="temperature"]').inputValue(), '0');
        assert.equal(await page.locator('[name="humidity"]').inputValue(), '0');
        await page.getByText(/未選択なら現在の写真を保持します/).waitFor({ state: 'visible' });
      }
      return { query: entry.query, state };
    }));
  }
  results.push({ check: 'optional-groups-default-existing-zero-and-photo', status: 'PASS', initialStates });

  const retained = await withFullApp(browser, {}, async (page) => {
    const before = await backgroundState(page);
    const conditionSummary = optionalSection(page, 'condition').locator(':scope > summary');
    await conditionSummary.focus();
    await conditionSummary.press('Enter');
    assert.equal(await optionalSection(page, 'condition').evaluate((node) => node.open), true);
    await conditionSummary.press('Space');
    assert.equal(await optionalSection(page, 'condition').evaluate((node) => node.open), false);
    assert.equal(await conditionSummary.evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.draftState().dirty), false, 'Disclosure changes are not unsaved field edits.');
    assert.deepEqual(await backgroundState(page), before);
    await page.locator('[name="name"]').fill('LOCAL-RETAINED');
    await selectSpecies(page);
    await openOptionalInputs(page);
    await page.locator('[name="instar"]').fill('0');
    await page.locator('[name="temperature"]').fill('0');
    await page.locator('[name="acquired_date"]').fill('2026-08-28');
    await page.locator('[name="notes"]').fill('開閉しても残るメモ。');
    await page.locator('[name="image"]').setInputFiles(fixturePhoto);
    await page.locator('[name="notes"]').evaluate((node) => node.setSelectionRange(2, 5));
    await page.evaluate(() => {
      const form = document.querySelector('[data-specimen-intake-root]');
      window.__setaeDisclosureRetention = { form, nodes: [...form.elements], file: form.elements.image.files[0],
        values: Object.fromEntries([...new FormData(form)].filter(([, value]) => !(value instanceof File))) };
    });
    for (const name of ['condition', 'husbandry', 'records']) await setOptionalOpen(page, name, false);
    assert.equal(await page.locator('[name="notes"]').isVisible(), false);
    const snapshot = await page.evaluate(() => {
      const before = window.__setaeDisclosureRetention;
      const form = document.querySelector('[data-specimen-intake-root]');
      const values = Object.fromEntries([...new FormData(form)].filter(([, value]) => !(value instanceof File)));
      return { formSame: form === before.form, controlsSame: [...form.elements].every((node, index) => node === before.nodes[index]),
        fileSame: form.elements.image.files[0] === before.file, fileName: form.elements.image.files[0].name,
        valuesSame: JSON.stringify(values) === JSON.stringify(before.values),
        noteSelection: [form.elements.notes.selectionStart, form.elements.notes.selectionEnd] };
    });
    assert.deepEqual(snapshot, { formSame: true, controlsSame: true, fileSame: true, fileName: fixturePhoto.name,
      valuesSame: true, noteSelection: [2, 5] });
    await openOptionalInputs(page);
    assert.equal(await page.locator('[name="notes"]').inputValue(), '開閉しても残るメモ。');
    assert.deepEqual(await backgroundState(page), before);
    assert.deepEqual(await specimenSaves(page), []);
    return snapshot;
  });
  results.push({ check: 'optional-groups-native-toggle-preserves-controls-file-and-background', status: 'PASS', retained });

  const closedSaves = [];
  for (const edit of [false, true]) {
    closedSaves.push(await withFullApp(browser, { query: edit ? { edit: '1' } : {} }, async (page) => {
      await page.locator('[name="name"]').fill(edit ? 'LOCAL-CLOSED-EDIT' : 'LOCAL-CLOSED-NEW');
      if (!edit) await selectSpecies(page);
      await openOptionalInputs(page);
      await page.locator('[name="instar"]').fill('0');
      await page.locator('[name="temperature"]').fill('0');
      await page.locator('[name="humidity"]').fill('0');
      await page.locator('[name="acquired_date"]').fill('2026-08-28');
      await page.locator('[name="notes"]').fill(edit ? '' : '閉じたまま送るメモ');
      if (!edit) await page.locator('[name="image"]').setInputFiles(fixturePhoto);
      const expected = await page.evaluate(() => {
        const form = document.querySelector('[data-specimen-intake-root]');
        const entries = [...new FormData(form)].filter(([name, value]) => name !== 'species_query'
          && (!(value instanceof File) || value.size > 0));
        return { ...Object.fromEntries(entries.map(([name, value]) => [name, value instanceof File
          ? { name: value.name, size: value.size, type: value.type } : value])), archived: form.elements.archived?.checked ? '1' : '0' };
      });
      // These controls are unchanged in this scenario. Privacy settings use a
      // sparse patch so a normal edit cannot replay an older public value.
      delete expected.qr_visibility;
      delete expected.transfer_enabled;
      for (const name of ['condition', 'husbandry', 'records']) await setOptionalOpen(page, name, false);
      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('pending'));
      await submitButton(page).click();
      await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
      const saved = (await specimenSaves(page)).at(-1);
      assert.equal(saved.path, edit ? '/spiders/1' : '/spiders');
      assert.deepEqual(saved.payload, expected, 'Closing disclosures cannot omit successful form controls from the payload.');
      assertNoPublicPatch(saved.payload);
      assert.equal(saved.payload.instar, '0');
      assert.equal(saved.payload.temperature, '0');
      assert.equal(saved.payload.humidity, '0');
      if (edit) assert.equal(saved.payload.notes, '', 'An explicitly cleared edit value must reach the existing update contract.');
      await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('api-error'));
      await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '保存できませんでした' }).waitFor();
      assert.equal(await submitButton(page).isEnabled(), true);
      assert.deepEqual(await disclosureState(page), edit
        ? { condition: false, husbandry: false, records: false, administration: false }
        : { condition: false, husbandry: false, records: false });
      return { edit, path: saved.path, optionalValues: { instar: saved.payload.instar, temperature: saved.payload.temperature,
        humidity: saved.payload.humidity, notes: saved.payload.notes, image: saved.payload.image || null } };
    }));
  }
  results.push({ check: 'optional-groups-closed-save-keeps-zero-photo-and-edit-clears', status: 'PASS', closedSaves });

  await withFullApp(browser, {}, async (page) => {
    await page.locator('[name="name"]').fill('LOCAL-INVALID');
    await selectSpecies(page);
    await setOptionalOpen(page, 'condition');
    await page.locator('[name="instar"]').fill('31');
    await setOptionalOpen(page, 'condition', false);
    await submitButton(page).click();
    assert.equal(await optionalSection(page, 'condition').evaluate((node) => node.open), true);
    assert.equal(await page.locator('[name="instar"]').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('[name="instar"]').evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator('[data-form-error-summary]').count(), 1);
    assert.deepEqual(await specimenSaves(page), []);
    assert.equal(await submitButton(page).isEnabled(), true);
    await page.locator('[name="instar"]').fill('8');
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('pending'));
    await submitButton(page).click();
    await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
    assert.equal((await specimenSaves(page)).length, 1);
    await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('api-error'));
    await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '保存できませんでした' }).waitFor();
  });
  const nativeValidation = await openFixture(fixture, { browser });
  try {
    const page = nativeValidation.page;
    await page.locator('[name="name"]').fill('LOCAL-NATIVE-INVALID');
    await selectSpecies(page);
    await setOptionalOpen(page, 'condition');
    await page.locator('[name="instar"]').fill('31');
    await setOptionalOpen(page, 'condition', false);
    assert.equal(await page.locator('form').evaluate((node) => node.noValidate), false, 'This fixture intentionally exercises native invalid events.');
    await submitButton(page).click();
    assert.equal(await optionalSection(page, 'condition').evaluate((node) => node.open), true);
    assert.equal(await page.locator('[name="instar"]').evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.evaluate(() => window.__setaeSpecimenIntake246.submitCount()), 0);
    assert.deepEqual(nativeValidation.issues, []);
  } finally { await nativeValidation.context.close(); }
  results.push({ check: 'optional-groups-invalid-capture-native-and-app-validation', status: 'PASS' });

  const serverErrors = await withFullApp(browser, { query: { edit: '1' } }, async (page) => {
    await setOptionalOpen(page, 'records');
    await page.locator('[name="image"]').setInputFiles(fixturePhoto);
    await page.locator('[name="image"]').evaluate((node) => { window.__setaeServerErrorFile = node; });
    await page.evaluate(() => {
      window.__setaeIntakeFixture.setFieldErrors({ instar: '齢期を確認してください。', notes: 'メモの内容を確認してください。' });
      window.__setaeIntakeFixture.setSaveMode('field-error');
    });
    await setOptionalOpen(page, 'condition', false);
    await setOptionalOpen(page, 'records', false);
    await submitButton(page).click();
    await page.locator('[name="instar"][aria-invalid="true"]').waitFor({ state: 'visible' });
    assert.equal(await optionalSection(page, 'condition').evaluate((node) => node.open), true);
    assert.equal(await page.locator('[name="instar"]').evaluate((node) => document.activeElement === node), true,
      'The intake error region must not steal focus from the first server-invalid field.');
    const noteId = await page.locator('[name="notes"]').getAttribute('id');
    await page.locator('[data-form-error-summary] [data-validation-target="' + noteId + '"]').click();
    assert.equal(await optionalSection(page, 'records').evaluate((node) => node.open), true);
    assert.equal(await page.locator('[name="notes"]').evaluate((node) => document.activeElement === node), true);
    assert.match(await page.locator('[name="notes"]').getAttribute('aria-describedby'), /-server-error/);
    assert.equal(await page.locator('[name="image"]').evaluate((node) => node === window.__setaeServerErrorFile && node.files[0].name), fixturePhoto.name);
    await page.locator('[name="instar"]').fill('9');
    await page.locator('[name="notes"]').fill('訂正したメモ');
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('pending'));
    await submitButton(page).click();
    await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
    const saves = await specimenSaves(page);
    assert.equal(saves.length, 2);
    assert.equal(saves[1].payload.notes, '訂正したメモ');
    assert.equal(saves[1].payload.image.name, fixturePhoto.name);
    await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('api-error'));
    await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '保存できませんでした' }).waitFor();
    const hiddenFieldErrors = [];
    for (const name of ['species_id', 'custom_species']) {
      await page.evaluate((field) => {
        window.__setaeIntakeFixture.setFieldErrors({ [field]: '登録した種を確認してください。' });
        window.__setaeIntakeFixture.setSaveMode('field-error');
      }, name);
      await submitButton(page).click();
      await page.waitForFunction(() => document.activeElement?.dataset.action === 'change-specimen-species'
        && document.activeElement?.getAttribute('aria-invalid') === 'true');
      assert.equal(await page.locator('[name="' + name + '"]').getAttribute('type'), 'hidden');
      assert.equal(await page.locator('[name="' + name + '"]').getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('[data-action="change-specimen-species"]').getAttribute('aria-describedby'), /specimen-intake-error/);
      assert.equal(await page.locator('[name="image"]').evaluate((node) => node === window.__setaeServerErrorFile && node.files[0].name), fixturePhoto.name);
      hiddenFieldErrors.push({ name, focusedAction: 'change-specimen-species', filePreserved: true });
    }
    return { saves: (await specimenSaves(page)).length, visibleFieldSaves: saves.length, filePreserved: true,
      summaryLinkRevealedRecords: true, hiddenFieldErrors };
  });
  results.push({ check: 'optional-groups-server-error-reveals-fields-and-preserves-photo', status: 'PASS', serverErrors });

  const restorations = [];
  for (const kind of ['catalog', 'manual', 'species-only']) {
    restorations.push(await withFullApp(browser, { query: { draft: kind } }, async (page) => {
      const before = await backgroundState(page);
      const restore = page.locator('[data-action="restore-form-draft"]');
      await restore.waitFor({ state: 'visible' });
      assert.equal(await page.locator('[name="name"]').inputValue(), '', 'A stored draft is not applied without an explicit restore.');
      await page.evaluate(() => {
        const form = document.querySelector('[data-specimen-intake-root]');
        window.__setaeDraftIntegration = { form, name: form.elements.name, image: form.elements.image, events: [], preBubbled: 0, postBubbled: 0 };
        form.addEventListener('setae:form-draft-restoring', (event) => {
          window.__setaeDraftIntegration.events.push({ type: event.type, bubbles: event.bubbles, values: event.detail.values });
        });
        form.addEventListener('setae:form-draft-restored', (event) => {
          window.__setaeDraftIntegration.events.push({ type: event.type, bubbles: event.bubbles, hadFiles: event.detail.hadFiles });
        });
        document.body.addEventListener('setae:form-draft-restoring', () => { window.__setaeDraftIntegration.preBubbled += 1; });
        document.body.addEventListener('setae:form-draft-restored', () => { window.__setaeDraftIntegration.postBubbled += 1; });
      });
      await restore.click();
      const observed = await page.evaluate(() => {
        const before = window.__setaeDraftIntegration;
        const form = document.querySelector('[data-specimen-intake-root]');
        return { sameForm: form === before.form, sameName: form.elements.name === before.name, sameFileInput: form.elements.image === before.image,
          focusInForm: form.contains(document.activeElement), activeName: document.activeElement?.name || '',
          values: Object.fromEntries([...new FormData(form)].filter(([, value]) => !(value instanceof File))),
          events: before.events, preBubbled: before.preBubbled, postBubbled: before.postBubbled, files: form.elements.image.files.length };
      });
      assert.equal(observed.sameForm && observed.sameName && observed.sameFileInput, true);
      assert.equal(observed.focusInForm, true, 'Removing the restore notice must return focus to a live form control.');
      assert.deepEqual(observed.events.map((event) => event.type), ['setae:form-draft-restoring', 'setae:form-draft-restored']);
      assert.equal(observed.events[0].bubbles, false);
      assert.equal(observed.events[1].bubbles, true);
      assert.equal(observed.preBubbled, 0);
      assert.equal(observed.postBubbled, 1);
      assert.equal(observed.files, 0, 'Restoration must not invent a file from a stored filename or flag.');
      if (kind === 'manual') {
        assert.equal(observed.values.classification, 'true_spider');
        assert.equal(observed.values.custom_species, '未同定クモ ローカル試験');
        assert.equal(observed.values.species_id, '');
        assert.equal(observed.values.name, 'LOCAL-MANUAL-DRAFT');
      } else {
        assert.equal(observed.values.classification, 'tarantula');
        assert.equal(observed.values.species_id, '501');
        assert.equal(observed.values.custom_species, '');
        await page.getByText('図鑑の種 #501', { exact: true }).waitFor({ state: 'visible' });
        assert.equal(observed.values.name, kind === 'catalog' ? 'LOCAL-CATALOG-DRAFT' : '');
      }
      assert.deepEqual(await disclosureState(page), kind === 'species-only'
        ? { condition: false, husbandry: false, records: false } : { condition: true, husbandry: true, records: true });
      if (kind !== 'species-only') {
        assert.equal(observed.values.instar, '0');
        assert.equal(observed.values.temperature, '0');
      }
      if (kind === 'catalog') {
        assert.equal(observed.events[1].hadFiles, true);
        await page.getByText('写真は復元できません。もう一度選択してください。', { exact: true }).waitFor({ state: 'visible' });
        assert.equal(await page.locator('form').getAttribute('data-draft-had-file'), 'true');
        await page.locator('[name="image"]').setInputFiles(fixturePhoto);
        assert.equal(await page.locator('form').getAttribute('data-draft-had-file'), 'false');
        assert.ok((await page.locator('[data-specimen-intake-region="file-status"]').textContent()).includes(fixturePhoto.name));
      }
      await page.evaluate(() => {
        window.__setaeRestoredSpeciesNode = document.querySelector('[data-specimen-intake-region="species"]').firstElementChild;
        window.__setaeIntakeApp.syncDrafts();
      });
      await page.locator('[name="classification"]').selectOption(observed.values.classification);
      assert.equal(await page.evaluate(() => document.querySelector('[data-specimen-intake-region="species"]').firstElementChild === window.__setaeRestoredSpeciesNode), true,
        'Restoring or reselecting the current classification must not replace the prepared species controls.');
      assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
      assert.deepEqual(await backgroundState(page), before);
      assert.deepEqual(await specimenSaves(page), []);
      assert.equal(await page.evaluate(() => window.__setaeIntakeFixture.calls().filter((call) => call.path === '/species/suggest').length), 0,
        'Restoring a known ID uses that ID, without invented labels or an additional API.');
      return { kind, values: observed.values, groups: await disclosureState(page), filesRestored: observed.files,
        focusInForm: observed.focusInForm, activeName: observed.activeName };
    }));
  }
  results.push({ check: 'optional-groups-draft-restore-catalog-manual-species-only-and-photo-warning', status: 'PASS', restorations });

  const layouts = [];
  for (const variant of [{ width: 320, theme: 'light', textScale: 1 }, { width: 390, theme: 'dark', textScale: 1 },
    { width: 320, theme: 'light', textScale: 2 }]) {
    layouts.push(await withFullApp(browser, { query: { draft: 'catalog', theme: variant.theme }, colorScheme: variant.theme,
      viewport: { width: variant.width, height: 844 } }, async (page) => {
      await openOptionalInputs(page);
      await submitButton(page).click();
      await page.locator('[data-form-error-summary]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-form-draft-notice]').count(), 1);
      if (variant.textScale === 2) await page.evaluate(() => {
        const nodes = [...document.querySelector('[data-specimen-intake-root]').querySelectorAll('*')]
          .filter((node) => node instanceof HTMLElement)
          .map((node) => [node, parseFloat(getComputedStyle(node).fontSize)]);
        nodes.forEach(([node, size]) => { node.style.fontSize = (size * 2) + 'px'; });
      });
      await page.locator('.specimen-intake-body').evaluate((node) => { node.scrollTop = 0; });
      const geometry = await page.evaluate(() => {
        const form = document.querySelector('[data-specimen-intake-root]');
        const body = form.querySelector('.specimen-intake-body');
        const panel = form.closest('.modal');
        const bounds = panel.getBoundingClientRect();
        const controls = [...form.querySelectorAll('.specimen-intake-footer button, details > summary, .form-draft-notice button')]
          .map((node) => { const rect = node.getBoundingClientRect(); return { label: node.textContent.trim() || node.getAttribute('aria-label'),
            width: rect.width, height: rect.height, footer: Boolean(node.closest('.specimen-intake-footer')),
            inViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1 }; });
        const summaries = [...form.querySelectorAll('details > summary')].map((node) => ({
          label: document.getElementById(node.getAttribute('aria-labelledby'))?.textContent.trim() || '',
          description: document.getElementById(node.getAttribute('aria-describedby'))?.textContent.trim() || ''
        }));
        return { viewportWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
          bodyHeight: body.clientHeight, bodyScrollable: body.scrollHeight > body.clientHeight,
          panelFits: bounds.left >= -1 && bounds.right <= document.documentElement.clientWidth + 1 && bounds.top >= -1 && bounds.bottom <= innerHeight + 1,
          controls, summaries };
      });
      assert.ok(geometry.scrollWidth <= geometry.viewportWidth + 1, 'Expanded form and notices must not create horizontal overflow.');
      assert.equal(geometry.panelFits, true);
      assert.ok(geometry.bodyHeight >= 44, 'The scroll body must retain at least one touch target of space.');
      assert.equal(geometry.bodyScrollable, true);
      assert.ok(geometry.controls.every((control) => control.width >= 44 && control.height >= 44), JSON.stringify(geometry.controls));
      assert.ok(geometry.controls.filter((control) => control.footer).every((control) => control.inViewport), 'Footer actions remain visible.');
      assert.ok(geometry.summaries.every((summary) => summary.label && summary.description));
      const file = screenshotPath('specimen-intake-expanded-' + variant.width + '-' + variant.theme + '-text' + variant.textScale + '.png');
      await page.screenshot({ path: file, fullPage: false });
      assert.deepEqual(await specimenSaves(page), []);
      return { ...variant, geometry, screenshot: path.relative(evidenceDir, file), note: variant.textScale === 2 ? 'Computed text sizes doubled; not a physical-device browser zoom claim.' : '' };
    }));
  }
  results.push({ check: 'optional-groups-expanded-layout-with-draft-validation-and-text200', status: 'PASS', layouts });
}

const publicRadio = (page, value) => page.locator('[data-specimen-intake-root] [name="qr_visibility"][value="' + value + '"]');
const transferCheckbox = (page) => page.locator('[data-specimen-intake-root] [name="transfer_enabled"]');
const cancelIntake = (page) => page.locator('.specimen-intake-footer [data-action="close-modal"]');

async function setPublicControl(control, checked = true) {
  // Primitives visually clip the native input. Click its visible label, as a
  // pointer user does, then verify the native state; never force a hidden click.
  if (await control.isChecked() !== checked) await control.locator('..').click();
  assert.equal(await control.isChecked(), checked);
}

function assertNoPublicPatch(payload) {
  assert.equal(Object.hasOwn(payload, 'qr_visibility'), false, 'An unchanged or unavailable range must be omitted.');
  assert.equal(Object.hasOwn(payload, 'transfer_enabled'), false, 'An unchanged or unavailable acceptance flag must be omitted.');
}

async function offlineItems(page) {
  return page.evaluate(async () => {
    // Read the same production singleton used by app.js; do not substitute its
    // queue or infer success from a toast. The fixture supplies memory storage.
    const { offlineQueue } = await import(new URL('../../assets/app/offline/queue.js', location.href).href);
    return offlineQueue.list();
  });
}

async function reopenSavedSpecimen(page) {
  await page.locator('[data-specimen-intake-root]').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => {
    const state = window.__setaeIntakeApp.snapshot();
    return !state.modal && state.page === 'animal-detail' && Number(state.selectedAnimal?.id) === 1 && !state.loadingEvents;
  });
  await page.locator('.specimen-more-menu > summary').click();
  await page.locator('[data-action="edit-animal"]').click();
  await page.locator('[data-specimen-intake-root]').waitFor({ state: 'visible' });
}

async function runPublicSettingsRegression(browser, results) {
  const saves = [];
  for (const photo of [false, true]) {
    saves.push(await withFullApp(browser, { query: { edit: '1' },
      viewport: photo ? { width: 390, height: 844 } : { width: 1440, height: 1000 } }, async (page) => {
      assert.equal(await optionalSection(page, 'administration').evaluate((node) => node.open), false, 'Default private administration remains folded.');
      await setOptionalOpen(page, 'administration');
      assert.equal(await publicRadio(page, 'private').isChecked(), true);
      assert.equal(await transferCheckbox(page).isChecked(), false);
      const before = await backgroundState(page);
      await setPublicControl(publicRadio(page, 'life_history'));
      await setPublicControl(transferCheckbox(page));
      if (photo) {
        await setOptionalOpen(page, 'records');
        await page.locator('[name="image"]').setInputFiles(fixturePhoto);
      }
      assert.deepEqual(await backgroundState(page), before, 'Changing public controls never changes the background route.');
      assert.deepEqual(await specimenSaves(page), [], 'Changing controls alone does not send a save.');
      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
      await submitButton(page).click();
      await reopenSavedSpecimen(page);
      const requests = await specimenSaves(page);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].path, '/spiders/1');
      assert.equal(requests[0].bodyKind, photo ? 'multipart' : 'json');
      assert.equal(requests[0].payload.qr_visibility, 'life_history');
      assert.equal(String(requests[0].payload.transfer_enabled), '1');
      assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
      assert.equal(await transferCheckbox(page).isChecked(), true);
      assert.equal(await optionalSection(page, 'administration').evaluate((node) => node.open), true);
      return { photo, bodyKind: requests[0].bodyKind, path: requests[0].path, publicPayload: {
        qr_visibility: requests[0].payload.qr_visibility, transfer_enabled: requests[0].payload.transfer_enabled } };
    }));
  }
  results.push({ check: 'public-settings-json-multipart-save-and-reopen', status: 'PASS', saves });

  const patches = await withFullApp(browser, { query: { edit: '1', public: 'life_history', transfer: '1' } }, async (page) => {
    assert.equal(await optionalSection(page, 'administration').evaluate((node) => node.open), true);
    assert.match(await optionalSection(page, 'administration').locator(':scope > summary').innerText(), /保存済み/);
    await page.locator('[name="name"]').fill('LOCAL-PUBLIC-UNCHANGED');
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
    await submitButton(page).click();
    await reopenSavedSpecimen(page);
    assertNoPublicPatch((await specimenSaves(page))[0].payload);
    assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
    assert.equal(await transferCheckbox(page).isChecked(), true);
    await setPublicControl(transferCheckbox(page), false);
    await submitButton(page).click();
    await reopenSavedSpecimen(page);
    const requests = await specimenSaves(page);
    assert.equal(requests.length, 2);
    assert.equal(Object.hasOwn(requests[1].payload, 'qr_visibility'), false);
    assert.equal(String(requests[1].payload.transfer_enabled), '0');
    assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
    assert.equal(await transferCheckbox(page).isChecked(), false);
    assert.equal(await page.evaluate(() => window.__setaeIntakeFixture.calls().filter((call) => call.method === 'POST' && /^\/qr\//.test(call.path)).length), 0,
      'Intake must use only the specimen save, without a second QR update request.');
    return requests.map(({ path: requestPath, bodyKind, payload }) => ({ path: requestPath, bodyKind,
      publicKeys: Object.keys(payload).filter((key) => ['qr_visibility', 'transfer_enabled'].includes(key)) }));
  });
  results.push({ check: 'public-settings-unchanged-omission-and-explicit-off-only-patch', status: 'PASS', patches });
}

async function runPublicOfflineRegression(browser, results) {
  const cases = [];
  for (const changed of [true, false]) {
    cases.push(await withFullApp(browser, { query: { edit: '1' } }, async (page) => {
      await page.locator('[name="name"]').fill('LOCAL-OFFLINE');
      if (changed) {
        await setOptionalOpen(page, 'administration');
        await setPublicControl(publicRadio(page, 'basic'));
      }
      assert.deepEqual(await offlineItems(page), []);
      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('network-error'));
      await submitButton(page).click();
      if (changed) {
        await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '入力は保持しています' }).waitFor();
        assert.equal(await publicRadio(page, 'basic').isChecked(), true);
        assert.equal(await page.locator('[name="name"]').inputValue(), 'LOCAL-OFFLINE');
        assert.deepEqual(await offlineItems(page), []);
      } else {
        await page.locator('[data-specimen-intake-root]').waitFor({ state: 'hidden' });
        const queued = await offlineItems(page);
        assert.equal(queued.length, 1);
        assert.equal(queued[0].action, 'update_spider');
        assert.equal(queued[0].entity_id, 1);
        assertNoPublicPatch(queued[0].payload);
      }
      return { changed };
    }));
  }
  results.push({ check: 'public-settings-network-failure-never-queues-ordinary-edit-still-queues', status: 'PASS', cases });
}

async function runPublicFailureRegression(browser, results) {
  const result = await withFullApp(browser, { query: { edit: '1' } }, async (page) => {
    await setOptionalOpen(page, 'administration');
    await setPublicControl(publicRadio(page, 'basic'));
    await setPublicControl(transferCheckbox(page));
    await setOptionalOpen(page, 'records');
    await page.locator('[name="image"]').setInputFiles(fixturePhoto);
    const before = await backgroundState(page);
    await page.evaluate(() => {
      const form = document.querySelector('[data-specimen-intake-root]');
      window.__publicFailureNodes = { form, image: form.elements.image, file: form.elements.image.files[0] };
      window.__setaeIntakeFixture.setSaveMode('pending');
    });
    await submitButton(page).click();
    await page.waitForFunction(() => window.__setaeIntakeFixture.pendingSaves() === 1);
    assert.equal(await submitButton(page).isDisabled(), true);
    await page.evaluate(() => window.__setaeIntakeFixture.releaseSave('api-error'));
    await page.locator('[data-specimen-intake-region="error"]').filter({ hasText: '保存できませんでした' }).waitFor();
    assert.deepEqual(await backgroundState(page), before);
    assert.equal(await publicRadio(page, 'basic').isChecked(), true);
    assert.equal(await transferCheckbox(page).isChecked(), true);
    assert.equal(await page.evaluate(() => {
      const form = document.querySelector('[data-specimen-intake-root]');
      const saved = window.__publicFailureNodes;
      return form === saved.form && form.elements.image === saved.image && form.elements.image.files[0] === saved.file;
    }), true, 'Rejected public settings keep the exact File and form nodes.');
    assert.equal(await page.evaluate(() => window.__setaeIntakeApp.draftState().dirty), true);
    await cancelIntake(page).click();
    await page.locator('[data-action="continue-form-editing"]').click();
    assert.equal(await publicRadio(page, 'basic').isChecked(), true);
    assert.equal(await page.locator('[name="image"]').evaluate((node) => node.files[0] === window.__publicFailureNodes.file), true);
    await cancelIntake(page).click();
    await page.locator('[data-action="confirm-discard-form"]').click();
    await page.locator('[data-specimen-intake-root]').waitFor({ state: 'hidden' });
    const requests = await specimenSaves(page);
    assert.equal(requests.length, 1, 'Cancel never sends another save.');
    assert.equal(requests[0].bodyKind, 'multipart');
    const saved = await page.evaluate(() => window.__setaeIntakeFixture.animals().find((animal) => animal.id === 1));
    assert.equal(saved.qr_visibility, 'private');
    assert.equal(saved.transfer_enabled, false);
    return { filePreserved: true };
  });
  results.push({ check: 'public-settings-rejected-save-file-and-cancel-preserve-draft', status: 'PASS', result });
}

async function runPublicBoundaryRegression(browser, results) {
  const cases = [];
  for (const kind of ['new', 'receipt', 'unknown']) {
    const query = kind === 'new' ? {} : { edit: '1', public: 'life_history', transfer: '1', [kind]: '1' };
    cases.push(await withFullApp(browser, { query }, async (page) => {
      if (kind === 'new') {
        assert.equal(await optionalSection(page, 'administration').count(), 0);
        await page.locator('[name="name"]').fill('LOCAL-NEW-PRIVATE');
        await selectSpecies(page);
      } else {
        await setOptionalOpen(page, 'administration');
        await page.locator('[name="name"]').fill('LOCAL-' + kind.toUpperCase());
      }
      if (kind === 'receipt') {
        assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
        assert.deepEqual(await page.locator('[name="qr_visibility"]').evaluateAll((nodes) => nodes.map((node) => node.disabled)), [true, true, true]);
        assert.equal(await transferCheckbox(page).isDisabled(), true);
        assert.equal(await page.locator('[name="archived"]').isDisabled(), true);
      } else {
        assert.equal(await page.locator('[name="qr_visibility"]').count(), 0);
        assert.equal(await transferCheckbox(page).count(), 0);
      }
      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
      await submitButton(page).click();
      await page.waitForFunction(() => !window.__setaeIntakeApp.snapshot().modal);
      const request = (await specimenSaves(page))[0];
      assert.equal(request.path, kind === 'new' ? '/spiders' : '/spiders/1');
      assertNoPublicPatch(request.payload);
      return { kind };
    }));
  }
  results.push({ check: 'public-settings-new-receipt-unknown-never-write-unavailable-fields', status: 'PASS', cases });
}

async function runPublicDraftRegression(browser, results) {
  const cases = [];
  for (const draft of ['legacy-public', 'public-off']) {
    cases.push(await withFullApp(browser, { query: { edit: '1', public: 'life_history', transfer: '1', draft },
      viewport: { width: 390, height: 844 } }, async (page) => {
      const explicitOff = draft === 'public-off';
      const expectedMode = explicitOff ? 'private' : 'life_history';
      const expectedName = explicitOff ? 'LOCAL-PUBLIC-OFF-DRAFT' : 'LOCAL-OLD-PUBLIC-DRAFT';
      assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
      assert.equal(await transferCheckbox(page).isChecked(), true);
      await page.locator('[data-action="restore-form-draft"]').click();
      assert.equal(await page.locator('[name="name"]').inputValue(), expectedName);
      assert.equal(await publicRadio(page, expectedMode).isChecked(), true);
      assert.equal(await transferCheckbox(page).isChecked(), !explicitOff);
      assert.equal(await page.locator('[data-form-draft-notice]').count(), 0);
      assert.deepEqual(await specimenSaves(page), [], 'Restoring a draft never publishes settings by itself.');
      await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
      await submitButton(page).click();
      await reopenSavedSpecimen(page);
      const requests = await specimenSaves(page);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].path, '/spiders/1');
      assert.equal(requests[0].payload.name, expectedName);
      if (explicitOff) {
        assert.equal(requests[0].payload.qr_visibility, 'private');
        assert.equal(String(requests[0].payload.transfer_enabled), '0');
      } else {
        assertNoPublicPatch(requests[0].payload);
      }
      assert.equal(await publicRadio(page, expectedMode).isChecked(), true);
      assert.equal(await transferCheckbox(page).isChecked(), !explicitOff);
      return { draft, expectedMode, transferEnabled: !explicitOff,
        publicKeys: Object.keys(requests[0].payload).filter((key) => ['qr_visibility', 'transfer_enabled'].includes(key)) };
    }));
  }
  results.push({ check: 'public-settings-legacy-draft-keeps-current-and-explicit-off-restores', status: 'PASS', cases });
}

async function runPublicArchiveRegression(browser, results) {
  const result = await withFullApp(browser, { query: { edit: '1', public: 'life_history', transfer: '1' },
    viewport: { width: 320, height: 844 } }, async (page) => {
    const archive = page.locator('[data-specimen-intake-root] [name="archived"]');
    const before = await backgroundState(page);
    assert.equal(await archive.isChecked(), false);
    assert.equal(await transferCheckbox(page).isChecked(), true);
    await setPublicControl(archive);
    assert.equal(await transferCheckbox(page).isChecked(), false);
    assert.equal(await transferCheckbox(page).isDisabled(), true);
    await setPublicControl(archive, false);
    assert.equal(await transferCheckbox(page).isChecked(), true, 'Undoing an unsaved archive restores the previous acceptance choice.');
    assert.equal(await transferCheckbox(page).isDisabled(), false);
    assert.deepEqual(await backgroundState(page), before);
    assert.deepEqual(await specimenSaves(page), []);
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
    await submitButton(page).click();
    await reopenSavedSpecimen(page);
    let requests = await specimenSaves(page);
    assert.equal(requests.length, 1);
    assert.equal(String(requests[0].payload.archived), '0');
    assertNoPublicPatch(requests[0].payload);
    assert.equal(await transferCheckbox(page).isChecked(), true);
    await setPublicControl(archive);
    await submitButton(page).click();
    await reopenSavedSpecimen(page);
    requests = await specimenSaves(page);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].path, '/spiders/1');
    assert.equal(String(requests[1].payload.archived), '1');
    assert.equal(String(requests[1].payload.transfer_enabled), '0');
    assert.equal(Object.hasOwn(requests[1].payload, 'qr_visibility'), false, 'Archiving never changes the public range.');
    assert.equal(await archive.isChecked(), true);
    assert.equal(await transferCheckbox(page).isChecked(), false);
    assert.equal(await transferCheckbox(page).isDisabled(), true);
    assert.equal(await publicRadio(page, 'life_history').isChecked(), true);
    const saved = await page.evaluate(() => window.__setaeIntakeFixture.animals().find((animal) => animal.id === 1));
    assert.equal(saved.archived, true);
    assert.equal(saved.transfer_enabled, false);
    assert.equal(saved.qr_visibility, 'life_history');
    return { undoRestoredAcceptance: true, archived: saved.archived, transferEnabled: saved.transfer_enabled,
      publicMode: saved.qr_visibility, saves: requests.length };
  });
  results.push({ check: 'public-settings-archive-undo-restores-and-save-stops-acceptance', status: 'PASS', result });
}

async function runPublicQrRegression(browser, results) {
  const result = await withFullApp(browser, { query: { open: 'false', public: 'life_history', transfer: '1' } }, async (page) => {
    await page.evaluate(() => window.__setaeIntakeApp.openQrForAnimal(1));
    await page.locator('[data-action="animal-qr-settings"]').click();
    const form = page.locator('[data-role="qr-settings-form"]');
    await form.waitFor({ state: 'visible' });
    assert.equal(await form.locator('[name="visibility"][value="life_history"]').isChecked(), true);
    assert.equal(await form.locator('[name="transfer_enabled"]').isChecked(), true);
    await setPublicControl(form.locator('[name="visibility"][value="private"]'));
    await setPublicControl(form.locator('[name="transfer_enabled"]'), false);
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('api-error'));
    await form.locator('[type="submit"]').click();
    await page.locator('[data-overlay-error]').filter({ hasText: '保存できませんでした。ローカル試験の応答です。' }).waitFor();
    assert.equal(await form.locator('[name="visibility"][value="private"]').isChecked(), true);
    assert.equal(await form.locator('[name="transfer_enabled"]').isChecked(), false);
    await setPublicControl(form.locator('[name="visibility"][value="basic"]'));
    await setPublicControl(form.locator('[name="transfer_enabled"]'));
    assert.equal(await form.locator('[name="transfer_enabled"]').getAttribute('value'), '1');
    await page.evaluate(() => window.__setaeIntakeFixture.setSaveMode('success'));
    await form.locator('[type="submit"]').click();
    await form.waitFor({ state: 'hidden' });
    const requests = await page.evaluate(() => window.__setaeIntakeFixture.calls().filter((call) => call.method === 'POST' && call.path === '/qr/spiders/1/settings'));
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].payload, { visibility: 'private', public: false, transfer_enabled: false });
    assert.deepEqual(requests[1].payload, { visibility: 'basic', public: true, transfer_enabled: true });
    await page.evaluate(() => window.__setaeIntakeApp.openAnimal(1));
    await reopenSavedSpecimen(page);
    assert.equal(await publicRadio(page, 'basic').isChecked(), true);
    assert.equal(await transferCheckbox(page).isChecked(), true);
    assert.deepEqual(await specimenSaves(page), []);
    return { requests, sharedReadback: 'basic/accepted' };
  });
  results.push({ check: 'public-settings-qr-value-one-error-preservation-and-shared-readback', status: 'PASS', result });
}

(async () => {
  const browser = await launchBrowser();
  const results = [];
  try {
    await runFullApplicationRegression(browser, results);
    await runOptionalIntakeRegression(browser, results);
    await runPublicSettingsRegression(browser, results);
    await runPublicFailureRegression(browser, results);
    await runPublicOfflineRegression(browser, results);
    await runPublicBoundaryRegression(browser, results);
    await runPublicDraftRegression(browser, results);
    await runPublicArchiveRegression(browser, results);
    await runPublicQrRegression(browser, results);
    let opened = await openFixture(fixture, { browser, viewport: { width: 1024, height: 820 } });
    let page = opened.page;
    await installEvidenceObservers(page);
    await openOptionalInputs(page);

    await page.locator('[name="name"]').fill('C246');
    await page.locator('label:has([name="name"])').click({ position: { x: 20, y: 10 } });
    await page.locator('[name="gender"]').selectOption('female');
    await page.locator('[name="status"]').selectOption('pre_molt');
    await page.locator('[name="acquired_date"]').fill('2026-08-27');
    await page.locator('[name="enclosure_id"]').selectOption('4');
    await page.locator('[name="temperature"]').fill('26.0');
    await page.locator('[name="humidity"]').fill('72');
    await page.locator('[name="notes"]').fill('腹部と巣の状態を継続観察。');
    await page.locator('[name="notes"]').evaluate((node) => node.setSelectionRange(3, 7));
    await page.locator('[name="gender"]').click();
    await page.locator('.specimen-intake-header').click();
    await page.locator('.specimen-intake-body').evaluate((node) => { node.scrollTop = Math.min(180, node.scrollHeight - node.clientHeight); });

    const ordinaryIdentity = await identities(page);
    Object.entries(ordinaryIdentity).forEach(([name, same]) => assert.equal(same, true, 'ordinary interaction preserves ' + name));
    const ordinaryMutations = await page.evaluate(() => ({
      form: window.__setaeIntakeEvidence.formChildList,
      overlay: window.__setaeIntakeEvidence.overlayChildList,
      selectionStart: document.querySelector('[name="notes"]').selectionStart,
      selectionEnd: document.querySelector('[name="notes"]').selectionEnd
    }));
    assert.deepEqual({ form: ordinaryMutations.form, overlay: ordinaryMutations.overlay }, { form: 0, overlay: 0 });
    assert.deepEqual([ordinaryMutations.selectionStart, ordinaryMutations.selectionEnd], [3, 7]);
    results.push({ check: 'ordinary-fields-node-identity', status: 'PASS', identity: ordinaryIdentity, mutations: ordinaryMutations });

    const imeIdentity = await page.evaluate(() => {
      const form = window.__setaeSpecimenIntake246.form();
      const name = form.elements.name;
      name.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'セ' }));
      name.value = 'C246 セ';
      name.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'セ', inputType: 'insertCompositionText', isComposing: true }));
      name.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'セラ' }));
      return form === window.__setaeSpecimenIntake246.form() && name === window.__setaeSpecimenIntake246.form().elements.name;
    });
    assert.equal(imeIdentity, true);
    results.push({ check: 'ime-node-identity', status: 'PASS' });

    const fileInput = page.locator('[name="image"]');
    await fileInput.setInputFiles({ name: 'specimen-c246.png', mimeType: 'image/png', buffer: Buffer.from('setae-v246') });
    const fileNodeToken = await fileInput.evaluate((node) => { window.__setaeFileNode246 = node; return node.files[0].name; });
    assert.equal(fileNodeToken, 'specimen-c246.png');

    const beforeScroll = await page.locator('.specimen-intake-body').evaluate((node) => node.scrollTop);
    const speciesMutationsBefore = await page.evaluate(() => window.__setaeIntakeEvidence.speciesChildList);
    await page.locator('[name="classification"]').selectOption('true_spider');
    const classificationResult = await page.evaluate((expectedScroll) => {
      const nodes = window.__setaeSpecimenIntake246.nodes();
      return {
        formSame: nodes.form === window.__setaeIntakeEvidence.before.form,
        nameSame: nodes.name === window.__setaeIntakeEvidence.before.name,
        dateSame: nodes.date === window.__setaeIntakeEvidence.before.date,
        photoSame: nodes.photo === window.__setaeFileNode246,
        noteSame: nodes.note === window.__setaeIntakeEvidence.before.note,
        speciesRegionSame: nodes.species === window.__setaeIntakeEvidence.before.species,
        speciesMutations: window.__setaeIntakeEvidence.speciesChildList,
        formMutations: window.__setaeIntakeEvidence.formChildList,
        overlayMutations: window.__setaeIntakeEvidence.overlayChildList,
        scrollTop: document.querySelector('.specimen-intake-body').scrollTop,
        expectedScroll,
        fileName: nodes.photo.files[0]?.name || ''
      };
    }, beforeScroll);
    assert.equal(classificationResult.formSame, true);
    assert.equal(classificationResult.nameSame, true);
    assert.equal(classificationResult.dateSame, true);
    assert.equal(classificationResult.photoSame, true);
    assert.equal(classificationResult.noteSame, true);
    assert.equal(classificationResult.speciesRegionSame, true);
    assert.ok(classificationResult.speciesMutations > speciesMutationsBefore);
    assert.equal(classificationResult.formMutations, 0);
    assert.equal(classificationResult.overlayMutations, 0);
    assert.equal(classificationResult.scrollTop, classificationResult.expectedScroll);
    assert.equal(classificationResult.fileName, 'specimen-c246.png');
    results.push({ check: 'classification-species-region-only', status: 'PASS', result: classificationResult });

    await page.locator('[name="classification"]').selectOption('tarantula');
    await page.locator('[data-action="specimen-species-manual"]').click();
    assert.equal(await page.locator('[name="custom_species"]').count(), 1);
    await page.waitForFunction(() => document.activeElement?.name === 'custom_species');
    await page.getByRole('button', { name: '図鑑から選ぶ' }).click();
    await page.waitForFunction(() => document.activeElement?.dataset.role === 'species-combobox-input');
    await selectSpecies(page);
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'change-specimen-species');
    assert.equal(await page.getByRole('button', { name: '変更' }).count(), 1);
    await page.getByRole('button', { name: '変更' }).click();
    const modeIdentity = await identities(page);
    Object.entries(modeIdentity).forEach(([name, same]) => assert.equal(same, true, 'species mode preserves ' + name));
    assert.equal(await fileInput.evaluate((node) => node === window.__setaeFileNode246 && node.files[0]?.name), 'specimen-c246.png');
    results.push({ check: 'catalog-manual-select-clear-stability', status: 'PASS', identity: modeIdentity });

    const formBeforeValidation = await page.locator('[data-specimen-intake-root]').evaluate((node) => { window.__setaeValidationForm246 = node; return true; });
    assert.equal(formBeforeValidation, true);
    await submitButton(page).click();
    await page.getByRole('alert').filter({ hasText: '図鑑から種を選ぶか' }).waitFor();
    const validation = await page.evaluate(() => {
      const form = window.__setaeSpecimenIntake246.form();
      return { formSame: form === window.__setaeValidationForm246, fileSame: form.elements.image === window.__setaeFileNode246, fileName: form.elements.image.files[0]?.name || '', date: form.elements.acquired_date.value };
    });
    assert.deepEqual(validation, { formSame: true, fileSame: true, fileName: 'specimen-c246.png', date: '2026-08-27' });
    const accessibleError = await page.evaluate(() => {
      const input = document.querySelector('[data-role="species-combobox-input"]');
      const error = document.querySelector('[data-specimen-intake-region="error"]');
      const rect = input.getBoundingClientRect();
      const fieldRect = input.closest('.field').getBoundingClientRect();
      const bodyRect = input.closest('form').querySelector('.specimen-intake-body').getBoundingClientRect();
      return { focused: document.activeElement === input, invalid: input.getAttribute('aria-invalid'),
        errorId: error.id, describedBy: (input.getAttribute('aria-describedby') || '').split(/\s+/),
        visible: rect.top >= 0 && rect.bottom <= innerHeight,
        fieldVisible: fieldRect.top >= bodyRect.top - 1 && fieldRect.bottom <= bodyRect.bottom + 1 };
    });
    assert.equal(accessibleError.focused, true);
    assert.equal(accessibleError.invalid, 'true');
    assert.ok(accessibleError.errorId && accessibleError.describedBy.includes(accessibleError.errorId));
    assert.equal(accessibleError.visible, true);
    assert.equal(accessibleError.fieldVisible, true, 'The field label and input must remain inside the modal scroll viewport.');
    results.push({ check: 'validation-error-stability', status: 'PASS', result: validation });
    results.push({ check: 'validation-error-focus-description-and-visible-field', status: 'PASS', result: accessibleError });

    const beforeFocusPath = screenshotPath('specimen-intake-before-focus.png');
    const afterFocusPath = screenshotPath('specimen-intake-after-focus.png');
    await page.addStyleTag({ content: '* { caret-color: transparent !important; animation: none !important; transition: none !important; }' });
    await page.locator('.specimen-intake-header').click();
    await page.screenshot({ path: beforeFocusPath, fullPage: true });
    await page.locator('[name="name"]').focus();
    await page.screenshot({ path: afterFocusPath, fullPage: true });
    const screenshotDiff = compareScreenshots(beforeFocusPath, afterFocusPath);
    assert.ok(screenshotDiff.ratio < 0.03, 'focus should not redraw a large portion of the modal');
    results.push({ check: 'focus-screenshot-diff', status: 'PASS', screenshotDiff, before: path.relative(evidenceDir, beforeFocusPath), after: path.relative(evidenceDir, afterFocusPath) });

    await selectSpecies(page);
    await page.waitForFunction(() => document.activeElement?.dataset.action === 'change-specimen-species');
    assert.equal(await page.locator('[data-specimen-intake-region="error"]').isHidden(), true);
    assert.equal(await page.locator('[data-specimen-intake-root] [aria-invalid="true"]').count(), 0);
    await page.evaluate(() => window.__setaeSpecimenIntake246.setSubmitMode('pending'));
    const pendingForm = await page.locator('[data-specimen-intake-root]').evaluate((node) => { window.__setaePendingForm246 = node; return true; });
    assert.equal(pendingForm, true);
    await submitButton(page).click();
    await page.waitForFunction(() => document.querySelector('[data-specimen-intake-root]').dataset.pending === 'true');
    const pending = await page.evaluate(() => {
      const form = window.__setaeSpecimenIntake246.form();
      return {
        formSame: form === window.__setaePendingForm246,
        fileSame: form.elements.image === window.__setaeFileNode246,
        fileName: form.elements.image.files[0]?.name || '',
        allDisabled: [...form.querySelectorAll('input, select, textarea, button')].every((node) => node.disabled),
        busyShield: Boolean(form.closest('.modal').querySelector('.dialog-busy-shield'))
      };
    });
    assert.deepEqual(pending, { formSame: true, fileSame: true, fileName: 'specimen-c246.png', allDisabled: true, busyShield: true });
    results.push({ check: 'pending-stability', status: 'PASS', result: pending });
    await opened.context.close();

    opened = await openFixture(fixture, { browser, viewport: { width: 1024, height: 820 } });
    page = opened.page;
    await openOptionalInputs(page);
    await page.locator('[name="name"]').fill('C246-ERROR');
    await page.locator('[name="acquired_date"]').fill('2026-08-27');
    await page.locator('[name="notes"]').fill('APIエラー後も残るメモ');
    await page.locator('[name="image"]').setInputFiles({ name: 'error-preserved.png', mimeType: 'image/png', buffer: Buffer.from('error-file') });
    await selectSpecies(page);
    await page.evaluate(() => {
      const form = window.__setaeSpecimenIntake246.form();
      window.__setaeApiErrorNodes246 = { form, file: form.elements.image, date: form.elements.acquired_date, note: form.elements.notes };
      window.__setaeSpecimenIntake246.setSubmitMode('api-error');
    });
    await submitButton(page).click();
    await page.getByRole('alert').filter({ hasText: '保存できませんでした' }).waitFor();
    const apiError = await page.evaluate(() => {
      const form = window.__setaeSpecimenIntake246.form();
      return {
        formSame: form === window.__setaeApiErrorNodes246.form,
        fileSame: form.elements.image === window.__setaeApiErrorNodes246.file,
        dateSame: form.elements.acquired_date === window.__setaeApiErrorNodes246.date,
        noteSame: form.elements.notes === window.__setaeApiErrorNodes246.note,
        fileName: form.elements.image.files[0]?.name || '',
        date: form.elements.acquired_date.value,
        note: form.elements.notes.value,
        pending: form.dataset.pending,
        submitEnabled: !form.querySelector('[type="submit"]').disabled
      };
    });
    assert.deepEqual(apiError, { formSame: true, fileSame: true, dateSame: true, noteSame: true, fileName: 'error-preserved.png', date: '2026-08-27', note: 'APIエラー後も残るメモ', pending: 'false', submitEnabled: true });
    assert.equal(await page.locator('[data-specimen-intake-region="error"]').evaluate((node) => document.activeElement === node), true);
    await submitButton(page).click();
    await page.waitForFunction(() => window.__setaeSpecimenIntake246.submitCount() === 2);
    results.push({ check: 'api-error-preserves-and-retries', status: 'PASS', result: apiError });

    await page.waitForTimeout(80);
    await page.evaluate(() => window.__setaeSpecimenIntake246.setSubmitMode('success'));
    await submitButton(page).click();
    await page.locator('#success-state').waitFor();
    assert.equal(await page.locator('[data-specimen-intake-root]').count(), 0);
    results.push({ check: 'success-only-closes-form', status: 'PASS' });
    await opened.context.close();

    for (const width of [320, 390, 768, 1024, 1440]) {
      for (const theme of ['light', 'dark']) {
        const responsive = await openFixture(fixture, { browser, viewport: { width, height: width < 768 ? 844 : 900 }, colorScheme: theme, query: { theme } });
        const geometry = await responsive.page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        assert.equal(geometry.overflow, false, 'specimen intake overflow at ' + width + '/' + theme);
        const file = screenshotPath('specimen-intake-' + width + '-' + theme + '.png');
        await responsive.page.screenshot({ path: file, fullPage: false });
        results.push({ check: 'responsive-' + width + '-' + theme, status: 'PASS', geometry, screenshot: path.relative(evidenceDir, file) });
        await responsive.context.close();
      }
    }
  } catch (error) {
    writeEvidence('browser-specimen-intake-stability-qa.json', { status: 'FAIL', results, error: String(error.stack || error) });
    throw error;
  } finally {
    await browser.close();
  }
  writeEvidence('browser-specimen-intake-stability-qa.json', { status: 'PASS', results });
  console.log('Specimen Intake stability QA passed (' + results.length + ' checks)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
