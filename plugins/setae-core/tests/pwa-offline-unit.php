<?php

define('MINUTE_IN_SECONDS', 60);
define('DAY_IN_SECONDS', 86400);

$test_user_meta = array(
    7 => array(
        '_setae_push_preferences' => array(
            'care_hour' => 9,
            'care_minute' => 35,
            'timezone' => 'Europe/London',
        ),
    ),
);
$test_options = array();

function absint($value)
{
    return abs((int) $value);
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value));
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function sanitize_textarea_field($value)
{
    return trim(strip_tags((string) $value));
}

function get_user_meta($user_id, $key, $single)
{
    global $test_user_meta;
    return $test_user_meta[$user_id][$key] ?? '';
}

function get_option($key, $default = false)
{
    global $test_options;
    return array_key_exists($key, $test_options) ? $test_options[$key] : $default;
}

function add_option($key, $value, $deprecated = '', $autoload = true)
{
    global $test_options;
    if (array_key_exists($key, $test_options)) {
        return false;
    }
    $test_options[$key] = $value;
    return true;
}

function delete_option($key)
{
    global $test_options;
    unset($test_options[$key]);
    return true;
}

function wp_parse_args($args, $defaults)
{
    return array_merge($defaults, $args);
}

function assert_same($expected, $actual, $message)
{
    if ($expected !== $actual) {
        fwrite(
            STDERR,
            $message . PHP_EOL
            . 'Expected: ' . var_export($expected, true) . PHP_EOL
            . 'Actual:   ' . var_export($actual, true) . PHP_EOL
        );
        exit(1);
    }
}

require_once dirname(__DIR__) . '/vendor/autoload.php';
require_once dirname(__DIR__) . '/includes/class-setae-pwa.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-offline.php';

$defaults = Setae_PWA::default_preferences();
assert_same(true, $defaults['enabled'], 'Push should be enabled after a user subscribes.');
assert_same(20, $defaults['care_hour'], 'The default reminder hour is incorrect.');
assert_same(0, $defaults['care_minute'], 'The default reminder minute is incorrect.');

$preferences = Setae_PWA::get_preferences(7);
assert_same(9, $preferences['care_hour'], 'Stored reminder hour should override the default.');
assert_same(35, $preferences['care_minute'], 'Stored reminder minute should override the default.');
assert_same(true, $preferences['community_messages'], 'Missing preferences should retain safe defaults.');

$pwa = new Setae_PWA('test');
$schedules = $pwa->add_cron_schedule(array());
assert_same(300, $schedules[Setae_PWA::CRON_SCHEDULE]['interval'], 'PWA cron should run every five minutes.');

$offline = new Setae_API_Offline();
$sanitize = new ReflectionMethod($offline, 'sanitize_log_data');
$sanitize->setAccessible(true);
$sanitized = $sanitize->invoke($offline, array(
    'note' => "<b>観察</b>\n異常なし",
    'refused' => true,
    'count' => '2',
    'share_to_feed' => true,
    'is_best_shot' => true,
    'nested' => array('unsafe'),
));
assert_same('観察
異常なし', $sanitized['note'], 'Offline notes should be sanitized as multiline text.');
assert_same(true, $sanitized['refused'], 'Boolean care fields should be preserved.');
assert_same(2, $sanitized['count'], 'Numeric care fields should remain numeric.');
assert_same(false, isset($sanitized['share_to_feed']), 'Offline sync must not publish social feed entries implicitly.');
assert_same(false, isset($sanitized['is_best_shot']), 'Offline sync must not submit best shots implicitly.');
assert_same(false, isset($sanitized['nested']), 'Nested untrusted values should be discarded.');

$resolve = new ReflectionMethod($offline, 'resolve_entity_id');
$resolve->setAccessible(true);
assert_same(42, $resolve->invoke($offline, -100, array('-100' => 42)), 'Temporary IDs should resolve through the sync map.');
assert_same(91, $resolve->invoke($offline, 91, array()), 'Server IDs should pass through unchanged.');

$lock = new ReflectionMethod($offline, 'acquire_sync_lock');
$lock->setAccessible(true);
assert_same(true, $lock->invoke($offline, '_setae_test_sync_lock'), 'The first sync request should acquire the user lock.');
assert_same(false, $lock->invoke($offline, '_setae_test_sync_lock'), 'A concurrent sync request should not acquire the same lock.');
$test_options['_setae_test_sync_lock'] = time() - 121;
assert_same(true, $lock->invoke($offline, '_setae_test_sync_lock'), 'An abandoned sync lock should be recoverable.');

$keys = \Minishlink\WebPush\VAPID::createVapidKeys();
assert_same(true, !empty($keys['publicKey']) && !empty($keys['privateKey']), 'VAPID key generation should be available.');

echo "PWA and offline sync tests passed\n";
