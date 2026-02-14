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
    }

    /**
     * 図鑑の検索・ソート・ページネーション処理
     */
    /**
     * 図鑑データの検索・フィルタリング・ページネーション処理
     */
    public function search_species()
    {
        // セキュリティチェック
        check_ajax_referer('setae_nonce', 'nonce');

        $paged = isset($_POST['paged']) ? intval($_POST['paged']) : 1;
        $search_query = isset($_POST['search']) ? sanitize_text_field($_POST['search']) : '';
        $filter_type = isset($_POST['filter_type']) ? sanitize_text_field($_POST['filter_type']) : '';
        // ★修正: 日本語スラッグ対応のため urldecode する
        $filter_value = isset($_POST['filter_value']) ? urldecode(sanitize_text_field($_POST['filter_value'])) : '';
        $sort = isset($_POST['sort']) ? sanitize_text_field($_POST['sort']) : 'name_asc';

        $args = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 12,
            'paged' => $paged,
        );

        // --- 1. キーワード検索 ---
        if (!empty($search_query)) {
            $args['s'] = $search_query;
        }

        // --- 2. フィルタリング (タクソノミー変換) ---
        if (!empty($filter_type) && !empty($filter_value) && $filter_type !== 'all') {
            $taxonomy = '';

            // JSから送られてくる type を 正しいタクソノミー名に変換
            switch ($filter_type) {
                case 'lifestyle':
                    $taxonomy = 'setae_lifestyle'; // 樹上性・地表性など
                    break;
                case 'habitat': // HTMLの data-filter="habitat_..." に対応
                case 'region':  // 念のため region も対応
                    $taxonomy = 'setae_habitat';   // 生息地
                    break;
                // 必要に応じて他のタクソノミーも追加
            }

            if ($taxonomy) {
                $args['tax_query'] = array(
                    array(
                        'taxonomy' => $taxonomy,
                        'field' => 'slug',
                        'terms' => $filter_value, // urldecode済み
                    ),
                );
            }
        }

        // --- 3. ソート順設定 ---
        switch ($sort) {
            case 'name_asc': // 名前順 (A-Z)
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;

            case 'count_desc': // 人気順 (Keeping数)
                // 数値としてソートするために meta_value_num を指定
                $args['meta_key'] = 'keeping_count'; // ※実際のメタキーを確認してください
                $args['orderby'] = 'meta_value_num';
                $args['order'] = 'DESC';
                break;

            case 'diff_asc': // 難易度 (易しい順)
                // 難易度が数値保存されている前提 (1, 2, 3...)
                $args['meta_key'] = '_setae_difficulty_level'; // ※メタキーを確認
                $args['orderby'] = 'meta_value_num'; // または 'meta_value'
                $args['order'] = 'ASC';
                break;

            default:
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
        }

        // クエリ実行
        $query = new WP_Query($args);

        if ($query->have_posts()) {
            ob_start();
            while ($query->have_posts()) {
                $query->the_post();
                // パスは環境に合わせて調整してください
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
            // 該当なし
            $html = '';
            if ($paged === 1) {
                $html = '<div class="no-results" style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">条件に一致する種が見つかりませんでした。</div>';
            }
            wp_send_json_success(array('html' => $html, 'max_page' => 0));
        }

        wp_die();
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
}
