const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const auth = fs.readFileSync(path.join(root, 'assets/app/pages/auth.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
const authCss = fs.readFileSync(path.join(root, 'assets/app/styles/screens/auth.css'), 'utf8');

const executable = auth
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character]);
const attributes = (options = {}) => [
  options.name ? `name="${options.name}"` : '',
  options.id ? `id="${options.id}"` : '',
  options.type ? `type="${options.type}"` : '',
  options.value != null ? `value="${options.value}"` : '',
  options.autocomplete ? `autocomplete="${options.autocomplete}"` : '',
  options.required ? 'required' : '',
  options.disabled ? 'disabled' : '',
  options.action ? `data-action="${options.action}"` : '',
  options.data?.['auth-view'] ? `data-auth-view="${options.data['auth-view']}"` : ''
].filter(Boolean).join(' ');
const context = {
  escapeHtml,
  safeHttpUrl: (value) => String(value || ''),
  renderBrand: ({ className = '' } = {}) => `<div class="setae-brand ${className}">SETAE</div>`,
  textField: (options) => `<label>${escapeHtml(options.label)}<input ${attributes(options)}></label>`,
  checkboxControl: (options) => `<label><input type="checkbox" ${attributes(options)}>${options.labelHtml || escapeHtml(options.label)}</label>`,
  hiddenField: (name, value) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`,
  button: (label, options = {}) => `<button ${attributes(options)}>${escapeHtml(label)}</button>`,
  textButton: (label, options = {}) => `<button ${attributes(options)}>${escapeHtml(label)}</button>`
};
vm.createContext(context);
vm.runInContext(`${executable}\nthis.exports = { renderAuthPage, renderConnectionErrorPage, renderBootPage };`, context);

const login = context.exports.renderAuthPage({ view: 'login' });
assert.match(login, /data-role="login-form"/);
assert.match(login, /name="login"[^>]*autocomplete="username"/);
assert.match(login, /name="password"[^>]*autocomplete="current-password"/);
assert.match(login, /name="remember"/);

const registration = context.exports.renderAuthPage({ view: 'register', termsUrl: '/terms/', termsVersion: '2026-03-01' });
['email', 'username', 'password', 'referral_code', 'terms_version', 'terms_accepted'].forEach((name) => assert.match(registration, new RegExp(`name="${name}"`)));
assert.match(registration, /target="_blank" rel="noopener noreferrer">利用規約/);
assert.match(registration, /name="terms_accepted"[^>]*required/);

const reset = context.exports.renderAuthPage({ view: 'reset' });
assert.match(reset, /data-role="password-reset-form"/);
assert.match(reset, /name="login"/);

const busy = context.exports.renderAuthPage({ view: 'login', submitting: true });
assert.match(busy, /ログイン中/);
assert.match(busy, /disabled/);
assert.doesNotMatch(login + registration + reset, /autofocus/i);

const actions = context.exports.renderAuthPage({ view: 'login', mockEnabled: true });
['auth-view', 'browse-public', 'use-mock'].forEach((action) => assert.match(actions, new RegExp(`data-action="${action}"`)));
assert.match(context.exports.renderConnectionErrorPage({ error: '接続失敗', mockEnabled: true }), /data-action="retry-connection"/);
assert.match(context.exports.renderBootPage(), /aria-busy="true"/);

assert.match(app, /state\.authSubmitting/);
assert.match(app, /state\.authError/);
assert.match(app, /state\.authMessage/);
assert.match(authCss, /@media \(max-width: 767px\)[\s\S]*?\.auth-form input \{ font-size: var\(--type-mobile-input\)/);
assert.match(authCss, /\.auth-panel \{[\s\S]*?width: min\(100%, 420px\)/);

console.log('UI System v4 authentication contracts passed');
