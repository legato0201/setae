<?php

require_once __DIR__ . '/helpers/entitlements-fixture.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-spiders.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-offline.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-baby-groups.php';
require_once dirname(__DIR__) . '/includes/class-setae-app-operations.php';
require_once dirname(__DIR__) . '/includes/class-setae-billing.php';

$api = new Setae_API_Spiders();
$manual = new Entitlement_Request(array('classification' => 'other', 'custom_species' => 'Fixture species', 'name' => 'Fixture'));
for ($i = 0; $i < 8; $i++) {
    $created = $api->create_spider($manual);
    fixture_assert($created instanceof WP_REST_Response && $created->status === 201, 'Each of the first eight manual specimens must save.');
    fixture_assert(get_post_meta($created->data['id'], Setae_Entitlements::SOURCE_META, true) === 'manual', 'Normal create must stamp the trusted source.');
    fixture_assert(!$wpdb->held, 'Every successful creation must release the database lock.');
}
$before = count($GLOBALS['ent_posts']);
$denied = $api->create_spider($manual);
fixture_error($denied, 'setae_manual_specimen_limit', 'The ninth manual specimen must be denied.');
fixture_assert(count($GLOBALS['ent_posts']) === $before, 'Denied create must not insert a post.');
foreach (array('status', 'reason', 'plan_id', 'usage', 'limit', 'trial_available', 'upgrade_plan') as $key) {
    fixture_assert(array_key_exists($key, $denied->get_error_data()), 'Denial must carry actionable plan data: ' . $key);
}
fixture_assert($denied->get_error_data()['status'] === 403 && $denied->get_error_data()['usage'] === 8, 'Denial must describe the actual usage.');

// Lazy classification follows transfer/receipt/baby origin priority without bulk migration.
$received = fixture_post('setae_spider', 7, array('_setae_transferred_from_user' => 22));
$receipt = fixture_post('setae_spider', 7, array('_setae_transfer_receipt' => '1', '_setae_transferred_from_user' => 22));
$promoted = fixture_post('setae_spider', 7, array('_setae_baby_origin_group_id' => 4));
$legacy = fixture_post();
$classification_before = serialize($GLOBALS['ent_post_meta']);
fixture_assert(Setae_Entitlements::get_specimen_source($received) === 'transfer_received', 'Received specimens must classify as exempt.');
fixture_assert(Setae_Entitlements::get_specimen_source($receipt) === 'transfer_receipt', 'Receipt flag must take priority over transfer origin.');
fixture_assert(Setae_Entitlements::get_specimen_source($promoted) === 'nursery_promotion', 'Baby origin must classify as promotion.');
fixture_assert(Setae_Entitlements::get_specimen_source($legacy) === 'legacy_manual', 'Unclassified existing inventory remains slot bearing.');
fixture_assert(serialize($GLOBALS['ent_post_meta']) === $classification_before, 'Fallback classification on reads must not mass-migrate existing inventory metadata.');
fixture_assert(Setae_Entitlements::is_slot_exempt_specimen($received) && Setae_Entitlements::is_slot_exempt_specimen($receipt), 'Both receiver specimen and sender receipt are exempt.');
fixture_assert(!is_wp_error(Setae_Entitlements::can_create_specimen(7, 'transfer_received', 30)), 'Receipt/transfer gates must remain allowed above the manual cap.');
update_post_meta($promoted, '_setae_spider_archived', '1');
update_post_meta($legacy, '_setae_status', 'dead');
$usage = Setae_Entitlements::get_inventory_usage(7);
fixture_assert($usage['active_slot_bearing'] === 8 && $usage['received_exempt'] === 1 && $usage['receipt_exempt'] === 1 && $usage['archived'] === 1 && $usage['inactive'] === 1, 'Only active slot-bearing specimens count.');
foreach (array('deceased', 'sold', 'rehomed', 'transferred', 'archived') as $status) { update_post_meta($legacy, '_setae_status', $status); fixture_assert(Setae_Entitlements::get_inventory_usage(7)['active_slot_bearing'] === 8, 'Terminal status must not consume active slots: ' . $status); }
foreach (array('normal', 'fasting', 'pre_molt', 'post_molt', 'unknown') as $status) { update_post_meta($legacy, '_setae_status', $status); fixture_assert(Setae_Entitlements::get_inventory_usage(7)['active_slot_bearing'] === 9, 'Care status is active, not archived: ' . $status); }
fixture_error(Setae_Entitlements::can_create_specimen(7, 'client_exempt'), 'setae_invalid_acquisition_source', 'Untrusted source enums must fail closed.');
fixture_error(Setae_Entitlements::can_create_specimen(7, 'manual', 1.5), 'setae_invalid_count', 'Fractional slot counts cannot bypass limits.');

