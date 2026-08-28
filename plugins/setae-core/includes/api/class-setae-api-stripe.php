<?php

class Setae_API_Stripe
{
    private $stripe_secret_key;
    private $webhook_secret;
    private $stripe_client;

    public function __construct($stripe_client = null)
    {
        $this->stripe_secret_key = trim((string) get_option('setae_stripe_secret_key', ''));
        $this->webhook_secret = trim((string) get_option('setae_stripe_webhook_secret', ''));
        $this->stripe_client = $stripe_client;
        if (!$this->stripe_client && class_exists('\\Stripe\\StripeClient') && $this->stripe_secret_key !== '') {
            $this->stripe_client = new \Stripe\StripeClient($this->stripe_secret_key);
        }
    }

    public function register_routes()
    {
        foreach (array('create-checkout-session' => 'create_checkout_session', 'create-portal-session' => 'create_portal_session') as $route => $callback) {
            register_rest_route('setae/v1', '/stripe/' . $route, array(
                'methods' => 'POST', 'callback' => array($this, $callback),
                'permission_callback' => function () { return is_user_logged_in(); },
            ));
        }
        register_rest_route('setae/v1', '/stripe/webhook', array(
            'methods' => 'POST', 'callback' => array($this, 'handle_webhook'),
            'permission_callback' => '__return_true',
        ));
    }

