const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const controller = read('assets/app/features/specimen-intake/controller.js');
const view = read('assets/app/features/specimen-intake/view.js');
const app = read('assets/app/app.js');

assert.match(controller, /export function createSpecimenIntakeController/);
[
  'mount', 'destroy', 'setClassification', 'showCatalog', 'showManual',
  'clearSpecies', 'selectSpecies', 'setPending', 'setError', 'setFileStatus',
  'snapshot', 'validate'
].forEach((method) => assert.match(controller, new RegExp(`\\b${method}\\b`)));
assert.match(controller, /region\.innerHTML\s*=\s*renderSpeciesRegion\(nextState\)/);
assert.doesNotMatch(controller, /appRoot\.innerHTML|form\.innerHTML/);
assert.match(controller, /const scrollTop = body\?\.scrollTop/);
assert.match(controller, /if \(body\) body\.scrollTop = scrollTop/);
assert.match(controller, /setFormPending\(target/);
assert.match(controller, /setDialogPending\(panel/);

assert.match(view, /data-stable-form="specimen-intake"/);
assert.match(view, /data-specimen-intake-root/);
assert.match(view, /data-specimen-intake-region="species"/);
assert.match(view, /data-specimen-intake-region="file-status"/);
assert.match(view, /data-specimen-intake-region="error"/);
assert.match(view, /data-specimen-intake-region="busy"/);
assert.match(view, /export function renderSpecimenSpeciesRegion/);

assert.match(app, /createSpecimenIntakeController\(/);
assert.match(app, /stableSpecimenForm\?\.isConnected[\s\S]*?delete regions\.overlays/);
assert.doesNotMatch(app, /function preserveSpecimenIntakeDraft/);
assert.match(app, /specimen-species-manual'[\s\S]{0,160}showManual\(\)[\s\S]{0,80}return/);
assert.match(app, /specimen-species-catalog'[\s\S]{0,160}showCatalog\(\)[\s\S]{0,80}return/);
assert.match(app, /data-role="specimen-classification"[\s\S]{0,180}setClassification/);
assert.match(app, /controller\?\.setPending\(true/);
assert.match(app, /controller\?\.setPending\(false\)/);
assert.match(app, /controller\?\.setError/);

function verifyOptionalSectionModelAndController() {
  const { Element, Form, FormData } = require('./helpers/specimen-intake-app-harness.cjs');
  const stripModule = (source) => source
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  const context = vm.createContext({
    icon: (name) => '<svg data-icon="' + name + '"></svg>', escapeHtml,
    formatDateFieldValue: (value) => value, safeHttpUrl: (value) => value,
    animalCode: (animal) => animal.title || animal.name || 'LOCAL',
    qrVisibilityLabel: (value) => ({ private: '非公開', basic: '基本情報を公開', life_history: '生活史を公開' })[value],
    FormData, requestAnimationFrame: (callback) => callback(),
    setFormPending() {}, setDialogPending() {}
  });
  vm.runInContext([
    stripModule(read('assets/app/components/primitives.js')),
    stripModule(read('assets/app/features/specimen/public-settings.js')),
    stripModule(read('assets/app/features/specimen-intake/model.js')),
    stripModule(read('assets/app/components/form-disclosure.js')),
    stripModule(view), stripModule(controller),
    'this.exports = { specimenSectionHasValues, specimenHasPhoto, renderSpecimenIntake, renderSpecimenSpeciesRegion, createSpecimenIntakeController, specimenPublicSettings, appendSpecimenPublicSettings, qrSettingsPayload, syncSpecimenPublicSettings, syncSpecimenTransferControl };'
  ].join('\n'), context);
  const actual = context.exports;
  for (const section of ['condition', 'husbandry', 'records', 'administration']) {
    assert.equal(actual.specimenSectionHasValues(section, { gender: 'unknown', status: 'normal', enclosure_id: '0', bl_status: 'none', archived: '0' }), false);
  }
  for (const zero of [0, '0']) {
    assert.equal(actual.specimenSectionHasValues('condition', { instar: zero }), true);
    assert.equal(actual.specimenSectionHasValues('husbandry', { temperature: zero }), true);
    assert.equal(actual.specimenSectionHasValues('husbandry', { humidity: zero }), true);
  }
  assert.equal(actual.specimenSectionHasValues('condition', { gender: 'female' }), true);
  assert.equal(actual.specimenSectionHasValues('husbandry', { notes: 'belongs elsewhere', substrate: '  ' }), false);
  assert.equal(actual.specimenSectionHasValues('records', {}, { hasImage: true }), true);
  assert.equal(actual.specimenSectionHasValues('administration', { archived: true }), true);
  assert.equal(actual.specimenSectionHasValues('administration', { breeding_contact_url: 'https://example.test/' }), true);
  assert.equal(actual.specimenSectionHasValues('administration', { qr_visibility: 'basic' }), true);
  assert.equal(actual.specimenSectionHasValues('administration', { transfer_enabled: '0' }), false);
  assert.equal(actual.specimenSectionHasValues('administration', { transfer_enabled: '1' }), true);
  assert.equal(actual.specimenHasPhoto({ image_url: '/local-fixture.png' }), true);
  assert.equal(actual.specimenHasPhoto({ image: { url: '/nested-fixture.png' } }), true);
  assert.equal(actual.specimenHasPhoto({}), false);
  const disclosures = (html) => Object.fromEntries([...html.matchAll(/<details\b([^>]*data-specimen-intake-section="([^"]+)"[^>]*)>/g)]
    .map((match) => [match[2], /\bopen(?:\s|=|$)/.test(match[1])]));
  const emptyHtml = actual.renderSpecimenIntake({ data: {} });
  assert.deepEqual(disclosures(emptyHtml), { condition: false, husbandry: false, records: false });
  assert.match(emptyHtml, /<section[^>]+aria-labelledby="intake-identity-title"/);
  assert.match(emptyHtml, /name="species_id"[^>]+value=""/);
  assert.match(emptyHtml, /name="custom_species"[^>]+value=""/);
  assert.match(emptyHtml, /data-form-notice-host/);
  const populatedHtml = actual.renderSpecimenIntake({ data: {
    id: 1, title: 'LOCAL', species_id: 501, instar: 0, temperature: 0, image_url: '/local.png', bl_status: 'recruiting'
  } });
  assert.deepEqual(disclosures(populatedHtml), { condition: true, husbandry: true, records: true, administration: true });
  assert.match(populatedHtml, /未選択なら現在の写真を保持します/);
  assert.equal((populatedHtml.match(/name="species_id"/g) || []).length, 1);
  assert.equal((populatedHtml.match(/name="custom_species"/g) || []).length, 1);

  const privateAnimal = { id: 1, qr_visibility: 'private', transfer_enabled: false };
  for (const mode of ['private', 'basic', 'life_history']) {
    const html = actual.renderSpecimenIntake({ data: { ...privateAnimal, qr_visibility: mode } });
    assert.equal((html.match(/name="qr_visibility"/g) || []).length, 3);
    assert.match(html, new RegExp('name="qr_visibility"[^>]*value="' + mode + '"[^>]*checked'));
    assert.match(html, /name="transfer_enabled" value="1"/);
    assert.match(html, /公開範囲とは別に設定/);
    assert.match(html, /受付中は「非公開」を選んでいても/);
    assert.match(html, /未承認の申請は取り消されます/);
  }
  const unknownHtml = actual.renderSpecimenIntake({ data: { id: 1 } });
  assert.match(unknownHtml, /公開範囲は未確認/);
  assert.doesNotMatch(unknownHtml, /name="qr_visibility"/);
  assert.doesNotMatch(emptyHtml, /name="qr_visibility"|name="transfer_enabled"/);
  const legacyHtml = actual.renderSpecimenIntake({ data: { id: 1, qr_public: true, transfer_enabled: false } });
  assert.match(legacyHtml, /name="qr_visibility"[^>]*value="life_history"[^>]*checked/);
  const receiptHtml = actual.renderSpecimenIntake({ data: { ...privateAnimal, archived: true, transfer_receipt: true } });
  assert.match(receiptHtml, /name="qr_visibility"[^>]*disabled/);
  assert.match(receiptHtml, /name="archived"[^>]*checked[^>]*disabled/);

  const editForm = new Form('1');
  editForm.elements.transfer_enabled = { checked: false, disabled: false };
  const patch = (record, fields = {}) => {
    const data = new FormData();
    Object.entries(fields).forEach(([name, value]) => data.set(name, value));
    const changed = actual.appendSpecimenPublicSettings(data, editForm, record);
    return { changed, fields: Object.fromEntries(data) };
  };
  assert.deepEqual(patch(privateAnimal, { name: 'kept', qr_visibility: 'private' }), { changed: false, fields: { name: 'kept' } });
  assert.deepEqual(patch(privateAnimal, { qr_visibility: 'basic' }), { changed: true, fields: { qr_visibility: 'basic' } });
  editForm.elements.transfer_enabled.checked = true;
  assert.deepEqual(patch(privateAnimal, { qr_visibility: 'private', transfer_enabled: '1' }), { changed: true, fields: { transfer_enabled: '1' } });
  editForm.elements.transfer_enabled.checked = false;
  assert.deepEqual(patch({ ...privateAnimal, transfer_enabled: true }, { qr_visibility: 'private' }), { changed: true, fields: { transfer_enabled: '0' } });
  assert.deepEqual(patch({ ...privateAnimal, transfer_receipt: true }, { qr_visibility: 'basic', transfer_enabled: '1' }), { changed: false, fields: {} });
  assert.deepEqual(patch({ id: 1 }, { qr_visibility: 'basic' }), { changed: false, fields: {} });
  for (const value of ['1', 'on', '0', null]) {
    const data = new FormData(); data.set('visibility', 'basic');
    if (value !== null) data.set('transfer_enabled', value);
    assert.equal(actual.qrSettingsPayload(data).transfer_enabled, ['1', 'on'].includes(value));
  }
  const settingsState = { animals: [{ id: 1 }, { id: 2 }], selectedAnimal: { id: 1 },
    qr: { targets: { count: 2, items: [{ target_type: 'spider', object_id: 1, code: 'keep1' }, { target_type: 'spider', object_id: 2, code: 'keep2' }] } } };
  actual.syncSpecimenPublicSettings(settingsState, 1, { visibility: 'basic', transfer_enabled: true });
  assert.equal(settingsState.animals[0].qr_visibility, 'basic');
  assert.equal(settingsState.selectedAnimal.transfer_enabled, true);
  assert.equal(settingsState.qr.targets.items.length, 2, 'Updating public settings must not replace a multi-label selection');
  assert.equal(settingsState.qr.targets.items[0].code, 'keep1');
  assert.equal(settingsState.qr.targets.items[1].code, 'keep2');
  const archivedForm = { dataset: {}, elements: { archived: { checked: true }, transfer_enabled: {
    checked: true, disabled: false, setAttribute() {}, closest() { return null; }
  } }, querySelector() { return null; } };
  actual.syncSpecimenTransferControl(archivedForm, privateAnimal);
  assert.equal(archivedForm.elements.transfer_enabled.checked, false);
  assert.equal(archivedForm.elements.transfer_enabled.disabled, true);
  archivedForm.elements.archived.checked = false;
  actual.syncSpecimenTransferControl(archivedForm, privateAnimal);
  assert.equal(archivedForm.elements.transfer_enabled.checked, true, 'Undoing archive restores the preceding acceptance choice');
  assert.equal(archivedForm.elements.transfer_enabled.disabled, false);
  const unknownReceiptForm = { dataset: {}, elements: { archived: { checked: false } }, querySelectorAll() { return []; } };
  actual.syncSpecimenTransferControl(unknownReceiptForm, { id: 1, archived: true, transfer_receipt: true });
  assert.equal(unknownReceiptForm.elements.archived.checked, true, 'A legacy draft cannot unarchive a receipt even when public settings are unavailable');

  // The real controller runs against a small tree here; actual browser event
  // propagation and native details visibility are exercised in the browser suite.
  const form = new Form();
  form.fields = { classification: 'tarantula', species_id: '501', instar: '0', temperature: '0', notes: '' };
  form.ownerDocument = { activeElement: null };
  const listenerOptions = new Map();
  form.addEventListener = (name, callback, options) => { form.listeners.set(name, callback); listenerOptions.set(name, options); };
  form.removeEventListener = (name, callback) => { if (form.listeners.get(name) === callback) { form.listeners.delete(name); listenerOptions.delete(name); } };
  const body = new Element('div', { class: 'specimen-intake-body' }, form);
  body.scrollTop = 31;
  const nameInput = new Element('input', { name: 'name', type: 'text' }, body);
  nameInput.focus = () => { form.ownerDocument.activeElement = nameInput; };
  form.elements.name = nameInput;
  const speciesRegion = new Element('div', { 'data-specimen-intake-region': 'species' }, body);
  const fileStatus = new Element('div', { 'data-specimen-intake-region': 'file-status' }, body);
  const errorRegion = new Element('div', { 'data-specimen-intake-region': 'error' }, form);
  errorRegion.id = 'unit-intake-error';
  const sections = Object.fromEntries(['condition', 'husbandry', 'records', 'administration'].map((name) => {
    const element = new Element('details', { 'data-specimen-intake-section': name }, body);
    element.open = false;
    return [name, element];
  }));
  const field = new Element('label', { class: 'field' }, sections.condition);
  const instar = new Element('input', { name: 'instar', type: 'number' }, field);
  instar.type = 'number';
  instar.focus = () => { form.ownerDocument.activeElement = instar; };
  field.scrollIntoView = () => { field.scrolled = true; };
  form.elements.image = { files: [] };
  form.elements.namedItem = (name) => name === 'instar' ? instar : null;
  let state = { classification: 'tarantula', data: {} };
  let patches = 0;
  const intake = actual.createSpecimenIntakeController({
    getModalState: () => state, updateModalState: (next) => { state = next; },
    renderSpeciesRegion: (next) => { patches += 1; return actual.renderSpecimenSpeciesRegion(next); },
    speciesCombobox: { clear() {} }, formSafety: { sync() {} }
  });
  intake.mount(form);
  assert.equal(listenerOptions.get('invalid'), true, 'Native invalid needs a capture listener.');
  for (const name of ['setae:form-draft-restoring', 'setae:form-draft-restored']) assert.equal(form.listeners.has(name), true);
  form.listeners.get('setae:form-draft-restoring')({ target: form, detail: { values: { classification: 'tarantula', species_id: '501' } } });
  assert.equal(state.speciesId, 501);
  assert.equal(state.speciesMode, 'catalog');
  assert.match(speciesRegion.innerHTML, /図鑑の種 #501/);
  const preparedPatches = patches;
  intake.setClassification('tarantula');
  assert.equal(patches, preparedPatches, 'The subsequent classification change cannot destroy prepared species fields.');
  form.listeners.get('setae:form-draft-restored')({ target: form, detail: { hadFiles: true } });
  assert.equal(form.ownerDocument.activeElement, nameInput, 'Removing the restore button cannot leave focus outside the form.');
  assert.equal(sections.condition.open, true);
  assert.equal(sections.husbandry.open, true);
  assert.equal(sections.records.open, true);
  assert.equal(sections.administration.open, false);
  assert.equal(form.dataset.draftHadFile, 'true');
  assert.equal(fileStatus.textContent, '写真は復元できません。もう一度選択してください。');
  intake.setFileStatus({ name: 'chosen.png' });
  assert.equal(form.dataset.draftHadFile, 'false');
  assert.equal(fileStatus.textContent, 'chosen.pngを選択しています。');
  sections.condition.open = false;
  form.listeners.get('invalid')({ target: instar });
  assert.equal(sections.condition.open, true);
  sections.condition.open = false;
  instar.setAttribute('aria-invalid', 'true');
  intake.setError('項目を確認してください。');
  assert.equal(sections.condition.open, true);
  assert.equal(form.ownerDocument.activeElement, instar);
  assert.equal(field.scrolled, true);
  assert.ok(instar.getAttribute('aria-describedby').includes(errorRegion.id));
  form.listeners.get('setae:form-draft-restored')({ target: form, detail: { hadFiles: false } });
  assert.equal(form.ownerDocument.activeElement, instar, 'Restoration must preserve focus already inside the form.');
  instar.removeAttribute('aria-invalid');
  const hiddenSpecies = new Element('input', { name: 'species_id', type: 'hidden' }, speciesRegion);
  hiddenSpecies.type = 'hidden';
  hiddenSpecies.name = 'species_id';
  const changeSpecies = new Element('button', { 'data-action': 'change-specimen-species' }, speciesRegion);
  changeSpecies.focus = () => { form.ownerDocument.activeElement = changeSpecies; };
  for (const hiddenName of ['species_id', 'custom_species']) {
    changeSpecies.removeAttribute('aria-invalid');
    hiddenSpecies.name = hiddenName;
    hiddenSpecies.setAttribute('name', hiddenName);
    hiddenSpecies.setAttribute('aria-invalid', 'true');
    intake.setError('種を確認してください。');
    assert.equal(form.ownerDocument.activeElement, changeSpecies, 'Hidden API field errors must focus the visible species control.');
    assert.equal(changeSpecies.getAttribute('aria-invalid'), 'true');
    assert.ok(changeSpecies.getAttribute('aria-describedby').includes(errorRegion.id));
  }
  form.listeners.get('setae:form-draft-restoring')({ target: form,
    detail: { values: { classification: 'true_spider', custom_species: '手入力した種' } } });
  assert.equal(state.classification, 'true_spider');
  assert.equal(state.speciesId, '');
  assert.equal(state.speciesMode, 'manual');
  assert.equal(state.data.custom_species, '手入力した種');
  const manualPatches = patches;
  intake.setClassification('true_spider');
  assert.equal(patches, manualPatches);
  intake.destroy();
  assert.equal(form.listeners.size, 0, 'Unmount removes disclosure and restoration listeners.');
  assert.equal(intake.mounted, false);
  console.log('Specimen optional section model, markup and controller lifecycle tests passed');
}

verifyOptionalSectionModelAndController();

async function runApplicationRegression() {
  const { createHarness, deferred } = require('./helpers/specimen-intake-app-harness.cjs');
  let checks = 0;
  for (const editId of ['', '1']) {
    const harness = createHarness({ editId });
    const before = harness.navigation();
    const targets = [
      harness.make('input', { name: 'name' }), harness.make('label'),
      harness.make('textarea', { name: 'notes' }), harness.make('select', { name: 'gender' }),
      harness.make('input', { type: 'date', name: 'acquired_date' }),
      harness.make('input', { type: 'file', name: 'image' }),
      harness.make('div', { class: 'specimen-intake-header' }),
      harness.make('div', { class: 'specimen-intake-footer' }),
      harness.make('span', { contenteditable: 'true' }),
      harness.make('button', { type: 'submit', 'data-specimen-intake-submit': 'true' })
    ];
    for (const target of targets) {
      await harness.dispatch('click', target);
      await harness.dispatch('dblclick', target);
      await harness.dispatch('input', target, { isComposing: false });
      for (const key of ['Enter', ' ']) {
        const event = await harness.dispatch('keydown', target, { key });
        assert.equal(event.defaultPrevented, false, 'Text entry/native form behavior must not be consumed as animal navigation');
      }
      assert.deepEqual(harness.navigation(), before, `Intake ${target.tagName} must not navigate (editId=${editId || 'new'})`);
    }
    assert.deepEqual(harness.calls.detail, [], 'Form context IDs never trigger animal detail fetches');
    assert.deepEqual(harness.calls.saves, [], 'Click/typing unit events do not synthesize a submit');
    checks += 1;

    const species = harness.make('input', { 'data-role': 'species-combobox-input' });
    await harness.dispatch('compositionstart', species);
    for (const value of ['セ', 'セラ']) {
      species.value = value;
      await harness.dispatch('input', species, { isComposing: true });
      await harness.dispatch('keydown', species, { key: 'Enter', isComposing: true, keyCode: 229 });
    }
    assert.deepEqual(harness.calls.searches, [], 'IME conversion must not trigger intermediate searches');
    species.value = 'セラドニア';
    await harness.dispatch('compositionend', species);
    await harness.flushTimers();
    assert.deepEqual(harness.calls.searches, ['セラドニア']);
    const selected = await harness.dispatch('keydown', species, { key: 'Enter' });
    assert.equal(selected.defaultPrevented, true, 'The combobox owns Enter when selecting a result');
    assert.equal(harness.state.modal.speciesId, 501);
    assert.deepEqual(harness.navigation(), before);
    for (const action of ['specimen-species-manual', 'specimen-species-catalog', 'change-specimen-species']) {
      await harness.dispatch('click', harness.make('button', { 'data-action': action }));
      assert.deepEqual(harness.navigation(), before, `Local species transition ${action} does not route the background`);
    }
    const classification = harness.make('select', { 'data-role': 'specimen-classification' });
    classification.value = 'true_spider';
    await harness.dispatch('change', classification);
    assert.equal(harness.state.modal.classification, 'true_spider');
    assert.deepEqual(harness.navigation(), before);
    checks += 1;
  }

  for (const wide of [false, true]) {
    const harness = createHarness({ wide });
    harness.state.modal = null;
    harness.sandbox.overlayController.activePanel = null;
    const card = harness.make('article', { 'data-collection-animal': '', 'data-animal-id': '1' }, harness.background);
    const caption = harness.make('span', {}, card);
    await harness.dispatch('click', caption);
    await harness.flushTimers();
    if (wide) {
      assert.equal(harness.state.page, 'animals');
      assert.equal(harness.state.collectionSelection.selectedId, '1');
      await harness.dispatch('dblclick', caption);
    }
    assert.equal(harness.state.page, 'animal-detail');
    assert.equal(harness.state.selectedAnimalId, '1');
    assert.equal(harness.state.selectedAnimal.id, 1);
    checks += 1;
  }

  for (const extra of [{ defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }]) {
    const harness = createHarness();
    const before = harness.navigation();
    const card = harness.make('article', { 'data-collection-animal': '', 'data-animal-id': '1' }, harness.background);
    await harness.dispatch('keydown', card, { key: 'Enter', ...extra });
    assert.deepEqual(harness.navigation(), before, 'Handled/IME keys must not trigger a second navigation');
    checks += 1;
  }

  for (const [tag, attributes] of [
    ['tr', { 'data-collection-animal': '' }], ['article', { class: 'animal-card' }],
    ['div', { class: 'widget-animal-row' }], ['button', {}], ['a', { href: '#' }], ['div', { role: 'button' }]
  ]) {
    const harness = createHarness();
    harness.state.modal = null;
    const item = harness.make(tag, { ...attributes, 'data-animal-id': '1' }, harness.background);
    const text = harness.make('span', {}, item);
    assert.equal(harness.sandbox.resolveAnimalNavigationTarget(text), item, 'Existing explicit animal navigation roles remain usable');
    for (const control of [harness.make('input', { type: 'checkbox' }, item), harness.make('label', {}, item),
      harness.make('button', {}, item), harness.make('span', { contenteditable: 'true' }, item)]) {
      assert.equal(harness.sandbox.resolveAnimalNavigationTarget(control), null, 'Nested controls must keep their own behavior');
    }
    item.setAttribute('aria-disabled', 'true');
    assert.equal(harness.sandbox.resolveAnimalNavigationTarget(text), null);
  }
  checks += 1;

  const pendingClick = createHarness({ wide: true });
  pendingClick.state.modal = null;
  const pendingCard = pendingClick.make('article', { 'data-collection-animal': '', 'data-animal-id': '1' }, pendingClick.background);
  await pendingClick.dispatch('click', pendingCard);
  assert.equal(pendingClick.pendingTimers(), 1);
  pendingClick.sandbox.openSpecimenIntake({});
  assert.equal(pendingClick.pendingTimers(), 0, 'Opening intake cancels the delayed inspector selection');
  const afterOpen = pendingClick.navigation();
  await pendingClick.flushTimers();
  assert.deepEqual(pendingClick.navigation(), afterOpen);
  checks += 1;

  const invalid = createHarness();
  const beforeInvalid = invalid.navigation();
  for (const id of ['', 0, null, undefined, -1, 'not-an-id', '1/../../other', '01']) await invalid.sandbox.openAnimal(id);
  assert.deepEqual(invalid.navigation(), beforeInvalid);
  assert.equal(invalid.calls.renders, 0);
  assert.deepEqual(invalid.calls.detail, []);
  checks += 1;

  for (const failure of [false, true]) {
    const harness = createHarness();
    const late = deferred();
    harness.services.animals.get = () => late.promise;
    const operation = harness.sandbox.openAnimal(1);
    harness.state.page = 'animals';
    harness.sandbox.openSpecimenIntake({});
    const before = harness.navigation();
    const renders = harness.calls.renders;
    if (failure) late.reject(new Error('Late detail error must not reach the new form'));
    else late.resolve({ id: 1, title: 'Late response' });
    await operation;
    assert.deepEqual(harness.navigation(), before);
    assert.equal(harness.calls.renders, renders, 'Stale request finally must not redraw the intake');
    assert.equal(harness.state.error, null);
    assert.equal(harness.state.modal.type, 'animal');
    checks += 1;
  }

  const race = createHarness();
  const oldRequest = deferred();
  race.services.animals.get = (id) => Number(id) === 1 ? oldRequest.promise : Promise.resolve({ id: 2, title: 'Current animal' });
  const oldOperation = race.sandbox.openAnimal(1);
  await race.sandbox.openAnimal(2);
  const current = race.navigation();
  oldRequest.resolve({ id: 1, title: 'Stale animal' });
  await oldOperation;
  assert.deepEqual(race.navigation(), current);
  checks += 1;

  const expired = createHarness();
  const session = deferred();
  expired.services.animals.get = () => Promise.reject(Object.assign(new Error('Expired old request'), { status: 401 }));
  expired.services.session.get = () => session.promise;
  const expiredOperation = expired.sandbox.openAnimal(1);
  await Promise.resolve();
  await Promise.resolve();
  expired.state.page = 'animals';
  expired.sandbox.openSpecimenIntake({});
  const beforeSession = expired.navigation();
  session.resolve({ authenticated: false });
  await expiredOperation;
  assert.deepEqual(expired.navigation(), beforeSession);
  assert.equal(expired.state.authenticated, true, 'A stale 401/session result must not reset the current editing context');
  assert.equal(expired.state.modal.type, 'animal');
  checks += 1;

  const incomplete = createHarness();
  incomplete.form.fields.species_id = '';
  const beforeIncomplete = incomplete.navigation();
  await incomplete.dispatch('submit', incomplete.form);
  assert.deepEqual(incomplete.navigation(), beforeIncomplete);
  assert.deepEqual(incomplete.calls.saves, []);
  assert.ok(incomplete.calls.errors.some((message) => message.includes('図鑑から種を選ぶか')));
  checks += 1;

  for (const editId of ['', '1']) {
    for (const succeeds of [false, true]) {
      const harness = createHarness({ editId });
      const pending = deferred();
      const before = harness.navigation();
      const expectedPayload = { ...harness.form.fields, archived: '0' };
      const method = editId ? 'update' : 'create';
      harness.services.animals[method] = (...args) => {
        harness.calls.saves.push({ method, args });
        return pending.promise;
      };
      const operation = harness.dispatch('submit', harness.form, {
        submitter: harness.make('button', { type: 'submit', 'data-specimen-intake-submit': 'true' })
      });
      assert.deepEqual(harness.navigation(), before, 'A pending save must not navigate or replace the active animal');
      assert.equal(harness.state.modal.submitting, true);
      assert.equal(harness.calls.saves.length, 1);
      assert.deepEqual(JSON.parse(JSON.stringify(harness.calls.saves[0].args.at(-1))), expectedPayload);
      if (succeeds) pending.resolve(editId ? { success: true, data: { id: 1 } } : { success: true, id: 901 });
      else pending.reject(new Error('Save failed without changing the background'));
      await operation;
      if (succeeds) {
        assert.equal(harness.state.modal, null);
        assert.equal(harness.calls.refreshes, 1);
        assert.equal(harness.calls.destroyed, 1);
        if (editId) {
          assert.equal(harness.state.page, 'animal-detail');
          assert.equal(harness.state.selectedAnimalId, editId);
          assert.equal(harness.state.selectedAnimal.id, Number(editId));
        } else assert.deepEqual(harness.navigation(), before, 'New registration keeps the current collection route');
      } else {
        assert.deepEqual(harness.navigation(), before);
        assert.equal(harness.state.modal.type, 'animal');
        assert.equal(harness.calls.refreshes, 0);
        assert.equal(harness.calls.destroyed, 0);
        assert.equal(harness.form.fields.notes, 'Keep this text.');
      }
      checks += 1;
    }
  }
  for (const withImage of [false, true]) {
    const harness = createHarness({ editId: '1' });
    harness.state.modal.data = { id: 1, qr_visibility: 'private', transfer_enabled: false };
    harness.form.fields.qr_visibility = 'basic';
    harness.form.fields.transfer_enabled = '1';
    harness.form.elements.transfer_enabled = { checked: true, disabled: false };
    if (withImage) harness.form.fields.image = Object.assign(new harness.sandbox.File(), { size: 1, name: 'retained.png' });
    await harness.dispatch('submit', harness.form);
    assert.equal(harness.calls.saves.length, 1, 'Public and specimen fields use one animal save');
    const payload = harness.calls.saves[0].payload;
    const value = (name) => withImage ? payload.get(name) : payload[name];
    assert.equal(value('qr_visibility'), 'basic');
    assert.equal(value('transfer_enabled'), '1');
    assert.equal(value('name'), 'LOCAL-NEW');
    if (withImage) assert.equal(value('image'), harness.form.fields.image);
    checks += 1;
  }
  for (const changed of [false, true]) {
    const harness = createHarness({ editId: '1' });
    harness.state.modal.data = { id: 1, qr_visibility: 'private', transfer_enabled: false };
    harness.form.fields.qr_visibility = changed ? 'basic' : 'private';
    harness.form.elements.transfer_enabled = { checked: false, disabled: false };
    const queued = [];
    harness.sandbox.enqueueOffline = (...args) => queued.push(args);
    harness.services.animals.update = async () => { throw Object.assign(new Error('Offline'), { code: 'network_error' }); };
    await harness.dispatch('submit', harness.form);
    assert.equal(queued.length, changed ? 0 : 1, 'Only ordinary edits may enter the offline queue');
    if (changed) {
      assert.equal(harness.state.modal.type, 'animal');
      assert.equal(harness.state.modal.submitting, false);
      assert.equal(harness.form.fields.qr_visibility, 'basic');
      assert.equal(harness.form.fields.notes, 'Keep this text.');
      assert.ok(harness.calls.errors.some((message) => message.includes('保存結果を確認できませんでした')));
    } else {
      assert.equal(harness.state.modal, null);
      assert.equal(Object.hasOwn(queued[0][2], 'qr_visibility'), false, 'Unchanged visibility must not be replayed later');
      assert.equal(Object.hasOwn(queued[0][2], 'transfer_enabled'), false);
    }
    checks += 1;
  }
  console.log(`Specimen Intake stability tests passed (${checks} real-app delegation/race/save checks plus existing structural checks)`);
}

runApplicationRegression().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
