<?php

class Setae_Dashboard
{

    private $plugin_name;
    private $version;

    public function __construct($plugin_name, $version)
    {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
    }

    public function enqueue_styles()
    {
        // 1. Global (変数・リセット)
        wp_enqueue_style('setae-global', SETAE_PLUGIN_URL . 'assets/css/setae-global.css', array(), $this->version, 'all');

        // 2. Modules (機能ごとの分割ファイル)
        $deps = array('setae-global');

        wp_enqueue_style('setae-layout', SETAE_PLUGIN_URL . 'assets/css/modules/layout.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-cards', SETAE_PLUGIN_URL . 'assets/css/modules/cards.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-modals', SETAE_PLUGIN_URL . 'assets/css/modules/modals.css', $deps, $this->version, 'all');

        // 残りのビュー専用スタイル (Chat, Kanban, etc.)
        wp_enqueue_style('setae-views', SETAE_PLUGIN_URL . 'assets/css/modules/views.css', $deps, $this->version, 'all');
    }

    public function enqueue_scripts()
    {
        // Chart.js (CDN)
        wp_enqueue_script('chart-js', 'https://cdn.jsdelivr.net/npm/chart.js', array(), null, true);

        // Enqueue Core Module
        wp_enqueue_script('setae-app-core', SETAE_PLUGIN_URL . 'assets/js/modules/app-core.js', array('jquery', 'chart-js'), $this->version, true);

        // Localize Script for Core (Pass API Root, Nonce, etc.)
        wp_localize_script('setae-app-core', 'SetaeSettings', array(
            'api_root' => esc_url_raw(rest_url()),
            'nonce' => wp_create_nonce('wp_rest')
        ));

        // Enqueue API Module (Depends on Core)
        wp_enqueue_script('setae-app-api', SETAE_PLUGIN_URL . 'assets/js/modules/app-api.js', array('jquery', 'setae-app-core'), $this->version, true);

        // Enqueue UI Modules (Split Refactoring)
        $ui_deps = array('jquery', 'setae-app-core', 'setae-app-api');

        // 1. Logic Sub-Modules
        wp_enqueue_script('setae-ui-actions', SETAE_PLUGIN_URL . 'assets/js/modules/ui/actions.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-detail', SETAE_PLUGIN_URL . 'assets/js/modules/ui/detail.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-list', SETAE_PLUGIN_URL . 'assets/js/modules/ui/list.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-log-modal', SETAE_PLUGIN_URL . 'assets/js/modules/ui/log-modal.js', $ui_deps, $this->version, true);

        // 1.5 Desktop Specific Logic
        wp_enqueue_script('setae-ui-desktop', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-desktop.js', array('setae-ui-actions', 'jquery'), $this->version, true);

        // 2. Controller (Renderer)
        wp_enqueue_script('setae-app-ui-renderer', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-renderer.js', array('setae-ui-actions', 'setae-ui-detail', 'setae-ui-list', 'setae-ui-log-modal'), $this->version, true);

        // 3. Main App Entry
        wp_enqueue_script('setae-app-main', SETAE_PLUGIN_URL . 'assets/js/setae-app.js', array('setae-app-ui-renderer', 'setae-ui-desktop'), $this->version, true);
    }

    public function register_shortcodes()
    {
        add_shortcode('setae_dashboard', array($this, 'render_dashboard'));
    }

    public function render_dashboard()
    {
        if (!is_user_logged_in()) {
            return '<div class="setae-login-message"><p>この機能を利用するには<a href="' . wp_login_url(get_permalink()) . '">ログイン</a>してください。</p></div>';
        }

        ob_start();
        include SETAE_PLUGIN_DIR . 'templates/dashboard.php';
        return ob_get_clean();
    }

}
