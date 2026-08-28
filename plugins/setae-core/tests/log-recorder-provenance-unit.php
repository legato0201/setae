<?php

require_once __DIR__ . '/helpers/entitlements-fixture.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-spiders.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-offline.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-baby-groups.php';

// Expiry and excess inventory must never prevent recording on an existing animal.
update_user_meta(7, '_setae_plan_id', 'breeder_trial');
update_user_meta(7, '_setae_breeder_trial_used', 1);
update_user_meta(7, '_setae_trial_ends_at', time() - 1);
for ($i = 0; $i < 20; $i++) { $animal = fixture_post(); }
$spiders = new Setae_API_Spiders();
$record = $spiders->log_event(new Entitlement_Request(array(
    'id' => $animal, 'type' => 'observation', 'date' => '2026-08-28',
    'data' => array('label' => '異常なし'), 'compact_response' => true,
)));
fixture_assert($record instanceof WP_REST_Response && $record->status === 201, 'Expired over-limit users must still create care logs.');
$log_id = $record->data['id'];
fixture_assert((int) get_post_meta($log_id, Setae_Entitlements::RECORDER_META, true) === 7, 'Normal API log must persist its actual creator.');
fixture_assert(count(Setae_Product_Events::$events) === 1 && Setae_Product_Events::$events[0]['name'] === 'first_record_created', 'Compact response must still record first activation after successful saving.');
fixture_assert(Setae_Product_Events::$events[0]['context']['object_type'] === 'spider' && Setae_Product_Events::$events[0]['context']['object_id'] === $animal, 'Activation must identify the managed animal rather than treat the log as a new animal.');
Setae_Product_Events::$fail = true;
$saved_without_metrics = $spiders->log_event(new Entitlement_Request(array('id' => $animal, 'type' => 'observation', 'date' => '2026-08-28', 'data' => array(), 'compact_response' => true)));
fixture_assert($saved_without_metrics instanceof WP_REST_Response, 'Metrics storage failure must not fail an already-saved log.');
Setae_Product_Events::$fail = false;

$offline = new Setae_API_Offline();
$create_log = new ReflectionMethod($offline, 'create_log');
$mapping = array();
$offline_log = $create_log->invokeArgs($offline, array(-600, array('spider_id' => $animal, 'type' => 'observation', 'date' => '2026-08-28', 'data' => array('label' => '確認済み')), &$mapping, 7));
fixture_assert(is_array($offline_log) && (int) get_post_meta($offline_log['server_id'], Setae_Entitlements::RECORDER_META, true) === 7, 'Offline logs must retain their own recorder after expiry.');
$events_before_replay = count(Setae_Product_Events::$events);
$offline_replay = $create_log->invokeArgs($offline, array(-600, array(), &$mapping, 7));
fixture_assert($offline_replay['server_id'] === $offline_log['server_id'] && count(Setae_Product_Events::$events) === $events_before_replay, 'Offline replay cannot create another recorder entry or activation.');

$groups = new Setae_API_Baby_Groups();
$copy = new ReflectionMethod($groups, 'create_baby_history_log');
$events_before_copy = count(Setae_Product_Events::$events);
$copied_log = $copy->invoke($groups, $animal, 'observation', '2026-07-01', array('source' => 'baby_group', 'note' => 'ベビー期の履歴'));
fixture_assert(is_int($copied_log) && (int) get_post_meta($copied_log, Setae_Entitlements::RECORDER_META, true) === 7, 'A copied nursery history log must have provenance before any later transfer.');
fixture_assert(count(Setae_Product_Events::$events) === $events_before_copy, 'Inherited history must not become a new first-record event.');

$old_log = fixture_post('setae_log', 7, array('_setae_log_spider_id' => $animal, '_setae_log_type' => 'observation', '_setae_log_date' => '2026-06-01'));
fixture_assert(Setae_Entitlements::mark_log_recorder($old_log) === 7, 'A legacy log must capture its original author before ownership changes.');
wp_update_post(array('ID' => $old_log, 'post_author' => 22));
fixture_assert(Setae_Entitlements::mark_log_recorder($old_log, 22) === 7, 'Later owner changes must never replace the original recorder.');
$snapshot = fixture_post('setae_log', 22);
foreach ($GLOBALS['ent_post_meta'][$old_log] as $key => $value) { update_post_meta($snapshot, $key, $value); }
fixture_assert(Setae_Entitlements::mark_log_recorder($snapshot, 22) === 7, 'Copied snapshot meta must preserve the inherited recorder exactly.');
fixture_assert(Setae_Entitlements::mark_log_recorder($animal, 22) === 0, 'The recorder helper must not stamp unrelated post types.');

