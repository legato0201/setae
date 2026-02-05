<?php

/**
 * Handler for Community Topic-related API endpoints.
 */
class Setae_API_Topics
{
    public function register_routes()
    {
        $namespace = 'setae/v1';

        // 1. Get Topics List (既存)
        register_rest_route($namespace, '/topics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topics'),
            'permission_callback' => '__return_true',
        ));

        // 2. Create Topic (新規追加: トピック作成)
        register_rest_route($namespace, '/topics', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_topic'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        // 3. Get Topic Detail (新規追加: 詳細取得)
        register_rest_route($namespace, '/topics/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topic_detail'),
            'permission_callback' => '__return_true',
        ));

        // 4. Create Comment (新規追加: コメント投稿)
        register_rest_route($namespace, '/topics/(?P<id>\d+)/comments', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_comment'),
            'permission_callback' => array($this, 'check_auth'),
        ));
    }

    /**
     * Check if user is logged in
     */
    public function check_auth()
    {
        return is_user_logged_in();
    }

    public function get_topics($request)
    {
        $args = array(
            'post_type' => 'setae_topic',
            'posts_per_page' => 20,
            'post_status' => 'publish',
            'orderby' => 'date',
            'order' => 'DESC',
        );

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();

                $excerpt = get_the_excerpt();
                if (empty($excerpt)) {
                    $excerpt = wp_trim_words(get_the_content(), 20, '...');
                }

                $data[] = array(
                    'id' => get_the_ID(),
                    'title' => get_the_title(),
                    'date' => get_the_date('Y-m-d H:i:s'),
                    'excerpt' => $excerpt,
                    'author_name' => get_the_author(),
                    'comment_count' => get_comments_number(), // コメント数も返すように追加
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }

    /**
     * Create a new topic
     */
    public function create_topic($request)
    {
        $title = sanitize_text_field($request->get_param('title'));
        $content = sanitize_textarea_field($request->get_param('content'));

        if (empty($title)) {
            return new WP_Error('missing_title', 'タイトルは必須です', array('status' => 400));
        }

        $post_id = wp_insert_post(array(
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => 'publish',
            'post_type' => 'setae_topic',
            'post_author' => get_current_user_id(),
        ));

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        return new WP_REST_Response(array('id' => $post_id, 'message' => 'Topic created'), 201);
    }

    /**
     * Get single topic detail with comments
     */
    public function get_topic_detail($request)
    {
        $id = $request['id'];
        $post = get_post($id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        // コメントの取得
        $comments_query = get_comments(array(
            'post_id' => $id,
            'status' => 'approve',
            'orderby' => 'comment_date',
            'order' => 'ASC'
        ));

        $comments_data = array();
        foreach ($comments_query as $c) {
            $comments_data[] = array(
                'id' => $c->comment_ID,
                'author_name' => $c->comment_author,
                'date' => $c->comment_date,
                'content' => wpautop($c->comment_content), // 改行を反映
            );
        }

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => wpautop($post->post_content), // 改行を反映
            'date' => $post->post_date,
            'author_name' => get_the_author_meta('display_name', $post->post_author),
            'comments' => $comments_data
        );

        return new WP_REST_Response($data, 200);
    }

    /**
     * Post a comment to a topic
     */
    public function create_comment($request)
    {
        $id = $request['id']; // Topic ID
        $content = sanitize_textarea_field($request->get_param('content'));

        if (empty($content)) {
            return new WP_Error('missing_content', 'コメント内容を入力してください', array('status' => 400));
        }

        $user = wp_get_current_user();
        if (!$user->exists()) {
            return new WP_Error('unauthorized', 'ログインが必要です', array('status' => 401));
        }

        $comment_data = array(
            'comment_post_ID' => $id,
            'comment_content' => $content,
            'user_id' => $user->ID,
            'comment_author' => $user->display_name,
            'comment_author_email' => $user->user_email,
            'comment_approved' => 1, // 即時承認
        );

        $comment_id = wp_insert_comment($comment_data);

        if (!$comment_id) {
            return new WP_Error('save_error', 'コメントの保存に失敗しました', array('status' => 500));
        }

        return new WP_REST_Response(array('id' => $comment_id, 'message' => 'Comment added'), 201);
    }
}
