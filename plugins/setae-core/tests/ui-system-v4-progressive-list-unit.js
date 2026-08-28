const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('assets/app/components/progressive-list.js')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/\bexport\s+/g, '')
  .concat('\nglobalThis.__api = { createListWindow, visibleListItems, extendListWindow, resetListWindow, clampListWindow, renderProgressiveListFooter };');
const context = {
  button: (label, options) => `<button data-action="${options.action}">${label}</button>`,
  escapeHtml: (value) => String(value),
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.__api;

const initial = api.createListWindow();
assert.equal(initial.limit, 100);
assert.equal(initial.step, 100);
assert.equal(api.visibleListItems(Array.from({ length: 1000 }), initial).length, 100);
const extended = api.extendListWindow(initial, 1000);
assert.equal(extended.limit, 200);
assert.equal(api.visibleListItems(Array.from({ length: 1000 }), extended).length, 200);
assert.equal(api.resetListWindow(extended).limit, 100);
assert.equal(api.clampListWindow({ ...extended, limit: 500 }, 121).limit, 121);
assert.match(api.renderProgressiveListFooter({ visible: 100, total: 1000, action: 'more' }), /100 \/ 1,000件を表示/);
assert.match(api.renderProgressiveListFooter({ visible: 100, total: 1000, action: 'more' }), /aria-live="polite"/);

const records = read('assets/app/pages/records.js');
const nursery = read('assets/app/features/nursery/view.js');
const app = read('assets/app/app.js');
assert.match(records, /visibleListItems\(filtered, listWindow\)/);
assert.match(records, /show-more-records/);
assert.match(records, /appendRecordsWindow/);
assert.match(nursery, /visibleListItems\(items, registerWindow\)/);
assert.match(nursery, /show-more-nursery-items/);
assert.match(nursery, /appendNurseryRegisterWindow/);
assert.doesNotMatch(nursery, /renderDesktopRegister|renderMobileRegister/);
assert.match(app, /recordsWindow:\s*createListWindow\(\)/);
assert.match(app, /recordsWindow:\s*\{ \.\.\.state\.recordsWindow \}/);
assert.match(app, /nurseryRegisterWindow:\s*\{ \.\.\.state\.nurseryRegisterWindow \}/);

console.log('UI System v4 progressive list tests passed');
