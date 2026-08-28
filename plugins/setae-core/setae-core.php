<?php
/**
 * Plugin Name: Setae Core Platform
 * Description: 図鑑、生体管理、繁殖募集、コミュニティを統合するSETAEの中核システム。
 * Version: 1.0.251.1
 * Author: Antigravity
 * Text Domain: setae-core
 */

if (!defined('ABSPATH')) {
	exit;
}

// Keep VAPID secrets outside the web root by default.
$setae_pwa_secrets_file = defined('SETAE_PWA_SECRETS_FILE')
	? SETAE_PWA_SECRETS_FILE
	: '/etc/setae/pwa-secrets.php';
if (is_string($setae_pwa_secrets_file) && is_readable($setae_pwa_secrets_file)) {
	require_once $setae_pwa_secrets_file;
}

// ▼▼▼ 新規追加: Composerのオートローダーを読み込む ▼▼▼
$composer_autoload = plugin_dir_path(__FILE__) . 'vendor/autoload.php';
if (file_exists($composer_autoload)) {
	require_once $composer_autoload;
}
// ▲▲▲ 新規追加ここまで ▲▲▲


// Define Plugin Constants
// Define Plugin Constants
define('SETAE_VERSION', '1.0.251.1');
define('SETAE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SETAE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SETAE_DEFAULT_FREE_SPIDER_LIMIT', 8);
if (!defined('SETAE_USE_NEW_GUI')) {
	define('SETAE_USE_NEW_GUI', true);
}

/**
 * The code that runs during plugin activation.
 */
function activate_setae_core()
{
	require_once SETAE_PLUGIN_DIR . 'includes/class-setae-activator.php';
	Setae_Activator::activate();

	require_once plugin_dir_path(__FILE__) . 'includes/cpt/class-setae-cpt-spider.php';
	$cpt_spider = new Setae_CPT_Spider();
	$cpt_spider->register();

	require_once plugin_dir_path(__FILE__) . 'includes/cpt/class-setae-cpt-baby-group.php';
	$cpt_baby_group = new Setae_CPT_Baby_Group();
	$cpt_baby_group->register();

	require_once plugin_dir_path(__FILE__) . 'includes/cpt/class-setae-cpt-thread.php';
	$cpt_thread = new Setae_CPT_Thread();
	$cpt_thread->register();

	require_once plugin_dir_path(__FILE__) . 'includes/class-setae-pwa.php';
	Setae_PWA::activate();

	require_once plugin_dir_path(__FILE__) . 'includes/class-setae-icon-registry.php';
	Setae_Icon_Registry::register_rewrite_rule();

	require_once plugin_dir_path(__FILE__) . 'includes/frontend/class-setae-app-shell.php';
	Setae_App_Shell::ensure_app_page();
	flush_rewrite_rules(false);
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivate_setae_core()
{
	require_once SETAE_PLUGIN_DIR . 'includes/class-setae-deactivator.php';
	Setae_Deactivator::deactivate();

	require_once SETAE_PLUGIN_DIR . 'includes/class-setae-pwa.php';
	Setae_PWA::deactivate();
	flush_rewrite_rules(false);
}

register_activation_hook(__FILE__, 'activate_setae_core');
register_deactivation_hook(__FILE__, 'deactivate_setae_core');

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-core.php';
require_once SETAE_PLUGIN_DIR . 'includes/db/class-setae-enclosures.php';
add_action('init', array('Setae_Enclosures', 'maybe_upgrade'), 4);
require_once SETAE_PLUGIN_DIR . 'includes/db/class-setae-product-events.php';
require_once SETAE_PLUGIN_DIR . 'includes/db/class-setae-billing-events.php';
add_action('init', array('Setae_Product_Events', 'maybe_upgrade'), 4);
add_action('init', array('Setae_Billing_Events', 'maybe_upgrade'), 4);

// データ移行ツールの読み込み
if (is_admin()) {
	require_once plugin_dir_path(__FILE__) . 'includes/admin/class-setae-admin-migration.php';
}

/**
 * プラグインのテキストドメイン（翻訳ファイル）を読み込む
 */
function setae_core_load_textdomain()
{
	// 'setae-core' がテキストドメイン、'setae-core/languages' がフォルダパス
	load_plugin_textdomain(
		'setae-core',
		false,
		dirname(plugin_basename(__FILE__)) . '/languages/'
	);
}
// plugins_loaded フックで実行する
add_action('plugins_loaded', 'setae_core_load_textdomain');

/**
 * Keep the dedicated encyclopedia API capability available after upgrades.
 */
function setae_core_ensure_species_api_capability()
{
	$administrator = get_role('administrator');
	if ($administrator && !$administrator->has_cap('manage_setae_species_api')) {
		$administrator->add_cap('manage_setae_species_api');
	}
}
add_action('init', 'setae_core_ensure_species_api_capability', 5);

/**
 * Begins execution of the plugin.
 */
function run_setae_core()
{
	$plugin = new Setae_Core();
	$plugin->run();
}
run_setae_core();
