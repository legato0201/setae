<?php

class Setae_API_Species extends WP_REST_Controller
{
    public function register_routes()
    {
        $version = '1';
        $namespace = 'setae/v' . $version;

        // 1. List & Search Endpoint (新規追加・移植)
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
     * class-setae-api.php からロジックを移植・統合
     */
    public function get_items($request)
    {
        // 検索語句を取得し、デコードと空白除去を行う
        $raw_search = $request->get_param('search');
        $search = trim(urldecode($raw_search));

        $offset = $request->get_param('offset') ?: 0;

        // ベースとなるクエリ引数
        $args = array(
            'post_type' => 'setae_species',
            'posts_per_page' => 20,
            'offset' => $offset,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
            // 'fields' => 'ids', // ここでidsを指定するとループ処理が複雑になるため、最終クエリでは外す方針
        );

        // 検索語句がある場合の処理（タイトル OR メタデータ検索）
        if (!empty($search)) {
            // 1. 学名（タイトル）検索
            $args_title = $args;
            $args_title['s'] = $search;
            $args_title['fields'] = 'ids'; // IDだけ取得してマージするため
            $query_title = new WP_Query($args_title);
            $ids_title = $query_title->posts;

            // 2. 和名（メタデータ）検索
            $args_meta = $args;
            $args_meta['meta_query'] = array(
                array(
                    'key' => '_setae_common_name_ja',
                    'value' => $search,
                    'compare' => 'LIKE' // 部分一致
                )
            );
            $args_meta['posts_per_page'] = -1; // 漏れがないように全件対象
            $args_meta['offset'] = 0;
            $args_meta['fields'] = 'ids';

            $query_meta = new WP_Query($args_meta);
            $ids_meta = $query_meta->posts;

            // IDを結合して重複削除
            $final_ids = array_unique(array_merge($ids_title, $ids_meta));

            // ヒットなしの場合は空を返す
            if (empty($final_ids)) {
                return new WP_REST_Response(array(), 200);
            }

            // マージしたIDを対象に最終クエリを作成
            $args_final = array(
                'post_type' => 'setae_species',
                'post__in' => $final_ids,
                'posts_per_page' => 20, // ページネーション用
                'orderby' => 'post__in', // ヒット順（必要ならtitleに戻す）
            );
        } else {
            // 検索なしの場合
            $args_final = $args;
        }

        $query = new WP_Query($args_final);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $id = get_the_ID();

                $terms = get_the_terms($id, 'setae_genus');
                $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';

                // 和名を取得
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

        // Fetch meta manually to ensure they are present
        $featured = get_post_meta($id, '_setae_featured_images', true) ?: [];
        $lifespan = get_post_meta($id, '_setae_lifespan', true);
        $size = get_post_meta($id, '_setae_size', true);

        // Keeping Count
        $keeping_count = $this->count_active_keepers($id);

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'type' => 'setae_species', // context
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

        // Temperament (Array of objects)
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

    /**
     * Get statistics for a specific species
     */
    public function get_species_stats($request)
    {
        $species_id = $request['id'];

        // 1. Now Keeping Count
        $keeping_count = $this->count_active_keepers($species_id);

        // 2. Growth Data (Placeholder for now)
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