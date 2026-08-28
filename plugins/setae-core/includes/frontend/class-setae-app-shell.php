<?php

/**
 * Hosts the REST-driven GUI while keeping the legacy dashboard available.
 */
class Setae_App_Shell
{
    const SCRIPT_HANDLE = 'setae-gui-app';
    const APP_PAGE_OPTION = '_setae_app_page_id';
    const APP_PAGE_VERSION_OPTION = '_setae_app_page_version';
    const TEMPLATE_RELATIVE_PATH = 'templates/app-shell.php';

    private $version;

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function is_enabled()
    {
        $enabled = defined('SETAE_USE_NEW_GUI') && SETAE_USE_NEW_GUI;
        $enabled = (bool) apply_filters('setae_use_new_gui', $enabled);
        return $enabled && is_readable(SETAE_PLUGIN_DIR . 'assets/app/app.js');
    }

    public static function is_app_page_request()
    {
        if (is_admin() || (function_exists('wp_doing_ajax') && wp_doing_ajax())) {
            return false;
        }

        if (is_front_page()) {
            return true;
        }

        $post = get_queried_object();
        if (!($post instanceof WP_Post)) {
            $post = isset($GLOBALS['post']) ? $GLOBALS['post'] : null;
        }
        if ($post instanceof WP_Post && has_shortcode((string) $post->post_content, 'setae_dashboard')) {
            return true;
        }

        return (bool) apply_filters('setae_is_app_page', false, $post);
    }

    public function register_shortcode()
    {
        add_shortcode('setae_dashboard', array($this, 'render'));
    }

    public function maybe_ensure_app_page()
    {
        if (!$this->is_enabled()) {
            return;
        }
        $known_version = (string) get_option(self::APP_PAGE_VERSION_OPTION, '');
        $page_id = self::get_app_page_id();
        if ($known_version === $this->version && $page_id) {
            return;
        }

        $page_id = self::ensure_app_page();
        if ($page_id) {
            update_option(self::APP_PAGE_VERSION_OPTION, $this->version, false);
        }
    }

    public static function ensure_app_page()
    {
        $page_id = self::get_app_page_id();
        if ($page_id) {
            return $page_id;
        }

        $existing = get_page_by_path('app', OBJECT, 'page');
        if ($existing instanceof WP_Post) {
            $content = trim((string) $existing->post_content);
            if ('' !== $content && !has_shortcode($content, 'setae_dashboard')) {
                return 0;
            }
            $page_id = wp_update_post(array(
                'ID' => $existing->ID,
                'post_status' => 'publish',
                'post_content' => '[setae_dashboard]',
                'comment_status' => 'closed',
            ), true);
        } else {
            $page_id = wp_insert_post(array(
                'post_type' => 'page',
                'post_status' => 'publish',
                'post_title' => 'SETAE App',
                'post_name' => 'app',
                'post_content' => '[setae_dashboard]',
                'comment_status' => 'closed',
                'ping_status' => 'closed',
            ), true);
        }

        if (is_wp_error($page_id) || !$page_id) {
            return 0;
        }
        update_option(self::APP_PAGE_OPTION, absint($page_id), false);
        return absint($page_id);
    }

    public static function get_app_page_id()
    {
        $page_id = absint(get_option(self::APP_PAGE_OPTION, 0));
        $page = $page_id ? get_post($page_id) : null;
        if ($page instanceof WP_Post
            && 'page' === $page->post_type
            && 'trash' !== $page->post_status
            && has_shortcode((string) $page->post_content, 'setae_dashboard')) {
            return $page_id;
        }

        $page = get_page_by_path('app', OBJECT, 'page');
        if ($page instanceof WP_Post
            && 'trash' !== $page->post_status
            && has_shortcode((string) $page->post_content, 'setae_dashboard')) {
            update_option(self::APP_PAGE_OPTION, absint($page->ID), false);
            return absint($page->ID);
        }
        return 0;
    }

    public static function app_url($args = array())
    {
        $url = home_url('/');
        return $args ? add_query_arg($args, $url) : $url;
    }

