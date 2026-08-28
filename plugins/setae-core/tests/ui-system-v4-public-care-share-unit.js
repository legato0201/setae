const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCss, metrics } = require('./ui-system-v4-public-surface-ownership-unit');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const controller = read('includes/frontend/class-setae-public-care-share.php');
const document = read('templates/public/care-share-document.php');
const content = read('templates/public/care-share-content.php');
const notFound = read('templates/public/care-share-not-found.php');
const templates = document + content + notFound;
const css = read('assets/css/public-care-share.css');

assert.match(document, /<!doctype html>/i);
assert.match(document, /<html class="setae-public-surface-document"/);
for (const hook of ['language_attributes', 'wp_head', 'wp_body_open', 'wp_footer']) {
    assert.match(document, new RegExp(hook + '\\s*\\('));
}
for (const method of ['build_share_item', 'build_view_context', 'render_document']) {
    assert.match(controller, new RegExp('function\\s+' + method + '\\s*\\('));
}
assert.match(controller, /templates\/public\/care-share-document\.php/);
assert.match(controller, /status_header\(\$view\['found'\] \? 200 : 404\)/);
assert.match(controller, /show_admin_bar\(false\)/);
assert.doesNotMatch(controller, /function\s+render_content\s*\(|<(?:main|article|div|aside|section|header|footer|h[1-6])\b/i);
assert.doesNotMatch(controller + templates, /\bget_(?:header|footer)\s*\(/);
assert.doesNotMatch(templates, /\b(?:get_post_meta|get_comments|get_userdata|get_the_terms|get_user_meta|WP_Query)\s*\(/);
assert.doesNotMatch(templates, /\sstyle\s*=|\son(?:click|load|submit|error)\s*=|<script\b/i);
assert.match(document, /templates\/public\/surface-header\.php/);
assert.match(document, /templates\/public\/surface-footer\.php/);
assert.match(content, /PUBLIC FIELD NOTE/);
assert.match(content, /<h1[^>]*>[^\n]*\$item\['heading'\]/);
assert.match(controller, /\$type_label === 'メモ' \? 'メモ' : \$type_label \. 'の記録'/);
for (const label of ['水やり', '植え替え', '給餌', '脱皮', '成長', '観察']) assert.ok(controller.includes(label));
assert.ok(content.indexOf('setae-care-share-code') < content.indexOf('setae-care-share-taxon'));
assert.ok(content.indexOf('setae-care-share-taxon') < content.indexOf('setae-care-share-classification'));
assert.ok(content.indexOf('setae-care-share-note') < content.indexOf('setae-care-share-cta'));
assert.doesNotMatch(content, /setae-card|value-strip|care-feed-meta-chip|setae-topic-badge/);
assert.match(content, /Setae_Public_Visual::specimen_placeholder/);
assert.match(controller, /Setae_Public_Visual::avatar_context/);
assert.match(content, /loading="lazy" decoding="async"/);
assert.match(content, /width="4" height="3" loading="eager" decoding="async" fetchpriority="high"/);
assert.equal((content.match(/fetchpriority="high"/g) || []).length, 1);
assert.match(content, /<dl[^>]*setae-care-share-properties/);
assert.match(content, /メモはありません。/);
assert.equal((content.match(/<section[^>]*setae-care-share-responses/g) || []).length, 1);
assert.match(content, /反応・コメント/);
assert.match(content, /最新のコメント[^\n]*最大3件/);
assert.match(content, /コメントやリアクションはログイン後に利用できます。/);
assert.match(content, /data-share-copy-text=/);
for (const action of ['native', 'link', 'text', 'x', 'line']) assert.ok(content.includes('data-public-share-action="' + action + '"'));
assert.match(content, /data-public-share-action="native" hidden/);
assert.match(content, /role="status" aria-live="polite"[^>]*data-public-share-status/);
assert.match(content, /data-public-register aria-haspopup="dialog"/);
assert.match(notFound, /<h1>共有記録が見つかりません<\/h1>/);
assert.doesNotMatch(notFound, /\$item|setae-card|data-public-register/);
assert.match(controller, /assets\/app\/icons\/setae-icon-512\.png/);
assert.doesNotMatch(controller, /get_theme_file_uri|comment_author_email|comment_author_IP/);

const quality = metrics(css);
assert.equal(quality.duplicateBaseSelectors, 0);
assert.equal(quality.directColors, 0);
assert.equal(quality.important, 0);
assert.doesNotMatch(css, /var\(--(?:setae-font-main|setae-public-(?:bg|label|botanical|radius))\)/);
assert.doesNotMatch(css, /@(?:import|font-face)|font-weight:\s*(?!400\b|500\b|600\b|700\b)\d+/);
assert.match(css, /aspect-ratio:\s*4\s*\/\s*3/);
assert.match(css, /object-fit:\s*cover/);
assert.match(css, /font-size:\s*1\.0625rem;[\s\S]*?line-height:\s*1\.8/);
assert.match(css, /forced-colors/);
assert.match(css, /prefers-reduced-motion/);
assert.deepEqual([...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1])), [1199, 767]);
for (const rule of parseCss(css)) {
    for (const selector of rule.selectors) assert.match(selector, /^\.setae-care-share-/);
    assert.doesNotMatch(rule.body, /(?:^|\s)(?:white|black|CanvasText|ButtonText|ButtonFace|Highlight|LinkText)(?:\s|;|$)/);
}
console.log('Public Field Note architecture, public presentation and CSS contract tests passed');
console.log(JSON.stringify(quality));
