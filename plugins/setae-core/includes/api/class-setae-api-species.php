<?php

class Setae_API_Species extends WP_REST_Controller
{
    public function register_routes()
    {
        $version = '1';
        $namespace = 'setae/v' . $version;

        // 1. List & Search Endpoint
        register_rest_route($namespace, '/species', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_items'),
            'permission_callback' => '__return_true', // Public
        ));

        // 2. Detail Endpoint
        register_rest_route($namespace, '/species/(?P<id>\d+)', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_species_detail'),
            'permission_callback' => '__return_true',
            'args' => array(
                'id' => array(
                    'validate_callback' => function ($p) {
                        return is_numeric($p);
                    }
                )
            )
        ));

        // 3. Stats Endpoint
        register_rest_route($namespace, '/species/(?P<id>\d+)/stats', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_species_stats'),
            'permission_callback' => '__return_true', // Public
        ));
    }

    /**
     * Get a collection of species (Search & List)
     * 修正版: WP_Queryの不安定さを回避し、直接SQLで和名を検索する最強版
     */
    public function get_items($request)
    {
        global $wpdb; // データベース直接操作用

        $raw_search = $request->get_param('search');
        $search = trim(urldecode($raw_search));
        $offset = $request->get_param('offset') ?: 0;

        // ベース設定
        $args_base = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 20,
            'offset' => $offset,
            'orderby' => 'title',
            'order' => 'ASC',
        );

        if (!empty($search)) {
            // A. 学名（タイトル）検索
            // タイトル検索はWP標準機能で十分動くため維持
            $args_main = $args_base;
            $args_main['s'] = $search;
            $args_main['fields'] = 'ids';

            $query_main = new WP_Query($args_main);
            $ids_main = $query_main->posts;

            // B. 和名（メタデータ）検索：直接SQL実行
            // WP_Queryの不具合を回避し、DBに直接「この文字を含むIDをくれ」と命令します
            $like_term = '%' . $wpdb->esc_like($search) . '%';

            // SQL: post_id を postmeta テーブルから探す
            // 条件: キーが _setae_common_name_ja かつ 値に検索語句が含まれる
            $sql_meta = $wpdb->prepare("
                SELECT post_id 
                FROM {$wpdb->postmeta}
                WHERE meta_key = '_setae_common_name_ja'
                AND meta_value LIKE %s
            ", $like_term);

            $ids_meta = $wpdb->get_col($sql_meta);

            // AとBを合体させて、重複を取り除く
            $final_ids = array_unique(array_merge($ids_main, $ids_meta));

            // ヒットなしの場合
            if (empty($final_ids)) {
                return new WP_REST_Response(array(), 200);
            }

            // 見つかったIDリストを使って最終データを取得
            $args_final = array(
                'post_type' => 'setae_species',
                'post__in' => $final_ids,
                'posts_per_page' => 20,
                'orderby' => 'post__in', // ヒットした順序を優先
                'post_status' => 'publish'
            );
        } else {
            // 検索ワードがない場合（一覧表示）
            $args_final = $args_base;
        }

        $query = new WP_Query($args_final);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $id = get_the_ID();

                $terms = get_the_terms($id, 'setae_genus');
                $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';
                $ja_name = get_post_meta($id, '_setae_common_name_ja', true);

                $data[] = array(
                    'id' => $id,
                    'title' => get_the_title(),
                    'ja_name' => $ja_name,
                    'genus' => $genus,
                    'thumb' => get_the_post_thumbnail_url($id, 'thumbnail'),
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }

    public function get_species_detail($request)
    {
        $id = $request['id'];
        $post = get_post($id);
        if (!$post || $post->post_type !== 'setae_species') {
            return new WP_Error('not_found', 'Species not found', array('status' => 404));
        }

        $terms = get_the_terms($id, 'setae_genus');
        $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';

        // Meta
        $featured = get_post_meta($id, '_setae_featured_images', true) ?: [];
        $lifespan = get_post_meta($id, '_setae_lifespan', true);
        $size = get_post_meta($id, '_setae_size', true);

        // Keeping Count
        $keeping_count = $this->count_active_keepers($id);

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'type' => 'setae_species',
            'genus' => $genus,
            'ja_name' => get_post_meta($id, '_setae_common_name_ja', true),
            'description' => $post->post_content,
            'thumb' => get_the_post_thumbnail_url($id, 'large'),
            'lifespan' => $lifespan,
            'size' => $size,
            'temperature' => get_post_meta($id, '_setae_temperature', true),
            'humidity' => get_post_meta($id, '_setae_humidity', true),
            'featured_images' => $featured,
            'keeping_count' => $keeping_count,
        );

        // Temperament
        $t_terms = get_the_terms($id, 'setae_temperament');
        $data['temperaments'] = [];
        if (!empty($t_terms) && !is_wp_error($t_terms)) {
            foreach ($t_terms as $t) {
                $data['temperaments'][] = [
                    'term_id' => $t->term_id,
                    'name' => $t->name,
                    'slug' => $t->slug
                ];
            }
            $data['temperament'] = implode(', ', wp_list_pluck($data['temperaments'], 'name'));
        } else {
            $data['temperament'] = 'Unknown';
        }

        // Lifestyle
        $l_terms = get_the_terms($id, 'setae_lifestyle');
        if (!empty($l_terms) && !is_wp_error($l_terms)) {
            $data['lifestyle'] = $l_terms[0]->name;
            $data['lifestyle_slug'] = $l_terms[0]->slug;
        }

        // Habitat
        $h_terms = get_the_terms($id, 'setae_habitat');
        if (!empty($h_terms) && !is_wp_error($h_terms)) {
            $data['habitat'] = $h_terms[0]->name;
        }

        return new WP_REST_Response($data, 200);
    }

    public function get_species_stats($request)
    {
        $species_id = $request['id'];
        $keeping_count = $this->count_active_keepers($species_id);
        $growth_chart = array();

        $data = array(
            'species_id' => $species_id,
            'keeping_count' => $keeping_count,
            'growth_chart' => $growth_chart
        );

        return new WP_REST_Response($data, 200);
    }

    private function count_active_keepers($species_id)
    {
        global $wpdb;
        $sql = $wpdb->prepare("
            SELECT COUNT(DISTINCT post_author)
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'setae_spider'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_setae_species_id'
            AND pm.meta_value = %d
        ", $species_id);

        return (int) $wpdb->get_var($sql);
    }
}