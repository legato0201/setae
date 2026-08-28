const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stripImports = (source) => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));

const primitiveContext = vm.createContext({
  icon: (name) => `<svg data-icon="${name}"></svg>`,
  formatDateFieldValue: (value) => value,
  escapeHtml,
  safeHttpUrl: (value, fallback = '#') => value || fallback
});
vm.runInContext(`${stripImports(read('assets/app/components/primitives.js')).replace(/\bexport\s+/g, '')}\nthis.exports = { textField, textareaField, selectField, fileField, comboboxField };`, primitiveContext);
const fields = primitiveContext.exports;

const first = fields.textField({ label: '個体名', name: 'title', hint: '管理しやすい名前を入力してください。', required: true });
const second = fields.textField({ label: '個体名', name: 'title', invalid: true });
const firstId = first.match(/id="(setae-field-title-\d+)"/)?.[1];
const secondId = second.match(/id="(setae-field-title-\d+)"/)?.[1];
assert.ok(firstId && secondId && firstId !== secondId, 'Generated field IDs must be deterministic and unique within the render process');
assert.match(first, new RegExp(`aria-describedby="${firstId}-message"`));
assert.match(first, new RegExp(`id="${firstId}-message"`));
assert.match(second, /aria-invalid="true"/);
assert.match(second, new RegExp(`aria-describedby="${secondId}-message"`));
assert.match(fields.textareaField({ label: 'メモ', name: 'note', hint: '任意' }), /aria-describedby="setae-field-note-\d+-message"/);
assert.match(fields.selectField({ label: '状態', name: 'status', hint: '現在の状態', options: [] }), /aria-describedby="setae-field-status-\d+-message"/);
assert.match(fields.fileField({ label: '写真', name: 'image', hint: 'JPEGまたはPNG' }), /aria-describedby="setae-field-image-\d+-message"/);
assert.match(fields.comboboxField({ label: '種', name: 'species', hint: '学名で検索' }), /aria-describedby="[^"]+-message"/);

const safetySource = stripImports(read('assets/app/components/form-safety-controller.js')).replace(/\bexport\s+/g, '');
const disclosureSource = read('assets/app/components/form-disclosure.js').replace(/\bexport\s+/g, '');
const safetyContext = vm.createContext({
  discardConfirmation: {},
  button: (label, options = {}) => `<button data-validation-target="${options.data?.['validation-target'] || ''}">${label}</button>`,
  Date,
  JSON,
  Object,
  Set,
  Map
});
vm.runInContext(`${disclosureSource}\n${safetySource}\nthis.exports = { validateForm, serverFieldErrors };`, safetyContext);
const validation = safetyContext.exports;
assert.deepEqual(JSON.parse(JSON.stringify(validation.serverFieldErrors({ field_errors: { title: ['必須です。'] } }))), { title: '必須です。' });
assert.deepEqual(JSON.parse(JSON.stringify(validation.serverFieldErrors({ data: { field_errors: { date: '日付を確認してください。' } } }))), { date: '日付を確認してください。' });

let focused = false;
let scrolled = false;
const disclosure = { open: false, parentElement: null };
const attributes = new Map();
const invalidControl = {
  id: '',
  validationMessage: '個体名を入力してください。',
  closest: () => disclosure,
  setAttribute: (name, value) => attributes.set(name, value),
  scrollIntoView: () => { scrolled = true; },
  focus: () => { focused = true; }
};
let summary = null;
const form = {
  checkValidity: () => false,
  querySelector: () => null,
  querySelectorAll: (selector) => selector === ':invalid' ? [invalidControl] : [],
  ownerDocument: {
    createElement: () => ({
      className: '',
      dataset: {},
      setAttribute() {},
      innerHTML: ''
    })
  },
  prepend: (node) => { summary = node; }
};
assert.equal(validation.validateForm(form), false);
assert.equal(focused, true);
assert.equal(scrolled, true);
assert.equal(disclosure.open, true, 'Invalid controls must be revealed before focus');
assert.equal(attributes.get('aria-invalid'), 'true');
assert.equal(summary.dataset.formErrorSummary, 'true');
assert.match(summary.innerHTML, /入力内容を確認してください/);

const app = read('assets/app/app.js');
assert.match(app, /if \(!validateForm\(form\)\) return/);
assert.match(app, /applyServerFieldErrors\(activeForm, mutationError\)/);
assert.match(app, /throwIfServerFieldError/);
assert.doesNotMatch(read('assets/app/content/messages.js'), /エラーが発生しました。/);

console.log('UI System v4 form validation tests passed');
