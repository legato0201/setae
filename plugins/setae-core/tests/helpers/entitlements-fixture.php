<?php

// In-memory WordPress/DB boundary; the entitlement and API classes are real.
// Named locks, transactions and WP metadata caches are modeled, not a
// substitute for a live MySQL engine/concurrency test.
define('SETAE_DEFAULT_FREE_SPIDER_LIMIT', 8);
define('DAY_IN_SECONDS', 86400);
define('HOUR_IN_SECONDS', 3600);
define('MINUTE_IN_SECONDS', 60);

class WP_Error
{
    private $code; private $message; private $data;
    public function __construct($code, $message = '', $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Response
{
    public $data; public $status;
    public function __construct($data, $status = 200) { $this->data = $data; $this->status = $status; }
    public function get_data() { return $this->data; }
    public function get_status() { return $this->status; }
}
class Entitlement_Request implements ArrayAccess
{
    private $data;
    public function __construct($data = array()) { $this->data = $data; }
    public function get_param($key) { return $this->data[$key] ?? null; }
    public function get_params() { return $this->data; }
    public function has_param($key) { return array_key_exists($key, $this->data); }
    public function set_param($key, $value) { $this->data[$key] = $value; }
    public function offsetExists($key): bool { return $this->has_param($key); }
    public function offsetGet($key): mixed { return $this->get_param($key); }
    public function offsetSet($key, $value): void { $this->set_param($key, $value); }
    public function offsetUnset($key): void { unset($this->data[$key]); }
}
class Entitlement_DB
{
    public $prefix = 'wp_'; public $posts = 'wp_posts'; public $postmeta = 'wp_postmeta';
    public $users = 'wp_users'; public $usermeta = 'wp_usermeta'; public $terms = 'wp_terms';
    public $term_taxonomy = 'wp_term_taxonomy'; public $term_relationships = 'wp_term_relationships'; public $termmeta = 'wp_termmeta';
    public $held = array(); public $calls = array(); public $unavailable = false; public $reconnect_retries = 5;
    public $engines = array(); public $autocommit = '1'; public $external_transaction = false;
    public $transaction = null; public $savepoints = array(); public $fail_queries = array(); public $query_counts = array();
    public $connected = true; public $disconnect_on_meta = ''; public $replayed_statements = 0;
    public $commit_applied_but_failed = false; private $errors_suppressed = false;
    public function prepare($query, ...$args) { return array($query, $args); }
    public function suppress_errors($suppress = true) { $old = $this->errors_suppressed; $this->errors_suppressed = $suppress; return $old; }
    public function disconnect() {
        if ($this->transaction !== null) {
            list($GLOBALS['ent_posts'], $GLOBALS['ent_post_meta'], $GLOBALS['ent_user_meta'], $GLOBALS['ent_terms']) = unserialize($this->transaction);
        }
        $this->connected = false; $this->transaction = null; $this->savepoints = array(); $this->held = array();
    }
    public function query($sql) {
        $this->calls[] = array($sql, array());
        if (!$this->connected) { return false; }
        $this->query_counts[$sql] = ($this->query_counts[$sql] ?? 0) + 1;
        if (($this->fail_queries[$sql] ?? 0) === $this->query_counts[$sql]) { return false; }
        if ($sql === 'SET TRANSACTION READ WRITE') { return $this->external_transaction || $this->transaction !== null ? false : 0; }
        if ($sql === 'START TRANSACTION') {
            if ($this->transaction !== null) { throw new RuntimeException('Nested fixture transaction'); }
            $this->transaction = serialize(array($GLOBALS['ent_posts'], $GLOBALS['ent_post_meta'], $GLOBALS['ent_user_meta'], $GLOBALS['ent_terms']));
            return 0;
        }
        if ($sql === 'ROLLBACK') {
            if ($this->transaction !== null) {
                list($GLOBALS['ent_posts'], $GLOBALS['ent_post_meta'], $GLOBALS['ent_user_meta'], $GLOBALS['ent_terms']) = unserialize($this->transaction);
            }
            $this->transaction = null; $this->savepoints = array(); return 0;
        }
        if ($sql === 'COMMIT') {
            $this->transaction = null; $this->savepoints = array();
            if ($this->commit_applied_but_failed) { $this->commit_applied_but_failed = false; return false; }
            return 0;
        }
        if (strpos($sql, 'SAVEPOINT ') === 0) {
            if ($this->transaction === null) { return false; }
            $this->savepoints[substr($sql, 10)] = true; return 0;
        }
        if (strpos($sql, 'RELEASE SAVEPOINT ') === 0) {
            $key = substr($sql, 18);
            if (!isset($this->savepoints[$key])) { return false; }
            unset($this->savepoints[$key]); return 0;
        }
        throw new RuntimeException('Unexpected transaction query in entitlement fixture: ' . $sql);
    }
    public function get_var($query) {
        $this->calls[] = $query;
        if (!$this->connected) { return null; }
        list($sql, $args) = is_array($query) ? $query : array($query, array());
        if (strpos($sql, 'GET_LOCK') !== false) {
            if ($this->unavailable || isset($this->held[$args[0]])) { return '0'; }
            $this->held[$args[0]] = true; return '1';
        }
        if (strpos($sql, 'RELEASE_LOCK') !== false) { unset($this->held[$args[0]]); return '1'; }
        if (strpos($sql, 'SELECT ENGINE FROM information_schema.TABLES') === 0) { return array_key_exists($args[0], $this->engines) ? $this->engines[$args[0]] : 'InnoDB'; }
        if ($sql === 'SELECT @@SESSION.autocommit') { return $this->autocommit; }
        if (strpos($sql, 'SELECT ID FROM wp_posts WHERE ID = ') === 0) { return isset($GLOBALS['ent_posts'][$args[0]]) ? (string) $args[0] : null; }
        throw new RuntimeException('Unexpected DB query in entitlement fixture');
    }
}
class WP_Query
{
    public $posts; public $found_posts; private $position = 0;
    public function __construct($args) { $this->posts = get_posts($args); $this->found_posts = count($this->posts); }
    public function have_posts() { return $this->position < count($this->posts); }
    public function the_post() { $GLOBALS['ent_query_post'] = $this->posts[$this->position++]; }
}
class Setae_Product_Events
{
    public static $events = array(); public static $fail = false;
    public static function record($name, $context) {
        if (self::$fail) { return new WP_Error('event_store_unavailable'); }
        self::$events[] = array('name' => $name, 'context' => $context);
        return array('accepted' => true, 'duplicate' => false, 'event' => $name);
    }
}
class Setae_QR_Manager
{
    public static $promotion_fail_code = '';
    public static function ensure_spider_target($id) { return (object) array('post_name' => 'qr-' . $id); }
    public static function get_short_url($code) { return 'https://example.test/q/' . $code; }
    public static function promote_baby_target($group, $code, $id) {
        if ($code === self::$promotion_fail_code) { return new WP_Error('qr_promotion_failed'); }
        // Persist real fixture artifacts so the outer transaction must undo
        // QR routing as well as specimens. The real QR contract has its own tests.
        $target = fixture_post('setae_qr_target', get_current_user_id());
        Setae_Entitlements::track_transaction_post($target);
        update_post_meta($target, '_setae_qr_object_id', $id);
        update_post_meta($id, '_setae_qr_target_id', $target);
        $map = get_post_meta($group, '_setae_baby_qr_targets', true);
        $map = is_array($map) ? $map : array(); unset($map[$code]);
        update_post_meta($group, '_setae_baby_qr_targets', $map);
        return get_post($target);
    }
}

function fixture_reset()
{
    $GLOBALS['ent_users'] = array(7 => (object) array('ID' => 7, 'display_name' => 'Keeper', 'user_email' => 'keeper@example.test', 'user_registered' => '2026-08-01 00:00:00'));
    $GLOBALS['ent_user_meta'] = array(); $GLOBALS['ent_post_meta'] = array(); $GLOBALS['ent_posts'] = array();
    $GLOBALS['ent_options'] = array(); $GLOBALS['ent_filters'] = array(); $GLOBALS['ent_hooks'] = array();
    $GLOBALS['ent_current_user'] = 7; $GLOBALS['ent_admins'] = array(); $GLOBALS['ent_next_id'] = 100;
    $GLOBALS['ent_insert_count'] = array(); $GLOBALS['ent_fail_insert'] = array();
    $GLOBALS['ent_meta_write_count'] = array(); $GLOBALS['ent_fail_meta'] = array(); $GLOBALS['ent_fail_terms'] = false;
    $GLOBALS['ent_terms'] = array(); $GLOBALS['ent_cache'] = array(); $GLOBALS['ent_cache_deletions'] = array(); $GLOBALS['ent_cache_suspended'] = false;
    $GLOBALS['wpdb'] = new Entitlement_DB(); Setae_Product_Events::$events = array(); Setae_Product_Events::$fail = false;
    Setae_QR_Manager::$promotion_fail_code = ''; $_FILES = array(); $_POST = array();
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function absint($value) { return abs((int) $value); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_textarea_field($value) { return trim(strip_tags((string) $value)); }
function esc_url_raw($value) { return (string) $value; }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES); }
function esc_attr($value) { return esc_html($value); }
function wp_strip_all_tags($value) { return strip_tags((string) $value); }
function wp_unslash($value) { return is_array($value) ? array_map('wp_unslash', $value) : (is_string($value) ? stripslashes($value) : $value); }
function wp_slash($value) { return is_array($value) ? array_map('wp_slash', $value) : (is_string($value) ? addslashes($value) : $value); }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_cache_delete($key, $group = '') { $GLOBALS['ent_cache_deletions'][] = array($key, $group); unset($GLOBALS['ent_cache'][$group][$key]); return true; }
function wp_suspend_cache_addition($suspend = null) { if (is_bool($suspend)) { $GLOBALS['ent_cache_suspended'] = $suspend; } return $GLOBALS['ent_cache_suspended']; }
function clean_post_cache($id) { wp_cache_delete($id, 'posts'); wp_cache_delete($id, 'post_meta'); }
function clean_object_term_cache($id, $type) { wp_cache_delete($id, 'term_relationships'); }
function clean_term_cache($ids, $taxonomy = '') { foreach ((array) $ids as $id) { wp_cache_delete($id, 'terms'); } }
function update_meta_cache($type, $ids) { return array(); }
function wp_rand($min = 0, $max = 0) { static $offset = 0; return $min + (++$offset % max(1, $max - $min + 1)); }
function get_current_user_id() { return $GLOBALS['ent_current_user']; }
function is_user_logged_in() { return get_current_user_id() > 0; }
function user_can($id, $cap) { return in_array((int) $id, $GLOBALS['ent_admins'], true); }
function current_user_can($cap, ...$args) { return user_can(get_current_user_id(), $cap) || ($cap === 'edit_post' && isset($args[0]) && (int) get_post_field('post_author', $args[0]) === get_current_user_id()); }
function wp_verify_nonce($nonce, $action) { return $nonce === 'valid'; }
function wp_die($message, $title = '', $args = array()) { throw new RuntimeException($message, $args['response'] ?? 500); }
function get_users($args) { return array(); }
function get_userdata($id) { return $GLOBALS['ent_users'][$id] ?? false; }
function fixture_read_meta($type, $id, $key) {
    $cache_group = $type . '_meta';
    if (isset($GLOBALS['ent_cache'][$cache_group][$id])) { $all = $GLOBALS['ent_cache'][$cache_group][$id]; }
    else {
        $all = $GLOBALS['ent_' . $type . '_meta'][$id] ?? array();
        if (!wp_suspend_cache_addition()) { $GLOBALS['ent_cache'][$cache_group][$id] = $all; }
    }
    return $all[$key] ?? '';
}
function fixture_write_meta($type, $id, $key, $value) {
    global $wpdb;
    $failure_key = $type . ':' . $key;
    if ($wpdb->disconnect_on_meta === $failure_key) {
        $wpdb->disconnect_on_meta = ''; $wpdb->disconnect();
        if ($wpdb->reconnect_retries > 0) { $wpdb->connected = true; $wpdb->replayed_statements++; }
    }
    if (!$wpdb->connected) { return false; }
    $GLOBALS['ent_meta_write_count'][$failure_key] = ($GLOBALS['ent_meta_write_count'][$failure_key] ?? 0) + 1;
    if (($GLOBALS['ent_fail_meta'][$failure_key] ?? 0) === $GLOBALS['ent_meta_write_count'][$failure_key]) { return false; }
    $GLOBALS['ent_' . $type . '_meta'][$id][$key] = wp_unslash($value);
    wp_cache_delete($id, $type . '_meta'); return true;
}
function metadata_exists($type, $id, $key) { return array_key_exists($key, $GLOBALS['ent_' . $type . '_meta'][$id] ?? array()); }
function get_user_meta($id, $key, $single = true) { return fixture_read_meta('user', $id, $key); }
function update_user_meta($id, $key, $value) { return fixture_write_meta('user', $id, $key, $value); }
function add_user_meta($id, $key, $value, $unique = false) { if ($unique && isset($GLOBALS['ent_user_meta'][$id][$key])) { return false; } return update_user_meta($id, $key, $value); }
function delete_user_meta($id, $key) { unset($GLOBALS['ent_user_meta'][$id][$key]); wp_cache_delete($id, 'user_meta'); return true; }
function get_post_meta($id, $key, $single = true) { return fixture_read_meta('post', $id, $key); }
function update_post_meta($id, $key, $value) { return fixture_write_meta('post', $id, $key, $value); }
function add_post_meta($id, $key, $value, $unique = false) { if ($unique && isset($GLOBALS['ent_post_meta'][$id][$key])) { return false; } return update_post_meta($id, $key, $value); }
function delete_post_meta($id, $key) { unset($GLOBALS['ent_post_meta'][$id][$key]); wp_cache_delete($id, 'post_meta'); return true; }
function get_option($key, $default = false) { return $GLOBALS['ent_options'][$key] ?? $default; }
function update_option($key, $value, $autoload = null) { $GLOBALS['ent_options'][$key] = $value; return true; }
function apply_filters($name, $value, ...$args) { return isset($GLOBALS['ent_filters'][$name]) ? call_user_func($GLOBALS['ent_filters'][$name], $value, ...$args) : $value; }
function add_filter($hook, $callback, $priority = 10, $args = 1) { $GLOBALS['ent_hooks'][] = array($hook, $callback, $priority, $args); }
function add_action($hook, $callback, $priority = 10, $args = 1) { add_filter($hook, $callback, $priority, $args); }
function remove_action($hook, $callback, $priority = 10) { $GLOBALS['ent_hooks'] = array_values(array_filter($GLOBALS['ent_hooks'], function ($entry) use ($hook, $callback, $priority) { return $entry[0] !== $hook || $entry[1] !== $callback || $entry[2] !== $priority; })); }
function current_time($format, $gmt = false) { return $format === 'timestamp' ? time() : gmdate($format === 'mysql' ? 'Y-m-d H:i:s' : $format); }
function get_post($id) { return is_object($id) ? $id : ($GLOBALS['ent_posts'][$id] ?? null); }
function get_post_type($id) { return get_post($id)->post_type ?? ''; }
function get_post_status($id) { return get_post($id)->post_status ?? ''; }
function get_post_field($field, $id) { return get_post($id)->$field ?? ''; }
function get_the_ID() { return $GLOBALS['ent_query_post']->ID; }
function get_the_content() { return $GLOBALS['ent_query_post']->post_content; }
function wp_reset_postdata() { unset($GLOBALS['ent_query_post']); }
function get_the_title($id) { return get_post($id)->post_title ?? ''; }
function get_post_time($format, $gmt = false, $post = null) { return gmdate($format, strtotime((get_post($post)->post_date_gmt ?? '2026-08-01 00:00:00') . ' UTC')); }
function get_post_modified_time($format, $gmt = false, $post = null) { return get_post_time($format, $gmt, $post); }
function wp_insert_post($data, $error = false) {
    $type = $data['post_type'];
    $GLOBALS['ent_insert_count'][$type] = ($GLOBALS['ent_insert_count'][$type] ?? 0) + 1;
    if (($GLOBALS['ent_fail_insert'][$type] ?? 0) === $GLOBALS['ent_insert_count'][$type]) { return new WP_Error('insert_failed', 'fixture insert failure'); }
    $id = ++$GLOBALS['ent_next_id'];
    $GLOBALS['ent_posts'][$id] = (object) array_merge(array('ID' => $id, 'post_title' => '', 'post_content' => '', 'post_status' => 'publish', 'post_date' => gmdate('Y-m-d H:i:s'), 'post_date_gmt' => gmdate('Y-m-d H:i:s')), $data);
    foreach ($GLOBALS['ent_hooks'] as $entry) {
        if ($entry[0] === 'wp_after_insert_post') { call_user_func_array($entry[1], array_slice(array($id, $GLOBALS['ent_posts'][$id], false, null), 0, $entry[3])); }
    }
    return $id;
}
function wp_update_post($data, $error = false) { $id = (int) $data['ID']; if (!get_post($id)) { return new WP_Error('not_found'); } foreach ($data as $key => $value) { $GLOBALS['ent_posts'][$id]->$key = $value; } return $id; }
function wp_delete_post($id, $force = false) { $old = get_post($id); unset($GLOBALS['ent_posts'][$id], $GLOBALS['ent_post_meta'][$id], $GLOBALS['ent_terms'][$id]); clean_post_cache($id); return $old; }
function get_posts($args) {
    $posts = array_values(array_filter($GLOBALS['ent_posts'], function ($post) use ($args) {
        if (isset($args['post_type']) && !in_array($post->post_type, (array) $args['post_type'], true)) { return false; }
        if (isset($args['author']) && (int) $post->post_author !== (int) $args['author']) { return false; }
        if (isset($args['post_status']) && $args['post_status'] !== 'any' && !in_array($post->post_status, (array) $args['post_status'], true)) { return false; }
        if (isset($args['meta_key']) && isset($args['meta_value']) && (string) get_post_meta($post->ID, $args['meta_key'], true) !== (string) $args['meta_value']) { return false; }
        if (!empty($args['meta_query']) && !fixture_meta_matches($post->ID, $args['meta_query'])) { return false; }
        return true;
    }));
    if (($args['posts_per_page'] ?? -1) >= 0) { $posts = array_slice($posts, 0, $args['posts_per_page']); }
    return ($args['fields'] ?? '') === 'ids' ? array_map(function ($post) { return (int) $post->ID; }, $posts) : $posts;
}
function fixture_meta_matches($id, $query) {
    $matches = array();
    foreach ($query as $clause) {
        if (!is_array($clause)) { continue; }
        if (!isset($clause['key'])) { $matches[] = fixture_meta_matches($id, $clause); continue; }
        $value = get_post_meta($id, $clause['key'], true); $compare = $clause['compare'] ?? '=';
        if ($compare === 'NOT EXISTS') { $matches[] = !isset($GLOBALS['ent_post_meta'][$id][$clause['key']]); }
        elseif ($compare === '!=') { $matches[] = (string) $value !== (string) $clause['value']; }
        else { $matches[] = (string) $value === (string) $clause['value']; }
    }
    return ($query['relation'] ?? 'AND') === 'OR' ? in_array(true, $matches, true) : !in_array(false, $matches, true);
}
function count_user_posts($id, $type, $public = false) { return count(get_posts(array('post_type' => $type, 'author' => $id, 'post_status' => 'publish'))); }
function wp_set_object_terms($id, $terms, $taxonomy) {
    if ($GLOBALS['ent_fail_terms']) { return new WP_Error('fixture_terms_failed'); }
    $GLOBALS['ent_terms'][$id][$taxonomy] = array_values((array) $terms); return array(1);
}
function wp_get_object_terms($id, $taxonomy, $args = array()) {
    return array_map(function ($term) { return (object) array('term_id' => 1, 'term_taxonomy_id' => 1, 'slug' => $term); }, $GLOBALS['ent_terms'][$id][$taxonomy] ?? array());
}
function term_exists($term, $taxonomy = '') { return 1; }
function get_the_post_thumbnail_url($id, $size = '') { return false; }
function get_avatar_url($id) { return 'https://example.test/avatar.png'; }
function home_url($path = '') { return 'https://example.test' . $path; }
function add_query_arg($key, $value = '', $url = '') { return $url . '?' . rawurlencode($key) . '=' . rawurlencode($value); }
function rest_sanitize_boolean($value) { return filter_var($value, FILTER_VALIDATE_BOOLEAN); }
function fixture_post($type = 'setae_spider', $user = 7, $meta = array(), $status = 'publish') {
    $id = wp_insert_post(array('post_type' => $type, 'post_author' => $user, 'post_title' => 'Fixture ' . ($GLOBALS['ent_next_id'] + 1), 'post_status' => $status));
    foreach ($meta as $key => $value) { update_post_meta($id, $key, $value); }
    return $id;
}
function fixture_assert($condition, $message) { if (!$condition) { throw new RuntimeException($message); } }
function fixture_error($value, $code, $message) { fixture_assert(is_wp_error($value) && $value->get_error_code() === $code, $message); }

fixture_reset();
require_once dirname(__DIR__, 2) . '/includes/class-setae-entitlements.php';
