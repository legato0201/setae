const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const core = read('includes/class-setae-core.php');
const shell = read('includes/frontend/class-setae-app-shell.php');
const template = read('templates/app-shell.php');
const tokens = read('assets/app/styles/tokens.css');
const reset = read('assets/app/styles/reset.css');
const foundation = read('assets/app/styles/foundation.css');
const components = read('assets/app/styles/components.css');
const workbenchComponents = read('assets/app/styles/components/workbench.css');
const comboboxComponents = read('assets/app/styles/components/combobox.css');
const actionMenuComponents = read('assets/app/styles/components/action-menu.css');
const propertyListComponents = read('assets/app/styles/components/property-list.css');
const activityListComponents = read('assets/app/styles/components/activity-list.css');
const identityPanelComponents = read('assets/app/styles/components/identity-panel.css');
const dataVisualizationComponents = read('assets/app/styles/components/data-visualization.css');
const mediaGridComponents = read('assets/app/styles/components/media-grid.css');
const mediaComponents = read('assets/app/styles/components/media.css');
const specimenCardComponents = read('assets/app/styles/components/specimen-card.css');
const updateNoticeComponents = read('assets/app/styles/components/update-notice.css');
const formSafetyComponents = read('assets/app/styles/components/form-safety.css');
const feedbackComponents = read('assets/app/styles/components/feedback.css');
const progressiveListComponents = read('assets/app/styles/components/progressive-list.css');
const mobileGestureComponents = read('assets/app/styles/components/mobile-gestures.css');
const appFrame = read('assets/app/styles/app-frame.css');
const workspacePattern = read('assets/app/styles/patterns/workspace.css');
const registryPattern = read('assets/app/styles/patterns/registry.css');
const ledgerPattern = read('assets/app/styles/patterns/ledger.css');
const carePlanPattern = read('assets/app/styles/patterns/care-plan.css');
const specimenWorkspacePattern = read('assets/app/styles/patterns/specimen-workspace.css');
const collectionScreen = read('assets/app/styles/screens/collection.css');
const specimenScreen = read('assets/app/styles/screens/specimen.css');
const specimenIntakeScreen = read('assets/app/styles/screens/specimen-intake.css');
const quickRecordScreen = read('assets/app/styles/screens/quick-record.css');
const todayScreen = read('assets/app/styles/screens/today.css');
const recordsScreen = read('assets/app/styles/screens/records.css');
const nurseryScreen = read('assets/app/styles/screens/nursery.css');
const husbandryScreen = read('assets/app/styles/screens/husbandry.css');
const discussionPattern = read('assets/app/styles/patterns/discussion.css');
const taskWorkspacePattern = read('assets/app/styles/patterns/task-workspace.css');
const onboardingPattern = read('assets/app/styles/patterns/onboarding.css');
const authScreen = read('assets/app/styles/screens/auth.css');
const communityScreen = read('assets/app/styles/screens/community.css');
const settingsScreen = read('assets/app/styles/screens/settings.css');
const diagnosticsScreen = read('assets/app/styles/screens/diagnostics.css');
const collectionEditorScreen = read('assets/app/styles/screens/collection-editor.css');
const qr = read('assets/app/styles/screens/qr.css');
const fixture = read('tests/fixtures/gui-v2-unification-preview.html');
const screenCss = [foundation, components, workbenchComponents, comboboxComponents, actionMenuComponents, propertyListComponents, activityListComponents, identityPanelComponents, dataVisualizationComponents, mediaGridComponents, mediaComponents, specimenCardComponents, updateNoticeComponents, formSafetyComponents, feedbackComponents, progressiveListComponents, mobileGestureComponents, appFrame, workspacePattern, registryPattern, ledgerPattern, carePlanPattern, specimenWorkspacePattern, discussionPattern, taskWorkspacePattern, onboardingPattern, authScreen, collectionScreen, collectionEditorScreen, specimenScreen, specimenIntakeScreen, quickRecordScreen, todayScreen, recordsScreen, nurseryScreen, husbandryScreen, communityScreen, settingsScreen, diagnosticsScreen].join('\n');

