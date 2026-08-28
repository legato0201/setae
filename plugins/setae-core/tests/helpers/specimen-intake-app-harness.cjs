const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appSource = read('assets/app/app.js');

function declaration(source, name) {
  const start = source.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, `Production function ${name} must exist`);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, `Production function ${name} boundary must exist`);
  return source.slice(start, end + 2).replace(/^export /, '');
}

function listener(type) {
  const marker = `app.addEventListener('${type}',`;
  const start = appSource.indexOf(marker);
  const end = appSource.indexOf('\n});', start);
  assert.ok(start >= 0 && end > start, `Production ${type} listener boundary must exist`);
  assert.equal(appSource.indexOf(marker, start + marker.length), -1, `Expected one app ${type} listener`);
  return appSource.slice(start, end + '\n});'.length);
}

// A small selector-aware tree for unit-level delegated event tests. Actual DOM,
// focus, native Enter submit and bubbling are covered by specimen-intake-app.html.
class Element {
  constructor(tag = 'div', attributes = {}, parent = null) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attributes };
    this.dataset = {};
    Object.entries(attributes).forEach(([key, value]) => {
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    });
    this.children = [];
    this.parentElement = parent;
    this.isConnected = true;
    this.value = '';
    this.checked = false;
    this.listeners = new Map();
    if (parent) parent.children.push(this);
  }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) {
    return selector.split(',').some((raw) => {
      let simple = raw.trim();
      if (simple.includes('>')) return false;
      let rejected = false;
      simple = simple.replace(/:not\(([^)]+)\)/g, (_, condition) => {
        if (this.matches(condition)) rejected = true;
        return '';
      });
      if (rejected) return false;
      const tag = simple.match(/^[a-z][a-z0-9-]*/i)?.[0];
      if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      for (const match of simple.matchAll(/\.([a-z0-9_-]+)/gi)) {
        if (!String(this.attributes.class || '').split(/\s+/).includes(match[1])) return false;
      }
      for (const match of simple.matchAll(/\[([a-z0-9_-]+)(?:=["']?([^\]"']+)["']?)?\]/gi)) {
        if (!this.hasAttribute(match[1])) return false;
        if (match[2] !== undefined && String(this.getAttribute(match[1])) !== match[2]) return false;
      }
      return true;
    });
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => node.children.forEach((child) => {
      if (child.matches(selector)) result.push(child);
      visit(child);
    });
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  focus() { this.focused = true; }
  contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; }
}

class Form extends Element {
  constructor(id = '', parent = null) {
    super('form', { 'data-role': 'animal-form', 'data-animal-id': id, 'data-stable-form': 'specimen-intake',
      'data-specimen-intake-root': '' }, parent);
    this.fields = { name: 'LOCAL-NEW', classification: 'tarantula', species_id: '501', acquired_date: '2026-08-28', notes: 'Keep this text.' };
    this.elements = { archived: { checked: false } };
  }
}

