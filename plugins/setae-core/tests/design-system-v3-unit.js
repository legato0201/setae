const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

const tokens = read('assets/app/styles/tokens.css');
const reset = read('assets/app/styles/reset.css');
const foundation = read('assets/app/styles/foundation.css');
const components = read('assets/app/styles/components.css');
const workbenchComponents = read('assets/app/styles/components/workbench.css');
const mediaComponents = read('assets/app/styles/components/media.css');
const specimenCardComponents = read('assets/app/styles/components/specimen-card.css');
const updateNoticeComponents = read('assets/app/styles/components/update-notice.css');
const appFrame = read('assets/app/styles/app-frame.css');
const workspacePattern = read('assets/app/styles/patterns/workspace.css');
const registryPattern = read('assets/app/styles/patterns/registry.css');
const taskWorkspacePattern = read('assets/app/styles/patterns/task-workspace.css');
const authScreen = read('assets/app/styles/screens/auth.css');
const collectionEditorScreen = read('assets/app/styles/screens/collection-editor.css');
const collectionScreen = read('assets/app/styles/screens/collection.css');
const todayScreen = read('assets/app/styles/screens/today.css');
const qr = read('assets/app/styles/screens/qr.css');
const shell = read('includes/frontend/class-setae-app-shell.php');
const icons = read('assets/app/components/icons.js');
const primitives = read('assets/app/components/primitives.js');
const today = read('assets/app/pages/today.js');
const tasks = read('assets/app/features/tasks/view.js');
const collection = read('assets/app/features/collection/view.js');

function assertBalancedCss(source, label) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const character of clean) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    assert.ok(depth >= 0, `${label} closes a block before it opens`);
  }
  assert.equal(depth, 0, `${label} must have balanced blocks`);
}

