const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

function assertBalancedCss(source, label) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
        (withoutComments.match(/\{/g) || []).length,
        (withoutComments.match(/\}/g) || []).length,
        `${label} must have balanced braces.`
    );
}

const foundation = read('assets/css/public-foundation.css');
const passportCss = read('assets/css/public-passport.css');
const publicCareCss = read('assets/css/public-care-share.css');
const publicPartnerCss = read('assets/css/public-partner.css');
const publicProfileCss = read('assets/css/public-profile.css');
const appMediaCss = read('assets/app/styles/components/media.css');
const uiSource = read('assets/app/components/ui.js');
const mediaSource = read('assets/app/components/media.js');
const cardSource = read('assets/app/features/collection/card-view.js');
const inspectorSource = read('assets/app/features/collection/inspector.js');
const specimenSource = read('assets/app/features/specimen/view.js');
const publicQrSource = read('includes/frontend/class-setae-public-qr.php');
const publicPassportTemplate = read('templates/public/passport-content.php');
const publicProfileSource = read('includes/frontend/class-setae-public-profile.php');
const publicProfileTemplate = read('templates/public/profile-content.php');
const publicCareSource = read('includes/frontend/class-setae-public-care-share.php');
const publicCareTemplate = read('templates/public/care-share-content.php');
const appShellSource = read('includes/frontend/class-setae-app-shell.php');
const iconRegistrySource = read('includes/class-setae-icon-registry.php');

assert.ok(fs.existsSync(path.join(pluginRoot, 'assets/images/specimen/spider-silhouette.svg')));
assert.ok(fs.existsSync(path.join(pluginRoot, 'assets/images/specimen/generic-specimen.svg')));
['specimen', 'spider', 'scorpion', 'insect', 'plant'].forEach((kind) => {
    assert.ok(fs.existsSync(path.join(pluginRoot, `assets/images/specimen/${kind}.svg`)));
});

[
    '--setae-public-bg',
    '--setae-public-label',
    '--setae-public-rule-strong',
    '--setae-public-accent',
    '--setae-font-taxon',
    '--setae-font-mono'
].forEach((token) => assert.match(foundation, new RegExp(token.replaceAll('-', '\\-'))));

assert.match(foundation, /\.setae-specimen-placeholder\s*\{/);
assert.match(passportCss, /Natural History public specimen ledger/);
assert.match(publicProfileCss, /Public Keeper Profile/);
assert.match(passportCss, /var\(--setae-public-accent\)/);
assert.match(publicProfileCss, /var\(--setae-font-taxon\)/);
assert.match(appMediaCss, /\.setae-specimen-placeholder-taxon/);
assert.match(appMediaCss, /\.setae-media-placeholder/);

assert.match(uiSource, /export const specimenPlaceholder/);
assert.match(uiSource, /specimenAssets/);
assert.match(appShellSource, /'specimenAssets'\s*=>\s*Setae_Icon_Registry::get_specimen_assets\(\)/);
assert.match(appShellSource, /'iconOverrides'\s*=>\s*Setae_Icon_Registry::get_frontend_overrides\(\)/);
assert.match(iconRegistrySource, /'specimen\.spider'/);
assert.match(iconRegistrySource, /'specimen\.generic'/);
assert.match(iconRegistrySource, /setae-icon\/.*\.svg/);
assert.match(mediaSource, /export function renderMediaFrame/);
assert.match(mediaSource, /data-media-fallback-src/);
assert.match(mediaSource, /mediaFallbackAttempted/);
assert.match(mediaSource, /spider-silhouette\.svg/);

[cardSource, inspectorSource, specimenSource].forEach((source) => {
    assert.match(source, /renderAnimalMedia\(/);
    assert.doesNotMatch(source, /画像なし/);
});

assert.match(publicPassportTemplate, /Setae_Public_Visual::specimen_placeholder/);
assert.match(publicProfileTemplate, /Setae_Public_Visual::specimen_placeholder/);
assert.match(publicCareTemplate, /Setae_Public_Visual::specimen_placeholder/);
assert.match(publicCareSource, /templates\/public\/care-share-document\.php/);
assert.doesNotMatch(publicQrSource, /short_name'\]\)\);/);
assert.doesNotMatch(publicProfileTemplate, /<span[^>]*>\s*<\?php echo esc_html\(\$log\['classification_emoji'\]\)/);
assert.doesNotMatch(publicCareSource, /class="setae-care-share-emoji"/);

assertBalancedCss(foundation, 'Public foundation CSS');
assertBalancedCss(passportCss, 'Public passport CSS');
assertBalancedCss(publicCareCss, 'Public Field Note CSS');
assertBalancedCss(publicPartnerCss, 'Public Partner CSS');
assertBalancedCss(publicProfileCss, 'Public profile CSS');

console.log('Public Natural History design tests passed');
