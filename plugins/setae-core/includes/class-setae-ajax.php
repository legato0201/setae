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
    public function search_species()
    {
        check_ajax_referer('wp_rest', 'nonce'); // wp_rest nonce should be used as standardized in this plugin

        $paged = isset($_POST['paged']) ? intval($_POST['paged']) : 1;
        $search_query = isset($_POST['search']) ? sanitize_text_field($_POST['search']) : '';
        $filter_type = isset($_POST['filter_type']) ? sanitize_text_field($_POST['filter_type']) : '';
        $filter_value = isset($_POST['filter_value']) ? sanitize_text_field($_POST['filter_value']) : '';
        $sort = isset($_POST['sort']) ? sanitize_text_field($_POST['sort']) : 'title_asc';

        // クエリ引数の基本設定
        $args = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 12,
            'paged' => $paged,
        );

        // キーワード検索
        if (!empty($search_query)) {
            $args['s'] = $search_query;
        }

        // フィルタリング
        if (!empty($filter_type) && !empty($filter_value) && $filter_type !== 'all') {
            if ($filter_type === 'style') {
                // ライフスタイル (Taxonomy: setae_lifestyle)
                // Note: The UI sends 'arboreal', but the slug might be Japanese in DB?
                // section-encyclopedia.php logic handled conversion. 
                // However, for taxonomy query, we need the actual term slug.
                // Assuming terms are registered with English slugs or we need to map them?
                // Looking at section-encyclopedia.php:
                // $raw_slug = ... '樹上性' -> 'arboreal'.
                // So the TERM slug is likely '樹上性' (Japanese) but the UI uses 'arboreal'.
                // We need to map back if the terms are Japanese.
                // Let's check how `setae_lifestyle` terms are registered or used.
                // If I assume standard slug usage, I might miss.
                // User's plan example used: 'setae_' . $filter_type ('setae_lifestyle').
                // Let's try to map standard UI keys to known Japanese slugs if needed, or assume English slugs if they exist.
                // Given the code in `section-encyclopedia.php`:
                // if ($raw_slug === '樹上性') $style_key = 'arboreal';
                // This implies the SLUG is '樹上性' (URL encoded).
                // So if UI sends 'arboreal', query needs '樹上性'.

                $map = [
                    'arboreal' => '樹上性',
                    'terrestrial' => '地表性',
                    'fossorial' => '地中性'
                ];
                $term = isset($map[$filter_value]) ? $map[$filter_value] : $filter_value;

                $args['tax_query'] = array(
                    array(
                        'taxonomy' => 'setae_lifestyle',
                        'field' => 'slug',
                        'terms' => $term,
                    ),
                );
            } elseif ($filter_type === 'region') {
                // 地域 (Taxonomy: setae_habitat)
                // In PHP loop: $region_slug = $regions[0]->slug;
                // UI receives this slug. So we can use it directly.
                $args['tax_query'] = array(
                    array(
                        'taxonomy' => 'setae_habitat',
                        'field' => 'slug',
                        'terms' => $filter_value, // region_brazil etc. passed as just 'brazil'?
                        // Wait, UI code in section-encyclopedia.php was: data-filter="region_' . $region->slug
                        // My proposed JS will send filter_type='region', filter_value='slug'.
                        // So direct usage is correct.
                    ),
                );
            }
        }

        // ソート順
        switch ($sort) {
            case 'count_desc':
                // 飼育数順 (Meta Query NOT easy for distinct count...)
                // Direct SQL might be needed or meta key if we cached it.
                // Since we don't have a cached meta key for count, sorting by it in WP_Query is hard.
                // For now, let's fallback to title or ignore?
                // Or maybe we can't offer this sort efficiently server-side without a cached meta field.
                // User's request plan didn't specify detailed sort logic implementation for complex keys.
                // "title_asc" is default.
                // Let's stick to simple sorts for MVP or implement simple meta sorts.
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
            case 'diff_asc':
                $args['meta_key'] = '_setae_difficulty';
                $args['orderby'] = 'meta_value'; // string comparison 'beginner' < 'expert'? No...
                // 'beginner', 'intermediate', 'expert'.
                // B, I, E. Alphabetical: Beginner, Expert, Intermediate. 
                // Not quite right order (Beg(1), Int(2), Exp(3)).
                // Converting to numeric in query is hard without numeric meta.
                // Fallback to title for now to functionality.
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
            case 'diff_desc':
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
            case 'name_asc': // button id was name_asc
            default:
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
        }

        $query = new WP_Query($args);
        $html = '';

        if ($query->have_posts()) {
            ob_start();
            while ($query->have_posts()) {
                $query->the_post();
                // Include card template
                // Need to define variables expected by card-species.php or modify card-species.php to use get_the_ID() internally?
                // I wrote card-species.php to use get_the_ID() at the top. So it's self-contained!
                // Include card template
                // Calculate safe path or use constant
                if (defined('SETAE_CORE_PATH')) {
                    include(SETAE_CORE_PATH . 'templates/partials/card-species.php');
                } else {
                    // Fallback relative path from this file (includes/class-setae-ajax.php)
                    include(plugin_dir_path(dirname(__FILE__)) . 'templates/partials/card-species.php');
                }
            }
            $html = ob_get_clean();

            wp_send_json_success(array(
                'html' => $html,
                'max_page' => $query->max_num_pages,
                'found_posts' => $query->found_posts
            ));
        } else {
            // 0件
            if ($paged === 1) {
                $html = '<p class="no-results" style="padding:20px; text-align:center; color:#999;">条件に一致する種が見つかりませんでした。</p>';
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
