const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(pluginRoot, '../../..');
const themeSource = fs.readFileSync(
    path.join(projectRoot, 'wp-content/themes/setae-theme/index.php'),
    'utf8'
);
const publicHomeCss = fs.readFileSync(
    path.join(pluginRoot, 'assets/css/public-home.css'),
    'utf8'
);
const globalCss = fs.readFileSync(path.join(pluginRoot, 'assets/css/setae-global.css'), 'utf8');
const partnerSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/frontend/class-setae-public-partner.php'),
    'utf8'
);
const partnerDocument = fs.readFileSync(path.join(pluginRoot, 'templates/public/partner-document.php'), 'utf8');

assert.match(themeSource, /'orderby'\s*=>\s*'rand'/);
assert.match(themeSource, /'cache_results'\s*=>\s*false/);
assert.match(themeSource, /'_setae_image_credit_type'/);
assert.match(themeSource, /'_setae_image_credit_user'/);
assert.match(themeSource, /'_setae_image_credit_text'/);
assert.match(themeSource, /get_user_meta\(\$credit_user_id, 'setae_user_avatar', true\)/);
assert.equal(
    (themeSource.match(/\$render_public_photo_credit\(/g) || []).length,
    2,
    'The hero and each encyclopedia tile should render their photo credit.'
);
assert.match(themeSource, /class="setae-public-hero-caption"/);
assert.match(themeSource, /'setae-public-species-credit'/);

assert.match(publicHomeCss, /\.setae-public-photo-credit\s*\{[\s\S]*?backdrop-filter:\s*blur\(8px\);/);
assert.match(publicHomeCss, /\.setae-public-species-credit\s*\{[\s\S]*?position:\s*absolute;/);
assert.match(publicHomeCss, /\.setae-public-photo-credit strong\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
assert.match(publicHomeCss, /\.setae-public-species-tile > img\s*\{/);
assert.doesNotMatch(publicHomeCss, /\.setae-public-species-tile img\s*\{/);
assert.doesNotMatch(globalCss, /\.setae-public-home-v2/);

assert.match(themeSource, /class="setae-register-context"/);
assert.match(themeSource, /class="setae-register-workspace"/);
assert.match(themeSource, /class="setae-register-steps"/);
assert.match(themeSource, /class="setae-register-plan"/);
assert.match(themeSource, /esc_html\(\$free_spider_limit\)/);
assert.match(partnerSource, /Setae_Public_Registration::build_context\('public_partner'/);
assert.match(partnerDocument, /Setae_Public_Registration::render\(/);
assert.doesNotMatch(partnerSource, /setae-register-modal-v2|setae-register-form|render_registration_modal/);
assert.match(
    publicHomeCss,
    /\.setae-register-modal-v2 \.setae-register-dialog\s*\{[\s\S]*?grid-template-columns:\s*minmax\(280px, 0\.86fr\) minmax\(390px, 1\.14fr\);[\s\S]*?max-width:\s*880px;/
);
assert.match(
    publicHomeCss,
    /@media \(max-width: 767px\)[\s\S]*?\.setae-register-modal-v2 \.setae-register-dialog\s*\{[\s\S]*?display:\s*block;[\s\S]*?overflow-y:\s*auto;/
);

console.log('Public homepage encyclopedia randomization and credit tests passed');
