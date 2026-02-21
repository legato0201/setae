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

        // ▼ 追加: Stripe決済コントローラーの登録
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-stripe.php';
        $api_stripe = new Setae_API_Stripe();
        $api_stripe->register_routes();
    }
}
