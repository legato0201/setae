const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/runtime/page-metadata.js'), 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { pageMetadata, applyPageMetadata, focusAppMain };`, context);

const { pageMetadata, applyPageMetadata, focusAppMain } = context.api;
const cases = [
  [{ page: 'today' }, '今日 | SETAE'],
  [{ page: 'animals' }, 'コレクション | SETAE'],
  [{ page: 'animal-detail', animal: { id: 14, manage_code: 'C014' } }, 'C014 | SETAE'],
  [{ page: 'records' }, '記録履歴 | SETAE'],
  [{ page: 'records', recordsView: 'qr' }, 'QR・ラベル | SETAE'],
  [{ page: 'animals', collectionTab: 'babies' }, 'ベビー群 | SETAE'],
  [{ page: 'animals', babyGroup: { id: 3, code_range: 'B001–B084' } }, 'B001–B084 | SETAE'],
  [{ page: 'husbandry', enclosure: { id: 4, code: 'T-04' } }, 'T-04 | SETAE'],
  [{ page: 'settings' }, '設定 | SETAE'],
  [{ page: 'community', communityView: 'species' }, '交流 | SETAE']
];
cases.forEach(([input, title]) => assert.equal(pageMetadata(input).title, title));
assert.match(pageMetadata({ page: 'animal-detail', animal: { manage_code: 'C014', species_name: 'Latouchia typica' } }).announcement, /C014/);

const announcer = { textContent: '' };
const main = {
  focusOptions: null,
  focus(options) { this.focusOptions = options; documentRef.activeElement = this; }
};
const documentRef = {
  title: '',
  activeElement: null,
  querySelector(selector) { return selector === '[data-app-route-announcer]' ? announcer : selector === '#setae-main-content' ? main : null; }
};
const metadata = pageMetadata({ page: 'animals' });
applyPageMetadata(metadata, { documentRef });
assert.equal(documentRef.title, 'コレクション | SETAE');
assert.equal(announcer.textContent, 'コレクションを表示しました');
applyPageMetadata(pageMetadata({ page: 'today' }), { documentRef, announce: false });
assert.equal(announcer.textContent, 'コレクションを表示しました', 'non-route updates must not announce');
assert.equal(focusAppMain({ documentRef }), true);
assert.equal(main.focusOptions.preventScroll, true);

const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
assert.match(app, /const routeChanged = metadata\.key !== lastPageMetadataKey/);
assert.match(app, /applyPageMetadata\(metadata, \{ announce: routeChanged \}\)/);
assert.match(app, /routeChanged && pendingPageFocus/);

console.log('UI System v4 page metadata tests passed');