fixture_reset();
$GLOBALS['ent_user_meta'][7] = array('_setae_is_premium' => 1, '_setae_stripe_customer_id' => 'cus_legacy_fixture', '_setae_premium_cancel_at' => time() - 1000);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'legacy_premium', 'Existing premium without plan must remain unlimited despite old expiry/customer-only metadata.');
fixture_assert(get_user_meta(7, '_setae_plan_id', true) === 'legacy_premium', 'Legacy classification must be saved lazily.');
fixture_assert(Setae_Entitlements::get_inventory_usage(7)['limit'] === -1 && !is_wp_error(Setae_Entitlements::can_promote_babies(7, 500)), 'Legacy users keep unlimited inventory and promotions.');
fixture_assert(!is_wp_error(Setae_Entitlements::can_export_label_batch(7, 500)), 'Legacy label entitlement stays unlimited.');
fixture_assert(get_user_meta(7, '_setae_billing_warning', true) === 'legacy_subscription_unlinked', 'Incomplete legacy billing must warn without stripping access.');

fixture_reset();
$GLOBALS['ent_options']['setae_free_spider_limit'] = 9;
update_user_meta(7, '_setae_bonus_spider_limit', 2);
fixture_assert(Setae_Entitlements::get_inventory_usage(7)['limit'] === 11, 'Existing configured free base and bonus must remain effective.');
$GLOBALS['ent_options']['setae_plan_limits'] = array('breeder_starter' => array('specimens' => 120));
update_user_meta(7, '_setae_plan_id', 'breeder_starter'); update_user_meta(7, '_setae_plan_status', 'active');
fixture_assert(Setae_Entitlements::get_inventory_usage(7)['limit'] === 122, 'Configured plan caps must retain the same bonus.');
fixture_assert(!is_wp_error(Setae_Entitlements::can_export_label_batch(7, 100)), 'Starter permits a hundred labels.');
fixture_error(Setae_Entitlements::can_export_label_batch(7, 101), 'setae_label_batch_limit', 'Starter must not exceed a hundred default labels.');
update_user_meta(7, '_setae_plan_status', 'past_due'); update_user_meta(7, '_setae_plan_grace_until', time() + 100);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'breeder_starter' && (int) get_user_meta(7, '_setae_is_premium', true) === 1, 'Past-due grace keeps Starter access.');
update_user_meta(7, '_setae_plan_grace_until', time() - 1);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'keeper_free' && (int) get_user_meta(7, '_setae_is_premium', true) === 0, 'Expired grace returns only permissions to free.');
fixture_error(Setae_Entitlements::can_promote_babies(7), 'setae_billing_past_due', 'Expired payment grace must offer an actionable billing reason.');
foreach (array('unpaid', 'canceled', 'incomplete_expired') as $status) { update_user_meta(7, '_setae_plan_status', $status); fixture_assert(Setae_Entitlements::get_plan_id(7) === 'keeper_free', 'Terminal billing status must not retain new paid operations.'); }

fixture_reset();
$groups = new Setae_API_Baby_Groups();
$group_request = new Entitlement_Request(array('name' => 'First group', 'count' => 3, 'prefix' => 'A', 'species_name' => 'Fixture species'));
$group = $groups->create_group($group_request);
fixture_assert($group instanceof WP_REST_Response && $group->status === 201, 'The first free nursery group must be creatable.');
fixture_error($groups->create_group(new Entitlement_Request(array('name' => 'Second', 'count' => 1, 'prefix' => 'B'))), 'setae_nursery_group_limit', 'Free must gate its second active group.');
fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group->data['id'], 'codes' => 'A001'))), 'setae_trial_required', 'Free promotion must require explicit trial confirmation.');
fixture_assert(get_user_meta(7, '_setae_breeder_trial_used', true) === '', 'A denied promotion must never auto-start trial.');
$trial = Setae_Entitlements::start_breeder_trial(7);
fixture_assert(!is_wp_error($trial) && $trial['active'] && $trial['used'] && !$trial['available'], 'Explicit start creates the one-time trial.');
fixture_assert((int) get_user_meta(7, '_setae_trial_ends_at', true) - (int) get_user_meta(7, '_setae_trial_started_at', true) === 30 * DAY_IN_SECONDS, 'Trial duration is exactly thirty days.');
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_trial_unavailable', 'Second start may not reset trial dates.');

