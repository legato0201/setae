<?php

/**
 * The manager for API routes.
 */
class Setae_API_Manager
{
    private $app_controller;
    private $spiders_controller;
    private $baby_groups_controller;
    private $species_controller;
    private $topics_controller;
    private $bl_controller; // ▼ 追加 // ▼ 追加
    private $social_controller;
    private $feeders_controller;
    private $enclosures_controller;
    private $tasks_controller;
    private $qr_controller;
    private $external_access_controller;
    private $pwa_controller;
    private $offline_controller;

    public function __construct()
    {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes()
    {
        // Load Controllers
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-app.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-spiders.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-baby-groups.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-species.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-topics.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-bl.php'; // ▼ 追加 // ▼ 追加
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-social.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-feeders.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-enclosures.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-tasks.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-qr.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-external-access.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-pwa.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-offline.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-plans.php';
        $plans_controller = new Setae_API_Plans();
        $plans_controller->register_routes();

        $this->app_controller = new Setae_API_App();
        $this->app_controller->register_routes();

        $this->pwa_controller = new Setae_API_PWA();
        $this->pwa_controller->register_routes();

        $this->offline_controller = new Setae_API_Offline();
        $this->offline_controller->register_routes();

        $this->qr_controller = new Setae_API_QR();
        $this->qr_controller->register_routes();

        $this->social_controller = new Setae_API_Social();
        $this->social_controller->register_routes();

        $this->spiders_controller = new Setae_API_Spiders();
        $this->spiders_controller->register_routes();

        $this->external_access_controller = new Setae_API_External_Access();
        $this->external_access_controller->register_routes();

        $this->feeders_controller = new Setae_API_Feeders();
        $this->feeders_controller->register_routes();

        $this->enclosures_controller = new Setae_API_Enclosures();
        $this->enclosures_controller->register_routes();

        $this->tasks_controller = new Setae_API_Tasks();
        $this->tasks_controller->register_routes();

        $this->baby_groups_controller = new Setae_API_Baby_Groups();
        $this->baby_groups_controller->register_routes();

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
