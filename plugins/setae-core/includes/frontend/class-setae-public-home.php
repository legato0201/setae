<?php

/**
 * Loads the public marketing homepage without legacy dashboard resets.
 */
class Setae_Public_Home
{
    private $version;
    private static $public_surface_handle = '';

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function is_request()
    {
        return !is_admin()
            && is_front_page()
            && (!class_exists('Setae_App_Shell') || !Setae_App_Shell::is_app_page_request());
    }

    public function enqueue_styles()
    {
        if (!$this->is_request()) {
            return;
        }
        self::enqueue_foundation($this->version);
        wp_enqueue_style(
            'setae-public-home',
            SETAE_PLUGIN_URL . 'assets/css/public-home.css',
            array('setae-public-foundation'),
            $this->version
        );
        if (class_exists('Setae_Product_Events')) {
            wp_enqueue_script('setae-public-product-events', SETAE_PLUGIN_URL . 'assets/js/public-product-events.js', array(), $this->version, true);
            wp_add_inline_script('setae-public-product-events', 'window.SetaeProductEventsConfig = ' . wp_json_encode(Setae_Product_Events::public_config('home')) . ';', 'before');
        }
    }

    public static function enqueue_foundation($version)
    {
        wp_enqueue_style(
            'setae-public-foundation',
            SETAE_PLUGIN_URL . 'assets/css/public-foundation.css',
            array(),
            $version
        );
    }

    public static function enqueue_public_care_share($version)
    {
        self::enqueue_public_surface($version, 'care-share');
    }

    public static function enqueue_public_partner($version)
    {
        self::enqueue_public_surface($version, 'partner');
    }

    private static function enqueue_public_surface($version, $surface)
    {
        self::enqueue_foundation($version);
        Setae_Public_Registration::enqueue($version);
        $handle = 'setae-public-' . $surface;
        wp_enqueue_style(
            $handle,
            SETAE_PLUGIN_URL . 'assets/css/public-' . $surface . '.css',
            array('setae-public-foundation'),
            $version
        );
        wp_enqueue_script(
            'setae-public-share',
            SETAE_PLUGIN_URL . 'assets/js/public-share.js',
            array(),
            $version,
            true
        );
        wp_enqueue_script(
            $handle,
            SETAE_PLUGIN_URL . 'assets/js/public-' . $surface . '.js',
            array('setae-public-share'),
            $version,
            true
        );

        self::$public_surface_handle = $handle;
        $isolate = array(__CLASS__, 'isolate_public_surface_assets');
        add_action('wp_enqueue_scripts', $isolate, 1000);
        add_action('wp_print_styles', $isolate, 1000);
        add_action('wp_print_scripts', $isolate, 1000);
        add_action('wp_print_footer_scripts', $isolate, 0);
        self::isolate_public_surface_assets();
    }

    /** Remove only assets whose registered source belongs to this plugin. */
    public static function isolate_public_surface_assets()
    {
        if (!self::$public_surface_handle) {
            return;
        }
        global $wp_styles, $wp_scripts;
        $allowed_styles = array('setae-public-foundation', 'setae-public-registration', self::$public_surface_handle);
        $allowed_scripts = array('setae-public-registration', 'setae-public-share', 'setae-public-product-events', self::$public_surface_handle);
        foreach (array('style' => $wp_styles, 'script' => $wp_scripts) as $type => $registry) {
            if (!is_object($registry)) {
                continue;
            }
            $allowed = $type === 'style' ? $allowed_styles : $allowed_scripts;
            foreach ((array) ($registry->queue ?? array()) as $handle) {
                $source = $registry->registered[$handle]->src ?? '';
                if (in_array($handle, $allowed, true) || !self::is_plugin_asset_source($source)) {
                    continue;
                }
                if ($type === 'style') {
                    wp_dequeue_style($handle);
                } else {
                    wp_dequeue_script($handle);
                }
            }
        }
    }

    private static function is_plugin_asset_source($source)
    {
        if (!is_string($source) || $source === '') {
            return false;
        }
        $plugin = parse_url(SETAE_PLUGIN_URL);
        $asset = parse_url($source);
        if (!is_array($plugin) || !is_array($asset)) {
            return false;
        }
        // A similar path on another origin is not evidence of plugin ownership.
        if (!empty($asset['host'])) {
            if (empty($plugin['host']) || strcasecmp($asset['host'], $plugin['host']) !== 0) {
                return false;
            }
            $scheme = strtolower($plugin['scheme'] ?? 'https');
            if (!empty($asset['scheme']) && strtolower($asset['scheme']) !== $scheme) {
                return false;
            }
            $default_port = $scheme === 'https' ? 443 : 80;
            if (($asset['port'] ?? $default_port) !== ($plugin['port'] ?? $default_port)) {
                return false;
            }
        }
        $plugin_path = rtrim($plugin['path'] ?? '', '/') . '/';
        return $plugin_path !== '/' && strpos($asset['path'] ?? '', $plugin_path) === 0;
    }

    public static function enqueue_public_profile($version)
    {
        self::enqueue_foundation($version);
        Setae_Public_Registration::enqueue($version);
        wp_enqueue_style(
            'setae-public-profile',
            SETAE_PLUGIN_URL . 'assets/css/public-profile.css',
            array('setae-public-foundation'),
            $version
        );
        wp_enqueue_script(
            'setae-public-profile',
            SETAE_PLUGIN_URL . 'assets/js/public-profile.js',
            array(),
            $version,
            true
        );
    }

    public static function enqueue_passport($version)
    {
        self::enqueue_foundation($version);
        Setae_Public_Registration::enqueue($version);
        wp_enqueue_style(
            'setae-public-passport',
            SETAE_PLUGIN_URL . 'assets/css/public-passport.css',
            array('setae-public-foundation'),
            $version
        );
        wp_enqueue_script(
            'setae-public-passport',
            SETAE_PLUGIN_URL . 'assets/js/public-passport.js',
            array(),
            $version,
            true
        );
    }

    public function body_classes($classes)
    {
        if ($this->is_request()) {
            $classes[] = 'setae-public-home-page';
        }
        return $classes;
    }
}