class FormData {
  constructor(form) { this.values = new Map(Object.entries(form?.fields || {})); }
  get(key) { return this.values.get(key) ?? null; }
  set(key, value) { this.values.set(key, value); }
  has(key) { return this.values.has(key); }
  delete(key) { this.values.delete(key); }
  entries() { return this.values.entries(); }
  [Symbol.iterator]() { return this.entries(); }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createHarness({ wide = false, editId = '', selectedAnimalId = 2 } = {}) {
  const app = new Element();
  const background = new Element('main', {}, app);
  const overlay = new Element('div', { class: 'modal-backdrop', 'data-overlay-backdrop': '' }, app);
  const panel = new Element('section', { class: 'modal', role: 'dialog', 'data-modal': 'animal' }, overlay);
  const form = new Form(editId, panel);
  const calls = { renders: 0, history: [], detail: [], events: [], saves: [], refreshes: 0, pending: [], destroyed: 0, errors: [], searches: [] };
  const state = { page: 'animals', collectionTab: 'animals', authenticated: true, publicMode: false, mockMode: false,
    selectedAnimalId, selectedAnimal: selectedAnimalId ? { id: selectedAnimalId, title: 'Existing selected animal' } : null,
    animals: [{ id: 1, title: 'LOCAL-001' }, { id: 2, title: 'LOCAL-002' }],
    selectedEvents: null, loadingEvents: false, modal: { type: 'animal', data: editId ? { id: editId } : {}, classification: 'tarantula' },
    collectionSelection: { selectedId: null, selectedIds: [], selectionMode: false }, activeAnimalViewId: 'favorites',
    animalSearch: 'retained search', error: null, sheet: null };
  const timers = new Map();
  let timerId = 0;
  const setTimeout = (fn) => { const id = ++timerId; timers.set(id, fn); return id; };
  const clearTimeout = (id) => timers.delete(id);
  const intake = {
    validate: () => true,
    setPending: (value) => calls.pending.push(value),
    clearError: () => {},
    setError: (value) => { calls.errors.push(value); },
    destroy: () => { calls.destroyed += 1; },
    showManual: () => { state.modal.speciesMode = 'manual'; },
    showCatalog: () => { state.modal.speciesMode = 'catalog'; },
    clearSpecies: () => { state.modal.speciesId = ''; },
    setClassification: (value) => { state.modal.classification = value; },
    setFileStatus: () => {}
  };
  const services = {
    animals: {
      get: async (id) => { calls.detail.push(id); return state.animals.find((animal) => String(animal.id) === String(id)) || null; },
      create: async (payload) => { calls.saves.push({ method: 'create', payload }); return { success: true, id: 901 }; },
      update: async (id, payload) => { calls.saves.push({ method: 'update', id, payload }); return { success: true, data: { id } }; }
    },
    care: { listEvents: async (id) => { calls.events.push(id); return { events: [] }; } },
    session: { get: async () => ({ authenticated: true }) }
  };
  const sandbox = {
    app, state, services, console, FormData, File: class File {}, HTMLFormElement: Form,
    AbortController, setTimeout, clearTimeout,
    window: { setTimeout, clearTimeout, scrollTo() {} },
    requestAnimationFrame: (fn) => fn(),
    matchMedia: () => ({ matches: wide }),
    pendingPageFocus: false, collectionClickTimer: null, animalDetailRequestId: 0,
    specimenIntakeController: intake,
    render: () => { calls.renders += 1; },
    saveCurrentRouteScroll: () => {},
    commitCurrentRoute: (mode) => calls.history.push({ mode, page: state.page, id: state.selectedAnimalId }),
    mockSpecimenEvents: () => [],
    syncSpecimenIntakeController: () => intake,
    refreshAnimalsAndCare: async () => { calls.refreshes += 1; },
    applyServerFieldErrors: () => false,
    showToast: () => {},
    enqueueOffline: () => { throw new Error('Unexpected offline path in this test'); },
    offlineQueue: { setOwner() {} },
    busyBlockedActions: new Set(), globalGuardedActions: new Set(), overlayGuardedActions: new Set(),
    isDialogMutationBusy: () => false,
    hasSheetOpen: () => Boolean(state.sheet),
    overlayController: { activePanel: panel },
    formSafety: { guard: () => false, flush() {}, markSubmitted() {} },
    collectionSearchController: { compositionStart() {}, compositionEnd() {}, input() {} },
    syncDateFieldDisplay() {},
    validateForm: () => true,
    captureFormState: () => ({}), restoreFormState() {}, setFormPending() {}, setDialogPending() {},
    selectCollectionAnimal: (id) => { state.collectionSelection.selectedId = String(id); },
    toggleCollectionAnimal: (selection, id) => ({ ...selection, selectedIds: [...selection.selectedIds, String(id)] }),
    navigateRoute: async (page) => { state.page = page; },
    localStorage: { setItem() {} }
  };
  vm.createContext(sandbox);
  const sources = [
    read('assets/app/features/specimen/public-settings.js').replace(/^import .*;\r?\n/gm, '').replace(/\bexport\s+/g, ''),
    read('assets/app/api/error-handler.js').replace(/\bexport\s+/g, ''),
    read('assets/app/features/settings/plan-controller.js').replace(/^import .*;\r?\n/gm, '').replace(/\bexport\s+/g, ''),
    'const planControls = createPlanController({ root: app, services, getProfile: () => ({}), render, notify: showToast });',
    read('assets/app/features/collection/interaction.js').replace(/\bexport\s+(?=(?:const|function|class)\b)/g, ''),
    read('assets/app/features/specimen-intake/species-combobox.js').replace(/\bexport\s+(?=(?:const|function|class)\b)/g, ''),
    declaration(read('assets/app/components/overlay-controller.js'), 'resolveActionInvocation'),
    ...['isDesktopCollection', 'openSpecimenIntake', 'openAnimal', 'handleApiError', 'formDataObject', 'submitAnimal'].map((name) => declaration(appSource, name)),
    "const mutationFormHandlers = [['[data-role=\"animal-form\"]', submitAnimal]];",
    ...['click', 'keydown', 'dblclick', 'compositionstart', 'compositionend', 'input', 'change', 'submit'].map(listener)
  ];
  vm.runInContext(sources.join('\n\n'), sandbox, { filename: 'real-app-delegation-and-intake.js' });
  sandbox.speciesComboboxController = sandbox.createSpeciesComboboxController({
    search: async (query) => { calls.searches.push(query); return [{ id: 501, scientific_name: 'Typhochlaena seladonia' }]; },
    update() {},
    onSelect: (species) => { state.modal.speciesId = species.id; },
    schedule: setTimeout, cancelSchedule: clearTimeout
  });
  return { app, background, overlay, panel, form, state, calls, services, sandbox, intake,
    make: (tag, attrs = {}, parent = form) => new Element(tag, attrs, parent),
    async dispatch(type, target, extra = {}) {
      const event = { target, key: '', detail: 1, defaultPrevented: false, isComposing: false,
        preventDefault() { this.defaultPrevented = true; }, ...extra };
      await app.listeners.get(type)?.(event);
      return event;
    },
    async flushTimers() {
      const scheduled = [...timers.values()];
      timers.clear();
      scheduled.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    },
    pendingTimers: () => timers.size,
    navigation: () => JSON.parse(JSON.stringify({ page: state.page, selectedAnimalId: state.selectedAnimalId,
      selectedAnimal: state.selectedAnimal, selection: state.collectionSelection, activeAnimalViewId: state.activeAnimalViewId,
      animalSearch: state.animalSearch, history: calls.history }))
  };
}

module.exports = { createHarness, deferred, Element, Form, FormData, appSource };