// A later failure must preserve earlier successes and their lifetime counters.
$GLOBALS['ent_fail_insert']['setae_spider'] = 2;
$partial = $groups->promote_to_spiders(new Entitlement_Request(array('id' => $group->data['id'], 'codes' => 'A001-A003')));
fixture_error($partial, 'insert_failed', 'The injected second specimen failure must reach the caller.');
$changes = get_post_meta($group->data['id'], '_setae_baby_items', true);
fixture_assert(isset($changes['A001']['transferred_spider_id']) && !isset($changes['A002']), 'The first successful promotion must be committed before failure.');
fixture_assert((int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 1, 'Only the successful promotion consumes lifetime quota.');
$retry = $groups->promote_to_spiders(new Entitlement_Request(array('id' => $group->data['id'], 'codes' => 'A001-A003')));
fixture_assert($retry instanceof WP_REST_Response && count($retry->data['created']) === 2, 'Retry must skip the already-promoted first item.');
fixture_assert(count_user_posts(7, 'setae_spider') === 3 && (int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 3, 'Retry must neither duplicate specimens nor double count.');
foreach (get_posts(array('post_type' => 'setae_spider', 'fields' => 'ids')) as $id) { update_post_meta($id, '_setae_spider_archived', '1'); }
update_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, 20);
fixture_error(Setae_Entitlements::can_promote_babies(7), 'setae_trial_promotion_limit', 'Archiving must not reset the twenty-promotion lifetime limit.');
$post_snapshot = serialize($GLOBALS['ent_posts']);
update_user_meta(7, '_setae_trial_ends_at', time() - 1);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'keeper_free' && serialize($GLOBALS['ent_posts']) === $post_snapshot, 'Expiry must not change existing specimens/logs/groups.');
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_trial_unavailable', 'Expired trials cannot restart.');
fixture_error(Setae_Entitlements::can_promote_babies(7), 'setae_trial_expired', 'Expired trial must give the correct plan reason.');
fixture_assert(!is_wp_error(Setae_Entitlements::can_export_label_batch(7, 20)), 'Existing output remains available after expiry.');
fixture_error(Setae_Entitlements::can_export_label_batch(7, 21), 'setae_label_batch_limit', 'Free batching still caps twenty without denying individual output.');

