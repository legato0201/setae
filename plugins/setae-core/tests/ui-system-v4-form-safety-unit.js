const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('assets/app/components/form-safety-controller.js')
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
  .replace(/\bexport\s+/g, '');
const disclosureSource = read('assets/app/components/form-disclosure.js').replace(/\bexport\s+/g, '');
const context = vm.createContext({
  discardConfirmation: {
    title: '入力内容を破棄しますか？',
    description: '保存していない変更があります。',
    continueLabel: '編集を続ける',
    discardLabel: '変更を破棄'
  },
  button: (label, options = {}) => `<button data-action="${options.action || ''}">${label}</button>`,
  Event,
  CustomEvent,
  Date,
  JSON,
  Object,
  Set,
  Map
});
vm.runInContext(`${disclosureSource}\n${source}\nthis.exports = { FORM_DRAFT_STORAGE_PREFIX, FORM_DRAFT_TTL_MS, FORM_DRAFT_DEBOUNCE_MS, FORM_DRAFT_VERSION, formDraftKey, serializeFormDraft, restoreFormDraft, formDraftHasRestorableChanges, draftIsExpired, purgeExpiredDrafts, revealFormControl };`, context);
const safety = context.exports;

const text = { name: 'title', type: 'text', value: 'C014', dispatchEvent() {} };
const password = { name: 'password', type: 'password', value: 'never-store', dispatchEvent() {} };
const token = { name: 'api_token', type: 'text', value: 'never-store', dispatchEvent() {} };
const file = { name: 'image', type: 'file', files: [{ name: 'photo.jpg' }], dispatchEvent() {} };
const checked = { name: 'status', type: 'checkbox', value: 'alive', checked: true, dispatchEvent() {} };
const unchecked = { name: 'status', type: 'checkbox', value: 'dead', checked: false, dispatchEvent() {} };
const form = {
  dataset: { draftType: 'animal', draftEntity: '124' },
  elements: [text, password, token, file, checked, unchecked],
  querySelectorAll: () => [],
  ownerDocument: { defaultView: { Event } }
};
const draft = safety.serializeFormDraft(form);
assert.equal(draft.version, 1);
assert.equal(draft.values.title, 'C014');
assert.equal(Object.hasOwn(draft.values, 'password'), false);
assert.equal(Object.hasOwn(draft.values, 'api_token'), false);
assert.equal(Object.hasOwn(draft.values, 'image'), false);
assert.deepEqual(JSON.parse(JSON.stringify(draft.checks.status)), ['alive']);
assert.equal(draft.hadFiles, true);
assert.equal(safety.formDraftKey(37, form), 'setae.gui.v2.formDraft.37.animal.124');
assert.equal(safety.FORM_DRAFT_TTL_MS, 72 * 60 * 60 * 1000);
assert.equal(safety.FORM_DRAFT_DEBOUNCE_MS, 300);
assert.equal(safety.formDraftHasRestorableChanges(form, draft), false, 'The current input is not a recovery candidate');
assert.equal(safety.formDraftHasRestorableChanges(form, { ...draft, hadFiles: false }), false, 'File metadata alone cannot be restored');
assert.equal(safety.formDraftHasRestorableChanges(form, { values: { removed_field: 'old', password: 'different', api_token: 'different' }, hadFiles: true }), false, 'Absent and forbidden controls cannot offer recovery');

text.value = '';
checked.checked = false;
assert.equal(safety.formDraftHasRestorableChanges(form, draft), true, 'An older applicable field value can be restored');
assert.equal(safety.restoreFormDraft(form, draft, { dispatch: false }), true);
assert.equal(text.value, 'C014');
assert.equal(checked.checked, true);
const restoredEvents = [];
form.dispatchEvent = (event) => { restoredEvents.push(event); };
text.value = 'different';
safety.restoreFormDraft(form, draft);
assert.equal(restoredEvents.length, 2);
assert.equal(restoredEvents[0].type, 'setae:form-draft-restoring');
assert.equal(restoredEvents[0].bubbles, false, 'Preparation stays on the restoring form');
assert.deepEqual(Object.keys(restoredEvents[0].detail), ['values']);
assert.equal(restoredEvents[0].detail.values, draft.values);
assert.equal(restoredEvents[1].type, 'setae:form-draft-restored');
assert.equal(restoredEvents[1].bubbles, true);
assert.deepEqual(JSON.parse(JSON.stringify(restoredEvents[1].detail)), { hadFiles: true }, 'Completion notification exposes no draft values or storage key');
assert.equal(safety.formDraftHasRestorableChanges(form, draft), false);
assert.equal(safety.formDraftHasRestorableChanges(form, { checks: { status: [] } }), true);

