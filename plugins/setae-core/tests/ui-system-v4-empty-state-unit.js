const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stripImports = (source) => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '');
const primitivesSource = stripImports(read('assets/app/components/primitives.js')).replace(/\bexport\s+/g, '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const context = vm.createContext({
  icon: (name) => `<svg data-icon="${name}"></svg>`,
  formatDateFieldValue: (value) => value,
  escapeHtml,
  safeHttpUrl: (value, fallback = '#') => value || fallback
});
vm.runInContext(`${primitivesSource}\nthis.exports = { emptyState };`, context);
const { emptyState } = context.exports;

const initial = emptyState('まだ個体が登録されていません', {
  description: '最初の個体を登録すると、給餌・脱皮・観察を記録できます。',
  iconName: 'collection',
  reason: 'initial',
  action: 'add-animal',
  actionLabel: '個体を登録',
  primary: true
});
assert.match(initial, /is-initial/);
assert.match(initial, /role="status"/);
assert.match(initial, /aria-labelledby="setae-empty-state-\d+-title"/);
assert.match(initial, /aria-describedby="setae-empty-state-\d+-description"/);
assert.match(initial, /data-action="add-animal"/);
assert.match(initial, /class="button primary"/);
assert.doesNotMatch(initial, /<img|illustration/i);

const filtered = emptyState('条件に一致する個体はありません', {
  reason: 'filtered',
  action: 'clear-collection-filters',
  actionLabel: '条件をクリア',
  secondaryAction: 'add-animal',
  secondaryActionLabel: '個体を登録',
  compact: true
});
assert.match(filtered, /compact is-filtered/);
assert.match(filtered, /data-action="clear-collection-filters"/);
assert.match(filtered, /data-action="add-animal"/);
assert.doesNotMatch(filtered, /class="button primary"/);

assert.match(emptyState('オフラインです', { reason: 'offline' }), /is-offline/);
assert.match(emptyState('読み込めませんでした', { reason: 'error' }), /is-error/);
assert.match(emptyState('表示できません', { reason: 'permission' }), /is-permission/);
assert.match(emptyState('完了しました', { reason: 'completed' }), /is-completed/);
assert.match(emptyState('不明', { reason: 'not-valid' }), /is-initial/);

const collection = read('assets/app/features/collection/view.js');
const records = read('assets/app/pages/records.js');
const nursery = read('assets/app/features/nursery/view.js');
const husbandry = read('assets/app/pages/husbandry.js')
  + read('assets/app/features/husbandry/enclosure-view.js')
  + read('assets/app/features/husbandry/feeder-view.js');
const today = read('assets/app/pages/today.js') + read('assets/app/features/tasks/view.js');
const qr = read('assets/app/features/qr/view.js');
const community = read('assets/app/pages/community.js');
assert.match(collection, /まだ個体が登録されていません/);
assert.match(collection, /条件に一致する個体はありません/);
assert.match(collection, /clear-collection-filters/);
assert.match(records, /まだ記録がありません/);
assert.match(records, /この種類の記録はありません/);
assert.match(records, /clear-record-filter/);
assert.match(nursery, /ベビー群はまだありません/);
assert.match(husbandry, /飼育容器はまだ登録されていません/);
assert.match(husbandry, /餌在庫はまだ登録されていません/);
assert.match(today, /今日の作業はありません/);
assert.match(today, /今日の作業は完了しました/);
assert.match(qr, /印刷する対象が選択されていません/);
assert.match(community, /'permission'/);
assert.match(community, /'filtered'/);
assert.match(community, /'error'/);
assert.match(community, /retry-community/);

console.log('UI System v4 empty state tests passed');
