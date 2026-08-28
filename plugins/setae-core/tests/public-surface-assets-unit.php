<?php
/** Exercise actual public enqueue/isolation methods with small WP registries. */
define('ABSPATH', __DIR__ . '/');
define('SETAE_PLUGIN_DIR', dirname(__DIR__) . '/');
define('SETAE_PLUGIN_URL', 'https://setae.example/wp-content/plugins/setae-core/');

$GLOBALS['asset_hooks'] = array();
$GLOBALS['asset_removed'] = array('style' => array(), 'script' => array());

function asset_registry()
{
    return (object) array('queue' => array(), 'registered' => array());
}

function asset_enqueue($type, $handle, $source, $dependencies, $version, $footer = false)
{
    $registry = $GLOBALS[$type === 'style' ? 'wp_styles' : 'wp_scripts'];
    $registry->registered[$handle] = (object) array('src' => $source, 'deps' => $dependencies, 'ver' => $version, 'footer' => $footer);
    if (!in_array($handle, $registry->queue, true)) {
        $registry->queue[] = $handle;
    }
}

function wp_enqueue_style($handle, $source, $dependencies = array(), $version = false)
{
    asset_enqueue('style', $handle, $source, $dependencies, $version);
}

function wp_enqueue_script($handle, $source, $dependencies = array(), $version = false, $footer = false)
{
    asset_enqueue('script', $handle, $source, $dependencies, $version, $footer);
}

function asset_dequeue($type, $handle)
{
    $registry = $GLOBALS[$type === 'style' ? 'wp_styles' : 'wp_scripts'];
    $registry->queue = array_values(array_diff($registry->queue, array($handle)));
    $GLOBALS['asset_removed'][$type][] = $handle;
}

function wp_dequeue_style($handle) { asset_dequeue('style', $handle); }
function wp_dequeue_script($handle) { asset_dequeue('script', $handle); }
function add_action($hook, $callback, $priority = 10)
{
    $GLOBALS['asset_hooks'][$hook][$priority][implode('::', $callback)] = $callback;
}

function asset_check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

require SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-registration.php';
require SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-home.php';

$wp_styles = asset_registry();
$wp_scripts = asset_registry();
wp_enqueue_style('setae-global', SETAE_PLUGIN_URL . 'assets/css/setae-global.css', array('dashicons'), 'old');
Setae_Public_Home::isolate_public_surface_assets();
asset_check(in_array('setae-global', $wp_styles->queue, true), 'Isolation must not act before a dedicated Care/Partner enqueue.');

$retained = array(
    'theme-style' => 'https://setae.example/wp-content/themes/example/style.css',
    'setae-themed-name' => 'https://setae.example/wp-content/themes/example/also-theme.css',
    'other-plugin' => 'https://setae.example/wp-content/plugins/other/style.css',
    'nearby-plugin-name' => 'https://setae.example/wp-content/plugins/setae-core-addon/style.css',
    'foreign-origin' => 'https://cdn.example/wp-content/plugins/setae-core/theme.css',
    'foreign-port' => 'https://setae.example:9443/wp-content/plugins/setae-core/theme.css',
    'foreign-protocol' => 'http://setae.example/wp-content/plugins/setae-core/theme.css',
);
$theme_snapshots = array();
foreach ($retained as $handle => $url) {
    wp_enqueue_style($handle, $url, array(), 'theme-unchanged');
    wp_enqueue_script($handle, $url . '.js', array('jquery'), 'theme-unchanged', true);
    $theme_snapshots[$handle] = array(clone $wp_styles->registered[$handle], clone $wp_scripts->registered[$handle]);
}
wp_enqueue_script('jquery', false, array('jquery-core', 'jquery-migrate'), 'core');
wp_enqueue_script('jquery-core', 'https://setae.example/wp-includes/js/jquery/jquery.min.js', array(), 'core');
wp_enqueue_script('jquery-migrate', 'https://setae.example/wp-includes/js/jquery/jquery-migrate.min.js', array('jquery-core'), 'core');
$jquery_snapshot = clone $wp_scripts->registered['jquery'];

wp_enqueue_style('setae-public-pages', SETAE_PLUGIN_URL . 'assets/css/public-pages.css', array(), 'old');
wp_enqueue_style('custom-legacy-name', '/wp-content/plugins/setae-core/assets/css/modules/cards.css?ver=old', array(), 'old');
wp_enqueue_style('protocol-relative-legacy', '//setae.example/wp-content/plugins/setae-core/assets/css/modules/layout.css', array(), 'old');
wp_enqueue_script('setae-app-main', SETAE_PLUGIN_URL . 'assets/js/setae-app.js', array('jquery'), 'old', true);
wp_enqueue_script('setae-public-entry-share', SETAE_PLUGIN_URL . 'assets/js/public-entry-share.js', array(), 'old', true);
wp_enqueue_script('chart-js', SETAE_PLUGIN_URL . 'assets/js/vendor/chart/chart.umd.min.js', array(), 'old', true);

