const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/runtime/native-viewport-controller.js'), 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { keyboardOpenForViewport, createViewportSnapshot, createNativeViewportController };`, context);
const { keyboardOpenForViewport, createViewportSnapshot, createNativeViewportController } = context.api;

assert.equal(keyboardOpenForViewport({ editableFocused: true, layoutHeight: 800, visualHeight: 500 }), true);
assert.equal(keyboardOpenForViewport({ editableFocused: false, layoutHeight: 800, visualHeight: 500 }), false);
assert.equal(keyboardOpenForViewport({ editableFocused: true, layoutHeight: 800, visualHeight: 700 }), false);
assert.doesNotMatch(source, /userAgent|iPhone|Android/i, 'viewport logic must not branch on user agent');

const cssValues = new Map();
let scrolled = 0;
const field = {
  matches: () => true,
  getBoundingClientRect: () => ({ top: 650, bottom: 700 }),
  scrollIntoView: (options) => { scrolled += 1; assert.equal(options.block, 'nearest'); }
};
const listeners = new Map();
const viewport = {
  width: 390,
  height: 500,
  offsetTop: 0,
  addEventListener(type, callback) { listeners.set(`viewport:${type}`, callback); },
  removeEventListener() {}
};
const rootElement = {
  dataset: {},
  style: { setProperty(name, value) { cssValues.set(name, value); } }
};
const documentRef = {
  activeElement: field,
  documentElement: rootElement,
  addEventListener(type, callback) { listeners.set(`document:${type}`, callback); },
  removeEventListener() {}
};
const windowRef = {
  innerWidth: 390,
  innerHeight: 800,
  visualViewport: viewport,
  navigator: { standalone: true },
  matchMedia: () => ({ matches: true }),
  addEventListener(type, callback) { listeners.set(`window:${type}`, callback); },
  removeEventListener() {},
  requestAnimationFrame(callback) { callback(); return 1; },
  cancelAnimationFrame() {},
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {}
};

const snapshot = createViewportSnapshot({ windowRef, documentRef });
assert.equal(snapshot.keyboardOpen, true);
assert.equal(snapshot.keyboardInset, 300);
assert.equal(snapshot.standalone, true);
const controller = createNativeViewportController({ windowRef, documentRef }).start();
assert.equal(rootElement.dataset.setaeKeyboardOpen, 'true');
assert.equal(cssValues.get('--setae-visual-viewport-height'), '500px');
assert.equal(cssValues.get('--setae-keyboard-inset'), '300px');
assert.ok(scrolled >= 1, 'hidden focused field must be brought into the visual viewport');
assert.equal(controller.snapshot().visualWidth, 390);
controller.stop();

