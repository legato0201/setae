const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const moduleBody = (file) => read(file)
  .replace(/^import[\s\S]*?;\r?\n/gm, '')
  .replace(/\bexport\s+/g, '');
const probes = { filters: [], results: [], inspectors: [], appends: [] };
let appendResult = true;

// View rendering and DOM-prefix validation have their own production-view tests.
// Keep those collaborators observable here to test the workspace transaction.
const sandbox = vm.createContext({
  filterCollectionAnimals(options) {
    probes.filters.push(options);
    const minimum = Number(options.activeView?.query?.minimum || 0);
    return options.animals.filter((animal) => animal.id >= minimum
      && (!options.search || animal.name.includes(options.search)));
  },
  renderCollectionSearchResults(options) {
    probes.results.push(options);
    return `results:${options.search}:${options.listWindow.limit}`;
  },
  renderCollectionInspector(animal) {
    probes.inspectors.push(animal);
    return `inspector:${animal?.id || 'none'}`;
  },
  appendCollectionWindow(appRoot, options) {
    probes.appends.push({ appRoot, options });
    return appendResult;
  },
  button: () => '',
  escapeHtml: (value) => String(value)
});
vm.runInContext([
  'assets/app/components/progressive-list.js',
  'assets/app/features/collection/list-window.js',
  'assets/app/features/collection/state.js',
  'assets/app/features/collection/workspace-controller.js'
].map(moduleBody).join('\n') + '\nthis.api = { createCollectionWorkspaceController, createCollectionWindow };', sandbox);
const { createCollectionWorkspaceController, createCollectionWindow } = sandbox.api;
const plain = (value) => JSON.parse(JSON.stringify(value));
const builtInViews = [
  { id: 'all', title: 'すべて', query: {} },
  { id: 'upper', title: '後半', query: { minimum: 101 } }
];
const savedView = { id: 'saved', title: '保存した条件', query: { minimum: 51 } };
const transientView = { id: 'dashboard', title: '今日の対象', query: { minimum: 201 } };
const animals = Array.from({ length: 240 }, (_, index) => ({
  id: index + 1,
  name: `${index % 2 ? 'even' : 'odd'} specimen ${index + 1}`
}));
let current = {
  animals, animalSearch: '', animalSearchIndex: { fixture: 'index' },
  animalView: 'table', animalCardConfig: { density: 'compact' },
  savedAnimalViews: [savedView], activeAnimalViewId: 'all', transientAnimalView: null,
  collectionSelection: { selectedId: '230', selectedIds: ['230', '240'], selectionMode: true },
  collectionWindow: createCollectionWindow()
};
let tasks = [{ targetId: 1 }];
const input = { value: '', selectionStart: 0, selectionEnd: 0 };
const clearSearch = { hidden: true };
let resultWrites = 0;
let resultHtml = '';
const results = {
  get innerHTML() { return resultHtml; },
  set innerHTML(value) { resultWrites += 1; resultHtml = value; }
};
let inspectorWrites = 0;
const inspector = { set innerHTML(value) { inspectorWrites += 1; this.html = value; } };
const selectionClasses = [];
const workspace = { classList: { toggle: (...args) => selectionClasses.push(args) } };
let mounted = true;
const appRoot = {
  set innerHTML(_value) { assert.fail('Collection updates must preserve the app and input DOM'); },
  replaceChildren() { assert.fail('Collection updates must not replace the app'); },
  querySelector(selector) {
    if (!mounted) return null;
    return {
      '[data-role="animal-search"]': input,
      '[data-action="clear-collection-search"]': clearSearch,
      '[data-role="collection-results-body"]': results,
      '[data-role="collection-inspector"]': inspector,
      '.collection-workbench-v4': workspace
    }[selector] || null;
  }
};
const controller = createCollectionWorkspaceController({
  appRoot, getState: () => current, builtInViews, getCareTasks: () => tasks
});

assert.strictEqual(controller.activeView(), builtInViews[0]);
current.activeAnimalViewId = 'saved';
assert.strictEqual(controller.activeView(), savedView);
current.transientAnimalView = transientView;
current.activeAnimalViewId = 'dashboard';
assert.strictEqual(controller.activeView(), transientView);
current.activeAnimalViewId = 'missing';
assert.strictEqual(controller.activeView(), builtInViews[0], 'Unknown saved views retain the existing all-view fallback');
current.activeAnimalViewId = 'all';

const initial = controller.currentWindow();
assert.deepEqual([initial.initial, initial.step, initial.limit], [50, 50, 50]);
const initialKey = initial.queryKey;
assert.equal(controller.filteredAnimals().length, 240, 'Filtered animals means the whole query, never the visible window');
assert.strictEqual(probes.filters.at(-1).searchIndex, current.animalSearchIndex);
assert.strictEqual(probes.filters.at(-1).careTasks, tasks);

assert.equal(controller.appendWindow(), true);
assert.equal(controller.currentWindow().limit, 100);
assert.equal(controller.appendWindow(), true);
assert.equal(controller.currentWindow().limit, 150, 'Repeated append retains the query key instead of resetting to 50');
assert.equal(current.collectionWindow.queryKey, initialKey);
assert.equal(resultWrites, 0, 'Append delegates to the DOM-preserving view path, not a results replacement');
assert.equal(inspectorWrites, 0, 'Append must not replace the inspector');
assert.strictEqual(probes.appends.at(-1).appRoot, appRoot);
assert.strictEqual(probes.appends.at(-1).options.animals, animals);
assert.deepEqual(plain(current.collectionSelection.selectedIds), ['230', '240']);

