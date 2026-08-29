const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

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

function phpBinary() {
    const workspacePhp = path.resolve(pluginRoot, '../../../tmp/runtime-php-8.4.25/php.exe');
    return process.env.SETAE_PHP || process.env.PHP_BINARY || process.env.PHP_BIN
        || (fs.existsSync(workspacePhp) ? workspacePhp : 'php');
}

function verifyInitialThemeScript() {
    const cases = [
        { userId: 0, stored: 'dark', expected: 'system' },
        { userId: 17, stored: 'light', expected: 'light' },
        { userId: 17, stored: 'dark', expected: 'dark' },
        { userId: 17, stored: 'system', expected: 'system' },
        { userId: 29, stored: 'DARK', expected: 'dark' },
        { userId: 17, stored: '', expected: 'system' },
        { userId: 17, stored: 'unknown', expected: 'system' },
        { userId: 17, stored: null, expected: 'system' },
        { userId: 17, stored: ['dark'], expected: 'system' },
        { userId: 17, stored: 'dark"></script><script>alert(1)</script>', expected: 'system' }
    ];
    // Execute the actual PHP helper and template. Only WordPress read/encode
    // and document-hook boundaries are stubbed; this is not an integration test.
    const phpSource = [
        'function get_current_user_id() { return $GLOBALS["theme_case"]["userId"]; }',
        'function get_user_meta($id, $key, $single) {',
        '  $GLOBALS["theme_reads"][] = array($id, $key, $single);',
        '  return $GLOBALS["theme_case"]["stored"];',
        '}',
        'function sanitize_key($key) {',
        '  if (!is_string($key)) { throw new RuntimeException("sanitize_key expects a string"); }',
        '  return preg_replace("/[^a-z0-9_\\-]/", "", strtolower($key));',
        '}',
        'function wp_json_encode($value) { return json_encode($value); }',
        'function language_attributes() { echo "lang=\\"ja\\""; }',
        'function bloginfo($field) { if ($field === "charset") { echo "UTF-8"; } }',
        'function home_url($path = "") { return "https://example.invalid" . $path; }',
        'function add_query_arg($key, $value, $url) {',
        '  return $url . "?" . rawurlencode($key) . "=" . rawurlencode($value);',
        '}',
        'function esc_url($url) { return $url; }',
        'function wp_head() { echo "<style id=\\"unit-style\\"></style>"; }',
        'function wp_footer() { echo "<footer data-unit-footer></footer>"; }',
        'define("ABSPATH", __DIR__ . "/");',
        'define("SETAE_VERSION", "unit");',
        'define("SETAE_PLUGIN_URL", "https://example.invalid/plugin/");',
        'require $argv[1];',
        '$results = array();',
        'foreach (json_decode($argv[2], true) as $case) {',
        '  $GLOBALS["theme_case"] = $case;',
        '  $GLOBALS["theme_reads"] = array();',
        '  $script = Setae_App_Shell::render_initial_theme_script();',
        '  $results[] = array("script" => $script, "reads" => $GLOBALS["theme_reads"]);',
        '}',
        '$GLOBALS["theme_case"] = array("userId" => 17, "stored" => "dark");',
        '$GLOBALS["theme_reads"] = array();',
        '$expected_script = Setae_App_Shell::render_initial_theme_script();',
        '$GLOBALS["theme_reads"] = array();',
        'ob_start();',
        'require $argv[3];',
        '$document = ob_get_clean();',
        '$document_reads = $GLOBALS["theme_reads"];',
        'echo json_encode(array(',
        '  "results" => $results,',
        '  "document" => $document,',
        '  "expectedScript" => $expected_script,',
        '  "documentReads" => $document_reads',
        '), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);'
    ].join('\n');
    const rendered = JSON.parse(execFileSync(phpBinary(), [
        '-r',
        phpSource,
        path.join(pluginRoot, 'includes/frontend/class-setae-app-shell.php'),
        JSON.stringify(cases),
        path.join(pluginRoot, 'templates/app-shell.php')
    ], { cwd: pluginRoot, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }));
    const results = rendered.results;
    assert.equal(results.length, cases.length);
    results.forEach(({ script, reads }, index) => {
        const entry = cases[index];
        assert.deepEqual(reads, entry.userId > 0 ? [[entry.userId, '_setae_theme_preference', true]] : [],
            'Read only the current user preference; guests must not read another account.');
        assert.equal((script.match(/<script\b/g) || []).length, 1);
        const body = script.match(/^<script id="setae-app-initial-theme">([\s\S]+)<\/script>$/)?.[1];
        assert.ok(body, 'Render one complete initial-theme script.');
        for (const systemDark of [false, true]) {
            const html = { dataset: {} };
            let mediaCalls = 0;
            vm.runInNewContext(body, {
                document: { documentElement: html },
                window: { matchMedia(query) {
                    assert.equal(query, '(prefers-color-scheme: dark)');
                    mediaCalls += 1;
                    return { matches: systemDark };
                } }
            });
            assert.equal(html.dataset.theme,
                entry.expected === 'dark' || (entry.expected === 'system' && systemDark) ? 'dark' : 'light');
            assert.equal(mediaCalls, entry.expected === 'system' ? 1 : 0,
                'System appearance must not override an explicit saved preference.');
        }
        const html = { dataset: {} };
        vm.runInNewContext(body, { document: { documentElement: html }, window: {} });
        assert.equal(html.dataset.theme, entry.expected === 'dark' ? 'dark' : 'light',
            'A missing matchMedia API must not prevent startup.');
    });
    assert.deepEqual(rendered.documentReads, [[17, '_setae_theme_preference', true]],
        'The real app template must read only the current user theme once.');
    assert.equal((rendered.document.match(/id="setae-app-initial-theme"/g) || []).length, 1);
    const emittedTheme = rendered.document.indexOf(rendered.expectedScript);
    assert.ok(emittedTheme > rendered.document.indexOf('<meta charset="UTF-8">')
        && emittedTheme < rendered.document.indexOf('<style id="unit-style"></style>'),
        'The real app template must emit the exact helper output before wp_head styles.');
    const template = read('templates/app-shell.php');
    const earlyTheme = template.indexOf('Setae_App_Shell::render_initial_theme_script()');
    assert.equal((template.match(/Setae_App_Shell::render_initial_theme_script\(\)/g) || []).length, 1);
    assert.ok(earlyTheme > template.indexOf('<meta charset') && earlyTheme < template.indexOf('wp_head()'),
        'Set initial appearance before WordPress prints the application styles.');
}

