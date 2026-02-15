<?php

/**
 * Handler for Community Topic-related API endpoints.
 */
class Setae_API_Topics
{
    public function register_routes()
    {
        $namespace = 'setae/v1';

        // 1. Get Topics List
        register_rest_route($namespace, '/topics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topics'),
            'permission_callback' => '__return_true',
        ));

        // 2. Create Topic
        register_rest_route($namespace, '/topics', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_topic'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        // 3. Get Topic Detail
        register_rest_route($namespace, '/topics/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topic_detail'),
            'permission_callback' => '__return_true',
        ));

        // 4. Create Comment
        register_rest_route($namespace, '/topics/(?P<id>\d+)/comments', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_comment'),
            'permission_callback' => array($this, 'check_auth'),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    /**
     * 連投制限チェック (スパム対策)
     */
    private function check_rate_limit($user_id)
    {
        $last_post = get_transient('setae_last_post_' . $user_id);
        if ($last_post) {
            return false;
        }
        set_transient('setae_last_post_' . $user_id, time(), 60); // 60秒制限
        return true;
    }

    public function get_topics($request)
    {
        $type = $request->get_param('type'); // カテゴリフィルタ
        $page = $request->get_param('page') ? intval($request->get_param('page')) : 1; // ★追加: ページ番号
        $per_page = 20; // ★設定: 1ページあたりの表示件数

        $args = array(
            'post_type' => 'setae_topic',
            'posts_per_page' => $per_page, // ★変更: 固定50から変数へ
            'paged' => $page, // ★追加: オフセット計算をWPに任せる
            'post_status' => 'publish',
            'orderby' => 'modified',
            'order' => 'DESC',
        );

        // カテゴリ絞り込み
        if (!empty($type) && $type !== 'all') {
            $args['meta_key'] = 'setae_topic_type';
            $args['meta_value'] = $type;
        }

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $id = get_the_ID();

                $excerpt = get_the_excerpt();
                if (empty($excerpt)) {
                    $excerpt = wp_trim_words(get_the_content(), 20, '...');
                }

                $topic_type = get_post_meta($id, 'setae_topic_type', true) ?: 'general';

                $data[] = array(
                    'id' => $id,
                    'title' => get_the_title(),
                    'date' => get_the_modified_date('Y-m-d H:i:s'), // 更新日時を返す
                    'excerpt' => $excerpt,
                    'author_name' => get_the_author(),
                    'comment_count' => get_comments_number(),
                    'type' => $topic_type, // カテゴリ
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        // ★追加: 次のページがあるか判定
        $has_next = $query->max_num_pages > $page;

        // ★変更: データとメタデータをラップして返す
        return new WP_REST_Response(array(
            'items' => $data,
            'has_next' => $has_next,
            'page' => $page
        ), 200);
    }

    public function create_topic($request)
    {
        $user_id = get_current_user_id();

        // スパム対策: 連投制限
        if (!$this->check_rate_limit($user_id)) {
            return new WP_Error('rate_limit', '投稿間隔が短すぎます。少し待ってから再試行してください。', array('status' => 429));
        }

        $title = sanitize_text_field($request->get_param('title'));
        $content = sanitize_textarea_field($request->get_param('content'));
        $type = sanitize_text_field($request->get_param('type')) ?: 'general';

        if (empty($title)) {
            return new WP_Error('missing_title', 'タイトルは必須です', array('status' => 400));
        }

        $post_id = wp_insert_post(array(
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => 'publish',
            'post_type' => 'setae_topic',
            'post_author' => $user_id,
        ));

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        update_post_meta($post_id, 'setae_topic_type', $type);

        return new WP_REST_Response(array('id' => $post_id, 'message' => 'Topic created'), 201);
    }

    public function get_topic_detail($request)
    {
        $id = $request['id'];
        $post = get_post($id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }


        // ▼ 追加: ページネーションパラメータ
        $page = $request->get_param('page') ? intval($request->get_param('page')) : 1;
        $per_page = 20; // 1回に読み込む件数
        $offset = ($page - 1) * $per_page;

        $comments_query = get_comments(array(
            'post_id' => $id,
            'status' => 'approve',
            'orderby' => 'comment_date',
            'order' => 'ASC',
            'number' => $per_page, // 取得数制限
            'offset' => $offset    // オフセット
        ));

        // ▼ 追加: 次のページがあるか確認
        $total_comments = get_comments(array('post_id' => $id, 'status' => 'approve', 'count' => true));
        $has_next = $total_comments > ($offset + $per_page);

        $comments_data = array();
        foreach ($comments_query as $c) {
            // ★追加: 画像URLを取得
            $image_url = get_comment_meta($c->comment_ID, 'setae_comment_image_url', true);

            $comments_data[] = array(
                'id' => $c->comment_ID,
                'author_name' => $c->comment_author,
                'date' => $c->comment_date,
                'content' => wpautop($c->comment_content),
                'image' => $image_url, // ★追加: レスポンスに含める
            );
        }

        $type = get_post_meta($post->ID, 'setae_topic_type', true) ?: 'general';

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => wpautop($post->post_content),
            'date' => $post->post_date,
            'author_name' => get_the_author_meta('display_name', $post->post_author),
            'type' => $type,
            'comments' => $comments_data,
            'has_next' => $has_next, // ▼ 追加: 次ページフラグ
            'page' => $page          // ▼ 追加: 現在ページ
        );

        return new WP_REST_Response($data, 200);
    }

    public function create_comment($request)
    {
        $user = wp_get_current_user();
        if (!$user->exists()) {
            return new WP_Error('unauthorized', 'ログインが必要です', array('status' => 401));
        }

        // スパム対策: 連投制限
        if (!$this->check_rate_limit($user->ID)) {
            return new WP_Error('rate_limit', '投稿間隔が短すぎます。少し待ってから再試行してください。', array('status' => 429));
        }

        $id = $request['id'];
        $content = sanitize_textarea_field($request->get_param('content'));

        // ▼ 追加: 文字数制限 (1000文字)
        if (mb_strlen($content) > 1000) {
            return new WP_Error('content_too_long', 'コメントは1000文字以内で入力してください', array('status' => 400));
        }

        // コンテンツも画像もない場合はエラー
        if (empty($content) && empty($_FILES['image']['name'])) {
            return new WP_Error('missing_content', 'コメントまたは画像を入力してください', array('status' => 400));
        }

        $comment_data = array(
            'comment_post_ID' => $id,
            'comment_content' => $content,
            'user_id' => $user->ID,
            'comment_author' => $user->display_name,
            'comment_author_email' => $user->user_email,
            'comment_approved' => 1,
        );

        $comment_id = wp_insert_comment($comment_data);

        if (!$comment_id) {
            return new WP_Error('save_error', 'コメントの保存に失敗しました', array('status' => 500));
        }

        // ▼ 追加: 画像アップロード処理 ===========================
        if (!empty($_FILES['image']['name'])) {
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');

            // メディアライブラリへアップロード
            $attachment_id = media_handle_upload('image', 0);

            if (!is_wp_error($attachment_id)) {
                $image_url = wp_get_attachment_url($attachment_id);
                // コメントメタとして保存
                add_comment_meta($comment_id, 'setae_comment_image_id', $attachment_id);
                add_comment_meta($comment_id, 'setae_comment_image_url', $image_url);
            }
        }
        // ▲ 追加ここまで =========================================

        // 活性化: 親トピックの更新日時を更新して一覧の上位に上げる
        wp_update_post(array(
            'ID' => $id,
            'post_modified' => current_time('mysql'),
            'post_modified_gmt' => current_time('mysql', 1)
        ));

        return new WP_REST_Response(array('id' => $comment_id, 'message' => 'Comment added'), 201);
    }
}