<?php
/** In-memory WordPress boundary; all account/QR/entitlement behavior uses production classes. */
require_once __DIR__ . '/public-passport-fixture.php';
define('HOUR_IN_SECONDS', 3600);
define('MINUTE_IN_SECONDS', 60);
define('ARRAY_A', 'ARRAY_A');
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-entitlements.php';
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-claim-registration.php';
require_once SETAE_PLUGIN_DIR . 'includes/api/class-setae-api-qr.php';

class Setae_Claim_Fixture_DB
{
    public $prefix = 'fixture_';
    public $posts = 'fixture_posts';
    public $users = 'fixture_users';
    public $usermeta = 'fixture_usermeta';
    public $postmeta = 'fixture_postmeta';
    public $terms = 'fixture_terms';
    public $term_taxonomy = 'fixture_term_taxonomy';
    public $term_relationships = 'fixture_term_relationships';
    public $termmeta = 'fixture_termmeta';
    public $reconnect_retries = 5;
    public $last_error = '';
    public $queries = array();
    private $transaction = null;
    private $errors_suppressed = false;
    public function suppress_errors($value) { $before = $this->errors_suppressed; $this->errors_suppressed = $value; return $before; }
    public function prepare($sql, ...$values)
    {
        if (count($values) === 1 && is_array($values[0])) { $values = $values[0]; }
        return preg_replace_callback('/%[ds]/', function ($match) use (&$values) {
            $value = array_shift($values);
            return $match[0] === '%d' ? (string) (int) $value : "'" . str_replace("'", "''", (string) $value) . "'";
        }, $sql);
    }
    public function get_var($sql)
    {
        $this->queries[] = $sql;
        if (strpos($sql, 'GET_LOCK(') !== false) {
            if (isset($GLOBALS['setae_fixture_on_lock'])) { $callback = $GLOBALS['setae_fixture_on_lock']; unset($GLOBALS['setae_fixture_on_lock']); $callback(); }
            return empty($GLOBALS['setae_fixture_lock_failure']) ? '1' : '0';
        }
        if (strpos($sql, 'RELEASE_LOCK(') !== false) { return '1'; }
        if (strpos($sql, 'SELECT ENGINE') === 0) { return $GLOBALS['setae_fixture_engine'] ?? 'InnoDB'; }
        if ($sql === 'SELECT @@SESSION.autocommit') { return $GLOBALS['setae_fixture_autocommit'] ?? 1; }
        if (preg_match('/SELECT ID FROM fixture_users WHERE ID = (\d+)/', $sql, $match)) { return get_userdata((int) $match[1]) ? (int) $match[1] : null; }
        if (preg_match('/SELECT ID FROM fixture_posts WHERE ID = (\d+) FOR UPDATE/', $sql, $match)) { return get_post((int) $match[1]) ? (int) $match[1] : null; }
        if (strpos($sql, 'COUNT(user_id)') !== false) { return 0; }
        return 0;
    }
    public function get_results($sql) { $this->queries[] = $sql; return array(); }
    public function query($sql)
    {
        $this->queries[] = $sql;
        $failure = $GLOBALS['setae_fixture_query_failure'][$sql] ?? null;
        if ($failure === 'lost_after_commit') { $this->transaction = null; return false; }
        if ($failure === true) { return false; }
        if ($sql === 'START TRANSACTION') { $this->transaction = serialize(array($GLOBALS['setae_fixture_posts'], $GLOBALS['setae_fixture_meta'], $GLOBALS['setae_fixture_user_meta'], $GLOBALS['setae_fixture_terms'])); }
        if ($sql === 'ROLLBACK' && $this->transaction !== null) {
            list($GLOBALS['setae_fixture_posts'], $GLOBALS['setae_fixture_meta'], $GLOBALS['setae_fixture_user_meta'], $GLOBALS['setae_fixture_terms']) = unserialize($this->transaction);
            $this->transaction = null;
        }
        if ($sql === 'COMMIT') { $this->transaction = null; }
        return 1;
    }
}

class WP_REST_Response
{
    private $data;
    private $status;
    public function __construct($data, $status = 200) { $this->data = $data; $this->status = $status; }
    public function get_data() { return $this->data; }
    public function get_status() { return $this->status; }
}
class Setae_Claim_Fixture_Request implements ArrayAccess
{
    private $params;
    public function __construct($params) { $this->params = $params; }
    public function get_param($name) { return $this->params[$name] ?? null; }
    public function has_param($name) { return array_key_exists($name, $this->params); }
    public function get_json_params() { return $this->params; }
    public function get_body() { return wp_json_encode($this->params); }
    public function offsetExists($offset): bool { return $this->has_param($offset); }
    public function offsetGet($offset): mixed { return $this->get_param($offset); }
    public function offsetSet($offset, $value): void { $this->params[$offset] = $value; }
    public function offsetUnset($offset): void { unset($this->params[$offset]); }
}

