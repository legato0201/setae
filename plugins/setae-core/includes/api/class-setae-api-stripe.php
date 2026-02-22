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

        // ▼▼▼ 新規追加: カスタマーポータルセッション作成用エンドポイント ▼▼▼
        register_rest_route('setae/v1', '/stripe/create-portal-session', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_portal_session'),
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

        // ▼▼▼ 新規追加: オプションから実際の料金IDを取得 ▼▼▼
        $price_id = get_option('setae_stripe_price_id');
        if (empty($price_id)) {
            return new WP_Error('stripe_error', '料金ID（Price ID）が設定されていません。管理画面から設定してください。', ['status' => 500]);
        }
        // ▲▲▲ 新規追加ここまで ▲▲▲

        try {
            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'line_items' => [
                    [
                        // ▼▼▼ 修正: ダミー値を消し、変数に置き換え ▼▼▼
                        'price' => $price_id,
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

    // ▼▼▼ 新規追加: ポータルURLの生成メソッド ▼▼▼
    public function create_portal_session($request)
    {
        $user_id = get_current_user_id();

        // Checkout時に保存しておいたStripeの顧客IDを取得
        $customer_id = get_user_meta($user_id, '_setae_stripe_customer_id', true);

        if (!$customer_id) {
            return new WP_Error('no_customer', 'Stripeの顧客情報が見つかりません。', ['status' => 400]);
        }

        if (!class_exists('\Stripe\Stripe')) {
            return new WP_Error('stripe_missing', 'Stripe SDK is not loaded.', ['status' => 500]);
        }

        \Stripe\Stripe::setApiKey($this->stripe_secret_key);

        try {
            // カスタマーポータルのセッションを作成
            $session = \Stripe\BillingPortal\Session::create([
                'customer' => $customer_id,
                'return_url' => home_url('/dashboard'), // ユーザーがポータルから戻ってくる先のURL
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
                // 初回決済完了時
                $session = $event->data->object;
                $user_id = $session->client_reference_id; // セッション作成時に渡したユーザーID
                if ($user_id) {
                    update_user_meta($user_id, '_setae_is_premium', true);
                    // カスタマーポータル連携用にStripeのCustomerIDを保存
                    update_user_meta($user_id, '_setae_stripe_customer_id', $session->customer);
                }
                break;

            case 'customer.subscription.updated':
                // サブスクリプションの内容やステータスが更新された時（解約予約を含む）
                $subscription = $event->data->object;
                $users = get_users(['meta_key' => '_setae_stripe_customer_id', 'meta_value' => $subscription->customer]);

                if (!empty($users)) {
                    $user_id = $users[0]->ID;

                    // ステータスが active（有効）または trialing（トライアル中）の場合は権限を付与・維持
                    if (in_array($subscription->status, ['active', 'trialing'])) {
                        update_user_meta($user_id, '_setae_is_premium', true);

                        // 期間満了での解約が予約されているかチェック
                        if ($subscription->cancel_at_period_end) {
                            // 終了予定のUNIXタイムスタンプを保存
                            update_user_meta($user_id, '_setae_premium_cancel_at', $subscription->current_period_end);
                            update_user_meta($user_id, '_setae_stripe_cancel_at_period_end', true);
                        } else {
                            // 解約予約がキャンセル（再開）された場合はメタデータを削除
                            delete_user_meta($user_id, '_setae_premium_cancel_at');
                            update_user_meta($user_id, '_setae_stripe_cancel_at_period_end', false);
                        }

                    } else {
                        // past_due（支払い遅延）や unpaid（未払い）等になった場合は権限を剥奪
                        update_user_meta($user_id, '_setae_is_premium', false);
                        delete_user_meta($user_id, '_setae_premium_cancel_at');
                    }
                }
                break;

            case 'customer.subscription.deleted':
                // サブスク解約（期間満了での解約を含む）や支払い失敗による完全キャンセル時
                $subscription = $event->data->object;
                $users = get_users(['meta_key' => '_setae_stripe_customer_id', 'meta_value' => $subscription->customer]);

                if (!empty($users)) {
                    $user_id = $users[0]->ID;
                    // プレミアム権限を剥奪し、解約予定日データも削除
                    update_user_meta($user_id, '_setae_is_premium', false);
                    delete_user_meta($user_id, '_setae_premium_cancel_at');
                }
                break;

            case 'invoice.payment_succeeded':
                // 定期支払いが成功した時（サブスク更新時）
                $invoice = $event->data->object;
                if ($invoice->subscription) {
                    $users = get_users(['meta_key' => '_setae_stripe_customer_id', 'meta_value' => $invoice->customer]);
                    if (!empty($users)) {
                        update_user_meta($users[0]->ID, '_setae_is_premium', true);
                    }
                }
                break;

            case 'invoice.payment_failed':
                // 定期支払いが失敗した時
                $invoice = $event->data->object;
                if ($invoice->subscription) {
                    $users = get_users(['meta_key' => '_setae_stripe_customer_id', 'meta_value' => $invoice->customer]);
                    if (!empty($users)) {
                        // 支払い失敗時に権限を剥奪
                        // （※Stripe側のリトライ設定で猶予を持たせる場合は、ここでは剥奪せず、
                        // updatedイベントでステータスがpast_dueになった時に剥奪する設計でも可）
                        update_user_meta($users[0]->ID, '_setae_is_premium', false);
                    }
                }
                break;
        }

        return new WP_REST_Response(['status' => 'success'], 200);
    }
}
