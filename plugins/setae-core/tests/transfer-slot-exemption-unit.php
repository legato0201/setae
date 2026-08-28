<?php
require_once __DIR__ . '/helpers/claim-registration-fixture.php';

function setae_transfer_fixture_animal($owner, $source = 'manual', $archived = false)
{
    $id = wp_insert_post(array('post_type' => 'setae_spider', 'post_status' => 'publish', 'post_title' => 'Synthetic specimen', 'post_author' => $owner), true);
    Setae_Entitlements::mark_specimen_source($id, $source);
    if ($archived) { update_post_meta($id, '_setae_spider_archived', '1'); }
    if ($source === 'transfer_receipt') { update_post_meta($id, '_setae_transfer_receipt', '1'); }
    return $id;
}

setae_claim_seed();
for ($i = 0; $i < 8; $i++) { setae_transfer_fixture_animal(22); }
for ($i = 0; $i < 4; $i++) { setae_transfer_fixture_animal(22, 'transfer_received'); }
for ($i = 0; $i < 3; $i++) { setae_transfer_fixture_animal(22, 'transfer_receipt', true); }
setae_claim_assert(Setae_Entitlements::get_inventory_usage(22)['active_slot_bearing'] === 8, 'Received specimens/receipts never consume manual slots');
setae_claim_assert(is_wp_error(Setae_Entitlements::can_create_specimen(22, 'manual')), 'Manual limit remains effective');
setae_claim_assert(!is_wp_error(Setae_Entitlements::can_create_specimen(22, 'transfer_received')), 'Receipt path is allowed at manual capacity');

// A legacy log gets its former author; a log recorded before an earlier transfer keeps that recorder.
update_post_meta(402, Setae_Entitlements::RECORDER_META, 33);
$original_logs = get_posts(array('post_type' => 'setae_log', 'post_status' => 'any', 'meta_key' => '_setae_log_spider_id', 'meta_value' => 201, 'fields' => 'ids'));
$original_photo = get_post_meta(201, '_setae_spider_image', true);
$request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
setae_claim_assert(!is_wp_error($request), 'Request creation does not use a manual registration slot');
setae_claim_assert(count(array_filter($GLOBALS['wpdb']->queries, function ($sql) { return strpos($sql, 'GET_LOCK(') !== false; })) === 1, 'Request deduplication runs under the production advisory lock');
setae_claim_assert(is_wp_error(Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 22)), 'Claimant cannot approve their own request');
$result = Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11);
setae_claim_assert(!is_wp_error($result) && $result['success'] === true, 'Owner can approve even while recipient manual slots are full');
$snapshot_id = $result['snapshot_id'];
setae_claim_assert((int) get_post(201)->post_author === 22 && (int) get_post(101)->post_author === 22, 'Ownership transfers on the same specimen and target');
setae_claim_assert(get_post(101)->post_name === 'r4k7m' && get_post_meta(201, Setae_QR_Manager::CODE_META, true) === 'r4k7m', 'Permanent QR code is unchanged');
setae_claim_assert(get_post_meta(201, '_setae_spider_image', true) === $original_photo, 'Existing image data is preserved');
setae_claim_assert(Setae_Entitlements::get_specimen_source(201) === 'transfer_received' && is_int(get_post_meta(201, '_setae_received_at', true)), 'Recipient source and UNIX receive timestamp are saved');
setae_claim_assert(Setae_Entitlements::get_specimen_source($snapshot_id) === 'transfer_receipt' && Setae_Entitlements::is_slot_exempt_specimen($snapshot_id), 'Owner snapshot is a slot-exempt receipt');
setae_claim_assert(Setae_Entitlements::get_inventory_usage(22)['active_slot_bearing'] === 8, 'Successful transfer does not change manual usage');
setae_claim_assert(Setae_QR_Manager::get_spider_public_mode(201) === 'private' && Setae_QR_Manager::get_spider_public_mode($snapshot_id) === 'private', 'Both explicit and legacy public modes are reset');
setae_claim_assert(!Setae_QR_Manager::is_transfer_available(get_post(101)), 'Re-transfer stays disabled after receipt');
foreach ($original_logs as $id) {
    setae_claim_assert((int) get_post($id)->post_author === 22, 'Current owner controls original history access');
    setae_claim_assert((int) get_post_meta($id, Setae_Entitlements::RECORDER_META, true) === ($id === 402 ? 33 : 11), 'Historical recorder never changes with ownership');
    setae_claim_assert(get_post_meta($id, '_setae_log_shared', true) === '', 'Transferred logs are not still publicly shared');
}
$receipt_logs = get_posts(array('post_type' => 'setae_log', 'post_status' => 'any', 'meta_key' => '_setae_log_spider_id', 'meta_value' => $snapshot_id));
setae_claim_assert(count($receipt_logs) === count($original_logs), 'Receipt contains the complete pre-transfer history snapshot');
$receipt_recorders = array();
foreach ($receipt_logs as $log) {
    $receipt_recorders[] = (int) get_post_meta($log->ID, Setae_Entitlements::RECORDER_META, true);
    setae_claim_assert((int) $log->post_author === 11 && get_post_meta($log->ID, '_setae_log_shared', true) === '', 'Receipt is private to the former owner');
}
setae_claim_assert(in_array(33, $receipt_recorders, true) && in_array(11, $receipt_recorders, true), 'Receipt preserves existing and backfilled recorder identities');
setae_claim_assert(is_wp_error(Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11)), 'A completed transfer cannot replay');
foreach (array('transfer-complete:' . $request->ID, 'animal-received:' . $request->ID) as $key) {
    setae_claim_assert(isset($GLOBALS['setae_fixture_events'][$key]) && in_array('COMMIT', $GLOBALS['setae_fixture_events'][$key]['queries'], true), 'Completion events occur only after successful commit');
}

