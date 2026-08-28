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
        if (!$this->is_app_page()) {
            return;
        }
        // 1. Global (変数・リセット)
        wp_enqueue_style('setae-global', SETAE_PLUGIN_URL . 'assets/css/setae-global.css', array('dashicons'), $this->version, 'all');

        // 2. Modules (機能ごとの分割ファイル)
        $deps = array('setae-global');

        wp_enqueue_style('setae-layout', SETAE_PLUGIN_URL . 'assets/css/modules/layout.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-cards', SETAE_PLUGIN_URL . 'assets/css/modules/cards.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-modals', SETAE_PLUGIN_URL . 'assets/css/modules/modals.css', $deps, $this->version, 'all');
        // ▼ 追加: チュートリアル用CSS
        wp_enqueue_style('setae-tutorial', SETAE_PLUGIN_URL . 'assets/css/modules/tutorial.css', $deps, $this->version, 'all');

        // 残りのビュー専用スタイル (Chat, Kanban, etc.)
        wp_enqueue_style('setae-views', SETAE_PLUGIN_URL . 'assets/css/modules/views.css', $deps, $this->version, 'all');
        wp_enqueue_style('setae-feeders', SETAE_PLUGIN_URL . 'assets/css/modules/feeders.css', array('setae-views'), $this->version, 'all');
        wp_enqueue_style('setae-ux-foundation', SETAE_PLUGIN_URL . 'assets/css/modules/ux-foundation.css', array('setae-feeders'), $this->version, 'all');
        wp_enqueue_style('setae-encyclopedia', SETAE_PLUGIN_URL . 'assets/css/modules/encyclopedia.css', array('setae-ux-foundation'), $this->version, 'all');
        wp_enqueue_style('setae-qr', SETAE_PLUGIN_URL . 'assets/css/modules/qr.css', array('setae-ux-foundation'), $this->version, 'all');
        wp_enqueue_style('setae-my-spiders', SETAE_PLUGIN_URL . 'assets/css/modules/my-spiders.css', array('setae-qr'), $this->version, 'all');
        wp_enqueue_style('setae-unified-design', SETAE_PLUGIN_URL . 'assets/css/modules/unified-design.css', array('setae-my-spiders'), $this->version, 'all');
        wp_enqueue_style('setae-pwa', SETAE_PLUGIN_URL . 'assets/css/modules/pwa.css', array('setae-unified-design'), $this->version, 'all');
        wp_enqueue_style('setae-dark-mode', SETAE_PLUGIN_URL . 'assets/css/modules/dark-mode.css', array('setae-pwa'), $this->version, 'all');
        wp_enqueue_style('setae-specimen-dashboard', SETAE_PLUGIN_URL . 'assets/css/modules/specimen-dashboard.css', array('setae-dark-mode'), $this->version, 'all');
    }

    public function enqueue_scripts()
    {
        if (!$this->is_app_page()) {
            return;
        }
        // Keep charts available in the installed PWA while offline.
        wp_enqueue_script('chart-js', SETAE_PLUGIN_URL . 'assets/js/vendor/chart/chart.umd.min.js', array(), '4.5.1', true);
        wp_enqueue_script('qrcode-js', SETAE_PLUGIN_URL . 'assets/js/vendor/qrcodejs/qrcode.min.js', array(), '1.0.0', true);
        wp_enqueue_script('setae-jspdf', SETAE_PLUGIN_URL . 'assets/js/vendor/jspdf/jspdf.umd.min.js', array(), '4.0.0', true);
        wp_enqueue_script('setae-qr-print', SETAE_PLUGIN_URL . 'assets/js/modules/qr-print.js', array('qrcode-js', 'setae-jspdf'), $this->version, true);
        wp_enqueue_script('setae-jsqr', SETAE_PLUGIN_URL . 'assets/js/vendor/jsqr/jsQR.js', array(), '1.4.0', true);

        // Enqueue Core Module
        wp_enqueue_script('setae-app-core', SETAE_PLUGIN_URL . 'assets/js/modules/app-core.js', array('jquery', 'chart-js'), $this->version, true);

        // ▼▼▼ 追加・修正: ユーザーの登録数と上限を取得するロジック ▼▼▼
        $user_id = get_current_user_id();
        $is_guest_mode = !$user_id;
        $profile = $is_guest_mode ? array() : Setae_App_Operations::get_profile($user_id);
        $profile = is_array($profile) ? $profile : array();
        $is_premium = !empty($profile['is_premium']);
        $cancel_timestamp = get_user_meta($user_id, '_setae_premium_cancel_at', true);

        $spider_count = $is_guest_mode ? 0 : count_user_posts($user_id, 'setae_spider', true);
        $base_limit = (int) get_option('setae_free_spider_limit', SETAE_DEFAULT_FREE_SPIDER_LIMIT);
        $bonus_limit = $is_guest_mode ? 0 : (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true);
        $spider_limit = isset($profile['inventory']['limit']) ? $profile['inventory']['limit'] : $base_limit + $bonus_limit;
        $theme_preference = $is_guest_mode
            ? 'system'
            : sanitize_key(get_user_meta($user_id, '_setae_theme_preference', true));
        if (!in_array($theme_preference, array('light', 'dark', 'system'), true)) {
            $theme_preference = 'system';
        }
        $show_care_focus_meta = $is_guest_mode
            ? ''
            : get_user_meta($user_id, '_setae_show_care_focus', true);
        $show_care_focus = $show_care_focus_meta === ''
            ? true
            : !in_array((string) $show_care_focus_meta, array('0', 'false', 'off'), true);
        $public_handle = $user_id ? Setae_Public_Identity::get_handle($user_id) : '';

        // ▼▼▼ 追加: 既存ユーザーで紹介コードが未発行の場合は自動生成する ▼▼▼
        $referral_code = $user_id ? get_user_meta($user_id, '_setae_referral_code', true) : '';
        if ($user_id && empty($referral_code)) {
            // ひらがな5文字を生成
            $hiragana = array('あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'ん');
            $referral_code = '';
            for ($i = 0; $i < 5; $i++) {
                $referral_code .= $hiragana[array_rand($hiragana)];
            }
            // DBに保存
            update_user_meta($user_id, '_setae_referral_code', $referral_code);

            // ボーナス枠のメタデータが存在しない場合のみ0で初期化
            if (get_user_meta($user_id, '_setae_bonus_spider_limit', true) === '') {
                update_user_meta($user_id, '_setae_bonus_spider_limit', 0);
            }
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        $public_profile_url = '';
        if ($referral_code) {
            if (get_option('permalink_structure')) {
                $public_profile_url = home_url('/setae-user/' . rawurlencode($referral_code) . '/');
            } else {
                $public_profile_url = add_query_arg('setae_profile', $referral_code, home_url('/'));
            }
            $public_profile_url = add_query_arg('ref', $referral_code, $public_profile_url);
        }

        // Localize Script for Core (Pass API Root, Nonce, etc.)
        wp_localize_script('setae-app-core', 'SetaeSettings', array(
            'api_root' => esc_url_raw(rest_url()),
            'nonce' => wp_create_nonce('wp_rest'),
            'setae_nonce' => wp_create_nonce('setae_nonce'), // For Encyclopedia AJAX
            'ajax_url' => admin_url('admin-ajax.php'),
            'logout_url' => wp_logout_url(home_url()),
            'login_url' => wp_login_url(home_url('/')),
            'registration_url' => add_query_arg(array('register' => 1, 'from' => 'trial'), home_url('/')),
            'current_user_id' => $user_id,
            'guest_mode' => $is_guest_mode,
            'plugin_url' => SETAE_PLUGIN_URL, // Added for default images
            'site_url' => home_url('/'),
            'pwa' => array(
                'service_worker_url' => home_url('/setae-sw.js'),
                'manifest_url' => home_url('/setae-manifest.webmanifest'),
                'offline_url' => add_query_arg('try', 1, home_url('/')),
            ),
            'current_user' => array(
                'plan' => isset($profile['plan']) ? $profile['plan'] : null,
                'inventory' => isset($profile['inventory']) ? $profile['inventory'] : null,
                'nursery' => isset($profile['nursery']) ? $profile['nursery'] : null,
                'entitlements' => isset($profile['entitlements']) ? $profile['entitlements'] : null,
                'trial' => isset($profile['trial']) ? $profile['trial'] : null,
                'display_name' => $is_guest_mode ? '体験モード' : wp_get_current_user()->display_name,
                'email' => $is_guest_mode ? '' : wp_get_current_user()->user_email,
                'avatar' => $is_guest_mode ? '' : get_avatar_url($user_id),
                'is_premium' => $is_premium,
                'spider_count' => $spider_count, // 追加
                'spider_limit' => $spider_limit, // 追加
                'referral_code' => $referral_code,
                'public_handle' => $public_handle,
                'public_profile_url' => $public_profile_url,
                'referral_stats' => $this->get_referral_stats($user_id),
                'bonus_limit' => $bonus_limit,
                'cancel_timestamp' => $cancel_timestamp,
                'theme_preference' => $theme_preference,
                'show_care_focus' => $show_care_focus,
            )
        ));
        // ▲▲▲ 追加・修正ここまで ▲▲▲

        // ★追加: JS翻訳用のデータを渡す (wp_localize_script)
        // wp.i18n (JSON) が使えない環境でも確実に翻訳を適用するため
        $setae_i18n = array(
            // Generic
            'loading' => esc_html__('読み込み中...', 'setae-core'),
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
            'today' => esc_html__('今日', 'setae-core'),
            'yesterday' => esc_html__('昨日', 'setae-core'),
            'just_now' => esc_html__('たった今', 'setae-core'),
            'mins_ago' => esc_html__('分前', 'setae-core'),
            'hours_ago' => esc_html__('時間前', 'setae-core'),
            'days_ago' => esc_html__('日前', 'setae-core'),
            'months_ago' => esc_html__('ヶ月前', 'setae-core'),
            'years_ago' => esc_html__('年前', 'setae-core'),

            // Tabs & UI
            'overview' => esc_html__('概要', 'setae-core'),
            'history' => esc_html__('履歴', 'setae-core'),
            'settings_bl' => esc_html__('設定・繁殖募集', 'setae-core'),
            'settings_saved' => esc_html__('設定を保存しました', 'setae-core'),
            'spider_deleted' => esc_html__('削除しました', 'setae-core'), // 重複だが明示

            // ▼ ここから下を新規追加 (BL Settings)
            'bl_settings_title' => esc_html__('繁殖募集設定', 'setae-core'),
            'bl_settings_desc' => esc_html__('繁殖協力の募集状態や外部連絡先を設定します。', 'setae-core'),
            'current_status' => esc_html__('現在の状態', 'setae-core'),
            'status_private' => esc_html__('非公開（募集しない）', 'setae-core'),
            'status_recruiting' => esc_html__('募集中（公開）', 'setae-core'),
            'status_loaned' => esc_html__('募集終了', 'setae-core'),
            'bl_status_helper' => esc_html__('「募集中」にすると繁殖募集ボードへ表示されます。', 'setae-core'),
            'terms_conditions' => esc_html__('条件・補足', 'setae-core'),
            'bl_terms_helper' => esc_html__('条件と受渡方法の概要を記入し、連絡は外部連絡先で行ってください。', 'setae-core'),
            'save_settings' => esc_html__('設定を保存', 'setae-core'),

            // ▼ Overview & History
            'last_molt' => esc_html__('最終脱皮', 'setae-core'),
            'last_feed' => esc_html__('最終給餌', 'setae-core'),
            'last_repot' => esc_html__('最終植え替え', 'setae-core'),
            'last_water' => esc_html__('最終水やり', 'setae-core'),
            'cycle' => esc_html__('周期', 'setae-core'),
            'status_normal' => esc_html__('通常', 'setae-core'),
            'status_fasting' => esc_html__('拒食中', 'setae-core'),
            'status_pre_molt' => esc_html__('脱皮前', 'setae-core'),
            'status_post_molt' => esc_html__('脱皮後', 'setae-core'),
            'growth_log' => esc_html__('成長記録', 'setae-core'),
            'prey_preferences' => esc_html__('餌の傾向', 'setae-core'),
            'molt_history' => esc_html__('脱皮履歴', 'setae-core'),
            'repot_history' => esc_html__('植え替え履歴', 'setae-core'),
            'date' => esc_html__('日付', 'setae-core'),
            'interval' => esc_html__('間隔', 'setae-core'),
            'no' => esc_html__('番号', 'setae-core'),

            // ▼ List Labels
            'feed' => esc_html__('給餌', 'setae-core'),
            'molt' => esc_html__('脱皮', 'setae-core'),
            'water' => esc_html__('水やり', 'setae-core'),
            'repot' => esc_html__('植え替え', 'setae-core'),
            'shed' => esc_html__('脱皮', 'setae-core'),
            'unidentified' => esc_html__('未同定', 'setae-core'),
            'growth' => esc_html__('成長記録', 'setae-core'),
            'observation' => esc_html__('観察', 'setae-core'),
            'note' => esc_html__('メモ', 'setae-core'),
            'refused' => esc_html__('拒食', 'setae-core'),
        );
        wp_localize_script('setae-app-core', 'setaeI18n', $setae_i18n);

        wp_enqueue_script('setae-offline-store', SETAE_PLUGIN_URL . 'assets/js/modules/offline-store.js', array('jquery', 'setae-app-core'), $this->version, true);

        // Enqueue API Module (Depends on Core and the IndexedDB adapter)
        wp_enqueue_script('setae-app-api', SETAE_PLUGIN_URL . 'assets/js/modules/app-api.js', array('jquery', 'setae-app-core', 'setae-offline-store'), $this->version, true);

        // Enqueue UI Modules (Split Refactoring)
        $ui_deps = array('jquery', 'setae-app-core', 'setae-app-api'); // wp-i18n 削除

        // 1. Logic Sub-Modules
        wp_enqueue_script('setae-ui-actions', SETAE_PLUGIN_URL . 'assets/js/modules/ui/actions.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-qr', SETAE_PLUGIN_URL . 'assets/js/modules/ui/qr.js', array_merge($ui_deps, array('setae-qr-print', 'setae-jsqr')), $this->version, true);
        wp_enqueue_script('setae-ui-detail', SETAE_PLUGIN_URL . 'assets/js/modules/ui/detail.js', array_merge($ui_deps, array('setae-ui-qr')), $this->version, true);
        wp_enqueue_script('setae-ui-list', SETAE_PLUGIN_URL . 'assets/js/modules/ui/list.js', array_merge($ui_deps, array('setae-ui-detail')), $this->version, true);
        wp_enqueue_script('setae-ui-feeders', SETAE_PLUGIN_URL . 'assets/js/modules/ui/feeders.js', array_merge($ui_deps, array('setae-ui-detail', 'setae-ui-list')), $this->version, true);
        wp_enqueue_script('setae-ui-log-modal', SETAE_PLUGIN_URL . 'assets/js/modules/ui/log-modal.js', $ui_deps, $this->version, true);
        wp_enqueue_script('setae-ui-profile', SETAE_PLUGIN_URL . 'assets/js/modules/ui/profile.js', array_merge($ui_deps, array('qrcode-js')), $this->version, true); // New Profile Module
        wp_enqueue_script('setae-ui-add-spider', SETAE_PLUGIN_URL . 'assets/js/modules/ui/add-spider.js', $ui_deps, $this->version, true); // Add Spider Module
        wp_enqueue_script('setae-ui-baby', SETAE_PLUGIN_URL . 'assets/js/modules/ui/baby.js', array_merge($ui_deps, array('setae-ui-qr')), $this->version, true);
        wp_enqueue_script('setae-ui-encyclopedia', SETAE_PLUGIN_URL . 'assets/js/modules/ui/encyclopedia.js', $ui_deps, $this->version, true); // Encyclopedia Module

        // ▼ 追加: コミュニティ用モジュールを読み込む
        wp_enqueue_script('setae-ui-community', SETAE_PLUGIN_URL . 'assets/js/modules/ui/community.js', $ui_deps, $this->version, true);

        // 1.5 Desktop Specific Logic
        wp_enqueue_script('setae-ui-desktop', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-desktop.js', array('setae-ui-actions', 'jquery'), $this->version, true);

        // ▼ 追加: チュートリアルモジュール
        wp_enqueue_script('setae-app-tutorial', SETAE_PLUGIN_URL . 'assets/js/modules/app-tutorial.js', array('jquery'), $this->version, true);

        // 2. Controller (Renderer)
        // 2. Controller (Renderer)
        wp_enqueue_script('setae-app-ui-renderer', SETAE_PLUGIN_URL . 'assets/js/modules/app-ui-renderer.js', array('setae-ui-actions', 'setae-ui-qr', 'setae-ui-detail', 'setae-ui-list', 'setae-ui-feeders', 'setae-ui-log-modal', 'setae-ui-profile', 'setae-ui-baby'), $this->version, true);

        wp_enqueue_script('setae-pwa-client', SETAE_PLUGIN_URL . 'assets/js/modules/pwa-client.js', array('setae-app-ui-renderer', 'setae-offline-store'), $this->version, true);

        // 3. Main App Entry
        wp_enqueue_script('setae-app-main', SETAE_PLUGIN_URL . 'assets/js/setae-app.js', array('setae-app-ui-renderer', 'setae-ui-desktop', 'setae-pwa-client'), $this->version, true);
    }

    public function register_shortcodes()
    {
        add_shortcode('setae_dashboard', array($this, 'render_dashboard'));
    }

    public function is_app_page()
    {
        return class_exists('Setae_App_Shell')
            ? Setae_App_Shell::is_app_page_request()
            : false;
    }

    private function get_referral_stats($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return array(
                'total' => 0,
                'sources' => array(),
            );
        }

        $labels = array(
            'profile_qr' => '自分のQR',
            'shop_qr' => 'ショップ配布',
            'event_qr' => 'イベント配布',
            'public_profile' => '公開プロフィール',
            'unknown' => '未分類',
        );
        $counts = get_user_meta($user_id, '_setae_referral_source_counts', true);
        $counts = is_array($counts) ? $counts : array();
        $sources = array();

        foreach ($counts as $source => $count) {
            $source = sanitize_key($source);
            $count = (int) $count;
            if ($count < 1) {
                continue;
            }

            $sources[] = array(
                'source' => $source,
                'label' => isset($labels[$source]) ? $labels[$source] : $source,
                'count' => $count,
            );
        }

        usort($sources, function ($a, $b) {
            return $b['count'] <=> $a['count'];
        });

        return array(
            'total' => array_sum(array_map('intval', $counts)),
            'sources' => array_slice($sources, 0, 6),
        );
    }

    public function render_dashboard()
    {
        $guest_trial = !is_user_logged_in() && isset($_GET['try']) && '1' === sanitize_text_field(wp_unslash($_GET['try']));
        if (!is_user_logged_in() && !$guest_trial) {
            return '<div class="setae-login-message"><p>この機能を利用するには<a href="' . wp_login_url(get_permalink()) . '">ログイン</a>してください。</p></div>';
        }

        ob_start();
        include SETAE_PLUGIN_DIR . 'templates/dashboard.php';
        return ob_get_clean();
    }

}
