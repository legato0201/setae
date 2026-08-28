<?php
/** Offline domain/API tests. Real Stripe signature verifier; no Stripe network calls. */
require_once dirname(__DIR__) . '/vendor/autoload.php';

class WP_Error {
    public $code; public $message; public $data;
    public function __construct($code, $message, $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Response {
    public $data; public $status;
    public function __construct($data, $status = 200) { $this->data = $data; $this->status = $status; }
}
$options = array('setae_stripe_secret_key' => 'sk_test_unit_fixture', 'setae_stripe_webhook_secret' => 'whsec_unit_fixture',
    'setae_stripe_price_breeder_starter' => 'price_starter', 'setae_stripe_price_id' => 'price_legacy');
$meta = array(); $current_user = 1;
function get_option($key, $default = false) { return $GLOBALS['options'][$key] ?? $default; }
function get_user_meta($id, $key, $single = true) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_user_meta($id, $key, $value) {
    if (($GLOBALS['fail_write_key'] ?? '') === $key) return false;
    if (!empty($GLOBALS['fail_session_save']) && $key === '_setae_checkout_attempt' && !empty($value['session_id'])) return false;
    $GLOBALS['meta'][$id][$key] = $value; return true;
}
function delete_user_meta($id, $key) { unset($GLOBALS['meta'][$id][$key]); return true; }
function get_current_user_id() { return $GLOBALS['current_user']; }
function is_user_logged_in() { return get_current_user_id() > 0; }
function get_userdata($id) { return $id > 0 && $id < 100 ? (object) array('ID' => $id, 'user_email' => 'fixture@example.test') : false; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function absint($value) { return abs((int) $value); }
function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
function get_users($args) {
    $ids = array();
    foreach ($GLOBALS['meta'] as $id => $values) { if (($values[$args['meta_key']] ?? '') === $args['meta_value']) $ids[] = $id; }
    return $ids;
}
class Setae_App_Shell { public static function app_url() { return 'https://example.test/app/'; } }
class Setae_Entitlements {
    public static function sync_legacy_state($uid) {
        if (!get_user_meta($uid, '_setae_plan_id', true)) {
            update_user_meta($uid, '_setae_plan_id', get_user_meta($uid, '_setae_is_premium', true) ? 'legacy_premium' : 'keeper_free');
        }
    }
    public static function get_plan_id($uid) { self::sync_legacy_state($uid); return get_user_meta($uid, '_setae_plan_id', true); }
    public static function with_user_lock($uid, $callback) { return $callback(); }
}
class Setae_Product_Events {
    public static $events = array();
    public static function record($name, $context) {
        self::$events[$context['idempotency_key']] = array('name' => $name, 'context' => $context);
        return array('accepted' => true);
    }
}
class BillingTestDB {
    public $prefix = 'wp_'; public $rows = array(); public $claims = 0;
    public function prepare($sql, ...$values) { return array($sql, $values); }
    public function get_var($prepared) { return $this->rows[$prepared[1][0]]['state'] ?? null; }
    public function query($prepared) {
        list($sql, $v) = $prepared;
        if (strpos($sql, 'INSERT IGNORE') === 0) {
            if (isset($this->rows[$v[0]])) return 0;
            $this->rows[$v[0]] = array('state' => 'pending', 'token' => '', 'until' => ''); return 1;
        }
        if (strpos($sql, "SET state='processing'") !== false) {
            $row = &$this->rows[$v[3]];
            if (!in_array($row['state'], array('pending', 'failed'), true) && !($row['state'] === 'processing' && $row['until'] < $v[4])) return 0;
            $row = array('state' => 'processing', 'token' => $v[0], 'until' => $v[1]); $this->claims++; return 1;
        }
        $row = &$this->rows[$v[3]];
        if ($row['token'] !== $v[4] || $row['state'] !== 'processing') return 0;
        $row['state'] = $v[0]; $row['token'] = ''; return 1;
    }
}
$wpdb = new BillingTestDB();
class StripeTestRequest {
    public $params; public $body; public $signature;
    public function __construct($params = array()) { $this->params = $params; }
    public function get_param($key) { return $this->params[$key] ?? null; }
    public function get_body() { return $this->body; }
    public function get_header($key) { return $this->signature; }
}
class StripeTestSessions {
    public $calls = array(); public $cached; public $is_portal = false; public $by_id = array(); public $by_key = array(); public $created = 0;
    public function create($args, $opts = array()) {
        $this->calls[] = array($args, $opts);
        $key = $opts['idempotency_key'] ?? '';
        if ($key !== '' && isset($this->by_key[$key])) {
            check($this->by_key[$key]['args'] === $args, 'idempotent replay uses the exact original request');
            return $this->by_key[$key]['session'];
        }
        $this->created++;
        $this->cached = (object) array('id' => 'cs_fixture_' . $this->created, 'url' => 'https://checkout.stripe.com/fixture', 'status' => 'open', 'expires_at' => time() + 3600);
        $this->by_id[$this->cached->id] = $this->cached;
        if ($key !== '') $this->by_key[$key] = array('args' => $args, 'session' => $this->cached);
        return $this->cached;
    }
    public function retrieve($id, $args) { return $this->by_id[$id] ?? $this->cached; }
}
class StripeTestSubscriptions {
    public $items = array(); public $retrievals = 0; public $fail = false;
    public function retrieve($id, $args) { $this->retrievals++; if ($this->fail) throw new RuntimeException('temporary'); return \Stripe\Subscription::constructFrom($this->items[$id]); }
    public function all($args) { return (object) array('data' => array(), 'has_more' => false); }
}
$client = (object) array('checkout' => (object) array('sessions' => new StripeTestSessions()),
    'billingPortal' => (object) array('sessions' => new StripeTestSessions()), 'subscriptions' => new StripeTestSubscriptions());
require_once dirname(__DIR__) . '/includes/db/class-setae-billing-events.php';
require_once dirname(__DIR__) . '/includes/class-setae-billing.php';
require_once dirname(__DIR__) . '/includes/api/class-setae-api-stripe.php';
$assertions = 0;
function check($value, $message) { $GLOBALS['assertions']++; if (!$value) throw new RuntimeException($message); }
function webhook_request($id, $type, $object) {
    $request = new StripeTestRequest();
    $request->body = json_encode(array('id' => $id, 'object' => 'event', 'type' => $type, 'data' => array('object' => $object)));
    $timestamp = time();
    $request->signature = 't=' . $timestamp . ',v1=' . hash_hmac('sha256', $timestamp . '.' . $request->body, 'whsec_unit_fixture');
    return $request;
}

$api = new Setae_API_Stripe($client);
check(is_wp_error($api->create_checkout_session(new StripeTestRequest(array('plan' => 'shop')))), 'unknown plan rejected');
$options['setae_stripe_price_breeder_starter'] = '';
check(is_wp_error($api->create_checkout_session(new StripeTestRequest())), 'missing starter price does not use legacy fallback');
check(count($client->checkout->sessions->calls) === 0, 'unconfigured checkout never calls Stripe');
$options['setae_stripe_price_breeder_starter'] = 'price_starter';
$checkout = $api->create_checkout_session(new StripeTestRequest(array('plan' => 'breeder_starter', 'price' => 'price_injected')));
check($checkout instanceof WP_REST_Response && $checkout->status === 200, 'configured checkout');
list($args, $call_options) = $client->checkout->sessions->calls[0];
check($args['line_items'][0]['price'] === 'price_starter', 'client Price injection ignored');
check($args['metadata']['setae_plan_id'] === 'breeder_starter' && $args['subscription_data']['metadata']['setae_user_id'] === '1', 'both metadata locations');
check(strpos($args['success_url'], '/app/') !== false && strpos($args['cancel_url'], '/dashboard') === false, 'canonical app return URLs');
check(!empty($call_options['idempotency_key']), 'checkout network retry idempotency key');
$again = $api->create_checkout_session(new StripeTestRequest());
check($again->data['reused'] && count($client->checkout->sessions->calls) === 1, 'double click reuses open checkout');

$subscription = array('id' => 'sub_fixture', 'object' => 'subscription', 'customer' => 'cus_fixture',
    'status' => 'active', 'metadata' => array('setae_user_id' => '1', 'setae_plan_id' => 'legacy_premium'),
    'items' => array('data' => array(array('price' => array('id' => 'price_starter'), 'current_period_end' => time() + 2592000))),
    'cancel_at_period_end' => false);
$client->subscriptions->items['sub_fixture'] = $subscription;
$valid = webhook_request('evt_started', 'checkout.session.completed', array('id' => 'cs_fixture', 'subscription' => 'sub_fixture'));
$invalid = clone $valid; $invalid->body .= ' ';
check(is_wp_error($api->handle_webhook($invalid)) && $wpdb->claims === 0, 'signature checked before inbox reservation');
check($api->handle_webhook($valid)->status === 200, 'verified checkout fetches subscription');
check(get_user_meta(1, '_setae_plan_id', true) === 'breeder_starter', 'verified Price wins over metadata plan');
check(get_user_meta(1, '_setae_is_premium', true) === 1, 'legacy flag written through');
$retrievals = $client->subscriptions->retrievals;
check($api->handle_webhook($valid)->data['duplicate'] === true, 'duplicate webhook acknowledged');
check($client->subscriptions->retrievals === $retrievals, 'duplicate does not apply state twice');
check(count(array_filter(Setae_Product_Events::$events, function ($e) { return $e['name'] === 'subscription_started'; })) === 1, 'subscription starts once');
$portal = $api->create_checkout_session(new StripeTestRequest());
check($portal->data['portal'] === true && count($client->checkout->sessions->calls) === 1, 'active subscriber goes to portal');
check($client->billingPortal->sessions->calls[0][0]['return_url'] === 'https://example.test/app/', 'portal returns to app');

$client->subscriptions->items['sub_fixture']['status'] = 'past_due';
$fail_write_key = '_setae_plan_grace_until';
$partial = webhook_request('evt_partial', 'customer.subscription.updated', $subscription);
check(is_wp_error($api->handle_webhook($partial)) && $wpdb->rows['evt_partial']['state'] === 'failed', 'partial entitlement meta write must be retried');
$fail_write_key = '';
check($api->handle_webhook($partial)->status === 200, 'partial meta write repaired on retry');
$failed = webhook_request('evt_failed', 'invoice.payment_failed', array('id' => 'in_fixture', 'parent' => array('subscription_details' => array('subscription' => 'sub_fixture'))));
check($api->handle_webhook($failed)->status === 200, 'new invoice parent shape supported');
$grace = get_user_meta(1, '_setae_plan_grace_until', true);
check($grace >= time() + 7 * 86400 - 2 && get_user_meta(1, '_setae_is_premium', true) === 1, 'payment failure keeps seven day grace');
check($api->handle_webhook(webhook_request('evt_pastdue', 'customer.subscription.updated', $subscription))->status === 200, 'authoritative latest state used');
check(get_user_meta(1, '_setae_plan_grace_until', true) === $grace, 'separate retries do not extend grace');
$client->subscriptions->items['sub_fixture']['status'] = 'unpaid';
$api->handle_webhook(webhook_request('evt_failed_terminal', 'invoice.payment_failed', array('subscription' => 'sub_fixture')));
check(get_user_meta(1, '_setae_is_premium', true) === 1, 'invoice failure alone never revokes');
$api->handle_webhook(webhook_request('evt_unpaid', 'customer.subscription.updated', $subscription));
check(get_user_meta(1, '_setae_plan_id', true) === 'keeper_free' && get_user_meta(1, '_setae_is_premium', true) === 0, 'authoritative unpaid returns to free');

$client->subscriptions->fail = true;
$retry = webhook_request('evt_retry', 'customer.subscription.updated', $subscription);
check(is_wp_error($api->handle_webhook($retry)) && $wpdb->rows['evt_retry']['state'] === 'failed', 'network failure leaves retryable inbox');
$client->subscriptions->fail = false;
$client->subscriptions->items['sub_fixture']['status'] = 'active';
check($api->handle_webhook($retry)->status === 200, 'failed webhook can be retried');
$client->subscriptions->items['sub_fixture']['cancel_at_period_end'] = true;
$api->handle_webhook(webhook_request('evt_cancel_scheduled', 'customer.subscription.updated', $subscription));
check(get_user_meta(1, '_setae_is_premium', true) === 1 && get_user_meta(1, '_setae_premium_cancel_at', true) > time(), 'scheduled cancellation retains access until actual end');
$client->subscriptions->items['sub_fixture']['status'] = 'canceled';
$api->handle_webhook(webhook_request('evt_deleted', 'customer.subscription.deleted', $subscription));
check(get_user_meta(1, '_setae_plan_id', true) === 'keeper_free', 'deleted subscription returns to free');

update_user_meta(2, '_setae_is_premium', 1);
update_user_meta(2, '_setae_stripe_customer_id', 'cus_legacy');
$legacy = $subscription; $legacy['id'] = 'sub_legacy'; $legacy['customer'] = 'cus_legacy';
$legacy['metadata'] = array('setae_user_id' => '2');
$legacy['items']['data'][0]['price']['id'] = 'price_unknown';
$result = Setae_Billing::sync_subscription($legacy, 2, 'evt_legacy', 'customer.subscription.updated');
check($result['review_required'] && get_user_meta(2, '_setae_plan_id', true) === 'legacy_premium', 'uncertain old subscription never downgraded');
$legacy['items']['data'][0]['price']['id'] = 'price_legacy';
Setae_Billing::sync_subscription($legacy, 2, 'evt_legacy_valid', 'customer.subscription.updated');
check(get_user_meta(2, '_setae_plan_id', true) === 'legacy_premium', 'recognized legacy price remains unlimited plan');
check(!isset(Setae_Product_Events::$events['subscription-started:2']), 'observing an old legacy subscription does not invent a new paid acquisition');
$lease = Setae_Billing_Events::claim('evt_lease');
check(is_wp_error(Setae_Billing_Events::claim('evt_lease')), 'concurrent event claim fails closed');
check(!Setae_Billing_Events::finish('evt_lease', 'incorrect', true), 'lease completion requires ownership');
$wpdb->rows['evt_lease']['until'] = '2000-01-01 00:00:00';
$recovered = Setae_Billing_Events::claim('evt_lease');
check(!is_wp_error($recovered) && $recovered['token'] !== $lease['token'], 'expired crash lease can be recovered');

// Exercise durable checkout recovery independently of the webhook fixture above.
$current_user = 10;
$recovery_client = (object) array('checkout' => (object) array('sessions' => new StripeTestSessions()),
    'billingPortal' => (object) array('sessions' => new StripeTestSessions()), 'subscriptions' => new StripeTestSubscriptions());
$recovery_api = new Setae_API_Stripe($recovery_client);
$fail_write_key = '_setae_checkout_attempt';
$write_failure = $recovery_api->create_checkout_session(new StripeTestRequest());
check(is_wp_error($write_failure) && $write_failure->code === 'stripe_attempt_write_failed', 'attempt save failure is explicit');
check(count($recovery_client->checkout->sessions->calls) === 0, 'never call Stripe without a durable retry key');
$fail_write_key = '';
check($recovery_api->create_checkout_session(new StripeTestRequest())->status === 200, 'retry after initial database failure succeeds');
$old_attempt = get_user_meta(10, '_setae_checkout_attempt', true);
$recovery_client->checkout->sessions->by_id[$old_attempt['session_id']]->status = 'expired';
$fail_session_save = true;
$session_failure = $recovery_api->create_checkout_session(new StripeTestRequest());
check(is_wp_error($session_failure) && $session_failure->code === 'stripe_session_write_failed', 'lost session save is retryable');
$pending_attempt = get_user_meta(10, '_setae_checkout_attempt', true);
check($pending_attempt['id'] !== $old_attempt['id'] && $pending_attempt['session_id'] === '', 'expired session and new key replaced together');
$fail_session_save = false;
$options['setae_stripe_price_breeder_starter'] = 'price_changed_after_attempt';
check($recovery_api->create_checkout_session(new StripeTestRequest())->status === 200, 'lost session response safely replayed');
$calls = $recovery_client->checkout->sessions->calls;
check($calls[1][1]['idempotency_key'] === $calls[2][1]['idempotency_key'], 'session save retry never changes the key');
check($calls[1][0] === $calls[2][0] && $calls[2][0]['line_items'][0]['price'] === 'price_starter', 'price changes do not mutate an uncertain request');
check($recovery_client->checkout->sessions->created === 2, 'only one replacement session created after expiration');
$recovered_subscription = $subscription;
$recovered_subscription['metadata'] = $pending_attempt['request']['subscription_data']['metadata'];
check(Setae_Billing::price_plan($recovered_subscription, 10)['plan'] === 'breeder_starter', 'original saved Price remains recognized after uncertain checkout replay');
$options['setae_stripe_price_breeder_starter'] = 'price_starter';
$complete_attempt = get_user_meta(10, '_setae_checkout_attempt', true);
$complete_session = $recovery_client->checkout->sessions->by_id[$complete_attempt['session_id']];
$complete_session->status = 'complete'; $complete_session->subscription = 'sub_finished';
$waiting = $recovery_api->create_checkout_session(new StripeTestRequest());
check(is_wp_error($waiting) && $waiting->code === 'billing_sync_pending', 'completed checkout blocks a second contract while webhook is pending');
update_user_meta(10, '_setae_stripe_subscription_id', 'sub_finished');
update_user_meta(10, '_setae_plan_status', 'canceled');
check($recovery_api->create_checkout_session(new StripeTestRequest())->status === 200, 'a confirmed ended subscription may subscribe again');
$unknown_attempt = get_user_meta(10, '_setae_checkout_attempt', true);
$unknown_attempt['session_id'] = ''; $unknown_attempt['started_at'] = time() - 24 * 3600;
update_user_meta(10, '_setae_checkout_attempt', $unknown_attempt);
$before_review = count($recovery_client->checkout->sessions->calls);
$review = $recovery_api->create_checkout_session(new StripeTestRequest());
check(is_wp_error($review) && $review->code === 'billing_review_required', 'unknown old attempt requires reconciliation, not a new charge');
check(count($recovery_client->checkout->sessions->calls) === $before_review, 'old unknown attempt makes no create call');

// An issued Checkout must still grant its paid plan after the offered Price changes.
$current_user = 20;
$price_client = (object) array('checkout' => (object) array('sessions' => new StripeTestSessions()),
    'billingPortal' => (object) array('sessions' => new StripeTestSessions()), 'subscriptions' => new StripeTestSubscriptions());
$price_api = new Setae_API_Stripe($price_client);
check($price_api->create_checkout_session(new StripeTestRequest())->status === 200, 'price-change fixture opens configured checkout');
$priced_attempt = get_user_meta(20, '_setae_checkout_attempt', true);
check($priced_attempt['request']['subscription_data']['metadata']['setae_checkout_attempt_id'] === $priced_attempt['id'], 'subscription carries the server-saved attempt identity');
$options['setae_stripe_price_breeder_starter'] = 'price_new_offer';
check($price_api->create_checkout_session(new StripeTestRequest())->data['reused'], 'open checkout remains reused after offer price change');
$paid_subscription = $subscription;
$paid_subscription['id'] = 'sub_offer_change';
$paid_subscription['customer'] = 'cus_offer_change';
$paid_subscription['metadata'] = $priced_attempt['request']['subscription_data']['metadata'];
$untrusted = $paid_subscription;
$untrusted['metadata']['setae_checkout_attempt_id'] = str_repeat('0', 32);
check(Setae_Billing::price_plan($untrusted, 20) === null, 'unknown Price plus mismatched attempt metadata grants nothing');
$untrusted = $paid_subscription;
$untrusted['metadata']['setae_user_id'] = '21';
check(Setae_Billing::price_plan($untrusted, 20) === null, 'another owner cannot reuse the trusted attempt');
$untrusted = $paid_subscription;
$untrusted['items']['data'][0]['price']['id'] = 'price_not_saved';
check(Setae_Billing::price_plan($untrusted, 20) === null, 'valid attempt metadata cannot authorize a different Price');
$price_client->subscriptions->items['sub_offer_change'] = $paid_subscription;
$paid_event = webhook_request('evt_offer_change', 'checkout.session.completed', array('subscription' => 'sub_offer_change'));
check($price_api->handle_webhook($paid_event)->status === 200, 'signed webhook recognizes the original authorized offer');
check(get_user_meta(20, '_setae_plan_id', true) === 'breeder_starter' && get_user_meta(20, '_setae_stripe_price_id', true) === 'price_starter', 'paying the older issued offer still activates Starter');
check($price_api->handle_webhook($paid_event)->data['duplicate'], 'price-change webhook remains idempotent');
check(count($price_client->checkout->sessions->calls) === 1, 'price change never creates a second checkout');
echo "PASS Stripe plans, real signature verification, retry inbox, status, grace, legacy and checkout contracts ({$assertions} assertions)\n";
