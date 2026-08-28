const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appFrame = read('assets/app/components/app-frame.js');
const primitives = read('assets/app/components/primitives.js');

assert.equal((appFrame.match(/<main\b/g) || []).length, 1, 'App Frame must own the only authenticated main landmark');
assert.match(appFrame, /<a class="skip-link" href="#setae-main-content">メインコンテンツへ移動<\/a>/);
assert.match(appFrame, /<main id="setae-main-content" class="main app-workspace" tabindex="-1" data-app-main>/);
assert.match(appFrame, /data-app-route-announcer aria-live="polite" aria-atomic="true"/);
assert.match(appFrame, /aria-label="メインナビゲーション"/);
assert.match(appFrame, /aria-label="コレクション保存ビュー"/);
assert.match(appFrame, /aria-label="モバイルナビゲーション"/);

[
  'assets/app/pages/husbandry.js',
  'assets/app/pages/records.js',
  'assets/app/pages/settings.js',
  'assets/app/features/specimen/view.js'
].forEach((file) => assert.doesNotMatch(read(file), /<main\b/, `${file} must not nest a main landmark`));

const executable = primitives
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {
  icon: () => '',
  escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ''),
  safeHttpUrl: (value) => String(value || '')
};
vm.createContext(context);
vm.runInContext(`${executable}\nthis.api = { tabs, tabPanel };`, context);
const items = [{ id: 'overview', label: '概要' }, { id: 'photos', label: '写真' }];
const tabs = context.api.tabs(items, {
  activeId: 'photos',
  action: 'specimen-tab',
  dataKey: 'tab',
  label: '個体タブ',
  idPrefix: 'specimen',
  panelId: 'specimen-panel'
});
const panel = context.api.tabPanel('PHOTO', {
  id: 'specimen-panel',
  idPrefix: 'specimen',
  activeId: 'photos'
});
assert.match(tabs, /role="tablist" aria-label="個体タブ"/);
assert.equal((tabs.match(/role="tab"/g) || []).length, 2);
assert.equal((tabs.match(/aria-selected="true"/g) || []).length, 1);
assert.equal((tabs.match(/tabindex="0"/g) || []).length, 1);
assert.match(tabs, /id="specimen-tab-photos"[^>]*aria-controls="specimen-panel"/);
assert.doesNotMatch(tabs, /aria-current/);
assert.match(panel, /role="tabpanel"/);
assert.match(panel, /id="specimen-panel"/);
assert.match(panel, /aria-labelledby="specimen-tab-photos"/);

console.log('UI System v4 semantic landmark tests passed');
