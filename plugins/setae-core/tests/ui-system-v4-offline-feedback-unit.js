const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

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

async function verifyMobileSyncPresentation() {
  const frame = await import(pathToFileURL(path.join(root, 'assets/app/components/app-frame.js')).href);
  const cases = [
    [{ pendingSyncCount: 2, syncStatus: 'pending' }, '同期待ち 2件 · 確認', '同期待ち 2件。同期状況を確認', false],
    [{ pendingSyncCount: 9, syncFailedCount: 3, syncStatus: 'error' }, '未同期 3件 · 確認', '3件未同期。同期状況を確認', false],
    [{ syncStatus: 'error' }, '同期失敗 · 確認', '同期に失敗しました。同期状況を確認', false],
    [{ pendingSyncCount: 1234, syncStatus: 'error' }, '未同期 99+件 · 確認', '1234件未同期。同期状況を確認', false],
    [{ pendingSyncCount: 4, syncStatus: 'syncing' }, '同期中 4件', '4件を同期中', true],
    [{ online: false, pendingSyncCount: 5 }, 'オフライン · 5件待ち · 確認', 'オフライン · 同期待ち 5件。同期状況を確認', false],
    [{ online: false }, 'オフライン · 確認', 'オフライン。同期状況を確認', false]
  ];
  for (const [options, label, accessibleLabel, busy] of cases) {
    const html = frame.renderMobileAppBar({ authenticated: true, ...options });
    assert.match(html, /class="mobile-app-sync" role="status" aria-live="polite" aria-atomic="true"/);
    const control = html.match(/<button\b[^>]*class="[^"]*mobile-sync-button[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(control, `Missing sync control: ${label}`);
    assert.ok(control.includes(`<span>${label}</span>`), 'The visible status stays concise.');
    assert.ok(control.includes(`aria-label="${accessibleLabel}"`), 'The accessible label preserves full counts and action intent.');
    assert.match(control, /data-nav="settings"/);
    assert.match(control, /data-settings-tab="integrations"/);
    assert.equal(/\sdisabled(?:\s|>)/.test(control), busy, 'Only active synchronization keeps the existing busy lock.');
  }
  assert.doesNotMatch(frame.renderMobileAppBar({ authenticated: true }), /mobile-app-sync/,
    'An idle connected account does not reserve an empty status row.');
  assert.doesNotMatch(frame.renderMobileAppBar({ pendingSyncCount: 7, syncStatus: 'error' }), /mobile-app-sync|件未同期/,
    'A public page must not reveal a previous authenticated queue.');
  assert.match(frame.renderAppRail({ authenticated: true, pendingSyncCount: 1234 }), /同期待ち 1234件/,
    'Desktop status retains the complete count.');
  const frameCss = read('assets/app/styles/app-frame.css');
  assert.doesNotMatch(frameCss, /\.mobile-sync-button\s*\{[^}]*display:\s*none/s,
    'Do not hide pending or failed synchronization at narrow widths.');
  console.log('UI System v4 offline feedback tests passed (queue ownership and seven mobile sync states)');
}

verifyMobileSyncPresentation().catch(error => { console.error(error); process.exitCode = 1; });
