const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(pluginRoot, '../../..');

function read(relativePath) {
    return fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

const dashboardSource = read('includes/frontend/class-setae-dashboard.php');
const ajaxSource = read('includes/class-setae-ajax.php');
const appCoreSource = read('assets/js/modules/app-core.js');
const profileSource = read('assets/js/modules/ui/profile.js');
const detailSource = read('assets/js/modules/ui/detail.js');
const detailCss = read('assets/css/modules/my-spiders.css');
const modalCss = read('assets/css/modules/modals.css');
const darkCss = read('assets/css/modules/dark-mode.css');
const publicProfileCss = read('assets/css/public-profile.css');
const publicPassportCss = read('assets/css/public-passport.css');
const publicFoundationCss = read('assets/css/public-foundation.css');
const { parseCss } = require('./ui-system-v4-public-surface-ownership-unit.js');
const headerSource = fs.readFileSync(
    path.join(projectRoot, 'wp-content/themes/setae-theme/header.php'),
    'utf8'
);

assert.match(
    dashboardSource,
    /'_setae_theme_preference'[\s\S]*?array\('light', 'dark', 'system'\)/
);
assert.match(
    dashboardSource,
    /'_setae_show_care_focus'[\s\S]*?'show_care_focus'\s*=>\s*\$show_care_focus/
);
assert.match(
    dashboardSource,
    /wp_enqueue_style\('setae-dark-mode'[\s\S]*?array\('setae-pwa'\)/
);

assert.match(
    ajaxSource,
    /isset\(\$_POST\['theme_preference'\]\)[\s\S]*?array\('light', 'dark', 'system'\)[\s\S]*?update_user_meta\(\$user_id, '_setae_theme_preference'/
);
assert.match(
    ajaxSource,
    /isset\(\$_POST\['show_care_focus'\]\)[\s\S]*?update_user_meta\(\$user_id, '_setae_show_care_focus'/
);
assert.match(
    ajaxSource,
    /'theme_preference'\s*=>\s*\$saved_theme_preference[\s\S]*?'show_care_focus'\s*=>/
);

assert.match(headerSource, /id="setae-theme-color"[\s\S]*?data-light-color=/);
assert.match(headerSource, /localStorage\.getItem\('setae_theme_preference_v1'\)/);
assert.match(headerSource, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
assert.match(headerSource, /dataset\.setaeThemePreference\s*=\s*preference/);
assert.match(headerSource, /dataset\.setaeTheme\s*=\s*resolvedTheme/);

assert.match(appCoreSource, /const THEME_PREFERENCE_KEY = 'setae_theme_preference_v1'/);
assert.match(appCoreSource, /const CARE_FOCUS_PREFERENCE_KEY = 'setae_show_care_focus_v1'/);
assert.match(appCoreSource, /function applyThemePreference\(preference, persist = true\)/);
assert.match(appCoreSource, /systemThemeQuery\.addEventListener\('change', handleSystemThemeChange\)/);
assert.match(appCoreSource, /getAttribute\('data-light-color'\)/);
assert.match(appCoreSource, /getCareFocusPreference:\s*getCareFocusPreference/);
assert.match(appCoreSource, /setCareFocusPreference:\s*setCareFocusPreference/);

['light', 'dark', 'system'].forEach(function (preference) {
    assert.match(
        profileSource,
        new RegExp('name="prof-theme-preference" value="' + preference + '"')
    );
});
assert.match(profileSource, /id="prof-show-care-focus"/);
assert.match(profileSource, /formData\.append\('theme_preference'/);
assert.match(profileSource, /formData\.append\('show_care_focus'/);
assert.match(profileSource, /saveCareFocusPreference:\s*saveCareFocusPreference/);

assert.match(detailSource, /class="detail-care-focus-dismiss js-detail-care-focus-dismiss"/);
assert.match(detailSource, /confirmLabel:\s*'今後は表示しない'/);
assert.match(detailSource, /cancelLabel:\s*'今回は閉じる'/);
assert.match(detailSource, /SetaeUIProfile\.saveCareFocusPreference\(false\)/);
assert.match(detailSource, /!SetaeCore\.getCareFocusPreference\(\)/);
assert.match(detailCss, /\.detail-care-focus-dismiss\s*\{/);
assert.match(detailCss, /\.detail-care-focus\.is-dismissing\s*\{/);

assert.match(modalCss, /\.profile-theme-control\s*\{/);
assert.match(modalCss, /\.profile-preference-toggle\s*\{/);
assert.match(darkCss, /html\[data-setae-theme="dark"\]\s*\{/);
assert.match(darkCss, /html\[data-setae-theme="dark"\] #section-my/);
assert.match(darkCss, /html\[data-setae-theme="dark"\] \.setae-modal/);
assert.match(
    darkCss,
    /\.setae-modal-overlay input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/
);
assert.doesNotMatch(darkCss, /\.setae-public-profile-/);
assert.match(publicProfileCss, /@media \(prefers-color-scheme: dark\)/);
// Public documents share one palette and do not inherit internal app theme CSS.
[publicProfileCss, publicPassportCss].forEach((css) => {
    assert.match(css, /background:\s*var\(--setae-public-canvas\)/);
    assert.match(css, /color:\s*var\(--setae-public-ink\)/);
});
const publicDarkPalette = parseCss(publicFoundationCss).find((rule) =>
    rule.context.some((context) => context.includes('(prefers-color-scheme: dark)'))
    && rule.body.includes('--setae-public-canvas:')
);
assert.ok(publicDarkPalette, 'Public Foundation must own a system-dark palette.');
assert.match(publicDarkPalette.prelude, /body\.setae-public-document/);
assert.match(publicDarkPalette.prelude, /body\.setae-public-profile-document/);
assert.match(publicDarkPalette.prelude, /\.setae-public-dialog/);
assert.match(publicDarkPalette.body, /--setae-public-ink:/);
assert.doesNotMatch(publicProfileCss, /--profile-canvas:/);
assert.doesNotMatch(darkCss, /\.setae-qr-public-page|\.setae-qr-profile-body|\.setae-qr-public-facts/);

const darkCssWithoutComments = darkCss.replace(/\/\*[\s\S]*?\*\//g, '');
const openingBraces = (darkCssWithoutComments.match(/\{/g) || []).length;
const closingBraces = (darkCssWithoutComments.match(/\}/g) || []).length;
assert.equal(openingBraces, closingBraces, 'Dark appearance CSS must have balanced braces.');

console.log('Appearance preference tests passed');
