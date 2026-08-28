<?php

define('HOUR_IN_SECONDS', 3600);

class WP_Error
{
    private $code;
    private $message;
    private $data;

    public function __construct($code, $message, $data = array())
    {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    public function get_error_code()
    {
        return $this->code;
    }

    public function get_error_message()
    {
        return $this->message;
    }

    public function get_error_data()
    {
        return $this->data;
    }
}

class WP_REST_Response
{
    private $data;
    private $status;
    private $headers = array();

    public function __construct($data, $status = 200)
    {
        $this->data = $data;
        $this->status = $status;
    }

    public function get_data()
    {
        return $this->data;
    }

    public function get_status()
    {
        return $this->status;
    }

    public function header($name, $value)
    {
        $this->headers[$name] = $value;
    }
}

class Test_REST_Request
{
    private $params;

    public function __construct(array $params)
    {
        $this->params = $params;
    }

    public function get_param($key)
    {
        return $this->params[$key] ?? null;
    }
}

class Setae_API_External_Access
{
    public function preview_record_for_user($user_id, $animal_id, $params)
    {
        return array(
            'success' => true,
            'animal' => array(
                'id' => $animal_id,
                'name' => 'P023',
            ),
            'params' => array_filter(array(
                'request_id' => $params['request_id'],
                'type' => $params['type'],
                'date' => $params['date'],
                'prey_type' => $params['prey_type'],
                'refused' => $params['refused'],
                'label' => $params['label'],
                'note' => $params['note'],
                'size_cm' => $params['size_cm'],
            ), function ($value) {
                return $value !== '' && $value !== null;
            }),
        );
    }

    public function get_spider_for_user($user_id, $animal_id, $history)
    {
        return array(
            'success' => true,
            'animal' => array(
                'id' => $animal_id,
                'name' => 'P023',
                'species_id' => 12,
                'species_name' => 'Grammostola pulchra',
                'gender' => 'unknown',
                'status' => 'normal',
                'archived' => false,
                'version' => 'version-123',
            ),
            'records' => array(),
        );
    }

    public function add_record_for_user($user_id, $animal_id, $params, $source)
    {
        global $test_record_commits;
        $test_record_commits++;
        return new WP_REST_Response(array(
            'success' => true,
            'duplicate' => false,
            'record' => array('id' => 501),
            'spider' => array('version' => 'version-124'),
        ), 201);
    }

    public function update_spider_for_user($user_id, $animal_id, $params, $source)
    {
        global $test_update_commits;
        $test_update_commits++;
        return array(
            'success' => true,
            'animal' => array('version' => 'version-125'),
        );
    }
}

function is_wp_error($value)
{
    return $value instanceof WP_Error;
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function sanitize_textarea_field($value)
{
    return trim(strip_tags((string) $value));
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value));
}

function absint($value)
{
    return abs((int) $value);
}

function wp_strip_all_tags($value)
{
    return strip_tags((string) $value);
}

function wp_json_encode($value, $flags = 0)
{
    return json_encode($value, $flags);
}

function wp_salt($scheme = 'auth')
{
    return 'test-salt-' . $scheme;
}

function wp_unslash($value)
{
    return $value;
}

function esc_url_raw($value)
{
    return (string) $value;
}

function home_url($path = '')
{
    return 'https://setae.test' . $path;
}

function untrailingslashit($value)
{
    return rtrim((string) $value, '/');
}

function get_current_user_id()
{
    return 7;
}

function is_ssl()
{
    return true;
}

function get_post_meta($post_id, $key, $single = false)
{
    return '';
}

function get_post($post_id)
{
    return null;
}

$test_options = array();
$test_user_meta = array();
$test_transients = array();
$test_record_commits = 0;
$test_update_commits = 0;

function add_option($key, $value, $deprecated = '', $autoload = true)
{
    global $test_options;
    if (array_key_exists($key, $test_options)) {
        return false;
    }
    $test_options[$key] = $value;
    return true;
}

function get_option($key, $default = false)
{
    global $test_options;
    return array_key_exists($key, $test_options) ? $test_options[$key] : $default;
}

function update_option($key, $value, $autoload = null)
{
    global $test_options;
    $test_options[$key] = $value;
    return true;
}

function delete_option($key)
{
    global $test_options;
    unset($test_options[$key]);
    return true;
}

