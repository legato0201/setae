const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('assets/js/public-share.js');
const adapters = { care: read('assets/js/public-care-share.js'), partner: read('assets/js/public-partner.js') };
const home = read('includes/frontend/class-setae-public-home.php');
const { parseCss } = require('./ui-system-v4-public-surface-ownership-unit.js');
const foundationRules = parseCss(read('assets/css/public-foundation.css'));

// Existing v1.0.247 accessibility exceptions only; no new !important is allowed.
const foundationImportantAllowlist = [
  { property: 'display', value: 'none !important', context: [],
    reason: 'The HTML hidden attribute must override component display:flex/grid, including unavailable native sharing and hidden registration errors.' },
  { property: 'scroll-behavior', value: 'auto !important', context: ['@media (prefers-reduced-motion: reduce)'],
    reason: 'The user reduced-motion preference must override smooth scrolling declared by more specific component selectors.' },
  { property: 'animation-duration', value: '.01ms !important', context: ['@media (prefers-reduced-motion: reduce)'],
    reason: 'Reduce motion despite component animation timing while preserving animation completion events expected by existing interfaces.' },
  { property: 'animation-iteration-count', value: '1 !important', context: ['@media (prefers-reduced-motion: reduce)'],
    reason: 'Stop repeating decorative motion, including the inherited spinner, when the user requests reduced motion.' },
  { property: 'transition-duration', value: '.01ms !important', context: ['@media (prefers-reduced-motion: reduce)'],
    reason: 'The user reduced-motion preference must override component transition timing without suppressing transition completion events.' },
];
const importantDeclarations = foundationRules.flatMap((rule) => rule.body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').flatMap((declaration) => {
  const pair = declaration.trim().match(/^([\w-]+):\s*(.+!important)$/i);
  return pair ? [{ property: pair[1], value: pair[2], context: rule.context, selectors: rule.selectors }] : [];
}));
assert.equal(importantDeclarations.length, foundationImportantAllowlist.length, 'Exactly the existing five Foundation !important declarations are allowed.');
for (const allowed of foundationImportantAllowlist) {
  const matches = importantDeclarations.filter((entry) => entry.property === allowed.property && entry.value === allowed.value && JSON.stringify(entry.context) === JSON.stringify(allowed.context));
  assert.equal(matches.length, 1, allowed.reason);
  if (allowed.property === 'display') assert.ok(matches[0].selectors.every((selector) => /\[hidden\]$/.test(selector)), allowed.reason);
}