fixture_reset();
$GLOBALS['ent_admins'] = array(7);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'legacy_premium', 'Administrators retain existing unlimited access.');
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_trial_unavailable', 'Administrator access must not consume a user trial.');
$GLOBALS['ent_users'][8] = (object) array('ID' => 8);
update_user_meta(8, '_setae_breeder_trial_used', 1); update_user_meta(8, Setae_Entitlements::TRIAL_PROMOTED_META, 20);
Setae_Entitlements::set_admin_plan(8, 'legacy_premium');
fixture_assert(Setae_Entitlements::get_plan_id(8) === 'legacy_premium' && (int) get_user_meta(8, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 20, 'Explicit admin override must preserve trial history.');
fixture_error(Setae_Entitlements::set_admin_plan(8, 'breeder_trial'), 'setae_invalid_plan', 'Admin form cannot restart trial via plan manipulation.');

fixture_reset();
fixture_assert(Setae_Entitlements::with_user_lock(7, function () { return Setae_Entitlements::with_user_lock(7, function () { return 'nested-value'; }); }) === 'nested-value', 'Nested business callbacks retain their return value.');
fixture_assert(count($wpdb->calls) === 2 && !$wpdb->held, 'A nested call must acquire/release the database lock only once.');
try { Setae_Entitlements::with_user_lock(7, function () { throw new RuntimeException('expected'); }); } catch (RuntimeException $error) { fixture_assert($error->getMessage() === 'expected', 'Exceptions must not be rewritten.'); }
fixture_assert(!$wpdb->held, 'Exception paths must release quota locks.');
$wpdb->unavailable = true;
$called = false;
$busy = Setae_Entitlements::with_user_lock(7, function () use (&$called) { $called = true; });
fixture_error($busy, 'setae_entitlement_lock_unavailable', 'Contended/unavailable locks fail closed.');
fixture_assert(!$called && $busy->get_error_data()['status'] === 503, 'A failed lock must not execute any write.');
$wpdb->unavailable = false;
for ($i = 0; $i < 8; $i++) { fixture_post(); }
fixture_error($api->create_spider($manual), 'setae_manual_specimen_limit', 'A request retried after another writer filled the final slot must re-read usage.');

fixture_reset();
Setae_Entitlements::register_hooks();
fixture_assert(count($GLOBALS['ent_hooks']) >= 6, 'Core REST and failure cleanup hooks must be installed.');
$request = new Entitlement_Request(array('meta' => array('_setae_acquisition_source' => 'transfer_received', '_setae_transfer_receipt' => 1, 'safe' => 'keep')));
$prepared = (object) array('post_type' => 'setae_spider', 'post_author' => 7);
fixture_assert(Setae_Entitlements::guard_core_rest_create($prepared, $request) === $prepared && count($wpdb->held) === 1, 'Core REST create must hold the same quota lock until insertion ends.');
fixture_assert($request->get_param('meta') === array('safe' => 'keep'), 'Core REST clients cannot spoof exempt acquisition provenance.');
Setae_Entitlements::release_core_rest_locks('nested-response', null, new Entitlement_Request());
fixture_assert(count($wpdb->held) === 1, 'Nested REST dispatch must not release the outer create lock.');
$id = fixture_post();
Setae_Entitlements::finish_core_rest_create(get_post($id), $request, true);
fixture_assert(!$wpdb->held && get_post_meta($id, Setae_Entitlements::SOURCE_META, true) === 'manual', 'Core REST success must stamp source and release lock.');
Setae_Entitlements::guard_core_rest_create($prepared, $request);
fixture_assert(Setae_Entitlements::release_core_rest_locks('failed-response', null, $request) === 'failed-response' && !$wpdb->held, 'Core REST insertion failure must release lock without replacing its response.');
$updated = (object) array('ID' => $id, 'post_type' => 'setae_spider', 'post_author' => 7);
for ($i = 0; $i < 10; $i++) { fixture_post(); }
fixture_assert(Setae_Entitlements::guard_core_rest_create($updated, $request) === $updated && !$wpdb->held, 'An over-limit user must still edit existing specimens.');
fixture_error(Setae_Entitlements::guard_core_rest_create($prepared, new Entitlement_Request()), 'setae_manual_specimen_limit', 'Core REST cannot bypass the cap.');

fixture_reset();
$offline = new Setae_API_Offline();
$create_offline = new ReflectionMethod($offline, 'create_spider');
$created = $create_offline->invoke($offline, -500, array('classification' => 'other', 'custom_species' => 'Fixture'), 7);
fixture_assert(is_array($created) && get_post_meta($created['server_id'], Setae_Entitlements::SOURCE_META, true) === 'manual', 'Offline inserts must use the same manual source and gate.');
for ($i = 0; $i < 7; $i++) { fixture_post(); }
$replayed = $create_offline->invoke($offline, -500, array(), 7);
fixture_assert(is_array($replayed) && $replayed['server_id'] === $created['server_id'], 'Offline duplicate must resolve before quota checks at full capacity.');
fixture_error($create_offline->invoke($offline, -501, array('custom_species' => 'Fixture'), 7), 'setae_manual_specimen_limit', 'A new offline operation cannot bypass the shared cap.');
fixture_assert(!$wpdb->held, 'All API test branches must finish without held quota locks.');

fixture_reset();
$GLOBALS['ent_fail_insert']['setae_spider'] = 1;
fixture_error($api->create_spider($manual), 'creation_failed', 'Failed normal inserts must not report creation success.');
fixture_assert(Setae_Entitlements::get_inventory_usage(7)['active_slot_bearing'] === 0 && !$wpdb->held && !Setae_Product_Events::$events, 'Failed creation cannot consume a slot or emit a saved event.');
$image_failure = $create_offline->invoke($offline, -777, array('classification' => 'other', 'custom_species' => 'Fixture', 'image_data' => 'invalid-image'), 7);
fixture_error($image_failure, 'invalid_image', 'Offline image failure must propagate.');
fixture_assert(Setae_Entitlements::get_inventory_usage(7)['active_slot_bearing'] === 0 && !Setae_Product_Events::$events, 'Rolled-back offline creation must free the slot and skip creation events.');

fixture_reset();
update_user_meta(7, '_setae_is_premium', 1);
$before_peek = serialize($GLOBALS['ent_user_meta']);
fixture_assert(Setae_Entitlements::peek_plan_id(7) === 'legacy_premium' && serialize($GLOBALS['ent_user_meta']) === $before_peek, 'Plan aggregation must share resolution without lazy migrations or warning writes.');

// Core block editor first save is an auto-draft UPDATE, not an ID-less create.
fixture_reset();
$draft_id = fixture_post('setae_spider', 7, array(), 'auto-draft');
for ($i = 0; $i < 8; $i++) { fixture_post(); }
$draft_request = new Entitlement_Request();
$draft = (object) array('ID' => $draft_id, 'post_type' => 'setae_spider', 'post_author' => 7, 'post_status' => 'publish');
fixture_error(Setae_Entitlements::guard_core_rest_create($draft, $draft_request), 'setae_manual_specimen_limit', 'Auto-draft publish cannot bypass the final-slot guard.');
update_post_meta(102, '_setae_spider_archived', '1');
fixture_assert(Setae_Entitlements::guard_core_rest_create($draft, $draft_request) === $draft, 'First save is allowed after a slot is available.');
wp_update_post(array('ID' => $draft_id, 'post_status' => 'publish'));
Setae_Entitlements::finish_core_rest_create(get_post($draft_id), $draft_request, false);
fixture_assert(get_post_meta($draft_id, Setae_Entitlements::SOURCE_META, true) === 'manual' && !$wpdb->held, 'Core UPDATE-based first save stamps source and releases its create lock.');

fixture_reset();
$GLOBALS['pagenow'] = 'post.php';
$classic_id = fixture_post('setae_spider', 7, array(), 'auto-draft');
$_POST = array('action' => 'editpost', 'post_ID' => $classic_id, '_wpnonce' => 'valid');
for ($i = 0; $i < 8; $i++) { fixture_post(); }
$classic_denied = false;
try { Setae_Entitlements::guard_classic_create(); } catch (RuntimeException $error) { $classic_denied = $error->getCode() === 403; }
fixture_assert($classic_denied && !$wpdb->held, 'Classic editor first save must be denied at the same cap and release its lock.');
update_post_meta(102, '_setae_spider_archived', '1');
Setae_Entitlements::guard_classic_create();
fixture_assert(count($wpdb->held) === 1, 'Classic editor must hold the user lock until the post is saved.');
wp_update_post(array('ID' => $classic_id, 'post_status' => 'publish'));
Setae_Entitlements::finish_classic_create($classic_id, get_post($classic_id), true, null);
fixture_assert(get_post_meta($classic_id, Setae_Entitlements::SOURCE_META, true) === 'manual' && !$wpdb->held, 'Classic first save must stamp the same source and release its lock.');
fixture_error(Setae_Entitlements::can_create_specimen(0), 'setae_auth_required', 'Anonymous user ID cannot claim an unused free allowance.');

// Real billing + entitlement classes (not the billing suite's entitlement stub).
fixture_reset();
$GLOBALS['ent_options']['setae_stripe_price_id'] = 'price_legacy_fixture';
update_user_meta(7, '_setae_is_premium', 1);
update_user_meta(7, '_setae_stripe_customer_id', 'cus_legacy_fixture');
$subscription = array('id' => 'sub_legacy_fixture', 'customer' => 'cus_legacy_fixture', 'status' => 'past_due',
    'metadata' => array('setae_user_id' => '7'), 'items' => array('data' => array(array('price' => array('id' => 'price_legacy_fixture')))));
$synced = Setae_Entitlements::with_user_lock(7, function () use ($subscription) { return Setae_Billing::sync_subscription($subscription, 7, 'evt_legacy_grace_fixture', 'customer.subscription.updated'); });
fixture_assert(is_array($synced) && Setae_Entitlements::get_plan_id(7) === 'legacy_premium' && Setae_Entitlements::get_plan_status(7) === 'past_due', 'Verified legacy past-due subscription stays unlimited during grace.');
$deadline = (int) get_user_meta(7, '_setae_plan_grace_until', true);
fixture_assert($deadline >= time() + 7 * DAY_IN_SECONDS - 2, 'Actual billing creates the default seven-day deadline.');
update_user_meta(7, '_setae_plan_grace_until', time() - 1);
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'keeper_free' && (int) get_user_meta(7, '_setae_is_premium', true) === 0, 'Verified legacy grace expires without needing another webhook.');
delete_user_meta(7, '_setae_billing_subscription_plan');
fixture_assert(Setae_Entitlements::get_plan_id(7) === 'legacy_premium', 'An unverified legacy/customer-only record must not be downgraded by incomplete dates.');

