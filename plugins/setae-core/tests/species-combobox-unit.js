const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('assets/app/features/specimen-intake/species-combobox.js');
const sandbox = { module: { exports: {} }, AbortController };
vm.runInNewContext(
  `${source
    .replace('export function normalizeSpeciesSuggestion', 'function normalizeSpeciesSuggestion')
    .replace('export function createSpeciesComboboxController', 'function createSpeciesComboboxController')}
module.exports = { createSpeciesComboboxController, normalizeSpeciesSuggestion };`,
  sandbox
);

const { createSpeciesComboboxController } = sandbox.module.exports;

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function run() {
  const scheduled = [];
  const updates = [];
  const selections = [];
  const searches = [];
  const controller = createSpeciesComboboxController({
    search(query, options) {
      searches.push({ query, options });
      return Promise.resolve([
        { id: 12, ja_name: 'セラドニア', scientific_name: 'Typhochlaena seladonia', genus: 'Typhochlaena' },
        { id: 13, ja_name: '', scientific_name: 'Typhochlaena sp.', genus: 'Typhochlaena' }
      ]);
    },
    update: (snapshot) => updates.push(snapshot),
    onSelect: (item) => selections.push(item),
    schedule(fn, delay) {
      const task = { fn, delay, cancelled: false };
      scheduled.push(task);
      return task;
    },
    cancelSchedule(task) {
      if (task) task.cancelled = true;
    }
  });

  assert.equal(controller.input('セラ'), true);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 180, 'Species search must debounce for 180ms by default.');
  assert.equal(searches.length, 0);
  scheduled[0].fn();
  await flush();

  assert.equal(searches[0].query, 'セラ');
  assert.equal(searches[0].options.limit, 8);
  assert.equal(searches[0].options.signal instanceof AbortSignal, true);
  assert.equal(controller.getSnapshot().items.length, 2);
  assert.equal(controller.getSnapshot().activeIndex, 0);
  assert.equal(controller.keydown('ArrowDown'), true);
  assert.equal(controller.getSnapshot().activeIndex, 1);
  assert.equal(controller.keydown('ArrowUp'), true);
  assert.equal(controller.getSnapshot().activeIndex, 0);
  assert.equal(controller.keydown('Enter'), true);
  assert.equal(selections[0].id, 12);
  assert.equal(controller.getSnapshot().open, false);

  const pending = [];
  const cancellationController = createSpeciesComboboxController({
    search(query, { signal }) {
      return new Promise((resolve) => pending.push({ query, signal, resolve }));
    },
    schedule(fn) {
      fn();
      return 1;
    },
    cancelSchedule() {}
  });
  cancellationController.input('T');
  assert.equal(pending.length, 1);
  cancellationController.input('Ty');
  assert.equal(pending[0].signal.aborted, true, 'A later query must abort the previous request.');
  assert.equal(pending.length, 2);
  pending[1].resolve([]);
  await flush();

  const view = read('assets/app/features/specimen-intake/view.js');
  const modals = read('assets/app/components/modals.js');
  const app = read('assets/app/app.js');
  const services = read('assets/app/api/services.js');
  assert.match(view, /comboboxField\(/);
  assert.doesNotMatch(view, /<select[^>]+name=["']species_id/i);
  assert.doesNotMatch(modals, /function animalForm\(/);
  assert.match(modals, /catalogSpeciesField\(modal,/);
  assert.match(modals, /fieldName: 'species_id', label: '図鑑の種'/);
  assert.match(modals, /fieldName: 'related_species_id', label: '関連する種'/);
  assert.doesNotMatch(modals, /<select[^>]+name=["'](?:species_id|related_species_id)/i);
  assert.match(services, /suggestions\(q, \{ limit = 8, signal \}/);
  const intakeActions = app.match(/if \(action === 'edit-collection-animal'\)[\s\S]*?if \(action === 'favorite-animal'\)/)?.[0] || '';
  assert.doesNotMatch(intakeActions, /loadSpeciesOptions\(/, 'Opening Specimen Intake must not preload the complete catalog.');
  assert.match(intakeActions, /openSpecimenIntake\(/);
  assert.doesNotMatch(app, /function loadSpeciesOptions\(/, 'No modal should preload the complete species catalog.');
  assert.doesNotMatch(app, /speciesOptions/, 'Legacy species option state should be retired.');
  assert.match(app, /onSelect: selectModalSpecies/);

  console.log('Species Combobox tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
