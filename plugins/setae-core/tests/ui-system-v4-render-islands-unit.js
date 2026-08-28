const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('assets/app/app.js');
const frame = read('assets/app/components/app-frame.js');
const coordinator = read('assets/app/runtime/render-coordinator.js');
const frameCss = read('assets/app/styles/app-frame.css');

assert.match(coordinator, /export function createRenderCoordinator/);
assert.match(coordinator, /appRoot\.innerHTML = asHtml\(html\)/, 'Only the coordinator mount may replace the App root');
assert.match(coordinator, /if \(!force && current === next\)/, 'Unchanged islands must preserve DOM identity');
['mount', 'page', 'chrome', 'overlays', 'feedback', 'updateNotice', 'error', 'all', 'schedule'].forEach((api) => {
  assert.match(coordinator, new RegExp(`\\b${api}\\b`), `Render Coordinator must expose ${api}`);
});

[
  'data-app-frame',
  'data-app-rail-root',
  'data-app-mobile-bar-root',
  'data-app-page-root',
  'data-app-mobile-navigation-root',
  'data-app-overlay-root',
  'data-app-feedback-root',
  'data-app-update-root',
  'data-app-error-root',
  'data-app-sync-root'
].forEach((contract) => assert.match(frame, new RegExp(contract), `Missing App Frame root ${contract}`));

const feedbackCallback = app.slice(app.indexOf('const feedbackController'), app.indexOf('const formSafety'));
assert.match(feedbackCallback, /renderCoordinator\.feedback\(renderAppFeedback\(toastState\)\)/);
assert.doesNotMatch(feedbackCallback, /render\(\);[\s\S]*renderCoordinator\.feedback/, 'Toast must not render the page before feedback');
assert.match(app, /function renderAppIslands/);
assert.match(app, /const regions = renderAppFrameRegions\(options\)/);
assert.match(app, /renderCoordinator\.all\(regions\)/);
assert.match(app, /renderCoordinator\.accept\('page', regions\.page\)/, 'Partial list updates must reconcile the page cache without replacing the page');
assert.doesNotMatch(app, /app\.innerHTML\s*=/, 'app.js must not replace the App root');
assert.match(app, /renderCoordinator\.updateNotice\(appUpdateNotice\(\)\)/);
assert.match(app, /renderCoordinator\.error\(''\)/);
assert.match(frameCss, /\[data-app-page-root\]/);

console.log('UI System v4 render island tests passed');
