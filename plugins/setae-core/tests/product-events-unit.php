<?php

// Execute the real store, REST callback and aggregate formatter with a deterministic
// WordPress/wpdb contract double. This is not a live MySQL or WordPress integration test.
define('DAY_IN_SECONDS', 86400);
define('ARRAY_A', 'ARRAY_A');
define('SETAE_VERSION', '1.0.251');
$upgrade_root = sys_get_temp_dir() . '/setae-product-events-unit-' . getmypid() . '/';
mkdir($upgrade_root . 'wp-admin/includes', 0777, true);
file_put_contents($upgrade_root . 'wp-admin/includes/upgrade.php', '<?php');
define('ABSPATH', $upgrade_root);
register_shutdown_function(function () use ($upgrade_root) {
    unlink($upgrade_root . 'wp-admin/includes/upgrade.php');
    rmdir($upgrade_root . 'wp-admin/includes');
    rmdir($upgrade_root . 'wp-admin');
    rmdir($upgrade_root);
});

class WP_Error
{
    private $code;
    private $message;
    private $data;
    public function __construct($code, $message, $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Server { const READABLE = 'GET'; const CREATABLE = 'POST'; const EDITABLE = 'PUT,PATCH'; const DELETABLE = 'DELETE'; }
class WP_REST_Response
{
    public $data;
    public $status;
    public function __construct($data, $status) { $this->data = $data; $this->status = $status; }
}
class Product_Request
{
    public $data;
    public $headers;
    public $body;
    public function __construct($data = array(), $headers = array(), $body = null) {
        $this->data = $data; $this->headers = $headers; $this->body = $body === null ? json_encode($data) : $body;
    }
    public function get_params() { return $this->data; }
    public function get_header($name) { return $this->headers[$name] ?? ''; }
    public function get_body() { return $this->body; }
}
class Setae_App_Operations
{
    const TERMS_VERSION = '2026-08-28';
    public static $rate_calls = array();
    public static $limited = false;
    public static function get_allowed_metric_events() { return array('public_home_view', 'email_verified', 'register_submit', 'records_add'); }
    public static function consume_request_limit($bucket, $limit, $window) {
        self::$rate_calls[] = array($bucket, $limit, $window);
        return self::$limited ? new WP_Error('rate_limited', 'Too many requests.', array('status' => 429)) : true;
    }
}
class Setae_Entitlements
{
    public static function get_plan_id($user_id) { return $user_id === 7 ? 'breeder_trial' : 'keeper_free'; }
    public static function peek_plan_id($user_id) { return $user_id === 42 ? 'legacy_premium' : self::get_plan_id($user_id); }
}
class Setae_QR_Manager
{
    const TRANSFER_ENABLED_META = '_setae_transfer_enabled';
    public static function get_spider_public_mode($id) { return get_post_meta($id, '_setae_qr_public_mode', true) ?: 'private'; }
}
class Product_Wpdb
{
    public $prefix = 'unit_';
    public $rows = array();
    public $prepared = array();
    public $calls = array();
    public $table_exists = true;
    public $fail_insert = false;
    public $throw_insert = false;
    public $fail_aggregate = false;
    public $aggregate = array();
    public function get_charset_collate() { return 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'; }
    public function esc_like($value) { return addcslashes($value, '_%\\'); }
    public function prepare($sql, ...$args) {
        if (count($args) === 1 && is_array($args[0])) $args = $args[0];
        $token = 'prepared:' . count($this->prepared);
        $this->prepared[$token] = array('sql' => $sql, 'values' => $args);
        return $token;
    }
    private function read($query) {
        if (!isset($this->prepared[$query])) throw new RuntimeException('Unprepared SQL reached wpdb.');
        $prepared = $this->prepared[$query];
        $this->calls[] = $prepared;
        return $prepared;
    }
    public function query($query) {
        $p = $this->read($query);
        if ($this->throw_insert) throw new RuntimeException('Synthetic SQL details must never escape.');
        if ($this->fail_insert) return false;
        if (!preg_match('/^INSERT IGNORE INTO unit_setae_product_events \(([^)]+)\) VALUES \(([^)]+)\)$/D', $p['sql'], $m)) {
            throw new RuntimeException('Unexpected mutation: ' . $p['sql']);
        }
        $row = array(); $index = 0;
        $columns = explode(',', $m[1]);
        foreach (explode(',', $m[2]) as $offset => $placeholder) {
            $row[$columns[$offset]] = $placeholder === 'NULL' ? null : $p['values'][$index++];
        }
        if ($index !== count($p['values'])) throw new RuntimeException('Placeholder/value count mismatch.');
        if (isset($this->rows[$row['idempotency_key']])) return 0;
        $row['id'] = count($this->rows) + 1;
        $this->rows[$row['idempotency_key']] = $row;
        return 1;
    }
    public function get_var($query) {
        $p = $this->read($query);
        if (strpos($p['sql'], 'SHOW TABLES LIKE') === 0) return $this->table_exists ? $this->prefix . 'setae_product_events' : null;
        if (strpos($p['sql'], 'SELECT occurred_at') === 0) return $this->rows[$p['values'][0]]['occurred_at'] ?? null;
        throw new RuntimeException('Unexpected scalar query.');
    }
    public function get_results($query, $format) {
        $p = $this->read($query);
        if ($this->fail_aggregate) return null;
        preg_match('/setae:product:([^ ]+)/', $p['sql'], $m);
        return $this->aggregate[$m[1]] ?? array();
    }
    public function get_row($query, $format) {
        $p = $this->read($query);
        if ($this->fail_aggregate) return null;
        preg_match('/setae:product:([^ ]+)/', $p['sql'], $m);
        $fallback = $m[1] === 'activation' ? array('cohort' => 0, 'eligible' => 0, 'activated' => 0, 'activated_eligible' => 0)
            : array('cohort' => 0, 'eligible' => 0, 'retained' => 0);
        return $this->aggregate[$m[1]] ?? $fallback;
    }
}

$options = array(); $option_updates = array(); $meta = array(); $post_meta = array();
$current_user = 0; $uuid_counter = 0; $routes = array(); $schema = ''; $delta_calls = 0; $checks = 0;
$is_admin = false; $actions = array(); $menus = array(); $user_queries = array(); $meta_cache_calls = array();
$users = array(7 => (object) array('ID' => 7), 8 => (object) array('ID' => 8), 42 => (object) array('ID' => 42));
$posts = array(
    101 => (object) array('ID' => 101, 'post_type' => 'setae_spider', 'post_author' => 7),
    102 => (object) array('ID' => 102, 'post_type' => 'setae_spider', 'post_author' => 8),
    201 => (object) array('ID' => 201, 'post_type' => 'setae_baby_group', 'post_author' => 8),
    301 => (object) array('ID' => 301, 'post_type' => 'setae_log', 'post_author' => 7),
);
$wpdb = new Product_Wpdb();
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_json_encode($value) { return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value)); }
function wp_generate_uuid4() { return sprintf('00000000-0000-4000-8000-%012d', ++$GLOBALS['uuid_counter']); }
function get_current_user_id() { return $GLOBALS['current_user']; }
function get_option($key, $default = false) { return $GLOBALS['options'][$key] ?? $default; }
function update_option($key, $value, $autoload = null) { $GLOBALS['options'][$key] = $value; $GLOBALS['option_updates'][] = array($key, $autoload); return true; }
function get_user_meta($id, $key, $single = true) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_user_meta($id, $key, $value) { $GLOBALS['meta'][$id][$key] = $value; return true; }
function get_userdata($id) { return $GLOBALS['users'][$id] ?? false; }
function get_post($id) { return $GLOBALS['posts'][$id] ?? null; }
function get_post_meta($id, $key, $single = true) { return $GLOBALS['post_meta'][$id][$key] ?? ''; }
function get_users($args) {
    $GLOBALS['user_queries'][] = $args;
    if (!isset($args['meta_key'])) {
        $ids = array_keys($GLOBALS['users']); sort($ids, SORT_NUMERIC);
        return array_slice($ids, $args['offset'], $args['number']);
    }
    $found = array();
    foreach ($GLOBALS['users'] as $id => $user) if (get_user_meta($id, $args['meta_key'], true) === $args['meta_value']) $found[] = $id;
    return array_slice($found, 0, $args['number']);
}
function update_meta_cache($type, $ids) { $GLOBALS['meta_cache_calls'][] = array($type, $ids); }
function home_url($path = '') { return 'https://setae.example' . $path; }
function rest_url($path) { return home_url('/wp-json/' . $path); }
function wp_create_nonce($action) { return 'synthetic-rest-nonce'; }
function wp_salt($scheme) { return 'synthetic-unit-salt'; }
function wp_parse_url($value) { return parse_url($value); }
function dbDelta($sql) { $GLOBALS['schema'] = $sql; $GLOBALS['delta_calls']++; }
function register_rest_route($namespace, $route, $args) { $GLOBALS['routes'][$namespace . $route] = $args; }
function add_action($hook, $callback) { $GLOBALS['actions'][$hook][] = $callback; }
function add_options_page(...$args) { $GLOBALS['menus'][] = $args; }
function current_user_can($cap) { return $cap === 'manage_options' && $GLOBALS['is_admin']; }
function wp_die($message, $title = '', $args = array()) { throw new RuntimeException('wp_die:' . ($args['response'] ?? 0)); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_url($value) { return esc_html($value); }
function admin_url($path) { return home_url('/wp-admin/' . $path); }
function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
function check_product($condition, $message) { $GLOBALS['checks']++; if (!$condition) throw new RuntimeException($message); }
function error_product($value, $code, $message) { check_product(is_wp_error($value) && $value->get_error_code() === $code, $message); }
function client_product($event, $extra = array()) {
    return Setae_Product_Events::record_client(array_merge(array('event' => $event, 'event_id' => wp_generate_uuid4(),
        'anonymous_id' => '11111111-1111-4111-8111-111111111111', 'session_id' => '22222222-2222-4222-8222-222222222222'), $extra));
}
function last_product_row() { return end($GLOBALS['wpdb']->rows); }

require_once __DIR__ . '/../includes/db/class-setae-product-events.php';
require_once __DIR__ . '/../includes/admin/class-setae-admin-product-analytics.php';
require_once __DIR__ . '/../includes/api/class-setae-api-app.php';

// Schema creation and failed upgrade must not mark a missing table as installed.
check_product(Setae_Product_Events::maybe_upgrade() === true, 'Schema should install on first use.');
check_product($delta_calls === 1 && get_option(Setae_Product_Events::SCHEMA_OPTION) === '1.0.0', 'Version should be persisted after creation.');
foreach (array('idempotency_key varchar(80)', 'event_origin varchar(12)', 'user_id bigint(20) unsigned NULL',
    'anonymous_id varchar(64)', 'session_id varchar(64)', 'properties longtext', 'occurred_at datetime',
    'UNIQUE KEY idempotency_key', 'KEY event_time', 'KEY origin_event_time', 'KEY user_time', 'KEY source_time', 'KEY partner_time') as $fragment) {
    check_product(strpos($schema, $fragment) !== false, 'Missing table contract: ' . $fragment);
}
check_product(strpos($schema, 'unit_setae_product_events') !== false && strpos($schema, 'DROP ') === false, 'Only the prefixed additive table is installed.');
check_product(count(array_filter($option_updates, function ($value) { return $value[1] !== false; })) === 0, 'Schema options must not autoload.');
$started = get_option(Setae_Product_Events::STARTED_OPTION);
Setae_Product_Events::maybe_upgrade();
check_product($delta_calls === 1, 'Current version should not run dbDelta again.');
$options[Setae_Product_Events::SCHEMA_OPTION] = 'old'; $wpdb->table_exists = false;
error_product(Setae_Product_Events::maybe_upgrade(), 'setae_event_unavailable', 'Failed table creation must return an error.');
check_product(get_option(Setae_Product_Events::SCHEMA_OPTION) === 'old', 'Failed creation must not advance version.');
$wpdb->table_exists = true; Setae_Product_Events::maybe_upgrade();
check_product(get_option(Setae_Product_Events::STARTED_OPTION) === $started, 'Upgrade must preserve the first measurement date.');

// Per-event allowlists reject oversized/deep payloads before unknown-key removal.
$clean = Setae_Product_Event_Catalog::properties('label_exported', array('count' => '2', 'source' => 'manual', 'format' => 'pdf',
    'email' => 'never-store@example.test', 'memo' => 'private note', 'photo_url' => 'https://private.example/photo', 'password' => 'do-not-store'));
check_product($clean === array('source' => 'manual', 'count' => 2, 'format' => 'pdf'), 'Only typed allowlisted values may remain.');
check_product(Setae_Product_Event_Catalog::properties('label_exported', array('count' => -1, 'format' => 'private arbitrary text')) === array(), 'Invalid typed values must be discarded.');
check_product(Setae_Product_Event_Catalog::properties('registration_started', array('claim_intent' => 'yes')) === array(), 'Boolean strings must not be coerced.');
check_product(Setae_Product_Event_Catalog::properties('passport_viewed', array('surface' => 'passport', 'unknown' => array('level' => array('leaf' => 1)))) === array('surface' => 'passport'), 'Depth three is accepted and unknown values discarded.');
error_product(Setae_Product_Event_Catalog::properties('passport_viewed', array('unknown' => array('a' => array('b' => array('c' => 1))))), 'setae_event_payload_limit', 'Depth four must be rejected.');
error_product(Setae_Product_Event_Catalog::properties('passport_viewed', array('private' => str_repeat('x', 4096))), 'setae_event_payload_limit', 'Oversized unknown values must not bypass the payload cap.');
error_product(Setae_Product_Event_Catalog::properties('passport_viewed', 'scalar'), 'setae_event_payload', 'Scalar payloads must be rejected.');
check_product(Setae_Product_Event_Catalog::source('qr_passport') === 'public_passport', 'Known attribution aliases should normalize.');
check_product(Setae_Product_Event_Catalog::source('never-store@example.test') === 'unknown', 'Arbitrary attribution text must not persist.');

// Authenticated actor, plan, version, path and referral come from the server.
$current_user = 7;
$meta[7]['_setae_registration_source'] = 'qr_passport';
$meta[7]['_setae_referred_by_user_id'] = 42;
$bad_path = '/s/manage-secret/?email=never-store@example.test#private-fragment';
$result = client_product('pricing_viewed', array('user_id' => 8, 'partner_user_id' => 8, 'object_id' => 102,
    'object_type' => 'spider', 'plan_id' => 'legacy_premium', 'app_version' => 'forged', 'occurred_at' => '2000-01-01', 'path' => $bad_path,
    'payload' => array('source' => 'public_partner', 'plan' => 'breeder_starter', 'email' => 'never-store@example.test', 'note' => 'private note')));
check_product(!is_wp_error($result) && $result['accepted'] && !$result['duplicate'], 'Valid client event should be accepted.');
$row = last_product_row();
check_product($row['user_id'] === 7 && $row['partner_user_id'] === 42 && $row['plan_id'] === 'breeder_trial' && $row['app_version'] === '1.0.251', 'Forged identity, plan, partner and version must not be used.');
check_product($row['object_id'] === null && $row['object_type'] === '', 'Client object context must not be accepted without a signed context.');
check_product($row['acquisition_source'] === 'public_passport' && $row['path'] === '/app/', 'Server attribution and bucket-only paths must replace raw client fields.');
check_product(json_decode($row['properties'], true) === array('plan' => 'breeder_starter'), 'Caller source and PII should be removed while retaining the requested plan enum.');
check_product(strpos(json_encode($row), 'never-store@') === false && strpos(json_encode($row), 'manage-secret') === false, 'The full stored row must not contain private input or QR code.');
check_product($row['occurred_at'] !== '2000-01-01' && $row['occurred_at'] === $row['created_at'], 'Client timestamps must not alter server time.');
check_product(end(Setae_App_Operations::$rate_calls) === array('product_events', 240, 60), 'Authenticated requests should use the authenticated IP budget.');

// Client retry UUIDs are immutable and legacy names remain client-origin only.
$current_user = 0;
$legacy_data = array('event' => 'email_verified', 'event_id' => wp_generate_uuid4());
$first = Setae_Product_Events::record_client($legacy_data); $before = count($wpdb->rows);
$second = Setae_Product_Events::record_client($legacy_data);
check_product($first['count'] === 1 && $second['count'] === 1 && $second['duplicate'] && count($wpdb->rows) === $before, 'A retry must be success without another row or legacy increment.');
check_product(last_product_row()['event_origin'] === 'client', 'The legacy verification name must never be authoritative.');
$verified = Setae_Product_Events::record('email_verified', array('idempotency_key' => 'verified:7', 'user_id' => 7));
check_product(!is_wp_error($verified) && $verified['count'] === null && get_option('setae_metrics_' . gmdate('Ymd'))['email_verified'] === 1, 'Real verification must not double-write the old daily verification count.');
check_product(last_product_row()['event_origin'] === 'server', 'Trusted business events must be distinguishable from legacy clients.');
check_product(!is_wp_error(Setae_Product_Events::record_legacy('PUBLIC_HOME_VIEW')), 'Old Ajax names should remain accepted after sanitize_key.');
check_product(end(Setae_App_Operations::$rate_calls) === array('product_events', 60, 60), 'Anonymous events should have a bounded IP budget.');
foreach (array_diff(Setae_Product_Event_Catalog::server_events(), array('email_verified')) as $event) {
    error_product(client_product($event), 'invalid_event', 'Client must not emit server-only ' . $event);
}
error_product(client_product('D1'), 'invalid_event', 'Retention must never be a client event.');
error_product(client_product('public_home_viewed', array('event_id' => 'not-a-uuid')), 'setae_event_identity', 'Invalid retry UUID should fail.');
error_product(client_product('public_home_viewed', array('anonymous_id' => 'email@example.test')), 'setae_event_identity', 'Identities must not become arbitrary text stores.');
error_product(client_product('public_home_viewed', array('session_id' => array('bad'))), 'setae_event_identity', 'Non-string IDs should fail without throwing.');
error_product(Setae_Product_Events::record('specimen_created', array('user_id' => 7)), 'setae_event_key', 'Business events require a deterministic key.');
error_product(Setae_Product_Events::record('specimen_created', array('user_id' => 7, 'idempotency_key' => str_repeat('x', 81))), 'setae_event_key', 'Business keys are capped at eighty bytes.');
error_product(Setae_Product_Events::record('specimen_created', array('user_id' => 7, 'idempotency_key' => 'client:reserved')), 'setae_event_key', 'Clients and server keys need separate namespaces.');
error_product(Setae_Product_Events::record('specimen_created', array('idempotency_key' => 'specimen:102')), 'setae_event_user', 'Required business events need an actor.');

// Origin, fetch-site, body and rate guards precede any insert.
$before = count($wpdb->rows);
$data = array('event' => 'public_home_viewed');
error_product(Setae_Product_Events::record_client($data, new Product_Request($data, array('origin' => 'https://other.example'))), 'setae_event_origin', 'Cross-origin writes should fail.');
error_product(Setae_Product_Events::record_client($data, new Product_Request($data, array('sec-fetch-site' => 'cross-site'))), 'setae_event_origin', 'Fetch metadata cross-site writes should fail.');
error_product(Setae_Product_Events::record_client($data, new Product_Request($data, array('origin' => 'https://user@setae.example'))), 'setae_event_origin', 'An origin containing credentials must fail.');
error_product(Setae_Product_Events::record_client($data, new Product_Request($data, array(), str_repeat('x', 16385))), 'setae_event_body_limit', 'Oversized request envelopes must fail.');
Setae_App_Operations::$limited = true;
error_product(client_product('public_home_viewed'), 'rate_limited', 'Throttled requests should return 429 without an insert.');
Setae_App_Operations::$limited = false;
check_product(count($wpdb->rows) === $before, 'Rejected requests must not append rows.');
check_product(!is_wp_error(Setae_Product_Events::record_client($data, new Product_Request($data, array('origin' => 'https://setae.example')))), 'Same-origin events should still work.');

// Signed public contexts reveal no owner ID; attribution resolves current server state.
$post_meta[101]['_setae_qr_public_mode'] = 'basic';
$config = Setae_Product_Events::public_config('passport', array('object_type' => 'spider', 'object_id' => 101, 'partner_user_id' => 42));
$claims = json_decode(base64_decode(strtr(explode('.', $config['context_token'])[0], '-_', '+/')), true);
check_product($claims['object_id'] === 101 && !isset($claims['user_id']) && !isset($claims['partner_user_id']), 'Public context must not expose a private owner account ID.');
check_product($config['path'] === '/s/:code/' && strpos($config['endpoint'], '/metrics/events') !== false, 'Public config must contain a route bucket and the existing endpoint.');
$tracked = client_product('passport_viewed', array('payload' => array('context_token' => $config['context_token'], 'claim_available' => true)));
$row = last_product_row();
check_product(!is_wp_error($tracked) && $row['partner_user_id'] === 7 && $row['object_id'] === 101 && $row['acquisition_source'] === 'public_passport', 'Signed passport context must resolve the actual owner on the server.');
check_product(strpos($row['properties'], 'context_token') === false, 'Signed transport context must not be retained as event properties.');
$posts[101]->post_author = 8;
client_product('passport_viewed', array('payload' => array('context_token' => $config['context_token'])));
check_product(last_product_row()['partner_user_id'] === 8, 'Ownership changes must not leave stale signed owner attribution.');
$posts[101]->post_author = 7; $post_meta[101]['_setae_qr_public_mode'] = 'private';
client_product('passport_viewed', array('payload' => array('context_token' => $config['context_token'])));
check_product(last_product_row()['object_id'] === null && last_product_row()['partner_user_id'] === null, 'A newly private target must no longer add object or owner attribution.');
$post_meta[101]['_setae_transfer_enabled'] = '1';
client_product('passport_viewed', array('payload' => array('context_token' => $config['context_token'])));
check_product(last_product_row()['object_id'] === 101, 'An enabled claim still permits its current public entry context.');
$meta[42]['_setae_referral_code'] = 'たらんちゅら';
$partner = Setae_Product_Events::public_config('partner', array('partner_user_id' => 42));
client_product('public_partner_viewed', array('payload' => array('context_token' => $partner['context_token'])));
check_product(last_product_row()['partner_user_id'] === 42 && last_product_row()['acquisition_source'] === 'public_partner', 'Existing non-ASCII public referral codes must resolve without raw account IDs.');
error_product(client_product('passport_viewed', array('payload' => array('context_token' => $config['context_token'] . '0'))), 'setae_event_context', 'Tampered public context must fail.');
$claims['expires'] = time() - 1;
$encoded = rtrim(strtr(base64_encode(wp_json_encode($claims)), '+/', '-_'), '=');
$expired = $encoded . '.' . hash_hmac('sha256', $encoded, wp_salt('auth'));
error_product(client_product('passport_viewed', array('payload' => array('context_token' => $expired))), 'setae_event_context_expired', 'Expired public contexts must fail.');

// First record requires an owned subject, is once per user, and recovers the original time.
$post_meta[301]['_setae_log_spider_id'] = 101;
$first = Setae_Product_Events::record('first_record_created', array('user_id' => 7, 'idempotency_key' => 'record:301', 'object_type' => 'log', 'object_id' => 301, 'properties' => array('record_type' => 'feed')));
check_product(!is_wp_error($first) && !$first['duplicate'] && isset($wpdb->rows['first-record:7']), 'First record must use a user-scoped idempotency key.');
$row = $wpdb->rows['first-record:7'];
check_product($row['object_id'] === 101 && $row['object_type'] === 'spider' && json_decode($row['properties'], true)['record_id'] === 301, 'Log context should resolve to the owned subject without copying the log text.');
$first_time = get_user_meta(7, '_setae_first_record_created_at', true);
check_product(is_int($first_time) && $first_time === strtotime($row['occurred_at'] . ' UTC'), 'Onboarding meta should expose the original event time in UNIX seconds.');
$second = Setae_Product_Events::record('first_record_created', array('user_id' => 7, 'idempotency_key' => 'record:302', 'object_type' => 'spider', 'object_id' => 101));
check_product($second['duplicate'] && get_user_meta(7, '_setae_first_record_created_at', true) === $first_time, 'Another record must not change the first event or onboarding time.');
unset($meta[7]['_setae_first_record_created_at']);
$wpdb->rows['first-record:7']['occurred_at'] = '2026-01-02 03:04:05';
Setae_Product_Events::record('first_record_created', array('user_id' => 7, 'object_type' => 'spider', 'object_id' => 101));
check_product(get_user_meta(7, '_setae_first_record_created_at', true) === strtotime('2026-01-02 03:04:05 UTC'), 'Missing meta on a retry should recover the DB time, not the retry time.');
error_product(Setae_Product_Events::record('first_record_created', array('user_id' => 7, 'object_type' => 'spider', 'object_id' => 102)), 'setae_event_subject', 'Someone else\'s subject must not count as activation.');
error_product(Setae_Product_Events::record('first_record_created', array('user_id' => 7, 'object_type' => 'spider', 'object_id' => 301)), 'setae_event_subject', 'A log is not an owned specimen when mislabeled.');
check_product(!is_wp_error(Setae_Product_Events::record('first_record_created', array('user_id' => 8, 'object_type' => 'baby_group', 'object_id' => 201))), 'An owned nursery group must support first-record activation.');

// Server event identity can connect to public cookies; corrupt cookies cannot break a business event.
$_COOKIE[Setae_Product_Events::ANONYMOUS_COOKIE] = '33333333-3333-4333-8333-333333333333';
$_COOKIE[Setae_Product_Events::SESSION_COOKIE] = '44444444-4444-4444-8444-444444444444';
Setae_Product_Events::record('registration_submitted', array('user_id' => 8, 'idempotency_key' => 'registration:8'));
check_product(last_product_row()['anonymous_id'] === $_COOKIE[Setae_Product_Events::ANONYMOUS_COOKIE]
    && last_product_row()['session_id'] === $_COOKIE[Setae_Product_Events::SESSION_COOKIE], 'Server registration should link the public anonymous session through validated UUID cookies.');
$_COOKIE[Setae_Product_Events::ANONYMOUS_COOKIE] = 'never-store@example.test';
Setae_Product_Events::record('label_exported', array('user_id' => 8, 'idempotency_key' => 'label-batch:one', 'properties' => array('count' => 4, 'source' => 'manual')));
check_product(last_product_row()['anonymous_id'] === '', 'Corrupt cookies should be ignored instead of failing business instrumentation or storing PII.');
$_COOKIE = array();

// App sessions are authenticated, once per user/session, and new sessions can be counted.
error_product(client_product('app_session_started'), 'setae_event_session', 'Anonymous clients cannot fabricate authenticated app sessions.');
$current_user = 7;
$first = client_product('app_session_started'); $before = count($wpdb->rows); $second = client_product('app_session_started');
check_product(!$first['duplicate'] && $second['duplicate'] && count($wpdb->rows) === $before, 'New event UUIDs within one authenticated session must still deduplicate.');
check_product(!client_product('app_session_started', array('session_id' => '55555555-5555-4555-8555-555555555555'))['duplicate'], 'Another session should be a distinct app session.');
$current_user = 8;
check_product(!client_product('app_session_started')['duplicate'], 'Shared browser sessions must still distinguish authenticated users.');

// Errors never expose SQL or throw from the measurement interface.
$wpdb->fail_insert = true;
error_product(Setae_Product_Events::record('trial_started', array('user_id' => 7, 'idempotency_key' => 'trial:7')), 'setae_event_unavailable', 'Storage failure must be non-throwing.');
$wpdb->fail_insert = false; $wpdb->throw_insert = true;
$failure = Setae_Product_Events::record('trial_started', array('user_id' => 7, 'idempotency_key' => 'trial:7'));
error_product($failure, 'setae_event_unavailable', 'Unexpected storage exceptions must be contained.');
check_product(strpos($failure->get_error_message(), 'SQL') === false, 'Internal SQL details must never leak into responses.');
$wpdb->throw_insert = false;

// The existing REST endpoint remains public and accepted responses remain 202.
$api = new Setae_API_App(); $api->register_routes();
$route = $routes['setae/v1/metrics/events'];
check_product($route['permission_callback'] === '__return_true' && $route['methods'] === 'POST', 'The anonymous metrics transport must remain compatible.');
foreach (array('event', 'event_id', 'anonymous_id', 'session_id', 'path', 'payload') as $name) check_product(isset($route['args'][$name]), 'Missing metrics argument ' . $name);
check_product($route['args']['event_id']['maxLength'] === 36, 'REST UUID inputs must be bounded.');
check_product($routes['setae/v1/registration']['args']['qr_claim_intent']['default'] === '' && $routes['setae/v1/registration']['args']['return_url']['default'] === '', 'New registration intent/return remain optional.');
$response = $api->track_event(new Product_Request(array('event' => 'public_home_viewed')));
check_product($response instanceof WP_REST_Response && $response->status === 202 && $response->data['accepted'], 'The real REST callback should delegate accepted events.');
error_product($api->track_event(new Product_Request(array('event' => 'subscription_started'))), 'invalid_event', 'The REST callback must preserve server-only validation.');

// Aggregate formatter: distinguish unmeasured from measured zero and mature denominators.
unset($options[Setae_Product_Events::STARTED_OPTION]); $before = count($wpdb->calls);
$report = Setae_Admin_Product_Analytics::get_report(30, strtotime('2026-08-28 12:00:00 UTC'));
check_product($report['funnel']['passport_viewed']['events'] === null && $report['activation'] === null, 'No measurement start must mean unmeasured, not zero.');
check_product($report['current_plans'] === array('keeper_free' => 1, 'breeder_trial' => 1, 'breeder_starter' => 0, 'legacy_premium' => 1), 'Current all-account plans must include unmeasured legacy and free users.');
check_product(count($wpdb->calls) === $before, 'An uninstalled measurement table must not be queried.');
$options[Setae_Product_Events::STARTED_OPTION] = '2026-08-27 00:00:00';
$report = Setae_Admin_Product_Analytics::get_report(30, strtotime('2026-08-28 12:00:00 UTC'));
check_product($report['funnel']['passport_viewed']['events'] === 0 && $report['partial_period'], 'Measured empty rows are zero with a partial-period warning.');
check_product($report['activation']['rate'] === null && $report['retention']['D30']['rate'] === null, 'A zero eligible denominator must not be presented as zero-percent retention.');
$wpdb->aggregate = array(
    'funnel' => array(array('event_name' => 'email_verified', 'event_origin' => 'client', 'event_count' => 99, 'people' => 99, 'unidentified' => 0),
        array('event_name' => 'email_verified', 'event_origin' => 'server', 'event_count' => 4, 'people' => 4, 'unidentified' => 0),
        array('event_name' => 'passport_viewed', 'event_origin' => 'client', 'event_count' => 20, 'people' => 8, 'unidentified' => 2)),
    'activation' => array('cohort' => 10, 'eligible' => 8, 'activated' => 7, 'activated_eligible' => 6),
    'retention:1' => array('cohort' => 6, 'eligible' => 4, 'retained' => 2),
    'retention:7' => array('cohort' => 6, 'eligible' => 0, 'retained' => 0),
    'sources' => array(array('dimension' => 'public_passport', 'event_count' => 20, 'people' => 8, 'registrations' => 4)),
    'partners' => array(array('dimension' => 42, 'event_count' => 20, 'people' => 8, 'registrations' => 4)),
    'plans' => array(array('dimension' => 'breeder_trial', 'people' => 4)),
);
$report = Setae_Admin_Product_Analytics::get_report(7, strtotime('2026-08-28 12:00:00 UTC'));
check_product($report['funnel']['email_verified']['events'] === 4 && $report['funnel']['passport_viewed']['people'] === 8, 'Legacy client verification must not inflate authoritative funnel stages.');
check_product($report['activation']['rate'] === 75.0 && $report['activation']['pending'] === 2, 'Activation must report the eligible denominator and pending users separately.');
check_product($report['retention']['D1']['rate'] === 50.0 && $report['retention']['D1']['pending'] === 2 && $report['retention']['D7']['rate'] === null, 'Retention must use mature cohorts, retaining pending as unmeasured.');
check_product($report['sources'][0]['dimension'] === 'public_passport' && $report['partners'][0]['dimension'] === 42 && $report['plans'][0]['people'] === 4, 'All required aggregate dimensions should reach the report.');
foreach (array(7, 30, 90) as $days) {
    $report = Setae_Admin_Product_Analytics::get_report($days, strtotime('2026-08-28 12:00:00 UTC'));
    check_product($report['days'] === $days && $report['start'] === gmdate('Y-m-d 00:00:00', strtotime('2026-08-28 12:00:00 UTC') - ($days - 1) * DAY_IN_SECONDS), 'Requested calendar window should use UTC.');
}
check_product(Setae_Admin_Product_Analytics::get_report(1000)['days'] === 7, 'Unbounded range input must fall back to seven days.');
$aggregate_sql = implode("\n", array_map(function ($p) { return $p['sql']; }, $wpdb->calls));
check_product(strpos($aggregate_sql, "COUNT(DISTINCT user_id) = 1") !== false && strpos($aggregate_sql, "event_name = 'registration_submitted'") !== false, 'Anonymous identity linking must be based on one server-registered account only.');
check_product(strpos($aggregate_sql, "f.object_type IN ('spider','baby_group')") !== false && strpos($aggregate_sql, 'INTERVAL 24 HOUR') !== false, 'Activation SQL must require a known managed subject within twenty-four hours.');
check_product(strpos($aggregate_sql, "s.event_name <> 'baby_group_created' OR f.object_type = 'baby_group'") !== false
    && strpos($aggregate_sql, 'prior.occurred_at < s.occurred_at') !== false, 'Nursery cohort joins must preserve incomplete users and must exclude already-recorded returning users.');
check_product(strpos($aggregate_sql, "sessions.event_name = 'app_session_started' AND sessions.event_origin = 'client'") !== false && strpos($aggregate_sql, 'INTERVAL 30 DAY) < DATE(%s)') !== false, 'D30 must come from app sessions after the target UTC day has completed.');
check_product(strpos($aggregate_sql, 'GROUP BY e.event_name,e.event_origin') !== false && strpos($aggregate_sql, 'MAX(id) last_id') !== false, 'Origin groups and one latest observed plan per user must be explicit.');
check_product(strpos($aggregate_sql, 'e.properties') === false && strpos($aggregate_sql, 'user_email') === false, 'Aggregate queries must not fetch private event properties or account contact fields.');

// Management capability precedes all queries; output stays aggregate and escaped.
$admin = new Setae_Admin_Product_Analytics(); $admin->add_menu();
check_product($menus[0][2] === 'manage_options', 'Product analytics belongs to administrators only.');
$before = count($wpdb->calls); $denied = false;
try { $admin->render(); } catch (RuntimeException $error) { $denied = $error->getMessage() === 'wp_die:403'; }
check_product($denied && count($wpdb->calls) === $before, 'Forbidden readers must be rejected before query execution.');
$is_admin = true; $_GET['days'] = 30;
$wpdb->aggregate['sources'][0]['dimension'] = '<script>untrusted</script>';
ob_start(); $admin->render(); $html = ob_get_clean();
check_product(strpos($html, '<script>untrusted</script>') === false && strpos($html, '&lt;script&gt;') !== false, 'Aggregate labels must be escaped even if storage is compromised.');
check_product(strpos($html, '計測開始') !== false && strpos($html, '未計測') !== false && strpos($html, 'UTC') !== false, 'Measurement start, waiting periods and timezone must be visible.');
check_product(strpos($html, '発行者 #42') !== false && strpos($html, '期間内の最終計測時プラン') !== false, 'Partner pseudonyms and plan-population limits must be explicit.');
check_product(strpos($html, '現在の全ユーザーの実効プラン') !== false && strpos($html, '契約の購入者数とは異なります') !== false, 'Current effective access and observed period plans must be separate and labeled.');
check_product(strpos($html, 'never-store@example.test') === false && strpos($html, 'private note') === false, 'No private event content may appear in the admin view.');
$wpdb->fail_aggregate = true;
error_product(Setae_Admin_Product_Analytics::get_report(), 'setae_analytics_unavailable', 'DB aggregation failure must not be misreported as zero activity.');
$original_users = $users; $before_meta = $meta; $before_options = $options;
for ($id = 1000; $id < 1550; $id++) $users[$id] = (object) array('ID' => $id);
$user_queries = array();
$counts = Setae_Admin_Product_Analytics::current_plan_counts();
check_product(array_sum($counts) === 553 && count($user_queries) === 2, 'Current users must be counted in bounded five-hundred-ID batches.');
check_product($user_queries[0]['fields'] === 'ID' && $user_queries[1]['offset'] === 500, 'Current plan aggregation must request only IDs and page without limiting the total population.');
check_product($meta === $before_meta && $options === $before_options, 'Current plan reporting must not synchronize or migrate user state.');
$users = $original_users;

echo 'product-events-unit: PASS (' . $checks . " assertions; WordPress/wpdb contract doubles, no live DB)\n";
