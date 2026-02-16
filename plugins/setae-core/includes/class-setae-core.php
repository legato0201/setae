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

        /**
         * CPT Classes
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-species.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-spider.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-topic.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-log.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/cpt/class-setae-cpt-suggestion.php';

        /**
         * DB Classes
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/db/class-setae-bl-contracts.php';

        /**
         * Admin Settings
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/admin/class-setae-admin-settings.php';

        /**
         * API Manager
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/api/class-setae-api-manager.php';



        /**
         * Dashboard Class
         */
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/frontend/class-setae-dashboard.php';

        $this->loader = new Setae_Loader();

    }

    private function define_login_hooks()
    {
        $this->loader->add_action('login_enqueue_scripts', $this, 'enqueue_login_styles');
        $this->loader->add_filter('login_headerurl', $this, 'custom_login_header_url');
        $this->loader->add_filter('login_headertext', $this, 'custom_login_header_text');
    }

    public function enqueue_login_styles()
    {
        wp_enqueue_style('setae-login', SETAE_PLUGIN_URL . 'assets/css/setae-login.css', array(), '1.0.0');
    }

    public function custom_login_header_url()
    {
        return home_url();
    }

    public function custom_login_header_text()
    {
        return 'Setae Platform';
    }

    private function define_admin_hooks()
    {
        $plugin_admin = new Setae_Admin_Settings();

        // ▼ 追加: 管理画面アクセス制限のフックを登録
        $this->loader->add_action('admin_init', $this, 'restrict_admin_access');
    }

    /**
     * 管理者以外が管理画面にアクセスしたらリダイレクトする
     */
    public function restrict_admin_access()
    {
        // 管理画面へのアクセス、かつAJAX通信ではなく、管理者権限がない場合
        if (is_admin() && !wp_doing_ajax() && !current_user_can('administrator')) {
            wp_redirect(home_url());
            exit;
        }
    }

    private function define_public_hooks()
    {
        $api = new Setae_API_Manager();

        // Instantiate CPTs and Register them
        $species = new Setae_CPT_Species();
        $this->loader->add_action('init', $species, 'register');

        $spider = new Setae_CPT_Spider();
        $this->loader->add_action('init', $spider, 'register');

        $topic = new Setae_CPT_Topic();
        $this->loader->add_action('init', $topic, 'register');

        $log = new Setae_CPT_Log();
        $this->loader->add_action('init', $log, 'register');

        // Register Suggestion CPT
        $suggestion = new Setae_CPT_Suggestion();
        $suggestion->init();

        // Dashboard & Assets
        $plugin_public = new Setae_Dashboard($this->get_plugin_name(), $this->get_version());
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');
        $this->loader->add_action('init', $plugin_public, 'register_shortcodes');


        // Update Roles & Capabilities
        $this->loader->add_action('init', $this, 'update_roles');

        // Ajax Handler
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-setae-ajax.php';
        $ajax_handler = new Setae_Ajax();
        $this->loader->add_action('wp_ajax_setae_update_profile', $ajax_handler, 'update_profile');

        // Avatar Filter (Optional: Enable custom avatar if stored)
        $this->loader->add_filter('get_avatar', $this, 'custom_avatar_filter', 10, 5);
        $this->loader->add_filter('get_avatar_url', $this, 'custom_avatar_url_filter', 10, 3);
        $this->loader->add_filter('get_avatar_data', $this, 'custom_avatar_data_filter', 10, 2);
    }

    public function custom_avatar_filter($avatar, $id_or_email, $size, $default, $alt)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);

        if ($user_id) {
            // 保存した attachment_id を取得
            $attachment_id = get_user_meta($user_id, 'setae_user_avatar', true);
            if ($attachment_id) {
                $img_url = wp_get_attachment_image_url($attachment_id, 'thumbnail');
                if ($img_url) {
                    $avatar = "<img alt='{$alt}' src='{$img_url}' class='avatar avatar-{$size} photo' height='{$size}' width='{$size}' style='object-fit:cover; border-radius:50%;'>";
                }
            }
        }
        return $avatar;
    }

    public function custom_avatar_url_filter($url, $id_or_email, $args)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            $attachment_id = get_user_meta($user_id, 'setae_user_avatar', true);
            if ($attachment_id) {
                // 1. まずサムネイルサイズの取得を試みる
                $img_url = wp_get_attachment_image_url($attachment_id, 'thumbnail');

                // 2. サムネイルがない場合（生成失敗やSVG等）、フルサイズを試みる
                if (!$img_url) {
                    $img_url = wp_get_attachment_image_url($attachment_id, 'full');
                }

                // 3. それでも取得できない場合、直接ファイルURLを取得
                if (!$img_url) {
                    $img_url = wp_get_attachment_url($attachment_id);
                }

                if ($img_url) {
                    return $img_url;
                }
            }
        }
        return $url;
    }

    public function custom_avatar_data_filter($args, $id_or_email)
    {
        $user_id = $this->get_user_id_from_mixed($id_or_email);
        if ($user_id) {
            $attachment_id = get_user_meta($user_id, 'setae_user_avatar', true);
            if ($attachment_id) {
                $img_url = wp_get_attachment_url($attachment_id);
                if ($img_url) {
                    $args['url'] = $img_url;
                }
            }
        }
        return $args;
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
