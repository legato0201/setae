const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'assets/app/features/navigation/gesture-model.js'), 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${modelSource}\nthis.exports = { createEdgeSwipeGesture, evaluateEdgeSwipe, createSheetGesture, evaluateSheetGesture, createTabGesture, evaluateTabGesture, isGestureTargetBlocked, hasHorizontalScrollableAncestor, gestureStates };`, context);
const model = context.exports;

assert.equal(Array.from(model.gestureStates).join(','), 'idle,possible,tracking,committing,cancelling');
assert.equal(model.createEdgeSwipeGesture({ x: 27, y: 40, allowed: true }), null);
assert.equal(model.createEdgeSwipeGesture({ x: 10, y: 40, allowed: false }), null);

const edge = model.createEdgeSwipeGesture({ x: 10, y: 100, time: 100, allowed: true });
assert.equal(model.evaluateEdgeSwipe(edge, { x: 108, y: 105, time: 500 }, { viewportWidth: 390 }).complete, true);
assert.equal(model.evaluateEdgeSwipe(edge, { x: 70, y: 104, time: 190 }, { viewportWidth: 390 }).complete, true, 'velocity may commit after 48px');
assert.equal(model.evaluateEdgeSwipe(edge, { x: 50, y: 180, time: 500 }, { viewportWidth: 390 }).verticalCancel, true);

const sheet = model.createSheetGesture({ x: 100, y: 20, time: 100 });
assert.equal(model.evaluateSheetGesture(sheet, { x: 104, y: 121, time: 500 }, { panelHeight: 400 }).complete, true);
assert.equal(model.evaluateSheetGesture(sheet, { x: 102, y: 78, time: 190 }, { panelHeight: 600 }).complete, true);
assert.equal(model.evaluateSheetGesture(sheet, { x: 190, y: 40, time: 500 }, { panelHeight: 400 }).horizontalCancel, true);

const tab = model.createTabGesture({ x: 300, y: 200, time: 100 });
assert.equal(model.evaluateTabGesture(tab, { x: 220, y: 205, time: 500 }, { panelWidth: 390 }).direction, 'next');
assert.equal(model.evaluateTabGesture(tab, { x: 220, y: 205, time: 500 }, { panelWidth: 390 }).complete, true);
assert.equal(model.evaluateTabGesture(tab, { x: 370, y: 205, time: 500 }, { panelWidth: 390 }).direction, 'previous');

assert.equal(model.isGestureTargetBlocked({ closest: () => ({}) }), true);
assert.equal(model.isGestureTargetBlocked({ closest: () => null }), false);
assert.equal(model.hasHorizontalScrollableAncestor({ nodeType: 1, scrollWidth: 400, clientWidth: 200, parentElement: null, hasAttribute: () => false }, {
  windowRef: { getComputedStyle: () => ({ overflowX: 'auto' }) }
}), true);

const controller = fs.readFileSync(path.join(root, 'assets/app/runtime/mobile-gesture-controller.js'), 'utf8');
assert.match(controller, /pointerdown/);
assert.match(controller, /setPointerCapture/);
assert.match(controller, /releasePointerCapture/);
assert.match(controller, /keyboardOpen\(\)/);
assert.match(controller, /onRequestBack\(\)/);
assert.match(controller, /onSheetDismiss\(current\.panel\)/);
assert.match(controller, /onSpecimenTabChange\(metrics\.direction\)/);
assert.doesNotMatch(controller, /touchstart|touchmove|touchend/);

const css = fs.readFileSync(path.join(root, 'assets/app/styles/components/mobile-gestures.css'), 'utf8');
const componentsCss = fs.readFileSync(path.join(root, 'assets/app/styles/components.css'), 'utf8');
assert.match(componentsCss, /\.sheet-handle[\s\S]*?touch-action: none/);
assert.match(css, /\[data-specimen-tab-content\][\s\S]*touch-action: pan-y/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(css, /(?:^|[\s,{])(?:html|body|#app)\s*\{[^}]*touch-action:\s*none/s);

console.log('Mobile gesture model unit checks passed');
