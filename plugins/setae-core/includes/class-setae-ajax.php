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
        add_action('wp_ajax_nopriv_setae_submit_species_edit', array($this, 'handle_submit_species_edit')); // ログイン不要にする場合
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
        // 1. 基本バリデーション
        $species_id = isset($_POST['species_id']) ? intval($_POST['species_id']) : 0;
        if (!$species_id) {
            wp_send_json_error('対象の種が不明です。');
        }

        $description = isset($_POST['suggested_description']) ? sanitize_textarea_field($_POST['suggested_description']) : '';
        $lifespan = isset($_POST['suggested_lifespan']) ? sanitize_text_field($_POST['suggested_lifespan']) : '';
        $size = isset($_POST['suggested_size']) ? sanitize_text_field($_POST['suggested_size']) : '';

        // 内容が空ならエラー
        if (empty($description) && empty($lifespan) && empty($size) && empty($_FILES['suggested_image']['name'])) {
            wp_send_json_error('提案内容が入力されていません。');
        }

        // 2. 提案用カスタム投稿 (setae_suggestion) として保存

        $target_species = get_post($species_id);
        $title = '修正提案: ' . $target_species->post_title . ' (by ' . (is_user_logged_in() ? wp_get_current_user()->display_name : 'Guest') . ')';

        $post_data = array(
            'post_type' => 'setae_suggestion',
            'post_title' => $title,
            'post_content' => $description, // 本文に提案テキストを入れる
            'post_status' => 'pending',    // 「レビュー待ち」状態
        );

        $suggestion_id = wp_insert_post($post_data);

        if (is_wp_error($suggestion_id)) {
            wp_send_json_error('保存に失敗しました。');
        }

        // 3. メタデータの保存
        update_post_meta($suggestion_id, '_target_species_id', $species_id);
        if ($lifespan)
            update_post_meta($suggestion_id, '_suggested_lifespan', $lifespan);
        if ($size)
            update_post_meta($suggestion_id, '_suggested_size', $size);

        // 4. 画像アップロード処理
        if (!empty($_FILES['suggested_image']['name'])) {
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');

            $attachment_id = media_handle_upload('suggested_image', $suggestion_id);

            if (!is_wp_error($attachment_id)) {
                // アイキャッチ画像として設定
                set_post_thumbnail($suggestion_id, $attachment_id);
            }
        }

        wp_send_json_success('提案を受け付けました');
    }
}
