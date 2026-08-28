const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const script = read('assets/js/public-registration.js');
const template = read('templates/public/registration-dialog.php');
const controller = read('includes/frontend/class-setae-public-registration.php');
const css = read('assets/css/public-registration.css');
const sources = ['public_profile', 'public_passport', 'public_care_share', 'public_partner'];
const fields = ['username', 'email', 'password', 'referral_code', 'referral_source', 'terms_accepted', 'terms_version', 'qr_claim_code', 'qr_claim_intent', 'return_url'];

fields.forEach((name) => assert.match(template, new RegExp(`name="${name}"`)));
sources.forEach((source) => assert.ok(controller.includes(`'${source}'`)));
assert.match(controller, /function build_context\(/);
assert.match(controller, /function enqueue\(/);
assert.match(controller, /function render\(/);
assert.match(controller, /Setae_QR_Manager::sanitize_code/);
assert.match(template, /<dialog\b[\s\S]*?data-public-registration/);
assert.match(template, /type="password"[^\n]*autocomplete="new-password"/);
assert.doesNotMatch(template, /type="password"[^\n]*\svalue=/);
assert.doesNotMatch(template, /\sstyle=|<script|\son(?:click|submit|change)=/);
assert.doesNotMatch(script, /\bjQuery\b|\$\s*\(|\.innerHTML|sessionStorage/);
assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i);
assert.doesNotMatch(css, /!important/i);
assert.match(css, /\.setae-public-register-heading\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content/);
assert.match(css, /\.setae-public-register-heading\s*>\s*\[data-public-register-close\]\s*\{[^}]*white-space:\s*nowrap/);
assert.match(css, /\.setae-public-register-heading h2\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*text-wrap:\s*balance/);
assert.doesNotMatch(read('assets/js/public-profile.js'), /setae_register_user|openRegistration/);
assert.doesNotMatch(read('assets/js/setae-app.js'), /setae_register_user|openPublicRegistration|closePublicRegistration|#setae-register-form|js-public-register/);
assert.ok(!fs.existsSync(path.join(root, 'templates/public/profile-registration-dialog.php')));
for (const [file, source] of [
  ['class-setae-public-profile.php', 'public_profile'],
  ['class-setae-public-care-share.php', 'public_care_share'],
  ['class-setae-public-partner.php', 'public_partner']
]) {
  const content = read('includes/frontend/' + file);
  assert.ok(content.includes(`Setae_Public_Registration::build_context('${source}'`));
  assert.doesNotMatch(content, /render_registration_modal|id="setae-register-modal"|id="setae-register-form"/);
}

// Small DOM boundary: execute the production module rather than copying its logic.
function harness(source = 'public_profile', options = {}) {
  const document = { activeElement: null, listeners: new Map() };
  class Element {
    constructor(name = '') {
      this.name = name;
      this.listeners = new Map();
      this.attrs = new Map();
      this.dataset = {};
      this.disabled = false;
      this.hidden = false;
      this.isConnected = true;
      this.tabIndex = 0;
      this.type = 'text';
      this.value = '';
      this.defaultValue = '';
      this.textContent = '';
      this.validity = { valid: true };
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    emit(type, props = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
      (this.listeners.get(type) || []).forEach((callback) => callback(event));
      return event;
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name) || null; }
    removeAttribute(name) { this.attrs.delete(name); }
    focus() { document.activeElement = this; }
    closest(selector) {
      if (selector === '[data-public-register]') return this === trigger ? this : null;
      if (selector === '[hidden], [inert]') return this.hidden ? this : null;
      return null;
    }
    getClientRects() { return this.hidden || this.type === 'hidden' ? [] : [{}]; }
    scrollIntoView() {}
  }
  document.addEventListener = Element.prototype.addEventListener;
  document.emit = Element.prototype.emit;
  const dialog = new Element('dialog');
  const form = new Element('form');
  const error = new Element('error');
  const status = new Element('status');
  const notice = new Element('notice');
  const helper = new Element('helper');
  const close = new Element('close');
  const cancel = new Element('cancel');
  const submit = new Element('submit');
  const termsLink = new Element('terms-link');
  const trigger = new Element('trigger');
  const controls = Object.fromEntries(fields.map((name) => [name, new Element(name)]));
  ['username', 'referral_source', 'terms_version', 'qr_claim_code', 'qr_claim_intent', 'return_url'].forEach((name) => {
    controls[name].type = 'hidden';
    controls[name].tabIndex = -1;
  });
  controls.email.type = 'email';
  controls.password.type = 'password';
  controls.terms_accepted.type = 'checkbox';
  controls.terms_accepted.checked = false;
  controls.terms_accepted.value = '1';
  controls.referral_code.value = options.code === undefined ? (source === 'public_partner' ? 'PARTNER247' : 'PROFILE247') : options.code;
  controls.referral_source.value = source;
  controls.terms_version.value = '2026-03-01';
  controls.qr_claim_code.value = source === 'public_passport' ? '247ABC' : '';
  controls.qr_claim_intent.value = options.claimIntent || '';
  controls.return_url.value = options.returnUrl || '';
  if (options.claimIntent) controls.referral_code.type = 'hidden';
  submit.textContent = options.claimIntent ? '認証メールを送る' : '登録する';
  Object.values(controls).forEach((control) => { control.defaultValue = control.value; });
  dialog.id = 'setae-public-register-dialog';
  dialog.tabIndex = -1;
  dialog.dataset = { source, analyticsId: '42', ajaxUrl: '/ajax-registration', successMessage: source === 'public_passport'
    ? '仮登録が完了しました。認証とログイン後、この個体の引き継ぎ確認へ戻ります。' : '仮登録が完了しました。認証メールをご確認ください。' };
  trigger.setAttribute('aria-controls', dialog.id);
  error.hidden = true;
  error.tabIndex = -1;
  form.elements = [...Object.values(controls), cancel, submit];
  form.elements.namedItem = (name) => controls[name] || null;
  form.checkValidity = () => {
    controls.email.validity.valid = /.+@.+\..+/.test(controls.email.value);
    controls.password.validity.valid = controls.password.value.length >= 6;
    controls.terms_accepted.validity.valid = controls.terms_accepted.checked;
    return Object.values(controls).every((control) => control.validity.valid);
  };
  form.reset = () => {
    Object.values(controls).forEach((control) => { control.value = control.defaultValue; });
    controls.terms_accepted.checked = false;
  };
  form.querySelectorAll = () => Object.values(controls).filter((control) => control.getAttribute('aria-invalid') === 'true');
  const visible = [close, controls.email, controls.password, controls.referral_code, controls.terms_accepted, termsLink, cancel, submit];
  dialog.querySelector = (selector) => ({
    '[data-public-register-form]': form,
    '[data-public-register-error]': error,
    '[data-public-register-status]': status,
    '[data-public-register-submit]': submit,
    '[data-public-register-referral-help]': helper
  })[selector] || null;
  dialog.querySelectorAll = (selector) => selector === '[data-public-register-close]' ? [close, cancel] : visible;
  dialog.getBoundingClientRect = () => ({ left: 100, right: 620, top: 100, bottom: 740 });
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.emit('close'); };
  document.getElementById = () => notice;
  document.querySelector = (selector) => selector === '[data-public-registration]' ? dialog : trigger;
  document.querySelectorAll = () => [dialog];
  const storage = new Map(Object.entries(options.storage || {}));
  const writes = [];
  const requests = [];
  const analytics = [];
  let pending;
  const localStorage = {
    getItem(key) { if (options.blockStorage) throw new Error('blocked'); return storage.get(key) || null; },
    setItem(key, value) { if (options.blockStorage) throw new Error('blocked'); storage.set(key, value); writes.push([key, value]); },
    removeItem(key) { if (options.blockStorage) throw new Error('blocked'); storage.delete(key); }
  };
  const window = {
    location: { search: options.query || '' }, localStorage,
    matchMedia: () => ({ matches: Boolean(options.mobile) }),
    getComputedStyle: () => ({ visibility: 'visible' }),
    requestAnimationFrame: (callback) => callback(),
    SetaeCore: { track: (...args) => analytics.push(args) }
  };
  class FormData {
    constructor(target) {
      this.data = new Map(target.elements.filter((control) => !control.disabled && control.name
        && (control.type !== 'checkbox' || control.checked)).map((control) => [control.name, control.value]));
    }
    get(name) { return this.data.get(name) || null; }
  }
  const context = vm.createContext({ document, window, URLSearchParams, FormData, fetch: (url, settings) => {
    requests.push({ url, settings, payload: Object.fromEntries(new URLSearchParams(settings.body)) });
    return new Promise((resolve, reject) => { pending = { resolve, reject }; });
  } });
  vm.runInContext(script, context, { filename: 'public-registration.js' });
  return {
    document, dialog, form, controls, error, status, notice, close, cancel, submit, trigger, requests, analytics, storage, writes,
    open() { trigger.focus(); return document.emit('click', { target: trigger }); },
    fill() { controls.email.value = 'keeper@example.test'; controls.password.value = 'retained-password'; controls.terms_accepted.checked = true; },
    send() { return form.emit('submit'); },
    async reply(json, ok = true) { pending.resolve({ ok, json: () => Promise.resolve(json) }); await new Promise(setImmediate); },
    async networkError() { pending.reject(new Error('通信できませんでした')); await new Promise(setImmediate); }
  };
}

(async () => {
  for (const source of sources) {
    const h = harness(source);
    assert.equal(h.open().defaultPrevented, true);
    assert.equal(h.dialog.open, true);
    assert.equal(h.document.activeElement, h.controls.email);
    h.send();
    assert.equal(h.requests.length, 0, 'Invalid form must not reach AJAX.');
    assert.equal(h.document.activeElement, h.error);
    h.fill();
    h.send();
    h.send();
    assert.equal(h.requests.length, 1, 'Busy form rejects duplicate submits.');
    assert.deepEqual(h.requests[0].payload, {
      action: 'setae_register_user', username: '', email: 'keeper@example.test', password: 'retained-password',
      referral_code: source === 'public_partner' ? 'PARTNER247' : 'PROFILE247', referral_source: source,
      terms_version: '2026-03-01', qr_claim_code: source === 'public_passport' ? '247ABC' : '', terms_accepted: '1'
    });
    assert.equal(h.requests[0].settings.credentials, 'same-origin');
    assert.equal(h.form.elements.every((control) => control.disabled), true);
    assert.equal(h.close.disabled, true);
    assert.equal(h.dialog.dataset.busy, 'true');
    assert.match(h.status.textContent, /送信/);
    h.close.emit('click');
    h.dialog.emit('cancel');
    h.dialog.emit('keydown', { key: 'Escape' });
    h.dialog.emit('pointerdown', { clientX: 10, clientY: 10 });
    h.dialog.emit('click', { clientX: 10, clientY: 10 });
    assert.equal(h.dialog.open, true, 'All user dismissal paths are locked while busy.');
    h.dialog.emit('keydown', { key: 'Tab' });
    assert.equal(h.document.activeElement, h.dialog);
    await h.reply({ success: false, data: { message: 'このメールアドレスは使用できません' } });
    assert.equal(h.dialog.dataset.busy, 'false');
    assert.equal(h.controls.password.value, 'retained-password');
    assert.equal(h.controls.email.value, 'keeper@example.test');
    assert.equal(h.controls.terms_accepted.checked, true);
    assert.equal(h.controls.referral_code.value, source === 'public_partner' ? 'PARTNER247' : 'PROFILE247');
    assert.equal(h.document.activeElement, h.error);
    assert.equal(h.submit.disabled, false);
    h.send();
    await h.reply({ success: true, data: {} });
    assert.equal(h.dialog.open, false);
    assert.equal(h.document.activeElement, h.trigger, 'Success must also restore focus.');
    assert.equal(h.controls.password.value, '');
    assert.match(h.notice.textContent, /仮登録が完了/);
    if (source === 'public_passport') assert.match(h.notice.textContent, /引き継ぎ確認/);
    assert.equal(h.storage.has('setae_referral_code'), false);
    assert.equal(h.writes.some(([, value]) => value.includes('password')), false);
    assert.ok(h.analytics.some(([name, detail]) => name === 'register_submit_success' && detail.source === source));
  }

  const h = harness('public_profile');
  h.open();
  h.submit.focus();
  h.dialog.emit('keydown', { key: 'Tab' });
  assert.equal(h.document.activeElement, h.close);
  h.dialog.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(h.document.activeElement, h.submit);
  h.dialog.focus();
  h.dialog.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(h.document.activeElement, h.submit, 'Tab trap includes focus starting on dialog/error.');
  h.dialog.emit('pointerdown', { clientX: 200, clientY: 200 });
  h.dialog.emit('click', { clientX: 10, clientY: 10 });
  assert.equal(h.dialog.open, true, 'Dragging from dialog contents to backdrop does not dismiss.');
  h.dialog.emit('pointerdown', { clientX: 10, clientY: 10 });
  h.dialog.emit('click', { clientX: 10, clientY: 10 });
  assert.equal(h.dialog.open, false);
  assert.equal(h.document.activeElement, h.trigger);
  h.open();
  h.dialog.emit('keydown', { key: 'Escape' });
  assert.equal(h.dialog.open, false);

  const attribution = harness('public_profile', { code: 'PROFILE', query: '?ref=OTHER&src=Event%20Booth' });
  assert.equal(attribution.controls.referral_code.value, 'PROFILE', 'Profile identity code wins over URL code.');
  assert.equal(attribution.controls.referral_source.value, 'event_booth');
  const stored = harness('public_care_share', { code: '', storage: { setae_referral_code: 'OLDREF', setae_referral_source: 'event' } });
  assert.equal(stored.controls.referral_code.value, 'OLDREF');
  assert.equal(stored.controls.referral_source.value, 'event');
  const blocked = harness('public_partner', { code: '', blockStorage: true, mobile: true, query: '?register=1' });
  assert.equal(blocked.dialog.open, true);
  assert.equal(blocked.document.activeElement, blocked.dialog);
  blocked.fill();
  blocked.send();
  await blocked.networkError();
  assert.equal(blocked.controls.password.value, 'retained-password');
  assert.equal(blocked.dialog.dataset.busy, 'false');
  const unsupported = harness();
  unsupported.dialog.showModal = undefined;
  assert.equal(unsupported.open().defaultPrevented, false, 'Native dialog unavailable: preserve fallback href navigation.');
  const claim = harness('public_passport', { claimIntent: 'request_after_verification' });
  claim.open(); claim.fill(); claim.send();
  assert.equal(claim.requests[0].payload.qr_claim_intent, 'request_after_verification');
  assert.equal(claim.requests[0].payload.qr_claim_code, '247ABC');
  assert.equal(claim.requests[0].payload.referral_code, 'PROFILE247', 'Hidden referral context is retained.');
  assert.equal('return_url' in claim.requests[0].payload, false, 'Empty optional context is not added to legacy payloads.');
  await claim.reply({ success: false, data: '再試行してください' });
  assert.equal(claim.submit.textContent, '認証メールを送る', 'Error restores the claim-specific submit label.');
  assert.equal(claim.controls.qr_claim_intent.value, 'request_after_verification');
  claim.send(); await claim.reply({ success: true, data: {} });
  assert.equal(claim.controls.qr_claim_intent.value, 'request_after_verification', 'Form reset preserves server-rendered intent for the same specimen.');
  const notInformed = harness('public_passport', { claimIntent: 'true' });
  notInformed.open(); notInformed.fill(); notInformed.send();
  assert.equal('qr_claim_intent' in notInformed.requests[0].payload, false, 'Truthiness is never treated as informed claim intent.');
  const partner = harness('public_partner', { returnUrl: 'https://setae.test/?setae_plan=breeder_trial' });
  partner.open(); partner.fill(); partner.send();
  assert.equal(partner.requests[0].payload.return_url, 'https://setae.test/?setae_plan=breeder_trial');
  assert.equal('qr_claim_intent' in partner.requests[0].payload, false, 'Plan entry is not a specimen claim.');
  console.log('UI System v4 shared Public Registration tests passed (four payload contexts, validation, busy, error/retry, focus, referral and QR claim)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