    public function create_checkout_session($request)
    {
        // Keep old clients working, but never fall back to a legacy Price.
        $plan = $request->get_param('plan');
        if ($plan !== null && $plan !== 'breeder_starter') {
            return new WP_Error('plan_not_available', 'このプランはお申し込みいただけません。', array('status' => 400));
        }
        $user_id = get_current_user_id();
        if (!$user_id) {
            return new WP_Error('rest_not_logged_in', 'ログインしてください。', array('status' => 401));
        }
        return Setae_Entitlements::with_user_lock($user_id, function () use ($user_id, $request) {
            $current_plan = Setae_Entitlements::get_plan_id($user_id);
            $status = (string) get_user_meta($user_id, '_setae_plan_status', true);
            $customer = (string) get_user_meta($user_id, '_setae_stripe_customer_id', true);
            $subscription = (string) get_user_meta($user_id, '_setae_stripe_subscription_id', true);
            if (in_array($current_plan, array('breeder_starter', 'legacy_premium'), true)
                || ($subscription !== '' && in_array($status, array('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'), true))) {
                return $customer !== '' ? $this->create_portal_session($request)
                    : new WP_Error('plan_already_active', '現在のプランは有効です。重複して契約する必要はありません。', array('status' => 409, 'action' => 'settings'));
            }
            $error = $this->get_configuration_error();
            if (is_wp_error($error)) {
                return $error;
            }
            if (!Setae_Billing::starter_configuration()['available']) {
                return new WP_Error('stripe_price_missing', 'Breeder Starterは現在準備中です。', array('status' => 503));
            }
            $user = get_userdata($user_id);
            if (!$user || empty($user->user_email)) {
                return new WP_Error('stripe_user_missing', 'アカウント情報を確認できませんでした。', array('status' => 400));
            }
            try {
                if ($customer !== '') {
                    // Missing webhook state must not create another subscription.
                    $subscriptions = $this->stripe_client->subscriptions->all(array('customer' => $customer, 'status' => 'all', 'limit' => 100));
                    foreach ($subscriptions->data as $existing) {
                        if (in_array($existing->status, array('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'), true)) {
                            return $this->create_portal_session($request);
                        }
                    }
                    if (!empty($subscriptions->has_more)) {
                        return new WP_Error('billing_review_required', '契約情報の確認が必要です。契約管理からご確認ください。', array('status' => 409, 'action' => 'portal'));
                    }
                }
                $attempt = get_user_meta($user_id, '_setae_checkout_attempt', true);
                if ($attempt !== '' && (!is_array($attempt) || empty($attempt['request']) || empty($attempt['started_at'])
                    || !preg_match('/^[a-f0-9]{32}$/', (string) ($attempt['id'] ?? '')))) {
                    return new WP_Error('billing_review_required', 'お申し込み情報の確認が必要です。管理者へお問い合わせください。', array('status' => 409));
                }
                if (!empty($attempt['session_id'])) {
                    $cached = $this->stripe_client->checkout->sessions->retrieve($attempt['session_id'], array());
                    if ($cached->status === 'open' && !empty($cached->url) && (int) $cached->expires_at > time()) {
                        return new WP_REST_Response(array('url' => $cached->url, 'reused' => true), 200);
                    }
                    if ($cached->status === 'complete') {
                        $cached_subscription = Setae_Billing::object_id($cached->subscription ?? '');
                        if ($subscription === '' || $subscription !== $cached_subscription || !in_array($status, array('canceled', 'incomplete_expired'), true)) {
                            return new WP_Error('billing_sync_pending', 'お申し込みを確認しています。少し待って設定画面を開き直してください。', array('status' => 409, 'action' => 'settings'));
                        }
                    }
                    if (!in_array($cached->status, array('expired', 'complete'), true)) {
                        return new WP_Error('billing_sync_pending', 'お申し込みの状態を確認しています。少し待って再度お試しください。', array('status' => 409));
                    }
                    // Replace the whole attempt atomically, only after a definite end.
                    $attempt = '';
                } elseif ($attempt !== '' && (int) $attempt['started_at'] < time() - 23 * 3600) {
                    // Stripe can prune idempotency keys after 24h. Never guess that an unknown attempt failed.
                    return new WP_Error('billing_review_required', '前回のお申し込み情報の確認が必要です。管理者へお問い合わせください。', array('status' => 409));
                }
                if ($attempt === '') {
                    $attempt_id = bin2hex(random_bytes(16));
                    $metadata = array('setae_user_id' => (string) $user_id, 'setae_plan_id' => 'breeder_starter', 'setae_checkout_attempt_id' => $attempt_id);
                    $args = array(
                        'payment_method_types' => array('card'),
                        'line_items' => array(array('price' => trim((string) get_option('setae_stripe_price_breeder_starter', '')), 'quantity' => 1)),
                        'mode' => 'subscription', 'client_reference_id' => (string) $user_id,
                        'metadata' => $metadata, 'subscription_data' => array('metadata' => $metadata), 'locale' => 'ja',
                        'success_url' => add_query_arg(array('upgrade' => 'success'), Setae_App_Shell::app_url()),
                        'cancel_url' => add_query_arg(array('upgrade' => 'canceled'), Setae_App_Shell::app_url()),
                        'expires_at' => time() + 3600,
                    );
                    $args[$customer !== '' ? 'customer' : 'customer_email'] = $customer !== '' ? $customer : $user->user_email;
                    $attempt = array('id' => $attempt_id, 'started_at' => time(), 'session_id' => '', 'request' => $args);
                    if (!$this->save_checkout_attempt($user_id, $attempt)) {
                        return new WP_Error('stripe_attempt_write_failed', 'お申し込み情報を保存できませんでした。時間をおいてお試しください。', array('status' => 503));
                    }
                }
                $session = $this->stripe_client->checkout->sessions->create($attempt['request'], array('idempotency_key' => 'setae-starter-' . $user_id . '-' . $attempt['id']));
                if (empty($session->id)) {
                    throw new RuntimeException('Checkout response unavailable.');
                }
                $attempt['session_id'] = (string) $session->id;
                if (!$this->save_checkout_attempt($user_id, $attempt)) {
                    return new WP_Error('stripe_session_write_failed', 'お申し込みの準備を確認しています。少し待って再度お試しください。', array('status' => 503));
                }
                if ($session->status === 'complete') {
                    return new WP_Error('billing_sync_pending', 'お申し込みを確認しています。少し待って設定画面を開き直してください。', array('status' => 409));
                }
                if ($session->status !== 'open' || empty($session->url) || (int) $session->expires_at <= time()) {
                    return new WP_Error('stripe_checkout_expired', '決済画面の期限が終了しました。もう一度お申し込みください。', array('status' => 409));
                }
                if (class_exists('Setae_Product_Events')) {
                    Setae_Product_Events::record('checkout_started', array(
                        'idempotency_key' => 'checkout:' . hash('sha256', $session->id), 'user_id' => $user_id,
                        'object_type' => 'subscription', 'properties' => array('plan' => 'breeder_starter'),
                    ));
                }
                return new WP_REST_Response(array('url' => $session->url), 200);
            } catch (Throwable $error) {
                $this->log_error('checkout_session', $error);
                return new WP_Error('stripe_checkout_failed', '決済画面を準備できませんでした。時間をおいてお試しください。', array('status' => 502));
            }
        });
    }

