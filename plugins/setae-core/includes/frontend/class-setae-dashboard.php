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
        wp_enqueue_style('setae-modals', SETAE_PLUGIN_URL . 'assets/css/modules/modals.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-bl', SETAE_PLUGIN_URL . 'assets/css/modules/breeding_loan.css', $deps, $this->version, 'all'); // Breeding Loan CSS
        // ▼ 追加: チュートリアル用CSS
        wp_enqueue_style('setae-tutorial', SETAE_PLUGIN_URL . 'assets/css/modules/tutorial.css', $deps, $this->version, 'all');

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
            'nonce' => wp_create_nonce('wp_rest'),
            'setae_nonce' => wp_create_nonce('setae_nonce'), // For Encyclopedia AJAX
            'ajax_url' => admin_url('admin-ajax.php'),
            'logout_url' => wp_logout_url(home_url()),
            'current_user_id' => get_current_user_id(),
            'plugin_url' => SETAE_PLUGIN_URL, // Added for default images
            'current_user' => array(
                'display_name' => wp_get_current_user()->display_name,
                'email' => wp_get_current_user()->user_email,
                'avatar' => get_avatar_url(get_current_user_id()),
            )
        ));

        // ★追加: JS翻訳用のデータを渡す (wp_localize_script)
        // wp.i18n (JSON) が使えない環境でも確実に翻訳を適用するため
        $setae_i18n = array(
            // Generic
            'loading' => esc_html__('Loading...', 'setae-core'),
            'sending' => esc_html__('送信中...', 'setae-core'),
            'post' => esc_html__('投稿する', 'setae-core'),
            'save' => esc_html__('保存中...', 'setae-core'),
            'delete' => esc_html__('削除しました', 'setae-core'),
            'confirm_delete' => esc_html__('本当に削除しますか？', 'setae-core'),

            // Topics & Comments
            'topic_created' => esc_html__('トピックを作成しました', 'setae-core'),
            'no_topics' => __('トピックがありません。<br>最初の投稿を作成してみましょう！', 'setae-core'), // HTML含むため esc_html__ は避けるか、JS側で .html() するなら注意
            'comment_limit' => esc_html__('コメントは1000文字以内で入力してください', 'setae-core'),
            'comment_posted' => esc_html__('コメントを投稿しました', 'setae-core'),

            // Dates
            'today' => esc_html__('Today', 'setae-core'),
            'yesterday' => esc_html__('Yesterday', 'setae-core'),
            'just_now' => esc_html__('たった今', 'setae-core'),
            'mins_ago' => esc_html__('分前', 'setae-core'),
            'hours_ago' => esc_html__('時間前', 'setae-core'),
            'days_ago' => esc_html__('日前', 'setae-core'),
            'months_ago' => esc_html__('ヶ月前', 'setae-core'),
            'years_ago' => esc_html__('年前', 'setae-core'),

            // Tabs & UI
            'overview' => esc_html__('Overview', 'setae-core'),
            'history' => esc_html__('History', 'setae-core'),
            'settings_bl' => esc_html__('Settings / BL', 'setae-core'),
            'settings_saved' => esc_html__('Settings saved successfully', 'setae-core'),
            'spider_deleted' => esc_html__('削除しました', 'setae-core'), // 重複だが明示

            // ▼ ここから下を新規追加 (BL Settings)
            'bl_settings_title' => esc_html__('Breeding Loan Settings', 'setae-core'),
            'bl_settings_desc' => esc_html__('Manage availability and terms for community breeding projects.', 'setae-core'),
            'current_status' => esc_html__('Current Status', 'setae-core'),
            'status_private' => esc_html__('Private (Not Listed)', 'setae-core'),
            'status_recruiting' => esc_html__('Recruiting (Public)', 'setae-core'),
            'status_loaned' => esc_html__('Loaned Out', 'setae-core'),
            'bl_status_helper' => esc_html__('Select "Recruiting" to display this spider on the community board.', 'setae-core'),
            'terms_conditions' => esc_html__('Terms & Conditions', 'setae-core'),
            'bl_terms_helper' => esc_html__('Provide clear details about the loan agreement to avoid disputes.', 'setae-core'),
            'save_settings' => esc_html__('Save Settings', 'setae-core'),

            // ▼ Overview & History
            'last_molt' => esc_html__('Last Molt', 'setae-core'),
            'last_feed' => esc_html__('Last Feed', 'setae-core'),
            'last_repot' => esc_html__('Last Repot', 'setae-core'),
            'last_water' => esc_html__('Last Water', 'setae-core'),
            'cycle' => esc_html__('Cycle', 'setae-core'),
            'status_normal' => esc_html__('Normal', 'setae-core'),
            'status_fasting' => esc_html__('Fasting', 'setae-core'),
            'status_pre_molt' => esc_html__('Pre-molt', 'setae-core'),
            'status_post_molt' => esc_html__('Post-molt', 'setae-core'),
            'growth_log' => esc_html__('Growth Log', 'setae-core'),
            'prey_preferences' => esc_html__('Prey Preferences', 'setae-core'),
            'molt_history' => esc_html__('MOLT HISTORY', 'setae-core'),
            'repot_history' => esc_html__('REPOT HISTORY', 'setae-core'),
            'date' => esc_html__('DATE', 'setae-core'),
            'interval' => esc_html__('INTERVAL', 'setae-core'),
            'no' => esc_html__('NO.', 'setae-core'),

            // ▼ List Labels
            'feed' => esc_html__('給餌', 'setae-core'),
            'molt' => esc_html__('脱皮', 'setae-core'),
            'water' => esc_html__('水やり', 'setae-core'),
            'repot' => esc_html__('植え替え', 'setae-core'),
            'shed' => esc_html__('脱皮', 'setae-core'),
            'unidentified' => esc_html__('未同定', 'setae-core'),
        );
        wp_localize_script('setae-app-core', 'setaeI18n', $setae_i18n);

        // Enqueue API Module (Depends on Core)
        wp_enqueue_script('setae-app-api', SETAE_PLUGIN_URL . 'assets/js/modules/app-api.js', array('jquery', 'setae-app-core'), $this->version, true);

        // Enqueue UI Modules (Split Refactoring)
        $ui_deps = array('jquery', 'setae-app-core', 'setae-app-api'); // wp-i18n 削除

        // 1. Logic Sub-Modules
        wp_enqueue_script('setae-ui-actions', SETAE_PLUGIN_URL . 'assets/js/modules/ui/actions.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-detail', SETAE_PLUGIN_URL . 'assets/js/modules/ui/detail.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-list', SETAE_PLUGIN_URL . 'assets/js/modules/ui/list.js', array_merge($ui_deps, array('setae-ui-detail')), $this->version, true);
        wp_enqueue_script('setae-ui-log-modal', SETAE_PLUGIN_URL . 'assets/js/modules/ui/log-modal.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-profile', SETAE_PLUGIN_URL . 'assets/js/modules/ui/profile.js', $ui_deps, $this->version, true); // New Profile Module
        wp_enqueue_script('setae-ui-add-spider', SETAE_PLUGIN_URL . 'assets/js/modules/ui/add-spider.js', $ui_deps, $this->version, true); // Add Spider Module
        wp_enqueue_script('setae-ui-breeding-loan', SETAE_PLUGIN_URL . 'assets/js/modules/ui/breeding_loan.js', $ui_deps, $this->version, true); // Breeding Loan Module
        wp_enqueue_script('setae-ui-encyclopedia', SETAE_PLUGIN_URL . 'assets/js/modules/ui/encyclopedia.js', $ui_deps, $this->version, true); // Encyclopedia Module

        // 1.5 Desktop Specific Logic
        wp_enqueue_script('setae-ui-desktop', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-desktop.js', array('setae-ui-actions', 'jquery'), $this->version, true);

        // ▼ 追加: チュートリアルモジュール
        wp_enqueue_script('setae-app-tutorial', SETAE_PLUGIN_URL . 'assets/js/modules/app-tutorial.js', array('jquery'), $this->version, true);

        // 2. Controller (Renderer)
        // 2. Controller (Renderer)
        wp_enqueue_script('setae-app-ui-renderer', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-renderer.js', array('setae-ui-actions', 'setae-ui-detail', 'setae-ui-list', 'setae-ui-log-modal', 'setae-ui-profile', 'setae-ui-breeding-loan'), $this->version, true);

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