function verify_surface_assets($surface, $version, $retained, $theme_snapshots, $jquery_snapshot)
{
    global $wp_styles, $wp_scripts;
    $page_handle = 'setae-public-' . $surface;
    $expected_styles = array('setae-public-foundation', 'setae-public-registration', $page_handle);
    $expected_scripts = array('setae-public-registration', 'setae-public-share', $page_handle);
    $remaining_styles = array_values(array_filter($wp_styles->queue, function ($handle) use ($retained) {
        return !isset($retained[$handle]);
    }));
    $remaining_scripts = array_values(array_filter($wp_scripts->queue, function ($handle) use ($retained) {
        return !isset($retained[$handle]) && !in_array($handle, array('jquery', 'jquery-core', 'jquery-migrate'), true);
    }));
    asset_check($remaining_styles === $expected_styles, $surface . ': only the three intended plugin style handles should remain in order.');
    asset_check($remaining_scripts === $expected_scripts, $surface . ': only registration, shared share and adapter scripts should remain in order.');
    foreach (array('style' => $expected_styles, 'script' => $expected_scripts) as $type => $handles) {
        $registry = $type === 'style' ? $wp_styles : $wp_scripts;
        foreach ($handles as $handle) {
            asset_check($registry->registered[$handle]->ver === $version, $handle . ': enqueue must use the supplied release version.');
            if ($type === 'script') {
                asset_check($registry->registered[$handle]->footer === true, $handle . ': scripts should load in the footer.');
            }
        }
    }
    asset_check($wp_styles->registered[$page_handle]->deps === array('setae-public-foundation'), 'Page CSS depends on Foundation.');
    asset_check($wp_scripts->registered[$page_handle]->deps === array('setae-public-share'), 'Page JS depends only on shared Share.');
    asset_check($wp_scripts->registered['setae-public-share']->deps === array(), 'Shared Share has no framework dependency.');
    asset_check($wp_scripts->registered['setae-public-registration']->deps === array(), 'Registration must retain its dependency contract.');
    asset_check($wp_styles->registered[$page_handle]->src === SETAE_PLUGIN_URL . 'assets/css/public-' . $surface . '.css', 'Correct page stylesheet source.');
    asset_check($wp_scripts->registered[$page_handle]->src === SETAE_PLUGIN_URL . 'assets/js/public-' . $surface . '.js', 'Correct page adapter source.');
    foreach ($theme_snapshots as $handle => $snapshot) {
        asset_check(in_array($handle, $wp_styles->queue, true) && in_array($handle, $wp_scripts->queue, true), $handle . ': unrelated asset must stay queued.');
        asset_check($wp_styles->registered[$handle] == $snapshot[0] && $wp_scripts->registered[$handle] == $snapshot[1], $handle . ': source and dependency definitions must remain untouched.');
    }
    foreach (array('jquery', 'jquery-core', 'jquery-migrate') as $handle) {
        asset_check(in_array($handle, $wp_scripts->queue, true), 'WordPress core ' . $handle . ' must not be dequeued.');
    }
    asset_check($wp_scripts->registered['jquery'] == $jquery_snapshot, 'Core jQuery alias dependencies must remain unchanged.');
}

Setae_Public_Home::enqueue_public_care_share('1.0.248-test');
verify_surface_assets('care-share', '1.0.248-test', $retained, $theme_snapshots, $jquery_snapshot);
Setae_Public_Home::enqueue_public_partner('1.0.248-next');
verify_surface_assets('partner', '1.0.248-next', $retained, $theme_snapshots, $jquery_snapshot);

$expected_hooks = array('wp_enqueue_scripts' => 1000, 'wp_print_styles' => 1000, 'wp_print_scripts' => 1000, 'wp_print_footer_scripts' => 0);
asset_check(count($GLOBALS['asset_hooks']) === count($expected_hooks), 'Only the four expected isolation hooks are installed.');
foreach ($expected_hooks as $hook => $priority) {
    $callbacks = $GLOBALS['asset_hooks'][$hook][$priority] ?? array();
    asset_check(count($callbacks) === 1, $hook . ': one idempotent shared callback at the correct priority.');
    wp_enqueue_style('late-plugin-style', SETAE_PLUGIN_URL . 'assets/css/modules/modals.css', array(), 'late');
    wp_enqueue_script('late-plugin-script', SETAE_PLUGIN_URL . 'assets/js/setae-app.js', array(), 'late');
    foreach ($callbacks as $callback) {
        call_user_func($callback);
    }
    verify_surface_assets('partner', '1.0.248-next', $retained, $theme_snapshots, $jquery_snapshot);
}
echo "Public Surface asset enqueue/isolation tests passed\n";
