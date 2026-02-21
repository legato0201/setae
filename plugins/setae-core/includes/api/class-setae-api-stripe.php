<?php
class Setae_API_Stripe
{
    private $stripe_secret_key;
    private $webhook_secret;

    public function __construct()
    {
        // 管理画面の設定からStripe APIキーとWebhookシークレットを取得
        $this->stripe_secret_key = get_option('setae_stripe_secret_key');
        $this->webhook_secret = get_option('setae_stripe_webhook_secret');
        // \Stripe\Stripe::setApiKey($this->stripe_secret_key); // Requires Stripe PHP SDK
    }

    public function register_routes()
    {
        // 決済セッション作成用
        register_rest_route('setae/v1', '/stripe/create-checkout-session', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_checkout_session'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Webhook受信用のエンドポイント（Stripeからの通信なので認証なし）
        register_rest_route('setae/v1', '/stripe/webhook', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_webhook'),
            'permission_callback' => '__return_true',
        ));
    }

    // 決済画面のURLを生成する
    public function create_checkout_session($request)
    {
        $user_id = get_current_user_id();
        $user = get_userdata($user_id);

        if (!class_exists('\Stripe\Stripe')) {
            return new WP_Error('stripe_missing', 'Stripe SDK is not loaded.', ['status' => 500]);
        }
        \Stripe\Stripe::setApiKey($this->stripe_secret_key);

        try {
            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'line_items' => [
                    [
                        'price' => 'price_xxxxxxxxxxxxxx', // ステップ1で取得した料金ID
                        'quantity' => 1,
                    ]
                ],
                'mode' => 'subscription',
                'customer_email' => $user->user_email,
                'client_reference_id' => $user_id, // Webhookでユーザーを特定するためのID
                'success_url' => home_url('/dashboard?upgrade=success'),
                'cancel_url' => home_url('/dashboard?upgrade=canceled'),
            ]);

            return new WP_REST_Response(['url' => $session->url], 200);
        } catch (Exception $e) {
            return new WP_Error('stripe_error', $e->getMessage(), ['status' => 500]);
        }
    }

    // Webhookを受信し、権限を付与・剥奪する
    public function handle_webhook($request)
    {
        $payload = $request->get_body();
        $sig_header = $request->get_header('stripe-signature');

        if (!class_exists('\Stripe\Webhook')) {
            return new WP_Error('stripe_missing', 'Stripe SDK is not loaded.', ['status' => 500]);
        }

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $this->webhook_secret);
        } catch (\UnexpectedValueException | \Stripe\Exception\SignatureVerificationException $e) {
            return new WP_Error('webhook_error', 'Invalid payload or signature', ['status' => 400]);
        }

        // イベントごとの処理
        switch ($event->type) {
            case 'checkout.session.completed':
                $session = $event->data->object;
                $user_id = $session->client_reference_id; // セッション作成時に渡したユーザーID
                if ($user_id) {
                    update_user_meta($user_id, '_setae_is_premium', true);
                    // 必要に応じてStripeのCustomerIDも保存しておくとポータル連携で便利です
                    update_user_meta($user_id, '_setae_stripe_customer_id', $session->customer);
                }
                break;

            case 'customer.subscription.deleted':
                // サブスク解約や支払い失敗によるキャンセル時
                $subscription = $event->data->object;
                // customer ID から ユーザーを逆引きして権限を false にする処理
                $users = get_users(['meta_key' => '_setae_stripe_customer_id', 'meta_value' => $subscription->customer]);
                if (!empty($users)) {
                    update_user_meta($users[0]->ID, '_setae_is_premium', false);
                }
                break;
        }

        return new WP_REST_Response(['status' => 'success'], 200);
    }
}
