const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('assets/app/app.js');
const overlayController = read('assets/app/components/overlay-controller.js');
const asyncState = read('assets/app/components/async-state.js');
const primitives = read('assets/app/components/primitives.js');
const modals = read('assets/app/components/modals.js');
const components = read('assets/app/styles/components.css');
const updateNotice = read('assets/app/styles/components/update-notice.css');
const tokens = read('assets/app/styles/tokens.css');
const quickRecord = read('assets/app/features/records/record-form-view.js');
const intake = read('assets/app/features/specimen-intake/view.js');
const collection = read('assets/app/features/collection/dialog.js');

const executablePrimitives = primitives
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {
  icon: () => '<svg aria-hidden="true"></svg>',
  escapeHtml: (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;'),
  safeHttpUrl: (value) => String(value || '')
};
vm.createContext(context);
vm.runInContext(`${executablePrimitives}\nthis.testExports = { modal, sheet };`, context);

const busyModal = context.testExports.modal('<form><input><select></select><textarea></textarea><button type="submit">保存</button></form>', {
  busy: true,
  busyLabel: '個体を保存しています…',
  backdropAction: 'close-modal'
});
assert.match(busyModal, /class="modal is-busy"/);
assert.match(busyModal, /aria-busy="true"/);
assert.match(busyModal, /class="dialog-busy-shield"/);
assert.match(busyModal, /role="status" aria-live="polite"/);
assert.match(busyModal, /個体を保存しています…/);
assert.doesNotMatch(busyModal, /data-action="close-modal"/);
assert.doesNotMatch(busyModal, /data-backdrop-action="close-modal"/);

const idleModal = context.testExports.modal('<p>確認</p>', { backdropAction: 'close-modal' });
assert.doesNotMatch(idleModal, /is-busy|dialog-busy-shield|aria-busy="true"/);
assert.match(idleModal, /data-overlay-backdrop/);
assert.match(idleModal, /data-backdrop-action="close-modal"/);
assert.doesNotMatch(idleModal, /data-action="close-modal"/);

const busySheet = context.testExports.sheet('<form><input><button>戻る</button></form>', {
  busy: true,
  busyLabel: '記録を保存しています…',
  backdropAction: 'close-sheet',
  panelData: true
});
assert.match(busySheet, /class="sheet is-busy"/);
assert.match(busySheet, /aria-busy="true"/);
assert.match(busySheet, /data-sheet/);
assert.doesNotMatch(busySheet, /data-action="close-sheet"/);
assert.doesNotMatch(busySheet, /data-backdrop-action="close-sheet"/);

assert.match(asyncState, /querySelectorAll\('input, select, textarea, button'\)/);
assert.match(asyncState, /disabled:\s*control\.disabled/);
assert.match(asyncState, /controls\.forEach\(\(control\) => \{[\s\S]*?control\.disabled = true/);
assert.match(asyncState, /control\.disabled = disabled/);
assert.match(asyncState, /button-spinner[\s\S]*?aria-hidden="true"/);
assert.match(asyncState, /export function setDialogPending/);
assert.match(asyncState, /export function captureFormState/);
assert.match(asyncState, /export function restoreFormState/);
assert.match(asyncState, /\.modal\.is-busy\[aria-busy="true"\], \.sheet\.is-busy\[aria-busy="true"\]/);

assert.match(modals, /disabled:\s*busy/);
assert.match(modals, /busyLabel:\s*content\.busyLabel \|\| modalBusyLabel\(modal\)/);
assert.match(modals, /backdropAction:\s*'close-modal'/);
assert.match(intake, /iconButton\('close',[\s\S]*?disabled:\s*busy/);
assert.match(intake, /button\('個体を削除',[\s\S]*?disabled:\s*busy/);
assert.match(intake, /button\('キャンセル',[\s\S]*?disabled:\s*busy/);
assert.match(intake, /loading:\s*busy, disabled:\s*busy/);
assert.match(collection, /busy:\s*submitting/);
assert.match(collection, /disabled:\s*submitting/);

assert.match(quickRecord, /return sheet\(content/);
assert.match(quickRecord, /const busy = Boolean\(quickRecord\.submitting\)/);
assert.match(quickRecord, /disabled:\s*busy/);
assert.match(quickRecord, /loading:\s*busy/);
assert.match(quickRecord, /busyLabel:\s*'記録を保存しています…'/);
assert.match(quickRecord, /backdropAction:\s*'close-sheet'/);

assert.match(app, /if \(!route \|\| form\.dataset\.pending === 'true'\) return/);
assert.match(app, /setFormPending\(form, true/);
assert.match(app, /setDialogPending\(panel, true/);
assert.match(app, /syncBusyDialogControls\(app\)/);
assert.match(app, /busyBlockedActions[\s\S]*?'close-modal'[\s\S]*?'close-sheet'[\s\S]*?'close-quick-record'[\s\S]*?'back-record-types'/);
assert.match(overlayController, /if \(event\.key === 'Escape'\) \{[\s\S]*?requestClose\(panel\)/);
assert.match(overlayController, /if \(!panel \|\| isBusyOverlay\(panel\)\) return false/);
assert.match(app, /const replacement = role \? app\.querySelector/);
assert.match(app, /restoreFormState\(replacement, snapshot\)/);
assert.match(app, /state\.modal = \{ \.\.\.state\.modal, submitting: true, error: null \}/);

assert.match(components, /\.modal\.is-busy > :not\(\.dialog-busy-shield\)/);
assert.match(components, /\.dialog-busy-shield\s*\{[\s\S]*?position:\s*absolute[\s\S]*?inset:\s*0/);
assert.match(components, /background:\s*color-mix\([\s\S]*?var\(--bg-elevated\) 72%/);
assert.match(components, /\.button > span\s*\{\s*color:\s*inherit/);
assert.match(components, /\.button-spinner,[\s\S]*?border:\s*2px solid currentColor/);

assert.doesNotMatch(updateNotice, /\.app-update-notice\s+span\b/);
assert.match(updateNotice, /\.app-update-copy > span/);
assert.match(app, /class="app-update-copy"/);
assert.match(tokens, /--button-primary-bg:\s*#20231f/);
assert.match(tokens, /--button-primary-fg:\s*#f7f7f3/);
assert.match(tokens, /\[data-theme="dark"\][\s\S]*?--button-primary-bg:\s*#f1f3f0[\s\S]*?--button-primary-fg:\s*#151714/);

console.log('Modal pending state tests passed');
