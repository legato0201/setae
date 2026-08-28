const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('assets/app/components/feedback-controller.js').replace(/\bexport\s+/g, '');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.exports = { DEFAULT_TOAST_DURATION, ACTION_TOAST_DURATION, normalizeToast, createFeedbackController };`, context);
const feedback = context.exports;

assert.equal(feedback.normalizeToast('保存しました').duration, 3200);
assert.equal(feedback.normalizeToast('削除しました', { actionLabel: '元に戻す', action: 'undo' }).duration, 6000);

let clock = 1_000;
let pending = null;
let changes = [];
let actionData = null;
const controller = feedback.createFeedbackController({
  now: () => clock,
  setTimer: (handler, delay) => { pending = { handler, delay }; return 1; },
  clearTimer: () => { pending = null; },
  onChange: (value) => changes.push(value)
});

controller.show('保存した絞り込みを削除しました。', {
  type: 'success',
  actionLabel: '元に戻す',
  action: 'undo-local-change',
  data: { id: 'view-1' },
  onAction: (data) => { actionData = data; }
});
assert.equal(controller.value.action, 'undo-local-change');
assert.equal(pending.delay, 6000);
clock += 2_000;
controller.pause();
assert.equal(controller.remaining, 4000);
assert.equal(pending, null);
controller.resume();
assert.equal(pending.delay, 4000);
controller.runAction();
assert.deepEqual(JSON.parse(JSON.stringify(actionData)), { id: 'view-1' });
assert.equal(controller.value, null);

controller.show('最初', { actionLabel: '元に戻す', action: 'undo' });
const firstId = controller.value.id;
controller.show('次', { actionLabel: '元に戻す', action: 'undo' });
assert.ok(controller.value.id > firstId);
controller.dismiss();
assert.equal(controller.value, null);
assert.equal(changes.at(-1), null);

const primitives = read('assets/app/components/primitives.js');
assert.match(primitives, /export function toast\(message, \{ type = 'default', actionLabel = '', action = '', data = \{\}, dismissAction = 'dismiss-toast' \}/);
assert.match(primitives, /run-toast-action/);
assert.match(primitives, /dismiss-toast/);
assert.match(primitives, /aria-live/);

const app = read('assets/app/app.js');
['保存した絞り込みを削除しました。', '今日の画面から項目を削除しました。', '今日の画面から区分を削除しました。', 'カード表示を初期設定に戻しました。', '個別ルールを解除しました。', '容器の個別ルールを解除しました。', 'ベビー群の個別ルールを解除しました。', 'を適用しました。'].forEach((message) => assert.match(app, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
assert.match(app, /showUndoToast/);
assert.match(app, /persistUiPreferences/);
assert.match(app, /confirmPhrase:\s*code/);
assert.match(app, /confirmPhrase:\s*groupName/);
assert.match(app, /confirmButton\.setAttribute\('aria-disabled', confirmButton\.disabled \? 'true' : 'false'\)/);
assert.match(app, /個体の最終給餌日・脱皮日などを残りの履歴から再計算します/);
const permanentDeleteBlocks = [
  app.match(/if \(action === 'delete-animal'\)[\s\S]*?return;/)?.[0] || '',
  app.match(/if \(action === 'delete-baby-group'\)[\s\S]*?return;/)?.[0] || ''
].join('\n');
assert.doesNotMatch(permanentDeleteBlocks, /showUndoToast/);

console.log('UI System v4 undo and feedback tests passed');