fixture_reset();
update_user_meta(7, '_setae_referral_code', 'fixture');
update_user_meta(7, '_setae_first_record_created_at', 1787880000);
update_user_meta(7, '_setae_stripe_current_period_end', 1790000000);
update_user_meta(7, '_setae_plan_grace_until', 1788000000);
update_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, 3);
$profile = Setae_App_Operations::get_profile(7);
foreach (array('plan', 'inventory', 'nursery', 'entitlements', 'trial', 'onboarding', 'is_premium', 'spider_count', 'spider_limit', 'bonus_limit') as $key) { fixture_assert(array_key_exists($key, $profile), 'Profile retains old fields and exposes structured state: ' . $key); }
fixture_assert($profile['plan']['current_period_end'] === '2026-09-21T14:13:20Z' && $profile['plan']['trial_promoted_count'] === 3, 'Plan dates and trial totals must be typed consistently.');
fixture_assert($profile['onboarding']['registered_at'] === '2026-08-01T00:00:00Z' && substr($profile['onboarding']['first_record_at'], -1) === 'Z', 'Onboarding timestamps must use UTC, not local day strings.');
fixture_assert($profile['plan']['billing_available'] === false && !isset($profile['plan']['price_id']), 'Unconfigured billing stays unavailable and never exposes provider IDs/secrets.');

