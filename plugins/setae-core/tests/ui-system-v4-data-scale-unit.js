const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const searchSource = read('assets/app/queries/animal-search-index.js')
  .replace(/\bexport\s+/g, '')
  .concat('\nglobalThis.__api = { normalizeAnimalSearchValue, createAnimalSearchIndex, searchAnimalIndex, searchAnimalIds };');
const context = { globalThis: null, Set };
context.globalThis = context;
vm.runInNewContext(searchSource, context);
const { createAnimalSearchIndex, searchAnimalIndex } = context.__api;
const animals = [
  { id: 1, individual_code: 'Ｃ001', species_name: 'Typhochlaena seladonia', ja_name: 'セラドニア', status: 'pre_molt', tags: ['樹上'] },
  { id: 2, individual_code: 'A002', species_name: 'Latouchia typica', ja_name: 'キシノウエトタテグモ', status: 'normal' }
];
const index = createAnimalSearchIndex(animals);
assert.equal(index.entries.length, 2);
assert.equal(searchAnimalIndex(index, 'c001')[0].id, 1, 'NFKC must normalize full-width IDs');
assert.equal(searchAnimalIndex(index, 'セラドニア 脱皮').length, 0);
assert.equal(searchAnimalIndex(index, '樹上')[0].id, 1);
assert.equal(searchAnimalIndex(index, 'LATOUCHIA')[0].id, 2);

const nursery = read('assets/app/features/nursery/view.js');
const records = read('assets/app/pages/records.js');
const app = read('assets/app/app.js');
assert.match(nursery, /<table class="registry-table"/);
assert.doesNotMatch(nursery, /registry-mobile-list/);
assert.match(nursery, /items\.map\(renderNurseryRegisterRow\)/);
assert.match(records, /visible\.map\(renderRecord\)/);
assert.match(app, /createAnimalSearchIndex\(state\.animals\)/);
assert.ok(app.split('\n').length <= 5680, `app.js line budget exceeded: ${app.split('\n').length} > 5680`);

console.log('UI System v4 data scale tests passed');
