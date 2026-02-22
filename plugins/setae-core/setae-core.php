<?php
/**
 * Plugin Name: Setae Core Platform
 * Description: 図鑑、生体管理、BL、コミュニティを統合するSETAEの中核システム。
 * Version: 1.0.0
 * Author: Antigravity
 * Text Domain: setae-core
 */

if (!defined('ABSPATH')) {
	exit;
}

// ▼▼▼ 新規追加: Composerのオートローダーを読み込む ▼▼▼
$composer_autoload = plugin_dir_path(__FILE__) . 'vendor/autoload.php';
if (file_exists($composer_autoload)) {
	require_once $composer_autoload;
}
// ▲▲▲ 新規追加ここまで ▲▲▲


// Define Plugin Constants
// Define Plugin Constants
define('SETAE_VERSION', '1.0.36');
define('SETAE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SETAE_PLUGIN_URL', plugin_dir_url(__FILE__));

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

	require_once plugin_dir_path(__FILE__) . 'includes/cpt/class-setae-cpt-thread.php';
	$cpt_thread = new Setae_CPT_Thread();
	$cpt_thread->register();
}

/**
 * The code that runs during plugin deactivation.
 */
function deactivate_setae_core()
{
	require_once SETAE_PLUGIN_DIR . 'includes/class-setae-deactivator.php';
	Setae_Deactivator::deactivate();
}

register_activation_hook(__FILE__, 'activate_setae_core');
register_deactivation_hook(__FILE__, 'deactivate_setae_core');

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-core.php';

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
 * Begins execution of the plugin.
 */
function run_setae_core()
{
	$plugin = new Setae_Core();
	$plugin->run();
}
run_setae_core();