// A new QR record belongs to its current creator, without rewriting older provenance.
$record = setae_fixture_invoke(new Setae_QR_Manager(), 'create_spider_log', 201, 22, 'feed', '2026-08-28', 'Synthetic care note', 'cricket');
setae_claim_assert(!is_wp_error($record) && (int) get_post_meta($record, Setae_Entitlements::RECORDER_META, true) === 22, 'New QR log records its creator');
Setae_Entitlements::mark_log_recorder($record, 33);
setae_claim_assert((int) get_post_meta($record, Setae_Entitlements::RECORDER_META, true) === 22, 'Provenance is immutable after creation');

// Test the actual API delegation for all three label sources, without generating excess targets.
setae_claim_seed(); wp_set_current_user(22);
$api = new Setae_API_QR();
$too_many = range(1000, 1020);
$spider_denied = $api->get_targets(new Setae_Claim_Fixture_Request(array('ids' => $too_many)));
setae_claim_assert(is_wp_error($spider_denied) && $spider_denied->get_error_code() === 'setae_label_batch_limit', 'Free 21-label request is rejected by Entitlements');
$enclosure_denied = $api->get_targets(new Setae_Claim_Fixture_Request(array('source' => 'enclosure', 'ids' => $too_many)));
setae_claim_assert(is_wp_error($enclosure_denied) && $enclosure_denied->get_error_code() === 'setae_label_batch_limit', 'Enclosure label batch uses the same gate');
$group = wp_insert_post(array('post_type' => 'setae_baby_group', 'post_status' => 'publish', 'post_title' => 'Synthetic group', 'post_author' => 22), true);
$baby_denied = $api->get_targets(new Setae_Claim_Fixture_Request(array('source' => 'baby', 'group_id' => $group, 'codes' => $too_many)));
setae_claim_assert(is_wp_error($baby_denied) && $baby_denied->get_error_code() === 'setae_label_batch_limit', 'Nursery label batch uses the same gate');
update_user_meta(22, '_setae_plan_id', 'legacy_premium');
$resource = $api->get_targets(new Setae_Claim_Fixture_Request(array('ids' => range(1, 5001))));
setae_claim_assert(is_wp_error($resource) && $resource->get_error_code() === 'qr_label_resource_limit' && $resource->get_error_data()['reason'] === 'resource_limit', 'Resource ceiling is distinct from the unlimited plan');
$legacy = setae_fixture_invoke($api, 'check_label_batch', 22, 101);
setae_claim_assert(!is_wp_error($legacy), 'Legacy unlimited is not narrowed to the old 100-label ceiling');

wp_set_current_user(11);
$lookup = $api->get_targets(new Setae_Claim_Fixture_Request(array('ids' => array(201))));
setae_claim_assert($lookup instanceof WP_REST_Response && !$GLOBALS['setae_fixture_events'], 'Passport URL lookup is not a label export event');
$operation_id = str_repeat('a', 80);
foreach (array(1, 2) as $attempt) {
    $export = $api->get_targets(new Setae_Claim_Fixture_Request(array('ids' => array(201), 'purpose' => 'labels', 'operation_id' => $operation_id)));
    setae_claim_assert($export instanceof WP_REST_Response, 'Authorized label data returns successfully');
}
setae_claim_assert(count($GLOBALS['setae_fixture_events']) === 1, 'One explicit label generation is idempotent across retries');
$event_key = array_key_first($GLOBALS['setae_fixture_events']);
setae_claim_assert(strlen($event_key) <= 80 && strpos($event_key, $operation_id) === false, 'Event key respects storage limit without keeping client text');

function setae_transfer_state()
{
    return serialize(array($GLOBALS['setae_fixture_posts'], $GLOBALS['setae_fixture_meta'], $GLOBALS['setae_fixture_user_meta'], $GLOBALS['setae_fixture_terms']));
}

// A metadata API can return failure, or a post update can report an ID without persisting.
// The real transaction helper must roll all business state back in either case.
$write_failures = array(
    'received source' => function ($op, $id, $key) { return $op === 'update_meta' && $id === 201 && $key === Setae_Entitlements::SOURCE_META; },
    'receipt source' => function ($op, $id, $key) { return $op === 'update_meta' && $id !== 201 && $key === Setae_Entitlements::SOURCE_META; },
    'received timestamp' => function ($op, $id, $key) { return $id === 201 && $key === '_setae_received_at'; },
    'private mode' => function ($op, $id, $key) { return $id === 201 && $key === Setae_QR_Manager::PUBLIC_MODE_META; },
    'transfer setting clear' => function ($op, $id, $key) { return $op === 'delete_meta' && $id === 201 && $key === Setae_QR_Manager::TRANSFER_ENABLED_META; },
    'history share clear' => function ($op, $id, $key) { return $op === 'delete_meta' && $id === 801 && $key === '_setae_log_shared'; },
    'original recorder' => function ($op, $id, $key) { return $op === 'add_meta' && $id === 401 && $key === Setae_Entitlements::RECORDER_META; },
    'receipt recorder' => function ($op, $id, $key) { return $op === 'add_meta' && $id >= 9000 && $key === Setae_Entitlements::RECORDER_META; },
    'snapshot private metadata' => function ($op, $id, $key) { return $op === 'add_meta' && $key === '_setae_memo'; },
    'spider owner no-op' => function ($op, $id) { return $op === 'update_post' && $id === 201; },
    'target owner no-op' => function ($op, $id) { return $op === 'update_post' && $id === 101; },
    'log owner no-op' => function ($op, $id) { return $op === 'update_post' && $id === 401; },
    'request approval' => function ($op, $id, $key, $value) { return $key === '_setae_transfer_status' && $value === 'approved'; },
);
foreach ($write_failures as $name => $fails) {
    setae_claim_seed();
    Setae_Entitlements::mark_specimen_source(201, 'manual');
    $request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
    // Complete the existing lazy plan migration before comparing business rollback state.
    Setae_Entitlements::get_entitlements(22);
    $before = setae_transfer_state();
    $events = $GLOBALS['setae_fixture_events'];
    $hits = 0;
    $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key, $value) use ($fails, &$hits) { if ($fails($op, $id, $key, $value)) { $hits++; return false; } return true; };
    $result = Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11);
    setae_claim_assert($hits > 0, $name . ': intended failure point was actually exercised');
    setae_claim_assert(is_wp_error($result), $name . ': failed write is never success');
    setae_claim_assert(setae_transfer_state() === $before, $name . ': posts, history, source, receipt and private metadata roll back exactly');
    setae_claim_assert($GLOBALS['setae_fixture_events'] === $events, $name . ': no completion event before commit');
    setae_claim_assert(in_array('ROLLBACK', $GLOBALS['wpdb']->queries, true) && !$GLOBALS['setae_fixture_cache_suspended'], $name . ': rollback restores cache suspension');
    setae_claim_assert(in_array(array('post_meta', 201), $GLOBALS['setae_fixture_cache_clears'], true), $name . ': changed post caches are invalidated');
}

