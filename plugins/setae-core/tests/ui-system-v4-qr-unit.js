const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const view = read('assets/app/features/qr/view.js');
const state = read('assets/app/features/qr/state.js');
const labels = read('assets/app/features/qr/labels.js');
const primitives = read('assets/app/components/primitives.js');
const css = read('assets/app/styles/screens/qr.css');
const shell = read('includes/frontend/class-setae-app-shell.php');

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/qr.css')));
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/qr.css')), false);
assert.match(css, /^@layer screens\s*\{/);
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'QR CSS braces must be balanced');
assert.doesNotMatch(css, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'QR screen colors must use tokens');
assert.doesNotMatch(css, /@media[^\{]*(?:420|719|759)px/);
assert.match(css, /@media \(max-width:\s*767px\)/);
assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(view, rawControl, 'QR view must compose controls from primitives');
['tabs', 'segmentedControl', 'selectionRow', 'checkboxControl', 'fileAction', 'dateField', 'button'].forEach((name) => {
  assert.match(view, new RegExp(`\\b${name}\\b`), `QR must use ${name}`);
});
['selectionRow', 'contentAction', 'fileAction'].forEach((name) => assert.match(primitives, new RegExp(`export function ${name}`)));

['labels', 'scan', 'transfer'].forEach((section) => assert.match(view, new RegExp(`id: '${section}'`)));
[
  'qr-workspace-section', 'qr-label-config', 'qr-label-toggle', 'print-field-labels',
  'toggle-qr-camera', 'add-resolved-to-batch', 'add-qr-history-row',
  'remove-qr-history-row', 'qr-batch-mode', 'qr-batch-event',
  'apply-qr-same-date', 'qr-transfer'
].forEach((action) => assert.match(view, new RegExp(action), `QR action ${action} must remain`));
['qr-label-target-form', 'qr-image-input', 'qr-resolve-form', 'qr-history-record-form', 'qr-batch-record-form'].forEach((role) => {
  assert.match(view, new RegExp(role), `QR role ${role} must remain`);
});

assert.match(state, /tapeLengthPresets\s*=\s*Object\.freeze\(\[18, 24, 36, 50, 70\]\);/);
assert.match(view, /format[^\n]*micro-id|micro-id/);
assert.match(view, /\$\{targets\.length\}枚を印刷/);
assert.match(view, /履歴入力/);
assert.match(view, /一括記録/);
assert.match(view, /管理の引き継ぎ/);
assert.match(view, /dateField\(\{ label: '日付'/);
assert.match(view, /disabled:\s*qr\.saving/);
assert.match(labels, /format-micro-id/);
assert.match(labels, /--digital-width:15\.6mm/);
assert.match(labels, /grid-template-columns:var\(--digital-width\) minmax\(0,1fr\)/);

['.qr-workspace', '.label-studio', '.qr-scanner-workspace', '.qr-transfer-workspace'].forEach((selector) => {
  assert.match(css, new RegExp(selector.replaceAll('.', '\\\.')));
});
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(shell, /'setae-gui-qr-screen'[\s\S]*?styles\/screens\/qr\.css[\s\S]*?array\('setae-gui-husbandry-screen'\)/);
assert.match(shell, /'setae-gui-community-screen'[\s\S]*?array\('setae-gui-qr-screen'\)/);

console.log('UI System v4 QR tests passed');