assert.match(core, /template_include', \$app_shell, 'select_template', 999/);
assert.match(core, /wp_enqueue_scripts', \$app_shell, 'isolate_styles', 999/);
assert.match(core, /wp_print_styles', \$app_shell, 'isolate_styles', 999/);
assert.match(core, /style_loader_tag', \$app_shell, 'filter_style_tag', 999, 2/);

assert.match(shell, /TEMPLATE_RELATIVE_PATH = 'templates\/app-shell\.php'/);
assert.match(shell, /public function select_template/);
assert.match(shell, /public function isolate_styles/);
assert.match(shell, /public function filter_style_tag/);
assert.match(shell, /remove_action\('wp_head', 'wp_custom_css_cb', 101\)/);
[
  'wp-block-library',
  'wp-block-library-theme',
  'classic-theme-styles',
  'global-styles',
  'wp-emoji-styles'
].forEach((handle) => assert.match(shell, new RegExp(`'${handle}'`)));
assert.match(shell, /0 !== strpos\(\(string\) \$handle, 'setae-gui-'\)/);
assert.match(shell, /0 === strpos\(\(string\) \$handle, 'setae-gui-'\) \? \$html : ''/);

assert.match(template, /^<\?php/);
assert.match(template, /<!doctype html>/i);
assert.match(template, /Setae_App_Shell::render_mount\(\)/);
assert.match(template, /wp_head\(\)/);
assert.match(template, /wp_footer\(\)/);
assert.doesNotMatch(template, /get_header|get_footer|the_content|body_class/);

const enqueuedStyles = [...shell.matchAll(/styles\/([a-z/-]+\.css)/g)].map((match) => match[1]);
assert.deepEqual(enqueuedStyles, ['tokens.css', 'reset.css', 'foundation.css', 'components.css', 'components/workbench.css', 'components/combobox.css', 'components/action-menu.css', 'components/property-list.css', 'components/activity-list.css', 'components/identity-panel.css', 'components/data-visualization.css', 'components/media-grid.css', 'components/media.css', 'components/specimen-card.css', 'components/update-notice.css', 'components/form-safety.css', 'components/feedback.css', 'components/progressive-list.css', 'components/mobile-gestures.css', 'app-frame.css', 'patterns/workspace.css', 'patterns/registry.css', 'patterns/ledger.css', 'patterns/care-plan.css', 'patterns/specimen-workspace.css', 'patterns/discussion.css', 'patterns/task-workspace.css', 'patterns/onboarding.css', 'screens/auth.css', 'screens/collection.css', 'screens/collection-editor.css', 'screens/specimen.css', 'screens/specimen-intake.css', 'screens/quick-record.css', 'screens/today.css', 'screens/records.css', 'screens/nursery.css', 'screens/husbandry.css', 'screens/qr.css', 'screens/community.css', 'screens/settings.css', 'screens/diagnostics.css']);
assert.doesNotMatch(shell, /setae-gui-legacy|setae-gui-wordpress|styles\/app\.css|styles\/wordpress\.css/);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/app.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/wordpress.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/layouts.css')), false);
assert.doesNotMatch(shell, /setae-gui-layouts|styles\/layouts\.css/);
assert.doesNotMatch(fixture, /styles\/app\.css|styles\/wordpress\.css/);
assert.doesNotMatch(foundation, /100vw|50vw/);

assert.match(tokens, /^@layer reset, foundation, components, app-frame, patterns, screens, utilities;/);
assert.match(reset, /^@layer reset\s*\{/);
assert.match(tokens, /--content-reading-width:\s*960px/);
assert.match(tokens, /--content-workspace-width:\s*1180px/);
assert.match(tokens, /--content-collection-width:\s*1360px/);
assert.match(tokens, /\[data-theme="dark"\]/);
assert.match(todayScreen, /\.today-workbench\s*\{[^}]*var\(--content-workspace-width\)/);
assert.match(specimenWorkspacePattern, /\.specimen-workspace-v4\s*\{[^}]*var\(--content-workspace-width\)/);
assert.match(collectionScreen, /\.collection-workbench-v4/);
assert.match(collectionScreen, /var\(--collection-inspector-width\)/);

[
  '.button',
  '.icon-button',
  '.text-field',
  '.textarea',
  '.select',
  '.search-control',
  '.tabs',
  '.segmented',
  '.menu-popover',
  '.popover',
  '.modal',
  '.sheet',
  '.status-chip',
  '.badge',
  '.data-row',
  '.surface',
  '.empty-state',
  '.loading-skeleton',
  '.toast',
  '.progress'
].forEach((selector) => assert.match(`${components}\n${feedbackComponents}`, new RegExp(`\\${selector}[^,{]*[,\\s{]`), `Missing component ${selector}`));

assert.match(components, /:focus-visible/);
assert.match(components, /:disabled/);
assert.match(components, /aria-busy/);
assert.match(components, /aria-invalid/);
assert.match(components, /\.feedback\.is-error/);
assert.match(components, /\.feedback\.is-success/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*?var\(--touch-target\)/);

assert.doesNotMatch(screenCss, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'Screen typography must use tokens');
assert.doesNotMatch(screenCss, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, 'Screen radii must use tokens');
assert.doesNotMatch(screenCss, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Screen colors must use semantic tokens');
qr.split('\n').filter((line) => /font-size:\s*(?:[0-9]|10)px/i.test(line)).forEach((line) => {
  assert.match(line, /^\.field-label/, `Sub-11px text is only valid on a physical field label: ${line}`);
});

const jsFiles = walk(path.join(pluginRoot, 'assets/app')).filter((file) => file.endsWith('.js'));
const rawActionGlyph = /[←→↔⚙−↑↓＋✓✕✖↗]/u;
jsFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8').replaceAll('写真＋情報', '写真と情報');
  assert.doesNotMatch(source, rawActionGlyph, `Raw UI glyph in ${path.relative(pluginRoot, file)}`);
});

console.log('Product UI architecture tests passed');