/** Only the event transport is stubbed, including failure and duplicate outcomes. */
class Setae_Product_Events
{
    public static function public_config($surface, $context = array())
    {
        // Signed-context verification and the event datastore belong to Product Events tests.
        $GLOBALS['setae_fixture_public_configs'][] = array('surface' => $surface, 'context' => $context);
        return array('surface' => $surface, 'endpoint' => home_url('/tests/acquisition-events'), 'nonce' => 'local-fixture-nonce', 'context_token' => 'LOCAL_ONLY_CONTEXT', 'path' => $surface === 'passport' ? '/r4k7m/' : '/');
    }
    public static function record($name, $context)
    {
        if (!empty($GLOBALS['setae_fixture_event_failure'])) { return new WP_Error('fixture_event_unavailable', 'Synthetic event failure'); }
        $key = $context['idempotency_key'];
        $duplicate = isset($GLOBALS['setae_fixture_events'][$key]);
        if (!$duplicate) {
            $GLOBALS['setae_fixture_events'][$key] = array('name' => $name, 'context' => $context, 'queries' => $GLOBALS['wpdb']->queries);
        }
        return array('accepted' => true, 'duplicate' => $duplicate);
    }
}

function add_user_meta($id, $key, $value, $unique = false)
{
    if ($unique && array_key_exists($key, $GLOBALS['setae_fixture_user_meta'][$id] ?? array())) { return false; }
    return update_user_meta($id, $key, $value);
}
function add_post_meta($id, $key, $value, $unique = false)
{
    if ($unique && array_key_exists($key, $GLOBALS['setae_fixture_meta'][$id] ?? array())) { return false; }
    if (isset($GLOBALS['setae_fixture_mutation_filter']) && !call_user_func($GLOBALS['setae_fixture_mutation_filter'], 'add_meta', (int) $id, $key, $value)) { return false; }
    return update_post_meta($id, $key, $value);
}
function delete_post_meta($id, $key, $value = '')
{
    if (isset($GLOBALS['setae_fixture_mutation_filter']) && !call_user_func($GLOBALS['setae_fixture_mutation_filter'], 'delete_meta', (int) $id, $key, $value)) { return false; }
    unset($GLOBALS['setae_fixture_meta'][$id][$key]); return true;
}
function wp_update_post($post, $error = false)
{
    $old = get_post($post['ID']);
    if (!$old) { return new WP_Error('fixture_post_missing', 'Synthetic missing post'); }
    if (isset($GLOBALS['setae_fixture_mutation_filter']) && !call_user_func($GLOBALS['setae_fixture_mutation_filter'], 'update_post', (int) $post['ID'], '', $post)) { return (int) $post['ID']; }
    $GLOBALS['setae_fixture_posts'][$post['ID']] = (object) array_merge((array) $old, $post);
    return (int) $post['ID'];
}
function get_post_field($name, $id) { return get_post($id)->$name ?? ''; }
function get_post_type($id) { return get_post($id)->post_type ?? false; }
function get_post_status($id) { return get_post($id)->post_status ?? false; }
function get_the_ID() { return $GLOBALS['setae_fixture_loop_post']->ID ?? 0; }
function get_the_date($format = '', $id = 0) { return date($format ?: 'Y-m-d', strtotime(get_post($id ?: get_the_ID())->post_date)); }
function wp_reset_postdata() { unset($GLOBALS['setae_fixture_loop_post']); }
function wp_list_pluck($items, $field) { return array_map(function ($item) use ($field) { return is_object($item) ? $item->$field : $item[$field]; }, $items); }
function rest_sanitize_boolean($value) { return is_string($value) ? !in_array(strtolower($value), array('false', '0'), true) : (bool) $value; }
function get_post_types($args = array(), $output = 'names') { return array('post', 'page', 'setae_species'); }
function wp_delete_post($id, $force = false) { $post = get_post($id); unset($GLOBALS['setae_fixture_posts'][$id], $GLOBALS['setae_fixture_meta'][$id]); return $post; }
function wp_slash($value) { return is_array($value) ? array_map('wp_slash', $value) : (is_string($value) ? addslashes($value) : $value); }
function metadata_exists($type, $id, $key) { return array_key_exists($key, $GLOBALS[$type === 'post' ? 'setae_fixture_meta' : 'setae_fixture_user_meta'][$id] ?? array()); }
function wp_suspend_cache_addition($value = null)
{
    $before = $GLOBALS['setae_fixture_cache_suspended'] ?? false;
    if ($value !== null) { $GLOBALS['setae_fixture_cache_suspended'] = $value; }
    return $before;
}
function maybe_unserialize($value) { $decoded = @unserialize($value, array('allowed_classes' => false)); return $decoded === false && $value !== 'b:0;' ? $value : $decoded; }
function wp_get_object_terms($id, $taxonomy, $args = array()) { return array('tarantula'); }
function wp_set_object_terms($id, $terms, $taxonomy) { $GLOBALS['setae_fixture_terms'][$id] = $terms; return $terms; }
function clean_post_cache($id) { $GLOBALS['setae_fixture_cache_clears'][] = array('posts', (int) $id); }
function wp_cache_delete($id, $group) { $GLOBALS['setae_fixture_cache_clears'][] = array($group, (int) $id); return true; }
function clean_object_term_cache($id, $type) { $GLOBALS['setae_fixture_cache_clears'][] = array('object_terms', (int) $id); }
function clean_term_cache($ids, $taxonomy) {}
function update_meta_cache($type, $ids) { return array(); }
function is_email($value) { return filter_var($value, FILTER_VALIDATE_EMAIL); }
function sanitize_user($value, $strict = false) { return preg_replace('/[^A-Za-z0-9_.@-]/', '', (string) $value); }
function username_exists($value)
{
    foreach ($GLOBALS['setae_fixture_users'] as $user) { if ($user->user_login === $value) { return $user->ID; } }
    return false;
}
function email_exists($value)
{
    foreach ($GLOBALS['setae_fixture_users'] as $user) { if ($user->user_email === $value) { return $user->ID; } }
    return false;
}
function wp_create_user($username, $password, $email)
{
    $id = 100 + count($GLOBALS['setae_fixture_users']);
    $user = new WP_User($id); $user->user_login = $username; $user->user_email = $email;
    $GLOBALS['setae_fixture_users'][$id] = $user;
    return $id;
}
function get_users($args = array()) { return array(); }
function wp_mail($email, $subject, $body) { $GLOBALS['setae_fixture_mail'][] = array('email' => $email, 'body' => $body); return true; }
function wp_generate_password($length = 12, $special = true, $extra = false) { return str_repeat('x', $length); }
function wp_rand($min, $max) { return random_int($min, $max); }
function wp_salt($scheme = 'auth') { return 'LOCAL_ONLY_SYNTHETIC_SALT_' . $scheme; }
function get_transient($key) { return $GLOBALS['setae_fixture_transients'][$key] ?? false; }
function set_transient($key, $value, $expiration) { $GLOBALS['setae_fixture_transients'][$key] = $value; return true; }
function wp_set_current_user($id) { $GLOBALS['setae_fixture_viewer'] = (int) $id; return get_userdata($id); }
function wp_set_auth_cookie($id, $remember = false, $secure = '') { $GLOBALS['setae_fixture_auth_cookies'][] = array('user_id' => $id, 'remember' => $remember, 'secure' => $secure); }
function is_ssl() { return true; }