// Partial metadata failures must not burn a trial, create an uncounted
// promotion, or leave an alive nursery code pointing at an orphan specimen.
function fixture_fail_next_meta($type, $key, $offset = 1) {
    $name = $type . ':' . $key;
    $GLOBALS['ent_fail_meta'][$name] = ($GLOBALS['ent_meta_write_count'][$name] ?? 0) + $offset;
}
function fixture_promotion_setup() {
    fixture_reset();
    $api = new Setae_API_Baby_Groups();
    $group = $api->create_group(new Entitlement_Request(array('name' => 'Atomic group', 'count' => 3, 'prefix' => 'A', 'species_name' => 'Fixture species', 'birth_date' => '2026-07-01')));
    fixture_assert($group instanceof WP_REST_Response, 'Atomic fixture group must save.');
    $id = $group->data['id'];
    update_post_meta($id, '_setae_baby_items', array('A001' => array('history' => array(
        array('type' => 'feed', 'date' => '2026-08-01', 'note' => '食餌 "確認"'),
        array('type' => 'pairing', 'date' => '2026-08-02', 'note' => ''),
    ), 'molts' => array('2026-07-28'))));
    fixture_assert(!is_wp_error(Setae_Entitlements::start_breeder_trial(7)), 'Atomic fixture trial must start.');
    return array($api, $id);
}
function fixture_business_snapshot() {
    return serialize(array($GLOBALS['ent_posts'], $GLOBALS['ent_post_meta'], $GLOBALS['ent_user_meta'], $GLOBALS['ent_terms']));
}
foreach (array('_setae_breeder_trial_used', '_setae_trial_started_at', '_setae_trial_ends_at', '_setae_plan_id', '_setae_plan_status') as $key) {
    fixture_reset();
    Setae_Entitlements::get_trial_state(7); // Complete the unrelated lazy free migration first.
    $before = fixture_business_snapshot();
    fixture_fail_next_meta('user', $key);
    fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_metadata_save_failed', 'Every partial trial write must be rejected: ' . $key);
    fixture_assert(fixture_business_snapshot() === $before && !Setae_Product_Events::$events, 'Failed trial must roll back all trial fields without an event: ' . $key);
    fixture_assert(Setae_Entitlements::get_trial_state(7)['available'] && !$wpdb->held && !$wpdb->transaction && !wp_suspend_cache_addition(), 'Failed trial remains retryable and releases transaction/cache/lock state.');
    fixture_assert(!is_wp_error(Setae_Entitlements::start_breeder_trial(7)), 'Retry after a rolled-back trial failure must succeed once.');
    fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_trial_unavailable', 'A recovered trial must still be one-time.');
}

