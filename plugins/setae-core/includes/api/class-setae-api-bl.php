<?php

class Setae_API_BL
{
    public function register_routes()
    {
        // BL Candidates (募集中個体一覧)
        register_rest_route('setae/v1', '/bl-candidates', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_bl_candidates'),
            'permission_callback' => '__return_true',
        ));

        // Contracts (契約管理)
        register_rest_route('setae/v1', '/contracts', array(
            'methods' => array('GET', 'POST'),
            'callback' => array($this, 'handle_contracts'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Contract Status Update
        register_rest_route('setae/v1', '/contracts/(?P<id>\d+)/status', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_contract_status'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));
    }

    public function get_bl_candidates($request)
    {
        $args = array(
            'post_type' => 'setae_spider',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_setae_bl_status',
                    'value' => 'recruiting',
                ),
            ),
        );
        $posts = get_posts($args);
        $candidates = array();

        foreach ($posts as $post) {
            $species_id = get_post_meta($post->ID, '_setae_species_id', true);
            $species_name = $species_id ? get_the_title($species_id) : 'Unknown Species';

            // ★修正: 画像取得ロジックを強化 (文字列/JSON/配列 全対応)
            $img_url = get_the_post_thumbnail_url($post->ID, 'medium');

            if (!$img_url) {
                $meta_img = get_post_meta($post->ID, '_setae_images', true);

                // 1. JSON文字列として保存されている場合のデコード試行
                if (is_string($meta_img) && strpos($meta_img, '[') === 0) {
                    $decoded = json_decode($meta_img, true);
                    if (is_array($decoded)) {
                        $meta_img = $decoded;
                    }
                }

                // 2. 形式に応じたURL抽出
                if (!empty($meta_img)) {
                    if (is_array($meta_img)) {
                        // 配列なら先頭の要素を取得
                        $first_img = reset($meta_img);
                        if ($first_img) {
                            $img_url = $first_img;
                        }
                    } elseif (is_string($meta_img)) {
                        // 文字列(URL)ならそのまま使用
                        $img_url = $meta_img;
                    }
                }
            }

            // それでも取得できなければデフォルト画像
            if (!$img_url) {
                $img_url = SETAE_PLUGIN_URL . 'assets/images/default-spider.png';
            }

            // ★追加: モーダル表示用データ
            $last_molt = get_post_meta($post->ID, 'last_molt_date', true); // Try simple key first
            if (!$last_molt)
                $last_molt = get_post_meta($post->ID, '_setae_last_molt_date', true) ?: '-';

            $bl_terms = get_post_meta($post->ID, '_setae_bl_terms', true) ?: 'No specific terms provided.';

            $candidates[] = array(
                'id' => $post->ID,
                'name' => $post->post_title,
                'title' => $post->post_title, // Keep title for compatibility
                'species' => $species_name,
                'image' => $img_url,
                'gender' => get_post_meta($post->ID, '_setae_gender', true) ?: 'unknown',
                'owner_id' => $post->post_author,
                'owner_name' => get_the_author_meta('display_name', $post->post_author),
                // ▼追加データ
                'last_molt' => $last_molt,
                'bl_terms' => $bl_terms
            );
        }

        return new WP_REST_Response($candidates, 200);
    }

    public function handle_contracts($request)
    {
        $method = $request->get_method();
        $db = new Setae_BL_Contracts();
        $user_id = get_current_user_id();

        if ($method === 'POST') {
            $spider_id = $request->get_param('spider_id');
            $message = sanitize_textarea_field($request->get_param('message'));

            $spider = get_post($spider_id);
            if (!$spider || $spider->post_type !== 'setae_spider') {
                return new WP_Error('invalid_spider', 'Spider not found', array('status' => 404));
            }

            $owner_id = get_post_field('post_author', $spider_id);
            if ($owner_id == $user_id) {
                return new WP_Error('invalid_request', 'Cannot request your own spider', array('status' => 400));
            }

            $result = $db->create_request($owner_id, $user_id, $spider_id, $message);
            if ($result) {
                return new WP_REST_Response(array('success' => true), 201);
            }
            return new WP_Error('db_error', 'Could not create contract', array('status' => 500));

        } else {
            $contracts = $db->get_contracts_by_user($user_id);
            foreach ($contracts as $c) {
                $c->spider_name = get_the_title($c->spider_id);
                // 画像取得を追加
                $c->spider_image = get_the_post_thumbnail_url($c->spider_id, 'thumbnail') ?: SETAE_PLUGIN_URL . 'assets/images/default-spider.png';
                $c->owner_name = get_the_author_meta('display_name', $c->owner_id);
                $c->breeder_name = get_the_author_meta('display_name', $c->breeder_id);

                // 自分がどちらの立場か判定フラグ
                $c->is_owner = ($c->owner_id == $user_id);
                $c->display_status = $this->get_status_label($c->status);
            }
            return new WP_REST_Response($contracts, 200);
        }
    }

    private function get_status_label($status)
    {
        $labels = [
            'REQUESTED' => '申請中',
            'APPROVED' => '承認済',
            'REJECTED' => '却下',
            'PAIRED' => 'ペアリング中',
            'SUCCESS' => '繁殖成功',
            'FAIL' => '繁殖失敗'
        ];
        return isset($labels[$status]) ? $labels[$status] : $status;
    }

    public function update_contract_status($request)
    {
        $id = $request['id'];
        $status = $request->get_param('status');
        $db = new Setae_BL_Contracts();
        $contract = $db->get_contract($id);

        if (!$contract) {
            return new WP_Error('not_found', 'Contract not found', array('status' => 404));
        }

        $user_id = get_current_user_id();
        if ($contract->owner_id != $user_id && $contract->breeder_id != $user_id) {
            return new WP_Error('forbidden', 'You are not part of this contract', array('status' => 403));
        }

        $result = $db->update_status($id, $status);

        // Auto-create Lineage Thread on SUCCESS
        if ($result && $status === 'SUCCESS') {
            $this->create_lineage_thread($contract);
        }

        return new WP_REST_Response(array('success' => !!$result), 200);
    }

    private function create_lineage_thread($contract)
    {
        $spider_title = get_the_title($contract->spider_id);
        $post_data = array(
            'post_title' => '繁殖レポート: ' . $spider_title,
            'post_content' => "<!-- wp:paragraph -->\n繁殖成功！\n\n**ペアリング情報**\n- 親個体: {$spider_title}\n- パートナー: (未記入)\n- 成功日: " . date('Y-m-d') . "\n\n詳細な記録をここに追記してください。\n<!-- /wp:paragraph -->",
            'post_status' => 'publish',
            'post_type' => 'setae_topic',
            'post_author' => $contract->breeder_id // Note: Usually the breeder creates the report? Or owner? Request says "User". Breeder makes sense as they have the egg sac.
        );

        $topic_id = wp_insert_post($post_data);

        if ($topic_id && !is_wp_error($topic_id)) {
            // Set type to 'breeding' (assuming taxonomy or meta)
            // For now, let's assume 'type' generic meta used in Topics API
            update_post_meta($topic_id, '_setae_topic_type', 'breeding');
            // Link to contract
            update_post_meta($topic_id, '_setae_bl_contract_id', $contract->id);
        }
    }
}
