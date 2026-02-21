<?php

/**
 * The manager for API routes.
 */
class Setae_API_Manager
{
    private $spiders_controller;
    private $species_controller;
    private $topics_controller;
    private $bl_controller; // ▼ 追加 // ▼ 追加

    public function __construct()
    {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes()
    {
        // Load Controllers
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-spiders.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-species.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-topics.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-bl.php'; // ▼ 追加 // ▼ 追加

        $this->spiders_controller = new Setae_API_Spiders();
        $this->spiders_controller->register_routes();

        $this->species_controller = new Setae_API_Species();
        $this->species_controller->register_routes();

        // ▼ 追加: Topicsコントローラーの初期化と登録
        $this->topics_controller = new Setae_API_Topics();
        $this->topics_controller->register_routes();

        // ▼ 追加: BLコントローラーの登録
        $this->bl_controller = new Setae_API_BL();
        $this->bl_controller->register_routes();

        // ▼ 追加: StripeWebhook用エンドポイント定義
        register_rest_route('setae/v1', '/webhook/stripe', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_stripe_webhook'),
            'permission_callback' => '__return_true', // Stripeからのリクエストなので認証は内部で行う
        ));
    }

    // Webhookのハンドラー関数（抜粋）
    public function handle_stripe_webhook($request)
    {
        $payload = $request->get_body();
        $sig_header = $request->get_header('stripe-signature');
        $endpoint_secret = 'whsec_...'; // Stripeダッシュボードから取得

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $endpoint_secret);
        } catch (\UnexpectedValueException $e) {
            return new WP_Error('invalid_payload', 'Invalid payload', array('status' => 400));
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            return new WP_Error('invalid_signature', 'Invalid signature', array('status' => 400));
        }

        // イベントタイプに応じた処理
        switch ($event->type) {
            case 'checkout.session.completed':
            case 'invoice.payment_succeeded':
                // TODO: $eventから顧客のWordPress User IDを特定し、プレミアム権限を付与
                // update_user_meta($user_id, '_setae_is_premium', true);
                break;
            case 'customer.subscription.deleted':
                // TODO: サブスク解約時にプレミアム権限を剥奪
                // update_user_meta($user_id, '_setae_is_premium', false);
                break;
        }

        return new WP_REST_Response(array('success' => true), 200);
    }
}