assert.doesNotMatch(source, /\bjQuery\b|\$\s*\(|window\.prompt|\.innerHTML|localStorage|sessionStorage|\.style\b|setAttribute\(['"]style/);
assert.doesNotMatch(source, /(?:control|button)\.textContent\s*=/);
assert.match(source, /data-share-copy-text/);
assert.doesNotMatch(source, /['"]data-copy-text['"]/);
assert.match(source, /setae-public-copy-helper/);
assert.match(home, /function enqueue_public_care_share\(/);
assert.match(home, /function enqueue_public_partner\(/);
assert.match(home, /function isolate_public_surface_assets\(/);
assert.match(home, /function is_plugin_asset_source\(/);
assert.doesNotMatch(home, /enqueue_public_pages|public-pages\.css|public-entry-share\.js|wp_deregister|['"]jquery['"]/);
assert.ok(!fs.existsSync(path.join(root, 'assets/js/public-entry-share.js')));
assert.ok(!fs.existsSync(path.join(root, 'assets/css/public-pages.css')));
for (const selector of ['body.setae-care-share-document', 'body.setae-public-partner-document']) {
  const rules = foundationRules.filter((rule) => rule.context.length === 0 && rule.selectors.includes(selector));
  assert.equal(rules.length, 1, 'New document bodies have one explicit reset.');
  assert.match(rules[0].body, /min-width:\s*0\s*;/, 'A 320px viewport with a classic scrollbar must not force a 320px body.');
  assert.match(rules[0].body, /font-size:\s*1rem\s*;/, 'The new document body respects the user default font size.');
}
const htmlReset = foundationRules.filter((rule) => rule.context.length === 0 && rule.selectors.includes('html.setae-public-surface-document'));
assert.equal(htmlReset.length, 1);
assert.match(htmlReset[0].body, /font-size:\s*100%\s*;/, 'Theme html { font-size:62.5% } must not shrink the new rem-based documents.');
for (const surface of ['care-share', 'partner']) {
  assert.match(read(`templates/public/${surface}-document.php`), /<html\b[^>]*class="setae-public-surface-document"/);
}
const sharedBaseCounts = new Map();
foundationRules.filter((rule) => rule.context.length === 0).forEach((rule) => {
  rule.selectors.filter((selector) => /\.setae-public-(?:surface|share)-/.test(selector)).forEach((selector) => {
    sharedBaseCounts.set(selector, (sharedBaseCounts.get(selector) || 0) + 1);
  });
});
assert.ok([...sharedBaseCounts.values()].every((count) => count === 1), 'Shared frame/share base selectors must be defined once.');

// Evaluate the Foundation's simple class/pseudo-class color cascade. This
// catches a normal :hover rule outranking the forced-colors primary palette.
function forcedButtonColors(classes, states) {
  const colors = {};
  const scores = {};
  for (const rule of foundationRules) {
    if (rule.context.length && !rule.context.includes('@media (forced-colors: active)')) continue;
    for (const selector of rule.selectors) {
      const alternatives = selector.match(/:is\(([^()]*)\)/);
      const expanded = alternatives ? alternatives[1].split(',').map((part) => selector.replace(alternatives[0], part.trim())) : [selector];
      for (const candidate of expanded) {
        if (/[\s>+~\[\]()]/.test(candidate)) continue;
        const requiredClasses = [...candidate.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
        const requiredStates = [...candidate.matchAll(/:([\w-]+)/g)].map((match) => match[1]);
        if (!requiredClasses.length || !requiredClasses.every((name) => classes.includes(name)) || !requiredStates.every((name) => states.includes(name))) continue;
        if (candidate.replace(/\.[\w-]+|:[\w-]+/g, '') !== '') continue;
        const specificity = requiredClasses.length + requiredStates.length;
        for (const declaration of rule.body.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
          const pair = declaration.trim().match(/^(background|color):\s*(.+)$/);
          if (pair && (scores[pair[1]] === undefined || specificity >= scores[pair[1]])) {
            colors[pair[1]] = pair[2].trim();
            scores[pair[1]] = specificity;
          }
        }
      }
    }
  }
  return colors;
}
for (const classes of [['setae-public-button', 'is-primary'], ['setae-public-primary-btn']]) {
  for (const states of [[], ['hover'], ['focus', 'focus-visible'], ['active'], ['hover', 'focus']]) {
    assert.deepEqual(forcedButtonColors(classes, states), { background: 'var(--setae-public-surface)', color: 'var(--setae-public-ink)' },
      'Forced primary buttons retain a legible system palette during ' + (states.join('/') || 'rest'));
  }
}
Object.values(adapters).forEach((adapter) => {
  assert.match(adapter, /SetaePublicShare\.mount\(/);
  assert.doesNotMatch(adapter, /navigator\.|execCommand|\.textContent|addEventListener/);
});
for (const file of ['surface-header.php', 'surface-footer.php']) {
  const template = read('templates/public/' + file);
  assert.match(template, /Setae_Public_Identity::render_brand/);
  assert.doesNotMatch(template, /get_post_meta|get_userdata|get_comments|get_the_terms|\sstyle=|<script\b|is-primary/);
}

// Execute the real production module against a deliberately small DOM boundary.
function harness(surface = 'care', options = {}) {
  const calls = { track: [], clipboard: [], share: [], fallback: [], created: [], focus: [] };
  const document = { activeElement: null, listeners: new Map() };
  class Element {
    constructor(tagName, attributes = {}) {
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map(Object.entries(attributes));
      this.children = [];
      this.parentElement = null;
      this.listeners = new Map();
      this.textContent = '';
      this.hidden = false;
      this.disabled = false;
      this.isConnected = true;
      this.open = false;
    }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    remove() {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
      this.isConnected = false;
    }
    matches(selector) {
      const tag = selector.match(/^[a-z]+/i);
      if (tag && this.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
      for (const [, name, expected] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (!this.hasAttribute(name) || (expected !== undefined && this.getAttribute(name) !== expected)) return false;
      }
      return true;
    }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
      return null;
    }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    focus(settings) { document.activeElement = this; calls.focus.push({ element: this, settings }); }
    select() { document.activeElement = this; this.selected = true; }
  }
  document.body = new Element('body');
  document.querySelector = document.body.querySelector.bind(document.body);
  document.addEventListener = Element.prototype.addEventListener;
  document.createElement = (tag) => {
    const element = new Element(tag);
    calls.created.push(element);
    return element;
  };
  document.execCommand = (command) => {
    const helper = document.activeElement;
    assert.equal(command, 'copy');
    assert.equal(helper.tagName, 'TEXTAREA');
    assert.equal(helper.selected, true);
    calls.fallback.push(helper.value);
    if (options.execThrows) throw new Error('DOM copy denied');
    return options.execResult !== false;
  };

  const page = document.body.appendChild(new Element('main', {
    'data-public-share-root': '',
    [surface === 'care' ? 'data-care-share-page' : 'data-partner-page']: '',
    'data-share-id': surface === 'care' ? '42' : '',
    'data-share-title': '共有する公開記録 | SETAE',
    'data-share-text': '公開された紹介文です。',
    'data-share-url': 'https://setae.example/setae-care/42/?ref=public-code',
    'data-share-copy-text': '案内文の先頭\n公開された情報だけ\nhttps://setae.example/setae-care/42/?ref=public-code',
  }));
  const groups = {};
  for (const name of ['hero', 'kit']) {
    const controls = page.appendChild(new Element('div', { 'data-public-share-controls': '' }));
    const menu = controls.appendChild(new Element('details', { 'data-public-share-menu': '' }));
    const summary = menu.appendChild(new Element('summary'));
    summary.textContent = '共有';
    const buttons = {};
    for (const action of ['native', 'link', 'text', 'x', 'line']) {
      const control = menu.appendChild(new Element(action === 'x' || action === 'line' ? 'a' : 'button', { 'data-public-share-action': action }));
      control.textContent = { native: '端末で共有', link: 'リンクをコピー', text: '案内文をコピー', x: 'Xで共有', line: 'LINEで共有' }[action];
      control.hidden = action === 'native';
      if (control.tagName === 'A') {
        control.setAttribute('href', 'https://share.example/' + action);
        control.setAttribute('target', '_blank');
        control.setAttribute('rel', 'noopener noreferrer');
      }
      buttons[action] = control;
    }
    const status = controls.appendChild(new Element('p', { 'data-public-share-status': '', role: 'status', 'aria-live': 'polite' }));
    groups[name] = { controls, menu, summary, buttons, status };
  }
  const selection = {
    ranges: [],
    get rangeCount() { return this.ranges.length; },
    getRangeAt(index) { return this.ranges[index]; },
    removeAllRanges() { this.ranges = []; },
    addRange(range) { this.ranges.push(range); },
  };
  const navigator = {};
  if (options.clipboard !== false) navigator.clipboard = {
    writeText(text) {
      calls.clipboard.push(text);
      if (options.writeText) return options.writeText(text);
      return Promise.resolve();
    },
  };
  if (options.native !== false) navigator.share = (payload) => {
    calls.share.push(JSON.parse(JSON.stringify(payload)));
    return options.share ? options.share(payload) : Promise.resolve();
  };
  const window = { getSelection: () => selection };
  if (options.analytics !== false) window.SetaeCore = {
    track(name, payload) {
      calls.track.push({ name, payload: JSON.parse(JSON.stringify(payload)) });
      return options.track ? options.track(name, payload) : undefined;
    },
  };
  const context = vm.createContext({ window, document, navigator });
  vm.runInContext(source, context);
  vm.runInContext(adapters[surface], context);

  async function dispatch(target, type, extra = {}) {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    const callbacks = [];
    for (let node = target; node; node = node.parentElement) {
      for (const callback of node.listeners.get(type) || []) callbacks.push(callback(event));
    }
    for (const callback of document.listeners.get(type) || []) callbacks.push(callback(event));
    await Promise.all(callbacks);
    return event;
  }
  return { page, document, window, context, calls, groups, selection, Element, dispatch, click: (target) => dispatch(target, 'click') };
}

async function run() {
  let cases = 0;
  async function test(name, callback) {
    try { await callback(); cases += 1; } catch (error) { error.message = name + ': ' + error.message; throw error; }
  }
  await test('Adapters mount exact roots once and preserve analytics namespaces', async () => {
    for (const surface of ['care', 'partner']) {
      const h = harness(surface);
      vm.runInContext(adapters[surface], h.context);
      h.window.SetaePublicShare.mount(null);
      assert.deepEqual(h.calls.track, [{ name: surface === 'care' ? 'care_share_view' : 'partner_page_view', payload: surface === 'care' ? { id: 42 } : {} }]);
      assert.equal(h.page.listeners.get('click').length, 1);
      assert.equal(h.groups.hero.buttons.native.hidden, false);
    }
  });
  await test('Native Share unavailable stays hidden', async () => {
    const h = harness('care', { native: false });
    assert.equal(h.groups.hero.buttons.native.hidden, true);
    assert.equal(h.groups.kit.buttons.native.hidden, true);
  });
  await test('Native payload and successful status', async () => {
    const h = harness();
    const button = h.groups.hero.buttons.native;
    const label = button.textContent;
    await h.click(button);
    assert.deepEqual(h.calls.share, [{ title: h.page.getAttribute('data-share-title'), text: h.page.getAttribute('data-share-text'), url: h.page.getAttribute('data-share-url') }]);
    assert.equal(h.groups.hero.status.textContent, '共有しました。');
    assert.equal(button.textContent, label);
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(h.calls.track.at(-1).name, 'care_share_native_share');
  });
  await test('Abort is silent and leaves existing feedback unchanged', async () => {
    const h = harness('partner', { share: () => Promise.reject({ name: 'AbortError' }) });
    h.groups.kit.status.textContent = '前回の操作結果';
    await h.click(h.groups.kit.buttons.native);
    assert.equal(h.groups.kit.status.textContent, '前回の操作結果');
    assert.equal(h.groups.hero.status.textContent, '');
    assert.deepEqual(h.calls.clipboard, []);
    assert.deepEqual(h.calls.fallback, []);
    assert.equal(h.calls.track.at(-1).name, 'partner_native_share');
  });
  await test('Native non-Abort failure copies the link with accurate fallback feedback', async () => {
    const h = harness('care', { share: () => Promise.reject(new Error('Share denied')) });
    h.groups.hero.buttons.native.setAttribute('data-public-share-message', 'この成功文言をコピー結果に使わない');
    await h.click(h.groups.hero.buttons.native);
    assert.deepEqual(h.calls.clipboard, [h.page.getAttribute('data-share-url')]);
    assert.equal(h.groups.hero.status.textContent, 'リンクをコピーしました。');
    assert.deepEqual(h.calls.track.slice(-2).map((item) => item.name), ['care_share_native_share', 'care_share_link_copy']);
  });
  await test('Synchronous Native API failures also fall back', async () => {
    const h = harness('partner', { share: () => { throw new TypeError('Unavailable'); } });
    await h.click(h.groups.hero.buttons.native);
    assert.equal(h.calls.clipboard.length, 1);
    assert.equal(h.groups.hero.status.getAttribute('data-state'), 'success');
  });
  await test('URL copy uses the nearest static status without label mutation', async () => {
    const h = harness('partner');
    const button = h.groups.hero.buttons.link;
    const label = button.textContent;
    button.setAttribute('data-public-share-message', '案内ページURLをコピーしました。');
    await h.click(button);
    assert.deepEqual(h.calls.clipboard, [h.page.getAttribute('data-share-url')]);
    assert.equal(h.groups.hero.status.textContent, '案内ページURLをコピーしました。');
    assert.equal(h.groups.kit.status.textContent, '');
    assert.equal(button.textContent, label);
    assert.equal(h.calls.created.length, 0, 'Modern clipboard must not create a status or helper node.');
    assert.equal(h.calls.track.at(-1).name, 'partner_link_copy');
  });
  await test('Long multiline text reads the exact data-share-copy-text contract', async () => {
    const h = harness('partner');
    const text = '  長い案内文\n'.repeat(300) + 'https://setae.example/?ref=unchanged\n';
    h.page.setAttribute('data-share-copy-text', text);
    h.page.setAttribute('data-copy-text', 'incorrect legacy alias');
    h.groups.kit.buttons.text.setAttribute('data-public-share-message', '案内文をコピーしました。');
    await h.click(h.groups.kit.buttons.text);
    assert.deepEqual(h.calls.clipboard, [text]);
    assert.equal(h.groups.kit.status.textContent, '案内文をコピーしました。');
    assert.equal(h.groups.hero.status.textContent, '');
    assert.equal(h.calls.track.at(-1).name, 'partner_text_copy');
  });
  await test('Optional analytics missing, throwing or rejecting cannot fail sharing', async () => {
    for (const options of [{ analytics: false }, { track: () => { throw new Error('Analytics unavailable'); } }, { track: () => Promise.reject(new Error('Offline analytics')) }]) {
      const h = harness('care', options);
      await h.click(h.groups.hero.buttons.link);
      assert.equal(h.calls.clipboard.length, 1);
      assert.equal(h.groups.hero.status.getAttribute('data-state'), 'success');
    }
  });
  await test('Clipboard denial falls back to a selected temporary textarea and restores focus', async () => {
    const h = harness('care', { writeText: () => Promise.reject(new Error('Clipboard denied')) });
    const button = h.groups.hero.buttons.text;
    button.focus();
    h.selection.ranges = [{ id: 7, cloneRange() { return { id: this.id }; } }];
    await h.click(button);
    assert.deepEqual(h.calls.fallback, [h.page.getAttribute('data-share-copy-text')]);
    assert.equal(h.calls.created.length, 1);
    const helper = h.calls.created[0];
    assert.equal(helper.className, 'setae-public-copy-helper');
    assert.equal(helper.hasAttribute('style'), false);
    assert.equal(helper.readOnly, true);
    assert.equal(helper.tabIndex, -1);
    assert.equal(helper.isConnected, false);
    assert.equal(h.document.activeElement, button);
    assert.deepEqual(h.selection.ranges, [{ id: 7 }]);
    assert.equal(h.groups.hero.status.getAttribute('data-state'), 'success');
  });
  await test('Missing clipboard uses DOM copy without a prompt', async () => {
    const h = harness('partner', { clipboard: false });
    await h.click(h.groups.kit.buttons.link);
    assert.deepEqual(h.calls.clipboard, []);
    assert.equal(h.calls.fallback.length, 1);
    assert.equal(h.groups.kit.status.getAttribute('data-state'), 'success');
  });
  await test('False or throwing DOM copy cleans up and reports failure', async () => {
    for (const options of [{ clipboard: false, execResult: false }, { clipboard: false, execThrows: true }]) {
      const h = harness('partner', options);
      const button = h.groups.kit.buttons.text;
      const label = button.textContent;
      await h.click(button);
      assert.equal(h.groups.kit.status.getAttribute('data-state'), 'error');
      assert.match(h.groups.kit.status.textContent, /コピーできませんでした/);
      assert.equal(h.calls.created[0].isConnected, false);
      assert.equal(button.textContent, label);
      assert.equal(button.hasAttribute('aria-busy'), false);
    }
  });
  await test('Missing copy content reports failure without copying unrelated data', async () => {
    const h = harness();
    h.page.removeAttribute('data-share-copy-text');
    h.page.setAttribute('data-copy-text', 'must not leak from the wrong field');
    await h.click(h.groups.hero.buttons.text);
    assert.deepEqual(h.calls.clipboard, []);
    assert.equal(h.groups.hero.status.textContent, 'コピーする内容がありません。');
  });
  await test('Repeated pending clicks do not duplicate clipboard calls', async () => {
    let resolve;
    const h = harness('care', { writeText: () => new Promise((done) => { resolve = done; }) });
    const button = h.groups.hero.buttons.link;
    const first = h.click(button);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    await h.click(button);
    assert.equal(h.calls.clipboard.length, 1);
    resolve();
    await first;
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(h.calls.track.filter((item) => item.name === 'care_share_link_copy').length, 1);
  });
  await test('X and LINE preserve real link navigation and use agreed event names', async () => {
    for (const surface of ['care', 'partner']) {
      const h = harness(surface);
      for (const action of ['x', 'line']) {
        const anchor = h.groups.kit.buttons[action];
        const href = anchor.getAttribute('href');
        const event = await h.click(anchor);
        assert.equal(event.defaultPrevented, false);
        assert.equal(anchor.getAttribute('href'), href);
        assert.equal(anchor.getAttribute('target'), '_blank');
        assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer');
        assert.equal(h.calls.track.at(-1).name, (surface === 'care' ? 'care_share' : 'partner') + '_' + action + '_click');
      }
    }
  });
  await test('Nested button content is handled; disabled and foreign-root controls are ignored', async () => {
    const h = harness();
    const button = h.groups.hero.buttons.link;
    const span = button.appendChild(new h.Element('span'));
    await h.click(span);
    button.disabled = true;
    await h.click(span);
    const nested = h.page.appendChild(new h.Element('main', { 'data-public-share-root': '' }));
    const foreign = nested.appendChild(new h.Element('button', { 'data-public-share-action': 'text' }));
    await h.click(foreign);
    assert.equal(h.calls.clipboard.length, 1);
  });
  await test('Escape closes the active details and returns focus to its summary', async () => {
    const h = harness();
    const group = h.groups.hero;
    group.menu.open = true;
    group.buttons.link.focus();
    const event = await h.dispatch(group.buttons.link, 'keydown', { key: 'Escape' });
    assert.equal(group.menu.open, false);
    assert.equal(h.document.activeElement, group.summary);
    assert.equal(event.defaultPrevented, true);
    group.menu.open = true;
    await h.dispatch(group.buttons.link, 'keydown', { key: 'Escape', defaultPrevented: true });
    assert.equal(group.menu.open, true);
  });
  await test('Outside clicks close details without moving focus', async () => {
    const h = harness();
    h.groups.hero.menu.open = true;
    await h.click(h.groups.hero.summary);
    assert.equal(h.groups.hero.menu.open, true);
    const outside = h.document.body.appendChild(new h.Element('button'));
    outside.focus();
    await h.click(outside);
    assert.equal(h.groups.hero.menu.open, false);
    assert.equal(h.document.activeElement, outside);
  });
  console.log(`UI System v4 Public Share tests passed (${cases} execution cases)`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