foreach (array('SET TRANSACTION READ WRITE', 'START TRANSACTION', 'SAVEPOINT setae_entitlement_write', 'RELEASE SAVEPOINT setae_entitlement_write', 'COMMIT') as $sql) {
    setae_claim_seed();
    $request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
    Setae_Entitlements::get_entitlements(22);
    $before = setae_transfer_state();
    $events = $GLOBALS['setae_fixture_events'];
    $GLOBALS['setae_fixture_query_failure'][$sql] = true;
    $result = Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11);
    setae_claim_assert(is_wp_error($result) && setae_transfer_state() === $before, $sql . ': unsuccessful transaction never becomes a completed transfer');
    setae_claim_assert($GLOBALS['setae_fixture_events'] === $events && $GLOBALS['wpdb']->reconnect_retries === 5, $sql . ': no event and reconnect policy restored');
}

// A lost COMMIT response is genuinely uncertain: read-back must reveal the saved result,
// and replay must not create a second receipt or silently claim a second success.
setae_claim_seed();
$request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
$GLOBALS['setae_fixture_query_failure']['COMMIT'] = 'lost_after_commit';
$result = Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11);
setae_claim_assert(is_wp_error($result) && $result->get_error_code() === 'setae_transaction_commit_unconfirmed', 'Lost commit response is reported as unconfirmed');
setae_claim_assert(get_post_meta($request->ID, '_setae_transfer_status', true) === 'approved' && (int) get_post(201)->post_author === 22, 'Read-back can distinguish a persisted transfer after the lost response');
$after = setae_transfer_state();
unset($GLOBALS['setae_fixture_query_failure']['COMMIT']);
setae_claim_assert(is_wp_error(Setae_QR_Manager::respond_to_transfer($request->ID, 'approve', 11)) && setae_transfer_state() === $after, 'Retry after an uncertain commit never duplicates the transfer');
setae_claim_assert(!isset($GLOBALS['setae_fixture_events']['transfer-complete:' . $request->ID]), 'Unconfirmed commit does not emit a confirmed completion event');

function setae_transfer_baby_fixture()
{
    setae_claim_seed();
    $group = wp_insert_post(array('post_type' => 'setae_baby_group', 'post_status' => 'publish', 'post_title' => 'Synthetic nursery', 'post_author' => 11), true);
    $spider = setae_transfer_fixture_animal(11, 'nursery_promotion');
    $target = wp_insert_post(array('post_type' => Setae_QR_Manager::TARGET_POST_TYPE, 'post_status' => 'private', 'post_title' => 'b4by7', 'post_name' => 'b4by7', 'post_author' => 11), true);
    foreach (array('_setae_baby_count' => 2, '_setae_baby_prefix' => 'B', '_setae_baby_items' => array('B001' => array('status' => 'alive')), '_setae_baby_qr_targets' => array('B001' => $target, 'B002' => 777)) as $key => $value) { update_post_meta($group, $key, $value); }
    foreach (array('_setae_qr_target_type' => 'baby', '_setae_qr_object_id' => $group, '_setae_qr_baby_code' => 'B001') as $key => $value) { update_post_meta($target, $key, $value); }
    wp_set_current_user(11);
    return array($group, $spider, $target);
}

list($group, $spider, $target) = setae_transfer_baby_fixture();
$promote = Setae_Entitlements::with_transaction(array(11), function () use ($group, $spider) { return Setae_QR_Manager::promote_baby_target($group, 'B001', $spider); });
setae_claim_assert(!is_wp_error($promote) && $promote->ID === $target && $promote->post_name === 'b4by7', 'Promotion preserves the permanent target and short code');
setae_claim_assert(get_post_meta($target, '_setae_qr_target_type', true) === 'spider' && !metadata_exists('post', $target, '_setae_qr_baby_code'), 'Promoted QR is no longer routed as a baby');
setae_claim_assert(get_post_meta($spider, Setae_QR_Manager::TARGET_ID_META, true) === $target && get_post_meta($group, '_setae_baby_qr_targets', true) === array('B002' => 777), 'Promotion updates reverse routing without removing other babies');