    public function create_portal_session($request)
    {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return new WP_Error('rest_not_logged_in', 'ログインしてください。', array('status' => 401));
        }
        $customer = (string) get_user_meta($user_id, '_setae_stripe_customer_id', true);
        if ($customer === '') {
            return new WP_Error('no_customer', 'Stripeの契約情報が見つかりません。', array('status' => 400));
        }
        $error = $this->get_configuration_error();
        if (is_wp_error($error)) {
            return $error;
        }
        try {
            $session = $this->stripe_client->billingPortal->sessions->create(array(
                'customer' => $customer, 'return_url' => Setae_App_Shell::app_url(), 'locale' => 'ja',
            ));
            if (empty($session->url)) {
                throw new RuntimeException('Portal response unavailable.');
            }
            return new WP_REST_Response(array('url' => $session->url, 'portal' => true), 200);
        } catch (Throwable $error) {
            $this->log_error('portal_session', $error);
            return new WP_Error('stripe_portal_failed', '契約管理画面を準備できませんでした。時間をおいてお試しください。', array('status' => 502));
        }
    }

    public function handle_webhook($request)
    {
        if (!class_exists('\\Stripe\\Webhook') || $this->webhook_secret === '') {
            return new WP_Error('stripe_webhook_unavailable', 'Webhook is not configured.', array('status' => 503));
        }
        try {
            $event = \Stripe\Webhook::constructEvent($request->get_body(), $request->get_header('stripe-signature'), $this->webhook_secret);
        } catch (\UnexpectedValueException | \Stripe\Exception\SignatureVerificationException $error) {
            $this->log_error('webhook_verification', $error);
            return new WP_Error('webhook_error', 'Invalid payload or signature.', array('status' => 400));
        }
        $handled = array('checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
            'customer.subscription.deleted', 'invoice.payment_succeeded', 'invoice.paid', 'invoice.payment_failed');
        if (!in_array($event->type, $handled, true)) {
            return new WP_REST_Response(array('status' => 'ignored'), 200);
        }
        $error = $this->get_configuration_error();
        if (is_wp_error($error)) {
            return $error;
        }
        $claim = Setae_Billing_Events::claim($event->id);
        if (is_wp_error($claim)) {
            return $claim;
        }
        if ($claim['duplicate']) {
            return new WP_REST_Response(array('status' => 'success', 'duplicate' => true), 200);
        }
        try {
            $subscription_id = Setae_Billing::subscription_id($event->type, $event->data->object);
            $result = array('ignored' => true);
            if ($subscription_id !== '') {
                $subscription = $this->stripe_client->subscriptions->retrieve($subscription_id, array());
                $user_id = Setae_Billing::resolve_user($subscription);
                $result = $user_id ? Setae_Entitlements::with_user_lock($user_id, function () use ($user_id, $subscription_id, $event) {
                    // Re-read inside the user lock: distinct events may arrive out of order.
                    $current = $this->stripe_client->subscriptions->retrieve($subscription_id, array());
                    return Setae_Billing::sync_subscription($current, $user_id, $event->id, $event->type);
                }) : new WP_Error('stripe_identity_unresolved', 'Subscription identity needs review.', array('status' => 409));
            }
            $finished = Setae_Billing_Events::finish($event->id, $claim['token'], !is_wp_error($result));
            if (is_wp_error($result)) {
                return $result;
            }
            if (!$finished) {
                return new WP_Error('stripe_inbox_write_failed', 'Webhook completion could not be saved.', array('status' => 503));
            }
            return new WP_REST_Response(array('status' => 'success', 'review_required' => !empty($result['review_required'])), 200);
        } catch (Throwable $error) {
            Setae_Billing_Events::finish($event->id, $claim['token'], false);
            $this->log_error('webhook_processing', $error);
            return new WP_Error('stripe_webhook_retry', 'Subscription synchronization failed. Retry later.', array('status' => 503));
        }
    }

    private function get_configuration_error()
    {
        if (!class_exists('\\Stripe\\StripeClient') || $this->stripe_secret_key === '' || !$this->stripe_client) {
            return new WP_Error('stripe_unavailable', '決済機能は現在準備中です。', array('status' => 503));
        }
        return null;
    }

    private function save_checkout_attempt($user_id, array $attempt)
    {
        // One private meta value keeps the retry key, exact parameters and session consistent.
        // This is billing state only: it is never returned by profile APIs or product events.
        update_user_meta($user_id, '_setae_checkout_attempt', $attempt);
        return get_user_meta($user_id, '_setae_checkout_attempt', true) === $attempt;
    }

    private function log_error($context, Throwable $error)
    {
        // Stripe exceptions can include customer data and credentials.
        error_log('[Setae Stripe] ' . $context . ': ' . get_class($error));
    }
}
