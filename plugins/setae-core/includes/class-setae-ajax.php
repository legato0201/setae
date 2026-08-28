<?php

class Setae_Ajax
{

    public function __construct()
    {
        // Hooks are registered by the loader in Setae_Core
        // But for explicit feature addition requested:
        add_action('wp_ajax_nopriv_setae_register_user', array($this, 'handle_register_user'));
        add_action('wp_ajax_setae_register_user', array($this, 'handle_register_user'));

        add_action('wp_ajax_setae_submit_species_edit', array($this, 'handle_submit_species_edit'));
        add_action('wp_ajax_nopriv_setae_submit_species_edit', array($this, 'handle_submit_species_edit'));

        // Encyclopedia AJAX
        add_action('wp_ajax_setae_search_species', array($this, 'search_species'));
        add_action('wp_ajax_nopriv_setae_search_species', array($this, 'search_species'));

        // ▼▼▼ 追加: Best Shot の承認・拒否 AJAXハンドラ ▼▼▼
        add_action('wp_ajax_setae_handle_best_shot', array($this, 'handle_best_shot'));

        // コミュニティの未読管理
        add_action('wp_ajax_setae_get_unread_community_count', array($this, 'get_unread_community_count'));
        add_action('wp_ajax_setae_update_com_last_checked', array($this, 'update_com_last_checked'));

        // Funnel metrics
        add_action('wp_ajax_setae_track_event', array($this, 'track_event'));
        add_action('wp_ajax_nopriv_setae_track_event', array($this, 'track_event'));
    }

    /**
     * 図鑑の検索・ソート・ページネーション処理
     */
    // 検索・ソート用の一時パラメータ保持プロパティ
    private $search_params = [];

    /**
     * 図鑑データの検索・フィルタリング・ページネーション処理
     */
    public function search_species()
    {
        check_ajax_referer('setae_nonce', 'nonce'); // JS側のnonce名に合わせる

        $paged = isset($_POST['paged']) ? intval($_POST['paged']) : 1;
        $search_query = isset($_POST['search']) ? sanitize_text_field($_POST['search']) : '';
        $filter_type = isset($_POST['filter_type']) ? sanitize_key($_POST['filter_type']) : '';
        $filter_value = isset($_POST['filter_value']) ? urldecode(sanitize_text_field($_POST['filter_value'])) : '';
        $lifestyle = isset($_POST['lifestyle']) ? sanitize_title($_POST['lifestyle']) : '';
        $habitat = isset($_POST['habitat']) ? sanitize_title($_POST['habitat']) : '';
        $content_filter = isset($_POST['content_filter']) ? sanitize_key($_POST['content_filter']) : 'all';
        $sort = isset($_POST['sort']) ? sanitize_key($_POST['sort']) : 'name_asc';

        // Backward compatibility for a cached version of the former single-filter UI.
        if (!$lifestyle && $filter_type === 'lifestyle') {
            $lifestyle = sanitize_title($filter_value);
        }
        if (!$habitat && in_array($filter_type, array('habitat', 'region'), true)) {
            $habitat = sanitize_title($filter_value);
        }

        // 検索パラメータをプロパティにセット（フィルター内で使用）
        $this->search_params = [
            'keyword' => $search_query,
            'sort' => $sort
        ];

        // 基本クエリ
        $args = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 18,
            'paged' => $paged,
            'suppress_filters' => false, // フィルターを有効化
        );

        $tax_query = array('relation' => 'AND');
        if ($lifestyle) {
            $tax_query[] = array(
                'taxonomy' => 'setae_lifestyle',
                'field' => 'slug',
                'terms' => $lifestyle,
            );
        }
        if ($habitat) {
            $tax_query[] = array(
                'taxonomy' => 'setae_habitat',
                'field' => 'slug',
                'terms' => $habitat,
            );
        }
        if (count($tax_query) > 1) {
            $args['tax_query'] = $tax_query;
        }