assert.match(tokens, /^@layer reset, foundation, components, app-frame, patterns, screens, utilities;/);
assert.match(reset, /^@layer reset\s*\{/);
assert.match(foundation, /^@layer foundation\s*\{/);
assert.match(components, /^@layer components\s*\{/);
assert.match(mediaComponents, /^@layer components\s*\{/);
assert.match(specimenCardComponents, /^@layer components\s*\{/);
assert.match(taskWorkspacePattern, /^@layer patterns\s*\{/);
assert.match(authScreen, /^@layer screens\s*\{/);
assert.match(collectionEditorScreen, /^@layer screens\s*\{/);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/layouts.css')), false);
assert.match(qr, /^@layer screens\s*\{/);

[
  ['--type-micro', '.6875rem'],
  ['--type-caption', '.75rem'],
  ['--type-body', '.875rem'],
  ['--type-heading', '1rem'],
  ['--type-section', '1.25rem'],
  ['--type-page', '1.75rem'],
  ['--type-hero', '2.5rem'],
  ['--radius-control', '5px'],
  ['--radius-surface', '8px'],
  ['--radius-overlay', '12px'],
  ['--radius-round', '999px'],
  ['--touch-target', '44px'],
].forEach(([name, value]) => {
  assert.match(tokens, new RegExp(`${name}:\\s*${value.replace('.', '\\.')}`), `Missing ${name}`);
});

['4px', '8px', '12px', '16px', '24px', '32px', '48px'].forEach((value, index) => {
  assert.match(tokens, new RegExp(`--space-${index + 1}:\\s*${value}`));
});

const enqueueOrder = [
  'setae-gui-tokens',
  'setae-gui-reset',
  'setae-gui-foundation',
  'setae-gui-components',
  'setae-gui-workbench-components',
  'setae-gui-media-component',
  'setae-gui-specimen-card-component',
  'setae-gui-update-notice-component',
  'setae-gui-app-frame',
  'setae-gui-workspace-pattern',
  'setae-gui-registry-pattern',
  'setae-gui-task-workspace-pattern',
  'setae-gui-auth-screen',
  'setae-gui-collection-screen',
  'setae-gui-qr-screen',
].map((handle) => shell.indexOf(`'${handle}'`));
enqueueOrder.forEach((position) => assert.notEqual(position, -1));
assert.deepEqual(enqueueOrder, [...enqueueOrder].sort((a, b) => a - b));

assert.match(components, /\.button\s*\{/);
assert.match(components, /\.icon-button\s*\{/);
assert.match(components, /\.search-control\s*\{/);
assert.match(components, /\.surface\s*\{/);
assert.match(components, /\.tabs\s*\{/);
assert.match(components, /\.menu-popover\s*,[\s\S]*?\.popover\s*\{/);
assert.match(components, /\.status-chip\s*\{/);
assert.match(components, /\.empty-state\s*\{/);
assert.match(components, /\.data-row\s*\{/);
assert.match(components, /\.feedback/);
assert.match(components, /\.loading-state\s*\{/);
assert.match(components, /\.loading-skeleton\s*,[\s\S]*?\.skeleton\s*\{/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*?--touch-target/);

const architectureCss = [reset, foundation, components, workbenchComponents, mediaComponents, specimenCardComponents, updateNoticeComponents, qr, appFrame, workspacePattern, registryPattern, taskWorkspacePattern, authScreen, collectionEditorScreen, collectionScreen, todayScreen];

architectureCss.forEach((css) => {
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'V3 CSS must use semantic color tokens');
  assert.doesNotMatch(css, /font-size:\s*clamp\(/i, 'Typography must not scale with viewport width');
});

[tokens, ...architectureCss].forEach((css, index) => {
  assertBalancedCss(css, ['tokens', 'reset', 'foundation', 'components', 'workbenchComponents', 'mediaComponents', 'specimenCardComponents', 'updateNoticeComponents', 'qr', 'appFrame', 'workspacePattern', 'registryPattern', 'taskWorkspacePattern', 'authScreen', 'collectionEditorScreen', 'collectionScreen', 'todayScreen'][index]);
});

[foundation, components, workbenchComponents, mediaComponents, specimenCardComponents, updateNoticeComponents, appFrame, workspacePattern, registryPattern, taskWorkspacePattern, authScreen, collectionEditorScreen, collectionScreen, todayScreen].forEach((css) => {
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|10)px/i, 'Screen UI text must be at least 11px');
});

qr.split('\n').filter((line) => /font-size:\s*(?:[0-9]|10)px/i.test(line)).forEach((line) => {
  assert.match(line, /^\.field-label/, `Only the physical field label may use sub-11px text: ${line}`);
});

assert.match(foundation, /\.scientific-name[\s\S]*?font-family:\s*var\(--font-taxon\)/);
assert.match(foundation, /\.animal-code[\s\S]*?font-family:\s*var\(--font-mono\)/);
assert.match(reset, /letter-spacing:\s*0/);
assert.match(todayScreen, /\.care-task-row\.is-overdue[\s\S]*?var\(--warning\)/);
assert.match(todayScreen, /\.dashboard-sections\.is-editing[\s\S]*?\.widget/);

['close', 'chevronRight', 'chevronLeft', 'edit', 'trash', 'search', 'filter', 'minus'].forEach((name) => {
  assert.match(icons, new RegExp(`\\b${name}:`), `Missing SVG icon: ${name}`);
});
assert.match(primitives, /export function iconButton/);
assert.match(primitives, /export function button/);
assert.match(primitives, /export function searchControl/);
assert.match(primitives, /export function textField/);
assert.match(primitives, /export function textareaField/);
assert.match(primitives, /export function selectField/);
assert.match(primitives, /export function tabs/);
assert.match(primitives, /export function segmentedControl/);
assert.match(primitives, /export function modal/);
assert.match(primitives, /export function sheet/);
assert.match(primitives, /export function progress/);
assert.match(primitives, /export function navigationItem/);
assert.match(primitives, /export function selectControl/);
assert.match(primitives, /export function checkboxControl/);
assert.match(primitives, /export function statusIndicator/);
assert.match(today, /iconButton\('settings'/);
assert.match(tasks, /iconButton\('more'/);
assert.match(collection, /searchControl\(/);
assert.match(collection, /collection-workbench-v4/);
assert.doesNotMatch(collection, /NATURAL HISTORY COLLECTION/);

assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/natural-history.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/app.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/wordpress.css')), false);

console.log('Design System v3 tests passed');
