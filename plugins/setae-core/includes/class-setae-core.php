<?php

class Setae_Core
{

    protected $loader;
    protected $plugin_name;
    protected $version;

    public function __construct()
    {
        $this->plugin_name = 'setae-core';
        $this->version = SETAE_VERSION;

        $this->load_dependencies();
        Setae_Entitlements::register_hooks();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_login_hooks();
    }

    private function load_dependencies()
    {
        /**
         * The class responsible for orchestrating the actions and filters of the
         * core plugin.
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-loader.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-public-identity.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-entitlements.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-billing.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/db/class-setae-product-events.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/db/class-setae-billing-events.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-app-operations.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-claim-registration.php';

        /**
         * CPT Classes
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-species.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-spider.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-baby-group.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-topic.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-log.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-suggestion.php';
        // ▼ 追加: 広告管理CPTの読み込み
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-ad.php';

        /**
         * QR label, scanner, and transfer data layer.
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-qr-manager.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-pwa.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-icon-registry.php';

        /**
         * Admin Settings
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-settings.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-icons.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-product-analytics.php';

        /**
         * API Manager
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/api/class-setae-api-manager.php';

        /**
         * ChatGPT App (MCP + OAuth) integration.
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/integrations/class-setae-chatgpt-app.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/integrations/class-setae-live-url-bridge.php';


        /**
         * Dashboard Class
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-dashboard.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-app-shell.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-visual.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-home.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-registration.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-care-share.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-profile.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-partner.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-public-qr.php';

        // ▼▼▼ 追加: Best Shot承認用管理ページのクラスを読み込み ▼▼▼
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-best-shots.php';

        // ▼▼▼ 追加: ユーザープロフィール拡張クラスを読み込み ▼▼▼
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-users.php';

        $this->loader = new Setae_Loader();

    }

    private function define_login_hooks()
    {
        $this->loader->add_action('login_enqueue_scripts', $this, 'enqueue_login_styles');
        $this->loader->add_action('login_footer', $this, 'prepare_login_form_for_password_managers');
        $this->loader->add_filter('login_headerurl', $this, 'custom_login_header_url');
        $this->loader->add_filter('login_headertext', $this, 'custom_login_header_text');
    }

    public function enqueue_login_styles()
    {
        wp_enqueue_style('setae-login', SETAE_PLUGIN_URL . 'assets/css/setae-login.css', array(), $this->version);
    }

    public function custom_login_header_url()
    {
        return home_url();
    }

    public function custom_login_header_text()
    {
        return 'SETAE';
    }

    /**
     * Keep the WordPress login form recognizable to browser password managers.
     */
    public function prepare_login_form_for_password_managers()
    {
        $should_remember = !isset($_SERVER['REQUEST_METHOD']) || strtoupper((string) $_SERVER['REQUEST_METHOD']) !== 'POST';
        ?>
        <script id="setae-login-autocomplete">
            (function () {
                var form = document.getElementById('loginform');
                if (!form) return;

                form.setAttribute('autocomplete', 'on');

                var username = document.getElementById('user_login');
                if (username) {
                    username.setAttribute('autocomplete', 'username');
                    username.setAttribute('autocapitalize', 'none');
                    username.setAttribute('spellcheck', 'false');
                }

                var password = document.getElementById('user_pass');
                if (password) {
                    password.setAttribute('autocomplete', 'current-password');
                }

                var remember = document.getElementById('rememberme');
                if (remember && <?php echo $should_remember ? 'true' : 'false'; ?>) {
                    remember.checked = true;
                }
            }());
        </script>
        <?php
    }

    private function define_admin_hooks()
    {
        $plugin_admin = new Setae_Admin_Settings();
        $admin_icons = new Setae_Admin_Icons();
        $product_analytics = new Setae_Admin_Product_Analytics();

        // ▼▼▼ 追加: Best Shot管理ページをインスタンス化 ▼▼▼
        $admin_best_shots = new Setae_Admin_Best_Shots();

        // ▼▼▼ 追加: ユーザープロフィール管理拡張 ▼▼▼
        $admin_users = new Setae_Admin_Users();
        $this->loader->add_action('show_user_profile', $admin_users, 'add_custom_user_profile_fields');
        $this->loader->add_action('edit_user_profile', $admin_users, 'add_custom_user_profile_fields');
        $this->loader->add_action('personal_options_update', $admin_users, 'save_custom_user_profile_fields');
        $this->loader->add_action('edit_user_profile_update', $admin_users, 'save_custom_user_profile_fields');

        // ログイン日時の記録
        $this->loader->add_action('wp_login', $admin_users, 'record_last_login', 10, 2);

        // ユーザー一覧へのカラム追加
        $this->loader->add_filter('manage_users_columns', $admin_users, 'add_last_login_column');

        // ユーザー一覧のカラム内容表示
        $this->loader->add_filter('manage_users_custom_column', $admin_users, 'show_last_login_column', 10, 3);

        // ユーザー一覧から無料登録枠を安全に一括付与
        $this->loader->add_filter('bulk_actions-users', $admin_users, 'register_bonus_slot_bulk_action');
        $this->loader->add_filter('handle_bulk_actions-users', $admin_users, 'handle_bonus_slot_bulk_action', 10, 3);
        $this->loader->add_action('admin_notices', $admin_users, 'render_bonus_slot_admin_notice');
        $this->loader->add_action('admin_post_setae_grant_bonus_slots', $admin_users, 'handle_bonus_slot_grant');


        // ▼ 追加: 管理画面アクセス制限のフックを登録
        $this->loader->add_action('admin_init', $this, 'restrict_admin_access');

        // ▼▼▼ 新規追加: 管理画面（WP管理バーやプロフィール設定）でもアバター書き換えを有効にする ▼▼▼
        $this->loader->add_filter('get_avatar', $this, 'custom_avatar_filter', 9999, 6);
        $this->loader->add_filter('get_avatar_url', $this, 'custom_avatar_url_filter', 9999, 3);
        $this->loader->add_filter('get_avatar_data', $this, 'custom_avatar_data_filter', 9999, 2);
        $this->loader->add_filter('pre_get_avatar', $this, 'custom_pre_get_avatar', 1, 3);
        // ▲▲▲ 新規追加ここまで ▲▲▲

        // ▼▼▼ 新規追加: 採用時のボーナス枠付与アクション ▼▼▼
        $this->loader->add_action('setae_on_best_shot_approved', $this, 'grant_bonus_spider_limit', 10, 1);
        $this->loader->add_action('setae_on_encyclopedia_approved', $this, 'grant_bonus_spider_limit', 10, 1);
        // ▲▲▲ 新規追加ここまで ▲▲▲
    }

    // ▼▼▼ 新規追加: ボーナス枠付与メソッド ▼▼▼
    /**
     * ベストショットや図鑑情報が採用された際に、生体登録上限を+1する
     * @param int $user_id 対象のユーザーID
     */
    public function grant_bonus_spider_limit($user_id)
    {
        if (!$user_id)
            return;

        $current_bonus = (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true);
        update_user_meta($user_id, '_setae_bonus_spider_limit', $current_bonus + 1);
    }
    // ▲▲▲ 新規追加ここまで ▲▲▲

    /**
     * 管理者以外が管理画面にアクセスしたらリダイレクトする
     */
    public function restrict_admin_access()
    {
        // 管理画面へのアクセス、かつAJAX通信ではなく、管理者権限がない場合
        if (is_admin() && !wp_doing_ajax() && !current_user_can('administrator')) {
            $app_url = class_exists('Setae_App_Shell')
                ? Setae_App_Shell::app_url()
                : home_url('/');

            wp_safe_redirect($app_url);
            exit;
        }
    }

    private function define_public_hooks()
    {
        $api = new Setae_API_Manager();
        $public_identity = new Setae_Public_Identity();
        $pwa = new Setae_PWA($this->get_version());
        $chatgpt_app = new Setae_ChatGPT_App();
        $live_url_bridge = new Setae_Live_URL_Bridge($this->get_version());

        $this->loader->add_action('user_register', $public_identity, 'ensure_for_user');

        $this->loader->add_action('init', 'Setae_Icon_Registry', 'register_rewrite_rule', 7);
        $this->loader->add_action('init', 'Setae_Icon_Registry', 'maybe_flush_rewrite_rules', 22);
        $this->loader->add_filter('query_vars', 'Setae_Icon_Registry', 'register_query_var');
        $this->loader->add_action('template_redirect', 'Setae_Icon_Registry', 'maybe_render_asset', 0);

        $this->loader->add_action('init', $pwa, 'register_rewrite_rules', 8);
        $this->loader->add_action('init', $pwa, 'maybe_flush_rewrite_rules', 21);
        $this->loader->add_action('init', $pwa, 'ensure_schedule', 30);
        $this->loader->add_filter('cron_schedules', $pwa, 'add_cron_schedule');
        $this->loader->add_filter('query_vars', $pwa, 'register_query_var');
        $this->loader->add_action('template_redirect', $pwa, 'render_asset', 0);
        $this->loader->add_action(Setae_PWA::CRON_HOOK, $pwa, 'send_care_reminders');
        $this->loader->add_action(Setae_PWA::TOPIC_PUSH_HOOK, $pwa, 'send_topic_reply', 10, 3);

        $this->loader->add_action(
            'rest_api_init',
            $live_url_bridge,
            'register_management_routes'
        );
        $this->loader->add_action(
            'init',
            $live_url_bridge,
            'register_rewrite_rules',
            9
        );
        $this->loader->add_action(
            'init',
            $live_url_bridge,
            'maybe_flush_rewrite_rules',
            20
        );
        $this->loader->add_filter(
            'query_vars',
            $live_url_bridge,
            'register_query_vars'
        );
        $this->loader->add_action(
            'template_redirect',
            $live_url_bridge,
            'render_bridge',
            0
        );

        // Instantiate CPTs and Register them
        $species = new Setae_CPT_Species();
        $this->loader->add_action('init', $species, 'register');

        $spider = new Setae_CPT_Spider();
        $this->loader->add_action('init', $spider, 'register');

        $baby_group = new Setae_CPT_Baby_Group();
        $this->loader->add_action('init', $baby_group, 'register');

        $topic = new Setae_CPT_Topic();
        $this->loader->add_action('init', $topic, 'register');

        $log = new Setae_CPT_Log();
        $this->loader->add_action('init', $log, 'register');

        $qr_manager = new Setae_QR_Manager();
        $this->loader->add_action('init', $qr_manager, 'register_post_types', 5);
        $this->loader->add_action('before_delete_post', $qr_manager, 'cleanup_deleted_post');

        // Register Suggestion CPT
        $suggestion = new Setae_CPT_Suggestion();
        $suggestion->init();

        $plugin_admin_ad = new Setae_CPT_Ad();

        // REST-driven GUI with a constant-based legacy rollback path.
        $app_shell = new Setae_App_Shell($this->get_version());
        $public_home = new Setae_Public_Home($this->get_version());
        $this->loader->add_action('wp_enqueue_scripts', $public_home, 'enqueue_styles', 20);
        $this->loader->add_filter('body_class', $public_home, 'body_classes');
        if ($app_shell->is_enabled()) {
            $this->loader->add_action('init', $app_shell, 'maybe_ensure_app_page', 6);
            $this->loader->add_action('template_redirect', $app_shell, 'prepare_request', 0);
            $this->loader->add_action('wp_enqueue_scripts', $app_shell, 'enqueue_assets', 100);
            $this->loader->add_action('wp_enqueue_scripts', $app_shell, 'isolate_styles', 999);
            $this->loader->add_action('wp_print_styles', $app_shell, 'isolate_styles', 999);
            $this->loader->add_action('init', $app_shell, 'register_shortcode', 5);
            $this->loader->add_filter('template_include', $app_shell, 'select_template', 999);
            $this->loader->add_filter('script_loader_tag', $app_shell, 'filter_script_tag', 10, 3);
            $this->loader->add_filter('style_loader_tag', $app_shell, 'filter_style_tag', 999, 2);
            $this->loader->add_filter('body_class', $app_shell, 'body_classes');
        } else {
            $plugin_public = new Setae_Dashboard($this->get_plugin_name(), $this->get_version());
            $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
            $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');
            $this->loader->add_action('init', $plugin_public, 'register_shortcodes');
        }

        // Public shared care log pages
        $public_care_share = new Setae_Public_Care_Share($this->get_version());
        $this->loader->add_action('init', $public_care_share, 'register_rewrite_rule');
        $this->loader->add_action('init', $public_care_share, 'maybe_flush_rewrite_rules', 20);
        $this->loader->add_filter('query_vars', $public_care_share, 'register_query_var');
        $this->loader->add_action('template_redirect', $public_care_share, 'render_share_page');

        // Public profile pages for referral-driven community growth
        $public_profile = new Setae_Public_Profile($this->get_version());
        $this->loader->add_action('init', $public_profile, 'register_rewrite_rule');
        $this->loader->add_action('init', $public_profile, 'maybe_flush_rewrite_rules', 20);
        $this->loader->add_filter('query_vars', $public_profile, 'register_query_var');
        $this->loader->add_action('template_redirect', $public_profile, 'render_profile_page');

        // Public partner page for shops, breeders, and event handouts
        $public_partner = new Setae_Public_Partner($this->get_version());
        $this->loader->add_action('init', $public_partner, 'register_rewrite_rule');
        $this->loader->add_action('init', $public_partner, 'maybe_flush_rewrite_rules', 20);
        $this->loader->add_filter('query_vars', $public_partner, 'register_query_var');
        $this->loader->add_action('template_redirect', $public_partner, 'render_partner_page');

        // Root-level short URLs such as setae.net/assf.
        $public_qr = new Setae_Public_QR($this->get_version());
        $this->loader->add_filter('query_vars', $public_qr, 'register_query_var');
        $this->loader->add_filter('login_redirect', $public_qr, 'redirect_pending_claim', 20, 3);
        $this->loader->add_action('template_redirect', $public_qr, 'render_page', 1);

        // Update Roles & Capabilities
        $this->loader->add_action('init', $this, 'update_roles');

        // Ajax Handler
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-ajax.php';
        $ajax_handler = new Setae_Ajax();
        $this->loader->add_action('wp_ajax_setae_update_profile', $ajax_handler, 'update_profile');

        // Avatar Filter (Optional: Enable custom avatar if stored)
        $this->loader->add_filter('get_avatar', $this, 'custom_avatar_filter', 9999, 6);
        $this->loader->add_filter('get_avatar_url', $this, 'custom_avatar_url_filter', 9999, 3);
        $this->loader->add_filter('get_avatar_data', $this, 'custom_avatar_data_filter', 9999, 2);

        // ▼ 新規追加: キャッシュプラグインより先に処理を奪い取り、古いアバターHTMLが返るのを防ぐ（優先度1）
        $this->loader->add_filter('pre_get_avatar', $this, 'custom_pre_get_avatar', 1, 3);
    }

    /**
     * ★追加: アバター画像URLを確実に取得するヘルパーメソッド
     * サムネイル -> フルサイズ -> ファイル直リンク の順で取得を試みる
     */
    private function get_custom_avatar_url($user_id)
    {
        $attachment_id = get_user_meta($user_id, 'setae_user_avatar', true);
        if (!$attachment_id) {
            return false;
        }

        // 1. まずサムネイルサイズ (推奨)
        $url = wp_get_attachment_image_url($attachment_id, 'thumbnail');

        // 2. 失敗ならフルサイズ
        if (!$url) {
            $url = wp_get_attachment_image_url($attachment_id, 'full');
        }

        // 3. それでも失敗ならファイル自体のURL (メタデータ不整合への対策)
        if (!$url) {
            $url = wp_get_attachment_url($attachment_id);
        }

        // ▼▼▼ 追加: 画像が更新されてIDが変わった瞬間だけURLが変わるようにする（最強のキャッシュ対策） ▼▼▼
        if ($url) {
            $url = add_query_arg('v', $attachment_id, $url);
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        return $url;
    }

    public function custom_avatar_filter($avatar, $id_or_email, $size, $default, $alt, $args = null)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            $img_url = $this->get_custom_avatar_url($user_id);
            if ($img_url) {
                $class = 'avatar avatar-' . $size . ' photo';
                if (isset($args['class'])) {
                    $class .= ' ' . (is_array($args['class']) ? implode(' ', $args['class']) : $args['class']);
                }
                $style = isset($args['style']) ? "style='" . esc_attr($args['style']) . "'" : "style='object-fit:cover; border-radius:50%;'";
                $extra_attr = isset($args['extra_attr']) ? $args['extra_attr'] : '';

                $avatar = "<img alt='" . esc_attr($alt) . "' src='" . esc_url($img_url) . "' class='" . esc_attr($class) . "' height='{$size}' width='{$size}' {$style} {$extra_attr}>";
            }
        }
        return $avatar;
    }

