const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('assets/app/offline/queue.js').replace(/\bexport\s+/g, '');
const context = vm.createContext({ Date, JSON, Math, Number, String, Array, Set });
vm.runInContext(`${source}\nthis.exports = { OFFLINE_QUEUE_STORAGE_PREFIX, OFFLINE_QUEUE_LEGACY_KEY, createOfflineQueue };`, context);
const { createOfflineQueue } = context.exports;

const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
let timestamp = 1_000;
let id = 0;
const queue = createOfflineQueue({
  storage,
  now: () => timestamp++,
  cryptoApi: { randomUUID: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` }
});

assert.throws(() => queue.enqueue('create_log', 1, {}), /ログインユーザーを確認できない/);
queue.setOwner(37);
const queued = queue.enqueue('create_log', 14, { type: 'feed' });
assert.equal(queued.owner_id, 37);
assert.equal(queue.list().length, 1);
assert.ok(values.has('setae.gui.v2.offlineQueue.37'));
queue.setOwner(99);
assert.equal(queue.list().length, 0);
queue.enqueue('save_task_action', 5, {});
assert.equal(queue.list().length, 1);
queue.setOwner(37);
assert.equal(queue.list().length, 1);
assert.equal(queue.list()[0].entity_id, 14);
queue.remove([queued.operation_id]);
assert.equal(queue.list().length, 0);

values.set('setae.gui.v2.offlineQueue', JSON.stringify([{ action: 'legacy' }]));
const ownerResult = queue.setOwner(37);
assert.equal(ownerResult.discardedLegacyCount, 1);
assert.equal(values.has('setae.gui.v2.offlineQueue'), false);

const appFrame = read('assets/app/components/app-frame.js');
const settings = read('assets/app/pages/settings.js');
const app = read('assets/app/app.js');
const messages = read('assets/app/content/messages.js');
['idle', 'offline', 'pending', 'syncing', 'error'].forEach((status) => assert.match(app, new RegExp(`['"]${status}['"]`)));
assert.match(appFrame, /オフライン/);
assert.match(appFrame, /同期待ち/);
assert.match(appFrame, /同期中/);
assert.match(appFrame, /件未同期/);
assert.match(appFrame, /desktopSync/);
assert.match(appFrame, /操作はこの端末に保存し、再接続後に同期します。/);
assert.match(messages, /オフラインで保存しました。再接続後に同期します。/);
assert.match(messages, /同期しました。\$\{countLabel\(failed\)\}は再送が必要です。/);
assert.match(settings, /offlineActionLabel\(item\.action\)/);
assert.match(settings, /<details><summary>詳細<\/summary><code>\$\{escapeHtml\(item\.action\)\}<\/code><code>\$\{escapeHtml\(item\.operation_id\)\}<\/code><\/details>/);
assert.doesNotMatch(settings, /<strong>\$\{escapeHtml\(item\.operation_id\)\}/);
assert.match(app, /window\.addEventListener\('online'/);
assert.match(app, /syncPartialMessage/);

console.log('UI System v4 offline feedback tests passed');
