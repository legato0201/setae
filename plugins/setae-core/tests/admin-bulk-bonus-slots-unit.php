<?php

$bonus_test_users = array(
    10 => (object) array('ID' => 10),
    11 => (object) array('ID' => 11),
);
$bonus_test_meta = array(
    10 => array('_setae_bonus_spider_limit' => 2),
    11 => array('_setae_bonus_spider_limit' => 0),
);
$bonus_test_actions = array();

function absint($value)
{
    return abs((int) $value);
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function current_user_can($capability)
{
    return 'manage_options' === $capability;
}

function get_userdata($user_id)
{
    global $bonus_test_users;
    return isset($bonus_test_users[$user_id]) ? $bonus_test_users[$user_id] : false;
}

function get_user_meta($user_id, $key, $single)
{
    global $bonus_test_meta;
    return isset($bonus_test_meta[$user_id][$key]) ? $bonus_test_meta[$user_id][$key] : '';
}

function update_user_meta($user_id, $key, $value)
{
    global $bonus_test_meta;
    if (!isset($bonus_test_meta[$user_id])) {
        $bonus_test_meta[$user_id] = array();
    }
    $bonus_test_meta[$user_id][$key] = $value;
    return true;
}

function current_time($type, $gmt)
{
    return '2026-08-01 00:00:00';
}

function do_action($hook, ...$args)
{
    global $bonus_test_actions;
    $bonus_test_actions[] = array($hook, $args);
}

function assert_bonus($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

require_once dirname(__DIR__) . '/includes/admin/class-setae-admin-users.php';

$admin = new Setae_Admin_Users();
$actions = $admin->register_bonus_slot_bulk_action(array('delete' => '削除'));
assert_bonus(isset($actions[Setae_Admin_Users::BONUS_SLOT_BULK_ACTION]), 'The bulk action must be available to administrators.');

$result = $admin->apply_bonus_slots(array(10, 11, 10, 999), 3, 1, 'X campaign');
assert_bonus($result['updated'] === 2, 'Two existing users should be updated once each.');
assert_bonus($result['skipped'] === 1, 'A missing user should be skipped.');
assert_bonus($bonus_test_meta[10]['_setae_bonus_spider_limit'] === 5, 'Existing bonus slots must be incremented.');
assert_bonus($bonus_test_meta[11]['_setae_bonus_spider_limit'] === 3, 'A zero bonus must be incremented.');
assert_bonus(
    $bonus_test_meta[10]['_setae_bonus_spider_limit_last_grant']['previous'] === 2
    && $bonus_test_meta[10]['_setae_bonus_spider_limit_last_grant']['total'] === 5
    && $bonus_test_meta[10]['_setae_bonus_spider_limit_last_grant']['admin_id'] === 1,
    'The last grant audit record must retain previous, total, and administrator values.'
);
assert_bonus(count($bonus_test_actions) === 2, 'A grant event should fire once per updated user.');

$invalid_result = $admin->apply_bonus_slots(array(10, 11), 0, 1);
assert_bonus($invalid_result['updated'] === 0 && $invalid_result['skipped'] === 2, 'Zero-slot grants must not update users.');

$core_source = file_get_contents(dirname(__DIR__) . '/includes/class-setae-core.php');
assert_bonus(strpos($core_source, "'bulk_actions-users'") !== false, 'The Users bulk action hook must be registered.');
assert_bonus(strpos($core_source, "'handle_bulk_actions-users'") !== false, 'The Users bulk handler hook must be registered.');
assert_bonus(strpos($core_source, "'admin_post_setae_grant_bonus_slots'") !== false, 'The protected grant endpoint must be registered.');

$admin_source = file_get_contents(dirname(__DIR__) . '/includes/admin/class-setae-admin-users.php');
assert_bonus(strpos($admin_source, "check_admin_referer('setae_grant_bonus_slots_'") !== false, 'The grant endpoint must verify its nonce.');
assert_bonus(strpos($admin_source, "'setae_bonus_batch_' . get_current_user_id()") !== false, 'Bulk grant batches must be bound to the administrator.');

echo "Admin bulk bonus slot tests passed\n";