    public function custom_avatar_url_filter($url, $id_or_email, $args)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            // ヘルパーメソッドを使用
            $img_url = $this->get_custom_avatar_url($user_id);
            if ($img_url) {
                return $img_url;
            }
        }
        return $url;
    }

    public function custom_avatar_data_filter($args, $id_or_email)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            // ヘルパーメソッドを使用
            $img_url = $this->get_custom_avatar_url($user_id);
            if ($img_url) {
                $args['url'] = $img_url;
            }
        }
        return $args;
    }

    /**
     * キャッシュプラグインによる古いアバターの強制出力をバイパスする
     */
    public function custom_pre_get_avatar($avatar, $id_or_email, $args)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            $img_url = $this->get_custom_avatar_url($user_id);
            if ($img_url) {

                $size = isset($args['size']) ? $args['size'] : 96;
                $alt = isset($args['alt']) ? $args['alt'] : '';

                // クラス名の構築
                $class = 'avatar avatar-' . $size . ' photo';
                if (isset($args['class'])) {
                    if (is_array($args['class'])) {
                        $class .= ' ' . implode(' ', $args['class']);
                    } else {
                        $class .= ' ' . $args['class'];
                    }
                }

                $extra_attr = isset($args['extra_attr']) ? $args['extra_attr'] : '';

                // スタイルの構築（引数で指定されていればそれを使用、なければデフォルト）
                $style = '';
                if (isset($args['style'])) {
                    $style = "style='" . esc_attr($args['style']) . "'";
                } else {
                    $style = "style='object-fit:cover; border-radius:50%;'";
                }

                // キャッシュを無視して、自前で組み立てた最新のHTMLを強制的に返す
                return "<img alt='" . esc_attr($alt) . "' src='" . esc_url($img_url) . "' class='" . esc_attr($class) . "' height='{$size}' width='{$size}' {$style} {$extra_attr}>";
            }
        }

        // カスタム画像がない場合は本来の処理（Gravatar等）に任せる
        return $avatar;
    }

    private function get_user_id_from_mixed($id_or_email)
    {
        if (is_numeric($id_or_email))
            return (int) $id_or_email;
        if (is_string($id_or_email)) {
            $user = get_user_by('email', $id_or_email);
            return $user ? $user->ID : 0;
        }
        if (is_object($id_or_email)) {
            if (!empty($id_or_email->ID))
                return (int) $id_or_email->ID;
            if (!empty($id_or_email->user_id))
                return (int) $id_or_email->user_id;
        }
        return 0;
    }

    public function update_roles()
    {
        // Subscriber: Can register/edit OWN spiders.
        $role = get_role('subscriber');
        if ($role) {
            $role->add_cap('read');
            $role->add_cap('upload_files'); // For images
            $role->add_cap('edit_setae_spiders');
            $role->add_cap('publish_setae_spiders');
            $role->add_cap('read_setae_spider');
            $role->add_cap('read_setae_topic'); // Allow reading topics
            $role->add_cap('delete_setae_spiders');
            $role->add_cap('edit_published_setae_spiders');
            $role->add_cap('delete_published_setae_spiders');
        }

        // Admin: Can do everything
        $role = get_role('administrator');
        if ($role) {
            // Spiders
            $role->add_cap('edit_setae_spiders');
            $role->add_cap('publish_setae_spiders');
            $role->add_cap('read_setae_spider');
            $role->add_cap('delete_setae_spiders');
            $role->add_cap('edit_others_setae_spiders');
            $role->add_cap('delete_others_setae_spiders');
            $role->add_cap('edit_private_setae_spiders');
            $role->add_cap('read_private_setae_spiders');
            $role->add_cap('edit_published_setae_spiders');
            $role->add_cap('delete_published_setae_spiders');

            // Topics
            $role->add_cap('edit_setae_topics');
            $role->add_cap('publish_setae_topics');
            $role->add_cap('read_setae_topic');
            $role->add_cap('delete_setae_topics');
            $role->add_cap('edit_others_setae_topics');
            $role->add_cap('delete_others_setae_topics');
            $role->add_cap('edit_private_setae_topics');
            $role->add_cap('read_private_setae_topics');
            $role->add_cap('edit_published_setae_topics');
            $role->add_cap('delete_published_setae_topics');
        }

        // Add REST API filters for privacy
        add_filter('rest_setae_spider_query', array($this, 'restrict_spider_rest_query'), 10, 2);
    }

    public function restrict_spider_rest_query($args, $request)
    {
        if (!current_user_can('administrator')) {
            $args['author'] = get_current_user_id();
        }
        return $args;
    }

    public function run()
    {
        $this->loader->run();
    }

    public function get_plugin_name()
    {
        return $this->plugin_name;
    }

    public function get_version()
    {
        return $this->version;
    }

}

