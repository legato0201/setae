const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const controllerSource = read('assets/app/features/specimen-intake/species-combobox.js');
const sandbox = { module: { exports: {} }, AbortController };
vm.runInNewContext(
  `${controllerSource
    .replace('export function normalizeSpeciesSuggestion', 'function normalizeSpeciesSuggestion')
    .replace('export function createSpeciesComboboxController', 'function createSpeciesComboboxController')}
module.exports = { createSpeciesComboboxController };`,
  sandbox
);

const scheduled = [];
const updates = [];
const controller = sandbox.module.exports.createSpeciesComboboxController({
  search: () => Promise.resolve([]),
  update: (snapshot) => updates.push(snapshot),
  schedule(fn, delay) {
    scheduled.push({ fn, delay });
    return scheduled.length;
  },
  cancelSchedule() {}
});

controller.compositionStart();
['セ', 'セラ', 'セラド'].forEach((value) => {
  assert.equal(controller.input(value, { isComposing: true }), false);
});
assert.equal(scheduled.length, 0, 'IME conversion must not send intermediate catalog searches.');
controller.compositionEnd('セラドニア');
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delay, 180);

const app = read('assets/app/app.js');
const updateBody = app.match(/function updateSpeciesCombobox[\s\S]*?\n}\n\nfunction preserveRelatedSpeciesDraft/)?.[0] || '';
assert.match(updateBody, /species-combobox-listbox/);
assert.match(updateBody, /aria-activedescendant/);
assert.doesNotMatch(updateBody, /\brender\(\)/, 'Suggestions must update only the Combobox DOM.');
assert.match(app, /speciesComboboxController\.compositionStart\(\)/);
assert.match(app, /speciesComboboxController\.compositionEnd\(event\.target\.value\)/);
assert.match(app, /speciesComboboxController\.keydown\(event\.key\)/);

const primitives = read('assets/app/components/primitives.js');
assert.match(primitives, /role="combobox"/);
assert.match(primitives, /role="listbox"/);
assert.match(primitives, /role="option"/);
assert.match(primitives, /aria-autocomplete="list"/);

console.log('Species Combobox IME tests passed');
