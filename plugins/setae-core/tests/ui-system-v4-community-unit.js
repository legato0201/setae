const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const page = read('assets/app/pages/community.js');
const css = read('assets/app/styles/screens/community.css');
const discussion = read('assets/app/styles/patterns/discussion.css');
const shell = read('includes/frontend/class-setae-app-shell.php');

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/community.css')));
assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/patterns/discussion.css')));
assert.match(css, /^@layer screens\s*\{/);
assert.match(discussion, /^@layer patterns\s*\{/);
assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'Community CSS braces must be balanced');
assert.equal((discussion.match(/\{/g) || []).length, (discussion.match(/\}/g) || []).length, 'Discussion CSS braces must be balanced');
assert.doesNotMatch(`${css}\n${discussion}`, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Community colors must use tokens');
assert.doesNotMatch(css, /@media[^\{]*(?:420|719|759)px/);
assert.match(css, /@media \(max-width:\s*767px\)/);
assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
assert.match(css, /@media \(min-width:\s*1200px\)/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(page, rawControl, 'Community must compose controls from primitives');
['tabs', 'contentAction', 'button', 'textButton', 'searchControl', 'selectControl', 'textareaField', 'fileField', 'linkButton', 'actionRow'].forEach((name) => {
  assert.match(page, new RegExp(`\\b${name}\\b`), `Community must use ${name}`);
});
['care', 'topics', 'breeding', 'species'].forEach((tab) => assert.match(page, new RegExp(`['"]${tab}['"]`)));
['community-tab', 'new-topic', 'show-login', 'open-care-feed', 'care-react', 'topic-react', 'open-topic', 'close-topic', 'open-species', 'close-species', 'register-from-species'].forEach((action) => {
  assert.match(page, new RegExp(action), `Community action ${action} must remain`);
});
['care-comment-form', 'topic-search-form', 'topic-comment-form', 'species-search-form', 'species-suggestion-form'].forEach((role) => {
  assert.match(page, new RegExp(role), `Community role ${role} must remain`);
});

assert.match(page, /feed-stream/);
assert.match(page, /feed-entry/);
assert.doesNotMatch(page, /feed-card surface/);
assert.match(page, /topic-registry/);
assert.doesNotMatch(page, /topic-card/);
assert.match(page, /breeding-listing-list/);
assert.match(page, /breeding-listing-row/);
assert.match(page, /species-photo-index/);
assert.match(page, /species-image-credit/);
assert.match(page, /speciesAttributionContent/);
assert.match(page, /rel="license noopener noreferrer"/);
assert.match(page, /!authenticated/);
assert.match(page, /相談と図鑑はログインせず閲覧できます/);

['.feed-stream', '.feed-entry', '.topic-registry', '.topic-registry-row', '.breeding-listing-list', '.breeding-listing-row', '.species-photo-index', '.species-index-item'].forEach((selector) => {
  assert.match(css, new RegExp(selector.replaceAll('.', '\\\.')), `Community CSS must own ${selector}`);
});
['.comment-thread', '.comment-item', '.comment-form', '.reaction-button', '.discussion-author'].forEach((selector) => {
  assert.match(discussion, new RegExp(selector.replaceAll('.', '\\\.')), `Discussion pattern must own ${selector}`);
});
assert.match(discussion, /\.reaction-button\.button\s*\{[^}]*min-height:\s*var\(--touch-target\)/);
assert.match(discussion, /@media \(max-width:\s*767px\)/);

assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(shell, /'setae-gui-discussion-pattern'[\s\S]*?styles\/patterns\/discussion\.css/);
assert.match(shell, /'setae-gui-community-screen'[\s\S]*?styles\/screens\/community\.css[\s\S]*?array\('setae-gui-qr-screen'\)/);

console.log('UI System v4 Community tests passed');
