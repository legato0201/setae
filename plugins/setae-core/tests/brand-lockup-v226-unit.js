const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const brand = read('assets/app/components/brand.js');
const appFrame = read('assets/app/components/app-frame.js');
const app = read('assets/app/app.js');
const auth = read('assets/app/pages/auth.js');
const about = read('assets/app/features/settings/about.js');
const appCss = read('assets/app/styles/app-frame.css');
const publicIdentity = read('includes/class-setae-public-identity.php');
const publicCss = read('assets/css/public-foundation.css');
const publicSources = [
  read('templates/public/passport-content.php'),
  read('templates/public/profile-content.php'),
  read('templates/public/profile-not-found.php'),
  read('templates/public/surface-header.php'),
  read('templates/public/surface-footer.php')
];

assert.match(brand, /export function renderBrand/);
assert.match(brand, /setae-brand-icon[^>]*aria-hidden="true"/);
assert.match(brand, /setae-brand-title">SETAE</);
assert.match(brand, /setae-brand-subtitle/);

assert.match(appFrame, /renderBrand\(\{ className: 'app-rail-brand' \}\)/);
assert.match(appFrame, /renderBrand\(\{ subtitle: pageTitle, className: 'mobile-app-brand', size: 'compact' \}\)/);
assert.match(auth, /renderBrand\(\{ className: 'boot-brand', size: 'prominent' \}\)/);
assert.equal((auth.match(/renderBrand\(\{ className: 'auth-brand', size: 'prominent' \}\)/g) || []).length, 2);
assert.match(about, /renderBrand\(\{ size: 'prominent' \}\)/);
assert.doesNotMatch(`${app}\n${auth}`, /<div class="(?:brand|auth-brand)">SETAE<\/div>/);

assert.match(publicIdentity, /class="setae-brand setae-brand-lockup"/);
assert.match(publicIdentity, /class="setae-brand-icon" aria-hidden="true"/);
publicSources.forEach((source) => assert.match(source, /Setae_Public_Identity::render_brand\(/));

[appCss, publicCss].forEach((css) => {
  assert.match(css, /setae-brand-mark\.png/);
  assert.match(css, /background:\s*currentColor/);
  assert.match(css, /mask:[^;]*setae-brand-mark\.png/);
});
assert.match(appCss, /\.setae-brand\.is-compact\s*\{[^}]*--setae-brand-icon-size:\s*22px/);
assert.match(publicCss, /\.setae-brand-lockup\s*\{[^}]*--setae-brand-icon-size:\s*28px[^}]*min-height:\s*var\(--setae-public-touch-target\)/);
assert.match(publicCss, /--setae-public-touch-target:\s*44px/);
assert.match(publicCss, /@media \(max-width:\s*767px\)[\s\S]*?--setae-brand-icon-size:\s*24px/);
assert.match(publicCss, /\.setae-brand-lockup \.setae-brand-title\s*\{[^}]*font-family:\s*var\(--setae-public-font-ui\)[^}]*font-weight:\s*var\(--setae-public-weight-bold\)/);

const png = fs.readFileSync(path.join(root, 'assets/app/icons/setae-brand-mark.png'));
assert.equal(png.readUInt32BE(16), 192);
assert.equal(png.readUInt32BE(20), 192);
assert.equal(png[25], 6, 'Brand PNG must use RGBA color type with transparency.');

console.log('Brand lockup tests passed');
