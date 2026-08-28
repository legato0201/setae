const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

const plugin = read('setae-core.php');
const core = read('includes/class-setae-core.php');
const claimRegistration = read('includes/class-setae-claim-registration.php');
const shell = read('includes/frontend/class-setae-app-shell.php');
const app = read('assets/app/app.js');
const pwa = read('includes/class-setae-pwa.php');
const legacy = read('includes/frontend/class-setae-dashboard.php');
const publicHome = read('includes/frontend/class-setae-public-home.php');
const globalCss = read('assets/css/setae-global.css');
const publicHomeCss = read('assets/css/public-home.css');

assert.match(plugin, /define\('SETAE_USE_NEW_GUI', true\)/);
assert.match(core, /class-setae-app-shell\.php/);
assert.match(core, /if \(\$app_shell->is_enabled\(\)\)/);
assert.match(core, /template_redirect', \$app_shell, 'prepare_request', 0/);
assert.match(core, /wp_enqueue_scripts', \$app_shell, 'enqueue_assets', 100/);
assert.match(core, /template_include', \$app_shell, 'select_template', 999/);
assert.match(core, /wp_enqueue_scripts', \$app_shell, 'isolate_styles', 999/);
assert.match(core, /style_loader_tag', \$app_shell, 'filter_style_tag', 999, 2/);
assert.match(core, /else \{[\s\S]*?new Setae_Dashboard/);

assert.match(shell, /has_shortcode\([\s\S]*?'setae_dashboard'/);
assert.match(shell, /add_shortcode\('setae_dashboard'/);
assert.match(shell, /post_name'\s*=>\s*'app'/);
assert.match(shell, /post_content'\s*=>\s*'\[setae_dashboard\]'/);
const isAppRequestMethod = shell.match(/public static function is_app_page_request\(\)[\s\S]*?^    }/m)?.[0] || '';
assert.match(isAppRequestMethod, /if \(is_front_page\(\)\)\s*\{\s*return true;\s*\}/);
assert.match(shell, /public static function app_url\(/);
const appUrlMethod = shell.match(/public static function app_url\(\$args = array\(\)\)[\s\S]*?^    }/m)?.[0] || '';
assert.match(appUrlMethod, /\$url = home_url\('\/'\)/);
assert.doesNotMatch(appUrlMethod, /get_permalink|get_app_page_id|setae_app/);
assert.match(shell, /public static function login_url\(/);
const loginUrlMethod = shell.match(/public static function login_url\(\$return_url = ''\)[\s\S]*?^    }/m)?.[0] || '';
assert.doesNotMatch(loginUrlMethod, /if \(!\$return_url\)/);
assert.match(shell, /\$args\['setae_return'\]/);
const prepareRequestMethod = shell.match(/public function prepare_request\(\)[\s\S]*?^    }/m)?.[0] || '';
assert.match(prepareRequestMethod, /define\('DONOTCACHEPAGE', true\)/);
assert.match(prepareRequestMethod, /nocache_headers\(\)/);
assert.match(prepareRequestMethod, /show_admin_bar\(false\)/);
assert.match(prepareRequestMethod, /remove_action\('wp_head', 'wp_custom_css_cb', 101\)/);
assert.match(shell, /assets\/app\/app\.js/);
assert.match(shell, /templates\/app-shell\.php/);
assert.doesNotMatch(shell, /styles\/app\.css|styles\/wordpress\.css|setae-gui-legacy|setae-gui-wordpress/);
assert.match(shell, /wp_dequeue_style\(\$handle\)/);
assert.match(shell, /strpos\(\(string\) \$handle, 'setae-gui-'\)/);
assert.match(shell, /type="module"/);
assert.match(shell, /'apiRoot'\s*=>\s*untrailingslashit\(rest_url\('setae\/v1'\)\)/);
assert.match(shell, /'embedded'\s*=>\s*true/);
assert.match(shell, /'enableMock'\s*=>\s*false/);
assert.match(shell, /'debug'\s*=>\s*defined\('WP_DEBUG'\)\s*&&\s*WP_DEBUG/);
assert.match(shell, /'serviceWorkerUrl'\s*=>\s*home_url\('\/setae-sw\.js'\)/);
assert.match(shell, /id="setae-gui-root"/);
assert.match(shell, /id="app"/);

const submitLogin = app.match(/async function submitLogin\(form\)[\s\S]*?^}/m)?.[0] || '';
assert.match(submitLogin, /if \(returnUrl\)[\s\S]*?location\.replace\(returnUrl\)/);
assert.match(submitLogin, /replaceRoute\(captureRoute\(0\), \{ url: cleanAppPath\(\) \}\)/);
assert.doesNotMatch(submitLogin, /location\.replace\(returnUrl \|\||safeSameOriginHttpUrl\(appConfig\.appUrl/);
assert.match(app, /params\.get\('verified'\) === '1'/);
assert.match(app, /メールアドレスを確認しました。ログインしてください。/);

assert.match(core, /\$app_url = class_exists\('Setae_App_Shell'\)/);
assert.match(core, /\? Setae_App_Shell::app_url\(\)/);
assert.match(core, /: home_url\('\/'\)/);
assert.match(core, /wp_safe_redirect\(\$app_url\)/);
assert.doesNotMatch(core, /wp_redirect\(home_url\(\)\)/);
assert.match(core, /class-setae-claim-registration\.php/);
assert.match(core, /Setae_Claim_Registration::verification_redirect\(\$user_id, \$token\)/);
assert.match(core, /wp_safe_redirect\(\$redirect, 303\)/);
assert.match(core, /Referrer-Policy: no-referrer/);
assert.match(claimRegistration, /empty\(\$result\['token_consumed'\]\) \|\| !empty\(\$result\['already_verified'\]\)/);
assert.match(claimRegistration, /add_query_arg\('verified', '1', Setae_App_Shell::login_url\(\)\)/);
const consumedGate = claimRegistration.indexOf("if (empty($result['token_consumed'])");
const sessionCreation = claimRegistration.indexOf('wp_set_auth_cookie($user_id');
assert.ok(consumedGate > 0 && sessionCreation > consumedGate);
assert.match(claimRegistration.slice(consumedGate, sessionCreation), /return get_current_user_id\(\) === \$user_id/);
assert.doesNotMatch(core, /wp_set_auth_cookie\(/);
assert.doesNotMatch(pwa, /add_query_arg\('setae_app'/);

const renderMethod = shell.match(/public function render\(\)[\s\S]*?^    }/m)?.[0] || '';
assert.doesNotMatch(renderMethod, /is_user_logged_in|wp_get_current_user|get_current_user_id/);

assert.match(publicHome, /is_front_page\(\)/);
assert.match(publicHome, /assets\/css\/public-foundation\.css/);
assert.match(publicHome, /assets\/css\/public-home\.css/);
assert.match(publicHome, /function enqueue_public_care_share\(/);
assert.match(publicHome, /function enqueue_public_partner\(/);
assert.doesNotMatch(publicHome, /enqueue_public_pages|assets\/css\/public-pages\.css/);
assert.match(publicHome, /assets\/css\/public-passport\.css/);
assert.match(publicHomeCss, /\.setae-public-home-v2/);
assert.doesNotMatch(globalCss, /\.setae-public-home-v2/);

assert.match(legacy, /public function enqueue_styles\(\)\s*\{\s*if \(!\$this->is_app_page\(\)\)/);
assert.match(legacy, /public function enqueue_scripts\(\)\s*\{\s*if \(!\$this->is_app_page\(\)\)/);

[
    'assets/app/app.js',
    'assets/app/api/client.js',
    'assets/app/styles/tokens.css',
    'assets/app/styles/foundation.css',
    'assets/app/styles/components.css',
    'assets/app/styles/components/media.css',
    'assets/app/styles/components/specimen-card.css',
    'assets/app/styles/components/update-notice.css',
    'assets/app/styles/patterns/task-workspace.css',
    'assets/app/styles/screens/auth.css',
    'assets/app/styles/screens/collection-editor.css',
    'assets/app/styles/screens/qr.css',
    'assets/app/styles/screens/community.css',
    'assets/app/styles/screens/settings.css',
    'assets/app/styles/patterns/discussion.css',
    'assets/app/styles/patterns/care-plan.css',
    'assets/app/styles/screens/husbandry.css',
    'templates/app-shell.php',
    'assets/app/vendor/qrcode.min.js',
    'assets/app/vendor/jsQR.js',
    'assets/css/public-foundation.css',
    'assets/css/public-home.css',
    'assets/css/public-care-share.css',
    'assets/css/public-partner.css',
    'assets/css/public-passport.css',
].forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(pluginRoot, relativePath)), `Missing App Shell asset: ${relativePath}`);
});

assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/app.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/wordpress.css')), false);
assert.equal(fs.existsSync(path.join(pluginRoot, 'assets/app/styles/layouts.css')), false);

console.log('App Shell tests passed');
