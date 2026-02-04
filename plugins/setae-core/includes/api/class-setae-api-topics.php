<?php

/**
 * Handler for Community Topic-related API endpoints.
 */
class Setae_API_Topics
{
    public function register_routes()
    {
        // Get Topics List
        register_rest_route('setae/v1', '/topics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_topics'),
            'permission_callback' => '__return_true', // 公開情報として扱う場合
        ));
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

                // 抜粋の取得（なければ本文を短縮）
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
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }
}
