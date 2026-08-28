const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const primitivePath = path.join(root, 'assets/app/components/primitives.js');
const cssPath = path.join(root, 'assets/app/styles/components/workbench.css');
const source = fs.readFileSync(primitivePath, 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character]);
const context = {
  console,
  icon: (name) => `<svg data-icon="${name}"></svg>`,
  formatDateFieldValue: (value) => String(value || ''),
  escapeHtml,
  safeHttpUrl: (value, fallback = '#') => value || fallback
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.checkboxControl = checkboxControl;`, context);

const compactVisible = context.checkboxControl({
  checked: true,
  label: '学名',
  description: 'ラベルへ表示',
  compact: true
});
assert.match(compactVisible, /checkbox-control is-compact has-visible-label/);
assert.match(compactVisible, /checkbox-control-label">学名</);
assert.match(compactVisible, /checkbox-control-description">ラベルへ表示</);
assert.doesNotMatch(compactVisible, /aria-label=/, 'visible labels must not duplicate the accessible name');

const srOnly = context.checkboxControl({
  label: 'C014を選択',
  compact: true,
  labelMode: 'sr-only'
});
assert.match(srOnly, /has-sr-only-label/);
assert.match(srOnly, /checkbox-control-label visually-hidden">C014を選択</);
assert.doesNotMatch(srOnly, /aria-label=/, 'sr-only text is the single accessible name');

const disabled = context.checkboxControl({ checked: true, label: 'QR', description: '必須', disabled: true });
assert.match(disabled, /is-disabled/);
assert.match(disabled, /disabled aria-disabled="true"/);
assert.match(disabled, />必須</);

const css = fs.readFileSync(cssPath, 'utf8');
assert.doesNotMatch(css, /\.checkbox-control\.is-compact\s+\.checkbox-control-label\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
assert.match(css, /\.checkbox-control\.has-visible-label\s+\.checkbox-control-label/);
assert.match(css, /\.checkbox-control:has\(input:focus-visible\)/);
assert.match(css, /@media \(forced-colors: active\)/);

console.log('Checkbox control semantics unit checks passed');