// Use queued frames to model focus/layout ordering, including callbacks that
// must not run after a controller is stopped or a different field is focused.
const pendingFrames = new Map();
const pendingTimers = new Map();
let nextHandle = 0;
const eventHandlers = new Map();
const scrollBody = { parentElement: null, getBoundingClientRect: () => ({ top: 100, bottom: 420 }) };
const makeField = (top, bottom, parentElement = null) => ({
  matches: () => true, parentElement, reveals: 0,
  getBoundingClientRect: () => ({ top, bottom }),
  scrollIntoView(options) { this.reveals += 1; assert.equal(options.block, 'nearest'); }
});
const firstField = makeField(620, 664);
const secondField = makeField(550, 594);
const footerCoveredField = makeField(430, 474, scrollBody);
const visibleField = makeField(200, 244, scrollBody);
const asyncDocument = {
  ...documentRef, activeElement: firstField,
  addEventListener(type, callback) { eventHandlers.set(`document:${type}`, callback); },
  removeEventListener(type) { eventHandlers.delete(`document:${type}`); }
};
const asyncViewport = {
  ...viewport, height: 500, offsetTop: 0,
  addEventListener(type, callback) { eventHandlers.set(`viewport:${type}`, callback); },
  removeEventListener(type) { eventHandlers.delete(`viewport:${type}`); }
};
const asyncWindow = {
  ...windowRef, visualViewport: asyncViewport,
  getComputedStyle: (element) => ({ overflowY: element === scrollBody ? 'auto' : 'visible' }),
  addEventListener(type, callback) { eventHandlers.set(`window:${type}`, callback); },
  removeEventListener(type) { eventHandlers.delete(`window:${type}`); },
  requestAnimationFrame(callback) { const id = ++nextHandle; pendingFrames.set(id, callback); return id; },
  cancelAnimationFrame(id) { pendingFrames.delete(id); },
  setTimeout(callback) { const id = ++nextHandle; pendingTimers.set(id, callback); return id; },
  clearTimeout(id) { pendingTimers.delete(id); }
};
const nextFrame = () => {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  callbacks.forEach((callback) => callback());
};
const settleFrames = () => { nextFrame(); nextFrame(); };
const asyncController = createNativeViewportController({ windowRef: asyncWindow, documentRef: asyncDocument }).start();
settleFrames();
assert.equal(firstField.reveals, 1);
asyncDocument.activeElement = secondField;
eventHandlers.get('document:focusin')();
settleFrames();
assert.equal(secondField.reveals, 1, 'Next input must be revealed even though the keyboard remains open');
asyncDocument.activeElement = footerCoveredField;
eventHandlers.get('document:focusin')();
settleFrames();
assert.equal(footerCoveredField.reveals, 1, 'A save footer can cover an input inside the visual viewport');
asyncViewport.height = 440;
eventHandlers.get('viewport:resize')();
settleFrames();
assert.equal(footerCoveredField.reveals, 2, 'Keyboard height changes must recheck the current input');
asyncViewport.offsetTop = 10;
eventHandlers.get('viewport:scroll')();
settleFrames();
assert.equal(footerCoveredField.reveals, 2, 'Viewport scrolling alone must not fight deliberate scrolling');
asyncDocument.activeElement = visibleField;
eventHandlers.get('document:focusin')();
settleFrames();
assert.equal(visibleField.reveals, 0, 'An already visible field must stay still');

asyncDocument.activeElement = secondField;
eventHandlers.get('document:focusin')();
nextFrame(); // Measurement has queued a reveal for secondField.
asyncDocument.activeElement = visibleField;
nextFrame();
assert.equal(secondField.reveals, 1, 'A stale focus callback must not scroll the previous field');
asyncController.measure();
eventHandlers.get('document:focusout')();
asyncController.stop();
assert.equal(pendingFrames.size, 0);
assert.equal(pendingTimers.size, 0);
assert.equal(eventHandlers.size, 0);
settleFrames();
assert.equal(visibleField.reveals, 0);

asyncDocument.activeElement = firstField;
asyncController.start();
settleFrames();
assert.equal(firstField.reveals, 2, 'Restarting the controller must measure and reveal again');
asyncDocument.activeElement = secondField;
eventHandlers.get('document:focusin')();
nextFrame();
asyncViewport.height = 800; // Keyboard closes before the queued reveal runs.
eventHandlers.get('viewport:resize')();
settleFrames();
assert.equal(secondField.reveals, 1, 'A pending reveal must use the live viewport after the keyboard closes');
assert.equal(asyncController.snapshot().keyboardOpen, false);
asyncController.stop();

const tokens = fs.readFileSync(path.join(root, 'assets/app/styles/tokens.css'), 'utf8');
const frameCss = fs.readFileSync(path.join(root, 'assets/app/styles/app-frame.css'), 'utf8');
['--setae-visual-viewport-height', '--setae-visual-viewport-offset-top', '--setae-keyboard-inset', '--setae-layout-viewport-height'].forEach((token) => assert.match(tokens, new RegExp(token)));
assert.match(frameCss, /data-setae-keyboard-open="true"[^}]*\.mobile-navigation/);

console.log('UI System v4 native viewport tests passed');
