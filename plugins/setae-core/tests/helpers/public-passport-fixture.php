<?php
/**
 * Synthetic WordPress boundary for tests of the real passport data layer,
 * controller and document templates. No real WordPress, account or mail server.
 * Private rows deliberately coexist with published rows in the fake datastore.
 */
error_reporting(E_ALL);
define('ABSPATH', dirname(__DIR__, 2) . '/');
define('SETAE_PLUGIN_DIR', dirname(__DIR__, 2) . '/');
define('SETAE_PLUGIN_URL', '/');
preg_match('/Version:\s*([0-9.]+)/', file_get_contents(SETAE_PLUGIN_DIR . 'setae-core.php'), $setae_fixture_version_match);
define('SETAE_VERSION', $setae_fixture_version_match[1]);
define('OBJECT', 'OBJECT');
define('DAY_IN_SECONDS', 86400);

class WP_Error
{
    private $code;
    private $message;
    private $data;
    public function __construct($code, $message, $data = null) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_message() { return $this->message; }
    public function get_error_code() { return $this->code; }
    public function get_error_data($code = '') { return $this->data; }
}
class WP_User
{
    public $ID;
    public $display_name;
    public $user_login = 'fixture-user';
    public $user_email = 'fixture@example.test';
    public function __construct($id = 0) { $this->ID = $id; $this->display_name = $id === 11 ? 'PRIVATE_KEEPER_247' : 'Fixture visitor'; }
}