foreach (array('_setae_qr_target_type', '_setae_qr_object_id', '_setae_qr_baby_code', Setae_QR_Manager::TARGET_ID_META, Setae_QR_Manager::CODE_META, '_setae_baby_qr_targets') as $failed_key) {
    list($group, $spider, $target) = setae_transfer_baby_fixture();
    $before = setae_transfer_state(); $hits = 0;
    $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use ($failed_key, &$hits) { if ($key === $failed_key) { $hits++; return false; } return true; };
    $result = Setae_Entitlements::with_transaction(array(11), function () use ($group, $spider) { return Setae_QR_Manager::promote_baby_target($group, 'B001', $spider); });
    setae_claim_assert($hits > 0 && is_wp_error($result) && setae_transfer_state() === $before, $failed_key . ': promotion routing failure rolls back all mappings');
    setae_claim_assert(in_array(array('post_meta', $target), $GLOBALS['setae_fixture_cache_clears'], true), 'Promotion invalidates target caches after rollback');
}

list($group, $spider, $target) = setae_transfer_baby_fixture();
wp_delete_post($target, true);
$before = setae_transfer_state(); $new_target = 0;
$result = Setae_Entitlements::with_transaction(array(11), function () use ($group, $spider, &$new_target) {
    $result = Setae_QR_Manager::promote_baby_target($group, 'B001', $spider);
    if (is_wp_error($result)) { return $result; }
    $new_target = $result->ID;
    return new WP_Error('fixture_later_failure', 'Synthetic later promotion failure');
});
setae_claim_assert($new_target > 0 && is_wp_error($result) && setae_transfer_state() === $before, 'New promotion target rolls back with the outer transaction');
setae_claim_assert(!get_post($new_target) && in_array(array('post_meta', $new_target), $GLOBALS['setae_fixture_cache_clears'], true), 'Rolled back new target cache is invalidated');

// Simulate a separate promotion committing while record_target_batch waits for its user lock.
list($group, $spider, $target) = setae_transfer_baby_fixture();
$GLOBALS['setae_fixture_on_lock'] = function () use ($group, $spider) {
    $result = Setae_Entitlements::with_transaction(array(11), function () use ($group, $spider) {
        $result = Setae_QR_Manager::promote_baby_target($group, 'B001', $spider);
        if (is_wp_error($result)) { return $result; }
        return Setae_Entitlements::save_post_meta_checked($group, array('_setae_baby_items' => array('B001' => array('status' => 'transferred', 'transferred_spider_id' => $spider))));
    });
    setae_claim_assert(!is_wp_error($result), 'Simulated competing promotion actually commits');
};
$record = array('type' => 'feed', 'date' => '2026-08-28', 'note' => 'Local record', 'prey_type' => 'cricket');
$result = Setae_QR_Manager::record_target_batch(array('b4by7'), array($record));
setae_claim_assert(is_wp_error($result) && $result->get_error_code() === 'qr_target_changed', 'Stale prepared baby is rejected after waiting for the lock');
setae_claim_assert(get_post_meta($group, '_setae_baby_items', true)['B001']['status'] === 'transferred' && !$GLOBALS['setae_fixture_events'], 'Stale record never restores an alive baby or emits activation');
$result = Setae_QR_Manager::record_target_batch(array('b4by7'), array($record));
setae_claim_assert(!is_wp_error($result) && $result['created'][0]['target_type'] === 'spider', 'Rescanning the permanent QR records against the promoted specimen');
setae_claim_assert((int) get_post_meta($result['created'][0]['log_id'], '_setae_log_spider_id', true) === $spider, 'New record uses the new trusted target');
setae_claim_assert(in_array('COMMIT', $GLOBALS['setae_fixture_events']['first-record:11']['queries'], true), 'Only a committed real record emits activation');

list($group, $spider, $target) = setae_transfer_baby_fixture();
$result = Setae_QR_Manager::record_target_batch(array('b4by7'), array($record));
setae_claim_assert(!is_wp_error($result) && count(get_post_meta($group, '_setae_baby_items', true)['B001']['history']) === 1, 'Real baby care records remain available without a plan gate');
setae_claim_assert($GLOBALS['setae_fixture_events']['first-record:11']['context']['object_type'] === 'baby_group', 'Real baby care can activate a user, without inventing a log ID');

foreach (array('_setae_baby_items', '_setae_log_data', Setae_Entitlements::RECORDER_META, '_setae_last_feed_date') as $failed_key) {
    list($group, $spider, $target) = setae_transfer_baby_fixture();
    $before = setae_transfer_state(); $hits = 0;
    $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use ($failed_key, &$hits) { if ($key === $failed_key) { $hits++; return false; } return true; };
    $code = $failed_key === '_setae_baby_items' ? 'b4by7' : 'r4k7m';
    $result = Setae_QR_Manager::record_target_batch(array($code), array($record));
    setae_claim_assert($hits > 0 && is_wp_error($result) && setae_transfer_state() === $before, $failed_key . ': failed real record is rolled back');
    setae_claim_assert(!$GLOBALS['setae_fixture_events'], 'Failed care save never emits a first-record event');
}

// Individual editing shares a sparse public-settings contract with the existing QR API.
// Only the WordPress/datastore boundary is simulated: both real edit paths execute below.
require_once SETAE_PLUGIN_DIR . 'includes/api/class-setae-api-spiders.php';
require_once SETAE_PLUGIN_DIR . 'includes/api/class-setae-api-offline.php';

