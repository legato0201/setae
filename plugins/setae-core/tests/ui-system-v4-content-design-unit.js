const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const terminologySource = read('assets/app/content/terminology.js');
const context = vm.createContext({});
vm.runInContext(`${terminologySource.replace(/\bexport\s+/g, '')}\nthis.exports = { recordTypeLabel, taskTypeLabel, taskOutcomeLabel, animalStatusLabel, babyStatusLabel, nurseryEventLabel, enclosureEventLabel, qrVisibilityLabel, qrTransferStatusLabel, cardModeLabel, cardDensityLabel, offlineActionLabel, countLabel, terminologyMaps };`, context);
const terms = context.exports;

assert.equal(terms.recordTypeLabel('feed'), '給餌');
assert.equal(terms.taskTypeLabel('environment'), '環境確認');
assert.equal(terms.taskOutcomeLabel('deferred'), '延期');
assert.equal(terms.animalStatusLabel('pre-molt'), '脱皮前');
assert.equal(terms.babyStatusLabel('alive'), '生存');
assert.equal(terms.nurseryEventLabel('feed'), '群給餌');
assert.equal(terms.enclosureEventLabel('substrate_change'), '床材交換');
assert.equal(terms.qrVisibilityLabel('private'), '非公開');
assert.equal(terms.qrVisibilityLabel('basic'), '基本情報を公開');
assert.equal(terms.qrVisibilityLabel('life_history'), '生活史を公開');
assert.equal(terms.qrTransferStatusLabel('pending'), '申請中');
assert.equal(terms.cardModeLabel('photo'), '写真');
assert.equal(terms.cardModeLabel('hybrid'), '写真＋情報');
assert.equal(terms.cardModeLabel('data'), 'データ');
assert.equal(terms.cardDensityLabel('compact'), 'コンパクト');
assert.equal(terms.cardDensityLabel('standard'), '標準');
assert.equal(terms.cardDensityLabel('detailed'), '詳細');
assert.equal(terms.offlineActionLabel('create_log'), '飼育記録を追加');
assert.equal(terms.offlineActionLabel('unknown_action'), '未対応の操作');
assert.equal(terms.countLabel(12), '12件');
assert.equal(terms.countLabel(8, '点'), '8点');

['feed', 'molt', 'observation', 'growth', 'pairing'].forEach((key) => assert.ok(Object.hasOwn(terms.terminologyMaps.recordTypes, key)));
['private', 'basic', 'life_history'].forEach((key) => assert.ok(Object.hasOwn(terms.terminologyMaps.qrVisibilities, key)));
['photo', 'hybrid', 'data'].forEach((key) => assert.ok(Object.hasOwn(terms.terminologyMaps.cardModes, key)));
['compact', 'standard', 'detailed'].forEach((key) => assert.ok(Object.hasOwn(terms.terminologyMaps.cardDensities, key)));
['alive', 'dead', 'rehomed', 'transferred'].forEach((key) => assert.ok(Object.hasOwn(terms.terminologyMaps.babyStatuses, key)));

const semanticConsumers = [
  'assets/app/pages/records.js',
  'assets/app/features/records/quick-record-view.js',
  'assets/app/features/specimen/model.js',
  'assets/app/features/nursery/model.js',
  'assets/app/features/nursery/code-selection.js',
  'assets/app/features/tasks/view.js',
  'assets/app/features/qr/view.js',
  'assets/app/features/collection/card-editor.js',
  'assets/app/pages/settings.js',
  'assets/app/app.js'
];
semanticConsumers.forEach((file) => assert.match(read(file), /content\/terminology\.js/, `${file} must consume shared terminology`));

const messagesSource = read('assets/app/content/messages.js');
assert.match(messagesSource, /個体を登録しました。/);
assert.match(messagesSource, /再接続後に同期します。/);
assert.match(messagesSource, /再送が必要です。/);
assert.match(messagesSource, /通信環境をご確認のうえ、もう一度お試しください。/);
assert.doesNotMatch(messagesSource, /エラーが発生しました。/);

const productSources = semanticConsumers.map(read).join('\n');
assert.doesNotMatch(productSources, />\s*(?:LAST|NEXT|RECEIVED|SENT)\s*</);
const contentDesign = read('docs/content-design-v1.0.242.md');
['正式用語', '禁止表現', '許可する英語', '件数表現', '日時表現', '成功文言', '失敗文言', '削除文言', 'オフライン文言'].forEach((heading) => {
  assert.match(contentDesign, new RegExp(heading), `Content design must document ${heading}`);
});

console.log('UI System v4 content design tests passed');