async function verifyInitialMount() {
    const php = phpBinary();
    // Execute the real PHP class without WordPress, authentication, or API stubs.
    // The initial mount must not need any of them.
    const phpSource = [
        'require $argv[1];',
        "$shell = new Setae_App_Shell('unit');",
        'echo json_encode(array(',
        "'mount' => Setae_App_Shell::render_mount(),",
        "'shortcode' => $shell->render(),",
        "'uncached' => defined('DONOTCACHEPAGE') && DONOTCACHEPAGE",
        '), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);',
    ].join('\n');
    const rendered = JSON.parse(execFileSync(php, [
        '-r', phpSource, path.join(pluginRoot, 'includes/frontend/class-setae-app-shell.php'),
    ], { cwd: pluginRoot, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }));
    const normalize = (html) => String(html).replace(/>\s+</g, '><').trim();
    const mountInner = rendered.mount.match(/^<div id="setae-gui-root" class="setae-gui-host"><div id="app">([\s\S]*)<\/div><\/div>$/)?.[1];
    assert.ok(mountInner, 'Keep the existing host and application mount wrappers.');
    assert.equal(rendered.shortcode, rendered.mount);
    assert.equal(rendered.uncached, true);
    for (const id of ['setae-gui-root', 'app']) {
        assert.equal((rendered.mount.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
    }
    assert.doesNotMatch(rendered.mount, /<(?:script|form|button|input|select|textarea|a)(?:\s|>)/i);
    assert.doesNotMatch(rendered.mount, /aria-live|role="(?:alert|status)"|autofocus|tabindex|data-action/);
    const noScriptMessage = 'SETAEを利用するにはJavaScriptを有効にしてください。';
    assert.ok(rendered.mount.includes('<noscript><div class="boot-screen" data-app-noscript><p>' + noScriptMessage + '</p></div></noscript>'));

    const { renderBootPage, renderAuthPage } = await import(pathToFileURL(path.join(pluginRoot, 'assets/app/pages/auth.js')).href);
    const { createRenderCoordinator } = await import(pathToFileURL(path.join(pluginRoot, 'assets/app/runtime/render-coordinator.js')).href);
    const clientBoot = renderBootPage();
    const serverBoot = mountInner.match(/^<main[\s\S]*?<\/main>/)?.[0];
    assert.match(serverBoot || '', /^<main class="boot-screen" aria-busy="true" data-app-startup>/);
    assert.match(clientBoot, /aria-live="polite"/);
    // The server marker and absence of a duplicate live region are intentional.
    assert.equal(
        normalize(serverBoot.replace(' data-app-startup', '')),
        normalize(clientBoot.replace(' aria-live="polite"', '')),
        'Render the actual client boot view, including its current brand and status copy.',
    );

    const fixture = read('tests/fixtures/runtime-v243.html');
    const fixtureMount = fixture.match(/<!-- SETAE_APP_MOUNT_START -->([\s\S]*?)<!-- SETAE_APP_MOUNT_END -->/)?.[1];
    assert.ok(fixtureMount, 'Runtime fixture must expose its production mount for comparison.');
    assert.equal(normalize(fixtureMount), normalize(rendered.mount), 'Fixture markup must match the real PHP output.');
    assert.equal((fixture.match(/href="\.\.\/\.\.\/assets\/app\/styles\/screens\/auth\.css"/g) || []).length, 1);
    assert.match(shell, /'setae-gui-auth-screen', \$base \. 'styles\/screens\/auth\.css'/);
    assert.match(read('assets/app/styles/screens/auth.css'), /#app:has\(> noscript > \[data-app-noscript\]\) > \[data-app-startup\]\s*\{\s*display:\s*none;\s*\}/);

    // Exercise the real replacement operation for both server and legacy mounts.
    // DOM accessibility and the scripting-disabled cascade are browser checks.
    const finalView = renderAuthPage({ registrationEnabled: false });
    for (const initialHtml of [mountInner, '<noscript>' + noScriptMessage + '</noscript>']) {
        const root = { innerHTML: initialHtml, querySelector: () => null };
        const coordinator = createRenderCoordinator(root);
        coordinator.mount(clientBoot, { view: 'boot' });
        assert.equal(root.innerHTML, clientBoot);
        coordinator.mount(finalView, { view: 'auth' });
        assert.equal(root.innerHTML, finalView);
        assert.doesNotMatch(root.innerHTML, /data-app-startup|data-app-noscript|<noscript>/);
    }
    assert.match(app, /if \(state\.loading\) return standalone\(renderBootPage\(\)\)/,
        'Legacy empty mounts must still render the client boot view synchronously.');
    assert.match(app, /if \(app\.querySelector\('\[data-app-startup\]'\)\) await waitForInitialPaint\(\); else render\(\)/,
        'The real server startup view must paint before bootstrap work.');
    assert.match(app, /renderAppPagePreparation\(\)[\s\S]*?stagedPage: content[\s\S]*?await commitPreparedAppContent\(prepared\)/,
        'Show the app chrome first, then commit the guarded page content through the shared staging path.');
    assert.match(app, /await waitForInitialPaint\(\)[\s\S]*?renderCoordinator\.page\(prepared\.stagedPage, \{ force: true \}\)/,
        'The final page region must wait for the app chrome paint.');
    assert.match(app, /renderCoordinator\.(?:mount|prepareMount)\(/);
}

verifyInitialMount().then(() => {
    verifyInitialThemeScript();
    console.log('App Shell tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