function get_user_meta($user_id, $key, $single = false)
{
    global $test_user_meta;
    return $test_user_meta[$user_id][$key] ?? ($single ? '' : array());
}

function update_user_meta($user_id, $key, $value)
{
    global $test_user_meta;
    $test_user_meta[$user_id][$key] = $value;
    return true;
}

function delete_user_meta($user_id, $key)
{
    global $test_user_meta;
    unset($test_user_meta[$user_id][$key]);
    return true;
}

function get_transient($key)
{
    global $test_transients;
    return $test_transients[$key]['value'] ?? false;
}

function set_transient($key, $value, $expiration)
{
    global $test_transients;
    $test_transients[$key] = array(
        'value' => $value,
        'expiration' => $expiration,
    );
    return true;
}

function delete_transient($key)
{
    global $test_transients;
    unset($test_transients[$key]);
    return true;
}

$test_rewrite_rules = array();
function add_rewrite_rule($regex, $query, $position)
{
    global $test_rewrite_rules;
    $test_rewrite_rules[] = compact('regex', 'query', 'position');
}

require_once dirname(__DIR__)
    . '/includes/integrations/class-setae-live-url-bridge.php';

function invoke_private($object, $method, array $args = array())
{
    $reflection = new ReflectionMethod($object, $method);
    $reflection->setAccessible(true);
    return $reflection->invokeArgs($object, $args);
}