function is_wp_error($value) { return $value instanceof WP_Error; }
function absint($value) { return abs((int) $value); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_textarea_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_html_class($value) { return preg_replace('/[^A-Za-z0-9_-]/', '', (string) $value); }
function sanitize_email($value) { return filter_var((string) $value, FILTER_SANITIZE_EMAIL); }
function wp_strip_all_tags($value) { return strip_tags((string) $value); }
function wp_unslash($value) { return is_array($value) ? array_map('wp_unslash', $value) : (is_string($value) ? stripslashes($value) : $value); }
function esc_attr($value) { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_html($value) { return esc_attr($value); }
function esc_url_raw($value) { $value = trim((string) $value); return preg_match('/^(?:javascript|data|vbscript):/i', $value) ? '' : filter_var($value, FILTER_SANITIZE_URL); }
function esc_url($value) { return esc_attr(esc_url_raw($value)); }
function esc_textarea($value) { return esc_html($value); }
function wp_kses_post($value) { return strip_tags((string) $value, '<p><br><strong><em>'); }
function wp_parse_args($args, $defaults = array()) { return array_merge($defaults, (array) $args); }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_parse_url($url, $component = -1) { return parse_url($url, $component); }
function wp_timezone() { return new DateTimeZone('Asia/Tokyo'); }
function wp_date($format, $timestamp = null) { return date($format, $timestamp ?? strtotime('2026-08-28 12:00:00')); }
function date_i18n($format, $timestamp = null) { return wp_date($format, $timestamp); }
function number_format_i18n($value, $decimals = 0) { return number_format($value, $decimals); }
function current_time($type) { return $type === 'timestamp' ? strtotime('2026-08-28 12:00:00') : '2026-08-28 12:00:00'; }
function get_option($key, $default = false) { return $GLOBALS['setae_fixture_options'][$key] ?? $default; }
function update_option($key, $value, $autoload = null) { $GLOBALS['setae_fixture_options'][$key] = $value; return true; }
function home_url($path = '/')
{
    // The browser fixture uses a static server, not WordPress rewrite rules.
    // Serve the real Registry SVG content from generated test assets only.
    if (!empty($GLOBALS['setae_fixture_browser']) && strpos($path, '/setae-icon/') === 0) {
        $path = ($GLOBALS['setae_fixture_asset_route'] ?? '/tests/fixtures/passport-v247/assets/') . basename($path);
    }
    return ($GLOBALS['setae_fixture_origin'] ?? 'https://setae.test') . '/' . ltrim($path, '/');
}
function admin_url($path = '') { return home_url('wp-admin/' . $path); }
function site_url($path = '') { return home_url($path); }
function wp_login_url($redirect = '') { return add_query_arg('redirect_to', $redirect, home_url('wp-login.php')); }
function add_query_arg($key, $value = null, $url = null)
{
    if (is_array($key)) { $args = $key; $url = $value; } else { $args = array($key => $value); }
    $url = $url ?: home_url('/');
    $parts = parse_url($url);
    parse_str($parts['query'] ?? '', $query);
    foreach ($args as $name => $entry) { if ($entry === false) { unset($query[$name]); } else { $query[$name] = $entry; } }
    $base = preg_replace('/[?#].*$/', '', $url);
    return $base . ($query ? '?' . http_build_query($query) : '') . (isset($parts['fragment']) ? '#' . $parts['fragment'] : '');
}
function remove_query_arg($keys, $url = '') { return add_query_arg(array_fill_keys((array) $keys, false), $url ?: home_url('/')); }
function is_user_logged_in() { return !empty($GLOBALS['setae_fixture_viewer']); }
function get_current_user_id() { return (int) ($GLOBALS['setae_fixture_viewer'] ?? 0); }
function user_can($id, $capability) { return (int) $id === 99 && $capability === 'manage_options'; }
function current_user_can($capability) { return user_can(get_current_user_id(), $capability); }
function get_userdata($id) { return $GLOBALS['setae_fixture_users'][$id] ?? ($id && empty($GLOBALS['setae_fixture_strict_users']) ? new WP_User((int) $id) : false); }
function get_user_meta($id, $key, $single = true) { return $GLOBALS['setae_fixture_user_meta'][$id][$key] ?? ''; }
function update_user_meta($id, $key, $value)
{
    if (isset($GLOBALS['setae_fixture_user_meta_observer'])) { call_user_func($GLOBALS['setae_fixture_user_meta_observer'], $id, $key, $value); }
    $GLOBALS['setae_fixture_user_meta'][$id][$key] = $value; return true;
}
function delete_user_meta($id, $key, $value = '')
{
    if (!array_key_exists($key, $GLOBALS['setae_fixture_user_meta'][$id] ?? array())
        || ($value !== '' && (string) get_user_meta($id, $key, true) !== (string) $value)
        || !empty($GLOBALS['setae_fixture_fail_token_consume']) && $key === '_setae_activation_token') { return false; }
    unset($GLOBALS['setae_fixture_user_meta'][$id][$key]); return true;
}
function get_avatar_url($id, $args = array()) { return $GLOBALS['setae_fixture_avatars'][$id] ?? '/tests/fixtures/passport-247-private-avatar.svg'; }
function wp_generate_uuid4() { return 'fixture-uuid-' . count($GLOBALS['setae_fixture_posts']); }
function get_post($id) { return is_object($id) ? $id : ($GLOBALS['setae_fixture_posts'][(int) $id] ?? null); }
function get_post_meta($id, $key = '', $single = true)
{
    $GLOBALS['setae_fixture_meta_reads']++;
    if ($key === '') {
        return array_map(function ($value) { return array(is_array($value) || is_object($value) ? serialize($value) : (string) $value); }, $GLOBALS['setae_fixture_meta'][(int) $id] ?? array());
    }
    return $GLOBALS['setae_fixture_meta'][(int) $id][$key] ?? '';
}
function update_post_meta($id, $key, $value)
{
    if (isset($GLOBALS['setae_fixture_mutation_filter']) && !call_user_func($GLOBALS['setae_fixture_mutation_filter'], 'update_meta', (int) $id, $key, $value)) { return false; }
    $GLOBALS['setae_fixture_meta'][(int) $id][$key] = wp_unslash($value); return true;
}
function get_the_title($id = 0) { return get_post($id ?: ($GLOBALS['setae_fixture_loop_post']->ID ?? 0))->post_title ?? ''; }
function get_the_terms($id, $taxonomy) { return $GLOBALS['setae_fixture_terms'][$id] ?? array((object) array('slug' => 'tarantula', 'name' => 'タランチュラ')); }
function get_the_post_thumbnail_url($id, $size = '') { return $GLOBALS['setae_fixture_thumbnail'] ?? ''; }
function wp_insert_post($post, $error = false)
{
    if (!empty($GLOBALS['setae_fixture_insert_error']) && $post['post_type'] === $GLOBALS['setae_fixture_insert_error']) {
        return new WP_Error('fixture_insert_failed', 'Synthetic datastore failure');
    }
    $id = count($GLOBALS['setae_fixture_posts']) + 9000;
    $GLOBALS['setae_fixture_posts'][$id] = (object) array_merge(array('ID' => $id, 'post_name' => '', 'post_date' => '2026-08-28 00:00:00', 'post_date_gmt' => '2026-08-27 15:00:00', 'post_excerpt' => '', 'post_content' => ''), $post);
    foreach (($post['meta_input'] ?? array()) as $key => $value) { update_post_meta($id, $key, $value); }
    return $id;
}
function get_page_by_path($path, $output = OBJECT, $type = 'page')
{
    foreach ($GLOBALS['setae_fixture_posts'] as $post) { if (in_array($post->post_type, (array) $type, true) && $post->post_name === $path) { return $post; } }
    return null;
}
function setae_fixture_meta_matches($id, $query)
{
    if (isset($query['key'])) {
        $meta = $GLOBALS['setae_fixture_meta'][$id] ?? array();
        $compare = $query['compare'] ?? '=';
        if ($compare === 'EXISTS') { return array_key_exists($query['key'], $meta); }
        $actual = $meta[$query['key']] ?? '';
        if ($compare === 'IN') { return in_array($actual, (array) $query['value'], false); }
        if ($compare === '!=') { return (string) $actual !== (string) $query['value']; }
        return (string) $actual === (string) ($query['value'] ?? '');
    }
    $results = array();
    foreach ($query as $name => $clause) { if ($name !== 'relation' && is_array($clause)) { $results[] = setae_fixture_meta_matches($id, $clause); } }
    return ($query['relation'] ?? 'AND') === 'OR' ? in_array(true, $results, true) : !in_array(false, $results, true);
}
function setae_fixture_query($args, $paginate = true)
{
    $GLOBALS['setae_fixture_queries'][] = $args;
    if (isset($GLOBALS['setae_fixture_query_failure_filter']) && call_user_func($GLOBALS['setae_fixture_query_failure_filter'], $args)) {
        $GLOBALS['wpdb']->last_error = 'Synthetic query failure';
        return array();
    }
    $posts = array_values(array_filter($GLOBALS['setae_fixture_posts'], function ($post) use ($args) {
        if (isset($args['post_type']) && !in_array($post->post_type, (array) $args['post_type'], true)) { return false; }
        if (isset($args['post_status']) && ($args['post_status'] === 'any'
            ? in_array($post->post_status, array('trash', 'auto-draft', 'inherit'), true)
            : !in_array($post->post_status, (array) $args['post_status'], true))) { return false; }
        if (isset($args['author']) && (int) $post->post_author !== (int) $args['author']) { return false; }
        if (isset($args['meta_query']) && !setae_fixture_meta_matches($post->ID, $args['meta_query'])) { return false; }
        if (isset($args['meta_key'], $args['meta_value']) && !setae_fixture_meta_matches($post->ID, array('key' => $args['meta_key'], 'value' => $args['meta_value']))) { return false; }
        return true;
    }));
    usort($posts, function ($a, $b) use ($args) {
        $key = $args['meta_key'] ?? '';
        $a_value = $key ? ($GLOBALS['setae_fixture_meta'][$a->ID][$key] ?? '') : $a->post_date;
        $b_value = $key ? ($GLOBALS['setae_fixture_meta'][$b->ID][$key] ?? '') : $b->post_date;
        return strcmp($b_value, $a_value);
    });
    if ($paginate && isset($args['posts_per_page']) && $args['posts_per_page'] >= 0) { $posts = array_slice($posts, 0, $args['posts_per_page']); }
    return ($args['fields'] ?? '') === 'ids' ? array_map(function ($post) { return $post->ID; }, $posts) : $posts;
}
function get_posts($args = array()) { return setae_fixture_query($args); }
class WP_Query
{
    public $posts = array();
    public $found_posts = 0;
    public $is_404 = false;
    private $current_post = -1;
    public function __construct($args = array()) { $this->found_posts = count(setae_fixture_query($args, false)); $this->posts = setae_fixture_query($args); }
    public function have_posts() { return $this->current_post + 1 < count($this->posts); }
    public function the_post() { $GLOBALS['setae_fixture_loop_post'] = $this->posts[++$this->current_post]; }
}

function add_filter($hook, $callback, $priority = 10, $accepted = 1) { $GLOBALS['setae_fixture_hooks'][$hook][$priority][] = array($callback, $accepted); }
function add_action($hook, $callback, $priority = 10, $accepted = 1) { add_filter($hook, $callback, $priority, $accepted); }
function remove_action($hook, $callback, $priority = 10)
{
    $GLOBALS['setae_fixture_removed_hooks'][$hook][$priority][] = $callback;
    $GLOBALS['setae_fixture_hooks'][$hook][$priority] = array_values(array_filter($GLOBALS['setae_fixture_hooks'][$hook][$priority] ?? array(), function ($item) use ($callback) { return $item[0] !== $callback; }));
    return true;
}
function remove_filter($hook, $callback, $priority = 10) { return true; }
function apply_filters($hook, $value, ...$args)
{
    $hooks = $GLOBALS['setae_fixture_hooks'][$hook] ?? array(); ksort($hooks);
    foreach ($hooks as $callbacks) { foreach ($callbacks as $item) { $value = call_user_func_array($item[0], array_slice(array_merge(array($value), $args), 0, $item[1])); } }
    return $value;
}
function do_action($hook, ...$args)
{
    $hooks = $GLOBALS['setae_fixture_hooks'][$hook] ?? array(); ksort($hooks);
    foreach ($hooks as $callbacks) { foreach ($callbacks as $item) { call_user_func_array($item[0], array_slice($args, 0, $item[1])); } }
}
function wp_enqueue_style($handle, $src = '', $deps = array(), $version = '', $media = 'all') { $GLOBALS['setae_fixture_styles'][$handle] = $src; }
function wp_enqueue_script($handle, $src = '', $deps = array(), $version = '', $footer = false) { $GLOBALS['setae_fixture_scripts'][$handle] = $src; }
function wp_dequeue_style($handle) { unset($GLOBALS['setae_fixture_styles'][$handle]); }
function wp_dequeue_script($handle) { unset($GLOBALS['setae_fixture_scripts'][$handle]); }
function wp_style_is($handle, $status = 'enqueued') { return isset($GLOBALS['setae_fixture_styles'][$handle]); }
function wp_script_is($handle, $status = 'enqueued') { return isset($GLOBALS['setae_fixture_scripts'][$handle]); }
function wp_localize_script($handle, $name, $value) { $GLOBALS['setae_fixture_localized'][$name] = $value; }
function wp_add_inline_script($handle, $data, $position = 'after') { $GLOBALS['setae_fixture_inline_scripts'][$handle][$position][] = $data; return true; }
function wp_create_nonce($action = '') { return 'fixture-nonce-' . $action; }
function wp_verify_nonce($nonce, $action = '') { return $nonce === wp_create_nonce($action); }
function wp_nonce_field($action = '', $name = '_wpnonce', $referer = true, $echo = true)
{
    $html = '<input type="hidden" name="' . esc_attr($name) . '" value="' . esc_attr(wp_create_nonce($action)) . '">';
    if ($echo) { echo $html; } return $html;
}
function language_attributes() { echo 'lang="ja"'; }
function bloginfo($key) { echo $key === 'charset' ? 'UTF-8' : 'SETAE'; }
function body_class($classes = array()) { echo 'class="' . esc_attr(implode(' ', apply_filters('body_class', (array) $classes))) . '"'; }
function wp_body_open() { do_action('wp_body_open'); }
function wp_head()
{
    if (!in_array('_wp_render_title_tag', $GLOBALS['setae_fixture_removed_hooks']['wp_head'][1] ?? array(), true)) { echo '<title>' . esc_html(apply_filters('pre_get_document_title', 'SETAE fixture')) . '</title>'; }
    do_action('wp_head');
    foreach ($GLOBALS['setae_fixture_styles'] as $src) { if ($src) { echo '<link rel="stylesheet" href="' . esc_url($src) . '">'; } }
    if (!empty($GLOBALS['setae_fixture_browser'])) {
        foreach ((array) ($GLOBALS['setae_fixture_harness'] ?? '/tests/fixtures/public-passport-harness.js') as $harness) { echo '<script src="' . esc_attr($harness) . '"></script>'; }
    }
}
function wp_footer()
{
    foreach ($GLOBALS['setae_fixture_scripts'] as $handle => $src) {
        foreach ($GLOBALS['setae_fixture_inline_scripts'][$handle]['before'] ?? array() as $inline) { echo '<script>' . $inline . '</script>'; }
        if ($src) { echo '<script src="' . esc_url($src) . '" defer></script>'; }
        foreach ($GLOBALS['setae_fixture_inline_scripts'][$handle]['after'] ?? array() as $inline) { echo '<script>' . $inline . '</script>'; }
    }
    do_action('wp_footer');
}
function get_header() { echo '<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'; wp_head(); echo '</head><body '; body_class(); echo '>'; }
function get_footer() { wp_footer(); echo '</body></html>'; }
function get_query_var($name, $default = '') { return $_GET[$name] ?? $default; }
function checked($actual, $expected = true, $echo = true) { $value = $actual == $expected ? ' checked' : ''; if ($echo) { echo $value; } return $value; }
function selected($actual, $expected = true, $echo = true) { $value = $actual == $expected ? ' selected' : ''; if ($echo) { echo $value; } return $value; }
function __($text, $domain = '') { return $text; }
function is_admin() { return false; }
function wp_doing_ajax() { return false; }
function nocache_headers() {}
function status_header($status) { $GLOBALS['setae_fixture_http_status'] = $status; }

require_once SETAE_PLUGIN_DIR . 'includes/class-setae-icon-registry.php';
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-public-identity.php';
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-app-operations.php';
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-qr-manager.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-visual.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-app-shell.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-home.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-registration.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-qr.php';

function setae_fixture_invoke($object, $method, ...$args)
{
    $reflection = new ReflectionMethod($object, $method);
    $reflection->setAccessible(true);
    return $reflection->invokeArgs($object, $args);
}
function setae_fixture_property($object, $name, $value)
{
    $property = new ReflectionProperty($object, $name);
    $property->setAccessible(true);
    $property->setValue($object, $value);
}
function setae_fixture_assert($condition, $message)
{
    if (!$condition) { throw new RuntimeException($message); }
}

function setae_fixture_seed($options = array())
{
    $options = array_merge(array('visibility' => 'life_history', 'viewer' => 0, 'transfer' => false, 'photos' => 9, 'history' => 24, 'registration' => true, 'requested' => false, 'long' => false, 'species' => true, 'image_source' => 'individual', 'gender' => 'female', 'stage' => 'instar_2'), $options);
    $GLOBALS['setae_fixture_options'] = array('permalink_structure' => '/%postname%/', 'setae_enable_registration' => $options['registration'], 'users_can_register' => false);
    $GLOBALS['setae_fixture_viewer'] = (int) $options['viewer'];
    $GLOBALS['setae_fixture_hooks'] = $GLOBALS['setae_fixture_styles'] = $GLOBALS['setae_fixture_scripts'] = $GLOBALS['setae_fixture_queries'] = $GLOBALS['setae_fixture_meta'] = $GLOBALS['setae_fixture_posts'] = array();
    $GLOBALS['setae_fixture_meta_reads'] = 0;
    $GLOBALS['setae_fixture_removed_hooks'] = array();
    $GLOBALS['setae_fixture_inline_scripts'] = array();
    $GLOBALS['setae_fixture_users'] = $GLOBALS['setae_fixture_avatars'] = $GLOBALS['setae_fixture_terms'] = array();
    $GLOBALS['setae_fixture_user_meta'] = array(11 => array('_setae_referral_code' => 'PRIVATE_REFERRAL_247'));
    $_GET = array(); $_POST = array(); $_SERVER['REQUEST_METHOD'] = 'GET'; $_SERVER['REQUEST_URI'] = '/r4k7m/';
    if ($options['requested']) { $_GET['requested'] = '1'; }
    $title = $options['long'] ? '個体管理番号-2026-0123456789012345678901234567890123456789-標本観察記録' : 'SPECIMEN_ID_247';
    $species = !$options['species'] ? '' : ($options['long'] ? 'Phormingochilus sp. “極めて長い地域名と学名の折り返し確認 0123456789012345678901234567890”' : 'Phormingochilus species247');
    foreach (array(101 => array(Setae_QR_Manager::TARGET_POST_TYPE, 'private', 'r4k7m', 'QR target'), 201 => array('setae_spider', 'publish', 'specimen', $title), 301 => array('setae_species', 'publish', 'taxon', $species)) as $id => $row) {
        $GLOBALS['setae_fixture_posts'][$id] = (object) array('ID' => $id, 'post_type' => $row[0], 'post_status' => $row[1], 'post_name' => $row[2], 'post_title' => $row[3], 'post_author' => 11, 'post_date' => '2026-02-01 00:00:00');
    }
    $GLOBALS['setae_fixture_meta'][101] = array('_setae_qr_target_type' => 'spider', '_setae_qr_object_id' => 201);
    $GLOBALS['setae_fixture_meta'][201] = array(
        '_setae_species_id' => 301, '_setae_gender' => $options['gender'], '_setae_spider_stage' => $options['stage'],
        '_setae_spider_origin' => 'CB', '_setae_management_start_date' => '2026-02-01',
        Setae_QR_Manager::PUBLIC_MODE_META => $options['visibility'],
        Setae_QR_Manager::TRANSFER_ENABLED_META => $options['transfer'] ? '1' : '',
        '_setae_spider_image' => $options['photos'] && $options['image_source'] === 'individual' ? '/tests/fixtures/passport-247-photo.svg?photo=hero' : '',
        '_setae_last_feed_date' => '1981-01-19', '_setae_last_molt_date' => '1981-01-20',
        '_setae_last_pairing_date' => '1981-01-21', '_setae_last_observation_date' => '1981-01-22',
        '_setae_memo' => 'PRIVATE_INTERNAL_MEMO_247', '_setae_enclosure_id' => 'PRIVATE_ENCLOSURE_247',
    );
    $GLOBALS['setae_fixture_thumbnail'] = $options['photos'] && $options['image_source'] === 'species' ? '/tests/fixtures/passport-247-photo.svg?photo=species' : '';
    $types = array('molt', 'growth', 'pairing');
    for ($index = 0; $index < $options['history']; $index++) {
        $id = 401 + $index;
        $date = date('Y-m-d', strtotime('2026-08-27 -' . $index . ' days'));
        $GLOBALS['setae_fixture_posts'][$id] = (object) array('ID' => $id, 'post_type' => 'setae_log', 'post_status' => 'publish', 'post_name' => 'record-' . $index, 'post_title' => 'Public event', 'post_content' => 'PRIVATE_INTERNAL_NOTE_IN_PUBLIC_RECORD_247', 'post_author' => 11, 'post_date' => $date . ' 12:00:00');
        $GLOBALS['setae_fixture_meta'][$id] = array('_setae_log_spider_id' => 201, '_setae_log_type' => $types[$index % 3], '_setae_log_date' => $date, '_setae_log_shared' => $index < max(0, $options['photos'] - 1) ? '1' : '0', '_setae_log_note' => 'PRIVATE_LOG_NOTE_247');
        if ($index < max(0, $options['photos'] - 1)) { $GLOBALS['setae_fixture_meta'][$id]['_setae_log_image'] = '/tests/fixtures/passport-247-photo.svg?photo=' . $index; }
    }
    // This newer record must never survive the real manager's publish filter.
    $GLOBALS['setae_fixture_posts'][801] = (object) array('ID' => 801, 'post_type' => 'setae_log', 'post_status' => 'private', 'post_name' => 'PRIVATE_RECORD_247', 'post_title' => 'PRIVATE_RECORD_247', 'post_content' => 'PRIVATE_RECORD_BODY_247', 'post_author' => 11, 'post_date' => '2099-09-19 00:00:00');
    $GLOBALS['setae_fixture_meta'][801] = array('_setae_log_spider_id' => 201, '_setae_log_type' => 'molt', '_setae_log_date' => '2099-09-19', '_setae_log_shared' => '1', '_setae_log_image' => '/PRIVATE_PHOTO_247.jpg');
    // Published photo without the existing explicit share flag is not public.
    $GLOBALS['setae_fixture_posts'][802] = (object) array('ID' => 802, 'post_type' => 'setae_log', 'post_status' => 'publish', 'post_name' => 'UNSHARED_PHOTO_247', 'post_title' => 'UNSHARED_PHOTO_247', 'post_content' => '', 'post_author' => 11, 'post_date' => '2026-08-01 00:00:00');
    $GLOBALS['setae_fixture_meta'][802] = array('_setae_log_spider_id' => 201, '_setae_log_type' => 'photo', '_setae_log_date' => '2026-08-01', '_setae_log_shared' => '0', '_setae_log_image' => '/UNSHARED_PHOTO_247.jpg');
    if ($options['requested']) {
        $GLOBALS['setae_fixture_posts'][901] = (object) array('ID' => 901, 'post_type' => Setae_QR_Manager::TRANSFER_POST_TYPE, 'post_status' => 'publish', 'post_name' => 'request', 'post_title' => 'request', 'post_author' => 11, 'post_date' => '2026-08-28 00:00:00');
        $GLOBALS['setae_fixture_meta'][901] = array('_setae_transfer_target_id' => 101, '_setae_transfer_to_user' => $options['viewer'], '_setae_transfer_status' => 'pending');
    }
    return $options;
}

function setae_fixture_passport($options = array(), $mutator = null)
{
    $options = setae_fixture_seed($options);
    $data = Setae_QR_Manager::get_public_target_data(get_post(101), $options['viewer']);
    if ($mutator) { $data = $mutator($data); }
    $controller = new Setae_Public_QR(SETAE_VERSION);
    setae_fixture_property($controller, 'page_data', $data);
    $message = $options['requested'] ? '引き継ぎ申請を送信しました。現在の所有者が承認すると、履歴ごとマイ個体へ移動します。' : '';
    $context = setae_fixture_invoke($controller, 'build_template_context', $data, 'r4k7m', $message, 'success');
    return array($controller, $context, $data);
}
function setae_fixture_render($controller, $context)
{
    add_filter('pre_get_document_title', array($controller, 'filter_document_title'));
    add_filter('body_class', array($controller, 'add_body_class'));
    add_action('wp_head', array($controller, 'render_meta_tags'), 1);
    Setae_Public_Home::enqueue_passport(SETAE_VERSION);
    Setae_Public_Registration::enqueue(SETAE_VERSION);
    wp_enqueue_script('setae-public-passport', '/assets/js/public-passport.js', array(), SETAE_VERSION, true);
    ob_start();
    setae_fixture_invoke($controller, 'render_document', $context);
    return ob_get_clean();
}