function setae_claim_seed($options = array())
{
    unset($GLOBALS['setae_fixture_mutation_filter'], $GLOBALS['setae_fixture_on_lock'], $GLOBALS['setae_fixture_loop_post'], $GLOBALS['setae_fixture_user_meta_observer'], $GLOBALS['setae_fixture_query_failure_filter']);
    $_FILES = array();
    $GLOBALS['setae_fixture_query_failure'] = $GLOBALS['setae_fixture_cache_clears'] = array();
    $GLOBALS['setae_fixture_engine'] = 'InnoDB';
    $GLOBALS['setae_fixture_autocommit'] = 1;
    $GLOBALS['setae_fixture_cache_suspended'] = false;
    setae_fixture_seed(array_merge(array('transfer' => true, 'history' => 2, 'photos' => 1), $options));
    $GLOBALS['setae_fixture_strict_users'] = true;
    $GLOBALS['setae_fixture_users'] = array(11 => new WP_User(11), 22 => new WP_User(22), 33 => new WP_User(33));
    foreach ($GLOBALS['setae_fixture_users'] as $id => $user) { $user->user_login = 'fixture-' . $id; $user->user_email = 'fixture-' . $id . '@example.test'; }
    foreach ($GLOBALS['setae_fixture_posts'] as $post) {
        $post->post_content = $post->post_content ?? '';
        $post->post_excerpt = $post->post_excerpt ?? '';
        $post->post_date_gmt = $post->post_date;
    }
    $GLOBALS['wpdb'] = new Setae_Claim_Fixture_DB();
    $GLOBALS['setae_fixture_events'] = $GLOBALS['setae_fixture_auth_cookies'] = $GLOBALS['setae_fixture_mail'] = $GLOBALS['setae_fixture_transients'] = array();
    $GLOBALS['setae_fixture_public_configs'] = array();
    $GLOBALS['setae_fixture_lock_failure'] = $GLOBALS['setae_fixture_fail_token_consume'] = $GLOBALS['setae_fixture_event_failure'] = false;
    $GLOBALS['setae_fixture_insert_error'] = '';
    $_SERVER['REMOTE_ADDR'] = '192.0.2.251';
    update_user_meta(22, '_setae_is_verified', 0);
    update_user_meta(22, '_setae_activation_token', 'LOCAL_TEST_VERIFICATION_TOKEN');
    update_post_meta(201, Setae_QR_Manager::TARGET_ID_META, 101);
    update_post_meta(201, Setae_QR_Manager::CODE_META, 'r4k7m');
}

function setae_claim_requests()
{
    return array_values(array_filter($GLOBALS['setae_fixture_posts'], function ($post) { return $post->post_type === Setae_QR_Manager::TRANSFER_POST_TYPE; }));
}

function setae_claim_assert($condition, $message)
{
    if (!$condition) { throw new RuntimeException($message); }
}