$unattributed = fixture_post('setae_log', 7, array('_setae_log_spider_id' => $animal, '_setae_log_type' => 'observation', '_setae_log_date' => '2026-06-01'));
$GLOBALS['ent_posts'][$log_id]->post_date_gmt = '2026-08-28 01:23:45';
$response = $spiders->get_events(new Entitlement_Request(array('id' => $animal)));
$events = array_column($response->data, null, 'id');
fixture_assert($events[$log_id]['recorded_by_current_user'] === true && $events[$unattributed]['recorded_by_current_user'] === false, 'Private events must not infer creator identity from a current post_author alone.');
fixture_assert($events[$log_id]['created_at'] === '2026-08-28T01:23:45Z', 'Private event creation time must use UTC post creation time, not care date midnight.');
fixture_assert(!array_key_exists('recorded_by_user_id', $events[$log_id]) && !array_key_exists(Setae_Entitlements::RECORDER_META, $events[$log_id]), 'Private client output should expose only the ownership boolean, not recorder IDs.');

$zero_marker = fixture_post('setae_log', 7, array(Setae_Entitlements::RECORDER_META => 0));
fixture_assert(Setae_Entitlements::mark_log_recorder($zero_marker) === 7, 'An old zero marker is missing provenance, not an immutable recorder.');
$core_log = fixture_post('setae_log', 7, array('_setae_log_spider_id' => $animal), 'auto-draft');
$core_request = new Entitlement_Request(array('meta' => array(Setae_Entitlements::RECORDER_META => 99, 'safe' => 'keep')));
Setae_Entitlements::protect_core_log_recorder((object) array('ID' => $core_log), $core_request);
fixture_assert($core_request->get_param('meta') === array('safe' => 'keep'), 'Core REST client metadata cannot forge log authorship.');
wp_update_post(array('ID' => $core_log, 'post_status' => 'publish'));
$GLOBALS['ent_current_user'] = 22;
Setae_Entitlements::finish_core_rest_log(get_post($core_log), $core_request, false);
fixture_assert((int) get_post_meta($core_log, Setae_Entitlements::RECORDER_META, true) === 22, 'Core editor first save records the actual actor, even when an admin assigns another post_author.');
$GLOBALS['ent_current_user'] = 7;

$group_id = fixture_post('setae_baby_group', 7, array('_setae_baby_count' => 3, '_setae_baby_prefix' => 'G'));
update_post_meta($group_id, Setae_API_Baby_Groups::NURSERY_EVENTS_META, array(array('id' => 1, 'type' => 'observation', 'date' => '2026-08-01', 'data' => array(), 'created_at' => '2026-08-01 10:00:00')));
$nursery_record = $groups->record_nursery_event(new Entitlement_Request(array('id' => $group_id, 'type' => 'observation', 'date' => '2026-08-28', 'note' => '確認')));
fixture_assert($nursery_record instanceof WP_REST_Response && $nursery_record->data['event']['recorded_by_current_user'] === true, 'New group records must identify the authenticated recorder in the immediate response.');
$nursery_events = array_column($nursery_record->data['group']['events'], null, 'id');
fixture_assert($nursery_events[1]['recorded_by_current_user'] === false, 'Old nursery events without creator evidence must remain unknown, not inferred as current.');
$nursery_event_id = $nursery_record->data['event']['id'];
$groups->record_nursery_event(new Entitlement_Request(array('id' => $group_id, 'type' => 'observation', 'date' => '2026-08-28', 'note' => '次の確認')));
fixture_assert((int) get_post_meta($group_id, Setae_API_Baby_Groups::NURSERY_RECORDERS_META, true)[$nursery_event_id] === 7, 'Saving another event must preserve the earlier private creator mapping.');
fixture_assert(!array_key_exists('recorded_by_user_id', $nursery_events[$nursery_event_id]), 'Group responses must never expose a raw creator ID.');
$read_group_events = new ReflectionMethod($groups, 'read_nursery_events');
$GLOBALS['ent_current_user'] = 22;
$another_owner_view = array_column($read_group_events->invoke($groups, $group_id), null, 'id');
fixture_assert($another_owner_view[$nursery_event_id]['recorded_by_current_user'] === false, 'A later owner must not inherit another person’s first-record activation.');
$GLOBALS['ent_current_user'] = 7;

$migration = file_get_contents(dirname(__DIR__) . '/includes/admin/class-setae-admin-migration.php');
fixture_assert(strpos($migration, "mark_specimen_source(\$new_post_id, 'import')") !== false, 'Administrative legacy imports must stamp acquisition source.');
fixture_assert(strpos($migration, 'mark_log_recorder($new_log_id, $new_wp_user_id)') !== false, 'Administrative log imports must stamp the known historical user.');
$foundation = file_get_contents(dirname(__DIR__) . '/includes/class-setae-entitlements.php');
fixture_assert(strpos($foundation, "add_action('save_post") === false, 'Global save_post stamping would corrupt snapshot provenance before metadata copies; it must remain absent.');

echo "Log recorder provenance tests passed\n";