// ▼▼▼ 追加: 認証URLクリック時の本登録処理 ▼▼▼
add_action('init', 'setae_process_email_verification');
function setae_process_email_verification()
{
    if (isset($_GET['setae_action']) && $_GET['setae_action'] === 'verify_email') {
        // No rendered document or onward redirect retains the bearer token, including errors.
        nocache_headers();
        header('Referrer-Policy: no-referrer');
        $user_id = isset($_GET['uid']) && is_scalar($_GET['uid']) ? wp_unslash($_GET['uid']) : '';
        $token = isset($_GET['token']) && is_scalar($_GET['token']) ? wp_unslash($_GET['token']) : '';
        $redirect = Setae_Claim_Registration::verification_redirect($user_id, $token);
        wp_safe_redirect($redirect, 303);
        exit;
    }
}
// ▲▲▲ 追加ここまで ▲▲▲


// ▼▼▼ 追加: 未認証ユーザーのログイン制限処理 ▼▼▼
add_filter('wp_authenticate_user', 'setae_block_unverified_login', 10, 2);
function setae_block_unverified_login($user, $password)
{
    if ($user instanceof WP_User) {
        $is_verified = get_user_meta($user->ID, '_setae_is_verified', true);

        // 明示的に 0 (未認証) と設定されている場合のみエラーを返す（過去に登録された既存ユーザーを締め出さないための配慮）
        if ($is_verified !== '' && (int) $is_verified === 0) {
            return new WP_Error(
                'unverified_email',
                'メールアドレスの認証が完了していません。受信トレイをご確認の上、記載のリンクから本登録を行ってください。'
            );
        }
    }
    return $user;
}
// ▲▲▲ 追加ここまで ▲▲▲