function setae_settings_seed($mode = 'life_history', $transfer = true)
{
    setae_claim_seed(array('visibility' => $mode, 'transfer' => $transfer));
    wp_set_current_user(11);
}
function setae_settings_edit(array $changes)
{
    return (new Setae_API_Spiders())->update_spider(new Setae_Claim_Fixture_Request(array_merge(array('id' => 201), $changes)));
}
function setae_settings_offline(array $changes, $nested = true)
{
    return setae_fixture_invoke(new Setae_API_Offline(), 'update_spider', 201, $nested ? array('changes' => $changes) : $changes, get_current_user_id());
}
function setae_settings_public_state()
{
    $keys = array_fill_keys(array(Setae_QR_Manager::PUBLIC_META, Setae_QR_Manager::PUBLIC_MODE_META, Setae_QR_Manager::TRANSFER_ENABLED_META, Setae_QR_Manager::TARGET_ID_META, Setae_QR_Manager::CODE_META), true);
    $state = array('specimen' => array_intersect_key($GLOBALS['setae_fixture_meta'][201], $keys), 'routing_and_requests' => array());
    foreach ($GLOBALS['setae_fixture_posts'] as $id => $post) {
        if (in_array($post->post_type, array(Setae_QR_Manager::TARGET_POST_TYPE, Setae_QR_Manager::TRANSFER_POST_TYPE), true)) {
            $state['routing_and_requests'][$id] = array($post, $GLOBALS['setae_fixture_meta'][$id] ?? array());
        }
    }
    $state['notifications'] = array(Setae_QR_Manager::get_notifications(11), Setae_QR_Manager::get_notifications(22));
    return serialize($state);
}
function setae_settings_assert_error($result, $code, $message)
{
    setae_claim_assert(is_wp_error($result) && $result->get_error_code() === $code, $message . ': expected ' . $code);
}

foreach (array('private', 'basic', 'life_history') as $mode) {
    foreach (array(false, true, '0', '1') as $enabled) {
        setae_settings_seed();
        $before = setae_transfer_state();
        $patch = Setae_QR_Manager::prepare_spider_settings_patch(201, 11, array('qr_visibility' => $mode, 'transfer_enabled' => $enabled));
        $expected = $enabled === true || $enabled === '1';
        setae_claim_assert($patch === array('qr_visibility' => $mode, 'transfer_enabled' => $expected) && setae_transfer_state() === $before, 'Pure preparation normalizes JSON/multipart values without any write');
        $result = setae_settings_edit(array('name' => 'Edited with public settings', 'qr_visibility' => $mode, 'transfer_enabled' => $enabled));
        setae_claim_assert($result instanceof WP_REST_Response && $result->get_status() === 200, 'The real animal endpoint saves both fields in one call');
        $animal = $result->get_data()['data'];
        setae_claim_assert($animal['title'] === 'Edited with public settings' && $animal['qr_visibility'] === $mode && $animal['qr_public'] === ($mode !== 'private') && $animal['transfer_enabled'] === $expected && $animal['transfer_receipt'] === false, 'Edit response contains confirmed normalized settings and normal fields');
        setae_claim_assert(get_post(101)->post_name === 'r4k7m' && get_post_meta(201, Setae_QR_Manager::TARGET_ID_META, true) === 101, 'Public changes preserve the printed permanent QR identity');
    }
}

setae_settings_seed();
delete_post_meta(201, Setae_QR_Manager::PUBLIC_MODE_META);
update_post_meta(201, Setae_QR_Manager::PUBLIC_META, '1');
$result = setae_settings_edit(array('name' => 'Legacy ordinary edit'));
setae_claim_assert($result instanceof WP_REST_Response && $result->get_data()['data']['qr_visibility'] === 'life_history', 'Missing new fields preserve legacy public=true as life_history');
setae_claim_assert(!metadata_exists('post', 201, Setae_QR_Manager::PUBLIC_MODE_META) && !in_array('START TRANSACTION', $GLOBALS['wpdb']->queries, true), 'Ordinary edit does not materialize a default mode or add a settings transaction');
$result = setae_settings_edit(array('transfer_enabled' => '0'));
setae_claim_assert($result->get_data()['data']['qr_visibility'] === 'life_history' && !metadata_exists('post', 201, Setae_QR_Manager::PUBLIC_MODE_META), 'A transfer-only patch preserves the omitted legacy mode');
setae_settings_seed('private', true);
$result = setae_settings_edit(array('qr_visibility' => 'basic'));
setae_claim_assert($result->get_data()['data']['transfer_enabled'] === true, 'A visibility-only patch preserves reception');
setae_settings_seed('private', false);
delete_post_meta(201, Setae_QR_Manager::PUBLIC_MODE_META);
delete_post_meta(201, Setae_QR_Manager::TARGET_ID_META);
delete_post_meta(201, Setae_QR_Manager::CODE_META);
wp_delete_post(101, true);
$result = setae_settings_edit(array('notes' => 'Ordinary private note'));
setae_claim_assert($result->get_data()['data']['qr_visibility'] === 'private' && !$result->get_data()['data']['transfer_enabled'] && !get_post_meta(201, Setae_QR_Manager::TARGET_ID_META, true), 'Unconfigured specimen remains private without generating a target during an ordinary edit');

