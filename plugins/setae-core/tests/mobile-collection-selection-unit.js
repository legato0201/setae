const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const executable = `${read('assets/app/features/collection/state.js')}\n${read('assets/app/features/collection/interaction.js')}`
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${executable}\nthis.exports = { createCollectionSelection, toggleCollectionAnimal, setCollectionSelectionMode, collectionItemIntent };`, context);

const { createCollectionSelection, toggleCollectionAnimal, setCollectionSelectionMode, collectionItemIntent } = context.exports;
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: true, wide: false }), 'toggle-selection');
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: true, wide: true }), 'toggle-selection');
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: false, wide: false }), 'open-detail');
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: false, wide: true }), 'select-inspector');
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: false, wide: true, activation: 'double' }), 'open-detail');

let selection = setCollectionSelectionMode(createCollectionSelection(), true);
selection = toggleCollectionAnimal(selection, 101);
selection = toggleCollectionAnimal(selection, 202);
assert.deepEqual([...selection.selectedIds], ['101', '202']);
assert.equal(selection.selectionMode, true);
selection = setCollectionSelectionMode(selection, false);
assert.equal(selection.selectionMode, false);
assert.deepEqual([...selection.selectedIds], []);
assert.equal(collectionItemIntent({ collectionItem: true, selectionMode: selection.selectionMode, wide: false }), 'open-detail');

const app = read('assets/app/app.js');
const view = read('assets/app/features/collection/view.js');
assert.match(app, /collectionItemIntent\(\{[\s\S]*?selectionMode: state\.collectionSelection\.selectionMode[\s\S]*?wide: isDesktopCollection\(\)/);
assert.match(app, /intent === 'toggle-selection'[\s\S]*?toggleCollectionAnimal/);
assert.doesNotMatch(app, /hasAttribute\('data-collection-animal'\) && isDesktopCollection\(\)/);
assert.match(view, /selection\.selectionMode\s*\? renderSelectionToolbar/);
assert.match(view, /selecting = Boolean\(selection\.selectionMode\)/);
assert.match(view, /selectionMode: options\.selecting/);
assert.match(view, /0匹を選択|\$\{count\}匹を選択/);

console.log('Mobile Collection selection tests passed');