foreach (array(
    'post:_setae_acquisition_source', 'post:_setae_owner_id', 'post:_setae_status',
    'post:_setae_baby_origin_group_id', 'post:_setae_baby_origin_group_name', 'post:_setae_baby_origin_code',
    'post:_setae_custom_species_name', 'post:_setae_management_start_date', 'post:_setae_baby_origin_birth_date',
    'post:_setae_last_molt_date', 'post:_setae_log_spider_id', 'post:_setae_log_type', 'post:_setae_log_date',
    'post:_setae_log_data', 'post:_setae_log_recorded_by_user_id', 'post:_setae_last_feed_date', 'post:_setae_last_pairing_date',
    'post:_setae_baby_items', 'post:_setae_trial_promotion_counted', 'user:_setae_trial_promoted_count',
) as $failure) {
    list($groups, $group_id) = fixture_promotion_setup();
    $before = fixture_business_snapshot(); $events_before = count(Setae_Product_Events::$events);
    list($type, $key) = explode(':', $failure, 2); fixture_fail_next_meta($type, $key);
    $failed = $groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')));
    fixture_assert(is_wp_error($failed), 'Metadata write failure must not be HTTP 201: ' . $failure);
    fixture_assert(fixture_business_snapshot() === $before, 'Failure must roll back new specimen/log/QR/terms/group and lifetime count: ' . $failure);
    fixture_assert(count(Setae_Product_Events::$events) === $events_before, 'An uncommitted promotion must not emit an event.');
    fixture_assert(!$wpdb->held && !$wpdb->transaction && !wp_suspend_cache_addition(), 'Failure must release all owned state.');
    fixture_assert(in_array(array($group_id, 'post_meta'), $GLOBALS['ent_cache_deletions'], true) && in_array(array(7, 'user_meta'), $GLOBALS['ent_cache_deletions'], true), 'Rollback must invalidate nursery and user metadata caches.');
    $retried = $groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')));
    fixture_assert($retried instanceof WP_REST_Response && count($retried->data['created']) === 1 && count_user_posts(7, 'setae_spider') === 1, 'Rollback retry must create exactly one specimen: ' . $failure);
    fixture_assert((int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 1, 'Recovered promotion consumes exactly one lifetime slot.');
    fixture_error($groups->bulk_update(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001', 'event' => 'alive', 'date' => '2026-08-28'))), 'item_transferred', 'The ordinary bulk route may not restore a promoted code to alive.');
}

foreach (array('post:_setae_baby_items', 'user:_setae_trial_promoted_count', 'post:_setae_trial_promotion_counted') as $failure) {
    list($groups, $group_id) = fixture_promotion_setup();
    list($type, $key) = explode(':', $failure, 2); fixture_fail_next_meta($type, $key, 2);
    fixture_assert(is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001-A003')))), 'The second item metadata failure must reach the caller.');
    $stored = get_post_meta($group_id, '_setae_baby_items', true);
    fixture_assert(count_user_posts(7, 'setae_spider') === 1 && isset($stored['A001']['transferred_spider_id']) && !isset($stored['A002']), 'Earlier commits survive a later rollback; the failed item does not.');
    fixture_assert((int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 1, 'Earlier commit and lifetime count stay consistent.');
    $retried = $groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001-A003')));
    fixture_assert($retried instanceof WP_REST_Response && count($retried->data['created']) === 2 && count_user_posts(7, 'setae_spider') === 3, 'Partial retry skips committed codes, including metadata-failure paths.');
    fixture_assert((int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 3, 'Partial retry does not double count.');
}

foreach (array('wp_users', 'wp_posts', 'wp_postmeta', 'wp_usermeta', 'wp_terms', 'wp_term_taxonomy', 'wp_term_relationships', 'wp_termmeta') as $table) {
    foreach (array('MyISAM', null) as $engine) {
        list($groups, $group_id) = fixture_promotion_setup();
        $before = fixture_business_snapshot(); $wpdb->engines[$table] = $engine;
        $starts_before = $wpdb->query_counts['START TRANSACTION'] ?? 0;
        fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001'))), 'setae_transaction_unsupported', 'Unknown/nontransactional table must fail closed: ' . $table);
        fixture_assert(fixture_business_snapshot() === $before && ($wpdb->query_counts['START TRANSACTION'] ?? 0) === $starts_before, 'Unsupported promotion must preserve business data without starting a transaction.');
    }
}
fixture_reset(); $wpdb->engines['wp_usermeta'] = null;
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_transaction_unsupported', 'Unknown trial storage engine cannot be assumed safe.');
fixture_assert(!metadata_exists('user', 7, '_setae_breeder_trial_used'), 'Unsupported storage must not consume a trial.');
foreach (array('SET TRANSACTION READ WRITE', 'START TRANSACTION', 'SAVEPOINT setae_entitlement_write', 'RELEASE SAVEPOINT setae_entitlement_write', 'COMMIT') as $sql) {
    list($groups, $group_id) = fixture_promotion_setup();
    $before = fixture_business_snapshot();
    $wpdb->fail_queries[$sql] = ($wpdb->query_counts[$sql] ?? 0) + 1;
    fixture_assert(is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'A failed transaction control statement cannot report success: ' . $sql);
    fixture_assert(fixture_business_snapshot() === $before && !$wpdb->held && !$wpdb->transaction && !wp_suspend_cache_addition(), 'Transaction failure must clean up state: ' . $sql);
}
foreach (array('autocommit', 'external_transaction') as $mode) {
    list($groups, $group_id) = fixture_promotion_setup();
    $before = fixture_business_snapshot();
    if ($mode === 'autocommit') { $wpdb->autocommit = '0'; } else { $wpdb->external_transaction = true; }
    fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001'))), 'setae_transaction_unavailable', 'An external/implicit transaction must not be committed by this operation.');
    fixture_assert(fixture_business_snapshot() === $before && !$wpdb->held, 'Rejecting a foreign transaction must not alter business state.');
}

list($groups, $group_id) = fixture_promotion_setup();
$wpdb->commit_applied_but_failed = true;
fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001'))), 'setae_transaction_commit_unconfirmed', 'An interrupted COMMIT acknowledgment must be reported as uncertain.');
fixture_assert(count_user_posts(7, 'setae_spider') === 1 && (int) get_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, true) === 1, 'A committed but unacknowledged operation retains its complete identity and count.');
fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001'))), 'no_eligible_codes', 'Retry after an uncertain committed result cannot duplicate it.');
fixture_reset(); $wpdb->commit_applied_but_failed = true;
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_transaction_commit_unconfirmed', 'Trial COMMIT acknowledgment failure must not report a confirmed save.');
fixture_error(Setae_Entitlements::start_breeder_trial(7), 'setae_trial_unavailable', 'A committed trial with lost acknowledgment is still one-time.');

list($groups, $group_id) = fixture_promotion_setup();
update_user_meta(7, Setae_Entitlements::TRIAL_PROMOTED_META, 19);
fixture_fail_next_meta('user', Setae_Entitlements::TRIAL_PROMOTED_META);
fixture_assert(is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'Final-slot counter failure must abort the entire promotion.');
fixture_assert(!is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'Retry may use the final slot once after rollback.');
fixture_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A002'))), 'setae_trial_promotion_limit', 'No cumulative slot may be bypassed after recovery.');

foreach (array('setae_spider', 'setae_log', 'taxonomy', 'qr') as $failure) {
    list($groups, $group_id) = fixture_promotion_setup();
    $before = fixture_business_snapshot();
    if ($failure === 'taxonomy') { $GLOBALS['ent_fail_terms'] = true; }
    elseif ($failure === 'qr') { Setae_QR_Manager::$promotion_fail_code = 'A001'; }
    else { $GLOBALS['ent_fail_insert'][$failure] = ($GLOBALS['ent_insert_count'][$failure] ?? 0) + 1; }
    fixture_assert(is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'Every failed insertion stage must abort: ' . $failure);
    fixture_assert(fixture_business_snapshot() === $before && !$wpdb->transaction, 'No orphaned posts, logs, terms or counters may remain after insertion failure.');
}

fixture_reset();
$id = fixture_post('setae_spider', 7, array(Setae_Entitlements::SOURCE_META => 'manual'));
fixture_fail_next_meta('post', Setae_Entitlements::SOURCE_META);
$GLOBALS['ent_cache']['post_meta'][$id] = array(Setae_Entitlements::SOURCE_META => 'transfer_received');
fixture_error(Setae_Entitlements::mark_specimen_source($id, 'transfer_received'), 'setae_metadata_save_failed', 'A stale cache cannot make a failed source write look successful.');
fixture_assert(Setae_Entitlements::get_specimen_source($id) === 'manual', 'Readback must use the persisted source, not the stale expected cache value.');
fixture_reset();
fixture_fail_next_meta('post', Setae_Entitlements::SOURCE_META);
fixture_error($api->create_spider($manual), 'setae_metadata_save_failed', 'Normal create must propagate a failed source stamp.');
fixture_assert(!get_posts(array('post_type' => 'setae_spider')), 'A failed normal source stamp must not leave a reported successful specimen.');

fixture_reset();
$id = fixture_post('setae_spider', 7, array('atomic_value' => 'old'));
update_user_meta(7, 'atomic_value', 'old');
$cache_result = Setae_Entitlements::with_transaction(array(7), function () use ($id) {
    fixture_assert($GLOBALS['wpdb']->reconnect_retries === 0, 'An owned transaction must not replay statements after reconnect.');
    Setae_Entitlements::save_post_meta_checked($id, array('atomic_value' => 'new'));
    Setae_Entitlements::save_user_meta_checked(7, array('atomic_value' => 'new'));
    // Simulate a third-party cache SET which ignores suspended cache additions.
    $GLOBALS['ent_cache']['post_meta'][$id] = array('atomic_value' => 'new');
    $GLOBALS['ent_cache']['user_meta'][7] = array('atomic_value' => 'new');
    return new WP_Error('fixture_abort');
});
fixture_error($cache_result, 'fixture_abort', 'Transaction rollback must retain the business error.');
fixture_assert(get_post_meta($id, 'atomic_value', true) === 'old' && get_user_meta(7, 'atomic_value', true) === 'old', 'Rollback must invalidate uncommitted metadata even from explicit cache SET.');
fixture_assert($wpdb->reconnect_retries === 5 && !wp_suspend_cache_addition(), 'Transaction completion restores caller reconnect/cache preferences.');
wp_suspend_cache_addition(true);
$nested = Setae_Entitlements::with_transaction(array(7), function () {
    return Setae_Entitlements::with_transaction(array(7), function () { throw new RuntimeException('Nested callback must never run.'); });
});
fixture_error($nested, 'setae_transaction_nested', 'A nested transaction cannot commit its parent.');
fixture_assert(wp_suspend_cache_addition() && $wpdb->reconnect_retries === 5, 'Pre-existing cache suspension must remain suspended after failure.');
wp_suspend_cache_addition(false);

foreach (array('post:_setae_baby_items', 'user:_setae_trial_promoted_count') as $statement) {
    list($groups, $group_id) = fixture_promotion_setup();
    $before = fixture_business_snapshot(); $wpdb->disconnect_on_meta = $statement;
    fixture_assert(is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'A connection loss must not continue the promotion on a new connection.');
    fixture_assert(fixture_business_snapshot() === $before && $wpdb->replayed_statements === 0 && $wpdb->reconnect_retries === 5, 'Connection loss rolls back server state without replaying a partial write or losing reconnect preferences.');
    $wpdb->connected = true; // A separate later request, not an automatic SQL retry.
    fixture_assert(!is_wp_error($groups->promote_to_spiders(new Entitlement_Request(array('id' => $group_id, 'codes' => 'A001')))), 'A later request can safely retry after a rolled-back disconnect.');
}
fixture_reset(); Setae_Entitlements::get_trial_state(7); $before = fixture_business_snapshot();
$wpdb->disconnect_on_meta = 'user:_setae_trial_ends_at';
fixture_assert(is_wp_error(Setae_Entitlements::start_breeder_trial(7)), 'A trial metadata connection loss must be reported.');
fixture_assert(fixture_business_snapshot() === $before && $wpdb->replayed_statements === 0, 'A trial cannot become used through an automatically replayed partial write.');
$wpdb->connected = true;
fixture_assert(!is_wp_error(Setae_Entitlements::start_breeder_trial(7)), 'A separate retry after trial disconnect can start once.');

echo "Entitlements and real creation-path tests passed\n";