foreach (array(
    array('qr_visibility' => 'public'), array('qr_visibility' => null), array('qr_visibility' => array('basic')),
    array('transfer_enabled' => 'on'), array('transfer_enabled' => 'false'), array('transfer_enabled' => 2), array('transfer_enabled' => null),
) as $bad) {
    setae_settings_seed();
    $before = setae_transfer_state();
    $code = array_key_exists('qr_visibility', $bad) ? 'qr_invalid_visibility' : 'qr_invalid_transfer_enabled';
    setae_settings_assert_error(setae_settings_edit(array_merge(array('name' => 'Must not save'), $bad)), $code, 'Explicit invalid settings fail before ordinary writes');
    setae_claim_assert(setae_transfer_state() === $before, 'Rejected settings leave all posts and metadata untouched');
}
setae_settings_seed();
$before = setae_transfer_state();
wp_set_current_user(22);
setae_settings_assert_error(setae_settings_edit(array('name' => 'Not my specimen', 'qr_visibility' => 'basic')), 'forbidden', 'Animal endpoint remains owner-only');
setae_claim_assert(setae_transfer_state() === $before, 'Non-owner cannot alter any ordinary or public value');
wp_set_current_user(99);
setae_settings_assert_error(setae_settings_edit(array('qr_visibility' => 'basic')), 'forbidden', 'New fields do not introduce an admin bypass to the animal endpoint');
setae_settings_seed();
$GLOBALS['setae_fixture_on_lock'] = function () { wp_update_post(array('ID' => 201, 'post_author' => 22)); };
$before = setae_settings_public_state();
setae_settings_assert_error(setae_settings_edit(array('qr_visibility' => 'basic')), 'forbidden', 'Owner is checked again after waiting for the shared transfer lock');
setae_claim_assert(setae_settings_public_state() === $before, 'A transfer while waiting cannot modify the new owner public settings');

// A receipt keeps its normal editable notes but can never reopen reception or change visibility.
setae_settings_seed('private', false);
update_post_meta(201, '_setae_transfer_receipt', '1');
update_post_meta(201, '_setae_spider_archived', '1');
$before = setae_transfer_state();
setae_settings_assert_error(setae_settings_edit(array('notes' => 'Must not save', 'qr_visibility' => 'private', 'transfer_enabled' => '0')), 'qr_transfer_receipt', 'Even explicit no-op settings on receipts are rejected');
setae_claim_assert(setae_transfer_state() === $before, 'Receipt refusal precedes ordinary saves');
$result = setae_settings_edit(array('notes' => 'Former owner annotation'));
setae_claim_assert($result instanceof WP_REST_Response && $result->get_data()['data']['notes'] === 'Former owner annotation' && $result->get_data()['data']['transfer_receipt'], 'Missing public fields keep ordinary receipt edits compatible');
setae_claim_assert(Setae_QR_Manager::get_target_label_data(get_post(101))['transfer_receipt'] === true, 'Private QR settings response exposes the receipt lock');

setae_settings_seed('private', false);
$before = setae_transfer_state();
setae_settings_assert_error(setae_settings_edit(array('name' => 'Must not save', 'archived' => '1', 'qr_visibility' => 'basic', 'transfer_enabled' => '1')), 'qr_archived_transfer', 'Archive plus reception ON is rejected upfront');
setae_claim_assert(setae_transfer_state() === $before, 'Archive conflict does not partially change the animal');
update_post_meta(201, '_setae_spider_archived', '1');
setae_settings_assert_error(setae_settings_edit(array('transfer_enabled' => true)), 'qr_archived_transfer', 'Already archived specimens cannot reopen reception');
$result = setae_settings_edit(array('archived' => '0', 'transfer_enabled' => '1'));
setae_claim_assert($result instanceof WP_REST_Response && !$result->get_data()['data']['archived'] && $result->get_data()['data']['transfer_enabled'], 'Explicit unarchive and reception ON can save together');

// The legacy QR endpoint is still a full-set adapter, including its public boolean fallback.
setae_settings_seed('private', false);
$qr_api = new Setae_API_QR();
foreach (array(
    array(array('public' => true, 'transfer_enabled' => '1'), 'life_history', true),
    array(array('public' => false, 'visibility' => 'basic', 'transfer_enabled' => '0'), 'basic', false),
    array(array('public' => true, 'visibility' => 'old-invalid-mode'), 'life_history', false),
    array(array(), 'private', false),
) as $case) {
    $result = $qr_api->update_spider_settings(new Setae_Claim_Fixture_Request(array_merge(array('id' => 201), $case[0])));
    setae_claim_assert($result instanceof WP_REST_Response && $result->get_data()['success'] && $result->get_data()['target']['visibility'] === $case[1] && $result->get_data()['target']['transfer_enabled'] === $case[2], 'Existing QR full-set API signature and response are preserved');
}
wp_set_current_user(99);
$result = $qr_api->update_spider_settings(new Setae_Claim_Fixture_Request(array('id' => 201, 'visibility' => 'basic')));
setae_claim_assert($result instanceof WP_REST_Response && (int) get_post(201)->post_author === 11, 'Existing QR administrator support retains original ownership');
wp_set_current_user(22);
setae_settings_assert_error($qr_api->update_spider_settings(new Setae_Claim_Fixture_Request(array('id' => 201, 'visibility' => 'basic'))), 'qr_forbidden', 'QR endpoint also rejects unrelated owners');

// Late ordinary validation must never have applied a public change already.
foreach (array(
    array('classification' => 'not-valid'), array('acquired_date' => 'tomorrow'), array('instar' => 31),
    array('notes' => str_repeat('x', 2001)), array('bl_status' => 'not-valid'), array('bl_status' => 'recruiting'),
    array('bl_status' => 'recruiting', 'breeding_contact_url' => 'http://example.test/'),
    array('bl_terms' => str_repeat('x', 2001)), array('species_id' => 999999), array('species_id' => 0, 'custom_species' => ''),
) as $bad) {
    setae_settings_seed();
    $pending = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
    $before = setae_settings_public_state();
    $result = setae_settings_edit(array_merge(array('name' => 'An ordinary edit may precede later validation', 'qr_visibility' => 'private', 'transfer_enabled' => '0'), $bad));
    setae_claim_assert(is_wp_error($result) && setae_settings_public_state() === $before, 'Late animal validation never changes public settings, QR routing or pending requests');
}