    public static function login_url($return_url = '')
    {
        $args = array('setae_auth' => 'login');

        if ($return_url) {
            $return_url = esc_url_raw($return_url);
            $home = wp_parse_url(home_url('/'));
            $return = wp_parse_url($return_url);
            $same_origin = is_array($home)
                && is_array($return)
                && !empty($home['scheme'])
                && !empty($home['host'])
                && strtolower((string) $home['scheme']) === strtolower((string) ($return['scheme'] ?? ''))
                && strtolower((string) $home['host']) === strtolower((string) ($return['host'] ?? ''))
                && (int) ($home['port'] ?? 0) === (int) ($return['port'] ?? 0);
            if ($same_origin) {
                $args['setae_return'] = $return_url;
            }
        }
        return self::app_url($args);
    }

    public function prepare_request()
    {
        if (!$this->is_enabled() || !self::is_app_page_request()) {
            return;
        }

        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }

        nocache_headers();

        if (function_exists('show_admin_bar')) {
            show_admin_bar(false);
        }

        // Theme custom CSS is printed directly in wp_head and cannot be dequeued.
        remove_action('wp_head', 'wp_custom_css_cb', 101);

        // WordPress replaces native emoji characters with external images in
        // wp_head. The application owns its icon and typography rendering.
        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_enqueue_scripts', 'wp_enqueue_emoji_styles');
    }

    public function select_template($template)
    {
        if (!$this->is_enabled() || !self::is_app_page_request()) {
            return $template;
        }

        $app_template = SETAE_PLUGIN_DIR . self::TEMPLATE_RELATIVE_PATH;
        return is_readable($app_template) ? $app_template : $template;
    }

    public function enqueue_assets()
    {
        if (!$this->is_enabled() || !self::is_app_page_request()) {
            return;
        }

        $base = SETAE_PLUGIN_URL . 'assets/app/';
        wp_enqueue_style('setae-gui-tokens', $base . 'styles/tokens.css', array(), $this->version);
        wp_enqueue_style('setae-gui-reset', $base . 'styles/reset.css', array('setae-gui-tokens'), $this->version);
        wp_enqueue_style('setae-gui-foundation', $base . 'styles/foundation.css', array('setae-gui-reset'), $this->version);
        wp_enqueue_style('setae-gui-components', $base . 'styles/components.css', array('setae-gui-foundation'), $this->version);
        wp_enqueue_style('setae-gui-workbench-components', $base . 'styles/components/workbench.css', array('setae-gui-components'), $this->version);
        wp_enqueue_style('setae-gui-combobox', $base . 'styles/components/combobox.css', array('setae-gui-workbench-components'), $this->version);
        wp_enqueue_style('setae-gui-action-menu', $base . 'styles/components/action-menu.css', array('setae-gui-combobox'), $this->version);
        wp_enqueue_style('setae-gui-property-list', $base . 'styles/components/property-list.css', array('setae-gui-action-menu'), $this->version);
        wp_enqueue_style('setae-gui-activity-list', $base . 'styles/components/activity-list.css', array('setae-gui-property-list'), $this->version);
        wp_enqueue_style('setae-gui-identity-panel', $base . 'styles/components/identity-panel.css', array('setae-gui-activity-list'), $this->version);
        wp_enqueue_style('setae-gui-data-visualization', $base . 'styles/components/data-visualization.css', array('setae-gui-identity-panel'), $this->version);
        wp_enqueue_style('setae-gui-media-grid', $base . 'styles/components/media-grid.css', array('setae-gui-data-visualization'), $this->version);
        wp_enqueue_style('setae-gui-media-component', $base . 'styles/components/media.css', array('setae-gui-media-grid'), $this->version);
        wp_enqueue_style('setae-gui-specimen-card-component', $base . 'styles/components/specimen-card.css', array('setae-gui-media-component'), $this->version);
        wp_enqueue_style('setae-gui-update-notice-component', $base . 'styles/components/update-notice.css', array('setae-gui-specimen-card-component'), $this->version);
        wp_enqueue_style('setae-gui-form-safety-component', $base . 'styles/components/form-safety.css', array('setae-gui-update-notice-component'), $this->version);
        wp_enqueue_style('setae-gui-feedback-component', $base . 'styles/components/feedback.css', array('setae-gui-form-safety-component'), $this->version);
        wp_enqueue_style('setae-gui-progressive-list-component', $base . 'styles/components/progressive-list.css', array('setae-gui-feedback-component'), $this->version);
        wp_enqueue_style('setae-gui-mobile-gestures-component', $base . 'styles/components/mobile-gestures.css', array('setae-gui-progressive-list-component'), $this->version);
        wp_enqueue_style('setae-gui-app-frame', $base . 'styles/app-frame.css', array('setae-gui-mobile-gestures-component'), $this->version);
        wp_enqueue_style('setae-gui-workspace-pattern', $base . 'styles/patterns/workspace.css', array('setae-gui-app-frame'), $this->version);
        wp_enqueue_style('setae-gui-registry-pattern', $base . 'styles/patterns/registry.css', array('setae-gui-workspace-pattern'), $this->version);
        wp_enqueue_style('setae-gui-ledger-pattern', $base . 'styles/patterns/ledger.css', array('setae-gui-registry-pattern'), $this->version);
        wp_enqueue_style('setae-gui-care-plan-pattern', $base . 'styles/patterns/care-plan.css', array('setae-gui-ledger-pattern'), $this->version);
        wp_enqueue_style('setae-gui-specimen-workspace-pattern', $base . 'styles/patterns/specimen-workspace.css', array('setae-gui-care-plan-pattern'), $this->version);
        wp_enqueue_style('setae-gui-discussion-pattern', $base . 'styles/patterns/discussion.css', array('setae-gui-specimen-workspace-pattern'), $this->version);
        wp_enqueue_style('setae-gui-task-workspace-pattern', $base . 'styles/patterns/task-workspace.css', array('setae-gui-discussion-pattern'), $this->version);
        wp_enqueue_style('setae-gui-onboarding-pattern', $base . 'styles/patterns/onboarding.css', array('setae-gui-task-workspace-pattern'), $this->version);
        wp_enqueue_style('setae-gui-auth-screen', $base . 'styles/screens/auth.css', array('setae-gui-onboarding-pattern'), $this->version);
        wp_enqueue_style('setae-gui-collection-screen', $base . 'styles/screens/collection.css', array('setae-gui-auth-screen'), $this->version);
        wp_enqueue_style('setae-gui-collection-editor-screen', $base . 'styles/screens/collection-editor.css', array('setae-gui-collection-screen'), $this->version);
        wp_enqueue_style('setae-gui-specimen-screen', $base . 'styles/screens/specimen.css', array('setae-gui-collection-editor-screen'), $this->version);
        wp_enqueue_style('setae-gui-specimen-intake-screen', $base . 'styles/screens/specimen-intake.css', array('setae-gui-specimen-screen'), $this->version);
        wp_enqueue_style('setae-gui-quick-record-screen', $base . 'styles/screens/quick-record.css', array('setae-gui-specimen-intake-screen'), $this->version);
        wp_enqueue_style('setae-gui-today-screen', $base . 'styles/screens/today.css', array('setae-gui-quick-record-screen'), $this->version);
        wp_enqueue_style('setae-gui-records-screen', $base . 'styles/screens/records.css', array('setae-gui-today-screen'), $this->version);
        wp_enqueue_style('setae-gui-nursery-screen', $base . 'styles/screens/nursery.css', array('setae-gui-records-screen'), $this->version);
        wp_enqueue_style('setae-gui-husbandry-screen', $base . 'styles/screens/husbandry.css', array('setae-gui-nursery-screen'), $this->version);
        wp_enqueue_style('setae-gui-qr-screen', $base . 'styles/screens/qr.css', array('setae-gui-husbandry-screen'), $this->version);
        wp_enqueue_style('setae-gui-community-screen', $base . 'styles/screens/community.css', array('setae-gui-qr-screen'), $this->version);
        wp_enqueue_style('setae-gui-settings-screen', $base . 'styles/screens/settings.css', array('setae-gui-community-screen'), $this->version);
        wp_enqueue_style('setae-gui-diagnostics-screen', $base . 'styles/screens/diagnostics.css', array('setae-gui-settings-screen'), $this->version);

        wp_enqueue_script('setae-gui-qrcode', $base . 'vendor/qrcode.min.js', array(), $this->version, true);
        wp_enqueue_script('setae-gui-jsqr', $base . 'vendor/jsQR.js', array(), $this->version, true);
        wp_enqueue_script(
            self::SCRIPT_HANDLE,
            $base . 'app.js',
            array('setae-gui-qrcode', 'setae-gui-jsqr'),
            $this->version,
            true
        );

        $diagnostics_mode = (defined('WP_DEBUG') && WP_DEBUG)
            || (bool) get_option('setae_diagnostics_mode', false);

        $config = array(
            'apiRoot' => untrailingslashit(rest_url('setae/v1')),
            'followBootstrapApiRoot' => true,
            'credentials' => 'same-origin',
            'siteOrigin' => home_url('/'),
            'appUrl' => self::app_url(),
            'embedded' => true,
            'standalone' => true,
            'enableMock' => false,
            'debug' => defined('WP_DEBUG') && WP_DEBUG,
            'canDiagnostics' => current_user_can('manage_options') && $diagnostics_mode,
            'serviceWorkerUrl' => home_url('/setae-sw.js'),
            'iconOverrides' => Setae_Icon_Registry::get_frontend_overrides(),
            'specimenAssets' => Setae_Icon_Registry::get_specimen_assets(),
            'version' => $this->version,
        );
        wp_add_inline_script(
            self::SCRIPT_HANDLE,
            'window.SETAE_CONFIG = ' . wp_json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';',
            'before'
        );
    }

    public function isolate_styles()
    {
        if (!$this->is_enabled() || !self::is_app_page_request()) {
            return;
        }

        $wordpress_handles = array(
            'wp-block-library',
            'wp-block-library-theme',
            'classic-theme-styles',
            'global-styles',
            'wp-emoji-styles',
        );
        foreach ($wordpress_handles as $handle) {
            wp_dequeue_style($handle);
        }

        global $wp_styles;
        if (!is_object($wp_styles) || empty($wp_styles->queue)) {
            return;
        }

        foreach ((array) $wp_styles->queue as $handle) {
            if (0 !== strpos((string) $handle, 'setae-gui-')) {
                wp_dequeue_style($handle);
            }
        }
    }

    public function filter_style_tag($html, $handle)
    {
        if (!$this->is_enabled() || !self::is_app_page_request()) {
            return $html;
        }

        return 0 === strpos((string) $handle, 'setae-gui-') ? $html : '';
    }

    public function filter_script_tag($tag, $handle, $src = '')
    {
        if (self::SCRIPT_HANDLE !== $handle) {
            return $tag;
        }
        $tag = preg_replace('/\s+type=(["\'])text\/javascript\1/i', '', $tag);
        if (false !== stripos($tag, ' type=')) {
            return preg_replace('/\s+type=(["\'])[^"\']+\1/i', ' type="module"', $tag, 1);
        }
        return str_replace('<script ', '<script type="module" ', $tag);
    }

    public function body_classes($classes)
    {
        if ($this->is_enabled() && self::is_app_page_request()) {
            $classes[] = 'setae-new-gui-page';
        }
        return $classes;
    }

    public function render()
    {
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }

        return self::render_mount();
    }

    public static function render_mount()
    {
        return '<div id="setae-gui-root" class="setae-gui-host">'
            . '<div id="app">'
            . '<noscript>SETAEを利用するにはJavaScriptを有効にしてください。</noscript>'
            . '</div></div>';
    }
}
