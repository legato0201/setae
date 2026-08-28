const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/features/navigation/gesture-model.js'), 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`${source}\nthis.exports = { createEdgeSwipeGesture, evaluateEdgeSwipe, EDGE_SWIPE_START_MAX, EDGE_SWIPE_DISTANCE_MIN };`, context);
const { createEdgeSwipeGesture, evaluateEdgeSwipe } = context.exports;

assert.equal(createEdgeSwipeGesture({ x: 27, y: 100, allowed: true }), null);
assert.equal(createEdgeSwipeGesture({ x: 12, y: 100, allowed: false }), null);
const gesture = createEdgeSwipeGesture({ x: 12, y: 100, time: 100, allowed: true });
assert.equal(evaluateEdgeSwipe(gesture, { x: 83, y: 105, time: 500 }, { viewportWidth: 320 }).complete, false);
assert.equal(evaluateEdgeSwipe(gesture, { x: 94, y: 108, time: 500 }, { viewportWidth: 320 }).complete, true);
assert.equal(evaluateEdgeSwipe(gesture, { x: 100, y: 180, time: 500 }, { viewportWidth: 320 }).complete, false);

const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
assert.match(app, /navigator\.standalone === true \|\| matchMedia\('\(display-mode: standalone\)'\)\.matches/);
assert.match(app, /!state\.collectionSelection\.selectionMode/);
assert.match(app, /createMobileGestureController/);
assert.doesNotMatch(app, /touchstart|touchmove|touchend/);

console.log('Edge swipe back tests passed');