current.animalView = 'gallery';
current.animalCardConfig = { density: 'comfortable' };
current.collectionSelection = { selectedId: '240', selectedIds: ['240'], selectionMode: false };
assert.equal(controller.renderOptions().listWindow.limit, 150, 'Display, density, and selection changes preserve the expanded window');
assert.equal(controller.renderOptions().mode, 'gallery');
assert.strictEqual(controller.renderOptions().selection, current.collectionSelection);
assert.strictEqual(controller.renderOptions().cardConfig, current.animalCardConfig);
current.animals = [...animals, { id: 241, name: 'odd specimen 241' }];
tasks = [{ targetId: 241 }];
assert.equal(controller.currentWindow().limit, 150, 'Refreshing data or care tasks does not reset the same query');
assert.strictEqual(controller.renderOptions().careTasks, tasks);

current.activeAnimalViewId = 'saved';
assert.equal(controller.currentWindow().limit, 50, 'Changing the active view resets the visible window');
controller.appendWindow();
assert.equal(controller.currentWindow().limit, 100);
savedView.title = '表示名だけ変更';
assert.equal(controller.currentWindow().limit, 100, 'A saved-view title is not a query change');
savedView.query = { minimum: 81 };
assert.equal(controller.currentWindow().limit, 50, 'Editing the current view query resets its window even with the same id');
controller.appendWindow();
assert.equal(controller.currentWindow().limit, 100);

current.collectionSelection = { selectedId: '230', selectedIds: ['80', '230', '240'], selectionMode: true };
input.value = 'even';
input.selectionStart = input.selectionEnd = 4;
controller.updateSearch('even');
assert.equal(current.animalSearch, 'even');
assert.equal(current.activeAnimalViewId, 'saved');
assert.equal(controller.currentWindow().limit, 50);
assert.equal(controller.filteredAnimals().length, 80);
assert.deepEqual(plain(current.collectionSelection.selectedIds), ['230', '240'], 'Offscreen matches remain selected; only non-matches are removed');
assert.equal(current.collectionSelection.selectedId, '230');
assert.equal(clearSearch.hidden, false);
assert.equal(probes.inspectors.at(-1).id, 230, 'The inspector can retain a selected specimen beyond the visible 50');
assert.deepEqual(selectionClasses.at(-1), ['is-selecting', true]);
assert.strictEqual(appRoot.querySelector('[data-role="animal-search"]'), input);
assert.deepEqual([input.value, input.selectionStart, input.selectionEnd], ['even', 4, 4]);
assert.equal(probes.results.at(-1).animals.length, 241, 'The renderer receives all source data for correct total and whole-query selection');
assert.equal(probes.results.at(-1).listWindow.limit, 50);

controller.appendWindow();
assert.equal(controller.currentWindow().limit, 80, 'Final append is capped by the full filtered result count');
controller.updateSearch('even');
assert.equal(controller.currentWindow().limit, 80, 'Recommitting an unchanged query retains the expanded window');
controller.updateSearch('no matching specimen');
assert.equal(controller.currentWindow().limit, 50);
assert.equal(controller.filteredAnimals().length, 0);
assert.deepEqual(plain(current.collectionSelection.selectedIds), []);
assert.equal(probes.inspectors.at(-1), null);
controller.updateSearch('');
assert.equal(current.activeAnimalViewId, 'saved', 'Clearing search must not clear a saved view');
assert.equal(clearSearch.hidden, true);

const restoredWindow = { ...controller.currentWindow(), limit: 150 };
current = { ...current, collectionWindow: createCollectionWindow(restoredWindow), animalView: 'table' };
assert.equal(controller.currentWindow().limit, 150, 'A restored route retains its compatible window through getState');
const writesBeforeAppend = resultWrites;
appendResult = false;
assert.equal(controller.appendWindow(), false, 'A stale DOM prefix propagates failure so app wiring can render the fallback');
assert.equal(resultWrites, writesBeforeAppend, 'The controller does not silently replace DOM on failed append');
mounted = false;
assert.doesNotThrow(() => controller.updateSearch('odd'), 'Search remains safe when collection islands are not mounted');
assert.equal(current.animalSearch, 'odd');

const app = read('assets/app/app.js');
assert.match(app, /function activeCollectionView\(\)\s*\{\s*return collectionWorkspace\.activeView\(\);\s*\}/);
assert.match(app, /function visibleCollectionAnimals\(\)\s*\{\s*return collectionWorkspace\.filteredAnimals\(\);\s*\}/);
const selectAllAction = app.match(/if \(action === 'toggle-collection-select-all'\)[\s\S]*?\n  }/)?.[0] || '';
assert.match(selectAllAction, /visibleCollectionAnimals\(\)\.map/);
assert.doesNotMatch(selectAllAction, /\.slice\(|collectionWindow|visibleListItems/, 'Select-all must use the complete matching query');
assert.match(app, /collectionWindow:\s*collectionWorkspace\.currentWindow\(\)/);
assert.match(app, /collectionWindow:\s*\{ \.\.\.state\.collectionWindow \}/);
assert.match(app, /state\.collectionWindow = createCollectionWindow\(context\.collectionWindow\)/);
const appendAction = app.match(/if \(action === 'show-more-collection'\)[\s\S]*?\n  }/)?.[0] || '';
assert.match(appendAction, /collectionWorkspace\.appendWindow\(\)/);
assert.match(appendAction, /render\(\{ preservePage: appended \}\)/);
assert.match(appendAction, /replaceRoute\(captureRoute\(scrollY\)\)/);
assert.match(appendAction, /restoreProgressiveListFocus\(app, action, 'collection-progressive-footer', scrollY\)/);
console.log('Collection window controller unit tests passed');