        if ($content_filter === 'researched') {
            $args['meta_query'] = array(
                array(
                    'key' => '_setae_research_status',
                    'value' => array('draft', 'reviewed', 'verified'),
                    'compare' => 'IN',
                ),
            );
        } elseif ($content_filter === 'community') {
            global $wpdb;
            $community_ids = $wpdb->get_col(
                "SELECT DISTINCT CAST(species_pm.meta_value AS UNSIGNED)
                FROM {$wpdb->postmeta} species_pm
                INNER JOIN {$wpdb->posts} related_posts ON related_posts.ID = species_pm.post_id
                WHERE species_pm.meta_key IN ('_setae_species_id', '_setae_related_species_id')
                    AND related_posts.post_type IN ('setae_spider', 'setae_topic', 'setae_log')
                    AND related_posts.post_status = 'publish'"
            );
            $args['post__in'] = !empty($community_ids) ? array_map('absint', $community_ids) : array(0);
        } elseif ($content_filter === 'breeding') {
            global $wpdb;
            $breeding_ids = $wpdb->get_col(
                "SELECT DISTINCT CAST(species_pm.meta_value AS UNSIGNED)
                FROM {$wpdb->postmeta} species_pm
                INNER JOIN {$wpdb->posts} spiders ON spiders.ID = species_pm.post_id
                INNER JOIN {$wpdb->postmeta} status_pm
                    ON status_pm.post_id = spiders.ID
                    AND status_pm.meta_key = '_setae_bl_status'
                    AND status_pm.meta_value = 'recruiting'
                WHERE species_pm.meta_key = '_setae_species_id'
                    AND spiders.post_type = 'setae_spider'
                    AND spiders.post_status = 'publish'"
            );
            $args['post__in'] = !empty($breeding_ids) ? array_map('absint', $breeding_ids) : array(0);
        }

        // --- フックの登録 ---
        add_filter('posts_join', array($this, 'filter_posts_join'), 10, 2);
        add_filter('posts_where', array($this, 'filter_posts_where'), 10, 2);
        add_filter('posts_orderby', array($this, 'filter_posts_orderby'), 10, 2);

        // --- クエリ実行 ---
        $query = new WP_Query($args);

        // --- フックの解除 (他のクエリに影響しないように) ---
        remove_filter('posts_join', array($this, 'filter_posts_join'), 10);
        remove_filter('posts_where', array($this, 'filter_posts_where'), 10);
        remove_filter('posts_orderby', array($this, 'filter_posts_orderby'), 10);

