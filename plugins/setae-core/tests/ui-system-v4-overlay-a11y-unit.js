const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'assets/app/components/overlay-controller.js'), 'utf8');
const primitives = fs.readFileSync(path.join(rootPath, 'assets/app/components/primitives.js'), 'utf8');
const executable = source.replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${executable}\nthis.exports = { overlayPanels, topmostOverlay, isBusyOverlay, createOverlayController };`, context);
const { topmostOverlay, isBusyOverlay, createOverlayController } = context.exports;

class FakeElement {
  constructor(environment, {
    id = '',
    className = '',
    attrs = {},
    dataset = {},
    focusable = false,
    tag = 'div',
    zIndex = 0
  } = {}) {
    this.environment = environment;
    this.nodeType = 1;
    this.id = id;
    this.className = className;
    this.dataset = { ...dataset };
    this.focusable = focusable;
    this.tagName = tag.toUpperCase();
    this.zIndex = zIndex;
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.parentElement = null;
    this.children = [];
    this.focusables = [];
    this.style = {};
    this.clickCount = 0;
    this.attributes = new Map(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
    if (id) this.attributes.set('id', id);
    this.classList = { contains: (name) => this.className.split(/\s+/).includes(name) };
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'inert') this.inert = true;
    if (name === 'tabindex') this.tabIndex = Number(value);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'inert') this.inert = false;
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector) {
    if (selector.includes('a[href]') && selector.includes('button:not([disabled])')) {
      return this.focusables.length ? this.focusables : this.descendants().filter((element) => element.focusable);
    }
    return this.descendants().filter((element) => element.matches(selector));
  }

  querySelector(selector) {
    const candidates = this.focusables.length ? this.focusables : this.descendants();
    if (selector === '[autofocus]') return candidates.find((element) => element.hasAttribute('autofocus')) || null;
    if (selector.includes('[aria-invalid="true"]')) return candidates.find((element) => element.getAttribute('aria-invalid') === 'true') || null;
    if (selector.startsWith('input:not([disabled])')) return candidates.find((element) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) && !element.disabled) || null;
    if (selector === '[data-overlay-error]') return candidates.find((element) => element.hasAttribute('data-overlay-error')) || null;
    if (selector.includes('[data-action')) {
      return candidates.find((element) => {
        const action = element.dataset.action || '';
        return action.startsWith('close-') || action === 'dismiss-setae-setup' || action === 'cancel-collection-status';
      }) || null;
    }
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    let candidate = this;
    while (candidate) {
      if (selector === '[hidden], [inert]' && (candidate.hidden || candidate.hasAttribute('inert'))) return candidate;
      const classSelectors = [...selector.matchAll(/\.([a-z0-9_-]+)/gi)].map((match) => match[1]);
      if (classSelectors.some((name) => candidate.classList.contains(name))) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (selector.includes('[disabled]') && this.disabled) return true;
    if (selector.includes('[hidden]') && this.hidden) return true;
    if (selector.includes('[inert]') && this.hasAttribute('inert')) return true;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return false;
  }

  contains(element) {
    return element === this || this.descendants().includes(element);
  }

  focus() {
    this.environment.document.activeElement = this;
  }

  click() {
    this.clickCount += 1;
  }
}

function createEnvironment({ touch = false, scrollY = 73 } = {}) {
  const listeners = {};
  const rootListeners = {};
  const document = {
    activeElement: null,
    body: { style: { position: '', top: '', left: '', right: '', width: '', overflow: '' } },
    documentElement: { scrollTop: scrollY, dataset: {} },
    addEventListener(type, listener) { listeners[type] = listener; },
    removeEventListener(type) { delete listeners[type]; },
    getElementById(id) { return environment.elements.find((element) => element.id === id) || null; }
  };
  const window = {
    scrollY,
    scrollCalls: [],
    getComputedStyle(element) {
      return { zIndex: String(element.zIndex || 0), display: 'block', visibility: 'visible' };
    },
    matchMedia() { return { matches: touch }; },
    requestAnimationFrame(callback) { callback(); },
    scrollTo(x, y) { this.scrollCalls.push([x, y]); this.scrollY = y; }
  };
  const environment = { document, window, listeners, rootListeners, elements: [] };
  const root = new FakeElement(environment, { id: 'app', className: 'root' });
  root.panels = [];
  root.focusables = [];
  root.ownerDocument = document;
  root.querySelectorAll = (selector) => selector.includes('.modal, .sheet') ? root.panels : root.focusables.filter((element) => element.isConnected);
  root.addEventListener = (type, listener) => { rootListeners[type] = listener; };
  root.removeEventListener = (type) => { delete rootListeners[type]; };
  environment.root = root;
  environment.element = (options) => {
    const element = new FakeElement(environment, options);
    environment.elements.push(element);
    return element;
  };
  return environment;
}

function overlayFixture(environment, { className = 'modal', zIndex = 100, busy = false } = {}) {
  const backdrop = environment.element({ className: className === 'sheet' ? 'sheet-backdrop' : 'modal-backdrop', zIndex });
  const panel = environment.element({ className, attrs: { 'aria-labelledby': `${className}-title`, ...(busy ? { 'aria-busy': 'true' } : {}) } });
  const heading = environment.element({ id: `${className}-title` });
  const close = environment.element({ tag: 'button', focusable: true, dataset: { action: className === 'sheet' ? 'close-sheet' : 'close-modal' } });
  const field = environment.element({ tag: 'input', focusable: true, attrs: { name: 'title', type: 'text' } });
  const last = environment.element({ tag: 'button', focusable: true, dataset: { action: 'save' } });
  panel.append(heading);
  panel.append(close);
  panel.append(field);
  panel.append(last);
  panel.focusables = [close, field, last];
  backdrop.append(panel);
  return { backdrop, panel, heading, close, field, last };
}

{
  const environment = createEnvironment();
  const low = overlayFixture(environment, { className: 'modal', zIndex: 80 });
  const high = overlayFixture(environment, { className: 'sheet', zIndex: 120 });
  environment.root.panels = [low.panel, high.panel];
  assert.equal(topmostOverlay(environment.root, environment.window), high.panel);
  assert.equal(isBusyOverlay(high.panel), false);
  high.panel.setAttribute('aria-busy', 'true');
  assert.equal(isBusyOverlay(high.panel), true);
}

{
  const environment = createEnvironment();
  const content = environment.element({ className: 'app-workspace' });
  const trigger = environment.element({ tag: 'button', focusable: true, id: 'open-dialog', dataset: { action: 'open-dialog' } });
  content.append(trigger);
  environment.root.append(content);
  environment.root.focusables = [trigger];
  trigger.focus();

  const controller = createOverlayController(environment.root, {
    documentRef: environment.document,
    windowRef: environment.window
  });
  controller.beforeRender();
  const fixture = overlayFixture(environment, { zIndex: 100 });
  environment.root.append(fixture.backdrop);
  environment.root.panels = [fixture.panel];
  environment.root.focusables.push(...fixture.panel.focusables);
  controller.sync();

  assert.equal(environment.document.activeElement, fixture.field, 'Desktop overlay must focus the first usable field');
  assert.equal(content.hasAttribute('inert'), true, 'Underlying app content must be inert');
  assert.equal(environment.document.body.style.position, 'fixed');
  assert.equal(environment.document.body.style.top, '-73px');

  fixture.last.focus();
  let prevented = false;
  environment.listeners.keydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, true);
  assert.equal(environment.document.activeElement, fixture.close, 'Tab must loop to the first control');

  fixture.close.focus();
  prevented = false;
  environment.listeners.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, true);
  assert.equal(environment.document.activeElement, fixture.last, 'Shift+Tab must loop to the last control');

  fixture.panel.setAttribute('aria-busy', 'true');
  environment.listeners.keydown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(fixture.close.clickCount, 0, 'Busy Escape must not close the overlay');
  let backdropPrevented = false;
  environment.rootListeners.click({ target: fixture.backdrop, preventDefault() { backdropPrevented = true; }, stopImmediatePropagation() {} });
  assert.equal(backdropPrevented, true, 'Busy backdrop clicks must be blocked');

  fixture.panel.removeAttribute('aria-busy');
  environment.listeners.keydown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(fixture.close.clickCount, 1, 'Escape must use the existing close action');

  controller.beforeRender();
  fixture.panel.isConnected = false;
  fixture.backdrop.isConnected = false;
  environment.root.panels = [];
  environment.root.children = [content];
  environment.root.focusables = [trigger];
  controller.sync();
  assert.equal(environment.document.activeElement, trigger, 'Focus must return to the trigger');
  assert.equal(content.hasAttribute('inert'), false);
  assert.equal(environment.document.body.style.position, '');
  assert.deepEqual(environment.window.scrollCalls.at(-1), [0, 73]);
  controller.destroy();
}

{
  const environment = createEnvironment();
  const controller = createOverlayController(environment.root, {
    documentRef: environment.document,
    windowRef: environment.window
  });
  controller.beforeRender();
  const fixture = overlayFixture(environment, { busy: true });
  const error = environment.element({ attrs: { 'data-overlay-error': '', tabindex: '-1' } });
  fixture.panel.append(error);
  fixture.panel.focusables.push(error);
  environment.root.append(fixture.backdrop);
  environment.root.panels = [fixture.panel];
  controller.sync();

  controller.beforeRender();
  fixture.panel.removeAttribute('aria-busy');
  controller.sync();
  assert.equal(environment.document.activeElement, error, 'Busy failure must move focus to the error banner');
  controller.destroy();
}

{
  const environment = createEnvironment({ touch: true });
  const trigger = environment.element({ tag: 'button', focusable: true, id: 'mobile-trigger' });
  environment.root.focusables = [trigger];
  trigger.focus();
  const controller = createOverlayController(environment.root, { documentRef: environment.document, windowRef: environment.window });
  controller.beforeRender();
  const fixture = overlayFixture(environment, { className: 'sheet' });
  environment.root.append(fixture.backdrop);
  environment.root.panels = [fixture.panel];
  controller.sync();
  assert.equal(environment.document.activeElement, fixture.close, 'Touch overlays must not focus an input automatically');
  controller.destroy();
}

assert.match(primitives, /role="dialog"/);
assert.match(primitives, /labelledBy[\s\S]*?aria-labelledby/);
assert.match(source, /\[data-overlay-error\]/);
assert.match(primitives, /role="status" aria-live="polite"/);

console.log('UI System v4 overlay accessibility checks passed');
