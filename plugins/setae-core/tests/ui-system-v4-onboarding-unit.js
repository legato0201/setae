const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = read('assets/app/features/onboarding/model.js');
const context = vm.createContext({});
vm.runInContext(`${source.replace(/\bexport\s+/g, '')}\nthis.exports = { ONBOARDING_STORAGE_PREFIX, ONBOARDING_VERSION, defaultOnboardingState, normalizeOnboardingState, loadOnboardingState, saveOnboardingState, deriveOnboardingProgress, shouldShowGettingStarted, completeOnboardingIfNeeded, onboardingStorageKey };`, context);
const onboarding = context.exports;

const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};

assert.equal(onboarding.onboardingStorageKey(37), 'setae.gui.v2.onboarding.37');
assert.equal(onboarding.onboardingStorageKey('mock'), 'setae.gui.v2.onboarding.mock');
assert.deepEqual(
  JSON.parse(JSON.stringify(onboarding.saveOnboardingState(storage, 37, { dismissed: true }))),
  { version: 1, dismissed: true, completionAnnounced: false }
);
assert.equal(onboarding.loadOnboardingState(storage, 37).dismissed, true);

const empty = onboarding.deriveOnboardingProgress();
assert.deepEqual(JSON.parse(JSON.stringify(empty)), {
  collectionRegistered: false,
  firstRecordAdded: false,
  completed: 0,
  required: 2,
  complete: false
});
assert.equal(onboarding.deriveOnboardingProgress({ animals: [{ id: 1 }] }).collectionRegistered, true);
assert.equal(onboarding.deriveOnboardingProgress({ babyGroups: { items: [{ id: 2, archived: false }] } }).collectionRegistered, true);
assert.equal(onboarding.deriveOnboardingProgress({ babyGroups: { items: [{ id: 2, archived: true }] } }).collectionRegistered, false);
const complete = onboarding.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [{ id: 2, recorded_by_current_user: true }] });
assert.equal(complete.complete, true);
assert.equal(onboarding.shouldShowGettingStarted({ setupCompleted: true, onboarding: {}, progress: empty }), true);
assert.equal(onboarding.shouldShowGettingStarted({ setupCompleted: false, onboarding: {}, progress: empty }), true, 'v251 setup is optional');
assert.equal(onboarding.shouldShowGettingStarted({ setupCompleted: true, onboarding: { dismissed: true }, progress: empty }), false);
assert.equal(onboarding.shouldShowGettingStarted({ setupCompleted: true, onboarding: {}, progress: complete }), false);

const firstCompletion = onboarding.completeOnboardingIfNeeded({}, complete);
assert.equal(firstCompletion.announced, true);
assert.equal(firstCompletion.state.dismissed, true);
assert.equal(firstCompletion.state.completionAnnounced, true);
assert.equal(onboarding.completeOnboardingIfNeeded(firstCompletion.state, complete).announced, false);

const setup = read('assets/app/features/personalization/preset-view.js');
const app = read('assets/app/app.js');
const view = read('assets/app/features/onboarding/view.js');
assert.match(setup, /手順 \$\{step === 'start' \? '2' : '1'\} \/ 2/);
['setae-setup-next', 'setae-setup-back', 'setae-setup-intent', 'finish-setae-setup'].forEach((action) => assert.match(setup + app, new RegExp(action)));
['個体を登録する', 'ベビー群を登録する', '画面を見てから決める', '現在のデータから始める'].forEach((label) => assert.match(setup, new RegExp(label)));
assert.match(setup, /まだ設定は確定しません。/);
assert.match(app, /function finishSetaeSetup[\s\S]*?applyPreset\(presetId, \{ notify: false \}\)/);
assert.doesNotMatch(app.match(/if \(action === 'setae-setup-next'\)[\s\S]*?return;/)?.[0] || '', /setupCompleted/);
assert.match(view, /QRから個体を引き継ぐ/);
assert.match(view, /自分で個体を登録する/);
assert.doesNotMatch(view, /飼育スタイルを設定/);
assert.doesNotMatch(app, /state\.setupOpen = !state\.personalization\.setupCompleted/);
assert.match(view, /最初の個体またはベビー群を登録/);
assert.match(view, /最初の記録を追加/);
assert.match(view, /dismiss-onboarding/);
assert.match(read('assets/app/features/personalization/preset-view.js'), /reopen-onboarding/);
assert.doesNotMatch(setup + view, /tour|spotlight|coachmark/i);

console.log('UI System v4 onboarding tests passed');