        // 結果出力
        if ($query->have_posts()) {
            $GLOBALS['setae_species_card_query_ids'] = wp_list_pluck($query->posts, 'ID');
            ob_start();
            while ($query->have_posts()) {
                $query->the_post();
                // パス解決
                if (defined('SETAE_CORE_PATH')) {
                    include(SETAE_CORE_PATH . 'templates/partials/card-species.php');
                } else {
                    include(plugin_dir_path(dirname(__FILE__)) . 'templates/partials/card-species.php');
                }
            }
            $html = ob_get_clean();

            wp_send_json_success(array(
                'html' => $html,
                'max_page' => $query->max_num_pages,
                'total' => (int) $query->found_posts,
            ));
        } else {
            $html = '';
            if ($paged === 1) {
                $html = '<div class="no-results" style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">条件に一致する種が見つかりませんでした。</div>';
            }
            wp_send_json_success(array('html' => $html, 'max_page' => 0, 'total' => 0));
        }
        wp_die();
    }

    // ==========================================================
    //  以下、SQL書き換え用フィルターメソッド
    // ==========================================================

    /**
     * JOIN句の追加: メタデータを検索・ソートするためにpostmetaテーブルを結合
     */
    public function filter_posts_join($join, $query)
    {
        global $wpdb;

        // 和名検索用 (mt1)
        if (!empty($this->search_params['keyword'])) {
            $join .= " LEFT JOIN {$wpdb->postmeta} AS mt1 ON ({$wpdb->posts}.ID = mt1.post_id AND mt1.meta_key = '_setae_common_name_ja') ";
        }

        // ソート用 (mt2)
        $sort = isset($this->search_params['sort']) ? $this->search_params['sort'] : '';

        // ★修正: count_desc (人気順) はJOIN不要のため削除し、難易度順のみ残す
        if ($sort === 'diff_asc' || $sort === 'diff_desc') {
            // 難易度順: _setae_difficulty
            $join .= " LEFT JOIN {$wpdb->postmeta} AS mt2 ON ({$wpdb->posts}.ID = mt2.post_id AND mt2.meta_key = '_setae_difficulty') ";
        }
        if ($sort === 'research_recent') {
            $join .= " LEFT JOIN {$wpdb->postmeta} AS mt_research ON ({$wpdb->posts}.ID = mt_research.post_id AND mt_research.meta_key = '_setae_last_researched_at') ";
        }

        return $join;
    }

    /**
     * WHERE句の追加: タイトル(学名) OR 和名 で検索
     */
    public function filter_posts_where($where, $query)
    {
        global $wpdb;
        $keyword = isset($this->search_params['keyword']) ? $this->search_params['keyword'] : '';

        if (!empty($keyword)) {
            // エスケープ処理
            $like = '%' . $wpdb->esc_like($keyword) . '%';

            // タイトル OR 和名(mt1.meta_value)
            // 既存のWHERE句に追加する形にする
            $where .= $wpdb->prepare(
                " AND ({$wpdb->posts}.post_title LIKE %s OR mt1.meta_value LIKE %s OR EXISTS (
                    SELECT 1
                    FROM {$wpdb->term_relationships} enc_tr
                    INNER JOIN {$wpdb->term_taxonomy} enc_tt ON enc_tt.term_taxonomy_id = enc_tr.term_taxonomy_id
                    INNER JOIN {$wpdb->terms} enc_t ON enc_t.term_id = enc_tt.term_id
                    WHERE enc_tr.object_id = {$wpdb->posts}.ID
                        AND enc_tt.taxonomy = 'setae_genus'
                        AND enc_t.name LIKE %s
                )) ",
                $like,
                $like,
                $like
            );
        }
        return $where;
    }

    /**
     * ORDER BY句の書き換え: 特殊なソートロジックを適用
     */
    public function filter_posts_orderby($orderby, $query)
    {
        global $wpdb;
        $sort = isset($this->search_params['sort']) ? $this->search_params['sort'] : '';

        switch ($sort) {
            case 'name_asc':
                return "{$wpdb->posts}.post_title ASC";

            case 'count_desc':
                // ★修正: mt2を参照せず、サブクエリで直接カウントしてソートする
                return "(
                    SELECT COUNT(*)
                    FROM {$wpdb->postmeta} AS pm_count
                    INNER JOIN {$wpdb->posts} AS p_spider ON p_spider.ID = pm_count.post_id
                    WHERE pm_count.meta_key = '_setae_species_id'
                    AND pm_count.meta_value = {$wpdb->posts}.ID
                    AND p_spider.post_type = 'setae_spider'
                    AND p_spider.post_status = 'publish'
                ) DESC, {$wpdb->posts}.post_title ASC";

            case 'topic_recent':
                return "(
                    SELECT MAX(p_topic.post_modified_gmt)
                    FROM {$wpdb->postmeta} AS pm_topic_species
                    INNER JOIN {$wpdb->posts} AS p_topic ON p_topic.ID = pm_topic_species.post_id
                    WHERE pm_topic_species.meta_key = '_setae_related_species_id'
                    AND pm_topic_species.meta_value = {$wpdb->posts}.ID
                    AND p_topic.post_type = 'setae_topic'
                    AND p_topic.post_status = 'publish'
                ) DESC, {$wpdb->posts}.post_title ASC";

            case 'research_recent':
                return "COALESCE(NULLIF(mt_research.meta_value, ''), '0000-00-00T00:00:00Z') DESC, {$wpdb->posts}.post_title ASC";

            case 'diff_asc':
                // 難易度 (beginner -> intermediate -> expert)
                // 文字列なのでCASE文で数値化してソート
                return "CASE mt2.meta_value 
                        WHEN 'beginner' THEN 1 
                        WHEN 'intermediate' THEN 2 
                        WHEN 'expert' THEN 3 
                        ELSE 4 END ASC, {$wpdb->posts}.post_title ASC";

            // (必要であれば diff_desc も同様にCASE文で DESC にする)

            default:
                return $orderby;
        }
    }


    // ▼▼▼ 新規追加: ひらがな5文字のランダムコード生成メソッド ▼▼▼
    private function generate_hiragana_referral_code()
    {
        $hiragana = array('あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'ん');
        $code = '';
        for ($i = 0; $i < 5; $i++) {
            $code .= $hiragana[array_rand($hiragana)];
        }

        // 重複チェック
        global $wpdb;
        $exists = $wpdb->get_var($wpdb->prepare("SELECT user_id FROM $wpdb->usermeta WHERE meta_key = '_setae_referral_code' AND meta_value = %s", $code));
        if ($exists) {
            return $this->generate_hiragana_referral_code(); // 重複時は再生成
        }
        return $code;
    }
    // ▲▲▲ 新規追加ここまで ▲▲▲

    private function normalize_referral_source($source)
    {
        $source = sanitize_key((string) $source);
        $source = substr($source, 0, 48);

        return $source ?: 'unknown';
    }

    private function increment_referral_source_count($referrer_id, $source)
    {
        $referrer_id = absint($referrer_id);
        if (!$referrer_id) {
            return;
        }

        $source = $this->normalize_referral_source($source);
        $counts = get_user_meta($referrer_id, '_setae_referral_source_counts', true);
        $counts = is_array($counts) ? $counts : array();
        $counts[$source] = isset($counts[$source]) ? ((int) $counts[$source] + 1) : 1;

        update_user_meta($referrer_id, '_setae_referral_source_counts', $counts);
        update_user_meta($referrer_id, '_setae_referral_registration_count', array_sum(array_map('intval', $counts)));
        update_user_meta($referrer_id, '_setae_referral_last_registration_at', current_time('mysql'));
    }

    private function generate_unique_username_from_email($email)
    {
        $email_parts = explode('@', $email);
        $base = isset($email_parts[0]) ? sanitize_user($email_parts[0], true) : '';

        if (empty($base)) {
            $base = 'setae_user';
        }

        $candidate = $base;
        $suffix = 1;

        while (username_exists($candidate)) {
            $candidate = $base . $suffix;
            $suffix++;
        }

        return $candidate;
    }

    public function track_event()
    {
        $result = Setae_App_Operations::track_event(isset($_POST['event']) ? wp_unslash($_POST['event']) : '');
        if (is_wp_error($result)) {
            $status = (int) $result->get_error_data('status');
            wp_send_json_error($result->get_error_code(), $status ?: 400);
        }
        wp_send_json_success($result);
        return;

        $event = isset($_POST['event']) ? sanitize_key($_POST['event']) : '';

        if (empty($event)) {
            wp_send_json_error('missing_event');
        }

        $allowed_events = array(
            'public_home_view',
            'register_start',
            'register_referral_prefill',
            'register_submit_success',
            'register_referral_submit_success',
            'profile_public_link_copy',
            'profile_qr_open',
            'profile_qr_download',
            'profile_qr_link_copy',
            'profile_qr_source_change',
            'public_profile_view',
            'public_profile_link_copy',
            'public_profile_text_copy',
            'public_profile_x_click',
            'public_profile_line_click',
            'partner_page_view',
            'partner_page_link_copy',
            'partner_page_text_copy',
            'partner_page_x_click',
            'partner_page_line_click',
            'email_verified',
            'empty_my_spiders_seen',
            'my_spiders_filter_empty_seen',
            'my_spiders_filter_reset',
            'first_spider_start',
            'first_record_prompt_seen',
            'first_record_prompt_click',
            'daily_streak_panel_seen',
            'daily_streak_modal_seen',
            'daily_streak_calendar_open',
            'daily_streak_log_open',
            'daily_streak_quick_record_open',
            'daily_streak_share_to_feed',
            'daily_streak_invite_copy',
            'daily_streak_invite_x',
            'continue_spider_panel_seen',
            'continue_spider_open',
            'continue_spider_dismiss',
            'detail_spider_nav_click',
            'detail_topic_click',
            'encyclopedia_empty_seen',
            'encyclopedia_empty_reset',
            'encyclopedia_empty_topic_cta',
            'spider_create_success',
            'spider_first_photo_add',
            'baby_group_create',
            'baby_bulk_update',
            'baby_filter_change',
            'baby_codes_copy',
            'baby_label_print',
            'baby_csv_download',
            'baby_range_select',
            'baby_bulk_invalid_block',
            'baby_bulk_large_dead_confirm',
            'today_check_record_click',
            'today_check_topic_click',
            'log_date_quick_select',
            'log_draft_restored',
            'log_draft_discard',
            'log_note_template_click',
            'log_feed_choice_saved',
            'log_save_next_click',
            'log_create_success',
            'log_create_error',
            'care_feed_share_success',
            'care_feed_share_link_copy',
            'care_feed_share_text_copy',
            'care_feed_share_x',
            'care_feed_share_line',
            'care_feed_activity_panel_seen',
            'care_feed_activity_open',
            'care_feed_quick_comment_select',
            'care_feed_comment_success',
            'care_feed_comment_cta_open',
            'care_feed_preview_comment_open',
            'care_feed_comments_empty_focus',
            'care_feed_reply_start',
            'care_feed_reply_success',
            'care_feed_reply_parent_open',
            'care_feed_sort_change',
            'care_feed_empty_seen',
            'care_feed_empty_filter_reset',
            'care_feed_empty_record_cta',
            'care_share_view',
            'care_share_link_copy',
            'care_share_text_copy',
            'care_share_x_click',
            'care_share_line_click',
            'bl_empty_seen',
            'bl_empty_my_spiders_cta',
            'bl_empty_board_cta',
            'topic_comment_success',
            'topic_draft_restored',
            'topic_draft_discard',
            'topic_comment_template_select',
            'topic_comment_empty_focus',
            'topic_comment_reply_start',
            'topic_comment_read_from_start',
            'community_empty_seen',
            'community_empty_reset',
            'community_empty_topic_cta',
            'community_topic_created_open_detail',
        );

        if (!in_array($event, $allowed_events, true)) {
            wp_send_json_error('invalid_event');
        }

        $day_key = 'setae_metrics_' . gmdate('Ymd');
        $metrics = get_option($day_key, array());

        if (!is_array($metrics)) {
            $metrics = array();
        }

        if (!isset($metrics[$event])) {
            $metrics[$event] = 0;
        }

        $metrics[$event]++;
        update_option($day_key, $metrics, false);

        wp_send_json_success(array('event' => $event, 'count' => $metrics[$event]));
    }

    public function handle_register_user()
    {
        $result = Setae_App_Operations::register_user(wp_unslash($_POST));
        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            $status = is_array($data) ? absint($data['status'] ?? 0) : 0;
            wp_send_json_error($result->get_error_message(), $status ?: 400);
        }
        wp_send_json_success($result['message']);
        return;

        // 設定がOFFなら拒否
        if (!get_option('setae_enable_registration')) {
            wp_send_json_error('現在、新規登録は受け付けていません。');
        }

        // ▼▼▼ 新規追加: IPアドレスの取得と重複チェック ▼▼▼
        $client_ip = '';
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $client_ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $client_ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]; // プロキシ経由時の元のIPを取得
        } else {
            $client_ip = $_SERVER['REMOTE_ADDR'];
        }
        $client_ip = sanitize_text_field(trim($client_ip));

        global $wpdb;
        // 修正: 存在チェックではなく、同一IPの登録数をカウントする
        $ip_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(user_id) FROM $wpdb->usermeta WHERE meta_key = '_setae_registration_ip' AND meta_value = %s",
            $client_ip
        ));

        // 3アカウント以上登録されている場合はブロック
        if ($ip_count >= 3) {
            wp_send_json_error('このネットワーク（IPアドレス）からの登録上限（3アカウント）に達しています。不正利用防止のため、これ以上の作成はできません。');
        }
        // ▲▲▲ 新規追加ここまで ▲▲▲

        // 入力データの取得とサニタイズ
        $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $username = isset($_POST['username']) ? sanitize_user($_POST['username'], true) : '';
        $password = isset($_POST['password']) ? $_POST['password'] : '';

        // ▼▼▼ 追加: 紹介コードの取得 ▼▼▼
        $referral_code = isset($_POST['referral_code']) ? sanitize_text_field($_POST['referral_code']) : '';
        $referral_source = isset($_POST['referral_source']) ? $this->normalize_referral_source($_POST['referral_source']) : 'unknown';
        $qr_claim_code = isset($_POST['qr_claim_code']) && class_exists('Setae_QR_Manager')
            ? Setae_QR_Manager::sanitize_code(wp_unslash($_POST['qr_claim_code']))
            : '';
        // ▲▲▲ 追加ここまで ▲▲▲

        // バリデーション
        if (empty($email) || empty($password)) {
            wp_send_json_error('メールアドレスとパスワードを入力してください。');
        }

        if (!is_email($email)) {
            wp_send_json_error('メールアドレスの形式を確認してください。');
        }

        if (empty($username)) {
            $username = $this->generate_unique_username_from_email($email);
        }

        if (username_exists($username)) {
            wp_send_json_error('このユーザー名は既に使用されています。');
        }

        if (email_exists($email)) {
            wp_send_json_error('このメールアドレスは既に登録されています。');
        }

        // ユーザー作成
        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            wp_send_json_error($user_id->get_error_message());
        }

        // ▼▼▼ 新規追加: 登録成功時にIPアドレスをユーザーメタとして保存 ▼▼▼
        update_user_meta($user_id, '_setae_registration_ip', $client_ip);
        // ▲▲▲ 新規追加ここまで ▲▲▲

        // ▼▼▼ 新規追加: 紹介コードの生成とボーナス枠付与の処理 ▼▼▼

        // 1. 新規ユーザー自身の紹介コードを生成して保存（ひらがな5文字）
        $new_user_referral_code = $this->generate_hiragana_referral_code();
        update_user_meta($user_id, '_setae_referral_code', $new_user_referral_code);

        // デフォルトのボーナス枠を0で初期化
        update_user_meta($user_id, '_setae_bonus_spider_limit', 0);
        update_user_meta($user_id, '_setae_registration_source', $referral_source);
        if ($qr_claim_code && class_exists('Setae_QR_Manager')) {
            Setae_QR_Manager::store_pending_claim($user_id, $qr_claim_code);
        }

        // 2. 紹介コードが入力されている場合の処理
        if (!empty($referral_code)) {
            // 紹介コードを持つ既存ユーザーを検索
            $referrers = get_users(array(
                'meta_key' => '_setae_referral_code',
                'meta_value' => $referral_code,
                'number' => 1,
                'fields' => 'ids' // ユーザーIDのみ取得して軽量化
            ));

            if (!empty($referrers)) {
                $referrer_id = $referrers[0];

                // 紹介された側（新規ユーザー）のボーナス枠を+1
                $current_bonus_new = (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true);
                update_user_meta($user_id, '_setae_bonus_spider_limit', $current_bonus_new + 1);

                // 紹介した側（既存ユーザー）のボーナス枠を+1
                $current_bonus_ref = (int) get_user_meta($referrer_id, '_setae_bonus_spider_limit', true);
                update_user_meta($referrer_id, '_setae_bonus_spider_limit', $current_bonus_ref + 1);
                update_user_meta($user_id, '_setae_referred_by_user_id', $referrer_id);
                update_user_meta($user_id, '_setae_referral_source', $referral_source);
                $this->increment_referral_source_count($referrer_id, $referral_source);
            }
        }
        // ▲▲▲ 新規追加ここまで ▲▲▲

        // ▼▼▼ 修正: ここから仮登録（メール送信）処理を追加 ▼▼▼

        // 1. 本登録用のセキュアなランダムトークンを生成・保存
        $activation_token = bin2hex(random_bytes(16));
        update_user_meta($user_id, '_setae_activation_token', $activation_token);
        update_user_meta($user_id, '_setae_is_verified', 0); // 未認証(0)としてマーク

        // 2. 認証用URLの生成 (パラメータとして付与)
        $verify_url = add_query_arg(
            array(
                'setae_action' => 'verify_email',
                'uid' => $user_id,
                'token' => $activation_token
            ),
            home_url('/') // トップページにリダイレクト
        );

        // 3. 認証メールの送信
        $subject = '【Setae】アカウント仮登録のお知らせと本登録のお願い';
        $message = "{$username} 様\n\n";
        $message .= "Setaeへのアカウント作成リクエストを受け付けました。\n";
        $message .= "以下のURLにアクセスして、本登録を完了させてください。\n\n";
        $message .= "{$verify_url}\n\n";
        $message .= "※お心当たりのない場合は、このメールを破棄してください。\n";

        wp_mail($email, $subject, $message);

        // 成功レスポンスの文言を変更
        wp_send_json_success('仮登録が完了しました。入力されたメールアドレスに認証リンクを送信しましたので、ご確認ください。');

        // ▲▲▲ 修正ここまで ▲▲▲
    }

    public function update_profile()
    {
        // 1. Verify Nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'wp_rest')) {
            wp_send_json_error(array('message' => 'Invalid nonce'), 403);
        }

        // 2. Check Permissions
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => 'Not logged in'), 401);
        }

        $result = Setae_App_Operations::update_profile(
            get_current_user_id(),
            wp_unslash($_POST),
            $_FILES
        );
        if (is_wp_error($result)) {
            $status = (int) $result->get_error_data('status');
            wp_send_json_error(array('message' => $result->get_error_message()), $status ?: 400);
        }
        $legacy_result = array(
            'message' => 'Profile updated',
            'theme_preference' => $result['theme_preference'],
            'show_care_focus' => $result['show_care_focus'],
            'avatar_url' => $result['avatar_url'],
        );
        wp_send_json_success($legacy_result);
        return;

        $user_id = get_current_user_id();

        // 3. Prepare Update Data
        $userdata = array('ID' => $user_id);

        if (isset($_POST['display_name'])) {
            $userdata['display_name'] = sanitize_text_field($_POST['display_name']);
        }

        if (isset($_POST['email'])) {
            // Email validation could go here
            $userdata['user_email'] = sanitize_email($_POST['email']);
        }

        if (isset($_POST['password']) && !empty($_POST['password'])) {
            $userdata['user_pass'] = $_POST['password']; // wp_update_user handles hashing
        }

        // 4. Update User
        $user_id = wp_update_user($userdata);

        if (is_wp_error($user_id)) {
            wp_send_json_error(array('message' => $user_id->get_error_message()), 500);
        }

        if (isset($_POST['theme_preference'])) {
            $theme_preference = sanitize_key(wp_unslash($_POST['theme_preference']));
            if (!in_array($theme_preference, array('light', 'dark', 'system'), true)) {
                wp_send_json_error(array('message' => '表示テーマの値が正しくありません。'), 400);
            }
            update_user_meta($user_id, '_setae_theme_preference', $theme_preference);
        }

        if (isset($_POST['show_care_focus'])) {
            $show_care_focus = in_array(
                sanitize_key(wp_unslash($_POST['show_care_focus'])),
                array('1', 'true', 'on'),
                true
            );
            update_user_meta($user_id, '_setae_show_care_focus', $show_care_focus ? '1' : '0');
        }

        // 5. Handle Image Upload (with strict validation)
        if (!empty($_FILES['profile_image']) && !empty($_FILES['profile_image']['name'])) {
            $file = $_FILES['profile_image'];

            // サイズチェック (例: 2MB)
            if ($file['size'] > 2 * 1024 * 1024) {
                wp_send_json_error(array('message' => 'プロフィール画像は2MB以下にしてください。'), 400);
            }

            // MIMEタイプチェック
            $check = @getimagesize($file['tmp_name']);
            $allowed = array('image/jpeg', 'image/png', 'image/webp'); // GIF exclude on profile if you want, or include
            if ($check === false || !in_array($check['mime'], $allowed)) {
                wp_send_json_error(array('message' => '無効な画像形式です。JPG, PNG, WEBPのみ対応しています。'), 400);
            }

            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');

            $attachment_id = media_handle_upload('profile_image', 0); // 0 = not attached to a post

            if (is_wp_error($attachment_id)) {
                wp_send_json_error(array('message' => '画像のアップロードに失敗しました: ' . $attachment_id->get_error_message()));
            } else {
                update_user_meta($user_id, 'setae_user_avatar', $attachment_id);
            }
        }

        $saved_theme_preference = sanitize_key(
            get_user_meta($user_id, '_setae_theme_preference', true)
        );
        if (!in_array($saved_theme_preference, array('light', 'dark', 'system'), true)) {
            $saved_theme_preference = 'system';
        }
        $saved_care_focus = get_user_meta($user_id, '_setae_show_care_focus', true);
        $response_data = array(
            'message' => 'Profile updated',
            'theme_preference' => $saved_theme_preference,
            'show_care_focus' => $saved_care_focus === ''
                ? true
                : !in_array((string) $saved_care_focus, array('0', 'false', 'off'), true),
        );
        if (isset($attachment_id) && !is_wp_error($attachment_id)) {
            $response_data['avatar_url'] = wp_get_attachment_url($attachment_id);
        }

        wp_send_json_success($response_data);
    }
    public function handle_submit_species_edit()
    {
        $result = Setae_App_Operations::submit_species_suggestion(
            wp_unslash($_POST),
            $_FILES,
            get_current_user_id()
        );
        if (is_wp_error($result)) {
            $status = (int) $result->get_error_data('status');
            wp_send_json_error($result->get_error_message(), $status ?: 400);
        }
        wp_send_json_success($result['message']);
        return;

        // ... (冒頭のIDチェック等は同じ) ...
        $species_id = isset($_POST['species_id']) ? intval($_POST['species_id']) : 0;
        if (!$species_id)
            wp_send_json_error('対象の種が不明です。');

        // タイトルの生成
        $target_species = get_post($species_id);
        $req_name = isset($_POST['species_name']) ? sanitize_text_field($_POST['species_name']) : $target_species->post_title;
        $title = '修正提案: ' . $req_name;
        if (is_user_logged_in()) {
            $title .= ' (by ' . wp_get_current_user()->display_name . ')';
        }

        $suggested_description = isset($_POST['suggested_description']) ? sanitize_textarea_field($_POST['suggested_description']) : '';

        // ▼ 文字数制限の追加 (例: 2000文字以内)
        if (mb_strlen($suggested_description) > 2000) {
            wp_send_json_error('提案の説明は2000文字以内で入力してください。');
        }

        $post_data = array(
            'post_type' => 'setae_suggestion',
            'post_title' => $title,
            'post_content' => $suggested_description,
            'post_status' => 'pending',
        );

        $suggestion_id = wp_insert_post($post_data);
        if (is_wp_error($suggestion_id)) {
            wp_send_json_error('保存に失敗しました。');
        }

        // メタデータの保存
        update_post_meta($suggestion_id, '_target_species_id', $species_id);

        $fields = [
            'suggested_common_name_ja',
            'suggested_lifestyle',
            'suggested_temperature',
            'suggested_humidity', // ★追加
            'suggested_lifespan',
            'suggested_size'
        ];

        foreach ($fields as $field) {
            if (isset($_POST[$field])) {
                update_post_meta($suggestion_id, '_' . $field, sanitize_text_field($_POST[$field]));
            }
        }

        // 性格 (カンマ区切りで来るので、そのまま保存するか配列にするか)
        if (isset($_POST['suggested_temperament_ids'])) {
            // カンマ区切り文字列として保存 (承認時に展開)
            update_post_meta($suggestion_id, '_suggested_temperament_ids', sanitize_text_field($_POST['suggested_temperament_ids']));
        }

        // 画像処理 (with strict validation)
        if (!empty($_FILES['suggested_image']['name'])) {
            $file = $_FILES['suggested_image'];

            // サイズチェック (例: 5MB)
            if ($file['size'] > 5 * 1024 * 1024) {
                wp_send_json_error('画像サイズは5MB以下にしてください。');
            }

            // MIMEタイプチェック
            $check = @getimagesize($file['tmp_name']);
            $allowed = array('image/jpeg', 'image/png', 'image/webp', 'image/gif');
            if ($check === false || !in_array($check['mime'], $allowed)) {
                wp_send_json_error('無効な画像形式です。');
            }

            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');
            $attachment_id = media_handle_upload('suggested_image', $suggestion_id);
            if (!is_wp_error($attachment_id)) {
                set_post_thumbnail($suggestion_id, $attachment_id);
            }
        }

        wp_send_json_success('提案を受け付けました');
    }

    // ▼▼▼ 追加: Best Shot の承認・拒否処理 ▼▼▼
    // ▼▼▼ 追加: Best Shot の承認・拒否・取り消し処理 ▼▼▼
    public function handle_best_shot()
    {
        check_ajax_referer('setae_best_shot_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('権限がありません。', 'setae'));
        }

        $params = wp_unslash($_POST);
        $params['action'] = isset($params['type']) ? $params['type'] : '';
        $result = Setae_App_Operations::moderate_best_shot($params);
        if (is_wp_error($result)) {
            $status = (int) $result->get_error_data('status');
            wp_send_json_error($result->get_error_message(), $status ?: 400);
        }
        wp_send_json_success($result['message']);
        return;

        $type = isset($_POST['type']) ? sanitize_text_field($_POST['type']) : '';
        $log_id = isset($_POST['log_id']) ? intval($_POST['log_id']) : 0;
        $species_id = isset($_POST['species_id']) ? intval($_POST['species_id']) : 0;
        $image_id = isset($_POST['image_id']) ? intval($_POST['image_id']) : 0;

        if (!$log_id) {
            wp_send_json_error(__('不正なリクエストです。', 'setae'));
        }

        // ▼ 修正: approve と revoke 両方に対応
        if ($type === 'approve' || $type === 'revoke') {
            if (!$species_id) {
                wp_send_json_error(__('必要なデータが不足しています。', 'setae'));
            }

            // 画像URLを取得（図鑑API側は画像のURLを配列として読み込んでいるため）
            $image_url = get_post_meta($log_id, '_setae_log_image', true);
            if (!$image_url && $image_id) {
                $image_url = wp_get_attachment_url($image_id);
            }

            // Species(図鑑)側のギャラリー配列を取得 (キーをAPI側の _setae_featured_images に合わせる)
            $gallery = get_post_meta($species_id, '_setae_featured_images', true);
            if (!is_array($gallery)) {
                $gallery = array();
            }

            // URLが配列の何番目にあるか探す
            $index = array_search($image_url, $gallery);

            if ($type === 'approve') {
                if ($index === false) {
                    $gallery[] = $image_url;
                    update_post_meta($species_id, '_setae_featured_images', $gallery);
                }
                // ログのステータスを承認済みに変更
                update_post_meta($log_id, '_best_shot_status', 'approved');
                $author_id = get_post_field('post_author', $log_id);
                if ($author_id) {
                    $current_bonus = (int) get_user_meta($author_id, '_setae_bonus_spider_limit', true);
                    update_user_meta($author_id, '_setae_bonus_spider_limit', $current_bonus + 1);
                }
                wp_send_json_success(__('承認してギャラリーに追加しました。', 'setae'));
            } elseif ($type === 'revoke') {
                if ($index !== false) {
                    unset($gallery[$index]);
                    $gallery = array_values($gallery); // 配列のインデックスを詰めて整える
                    update_post_meta($species_id, '_setae_featured_images', $gallery);
                }
                // ログのステータスを承認待ち（pending）に戻す
                update_post_meta($log_id, '_best_shot_status', 'pending');
                wp_send_json_success(__('承認を取り消し、ギャラリーから削除しました。', 'setae'));
            }

        } elseif ($type === 'reject') {
            // ログのステータスを却下済みに変更
            update_post_meta($log_id, '_best_shot_status', 'rejected');
            wp_send_json_success(__('申請を却下しました。', 'setae'));
        } else {
            // 上記以外のアクションはエラーにする
            wp_send_json_error(__('不正な操作です。', 'setae'));
        }
    }

    /**
     * コミュニティの未読コメント数を取得
     */
    public function get_unread_community_count()
    {
        $current_user_id = get_current_user_id();
        if (!$current_user_id)
            wp_send_json_error();

        $last_checked = get_user_meta($current_user_id, '_setae_com_last_checked', true);
        if (!$last_checked)
            $last_checked = '1970-01-01 00:00:00';

        global $wpdb;

        // 自分が関わるスレッドの、最終確認日時以降の「他人のコメント」をカウント
        $query = $wpdb->prepare("
            SELECT COUNT(DISTINCT c.comment_ID)
            FROM {$wpdb->comments} c
            INNER JOIN {$wpdb->posts} p ON c.comment_post_ID = p.ID
            WHERE p.post_type = 'setae_topic'
            AND c.comment_date > %s
            AND c.user_id != %d
            AND (
                p.post_author = %d
                OR p.ID IN (SELECT comment_post_ID FROM {$wpdb->comments} WHERE user_id = %d)
            )
        ", $last_checked, $current_user_id, $current_user_id, $current_user_id);

        $unread_count = (int) $wpdb->get_var($query);
        wp_send_json_success(array('count' => $unread_count));
    }

    /**
     * コミュニティタブ閲覧時に最終確認日時を更新（既読化）
     */
    public function update_com_last_checked()
    {
        $current_user_id = get_current_user_id();
        if ($current_user_id) {
            update_user_meta($current_user_id, '_setae_com_last_checked', current_time('mysql'));
            wp_send_json_success();
        }
    }
}
