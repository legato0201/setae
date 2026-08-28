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

const tokens = fs.readFileSync(path.join(root, 'assets/app/styles/tokens.css'), 'utf8');
const frameCss = fs.readFileSync(path.join(root, 'assets/app/styles/app-frame.css'), 'utf8');
['--setae-visual-viewport-height', '--setae-visual-viewport-offset-top', '--setae-keyboard-inset', '--setae-layout-viewport-height'].forEach((token) => assert.match(tokens, new RegExp(token)));
assert.match(frameCss, /data-setae-keyboard-open="true"[^}]*\.mobile-navigation/);

console.log('UI System v4 native viewport tests passed');
