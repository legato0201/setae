const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const controller = read('includes/frontend/class-setae-public-profile.php');
const home = read('includes/frontend/class-setae-public-home.php');
const documentTemplate = read('templates/public/profile-document.php');
const contentTemplate = read('templates/public/profile-content.php');
const dialogTemplate = read('templates/public/registration-dialog.php');
const notFoundTemplate = read('templates/public/profile-not-found.php');
const profileCss = read('assets/css/public-profile.css');
const profileJs = read('assets/js/public-profile.js');
const foundationCss = read('assets/css/public-foundation.css');
const registrationJs = read('assets/js/public-registration.js');
const templateSource = [documentTemplate, contentTemplate, dialogTemplate, notFoundTemplate].join('\n');

assert.match(home, /function enqueue_public_profile\([\s\S]*?'setae-public-profile'[\s\S]*?public-profile\.css[\s\S]*?public-profile\.js/);
assert.match(controller, /Setae_Public_Home::enqueue_public_profile\(\$this->version\)/);
assert.doesNotMatch(controller, /enqueue_public_pages/);
assert.match(controller, /templates\/public\/profile-document\.php/);
assert.match(controller, /Setae_Public_Registration::build_context\('public_profile'/);
assert.match(documentTemplate, /Setae_Public_Registration::render\(\$setae_context\['registration'\]\)/);
assert.doesNotMatch(controller, /get_header\(|get_footer\(/);

assert.doesNotMatch(templateSource, /\sstyle\s*=/i);
assert.doesNotMatch(templateSource, /\son(?:click|change|submit|keydown|keyup|input)\s*=/i);
assert.doesNotMatch(templateSource, /<script(?![^>]*type=["']application\/ld\+json)/i);
assert.doesNotMatch(profileJs, /\bjQuery\b|\$\s*\(/);
assert.doesNotMatch(profileJs, /setae_register_user|function openRegistration|function setBusy/);
assert.doesNotMatch(registrationJs, /\bjQuery\b|\$\s*\(/);

assert.equal((contentTemplate.match(/<main\b/g) || []).length, 1);
assert.equal((contentTemplate.match(/<h1\b/g) || []).length, 1);
assert.equal((notFoundTemplate.match(/<main\b/g) || []).length, 1);
assert.equal((notFoundTemplate.match(/<h1\b/g) || []).length, 1);
assert.match(contentTemplate, /<dl class="setae-public-profile-stats"/);
['登録個体', '公開記録', '最終公開'].forEach((label) => assert.ok(contentTemplate.includes(label)));
assert.doesNotMatch(contentTemplate, /\bsetae-card\b/);
assert.match(contentTemplate, /class="setae-public-profile-note-index"/);
assert.match(contentTemplate, /width="4" height="3"[\s\S]*?loading="lazy"[\s\S]*?decoding="async"/);
assert.match(contentTemplate, /class="setae-public-profile-side"/);
assert.match(contentTemplate, /最新9件を表示/);
assert.match(dialogTemplate, /<dialog\b/);
assert.match(dialogTemplate, /name="email"[\s\S]*?name="password"[\s\S]*?name="referral_code"[\s\S]*?name="terms_accepted"/);

assert.match(controller, /'_setae_log_shared'[\s\S]*?'value'\s*=>\s*1[\s\S]*?'compare'\s*=>\s*'='/);
assert.match(controller, /get_post_meta\(\$log_id, '_setae_log_shared', true\) !== 1/);
assert.match(controller, /<link rel="canonical"/);
assert.match(controller, /property="og:type" content="profile"/);
assert.match(controller, /twitter:card/);
assert.match(controller, /'@type'\s*=>\s*'ProfilePage'/);
assert.match(controller, /'@type'\s*=>\s*'Person'/);
assert.doesNotMatch(controller, /mainEntity[\s\S]{0,500}(?:user_email|user_login|email)/);

assert.match(profileCss, /aspect-ratio:\s*4\s*\/\s*3/);
assert.match(profileCss, /@media \(max-width: 767px\)/);
assert.match(foundationCss, /@media \(prefers-color-scheme: dark\)/);
assert.match(foundationCss, /@media \(forced-colors: active\)/);
assert.match(foundationCss, /--setae-public-touch-target:\s*44px/);
assert.match(foundationCss, /:focus-visible/);

const cssRoot = path.join(root, 'assets/css');
const cssFiles = [];
function collectCss(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectCss(target);
    else if (entry.name.endsWith('.css')) cssFiles.push(target);
  });
}
collectCss(cssRoot);

const profilePath = path.join(cssRoot, 'public-profile.css');
const foundationPath = path.join(cssRoot, 'public-foundation.css');
cssFiles.forEach((file) => {
  if (file === profilePath) return;
  const source = fs.readFileSync(file, 'utf8');
  const occurrences = source.match(/\.setae-public-profile-[a-z0-9_-]+/gi) || [];
  if (file === foundationPath) {
    const allowed = new Set(['.setae-public-profile-document', '.setae-public-profile-page']);
    occurrences.forEach((selector) => assert.ok(allowed.has(selector), `Unexpected profile UI selector in foundation: ${selector}`));
    return;
  }
  assert.equal(occurrences.length, 0, `${path.relative(root, file)} must not own Public Profile selectors.`);
});

console.log('UI System v4 Public Profile tests passed');
