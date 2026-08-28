const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const components = read('assets/app/styles/components.css');
const registry = read('assets/app/styles/patterns/registry.css');
const asyncState = read('assets/app/components/async-state.js');
const app = read('assets/app/app.js');
const actionMenu = read('assets/app/styles/components/action-menu.css');
const updateNotice = read('assets/app/styles/components/update-notice.css');
const feedback = read('assets/app/styles/components/feedback.css');
const feedbackController = read('assets/app/components/feedback-controller.js');

assert.match(components, /\.button\s*\{/);
assert.match(components, /\.button:hover\s*\{/);
assert.match(components, /\.button:active,/);
assert.match(components, /\.button:focus-visible,/);
assert.match(components, /\.button:disabled,/);
assert.match(components, /\.button\[aria-busy="true"\]\s*\{[^}]*--button-busy-inline-size/s);
assert.match(components, /\.icon-button:hover\s*\{/);
assert.match(components, /\.tabs > button\.is-active,[\s\S]*background:\s*transparent[\s\S]*font-weight:\s*var\(--weight-semibold\)/s);
assert.match(components, /\.segmented button\.is-active,[\s\S]*background:\s*var\(--bg-surface\)/s);
assert.match(components, /\.field\.is-error input,[\s\S]*border-color:\s*var\(--danger\)/s);
assert.match(components, /\.field input:disabled,[\s\S]*opacity:\s*\.56/s);
assert.match(asyncState, /getBoundingClientRect\(\)\.width/);
assert.match(asyncState, /setProperty\('--button-busy-inline-size'/);
assert.match(feedback, /\.toast\s*\{[^}]*var\(--shadow-toast\)/s);
assert.match(app, /state\.toast = toastState/);
assert.match(feedbackController, /clearTimer\(timer\)/);
assert.match(feedbackController, /ACTION_TOAST_DURATION = 6000/);
assert.match(registry, /\.registry-table tbody tr\.is-selected,[\s\S]*background:\s*var\(--bg-selected\)/s);
assert.match(components, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none[\s\S]*transition:\s*none/s);
assert.match(actionMenu, /prefers-reduced-motion: reduce[\s\S]*\.action-menu-popover[\s\S]*transform:\s*none/s);
assert.match(updateNotice, /prefers-reduced-motion: reduce[\s\S]*\.app-update-notice[\s\S]*transform:\s*none/s);
assert.doesNotMatch(components, /translateY\([^)]*(?:-[1-9]\d|[1-9]\d)px/);

console.log('UI System v4 interaction craft checks passed');