function assert_true($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$bridge = new Setae_Live_URL_Bridge('test');
$bridge->register_rewrite_rules();
assert_true(count($test_rewrite_rules) === 5, 'five Live routes should be registered');
assert_true(
    strpos($test_rewrite_rules[0]['query'], 'setae_live_operation=animals') !== false,
    'animals route should map to the animals operation'
);
$query_vars = $bridge->register_query_vars(array('existing'));
assert_true(
    in_array('setae_live_ticket', $query_vars, true),
    'ticket query variable should be registered'
);

$session_id = str_repeat('a', 24);
$secret = str_repeat('B', 43);
$token = 'slv1-' . $session_id . '-' . $secret;

$parsed = invoke_private($bridge, 'parse_session_token', array($token));
assert_true(!is_wp_error($parsed), 'valid session token should parse');
assert_true($parsed['session_id'] === $session_id, 'session id should round-trip');
assert_true($parsed['secret'] === $secret, 'secret should round-trip');

$invalid = invoke_private($bridge, 'parse_session_token', array($token . 'x'));
assert_true(is_wp_error($invalid), 'invalid token length should fail');

$scope = invoke_private($bridge, 'sanitize_scope', array('Animals:Write'));
assert_true($scope === 'animals:write', 'scope sanitizer must preserve colon');

$_GET['flag'] = 'true';
assert_true(
    invoke_private($bridge, 'request_boolean', array('flag', false)) === true,
    'true boolean should parse'
);
$_GET['flag'] = 'false';
assert_true(
    invoke_private($bridge, 'request_boolean', array('flag', true)) === false,
    'false boolean should parse'
);
$_GET['flag'] = 'maybe';
assert_true(
    invoke_private($bridge, 'request_boolean', array('flag', false)) === null,
    'unknown boolean should be rejected'
);
unset($_GET['flag']);

$valid_update = invoke_private($bridge, 'validate_update_preview', array(
    10,
    array(
        'name' => 'P023',
        'gender' => 'female',
        'status' => 'normal',
        'archived' => false,
    ),
));
assert_true(!is_wp_error($valid_update), 'allowed update should validate');
assert_true($valid_update['name'] === 'P023', 'name should remain intact');

$invalid_gender = invoke_private($bridge, 'validate_update_preview', array(
    10,
    array('gender' => 'other'),
));
assert_true(is_wp_error($invalid_gender), 'unknown gender should fail');

$invalid_archive = invoke_private($bridge, 'validate_update_preview', array(
    10,
    array('archived' => 'false'),
));
assert_true(is_wp_error($invalid_archive), 'archive must be a real boolean');

$prompt = invoke_private($bridge, 'build_live_prompt', array(
    'https://setae.net/live/' . $token,
    array('expires_at' => '2026-07-24T00:00:00Z'),
));
assert_true(
    strpos($prompt, '明確な承認を待ってください') !== false,
    'prompt should require explicit confirmation'
);
assert_true(
    strpos($prompt, '/commit/{TICKET}') !== false,
    'prompt should include the one-time commit flow'
);
assert_true(
    strpos($prompt, $token) !== false,
    'one-time prompt should include the capability URL'
);

$write_auth = array(
    'user_id' => 7,
    'session_id' => $session_id,
    'mode' => 'read_write',
    'scopes' => array('animals:read', 'records:write', 'animals:write'),
);
$_GET = array(
    'id' => '23',
    'type' => 'feed',
    'date' => '2026-07-23',
    'prey_type' => 'ヨーロッパイエコオロギ',
    'refused' => 'false',
    'note' => '完食',
);
$prepared_record = invoke_private(
    $bridge,
    'prepare_record',
    array($write_auth, str_repeat('T', 22))
);
assert_true(!is_wp_error($prepared_record), 'record prepare should validate');
assert_true(
    $prepared_record['operation'] === 'record',
    'record prepare should create a record intent'
);
assert_true(
    strpos($prepared_record['summary'], 'P023') !== false,
    'record summary should identify the animal'
);

$read_auth = $write_auth;
$read_auth['mode'] = 'read';
$read_auth['scopes'] = array('animals:read');
$forbidden_record = invoke_private(
    $bridge,
    'prepare_record',
    array($read_auth, str_repeat('U', 22))
);
assert_true(
    is_wp_error($forbidden_record),
    'read-only session should not prepare a record'
);

$_GET = array(
    'id' => '23',
    'expected_version' => 'version-123',
    'name' => 'P024',
);
$prepared_update = invoke_private(
    $bridge,
    'prepare_update',
    array($write_auth)
);
assert_true(!is_wp_error($prepared_update), 'update prepare should validate');
assert_true(
    $prepared_update['payload']['expected_version'] === 'version-123',
    'update ticket should retain the optimistic-lock version'
);
assert_true(
    strpos($prepared_update['summary'], 'P023') !== false
        && strpos($prepared_update['summary'], 'P024') !== false,
    'update summary should show before and after values'
);
$_GET = array();

$commit_ticket_id = str_repeat('C', 22);
$commit_ticket = array(
    'version' => 1,
    'status' => 'pending',
    'ticket_id' => $commit_ticket_id,
    'session_id' => $write_auth['session_id'],
    'user_id' => $write_auth['user_id'],
    'operation' => 'record',
    'required_scope' => 'records:write',
    'animal_id' => 23,
    'payload' => $prepared_record['payload'],
    'summary' => $prepared_record['summary'],
    'expires_at_unix' => time() + 300,
);
set_transient(
    Setae_Live_URL_Bridge::TICKET_PREFIX . $commit_ticket_id,
    $commit_ticket,
    300
);
$first_commit = invoke_private(
    $bridge,
    'commit_ticket',
    array($write_auth, $commit_ticket_id)
);
assert_true(!is_wp_error($first_commit), 'first commit should succeed');
assert_true($test_record_commits === 1, 'record should be written once');

$second_commit = invoke_private(
    $bridge,
    'commit_ticket',
    array($write_auth, $commit_ticket_id)
);
assert_true(!is_wp_error($second_commit), 'replayed commit should return success');
assert_true($test_record_commits === 1, 'replayed commit must not write again');
assert_true(
    in_array('DUPLICATE: true', $second_commit, true),
    'replayed commit should be identified as duplicate'
);
assert_true(
    get_option(Setae_Live_URL_Bridge::COMMIT_LOCK_PREFIX . $commit_ticket_id) === false,
    'commit lock should always be released'
);

$wrong_session = $write_auth;
$wrong_session['session_id'] = str_repeat('b', 24);
$wrong_ticket = invoke_private(
    $bridge,
    'commit_ticket',
    array($wrong_session, $commit_ticket_id)
);
assert_true(is_wp_error($wrong_ticket), 'ticket must be bound to its session');

$update_ticket_id = str_repeat('D', 22);
set_transient(
    Setae_Live_URL_Bridge::TICKET_PREFIX . $update_ticket_id,
    array(
        'version' => 1,
        'status' => 'pending',
        'ticket_id' => $update_ticket_id,
        'session_id' => $write_auth['session_id'],
        'user_id' => $write_auth['user_id'],
        'operation' => 'update',
        'required_scope' => 'animals:write',
        'animal_id' => 23,
        'payload' => $prepared_update['payload'],
        'summary' => $prepared_update['summary'],
        'expires_at_unix' => time() + 300,
    ),
    300
);
$update_commit = invoke_private(
    $bridge,
    'commit_ticket',
    array($write_auth, $update_ticket_id)
);
assert_true(!is_wp_error($update_commit), 'prepared update should commit');
assert_true($test_update_commits === 1, 'animal update should be written once');
assert_true(
    in_array('NEW_VERSION: version-125', $update_commit, true),
    'update response should return the new version'
);

$expired_ticket_id = str_repeat('E', 22);
set_transient(
    Setae_Live_URL_Bridge::TICKET_PREFIX . $expired_ticket_id,
    array(
        'version' => 1,
        'status' => 'pending',
        'ticket_id' => $expired_ticket_id,
        'session_id' => $write_auth['session_id'],
        'user_id' => $write_auth['user_id'],
        'operation' => 'record',
        'required_scope' => 'records:write',
        'animal_id' => 23,
        'payload' => $prepared_record['payload'],
        'summary' => $prepared_record['summary'],
        'expires_at_unix' => time() - 1,
    ),
    300
);
$expired_commit = invoke_private(
    $bridge,
    'commit_ticket',
    array($write_auth, $expired_ticket_id)
);
assert_true(is_wp_error($expired_commit), 'expired ticket should fail');
assert_true(
    $expired_commit->get_error_data()['status'] === 410,
    'expired ticket should return HTTP 410'
);

$random_session = invoke_private($bridge, 'random_hex', array(12));
$random_secret = invoke_private($bridge, 'random_base64url', array(32));
$random_ticket = invoke_private($bridge, 'random_base64url', array(16));
assert_true(strlen($random_session) === 24, 'session id length should be 24');
assert_true(strlen($random_secret) === 43, 'session secret length should be 43');
assert_true(strlen($random_ticket) === 22, 'ticket id length should be 22');

$safe_line = invoke_private(
    $bridge,
    'line_value',
    array("Phormingochilus &#8220;akcaya&#8221;\nnext")
);
assert_true(
    $safe_line === 'Phormingochilus “akcaya” next',
    'line output should decode entities and remove newlines'
);

$issued_response = $bridge->issue_session(new Test_REST_Request(array(
    'mode' => 'read_write',
    'duration' => 3600,
)));
assert_true(
    $issued_response instanceof WP_REST_Response,
    'session issuance should return a REST response'
);
$issued = $issued_response->get_data();
assert_true(!empty($issued['shown_once']), 'session prompt should be shown once');
assert_true(
    strpos($issued['prompt'], 'https://setae.test/live/slv1-') !== false,
    'issued prompt should contain the exact bridge URL'
);

$issued_token = basename(parse_url($issued['entry_url'], PHP_URL_PATH));
$stored_session = get_user_meta(7, Setae_Live_URL_Bridge::SESSION_META_KEY, true);
assert_true(
    strpos(json_encode($stored_session), $issued_token) === false,
    'plaintext capability token must not be stored in user meta'
);
assert_true(
    !empty($stored_session['secret_hash']),
    'a keyed secret hash should be stored'
);

$authenticated = invoke_private(
    $bridge,
    'authenticate_session',
    array($issued_token)
);
assert_true(!is_wp_error($authenticated), 'issued session should authenticate');
assert_true(
    in_array('animals:write', $authenticated['scopes'], true),
    'read-write session should preserve write scope separators'
);

$rotated_response = $bridge->issue_session(new Test_REST_Request(array(
    'mode' => 'read',
    'duration' => 86400,
)));
$rotated = $rotated_response->get_data();
$rotated_token = basename(parse_url($rotated['entry_url'], PHP_URL_PATH));
$old_after_rotation = invoke_private(
    $bridge,
    'authenticate_session',
    array($issued_token)
);
assert_true(is_wp_error($old_after_rotation), 'reissue should revoke the old URL');
$rotated_auth = invoke_private(
    $bridge,
    'authenticate_session',
    array($rotated_token)
);
assert_true(!is_wp_error($rotated_auth), 'rotated session should authenticate');
assert_true(
    !in_array('records:write', $rotated_auth['scopes'], true),
    'read-only session must not contain write scopes'
);

$bridge->disable_session();
$revoked = invoke_private($bridge, 'authenticate_session', array($rotated_token));
assert_true(is_wp_error($revoked), 'disabled session should fail authentication');

fwrite(STDOUT, "Live URL Bridge unit checks passed.\n");
