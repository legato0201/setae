<?php
/**
 * Offline, per-request bridge for the real public AJAX/verification/QR controllers.
 * State is an in-memory synthetic WP datastore passed through STDIN/STDOUT.
 * No WordPress bootstrap, real cookies, mail, database or network is used.
 */
require_once __DIR__ . '/claim-registration-fixture.php';
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-ajax.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-partner.php';

class Setae_Acquisition_Response extends RuntimeException {}
function show_admin_bar($show) { $GLOBALS['setae_fixture_admin_bar'] = $show; }
function wp_safe_redirect($url, $status = 302)
{
    $GLOBALS['setae_acquisition_redirect'] = array('location' => $url, 'status' => $status);
    throw new Setae_Acquisition_Response('Synthetic redirect boundary');
}
function wp_send_json_success($data = null, $status = 200)
{
    $GLOBALS['setae_acquisition_result'] = array('success' => true, 'data' => $data);
    status_header($status ?: 200);
    throw new Setae_Acquisition_Response('Synthetic JSON response boundary');
}
function wp_send_json_error($data = null, $status = 200)
{
    $GLOBALS['setae_acquisition_result'] = array('success' => false, 'data' => $data);
    status_header($status ?: 200);
    throw new Setae_Acquisition_Response('Synthetic JSON error boundary');
}
function wp_die($message, $title = '', $args = array())
{
    $GLOBALS['setae_acquisition_result'] = array('success' => false, 'data' => strip_tags($message));
    status_header($args['response'] ?? 500);
    throw new Setae_Acquisition_Response('Synthetic wp_die boundary');
}

$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
if (!is_array($input)) { throw new RuntimeException('Expected local fixture input'); }
$origin = $input['origin'] ?? 'http://127.0.0.1:8872';
$parts = parse_url($origin);
if (!in_array($parts['host'] ?? '', array('127.0.0.1', 'localhost', '[::1]'), true) || ($parts['scheme'] ?? '') !== 'http') {
    throw new RuntimeException('Fixture origin must be loopback HTTP');
}
setae_claim_seed(array_merge(array('visibility' => 'private'), $input['seed'] ?? array()));
$state_keys = array('posts', 'meta', 'users', 'user_meta', 'options', 'viewer', 'mail', 'events', 'auth_cookies', 'transients', 'lock_failure', 'insert_error', 'thumbnail');
foreach ($state_keys as $key) {
    if (!array_key_exists($key, $input['state'] ?? array())) { continue; }
    $value = $input['state'][$key];
    if ($key === 'posts') { $value = array_map(function ($row) { return (object) $row; }, $value); }
    if ($key === 'users') {
        $value = array_map(function ($row) {
            $user = new WP_User((int) $row['ID']);
            foreach (array('display_name', 'user_login', 'user_email') as $field) { $user->$field = $row[$field]; }
            return $user;
        }, $value);
    }
    $GLOBALS['setae_fixture_' . $key] = $value;
}
$GLOBALS['setae_fixture_origin'] = rtrim($origin, '/');
$GLOBALS['setae_fixture_browser'] = true;
$GLOBALS['setae_fixture_harness'] = '/tests/fixtures/passport-acquisition-harness.js';
$GLOBALS['setae_fixture_http_status'] = 200;
$GLOBALS['setae_acquisition_result'] = null;
$GLOBALS['setae_acquisition_redirect'] = null;
$GLOBALS['setae_acquisition_failure'] = null;
$request_url = $input['url'] ?? '/r4k7m/';
parse_str(parse_url($request_url, PHP_URL_QUERY) ?: '', $_GET);
$_POST = $input['post'] ?? array();
$_SERVER['REQUEST_METHOD'] = $input['method'] ?? 'GET';
$_SERVER['REQUEST_URI'] = $request_url;
$wp_query = (object) array('is_404' => false);

// Include the actual global verification entry without constructing/booting Setae_Core.
require_once SETAE_PLUGIN_DIR . 'includes/class-setae-core.php';

$output_level = ob_get_level();
ob_start();
register_shutdown_function(function () use ($state_keys, $output_level) {
    $html = '';
    while (ob_get_level() > $output_level) { $html = ob_get_clean() . $html; }
    $last = error_get_last();
    if ($last && in_array($last['type'], array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR), true)) {
        $GLOBALS['setae_acquisition_failure'] = $last['message'];
    }
    $state = array();
    foreach ($state_keys as $key) { $state[$key] = $GLOBALS['setae_fixture_' . $key] ?? null; }
    $reply = array(
        'scope' => 'Real production controllers; synthetic WP, cookie and mail boundaries; no external HTTP',
        'status' => $GLOBALS['setae_fixture_http_status'],
        'redirect' => $GLOBALS['setae_acquisition_redirect'],
        'result' => $GLOBALS['setae_acquisition_result'],
        'html' => $html,
        'public_configs' => $GLOBALS['setae_fixture_public_configs'],
        'state' => $state,
        'failure' => $GLOBALS['setae_acquisition_failure'],
    );
    echo json_encode($reply, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
});
try {
    switch ($input['operation'] ?? 'page') {
        case 'page':
            (new Setae_Public_QR(SETAE_VERSION))->render_page();
            break;
        case 'partner':
            $_GET[Setae_Public_Partner::QUERY_VAR] = '1';
            (new Setae_Public_Partner(SETAE_VERSION))->render_partner_page();
            break;
        case 'register':
            (new Setae_Ajax())->handle_register_user();
            break;
        case 'verify':
            setae_process_email_verification();
            break;
        case 'approve':
            $result = Setae_QR_Manager::respond_to_transfer((int) $input['request_id'], 'approve', get_current_user_id());
            $GLOBALS['setae_acquisition_result'] = is_wp_error($result)
                ? array('success' => false, 'code' => $result->get_error_code())
                : array('success' => true, 'data' => $result);
            break;
        default:
            throw new RuntimeException('Unknown local fixture operation');
    }
} catch (Setae_Acquisition_Response $response) {
    // wp_send_json/wp_safe_redirect end a real HTTP response; the bridge serializes it below.
} catch (Throwable $error) {
    $GLOBALS['setae_acquisition_failure'] = get_class($error) . ': ' . $error->getMessage();
}
