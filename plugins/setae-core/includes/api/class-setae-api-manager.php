<?php

/**
 * The manager for API routes.
 */
class Setae_API_Manager
{
    private $spiders_controller;
    // private $events_controller; // Future Use

    public function __construct()
    {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes()
    {
        // Load Controllers
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-spiders.php';
        require_once plugin_dir_path(__FILE__) . 'class-setae-api-species.php';
        // require_once plugin_dir_path(__FILE__) . 'class-setae-api-events.php'; // Phase 1 Step 3

        $this->spiders_controller = new Setae_API_Spiders();
        $this->spiders_controller->register_routes();

        $this->species_controller = new Setae_API_Species();
        $this->species_controller->register_routes();

        // Future:
        // $this->events_controller = new Setae_API_Events();
        // $this->events_controller->register_routes();
    }
}
