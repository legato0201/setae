<?php

class Setae_API_Species extends WP_REST_Controller
{
    public function register_routes()
    {
        $version = '1';
        $namespace = 'setae/v' . $version;

        // Detail Endpoint
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

        register_rest_route($namespace, '/species/(?P<id>\d+)/stats', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_species_stats'),
            'permission_callback' => '__return_true', // Public
        ));
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
            'description' => $post->post_content, // Assuming description is content
            'thumb' => get_the_post_thumbnail_url($id, 'large'),
            'lifespan' => $lifespan,
            'size' => $size,
            'featured_images' => $featured,
            'keeping_count' => $keeping_count,
            // Temperament (fetch from taxonomy if exists, else meta?) 
            // Previous code used `temperament_slug`, checking `setae_temperament` tax?
            // Checking `app-ui-renderer.js`... it uses `sp.temperament_slug`.
            // I should fetch that.
        );

        // Add Temperament
        $t_terms = get_the_terms($id, 'setae_temperament');
        if (!empty($t_terms) && !is_wp_error($t_terms)) {
            $data['temperament'] = $t_terms[0]->name;
            $data['temperament_slug'] = $t_terms[0]->slug;
        }

        // Add Habitat?
        $h_terms = get_the_terms($id, 'setae_habitat');
        if (!empty($h_terms) && !is_wp_error($h_terms)) {
            $data['habitat'] = $h_terms[0]->name;
        }

        return new WP_REST_Response($data, 200);
    }

    /**
     * Get statistics for a specific species
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function get_species_stats($request)
    {
        $species_id = $request['id'];

        // 1. Now Keeping Count (Unique users with ALIVE spiders of this species)
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

        // Count unique post_author from wp_posts (setae_spider)
        // Join with postmeta to check species_id
        // Filter by post_status 'publish'
        // Filter out dead spiders (status != 'dead') if we had that status

        // Using WP_Query or raw SQL. Raw SQL is efficiently for distinct count.

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
