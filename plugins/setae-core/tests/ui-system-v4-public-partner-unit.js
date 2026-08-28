const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCss, metrics } = require('./ui-system-v4-public-surface-ownership-unit.js');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const controller = read('includes/frontend/class-setae-public-partner.php');
const documentTemplate = read('templates/public/partner-document.php');
const content = read('templates/public/partner-content.php');
const css = read('assets/css/public-partner.css');
const home = read('includes/frontend/class-setae-public-home.php');
const foundation = read('assets/css/public-foundation.css');
const templates = `${documentTemplate}\n${content}`;

// Keep the original request and public URL contracts while separating the view.
assert.match(controller, /const QUERY_VAR = 'setae_partner'/);
assert.match(controller, /add_rewrite_rule\('\^setae-partner\/\?\$'/);
assert.match(controller, /home_url\('\/setae-partner\/'\)/);
assert.match(controller, /add_query_arg\(self::QUERY_VAR, 1, home_url\('\/'\)\)/);
assert.match(controller, /protected function build_view_context\(/);
assert.match(controller, /protected function render_document\(array \$context\)/);
assert.match(controller, /templates\/public\/partner-document\.php/);
assert.doesNotMatch(controller, /get_header\(|get_footer\(|render_content\(|enqueue_public_pages\(/);
assert.doesNotMatch(controller, /<main\b|<section\b|<textarea\b|<button\b/);
assert.doesNotMatch(templates, /get_post_meta\(|get_comments\(|get_userdata\(|get_the_terms\(|get_option\(/);
assert.match(home, /function enqueue_public_partner\(/);
assert.match(controller, /Setae_Public_Home::enqueue_public_partner\(\$this->version\)/);

// Native WordPress lifecycle, shared chrome and registration remain in one document.
['language_attributes()', "bloginfo('charset')", 'wp_head()', 'body_class(', 'wp_body_open()', 'wp_footer()']
    .forEach((call) => assert.ok(documentTemplate.includes(call), `${call} must remain in the document.`));
assert.match(documentTemplate, /templates\/public\/surface-header\.php/);
assert.match(documentTemplate, /templates\/public\/surface-footer\.php/);
assert.match(documentTemplate, /<html class="setae-public-surface-document"/);
assert.match(controller, /Setae_App_Operations::get_terms_url\(\)/);
assert.match(controller, /Setae_Public_Registration::build_context\('public_partner', array\([\s\S]*?'return_url' => \$plan_url/);
assert.match(controller, /add_query_arg\('setae_plan', 'breeder_trial', \$app_url\)/);
assert.match(documentTemplate, /Setae_Public_Registration::render\(\$setae_partner\['registration'\]\)/);
assert.doesNotMatch(templates, /<form\b/);
assert.doesNotMatch(templates, /\sstyle\s*=|\son(?:click|change|submit|keydown|keyup|input)\s*=/i);
assert.doesNotMatch(templates, /<script\b/i);

// A single primary belongs to the hero; later CTAs and copy actions are default.
assert.equal((content.match(/<main\b/g) || []).length, 1);
assert.equal((content.match(/<h1\b/g) || []).length, 1);
assert.match(content, /<h1[^>]*><span class="setae-public-partner-title-line">売る前から、<\/span><span class="setae-public-partner-title-line">譲った後まで。<\/span><\/h1>/);
assert.equal((content.match(/class="setae-public-button is-primary"/g) || []).length, 1);
assert.match(content, /ブリーダー機能を30日試す/);
assert.match(content, /購入した個体の履歴を引き継ぐ/);
assert.match(content, /SETAEを開く/);
assert.doesNotMatch(content, /setae-card|setae-public-partner-card|setae-public-partner-preview|setae-public-flow-grid/);
assert.match(content, /class="setae-public-partner-features"/);
assert.match(content, /<ol class="setae-public-partner-steps">/);
assert.match(content, /<li class="setae-public-partner-step">/);
const sectionOrder = ['setae-public-partner-hero', 'setae-public-partner-benefits-title', 'setae-public-partner-flow-title', 'setae-public-partner-copy-title', 'setae-public-partner-final-title']
    .map((value) => content.indexOf(value));
assert.ok(sectionOrder.every((position, index) => position >= 0 && (index === 0 || position > sectionOrder[index - 1])));

// Copy text is labelled, selectable and already present before JS initializes.
assert.match(content, /<label[^>]*for="setae-public-partner-invite-text"/);
assert.match(content, /<textarea[^>]*id="setae-public-partner-invite-text"[^>]*readonly[^>]*wrap="soft"/);
assert.match(content, /esc_textarea\(\$setae_partner\['copy_text'\]\)/);
['data-public-share-root', 'data-partner-page', 'data-share-title', 'data-share-text', 'data-share-url', 'data-share-copy-text']
    .forEach((attribute) => assert.ok(content.includes(attribute), `${attribute} is required by the shared adapter.`));
assert.doesNotMatch(content, /data-partner-copy|data-partner-x|data-partner-line|data-copy-text=/);
['native', 'link', 'text', 'x', 'line'].forEach((action) => assert.ok(content.includes(`data-public-share-action="${action}"`)));
assert.match(content, /data-public-share-action="native" hidden/);
assert.equal((content.match(/data-public-share-controls/g) || []).length, 2);
assert.equal((content.match(/role="status" aria-live="polite" aria-atomic="true" data-public-share-status/g) || []).length, 2);
assert.equal((content.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 2);

// Canonical and social metadata come from clean route URLs and an existing plugin asset.
assert.match(controller, /'canonical' => \$this->get_partner_url\(\)/);
assert.match(controller, /property="og:type" content="website"/);
assert.match(controller, /<link rel="canonical"/);
assert.match(controller, /twitter:card/);
assert.match(controller, /assets\/app\/icons\/setae-icon-512\.png/);
assert.ok(fs.existsSync(path.join(root, 'assets/app/icons/setae-icon-512.png')));
assert.doesNotMatch(controller, /get_theme_file_uri|user_email|comment_author_email|user_login/);
assert.match(controller, /remove_action\('wp_head', '_wp_render_title_tag', 1\)/);
assert.match(controller, /remove_action\('wp_head', 'rel_canonical'\)/);
assert.doesNotMatch(controller, /noindex|remove_action\('wp_head', 'wp_robots'/);

// Page CSS owns only layout, and reuses Foundation controls, colors and focus.
const cssMetrics = metrics(css);
assert.equal(cssMetrics.duplicateBaseSelectors, 0);
assert.equal(cssMetrics.important, 0);
assert.equal(cssMetrics.directColors, 0);
assert.doesNotMatch(css, /--setae-public-(?:bg|label|botanical|radius)\b(?!-)|--setae-font-main/);
assert.doesNotMatch(css, /box-shadow|@font-face|@import/);
assert.doesNotMatch(css, /font-weight:\s*(?!400\b|500\b|600\b|700\b|var\()[0-9]+/);
assert.deepEqual([...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1])), [1199, 767]);
assert.match(css, /\.setae-public-partner-feature \+ \.setae-public-partner-feature\s*\{\s*border-block-start:/);
assert.match(css, /\.setae-public-partner-invite-text\s*\{[^}]*resize:\s*vertical/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(css, /\.setae-public-partner-title-line\s*\{[^}]*display:\s*block;[^}]*text-wrap:\s*balance;/);
assert.match(foundation, /--setae-public-touch-target:\s*44px/);
assert.match(foundation, /:focus-visible/);
assert.match(foundation, /@media \(forced-colors: active\)/);
parseCss(css).forEach((rule) => rule.selectors.forEach((selector) => {
    assert.match(selector, /^\.setae-public-partner-/, `Page CSS must own Partner layout only: ${selector}`);
}));

const cssFiles = [];
function collectCss(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collectCss(file);
        else if (entry.name.endsWith('.css')) cssFiles.push(file);
    });
}
collectCss(path.join(root, 'assets/css'));
cssFiles.forEach((file) => {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (relative === 'assets/css/public-partner.css') return;
    const matches = fs.readFileSync(file, 'utf8').match(/\.setae-public-partner-[a-z0-9_-]+/g) || [];
    if (relative === 'assets/css/public-foundation.css') {
        const allowed = new Set(['.setae-public-partner-document', '.setae-public-partner-page']);
        matches.forEach((selector) => assert.ok(allowed.has(selector), `Unexpected Foundation page selector: ${selector}`));
    } else {
        assert.equal(matches.length, 0, `${relative} must not define Partner selectors.`);
    }
});

console.log('UI System v4 Public Partner tests passed');
console.log(JSON.stringify({ partner: cssMetrics }));