// Reception OFF, mode, legacy boolean and pending cancellations are one transaction.
$settings_failures = array(
    'mode write' => function ($op, $id, $key) { return $id === 201 && $key === Setae_QR_Manager::PUBLIC_MODE_META; },
    'legacy public clear' => function ($op, $id, $key) { return $id === 201 && $key === Setae_QR_Manager::PUBLIC_META; },
    'reception clear' => function ($op, $id, $key) { return $id === 201 && $key === Setae_QR_Manager::TRANSFER_ENABLED_META; },
    'pending cancel' => function ($op, $id, $key) { return $key === '_setae_transfer_status'; },
    'pending completion timestamp' => function ($op, $id, $key) { return $key === '_setae_transfer_completed_at'; },
);
foreach ($settings_failures as $name => $fails) {
    setae_settings_seed();
    update_post_meta(201, Setae_QR_Manager::PUBLIC_META, '1');
    $pending = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
    $before = setae_settings_public_state(); $hits = 0;
    $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key, $value) use ($fails, &$hits) { if ($fails($op, $id, $key, $value)) { $hits++; return false; } return true; };
    $result = setae_settings_edit(array('name' => 'Ordinary fields are not globally transactional', 'qr_visibility' => 'private', 'transfer_enabled' => '0'));
    setae_claim_assert($hits > 0 && is_wp_error($result) && setae_settings_public_state() === $before, $name . ': fail closed and roll back all public state/requests');
    setae_claim_assert(get_post(201)->post_title === 'Ordinary fields are not globally transactional', 'Explicitly document existing ordinary-field partial-save limitation');
    setae_claim_assert(in_array('ROLLBACK', $GLOBALS['wpdb']->queries, true) && in_array(array('post_meta', 201), $GLOBALS['setae_fixture_cache_clears'], true), 'Failed settings transaction invalidates stale metadata caches');
}
foreach (array(Setae_QR_Manager::PUBLIC_META, Setae_QR_Manager::TRANSFER_ENABLED_META) as $failed_key) {
    setae_settings_seed('private', false);
    delete_post_meta(201, $failed_key);
    $before = setae_settings_public_state(); $hits = 0;
    $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use ($failed_key, &$hits) { if ($id === 201 && $key === $failed_key) { $hits++; return false; } return true; };
    $result = setae_settings_edit(array('qr_visibility' => 'basic', 'transfer_enabled' => '1'));
    setae_claim_assert($hits > 0 && is_wp_error($result) && setae_settings_public_state() === $before, 'Failed enable writes are also verified, not treated as success');
}
setae_settings_seed();
$pending = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
$before = setae_settings_public_state(); $hits = 0;
$GLOBALS['setae_fixture_query_failure_filter'] = function ($args) use (&$hits) {
    if (($args['post_type'] ?? '') === Setae_QR_Manager::TRANSFER_POST_TYPE) { $hits++; return true; }
    return false;
};
$result = setae_settings_edit(array('qr_visibility' => 'private', 'transfer_enabled' => false));
setae_settings_assert_error($result, 'qr_transfer_lookup_failed', 'A failed cancellation query is not an empty successful result');
setae_claim_assert($hits > 0 && setae_settings_public_state() === $before, 'Pending lookup failure rolls public settings and requests back together');
foreach (array('START TRANSACTION', 'COMMIT') as $sql) {
    setae_settings_seed();
    $before = setae_settings_public_state();
    $GLOBALS['setae_fixture_query_failure'][$sql] = true;
    $result = setae_settings_edit(array('qr_visibility' => 'private', 'transfer_enabled' => '0'));
    setae_claim_assert(is_wp_error($result) && setae_settings_public_state() === $before, 'Unsuccessful settings transaction is never acknowledged as saved');
}
setae_settings_seed('private', false);
delete_post_meta(201, Setae_QR_Manager::TARGET_ID_META);
delete_post_meta(201, Setae_QR_Manager::CODE_META);
wp_delete_post(101, true);
$before = setae_settings_public_state(); $hits = 0;
$GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use (&$hits) { if ($id === 201 && $key === Setae_QR_Manager::CODE_META) { $hits++; return false; } return true; };
$result = setae_settings_edit(array('qr_visibility' => 'basic'));
setae_claim_assert($hits > 0 && is_wp_error($result) && setae_settings_public_state() === $before, 'New QR target and reverse mapping roll back when binding fails');

setae_settings_seed();
$pending = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
$GLOBALS['wpdb']->queries = array();
$notified_after_commit = false;
$GLOBALS['setae_fixture_user_meta_observer'] = function ($id, $key, $value) use (&$notified_after_commit) {
    if ($key === Setae_QR_Manager::NOTIFICATION_META && ($value[0]['type'] ?? '') === 'transfer_cancelled') {
        setae_claim_assert(in_array('COMMIT', $GLOBALS['wpdb']->queries, true), 'Cancellation notification must not run before the public settings commit');
        $notified_after_commit = true;
    }
};
$result = setae_settings_edit(array('archived' => '1', 'qr_visibility' => 'basic'));
setae_claim_assert($result instanceof WP_REST_Response && !$result->get_data()['data']['transfer_enabled'] && $result->get_data()['data']['archived'], 'Archiving with a visibility-only patch closes reception');
setae_claim_assert(get_post_meta($pending->ID, '_setae_transfer_status', true) === 'cancelled' && $notified_after_commit, 'Pending request cancellation commits with reception before notifying');
$notification_count = count(Setae_QR_Manager::get_notifications(22));
$result = setae_settings_edit(array('archived' => '1', 'qr_visibility' => 'basic'));
setae_claim_assert($result instanceof WP_REST_Response && count(Setae_QR_Manager::get_notifications(22)) === $notification_count, 'Retrying a confirmed settings edit does not duplicate cancellation notifications');

