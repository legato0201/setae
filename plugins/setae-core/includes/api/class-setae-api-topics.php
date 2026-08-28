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

        register_rest_route($namespace, '/topics/unread', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_unread_topics'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/mark-read', array(
            'methods' => 'POST',
            'callback' => array($this, 'mark_all_topics_read'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/species-pulse', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_species_pulse'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        // 3. Get Topic Detail
        register_rest_route($namespace, '/topics/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topic_detail'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route($namespace, '/topics/(?P<id>\d+)/mark-read', array(
            'methods' => 'POST',
            'callback' => array($this, 'mark_topic_read'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/(?P<id>\d+)/reactions', array(
            'methods' => 'POST',
            'callback' => array($this, 'toggle_topic_reaction'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/(?P<id>\d+)/status', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_topic_status'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/(?P<id>\d+)/best-answer', array(
            'methods' => 'POST',
            'callback' => array($this, 'set_best_answer'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        // 4. Create Comment
        register_rest_route($namespace, '/topics/(?P<id>\d+)/comments', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_comment'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route($namespace, '/topics/comments/(?P<id>\d+)/reactions', array(
            'methods' => 'POST',
            'callback' => array($this, 'toggle_comment_reaction'),
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
        $per_page = $request->get_param('per_page') ? absint($request->get_param('per_page')) : 20;
        $per_page = max(1, min(20, $per_page));

        $search = $request->get_param('s');
        $sort = $request->get_param('sort') ?: 'updated';
        $scope = sanitize_key((string) $request->get_param('scope'));
        if (!in_array($scope, array('all', 'following', 'mine'), true)) {
            $scope = 'all';
        }
        $species_id = $this->normalize_related_species_id($request->get_param('species_id'));

        $args = array(
            'post_type' => 'setae_topic',
            'posts_per_page' => $per_page, // ★変更: 固定50から変数へ
            'paged' => $page, // ★追加: オフセット計算をWPに任せる
            'post_status' => 'publish',
        );

        $blocked_user_ids = Setae_API_Social::get_blocked_user_ids(get_current_user_id());
        if (!empty($blocked_user_ids)) {
            $args['author__not_in'] = $blocked_user_ids;
        }

        if ($scope === 'mine') {
            $viewer_id = get_current_user_id();
            if ($viewer_id) {
                $args['author'] = $viewer_id;
            } else {
                $args['post__in'] = array(0);
            }
        } elseif ($scope === 'following') {
            $followed_user_ids = Setae_API_Social::get_followed_user_ids(get_current_user_id());
            if (!empty($followed_user_ids)) {
                $args['author__in'] = $followed_user_ids;
            } else {
                $args['post__in'] = array(0);
            }
        }

        // Sorting Logic
        if ($sort === 'newest') {
            $args['orderby'] = 'date';
            $args['order'] = 'DESC';
        } elseif ($sort === 'momentum') {
            $args['meta_key'] = '_setae_momentum';
            $args['orderby'] = 'meta_value_num';
            $args['order'] = 'DESC';
        } else {
            // Default: updated
            $args['orderby'] = 'modified';
            $args['order'] = 'DESC';
        }

        // Search Logic
        if (!empty($search)) {
            $args['s'] = $search;
        }

        $meta_filters = array();

        if ($species_id) {
            $meta_filters[] = array(
                'key' => '_setae_related_species_id',
                'value' => $species_id,
                'compare' => '=',
            );
        }

        if (!empty($type) && $type !== 'all') {
            $meta_filters[] = array(
                'key' => 'setae_topic_type',
                'value' => $type,
                'compare' => '=',
            );
        }

        if (!empty($meta_filters)) {
            if (isset($args['meta_key'])) {
                array_unshift($meta_filters, array(
                    'key' => $args['meta_key'],
                    'compare' => 'EXISTS',
                ));
                unset($args['meta_key']);
            }

            $args['meta_query'] = array_merge(array('relation' => 'AND'), $meta_filters);
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

                // ▼ 追加：投稿者情報の取得とアバターの処理
                $author_id = get_the_author_meta('ID');
                $author_name = get_the_author();
                $author_handle = Setae_Public_Identity::get_handle($author_id);

                $author_avatar = get_avatar_url($author_id);
                if ($author_avatar && strpos($author_avatar, 'mystery') !== false) {
                    $author_avatar = '';
                }

                // ▼ 追加：バッジ用データの取得
                $author_is_premium = in_array(Setae_Entitlements::peek_plan_id($author_id), array('breeder_starter', 'legacy_premium'), true);
                $author_bonus_slots = (int) get_user_meta($author_id, '_setae_bonus_spider_limit', true);
                // ▲ 追加ここまで

                $comment_count_args = array(
                    'post_id' => $id,
                    'status' => 'approve',
                    'count' => true,
                );
                if (!empty($blocked_user_ids)) {
                    $comment_count_args['user__not_in'] = $blocked_user_ids;
                }
                $comment_count = (int) get_comments($comment_count_args);
                $unread_count = is_user_logged_in() ? $this->get_topic_unread_count($id, get_current_user_id()) : 0;
                $is_resolved = $this->is_topic_resolved($id);
                $best_answer_id = (int) get_post_meta($id, '_setae_best_answer_comment_id', true);
                $related_species_id = (int) get_post_meta($id, '_setae_related_species_id', true);

                // 勢いの取得
                $momentum = get_post_meta($id, '_setae_momentum', true);
                if ($momentum === '') {
                    $momentum = 0;
                }

                // 最新のコメント2件を取得
                $latest_comment_args = array(
                    'post_id' => $id,
                    'status' => 'approve',
                    'orderby' => 'comment_date',
                    'order' => 'DESC',
                    'number' => 2
                );
                if (!empty($blocked_user_ids)) {
                    $latest_comment_args['user__not_in'] = $blocked_user_ids;
                }
                $latest_comments_query = get_comments($latest_comment_args);

                $latest_comments_html = '';
                if (!empty($latest_comments_query)) {
                    // 古い順に表示するためにリバース
                    $reversed_comments = array_reverse($latest_comments_query);
                    $res_offset = max(0, $comment_count - count($reversed_comments));

                    foreach ($reversed_comments as $index => $c) {
                        $res_num = $res_offset + $index + 1;
                        $c_author = htmlspecialchars($c->comment_author);
                        $c_content = wp_trim_words(strip_tags($c->comment_content), 30, '...');
                        $latest_comments_html .= '<div class="latest-comment"><span class="res-num">' . $res_num . ':</span> <span class="res-name">' . $c_author . '</span> <span class="res-text">' . $c_content . '</span></div>';
                    }
                }

                $created_at = get_the_date('Y-m-d H:i:s');
                $updated_at = get_the_modified_date('Y-m-d H:i:s');
                $is_edited = (int) get_post_modified_time('U', true, $id) > ((int) get_post_time('U', true, $id) + 60);

                $data[] = array(
                    'id' => $id,
                    'title' => get_the_title(),
                    'date' => $created_at,
                    'created_at' => $created_at,
                    'updated_at' => $updated_at,
                    'is_edited' => $is_edited,
                    'excerpt' => $excerpt,
                    'image' => $this->get_topic_image_url($id),
                    'image_alt' => sanitize_text_field(get_post_meta($id, '_setae_topic_image_alt', true)),
                    'has_cw' => (bool) get_post_meta($id, '_setae_topic_has_cw', true),
                    'author_id' => $author_id,
                    'author_name' => $author_name,
                    'author_handle' => $author_handle,
                    'author_avatar' => $author_avatar, // ▼ 追加
                    'author_initial' => mb_substr($author_name, 0, 1, 'UTF-8'), // ▼ 追加
                    'author_profile_url' => $this->get_user_public_profile_url($author_id),
                    'author_is_premium' => $author_is_premium, // ★追加
                    'author_bonus_slots' => $author_bonus_slots, // ★追加
                    'viewer_relationship' => Setae_API_Social::get_relationship(get_current_user_id(), $author_id),
                    'comment_count' => $comment_count,
                    'unread_count' => $unread_count,
                    'has_unread' => $unread_count > 0,
                    'is_resolved' => $is_resolved,
                    'best_answer_id' => $best_answer_id,
                    'has_best_answer' => $best_answer_id > 0,
                    'related_species' => $this->build_related_species_data($related_species_id),
                    'type' => $topic_type, // カテゴリ
                    'link' => get_permalink(),
                    'reactions' => $this->get_topic_reaction_summary($id),
                    'can_manage' => $this->current_user_can_manage_topic($id),
                    'is_archived' => $comment_count >= 1000,
                    'momentum' => round($momentum, 1),
                    'latest_comments' => $latest_comments_html
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

        $title = sanitize_text_field($request->get_param('title'));
        $content = trim(sanitize_textarea_field($request->get_param('content')));
        $type = sanitize_text_field($request->get_param('type')) ?: 'general';
        $related_species_id = $this->normalize_related_species_id($request->get_param('related_species_id'));
        $has_cw = rest_sanitize_boolean($request->get_param('has_cw'));
        $image_alt = sanitize_text_field($request->get_param('image_alt'));
        if (function_exists('mb_substr')) {
            $image_alt = mb_substr($image_alt, 0, 300, 'UTF-8');
        } else {
            $image_alt = substr($image_alt, 0, 300);
        }

        if (empty($title)) {
            return new WP_Error('missing_title', 'タイトルは必須です', array('status' => 400));
        }

        if (empty($content) && empty($_FILES['image']['name'])) {
            return new WP_Error('missing_content', '本文または画像を追加してください', array('status' => 400));
        }

        $image_validation = $this->validate_topic_image_upload();
        if (is_wp_error($image_validation)) {
            return $image_validation;
        }

        // スパム対策: 入力チェックが通った投稿だけ連投制限の対象にする
        if (!$this->check_rate_limit($user_id)) {
            return new WP_Error('rate_limit', '投稿間隔が短すぎます。少し待ってから再試行してください。', array('status' => 429));
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
        if ($related_species_id) {
            update_post_meta($post_id, '_setae_related_species_id', $related_species_id);
        }
        if ($has_cw) {
            update_post_meta($post_id, '_setae_topic_has_cw', 1);
        }

        $image_url = '';
        if (!empty($_FILES['image']['name'])) {
            $image_result = $this->handle_topic_image_upload($post_id);
            if (is_wp_error($image_result)) {
                wp_delete_post($post_id, true);
                delete_transient('setae_last_post_' . $user_id);
                return $image_result;
            }
            $image_url = $image_result;
            if ($image_alt) {
                update_post_meta($post_id, '_setae_topic_image_alt', $image_alt);
            }
        }

        return new WP_REST_Response(array(
            'id' => $post_id,
            'image' => $image_url,
            'image_alt' => $image_alt,
            'message' => 'トピックを作成しました',
        ), 201);
    }

    public function get_topic_detail($request)
    {
        $id = $request['id'];
        $post = get_post($id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        if (Setae_API_Social::is_user_blocked(get_current_user_id(), (int) $post->post_author)) {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }


        // ▼ 追加: ページネーションパラメータ
        $page = $request->get_param('page') ? intval($request->get_param('page')) : 1;
        $per_page = 20; // 1回に読み込む件数
        $offset = ($page - 1) * $per_page;

        $blocked_user_ids = Setae_API_Social::get_blocked_user_ids(get_current_user_id());
        $comment_args = array(
            'post_id' => $id,
            'status' => 'approve',
            'orderby' => 'comment_date',
            'order' => 'ASC',
            'number' => $per_page, // 取得数制限
            'offset' => $offset    // オフセット
        );
        if (!empty($blocked_user_ids)) {
            $comment_args['user__not_in'] = $blocked_user_ids;
        }
        $comments_query = get_comments($comment_args);

        // ▼ 追加: 次のページがあるか確認
        $total_args = array('post_id' => $id, 'status' => 'approve', 'count' => true);
        if (!empty($blocked_user_ids)) {
            $total_args['user__not_in'] = $blocked_user_ids;
        }
        $total_comments = get_comments($total_args);
        $has_next = $total_comments > ($offset + $per_page);
        $best_answer_id = (int) get_post_meta($post->ID, '_setae_best_answer_comment_id', true);

        $comments_data = array();
        foreach ($comments_query as $c) {
            // ★追加: 画像URLを取得
            $image_url = get_comment_meta($c->comment_ID, 'setae_comment_image_url', true);

            $c_author_id = $c->user_id;

            // ▼ 追加：コメント投稿者のバッジ用データ取得
            $c_is_premium = $c_author_id ? in_array(Setae_Entitlements::peek_plan_id($c_author_id), array('breeder_starter', 'legacy_premium'), true) : false;
            $c_bonus_slots = $c_author_id ? (int) get_user_meta($c_author_id, '_setae_bonus_spider_limit', true) : 0;
            // ▲ 追加ここまで

            $c_avatar = $c_author_id ? get_avatar_url($c_author_id) : get_avatar_url($c->comment_author_email);
            if ($c_avatar && strpos($c_avatar, 'mystery') !== false) {
                $c_avatar = '';
            }

            // ★追加: wpautop後に空の <p></p> を正規表現で削除
            $comment_content = wpautop(trim($c->comment_content));
            $comment_content = preg_replace('/<p>[\s\r\n]*<\/p>/i', '', $comment_content);

            $comments_data[] = array(
                'id' => $c->comment_ID,
                'author_name' => $c->comment_author,
                'author_handle' => $c_author_id ? Setae_Public_Identity::get_handle($c_author_id) : '',
                'author_profile_url' => $c_author_id ? $this->get_user_public_profile_url($c_author_id) : '',
                'author_avatar' => $c_avatar,
                'author_initial' => mb_substr($c->comment_author, 0, 1, 'UTF-8'),
                'author_is_premium' => $c_is_premium, // ★追加
                'author_bonus_slots' => $c_bonus_slots, // ★追加
                'date' => $c->comment_date,
                'content' => $comment_content, // ★変更
                'image' => $image_url, // ★追加: レスポンスに含める
                'reactions' => $this->get_comment_reaction_summary($c->comment_ID),
                'is_best_answer' => (int) $c->comment_ID === $best_answer_id,
            );
        }

        $type = get_post_meta($post->ID, 'setae_topic_type', true) ?: 'general';

        $author_id = $post->post_author;
        $author_name = get_the_author_meta('display_name', $author_id);
        $author_handle = Setae_Public_Identity::get_handle($author_id);
        $author_avatar = get_avatar_url($author_id);
        if ($author_avatar && strpos($author_avatar, 'mystery') !== false) {
            $author_avatar = '';
        }

        // ▼ 追加：トピック投稿者のバッジ用データ取得
        $author_is_premium = in_array(Setae_Entitlements::peek_plan_id($author_id), array('breeder_starter', 'legacy_premium'), true);
        $author_bonus_slots = (int) get_user_meta($author_id, '_setae_bonus_spider_limit', true);
        // ▲ 追加ここまで

        // ★追加: wpautop後に空の <p></p> を正規表現で削除
        $topic_content = wpautop(trim($post->post_content));
        $topic_content = preg_replace('/<p>[\s\r\n]*<\/p>/i', '', $topic_content);
        $related_species_id = (int) get_post_meta($post->ID, '_setae_related_species_id', true);

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $topic_content, // ★変更
            'image' => $this->get_topic_image_url($post->ID),
            'image_alt' => sanitize_text_field(get_post_meta($post->ID, '_setae_topic_image_alt', true)),
            'has_cw' => (bool) get_post_meta($post->ID, '_setae_topic_has_cw', true),
            'date' => $post->post_date,
            'created_at' => $post->post_date,
            'updated_at' => $post->post_modified,
            'is_edited' => strtotime($post->post_modified_gmt) > (strtotime($post->post_date_gmt) + 60),
            'author_id' => $author_id,
            'author_name' => $author_name,
            'author_handle' => $author_handle,
            'author_avatar' => $author_avatar,
            'author_initial' => mb_substr($author_name, 0, 1, 'UTF-8'),
            'author_profile_url' => $this->get_user_public_profile_url($author_id),
            'author_is_premium' => $author_is_premium, // ★追加
            'author_bonus_slots' => $author_bonus_slots, // ★追加
            'viewer_relationship' => Setae_API_Social::get_relationship(get_current_user_id(), $author_id),
            'type' => $type,
            'is_resolved' => $this->is_topic_resolved($post->ID),
            'best_answer_id' => $best_answer_id,
            'can_manage' => $this->current_user_can_manage_topic($post->ID),
            'related_species' => $this->build_related_species_data($related_species_id),
            'reactions' => $this->get_topic_reaction_summary($post->ID),
            'link' => get_permalink($post->ID),
            'comments' => $comments_data,
            'has_next' => $has_next, // ▼ 追加: 次ページフラグ
            'page' => $page          // ▼ 追加: 現在ページ
        );

        return new WP_REST_Response($data, 200);
    }

    public function get_unread_topics($request)
    {
        $user_id = get_current_user_id();
        $global_last_checked = get_user_meta($user_id, '_setae_com_last_checked', true);

        if (!$global_last_checked) {
            update_user_meta($user_id, '_setae_com_last_checked', current_time('mysql'));
            return new WP_REST_Response(array(
                'count' => 0,
                'raw_count' => 0,
                'topic_count' => 0,
                'items' => array(),
            ), 200);
        }

        $topic_ids = $this->get_user_related_topic_ids($user_id);
        $items = array();
        $raw_count = 0;

        foreach ($topic_ids as $topic_id) {
            $last_read = $this->get_topic_last_read($topic_id, $user_id);
            $unread_count = $this->count_topic_comments_after($topic_id, $user_id, $last_read);

            if ($unread_count <= 0) {
                continue;
            }

            $latest_comment = $this->get_latest_unread_topic_comment($topic_id, $user_id, $last_read);
            if (!$latest_comment) {
                continue;
            }

            $post = get_post($topic_id);
            if (!$post || $post->post_type !== 'setae_topic') {
                continue;
            }

            $raw_count += $unread_count;
            $items[] = array(
                'id' => (int) $topic_id,
                'title' => get_the_title($topic_id),
                'type' => get_post_meta($topic_id, 'setae_topic_type', true) ?: 'general',
                'reason' => (int) $post->post_author === (int) $user_id ? 'あなたのスレッドに返信' : '参加したスレッドに新着',
                'unread_count' => $unread_count,
                'latest_author' => $latest_comment->comment_author ?: 'ユーザー不明',
                'latest_excerpt' => wp_trim_words(wp_strip_all_tags($latest_comment->comment_content), 18, '...'),
                'latest_date' => $latest_comment->comment_date,
            );
        }

        usort($items, function ($a, $b) {
            return strtotime($b['latest_date']) <=> strtotime($a['latest_date']);
        });

        return new WP_REST_Response(array(
            'count' => min(99, $raw_count),
            'raw_count' => $raw_count,
            'topic_count' => count($items),
            'items' => array_slice($items, 0, 10),
        ), 200);
    }

    public function get_species_pulse($request)
    {
        global $wpdb;

        $limit = absint($request->get_param('limit'));
        if (!$limit) {
            $limit = 5;
        }
        $limit = min(10, $limit);

        $rows = $wpdb->get_results($wpdb->prepare("
            SELECT
                CAST(species_pm.meta_value AS UNSIGNED) AS species_id,
                COUNT(DISTINCT p.ID) AS topic_count,
                COUNT(DISTINCT CASE
                    WHEN status_pm.meta_value IS NULL OR status_pm.meta_value != 'resolved'
                    THEN p.ID
                    ELSE NULL
                END) AS open_count,
                MAX(p.post_modified_gmt) AS latest_at
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} species_pm
                ON species_pm.post_id = p.ID
                AND species_pm.meta_key = '_setae_related_species_id'
                AND species_pm.meta_value REGEXP '^[0-9]+$'
            INNER JOIN {$wpdb->posts} sp
                ON sp.ID = CAST(species_pm.meta_value AS UNSIGNED)
                AND sp.post_type = 'setae_species'
                AND sp.post_status = 'publish'
            LEFT JOIN {$wpdb->postmeta} status_pm
                ON status_pm.post_id = p.ID
                AND status_pm.meta_key = '_setae_topic_status'
            WHERE p.post_type = 'setae_topic'
                AND p.post_status = 'publish'
            GROUP BY species_id
            ORDER BY latest_at DESC
            LIMIT %d
        ", $limit), ARRAY_A);

        $items = array();
        foreach ($rows as $row) {
            $species_id = absint($row['species_id']);
            $species = $this->build_related_species_data($species_id);
            if (!$species) {
                continue;
            }

            $latest_topic = $this->get_latest_species_topic($species_id);
            $items[] = array(
                'species' => $species,
                'topic_count' => isset($row['topic_count']) ? (int) $row['topic_count'] : 0,
                'open_count' => isset($row['open_count']) ? (int) $row['open_count'] : 0,
                'latest_at' => !empty($row['latest_at']) ? get_date_from_gmt($row['latest_at'], 'Y-m-d H:i:s') : '',
                'latest_topic' => $latest_topic,
            );
        }

        return new WP_REST_Response(array(
            'items' => $items,
            'count' => count($items),
        ), 200);
    }

    public function mark_topic_read($request)
    {
        $topic_id = absint($request['id']);
        $post = get_post($topic_id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        $user_id = get_current_user_id();
        update_user_meta($user_id, '_setae_topic_last_read_' . $topic_id, current_time('mysql'));

        if (!get_user_meta($user_id, '_setae_com_last_checked', true)) {
            update_user_meta($user_id, '_setae_com_last_checked', current_time('mysql'));
        }

        return new WP_REST_Response(array(
            'success' => true,
            'id' => $topic_id,
        ), 200);
    }

    public function toggle_topic_reaction($request)
    {
        $topic_id = absint($request['id']);
        $post = get_post($topic_id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        $reaction = sanitize_key($request->get_param('reaction'));
        if (!$this->is_allowed_topic_reaction($reaction)) {
            return new WP_Error('invalid_reaction', 'このリアクションは使用できません', array('status' => 400));
        }

        $summary = $this->toggle_reaction_meta($topic_id, '_setae_topic_reactions', $reaction, get_current_user_id(), 'post');

        return new WP_REST_Response(array(
            'success' => true,
            'reactions' => $summary,
        ), 200);
    }

    public function toggle_comment_reaction($request)
    {
        $comment_id = absint($request['id']);
        $comment = get_comment($comment_id);

        if (!$comment || get_post_type((int) $comment->comment_post_ID) !== 'setae_topic') {
            return new WP_Error('not_found', 'コメントが見つかりません', array('status' => 404));
        }

        $reaction = sanitize_key($request->get_param('reaction'));
        if (!$this->is_allowed_comment_reaction($reaction)) {
            return new WP_Error('invalid_reaction', 'このリアクションは使用できません', array('status' => 400));
        }

        $summary = $this->toggle_reaction_meta($comment_id, '_setae_comment_reactions', $reaction, get_current_user_id(), 'comment');

        return new WP_REST_Response(array(
            'success' => true,
            'reactions' => $summary,
        ), 200);
    }

    public function update_topic_status($request)
    {
        $topic_id = absint($request['id']);
        $post = get_post($topic_id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        if (!$this->current_user_can_manage_topic($topic_id)) {
            return new WP_Error('forbidden', 'このトピックの状態を変更する権限がありません', array('status' => 403));
        }

        $status = sanitize_key($request->get_param('status'));
        if (!in_array($status, array('open', 'resolved'), true)) {
            return new WP_Error('invalid_status', '指定された状態は使用できません', array('status' => 400));
        }

        if ($status === 'resolved') {
            update_post_meta($topic_id, '_setae_topic_status', 'resolved');
            update_post_meta($topic_id, '_setae_topic_resolved_at', current_time('mysql'));
            update_post_meta($topic_id, '_setae_topic_resolved_by', get_current_user_id());
        } else {
            delete_post_meta($topic_id, '_setae_topic_status');
            delete_post_meta($topic_id, '_setae_topic_resolved_at');
            delete_post_meta($topic_id, '_setae_topic_resolved_by');
            delete_post_meta($topic_id, '_setae_best_answer_comment_id');
        }

        return new WP_REST_Response($this->build_topic_state_response($topic_id), 200);
    }

    public function set_best_answer($request)
    {
        $topic_id = absint($request['id']);
        $post = get_post($topic_id);

        if (!$post || $post->post_type !== 'setae_topic') {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }

        if (!$this->current_user_can_manage_topic($topic_id)) {
            return new WP_Error('forbidden', 'ベスト回答を選ぶ権限がありません', array('status' => 403));
        }

        $comment_id = absint($request->get_param('comment_id'));
        if ($comment_id > 0) {
            $comment = get_comment($comment_id);
            if (!$comment || (int) $comment->comment_post_ID !== $topic_id) {
                return new WP_Error('invalid_comment', 'このトピックのコメントではありません', array('status' => 400));
            }

            update_post_meta($topic_id, '_setae_best_answer_comment_id', $comment_id);
            update_post_meta($topic_id, '_setae_topic_status', 'resolved');
            update_post_meta($topic_id, '_setae_topic_resolved_at', current_time('mysql'));
            update_post_meta($topic_id, '_setae_topic_resolved_by', get_current_user_id());
        } else {
            delete_post_meta($topic_id, '_setae_best_answer_comment_id');
            delete_post_meta($topic_id, '_setae_topic_status');
            delete_post_meta($topic_id, '_setae_topic_resolved_at');
            delete_post_meta($topic_id, '_setae_topic_resolved_by');
        }

        return new WP_REST_Response($this->build_topic_state_response($topic_id), 200);
    }

    public function mark_all_topics_read($request)
    {
        $user_id = get_current_user_id();
        $now = current_time('mysql');
        $topic_ids = $this->get_user_related_topic_ids($user_id);

        foreach ($topic_ids as $topic_id) {
            update_user_meta($user_id, '_setae_topic_last_read_' . $topic_id, $now);
        }
        update_user_meta($user_id, '_setae_com_last_checked', $now);

        return new WP_REST_Response(array(
            'success' => true,
            'count' => 0,
            'raw_count' => 0,
            'topic_count' => 0,
            'items' => array(),
        ), 200);
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
        $content = trim(sanitize_textarea_field($request->get_param('content')));

        // ▼ 追加: 文字数制限 (1000文字)
        if (mb_strlen($content) > 1000) {
            return new WP_Error('content_too_long', 'コメントは1000文字以内で入力してください', array('status' => 400));
        }

        // ▼ 追加: 1000レス制限のチェック (アーカイブ)
        $topic_post = get_post($id);
        if (!$topic_post) {
            return new WP_Error('not_found', 'トピックが見つかりません', array('status' => 404));
        }
        $current_comments_count = get_comments_number($id);
        if ($current_comments_count >= 1000) {
            return new WP_Error('thread_archived', 'このスレッドは1000レスを超過したため、新しい書き込みはできません。', array('status' => 403));
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

        // モメンタムの再計算 (総レス数 / 経過日数)
        $new_comment_count = $current_comments_count + 1;
        $topic_date = strtotime($topic_post->post_date);
        $now = current_time('timestamp');
        $days_elapsed = max(1, round(($now - $topic_date) / (60 * 60 * 24))); // 最低1日とする
        $momentum = $new_comment_count / $days_elapsed;

        // メタ情報を更新
        update_post_meta($id, '_setae_momentum', $momentum);

        $per_page = 20;
        $comment_page = max(1, (int) ceil($new_comment_count / $per_page));

        if (class_exists('Setae_PWA')) {
            Setae_PWA::queue_topic_reply($id, $comment_id, $user->ID);
        }

        return new WP_REST_Response(array(
            'id' => $comment_id,
            'comment_count' => $new_comment_count,
            'comment_page' => $comment_page,
            'message' => 'コメントを追加しました',
        ), 201);
    }

    private function get_user_related_topic_ids($user_id)
    {
        global $wpdb;

        $topic_ids = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT p.ID
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->comments} c
                ON c.comment_post_ID = p.ID
                AND c.user_id = %d
                AND c.comment_approved = '1'
            WHERE p.post_type = 'setae_topic'
                AND p.post_status = 'publish'
                AND (p.post_author = %d OR c.user_id = %d)
            ORDER BY p.post_modified_gmt DESC
            LIMIT 300
        ", $user_id, $user_id, $user_id));

        return array_map('absint', $topic_ids);
    }

    private function get_topic_last_read($topic_id, $user_id)
    {
        $topic_last_read = get_user_meta($user_id, '_setae_topic_last_read_' . $topic_id, true);
        if ($topic_last_read) {
            return $topic_last_read;
        }

        $global_last_checked = get_user_meta($user_id, '_setae_com_last_checked', true);
        if ($global_last_checked) {
            return $global_last_checked;
        }

        return current_time('mysql');
    }

    private function is_user_related_topic($topic_id, $user_id)
    {
        $post = get_post($topic_id);
        if (!$post || $post->post_type !== 'setae_topic') {
            return false;
        }

        if ((int) $post->post_author === (int) $user_id) {
            return true;
        }

        return (int) get_comments(array(
            'post_id' => $topic_id,
            'status' => 'approve',
            'user_id' => $user_id,
            'count' => true,
        )) > 0;
    }

    private function current_user_can_manage_topic($topic_id)
    {
        $author_id = (int) get_post_field('post_author', $topic_id);
        return ($author_id && $author_id === get_current_user_id()) || current_user_can('manage_options');
    }

    private function is_topic_resolved($topic_id)
    {
        return get_post_meta($topic_id, '_setae_topic_status', true) === 'resolved';
    }

    private function normalize_related_species_id($value)
    {
        $species_id = absint($value);
        if (!$species_id) {
            return 0;
        }

        $species = get_post($species_id);
        if (!$species || $species->post_type !== 'setae_species' || $species->post_status !== 'publish') {
            return 0;
        }

        return $species_id;
    }

    private function build_related_species_data($species_id)
    {
        $species_id = $this->normalize_related_species_id($species_id);
        if (!$species_id) {
            return null;
        }

        $scientific_name = get_the_title($species_id);
        $common_name = get_post_meta($species_id, '_setae_common_name_ja', true);

        return array(
            'id' => $species_id,
            'title' => $scientific_name,
            'ja_name' => $common_name,
            'display_name' => $common_name ?: $scientific_name,
            'thumb' => $this->get_species_representative_image($species_id, 'thumbnail'),
        );
    }

    private function get_species_representative_image($species_id, $size = 'thumbnail')
    {
        $thumb = get_the_post_thumbnail_url($species_id, $size);
        if ($thumb) {
            return $thumb;
        }

        $featured = get_post_meta($species_id, '_setae_featured_images', true);
        if (is_array($featured) && !empty($featured[0])) {
            return esc_url_raw($featured[0]);
        }

        return '';
    }

    private function get_latest_species_topic($species_id)
    {
        $species_id = $this->normalize_related_species_id($species_id);
        if (!$species_id) {
            return null;
        }

        $topic_ids = get_posts(array(
            'post_type' => 'setae_topic',
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'orderby' => 'modified',
            'order' => 'DESC',
            'meta_query' => array(
                array(
                    'key' => '_setae_related_species_id',
                    'value' => $species_id,
                    'compare' => '=',
                ),
            ),
        ));

        if (empty($topic_ids)) {
            return null;
        }

        $topic_id = (int) $topic_ids[0];
        return array(
            'id' => $topic_id,
            'title' => get_the_title($topic_id),
            'type' => get_post_meta($topic_id, 'setae_topic_type', true) ?: 'general',
            'is_resolved' => $this->is_topic_resolved($topic_id),
            'comment_count' => (int) get_comments_number($topic_id),
            'updated_at' => get_post_field('post_modified', $topic_id),
        );
    }

    private function build_topic_state_response($topic_id)
    {
        return array(
            'success' => true,
            'id' => (int) $topic_id,
            'is_resolved' => $this->is_topic_resolved($topic_id),
            'best_answer_id' => (int) get_post_meta($topic_id, '_setae_best_answer_comment_id', true),
            'can_manage' => $this->current_user_can_manage_topic($topic_id),
        );
    }

    private function get_topic_unread_count($topic_id, $user_id)
    {
        if (!$this->is_user_related_topic($topic_id, $user_id)) {
            return 0;
        }

        return $this->count_topic_comments_after($topic_id, $user_id, $this->get_topic_last_read($topic_id, $user_id));
    }

    private function count_topic_comments_after($topic_id, $user_id, $after)
    {
        $blocked_user_ids = Setae_API_Social::get_blocked_user_ids($user_id);
        $excluded_user_ids = array_values(array_unique(array_merge(array((int) $user_id), $blocked_user_ids)));

        return (int) get_comments(array(
            'post_id' => $topic_id,
            'status' => 'approve',
            'count' => true,
            'user__not_in' => $excluded_user_ids,
            'date_query' => array(
                array(
                    'column' => 'comment_date',
                    'after' => $after,
                    'inclusive' => false,
                ),
            ),
        ));
    }

    private function get_latest_unread_topic_comment($topic_id, $user_id, $after)
    {
        $blocked_user_ids = Setae_API_Social::get_blocked_user_ids($user_id);
        $excluded_user_ids = array_values(array_unique(array_merge(array((int) $user_id), $blocked_user_ids)));
        $comments = get_comments(array(
            'post_id' => $topic_id,
            'status' => 'approve',
            'user__not_in' => $excluded_user_ids,
            'orderby' => 'comment_date_gmt',
            'order' => 'DESC',
            'number' => 1,
            'date_query' => array(
                array(
                    'column' => 'comment_date',
                    'after' => $after,
                    'inclusive' => false,
                ),
            ),
        ));

        return !empty($comments) ? $comments[0] : null;
    }

    private function get_topic_reaction_labels()
    {
        return array(
            'same' => '同じ悩み',
            'useful' => '参考になる',
            'watching' => '見守り中',
        );
    }

    private function validate_topic_image_upload()
    {
        if (empty($_FILES['image']['name'])) {
            return true;
        }

        $file = $_FILES['image'];
        if (!empty($file['error']) && (int) $file['error'] !== UPLOAD_ERR_OK) {
            return new WP_Error('topic_image_upload_error', '画像を読み込めませんでした。別の画像を選択してください。', array('status' => 400));
        }

        if (empty($file['tmp_name']) || (int) $file['size'] > 5 * 1024 * 1024) {
            return new WP_Error('topic_image_too_large', '画像は5MB以下にしてください。', array('status' => 400));
        }

        $image_info = @getimagesize($file['tmp_name']);
        $allowed_mime_types = array('image/jpeg', 'image/png', 'image/webp', 'image/gif');
        if (!$image_info || empty($image_info['mime']) || !in_array($image_info['mime'], $allowed_mime_types, true)) {
            return new WP_Error('topic_image_invalid', 'JPEG、PNG、WebP、GIF画像を選択してください。', array('status' => 400));
        }

        return true;
    }

    private function handle_topic_image_upload($topic_id)
    {
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $attachment_id = media_handle_upload('image', $topic_id);
        if (is_wp_error($attachment_id)) {
            return new WP_Error('topic_image_upload_failed', '画像を保存できませんでした。もう一度お試しください。', array('status' => 400));
        }

        update_post_meta($topic_id, '_setae_topic_image_id', $attachment_id);
        $image_url = wp_get_attachment_image_url($attachment_id, 'large');
        if (!$image_url) {
            $image_url = wp_get_attachment_url($attachment_id);
        }
        update_post_meta($topic_id, '_setae_topic_image_url', esc_url_raw($image_url));

        return esc_url_raw($image_url);
    }

    private function get_topic_image_url($topic_id)
    {
        $attachment_id = absint(get_post_meta($topic_id, '_setae_topic_image_id', true));
        if ($attachment_id) {
            $image_url = wp_get_attachment_image_url($attachment_id, 'large');
            if ($image_url) {
                return esc_url_raw($image_url);
            }
        }

        return esc_url_raw(get_post_meta($topic_id, '_setae_topic_image_url', true));
    }

    private function get_user_public_profile_url($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return '';
        }

        $referral_code = sanitize_text_field(get_user_meta($user_id, '_setae_referral_code', true));
        if (!$referral_code) {
            return '';
        }

        $url = get_option('permalink_structure')
            ? home_url('/setae-user/' . rawurlencode($referral_code) . '/')
            : add_query_arg('setae_profile', $referral_code, home_url('/'));

        return add_query_arg('ref', $referral_code, $url);
    }

    private function get_comment_reaction_labels()
    {
        return array(
            'useful' => '参考になった',
            'thanks' => 'ありがとう',
        );
    }

    private function is_allowed_topic_reaction($reaction)
    {
        $labels = $this->get_topic_reaction_labels();
        return isset($labels[$reaction]);
    }

    private function is_allowed_comment_reaction($reaction)
    {
        $labels = $this->get_comment_reaction_labels();
        return isset($labels[$reaction]);
    }

    private function get_topic_reaction_summary($topic_id)
    {
        return $this->build_reaction_summary(
            get_post_meta($topic_id, '_setae_topic_reactions', true),
            $this->get_topic_reaction_labels(),
            get_current_user_id()
        );
    }

    private function get_comment_reaction_summary($comment_id)
    {
        return $this->build_reaction_summary(
            get_comment_meta($comment_id, '_setae_comment_reactions', true),
            $this->get_comment_reaction_labels(),
            get_current_user_id()
        );
    }

    private function get_reaction_store($target_id, $meta_key, $target_type)
    {
        $store = $target_type === 'comment'
            ? get_comment_meta($target_id, $meta_key, true)
            : get_post_meta($target_id, $meta_key, true);

        return is_array($store) ? $store : array();
    }

    private function save_reaction_store($target_id, $meta_key, $target_type, $store)
    {
        if ($target_type === 'comment') {
            update_comment_meta($target_id, $meta_key, $store);
            return;
        }

        update_post_meta($target_id, $meta_key, $store);
    }

    private function toggle_reaction_meta($target_id, $meta_key, $reaction, $user_id, $target_type)
    {
        $store = $this->get_reaction_store($target_id, $meta_key, $target_type);
        if (empty($store[$reaction]) || !is_array($store[$reaction])) {
            $store[$reaction] = array();
        }

        $user_id = (int) $user_id;
        $store[$reaction] = array_values(array_unique(array_map('intval', $store[$reaction])));

        if (in_array($user_id, $store[$reaction], true)) {
            $store[$reaction] = array_values(array_diff($store[$reaction], array($user_id)));
        } else {
            $store[$reaction][] = $user_id;
        }

        $this->save_reaction_store($target_id, $meta_key, $target_type, $store);

        $labels = $target_type === 'comment' ? $this->get_comment_reaction_labels() : $this->get_topic_reaction_labels();
        return $this->build_reaction_summary($store, $labels, $user_id);
    }

    private function build_reaction_summary($store, $labels, $user_id)
    {
        $store = is_array($store) ? $store : array();
        $summary = array();

        foreach ($labels as $key => $label) {
            $users = !empty($store[$key]) && is_array($store[$key])
                ? array_values(array_unique(array_map('intval', $store[$key])))
                : array();

            $summary[$key] = array(
                'label' => $label,
                'count' => count($users),
                'active' => $user_id ? in_array((int) $user_id, $users, true) : false,
            );
        }

        return $summary;
    }
}
