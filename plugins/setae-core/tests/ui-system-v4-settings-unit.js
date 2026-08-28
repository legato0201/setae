const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const page = read('assets/app/pages/settings.js');
const plan = read('assets/app/features/settings/plan.js');
const composed = page + plan;
assert.match(page, /import \{ renderPlanSettings \}/);
assert.match(page, /renderPlanSettings\(profile\)/);
const preset = read('assets/app/features/personalization/preset-view.js');
const css = read('assets/app/styles/screens/settings.css');
const shell = read('includes/frontend/class-setae-app-shell.php');

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/settings.css')));
assert.match(css, /^@layer screens\s*\{/);
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'Settings CSS braces must be balanced');
assert.doesNotMatch(css, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Settings colors must use tokens');
assert.doesNotMatch(css, /@media[^\{]*(?:420|719|759)px/);
assert.match(css, /@media \(max-width:\s*767px\)/);
assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
assert.match(css, /@media \(min-width:\s*1200px\)/);
assert.doesNotMatch(css, /overflow-x\s*:/i, 'Settings must not rely on horizontal scrolling');

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(page, rawControl, 'Settings page must compose controls from primitives');
assert.doesNotMatch(plan, rawControl, 'Plan view must compose controls from primitives');
assert.doesNotMatch(preset, rawControl, 'My SETAE must compose controls from primitives');
['navigationItem', 'tabs', 'textField', 'fileField', 'selectField', 'checkboxControl', 'hiddenField', 'textareaField', 'dataRow', 'button'].forEach((name) => {
  assert.match(page, new RegExp(`\\b${name}\\b`), `Settings must use ${name}`);
});

['my-setae', 'profile', 'plan', 'notifications', 'integrations', 'social', 'about'].forEach((tab) => {
  assert.match(page, new RegExp(`id: '${tab}'`), `Settings tab ${tab} must remain`);
});
['display_name', 'email', 'password', 'profile_image', 'theme_preference', 'show_care_focus', 'enabled', 'care_reminders', 'community_messages', 'care_hour', 'care_minute', 'timezone'].forEach((field) => {
  assert.match(page, new RegExp(`['"]${field}['"]`), `Settings field ${field} must remain`);
});
['profile-form', 'appearance-form', 'notification-form'].forEach((role) => assert.match(page, new RegExp(role)));
['billing-checkout', 'billing-portal', 'enable-push', 'test-push', 'create-external-token', 'create-live-session', 'sync-offline', 'clear-offline', 'unfollow-user', 'unblock-user'].forEach((action) => {
  assert.match(composed, new RegExp(action), `Settings action ${action} must remain`);
});
assert.match(composed, /settings-property-list/);
assert.match(page, /settings-secret-result/);
assert.match(page, /readOnly:\s*true/);
assert.match(page, /renderAppInformation/);
assert.match(preset, /contentAction/);
assert.match(preset, /apply-setae-preset/);

['.settings-workspace', '.settings-navigation', '.settings-mobile-navigation', '.settings-section', '.integration-row', '.settings-property-list', '.offline-ledger', '.my-setae-layout'].forEach((selector) => {
  assert.match(css, new RegExp(selector.replaceAll('.', '\\\.')), `Settings CSS must own ${selector}`);
});
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(css, /@media \(min-width:\s*768px\)[\s\S]*?\.settings-workspace[\s\S]*?grid-template-columns:\s*12rem minmax\(0, 1fr\)/);
assert.match(css, /@media \(min-width:\s*1200px\)[\s\S]*?\.settings-workspace[\s\S]*?grid-template-columns:\s*14rem minmax\(0, 1fr\)/);
assert.match(shell, /'setae-gui-settings-screen'[\s\S]*?styles\/screens\/settings\.css[\s\S]*?array\('setae-gui-community-screen'\)/);

console.log('UI System v4 Settings tests passed');