// A pre-existing race in request creation is outside this change: an in-flight
// request can become visible after closing reception. It still must not transfer.
setae_settings_seed('private', true);
$pending = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
$request_meta = $GLOBALS['setae_fixture_meta'][$pending->ID];
$result = setae_settings_edit(array('transfer_enabled' => false));
setae_claim_assert($result instanceof WP_REST_Response, 'Reception close succeeds before modelling a late request');
$late = wp_insert_post(array('post_type' => Setae_QR_Manager::TRANSFER_POST_TYPE, 'post_status' => 'publish', 'post_title' => 'Synthetic in-flight request', 'post_author' => 11, 'meta_input' => $request_meta), true);
$result = Setae_QR_Manager::respond_to_transfer($late, 'approve', 11);
setae_settings_assert_error($result, 'qr_transfer_closed', 'Approval rechecks reception even for a pending request visible after closing');
setae_claim_assert((int) get_post(201)->post_author === 11 && get_post_meta($late, '_setae_transfer_status', true) === 'pending', 'Reception OFF never permits actual ownership transfer');

// Offline server operations share validation/patch semantics, even though UI privacy edits require online confirmation.
foreach (array(true, false) as $nested) {
    setae_settings_seed();
    $result = setae_settings_offline(array('name' => 'Offline compatibility', 'qr_visibility' => 'basic', 'transfer_enabled' => '0'), $nested);
    setae_claim_assert(!is_wp_error($result) && $result === array('entity' => 'spider', 'server_id' => 201) && Setae_QR_Manager::get_spider_public_mode(201) === 'basic' && !get_post_meta(201, Setae_QR_Manager::TRANSFER_ENABLED_META, true), 'Both supported offline payload shapes preserve result contract and save public fields');
}
foreach (array(array('species_id' => 999999), array('image_data' => 'not-an-image')) as $bad) {
    setae_settings_seed();
    $before = setae_settings_public_state();
    $result = setae_settings_offline(array_merge(array('qr_visibility' => 'private', 'transfer_enabled' => '0'), $bad));
    setae_claim_assert(is_wp_error($result) && setae_settings_public_state() === $before, 'Offline late species/image errors never apply public settings');
}
setae_settings_seed();
$before = setae_transfer_state();
setae_settings_assert_error(setae_settings_offline(array('name' => 'Must not save', 'qr_visibility' => null)), 'qr_invalid_visibility', 'Offline explicit invalid/null values fail before writes');
setae_settings_assert_error(setae_settings_offline(array('name' => 'Must not save', 'archived' => true, 'transfer_enabled' => true)), 'qr_archived_transfer', 'Offline archive conflict is validated before ordinary fields');
setae_claim_assert(setae_transfer_state() === $before, 'Offline preparation errors preserve all values');
$before = setae_settings_public_state();
$result = setae_settings_offline(array('name' => 'No public changes'));
setae_claim_assert(!is_wp_error($result) && setae_settings_public_state() === $before, 'Legacy offline edits without new fields do not reset public settings');
setae_settings_seed();
$before = setae_settings_public_state(); $hits = 0;
$GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use (&$hits) { if ($id === 201 && $key === Setae_QR_Manager::PUBLIC_MODE_META) { $hits++; return false; } return true; };
$result = setae_settings_offline(array('qr_visibility' => 'private', 'transfer_enabled' => '0'));
setae_claim_assert($hits > 0 && is_wp_error($result) && setae_settings_public_state() === $before, 'Offline settings write failure is returned and rolls public state back');
setae_settings_seed();
update_post_meta(201, '_setae_transfer_receipt', '1');
update_post_meta(201, '_setae_spider_archived', '1');
$before = setae_transfer_state();
setae_settings_assert_error(setae_settings_offline(array('name' => 'Must not save', 'archived' => false)), 'transfer_receipt_locked', 'Offline cannot bypass the receipt archive lock');
setae_settings_assert_error(setae_settings_offline(array('qr_visibility' => 'private')), 'qr_transfer_receipt', 'Offline cannot bypass the receipt public lock');
setae_claim_assert(setae_transfer_state() === $before, 'Offline receipt refusals do not alter ordinary data');

// Collection editing consumes the owner list directly; list/detail/QR values must agree.
setae_settings_seed('basic', true);
update_post_meta(201, Setae_QR_Manager::PUBLIC_META, '1');
$other = setae_transfer_fixture_animal(22);
$receipt = setae_transfer_fixture_animal(11, 'transfer_receipt', true);
$api = new Setae_API_Spiders();
$list = $api->get_my_spiders(new Setae_Claim_Fixture_Request(array('scope' => 'all')))->get_data();
$items = array_column($list, null, 'id');
$detail = setae_fixture_invoke($api, 'get_spider_data_array', 201);
foreach (array('qr_visibility', 'qr_public', 'transfer_enabled', 'transfer_receipt') as $key) {
    setae_claim_assert(array_key_exists($key, $items[201]) && $items[201][$key] === $detail[$key], 'Owner collection list supplies the same confirmed ' . $key . ' as detail');
}
setae_claim_assert(!isset($items[$other]) && $items[$receipt]['transfer_receipt'] === true && $items[$receipt]['qr_visibility'] === 'private', 'Owner list excludes other users and marks archived receipts read-only');
setae_claim_assert(Setae_QR_Manager::get_target_label_data(get_post(101))['transfer_receipt'] === false, 'Ordinary private QR target identifies a non-receipt explicitly');

echo "Transfer slot/provenance/label API, atomic-write and shared public-settings tests passed (actual QR/animal/offline + Entitlements; synthetic datastore)\n";
