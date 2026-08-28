<?php

define('HOUR_IN_SECONDS', 3600);

$app_test_users = array(1 => (object) array('ID' => 1));
$app_test_posts = array(
    10 => (object) array('ID' => 10, 'post_type' => 'setae_log', 'post_author' => 1),
    20 => (object) array('ID' => 20, 'post_type' => 'setae_species', 'post_author' => 1),
);
$app_test_meta = array(
    1 => array(
        '_setae_is_verified' => 0,
        '_setae_activation_token' => 'verify-token',
        '_setae_bonus_spider_limit' => 2,
    ),
);
$app_test_post_meta = array(
    10 => array('_setae_log_image' => 'https://example.test/best.jpg', '_best_shot_status' => 'pending'),
    20 => array('_setae_featured_images' => array()),
);
$app_test_transients = array();
$app_test_options = array();

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

    public function get_error_data($code = '')
    {
        return $this->data;
    }
}

function is_wp_error($value)
{
    return $value instanceof WP_Error;
}

function absint($value)
{
    return abs((int) $value);
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value));
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function get_userdata($user_id)
{
    global $app_test_users;
    return isset($app_test_users[$user_id]) ? $app_test_users[$user_id] : false;
}

function get_user_meta($user_id, $key, $single = true)
{
    global $app_test_meta;
    return isset($app_test_meta[$user_id][$key]) ? $app_test_meta[$user_id][$key] : '';
}

function update_user_meta($user_id, $key, $value)
{
    global $app_test_meta;
    $app_test_meta[$user_id][$key] = $value;
    return true;
}

function delete_user_meta($user_id, $key)
{
    global $app_test_meta;
    unset($app_test_meta[$user_id][$key]);
    return true;
}

function get_post($post_id)
{
    global $app_test_posts;
    return isset($app_test_posts[$post_id]) ? $app_test_posts[$post_id] : null;
}

function get_post_meta($post_id, $key, $single = true)
{
    global $app_test_post_meta;
    return isset($app_test_post_meta[$post_id][$key]) ? $app_test_post_meta[$post_id][$key] : '';
}

function update_post_meta($post_id, $key, $value)
{
    global $app_test_post_meta;
    $app_test_post_meta[$post_id][$key] = $value;
    return true;
}

function get_post_field($field, $post_id)
{
    $post = get_post($post_id);
    return $post && $field === 'post_author' ? $post->post_author : '';
}

function wp_get_attachment_url($attachment_id)
{
    return $attachment_id ? 'https://example.test/attachment.jpg' : '';
}

function get_transient($key)
{
    global $app_test_transients;
    return isset($app_test_transients[$key]) ? $app_test_transients[$key] : false;
}

function set_transient($key, $value, $expiration)
{
    global $app_test_transients;
    $app_test_transients[$key] = $value;
    return true;
}

function wp_salt($scheme = 'auth')
{
    return 'test-salt-' . $scheme;
}

function get_option($key, $default = false)
{
    global $app_test_options;
    return array_key_exists($key, $app_test_options) ? $app_test_options[$key] : $default;
}

function update_option($key, $value, $autoload = null)
{
    global $app_test_options;
    $app_test_options[$key] = $value;
    return true;
}

function wp_rand($min, $max)
{
    return $min;
}

function assert_app_operation($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$_SERVER['REMOTE_ADDR'] = '192.0.2.10';

require_once dirname(__DIR__) . '/includes/class-setae-app-operations.php';

$verified = Setae_App_Operations::verify_email(1, 'verify-token');
assert_app_operation(!is_wp_error($verified) && $verified['verified'] === true, 'Email verification should succeed.');
assert_app_operation((int) get_user_meta(1, '_setae_is_verified', true) === 1, 'Verified flag should be persisted.');
assert_app_operation(get_user_meta(1, '_setae_activation_token', true) === '', 'Activation token should be deleted.');

$verified_again = Setae_App_Operations::verify_email(1, 'verify-token');
assert_app_operation($verified_again['already_verified'] === true, 'Email verification should be idempotent.');

$app_test_meta[1]['_setae_is_verified'] = 0;
$invalid = Setae_App_Operations::verify_email(1, 'wrong-token');
assert_app_operation(is_wp_error($invalid) && $invalid->get_error_code() === 'invalid_verification', 'Wrong tokens must fail.');

$first_limit = Setae_App_Operations::consume_request_limit('unit', 2, 3600);
$second_limit = Setae_App_Operations::consume_request_limit('unit', 2, 3600);
$third_limit = Setae_App_Operations::consume_request_limit('unit', 2, 3600);
assert_app_operation($first_limit === true && $second_limit === true, 'Requests inside the limit should pass.');
assert_app_operation(is_wp_error($third_limit) && $third_limit->get_error_code() === 'rate_limit', 'Requests over the limit should fail.');

$metric = Setae_App_Operations::track_event('public_home_view');
assert_app_operation($metric['count'] === 1, 'Allowed metrics should increment.');
assert_app_operation(is_wp_error(Setae_App_Operations::track_event('not_allowed')), 'Unknown metrics must be rejected.');

$approved = Setae_App_Operations::moderate_best_shot(array(
    'action' => 'approve',
    'log_id' => 10,
    'species_id' => 20,
));
assert_app_operation($approved['status'] === 'approved', 'Best Shot should be approved.');
assert_app_operation((int) get_user_meta(1, '_setae_bonus_spider_limit', true) === 3, 'First approval should grant one slot.');

Setae_App_Operations::moderate_best_shot(array(
    'action' => 'approve',
    'log_id' => 10,
    'species_id' => 20,
));
assert_app_operation((int) get_user_meta(1, '_setae_bonus_spider_limit', true) === 3, 'Repeated approval must not grant another slot.');

echo "Application operation tests passed\n";
