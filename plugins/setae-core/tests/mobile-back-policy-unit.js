const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/features/navigation/controller.js'), 'utf8')
  .replace(/export\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`${source}\nthis.resolveBackPriority = resolveBackPriority;`, context);
const resolve = context.resolveBackPriority;

assert.equal(resolve({ menuOpen: true, modalOpen: true, sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-menu');
assert.equal(resolve({ modalOpen: true, sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-modal');
assert.equal(resolve({ sheetOpen: true, selectionMode: true, nestedRoute: true }), 'close-sheet');
assert.equal(resolve({ selectionMode: true, nestedRoute: true }), 'exit-selection');
assert.equal(resolve({ nestedRoute: true }), 'nested-route');
assert.equal(resolve({}), 'history');

const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
assert.match(app, /async function requestBack/);
assert.match(app, /action === 'close-modal'\) closeModalForBack\(\)/);
assert.match(app, /action === 'exit-selection'\)\s*\{[\s\S]*?state\.collectionSelection = clearCollectionSelection/);
assert.match(app, /action === 'back-animals'\) \{ await requestBack\(\)/);
assert.match(app, /window\.addEventListener\('popstate',[\s\S]*?requestBack\(\{ fromPopstate: true/);

function appFunction(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = app.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, `Production function ${name} must exist`);
  return app.slice(start, end + 2);
}

// Execute the actual app policy against a history stack. Native Back has already
// moved the stack when popstate arrives; consuming a local layer must repair it.
function backHarness({ menuOpen = false, selecting = false, modal = null, guardOpen = false, dirty = false } = {}) {
  const state = { page: 'animals', modal, collectionSelection: { selectionMode: selecting }, animalSearch: 'kept' };
  const entries = [{ page: 'today', index: 0 }, { page: 'animals', index: 1 }];
  const calls = { renders: 0, pushes: 0, restores: [], guards: 0, canceled: 0, continued: 0 };
  let cursor = 1;
  let confirmation = guardOpen;
  let continuation = null;
  const formScope = { type: 'form' };
  const confirmationScope = { type: 'confirmation' };
  const menu = { removeAttribute() { menuOpen = false; } };
  const localApp = { querySelector: () => menuOpen ? menu : null };
  const history = {
    get state() { return entries[cursor]; },
    pushState(route) { entries.splice(cursor + 1); entries.push(route); cursor += 1; calls.pushes += 1; },
    back() { cursor -= 1; }
  };
  const formSafety = {
    cancelGuard() { if (!confirmation) return false; confirmation = false; calls.canceled += 1; return true; },
    guard(next, { scope }) {
      calls.guards += 1;
      if (!dirty || scope === confirmationScope) return false;
      confirmation = true;
      continuation = next;
      return true;
    }
  };
  const runtime = vm.createContext({
    state, app: localApp, history, formSafety, resolveBackPriority: resolve,
    navigationIndex: 1, window: { scrollY: 240 },
    overlayController: { get activePanel() { return { closest: () => confirmation ? confirmationScope : formScope }; } },
    captureRoute: (scrollY) => ({ page: state.page, index: 1, scrollY }),
    currentHistoryUrl: () => '/setae/app/',
    clearCollectionSelection: () => ({ selectionMode: false }),
    render() { calls.renders += 1; },
    speciesComboboxController: { clear() {} },
    resetQuickRecord() {},
    async restoreRoute(route) { calls.restores.push(route); state.page = route.page; },
    async navigateRoute(page) { state.page = page; }
  });
  ['hasSheetOpen', 'closeSheetForBack', 'closeModalForBack', 'isDialogMutationBusy', 'isNestedRoute', 'requestBack']
    .forEach((name) => vm.runInContext(appFunction(name), runtime));
  return {
    state, calls, history, entries, runtime,
    confirmationOpen: () => confirmation,
    async nativeBack() { history.back(); return runtime.requestBack({ fromPopstate: true, poppedState: history.state }); },
    async confirmDiscard() { const action = continuation; confirmation = false; dirty = false; calls.continued += 1; return action(); }
  };
}

(async () => {
  for (const options of [{ menuOpen: true }, { selecting: true }]) {
    const harness = backHarness(options);
    await harness.nativeBack();
    assert.equal(harness.state.page, 'animals');
    assert.equal(harness.history.state.page, 'animals', 'Closing a local layer must not leave the history on Today');
    assert.equal(harness.state.animalSearch, 'kept');
    assert.equal(harness.calls.pushes, 1);
    await harness.nativeBack();
    assert.equal(harness.state.page, 'today', 'The next Back must visit Today, not skip it');
  }

  for (const fromPopstate of [false, true]) {
    const modal = { type: 'animal', draft: { name: 'UNSAVED', notes: 'keep input' } };
    const harness = backHarness({ modal, guardOpen: true, dirty: true });
    const result = fromPopstate ? await harness.nativeBack() : await harness.runtime.requestBack();
    assert.equal(result, 'continue-editing');
    assert.equal(harness.state.modal, modal, 'Back on discard confirmation must preserve the original modal');
    assert.deepEqual(modal.draft, { name: 'UNSAVED', notes: 'keep input' });
    assert.equal(harness.confirmationOpen(), false);
    assert.equal(harness.calls.canceled, 1);
    assert.equal(harness.calls.guards, 0, 'A confirmation without a form must not re-run the underlying close policy');
    assert.equal(harness.calls.renders, 0, 'Canceling confirmation must not re-render the original inputs');
    assert.equal(harness.history.state.page, 'animals');
    assert.equal(harness.calls.pushes, fromPopstate ? 1 : 0);
  }

  // The production overlay handler is registered before form-safety's Escape
  // handler and stops propagation. Its fallback must reach the same safe Back.
  const overlaySource = fs.readFileSync(path.join(root, 'assets/app/components/overlay-controller.js'), 'utf8')
    .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
  const overlayRuntime = vm.createContext({});
  vm.runInContext(`${overlaySource}\nthis.create = createOverlayController;`, overlayRuntime);
  const escapeModal = { type: 'animal', draft: { name: 'Keyboard input' } };
  const escapeHarness = backHarness({ modal: escapeModal, guardOpen: true, dirty: true });
  let overlayKeyDown;
  let escapeRequest;
  let propagationStopped = false;
  const backdrop = { dataset: {} };
  const panel = {
    hidden: false, getAttribute: () => null, querySelector: () => null,
    closest: () => backdrop, classList: { contains: () => false }
  };
  overlayRuntime.create({ querySelectorAll: () => [panel], addEventListener() {} }, {
    documentRef: { addEventListener(type, handler) { if (type === 'keydown') overlayKeyDown = handler; } },
    windowRef: { getComputedStyle: () => ({ display: 'block', visibility: 'visible', zIndex: '100' }) },
    onRequestClose() { escapeRequest = escapeHarness.runtime.requestBack(); }
  });
  overlayKeyDown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() { propagationStopped = true; } });
  await escapeRequest;
  assert.equal(propagationStopped, true);
  assert.equal(escapeHarness.state.modal, escapeModal);
  assert.equal(escapeHarness.calls.canceled, 1);
  assert.equal(escapeHarness.calls.renders, 0);

  const dirtyModal = backHarness({ modal: { type: 'animal' }, dirty: true });
  assert.equal(await dirtyModal.nativeBack(), 'guarded');
  assert.equal(dirtyModal.calls.pushes, 1);
  await dirtyModal.confirmDiscard();
  assert.equal(dirtyModal.state.modal, null);
  assert.equal(dirtyModal.calls.pushes, 1, 'Confirming a consumed popstate must not add a second history entry');
  await dirtyModal.nativeBack();
  assert.equal(dirtyModal.state.page, 'today');

  const dirtyPage = backHarness({ dirty: true });
  assert.equal(await dirtyPage.nativeBack(), 'guarded');
  await dirtyPage.confirmDiscard();
  await dirtyPage.runtime.requestBack({ fromPopstate: true, poppedState: dirtyPage.history.state });
  assert.equal(dirtyPage.state.page, 'today');
  assert.equal(dirtyPage.calls.pushes, 1, 'An explicitly discarded page follows one normal history traversal');

  const busy = backHarness({ modal: { type: 'animal', submitting: true } });
  assert.equal(await busy.nativeBack(), 'busy');
  assert.equal(busy.state.modal.submitting, true);
  assert.equal(busy.history.state.page, 'animals');

  console.log('Mobile back policy tests passed (actual app history and confirmation behavior)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
