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
        $filter_type = isset($_POST['filter_type']) ? sanitize_text_field($_POST['filter_type']) : '';
        $filter_value = isset($_POST['filter_value']) ? urldecode(sanitize_text_field($_POST['filter_value'])) : '';
        $sort = isset($_POST['sort']) ? sanitize_text_field($_POST['sort']) : 'name_asc';

        // 検索パラメータをプロパティにセット（フィルター内で使用）
        $this->search_params = [
            'keyword' => $search_query,
            'sort' => $sort
        ];

        // 基本クエリ
        $args = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 12,
            'paged' => $paged,
            'suppress_filters' => false, // フィルターを有効化
        );

        // --- フィルタリング (Taxonomy) ---
        // ここはWP_Query標準機能でOK
        if (!empty($filter_type) && !empty($filter_value) && $filter_type !== 'all') {
            $taxonomy = '';
            $term_value = $filter_value;

            switch ($filter_type) {
                case 'lifestyle':
                    $taxonomy = 'setae_lifestyle';
                    // 英語->日本語スラッグ変換マップ
                    $slug_map = [
                        'arboreal' => '樹上性',
                        'terrestrial' => '地表性',
                        'fossorial' => '地中性'
                    ];
                    if (isset($slug_map[$filter_value])) {
                        $term_value = $slug_map[$filter_value];
                    }
                    break;
                case 'habitat':
                case 'region':
                    $taxonomy = 'setae_habitat';
                    // 日本語エンコード対応は上でurldecode済み
                    break;
            }

            if ($taxonomy) {
                $args['tax_query'] = array(
                    array(
                        'taxonomy' => $taxonomy,
                        'field' => 'slug',
                        'terms' => $term_value,
                    ),
                );
            }
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
            ));
        } else {
            $html = '';
            if ($paged === 1) {
                $html = '<div class="no-results" style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">条件に一致する種が見つかりませんでした。</div>';
            }
            wp_send_json_success(array('html' => $html, 'max_page' => 0));
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
                " AND ({$wpdb->posts}.post_title LIKE %s OR mt1.meta_value LIKE %s) ",
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


    public function handle_register_user()
    {
        // 設定がOFFなら拒否
        if (!get_option('setae_enable_registration')) {
            wp_send_json_error('現在、新規登録は受け付けていません。');
        }

        // 入力データの取得とサニタイズ
        $username = isset($_POST['username']) ? sanitize_user($_POST['username']) : '';
        $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $password = isset($_POST['password']) ? $_POST['password'] : '';

        // バリデーション
        if (empty($username) || empty($email) || empty($password)) {
            wp_send_json_error('すべての項目を入力してください。');
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

        // 成功
        wp_send_json_success('登録完了');
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

        // 5. Handle Image Upload
        if (!empty($_FILES['profile_image'])) {
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

        if (isset($attachment_id) && !is_wp_error($attachment_id)) {
            $avatar_url = wp_get_attachment_url($attachment_id);
            wp_send_json_success(array(
                'message' => 'Profile updated',
                'avatar_url' => $avatar_url
            ));
        } else {
            wp_send_json_success(array('message' => 'Profile updated'));
        }
    }
    public function handle_submit_species_edit()
    {
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

        $post_data = array(
            'post_type' => 'setae_suggestion',
            'post_title' => $title,
            'post_content' => sanitize_textarea_field($_POST['suggested_description']),
            'post_status' => 'pending',
        );

        $suggestion_id = wp_insert_post($post_data);
        if (is_wp_error($suggestion_id))
            wp_send_json_error('保存に失敗しました。');

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

        // 画像処理 (変更なし)
        if (!empty($_FILES['suggested_image']['name'])) {
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
    public function handle_best_shot()
    {
        check_ajax_referer('setae_best_shot_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('You do not have permission.', 'setae'));
        }

        $type = isset($_POST['type']) ? sanitize_text_field($_POST['type']) : '';
        $log_id = isset($_POST['log_id']) ? intval($_POST['log_id']) : 0;
        $species_id = isset($_POST['species_id']) ? intval($_POST['species_id']) : 0;
        $image_id = isset($_POST['image_id']) ? intval($_POST['image_id']) : 0;

        if (!$log_id) {
            wp_send_json_error(__('Invalid request.', 'setae'));
        }

        if ($type === 'approve') {
            if (!$species_id || !$image_id) {
                wp_send_json_error(__('Required data is missing.', 'setae'));
            }

            // Species(図鑑)側のギャラリー配列に画像IDを追加
            $gallery = get_post_meta($species_id, '_setae_species_gallery', true);
            if (!is_array($gallery)) {
                $gallery = array();
            }

            // 重複チェックをして追加
            if (!in_array($image_id, $gallery)) {
                $gallery[] = $image_id;
                update_post_meta($species_id, '_setae_species_gallery', $gallery);
            }

            // ログのステータスを承認済みに変更
            update_post_meta($log_id, '_best_shot_status', 'approved');
            wp_send_json_success(__('Approved.', 'setae'));

        } elseif ($type === 'reject') {
            // ログのステータスを却下済みに変更
            update_post_meta($log_id, '_best_shot_status', 'rejected');
            wp_send_json_success(__('Rejected.', 'setae'));
        }

        wp_send_json_error(__('Invalid operation.', 'setae'));
    }
}
