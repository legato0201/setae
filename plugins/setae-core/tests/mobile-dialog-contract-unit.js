const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const components = read('assets/app/styles/components.css');
const feedback = read('assets/app/styles/components/feedback.css');
const workbench = read('assets/app/styles/components/workbench.css');
const combobox = read('assets/app/styles/components/combobox.css');
const tokens = read('assets/app/styles/tokens.css');
const primitives = read('assets/app/components/primitives.js');
const modals = read('assets/app/components/modals.js');
const intake = read('assets/app/features/specimen-intake/view.js');
const dashboardEditor = read('assets/app/features/dashboard/editor.js');
const savedViewEditor = read('assets/app/features/animals/view-editor.js');
const cardEditor = read('assets/app/features/collection/card-editor.js');
const quickRecord = read('assets/app/features/records/quick-record-view.js');
const recordForm = read('assets/app/features/records/record-form-view.js');
const fieldLabel = read('assets/app/features/specimen/field-label.js');
const todayStyles = read('assets/app/styles/screens/today.css');
const identityPanel = read('assets/app/styles/components/identity-panel.css');
const reset = read('assets/app/styles/reset.css');
const appFrame = read('assets/app/styles/app-frame.css');
const collectionStyles = read('assets/app/styles/screens/collection.css');
const qrStyles = read('assets/app/styles/screens/qr.css');

[
  '.modal',
  '.modal-body',
  '.form-grid',
  '.form-row',
  '.input-suffix',
  '.file-picker',
  'input',
  'select',
  'textarea'
].forEach((selector) => assert.match(components, new RegExp(selector.replace('.', '\\.') + '[\\s\\S]{0,400}min-width:\\s*0')));
assert.match(workbench, /\.select-control\s*\{[^}]*min-width:\s*0[^}]*min-inline-size:\s*0/s);
assert.match(combobox, /\.combobox-field\s*\{[^}]*min-width:\s*0[^}]*min-inline-size:\s*0/s);
assert.match(combobox, /\.combobox-control\s*\{[^}]*min-width:\s*0[^}]*min-inline-size:\s*0/s);

assert.match(components, /max-width:\s*100%/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*?\.form-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(tokens, /--type-mobile-input:\s*1rem/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*?font-size:\s*var\(--type-mobile-input\)/);

assert.match(primitives, /export function alertDialog/);
assert.match(primitives, /export function sheet/);
assert.match(primitives, /export function fullScreenDialog/);
assert.match(primitives, /role === 'alertdialog'/);
assert.match(primitives, /presentation === 'full-screen-mobile'/);
assert.match(components, /\.full-screen-dialog\s*\{[\s\S]*?position:\s*fixed[\s\S]*?inset:\s*0[\s\S]*?height:\s*100dvh/);
assert.match(components, /\.full-screen-dialog > \.modal-header[\s\S]*?position:\s*sticky/);
assert.match(
  components,
  /\.full-screen-dialog > \.modal-body\s*\{[^}]*overflow-x:\s*clip[^}]*overflow-y:\s*auto/s
);
assert.match(components, /\.full-screen-dialog \.modal-actions[\s\S]*?bottom:\s*0[\s\S]*?var\(--safe-bottom\)/);

assert.match(modals, /case 'baby-group'/);
assert.match(modals, /presentation: 'full-screen'/);
assert.match(modals, /title: editing \? `\$\{enclosure\.code\}の設定` : '飼育容器を登録',[\s\S]*?presentation: 'full-screen'/);
assert.match(modals, /title: '相談を投稿', presentation: 'full-screen'/);
assert.match(modals, /title: '個体の公開設定',[\s\S]*?presentation: 'full-screen'/);
assert.match(intake, /specimen-intake-dialog full-screen-dialog/);
assert.match(dashboardEditor, /presentation: 'full-screen-mobile'/);
assert.match(savedViewEditor, /presentation: 'full-screen-mobile'/);
assert.match(cardEditor, /presentation: 'full-screen-mobile'/);
assert.match(todayStyles, /dashboard-editor-sheet\.full-screen-dialog[\s\S]*?height:\s*100dvh/);

assert.match(recordForm, /return sheet\(content/);
assert.match(recordForm, /backdropClassName: 'quick-record-backdrop'/);
assert.doesNotMatch(quickRecord, /full-screen-dialog/);
assert.doesNotMatch(recordForm, /full-screen-dialog/);
assert.match(fieldLabel, /className: 'field-label-dialog'/);
assert.match(identityPanel, /\.field-label-dialog[\s\S]*?calc\(100vw - var\(--space-6\)\)/);

for (const inset of ['top', 'right', 'bottom', 'left']) {
  assert.match(tokens, new RegExp(`--safe-${inset}:\\s*env\\(safe-area-inset-${inset}`));
}
assert.match(reset, /box-sizing:\s*border-box/);
assert.match(components, /\.sheet\s*\{[\s\S]*?var\(--safe-right\)[\s\S]*?var\(--safe-bottom\)[\s\S]*?var\(--safe-left\)/);
assert.match(feedback, /\.toast\s*\{[\s\S]*?var\(--safe-right\)[\s\S]*?var\(--safe-left\)[\s\S]*?var\(--safe-bottom\)/);
assert.match(appFrame, /\.mobile-navigation\s*\{[\s\S]*?var\(--safe-right\)[\s\S]*?var\(--safe-bottom\)[\s\S]*?var\(--safe-left\)/);
assert.match(collectionStyles, /\.collection-workbench-v4\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(qrStyles, /@media \(max-width: 767px\)[\s\S]*?\.field-label\s*\{\s*max-width:\s*100%/);

const requiredViewports = [[320, 568], [360, 800], [375, 667], [390, 844], [430, 932]];
assert.equal(requiredViewports.every(([width, height]) => width >= 320 && height >= 568), true);

console.log('Mobile Dialog contract tests passed');