// Older saved forms have no passport controls. Missing entries preserve the
// current server values; an explicit empty list still restores an OFF choice.
const visibility = { name: 'qr_visibility', type: 'radio', value: 'life_history', checked: true };
const transfer = { name: 'transfer_enabled', type: 'checkbox', value: '1', checked: true };
const publicForm = { elements: [visibility, transfer] };
safety.restoreFormDraft(publicForm, { values: { title: 'Old draft' } }, { dispatch: false });
assert.equal(visibility.checked, true, 'Legacy drafts must preserve the current public scope');
assert.equal(transfer.checked, true, 'Legacy drafts must not stop transfer acceptance');
safety.restoreFormDraft(publicForm, { checks: { transfer_enabled: [] } }, { dispatch: false });
assert.equal(visibility.checked, true, 'A missing radio group remains unchanged');
assert.equal(transfer.checked, false, 'An explicitly unchecked draft value is restored');

const originalControl = { name: 'custom_species', type: 'text', value: 'original', dispatchEvent() {} };
const replacementControl = { name: 'custom_species', type: 'text', value: '', dispatchEvent() {} };
const replacingForm = {
  elements: [originalControl],
  ownerDocument: { defaultView: { Event, CustomEvent } },
  dispatchEvent(event) {
    if (event.type === 'setae:form-draft-restoring') this.elements = [replacementControl];
  }
};
safety.restoreFormDraft(replacingForm, { values: { custom_species: 'replacement' } });
assert.equal(originalControl.value, 'original', 'Detached controls must not be part of the restore snapshot');
assert.equal(replacementControl.value, 'replacement', 'Dependent controls prepared by the hook receive stored values');

const options = [{ value: 'a', selected: false }, { value: 'b', selected: true }];
const multiple = { name: 'groups', type: 'select-multiple', tagName: 'SELECT', multiple: true, options };
const multipleForm = { elements: [multiple] };
safety.restoreFormDraft(multipleForm, { values: { another: 'value' } }, { dispatch: false });
assert.deepEqual(options.map((option) => option.selected), [false, true], 'New multi-select fields also retain their current selection');
safety.restoreFormDraft(multipleForm, { selections: { groups: [] } }, { dispatch: false });
assert.deepEqual(options.map((option) => option.selected), [false, false]);
options[1].selected = true;
assert.equal(safety.formDraftHasRestorableChanges(multipleForm, { selections: { groups: ['b', 'removed-option'] } }), false);
assert.equal(safety.formDraftHasRestorableChanges(multipleForm, { selections: { groups: ['a'] } }), true);
assert.equal(safety.formDraftHasRestorableChanges(multipleForm, { values: { another: 'value' } }), false);
assert.equal(safety.formDraftHasRestorableChanges(multipleForm, { selections: { groups: 'invalid' } }), false);
const singleSelect = { name: 'status', type: 'select-one', tagName: 'SELECT', value: 'b', options };
assert.equal(safety.formDraftHasRestorableChanges({ elements: [singleSelect] }, { values: { status: 'removed-option' } }), false);
assert.equal(safety.formDraftHasRestorableChanges({ elements: [singleSelect] }, { values: { status: 'a' } }), true);