// ==========================================
// setae_classification タクソノミーに並び順機能を追加
// ==========================================

// 1. 新規追加画面にフィールドを追加
add_action('setae_classification_add_form_fields', function () {
    ?>
    <div class="form-field">
        <label for="term_order">並び順</label>
        <input type="number" name="term_order" id="term_order" value="0">
        <p class="description">数字が小さいほど先に表示されます（例: 0, 1, 2...）</p>
    </div>
    <?php
});

// 2. 編集画面にフィールドを追加
add_action('setae_classification_edit_form_fields', function ($term) {
    $term_order = get_term_meta($term->term_id, '_setae_term_order', true);
    if ($term_order === '')
        $term_order = 0;
    ?>
    <tr class="form-field">
        <th scope="row" valign="top"><label for="term_order">並び順</label></th>
        <td>
            <input type="number" name="term_order" id="term_order" value="<?php echo esc_attr($term_order); ?>">
            <p class="description">数字が小さいほど先に表示されます（例: 0, 1, 2...）</p>
        </td>
    </tr>
    <?php
});

// 3. 値を保存する処理
function setae_save_classification_order($term_id)
{
    if (isset($_POST['term_order'])) {
        update_term_meta($term_id, '_setae_term_order', intval($_POST['term_order']));
    }
}
add_action('created_setae_classification', 'setae_save_classification_order');
add_action('edited_setae_classification', 'setae_save_classification_order');

// 4. 管理画面の一覧に「並び順」カラムを表示（オプション）
add_filter('manage_edit-setae_classification_columns', function ($columns) {
    $columns['term_order'] = '並び順';
    return $columns;
});
add_action('manage_setae_classification_custom_column', function ($content, $column_name, $term_id) {
    if ('term_order' === $column_name) {
        $term_order = get_term_meta($term_id, '_setae_term_order', true);
        $content = ($term_order !== '') ? esc_html($term_order) : '0';
    }
    return $content;
}, 10, 3);
