const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(pluginRoot, '../../..');

const dashboardSource = fs.readFileSync(
    path.join(pluginRoot, 'templates/dashboard.php'),
    'utf8'
);
const themeSource = fs.readFileSync(
    path.join(projectRoot, 'wp-content/themes/setae-theme/index.php'),
    'utf8'
);
const globalCss = fs.readFileSync(
    path.join(pluginRoot, 'assets/css/setae-global.css'),
    'utf8'
);
const publicHomeCss = fs.readFileSync(
    path.join(pluginRoot, 'assets/css/public-home.css'),
    'utf8'
);
const loginCss = fs.readFileSync(
    path.join(pluginRoot, 'assets/css/setae-login.css'),
    'utf8'
);
const coreSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/class-setae-core.php'),
    'utf8'
);
const publicProfileSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/frontend/class-setae-public-profile.php'),
    'utf8'
);
const publicProfileTemplate = fs.readFileSync(
    path.join(pluginRoot, 'templates/public/profile-content.php'),
    'utf8'
);
const publicQrSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/frontend/class-setae-public-qr.php'),
    'utf8'
);
const publicQrTemplate = fs.readFileSync(
    path.join(pluginRoot, 'templates/public/passport-content.php'),
    'utf8'
);
const publicCareSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/frontend/class-setae-public-care-share.php'),
    'utf8'
);
const publicPartnerSource = fs.readFileSync(
    path.join(pluginRoot, 'includes/frontend/class-setae-public-partner.php'),
    'utf8'
);
const publicIdentitySource = fs.readFileSync(
    path.join(pluginRoot, 'includes/class-setae-public-identity.php'),
    'utf8'
);
const surfaceHeader = fs.readFileSync(path.join(pluginRoot, 'templates/public/surface-header.php'), 'utf8');
const surfaceFooter = fs.readFileSync(path.join(pluginRoot, 'templates/public/surface-footer.php'), 'utf8');
const publicFoundation = fs.readFileSync(
    path.join(pluginRoot, 'assets/css/public-foundation.css'),
    'utf8'
);

const brandMarkup = [
    '<span class="setae-public-brand-mark" aria-hidden="true"></span>',
    '<span>SETAE</span>'
];

brandMarkup.forEach(function (fragment) {
    assert.ok(themeSource.includes(fragment), 'The public page must contain the shared brand markup.');
    assert.ok(dashboardSource.includes(fragment), 'The signed-in header must contain the shared brand markup.');
});

[publicProfileTemplate, publicQrTemplate, surfaceHeader, surfaceFooter].forEach(function (source) {
    assert.match(source, /Setae_Public_Identity::render_brand\(/);
    assert.doesNotMatch(source, /setae-public-brand-mark|setae-logo-text/);
});
[publicCareSource, publicPartnerSource].forEach(function (source) {
    assert.match(source, /templates\/public\/(?:care-share|partner)-document\.php/);
    assert.doesNotMatch(source, /setae-public-brand-mark|setae-logo-text/);
});
['care-share-document.php', 'partner-document.php'].forEach(function (file) {
    const document = fs.readFileSync(path.join(pluginRoot, 'templates/public', file), 'utf8');
    assert.match(document, /templates\/public\/surface-header\.php/);
    assert.match(document, /templates\/public\/surface-footer\.php/);
});
assert.match(publicIdentitySource, /class="setae-brand setae-brand-lockup"/);
assert.match(publicIdentitySource, /class="setae-brand-icon" aria-hidden="true"/);
assert.match(publicFoundation, /\.setae-brand-lockup\s*\{/);

assert.match(
    dashboardSource,
    /<a class="setae-public-brand"[\s\S]*?aria-label="SETAE ホーム">[\s\S]*?setae-public-brand-mark[\s\S]*?<span>SETAE<\/span>[\s\S]*?<\/a>/
);
assert.doesNotMatch(
    dashboardSource,
    /<div class="setae-logo setae-logo-text">\s*SETAE/
);
assert.equal(
    (themeSource.match(/class="setae-public-brand"/g) || []).length,
    2,
    'The public header and footer should use the same brand component.'
);
assert.doesNotMatch(publicProfileTemplate, /class="setae-logo setae-logo-text"/);
assert.match(publicQrSource, /templates\/public\/passport-document\.php/);
assert.doesNotMatch(publicQrSource, /class="setae-logo setae-logo-text"/);
assert.doesNotMatch(publicQrTemplate, /class="setae-logo setae-logo-text"/);

assert.match(publicHomeCss, /\.setae-public-brand\s*\{[\s\S]*?font-size:\s*23px;[\s\S]*?font-weight:\s*var\(--setae-public-weight-bold\);/);
assert.match(publicFoundation, /--setae-public-weight-bold:\s*700;/);
assert.match(publicHomeCss, /\.setae-public-brand-mark\s*\{[\s\S]*?width:\s*15px;[\s\S]*?border:\s*4px solid #2f9d68;/);
assert.match(publicHomeCss, /\.setae-public-brand-mark::after\s*\{[\s\S]*?background:\s*#d06a52;/);
assert.doesNotMatch(globalCss, /\.setae-public-home-v2/);

assert.match(loginCss, /--login-canvas:\s*#f3f2ed/);
assert.match(loginCss, /#login h1::after\s*\{[\s\S]*?content:\s*"LIVING COLLECTION"/);
assert.match(loginCss, /#login h1 a\s*\{[\s\S]*?width:\s*auto !important;[\s\S]*?font-size:\s*20px !important;/);
assert.match(loginCss, /#login h1 a::before\s*\{[\s\S]*?width:\s*14px;[\s\S]*?border:\s*3px solid var\(--login-botanical\)/);
assert.match(loginCss, /\.login form\s*\{[\s\S]*?border-radius:\s*6px !important;[\s\S]*?box-shadow:\s*none !important;/);
assert.match(loginCss, /\.login \.button-primary\s*\{[\s\S]*?background:\s*var\(--login-ink\) !important;/);
assert.match(
    coreSource,
    /function custom_login_header_text\(\)[\s\S]*?return 'SETAE';/
);

console.log('Brand consistency tests passed');