const revealed = [];
const outer = { set open(value) { if (value) revealed.push('outer'); }, parentElement: null };
const inner = { set open(value) { if (value) revealed.push('inner'); }, parentElement: { closest: () => outer } };
const nestedControl = { value: 'untouched', closest: () => inner, focus: () => assert.fail('Disclosure must not change focus') };
safety.revealFormControl(nestedControl);
assert.deepEqual(revealed, ['inner', 'outer']);
assert.equal(nestedControl.value, 'untouched');
safety.revealFormControl(null);
assert.equal(safety.draftIsExpired({ updatedAt: new Date(1_000).toISOString() }, 1_000 + safety.FORM_DRAFT_TTL_MS), false);
assert.equal(safety.draftIsExpired({ updatedAt: new Date(1_000).toISOString() }, 1_001 + safety.FORM_DRAFT_TTL_MS), true);

const values = new Map([
  ['setae.gui.v2.formDraft.37.animal.old', JSON.stringify({ updatedAt: new Date(1_000).toISOString() })],
  ['setae.gui.v2.formDraft.37.animal.current', JSON.stringify({ updatedAt: new Date(9_000).toISOString() })],
  ['setae.gui.v2.formDraft.99.animal.other', JSON.stringify({ updatedAt: new Date(1_000).toISOString() })]
]);
const storage = {
  get length() { return values.size; },
  key: (index) => [...values.keys()][index],
  getItem: (key) => values.get(key) ?? null,
  removeItem: (key) => values.delete(key)
};
const removed = safety.purgeExpiredDrafts(storage, 37, 1_000 + safety.FORM_DRAFT_TTL_MS + 1);
assert.deepEqual(JSON.parse(JSON.stringify(removed)), ['setae.gui.v2.formDraft.37.animal.old']);
assert.equal(values.has('setae.gui.v2.formDraft.99.animal.other'), true);

assert.match(source, /beforeunload/);
assert.match(source, /data-form-dirty="true"/);
assert.match(source, /前回の入力を復元できます/);
assert.match(source, /画像は復元できません。もう一度選択してください。/);
assert.match(source, /restore-form-draft/);
assert.match(source, /discard-form-draft/);
assert.match(source, /confirm-discard-form/);
assert.match(source, /closest\('\[aria-busy="true"\], \.is-busy'\)/);
assert.match(source, /persistForm\(form\)/);

const formSources = [
  'assets/app/features/specimen-intake/view.js',
  'assets/app/components/modals.js',
  'assets/app/pages/community.js',
  'assets/app/features/animals/view-editor.js',
  'assets/app/features/dashboard/editor.js',
  'assets/app/features/records/record-form-view.js',
  'assets/app/features/qr/view.js'
].map(read).join('\n');
['animal-form', 'baby-group-form', 'enclosure-form', 'topic-form', 'species-suggestion-form', 'saved-view-form', 'dashboard-widget-form'].forEach((role) => assert.match(formSources, new RegExp(`data-role="${role}"[^>]*data-draft-policy="persist"`)));
['record-form', 'nursery-event-form', 'baby-bulk-form', 'baby-promote-form', 'enclosure-event-form', 'enclosure-occupancy-form', 'qr-history-record-form', 'qr-batch-record-form', 'task-action-form'].forEach((role) => assert.match(formSources, new RegExp(`data-role="${role}"[^>]*data-draft-policy="guard"`)));
['login-form', 'registration-form', 'password-reset-form', 'external-token-form', 'live-session-form', 'report-form'].forEach((role) => assert.match(read('assets/app/pages/auth.js') + read('assets/app/components/modals.js'), new RegExp(`data-role="${role}"[^>]*data-draft-policy="none"`)));

const app = read('assets/app/app.js');
assert.match(app, /formSafety\.guard\(\s*\(\) => requestBack/);
assert.match(app, /formSafety\.guard\(\s*\(\) => navigateRoute/);
assert.match(app, /if \(action === 'apply-app-update'\) formSafety\.flush\(\)/);
assert.match(app, /formSafety\.markSubmitted/);
assert.match(app, /mutationError[\s\S]*?applyServerFieldErrors/);

console.log('UI System v4 form safety tests passed');
