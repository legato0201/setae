const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/features/navigation/controller.js'), 'utf8')
  .replace(/export\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`${source}\nthis.resolveBackPriority = resolveBackPriority;`, context);
const resolve = context.resolveBackPriority;

assert.equal(resolve({ menuOpen: true, modalOpen: true, sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-menu');
assert.equal(resolve({ modalOpen: true, sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-modal');
assert.equal(resolve({ sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-sheet');
assert.equal(resolve({ selectionMode: true, nestedRoute: true }), 'exit-selection');
assert.equal(resolve({ nestedRoute: true }), 'nested-route');
assert.equal(resolve({}), 'history');

const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
assert.match(app, /async function requestBack/);
assert.match(app, /action === 'close-modal'\) closeModalForBack\(\)/);
assert.match(app, /action === 'exit-selection'\)\s*\{[\s\S]*?state\.collectionSelection = clearCollectionSelection/);
assert.match(app, /action === 'back-animals'\) \{ await requestBack\(\)/);
assert.match(app, /window\.addEventListener\('popstate',[\s\S]*?requestBack\(\{ fromPopstate: true/);

console.log('Mobile back policy tests passed');
