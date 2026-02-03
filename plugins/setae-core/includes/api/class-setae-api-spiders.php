<?php

/**
 * Handler for Spider-related API endpoints.
 */
class Setae_API_Spiders
{

    public function register_routes()
    {
        // Species List
        register_rest_route('setae/v1', '/species', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_species_list'),
            'permission_callback' => '__return_true', // Public
        ));

        // My Spiders List
        register_rest_route('setae/v1', '/my-spiders', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_my_spiders'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Create Spider
        register_rest_route('setae/v1', '/spiders', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Spider Detail (Public/Private handled inside or broad read)
        register_rest_route('setae/v1', '/spider/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_spider_detail'),
            'permission_callback' => '__return_true', // Validation inside
        ));

        // Update Spider
        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Delete Spider
        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Toggle Favorite
        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)/favorite', array(
            'methods' => 'POST',
            'callback' => array($this, 'toggle_favorite'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Log Event (Feed, Molt, Growth)
        register_rest_route('setae/v1', '/spider/(?P<id>\d+)/events', array(
            'methods' => 'POST',
            'callback' => array($this, 'log_event'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Get Events
        register_rest_route('setae/v1', '/spider/(?P<id>\d+)/events', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_events'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));
    }

    // ==========================================
    // Species Logic
    // ==========================================
    public function get_species_list($request)
    {
        $search = $request->get_param('search');
        $offset = $request->get_param('offset') ?: 0;

        $args = array(
            'post_type' => 'setae_species',
            'posts_per_page' => 20,
            'offset' => $offset,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
        );

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $terms = get_the_terms(get_the_ID(), 'setae_genus');
                $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';

                $data[] = array(
                    'id' => get_the_ID(),
                    'title' => get_the_title(),
                    'genus' => $genus,
                    'thumb' => get_the_post_thumbnail_url(get_the_ID(), 'medium'),
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }

    // ==========================================
    // Spider Logic
    // ==========================================

    public function get_my_spiders($request)
    {
        $user_id = get_current_user_id();

        $args = array(
            'post_type' => 'setae_spider',
            'posts_per_page' => -1,
            'author' => $user_id,
            'post_status' => 'publish',
        );

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $species_id = get_post_meta(get_the_ID(), '_setae_species_id', true);
                $species_name = $species_id ? get_the_title($species_id) : 'Unknown';

                // Use uploaded image if exists, else fallback to species thumb
                $thumb = get_post_meta(get_the_ID(), '_setae_spider_image', true);
                if (!$thumb && $species_id) {
                    $thumb = get_the_post_thumbnail_url($species_id, 'thumbnail');
                }

                $data[] = array(
                    'id' => get_the_ID(),
                    'title' => get_the_title(),
                    'species_name' => $species_name,
                    'status' => get_post_meta(get_the_ID(), '_setae_status', true) ?: 'normal',
                    'last_molt' => get_post_meta(get_the_ID(), '_setae_last_molt_date', true),
                    'last_feed' => get_post_meta(get_the_ID(), '_setae_last_feed_date', true),
                    'last_prey' => get_post_meta(get_the_ID(), '_setae_last_prey', true),
                    'is_favorite' => (bool) get_post_meta(get_the_ID(), '_setae_is_favorite', true),
                    'thumb' => $thumb
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }

    public function create_spider($request)
    {
        $user_id = get_current_user_id();
        $species_id = $request->get_param('species_id');
        $name = sanitize_text_field($request->get_param('name'));

        // Validation
        if (empty($species_id)) {
            return new WP_Error('missing_params', 'Species ID is required', array('status' => 400));
        }

        $species_title = get_the_title($species_id);
        $title = $name ? $name : $species_title;

        $post_data = array(
            'post_title' => $title,
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'post_author' => $user_id,
        );

        $spider_id = wp_insert_post($post_data);

        if (is_wp_error($spider_id)) {
            return new WP_Error('creation_failed', $spider_id->get_error_message(), array('status' => 500));
        }

        // Handle Image Upload
        $image_url = $this->handle_file_upload('image', $spider_id);
        if ($image_url && !is_wp_error($image_url)) {
            update_post_meta($spider_id, '_setae_spider_image', $image_url);
        }

        // Save Meta
        update_post_meta($spider_id, '_setae_species_id', $species_id);
        update_post_meta($spider_id, '_setae_owner_id', $user_id);

        if ($request->get_param('last_molt'))
            update_post_meta($spider_id, '_setae_last_molt_date', sanitize_text_field($request->get_param('last_molt')));
        if ($request->get_param('last_feed'))
            update_post_meta($spider_id, '_setae_last_feed_date', sanitize_text_field($request->get_param('last_feed')));

        return new WP_REST_Response(array('success' => true, 'id' => $spider_id), 201);
    }

    public function get_spider_detail($request)
    {
        $spider_id = $request['id'];
        $post = get_post($spider_id);

        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        $species_id = get_post_meta($spider_id, '_setae_species_id', true);
        $species_name = $species_id ? get_the_title($species_id) : '';

        // Added logic from get_my_spiders for completeness
        $thumb = get_post_meta($spider_id, '_setae_spider_image', true);
        if (!$thumb && $species_id) {
            $thumb = get_the_post_thumbnail_url($species_id, 'medium');
        }

        $data = array(
            'id' => $spider_id,
            'title' => $post->post_title,
            'species_name' => $species_name,
            'last_molt' => get_post_meta($spider_id, '_setae_last_molt_date', true),
            'last_feed' => get_post_meta($spider_id, '_setae_last_feed_date', true),
            'status' => get_post_meta($spider_id, '_setae_status', true) ?: 'normal',
            'owner_id' => $post->post_author,
            'thumb' => $thumb
        );

        return new WP_REST_Response($data, 200);
    }

    public function update_spider($request)
    {
        $user_id = get_current_user_id();
        $spider_id = $request['id'];

        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        if ($post->post_author != $user_id) {
            return new WP_Error('forbidden', 'You cannot edit this spider', array('status' => 403));
        }

        // Allow update simply by status helper
        if ($request->get_param('status')) {
            update_post_meta($spider_id, '_setae_status', sanitize_key($request->get_param('status')));
            // If this is the only thing, return
            // But we allow multiple fields
        }

        $name = sanitize_text_field($request->get_param('name'));
        if ($name) {
            wp_update_post(array('ID' => $spider_id, 'post_title' => $name));
        }

        // Handle Image Upload
        if (!empty($_FILES['image'])) {
            $image_url = $this->handle_file_upload('image', $spider_id);
            if (is_wp_error($image_url)) {
                return $image_url;
            }
            if ($image_url) {
                update_post_meta($spider_id, '_setae_spider_image', $image_url);
            }
        }

        if ($request->get_param('last_molt'))
            update_post_meta($spider_id, '_setae_last_molt_date', sanitize_text_field($request->get_param('last_molt')));
        if ($request->get_param('last_feed'))
            update_post_meta($spider_id, '_setae_last_feed_date', sanitize_text_field($request->get_param('last_feed')));
        if ($request->get_param('species_id'))
            update_post_meta($spider_id, '_setae_species_id', absint($request->get_param('species_id')));

        return new WP_REST_Response(array('success' => true), 200);
    }

    public function delete_spider($request)
    {
        $user_id = get_current_user_id();
        $spider_id = $request['id'];

        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        if ($post->post_author != $user_id) {
            return new WP_Error('forbidden', 'You cannot delete this spider', array('status' => 403));
        }

        $result = wp_delete_post($spider_id, true);

        if (!$result) {
            return new WP_Error('delete_failed', 'Could not delete spider', array('status' => 500));
        }

        return new WP_REST_Response(array('success' => true), 200);
    }

    public function toggle_favorite($request)
    {
        $user_id = get_current_user_id();
        $spider_id = $request['id'];

        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        if ($post->post_author != $user_id) {
            return new WP_Error('forbidden', 'You can only favorite your own spiders', array('status' => 403));
        }

        $current = get_post_meta($spider_id, '_setae_is_favorite', true);
        $new_status = $current ? false : true;

        if ($new_status) {
            update_post_meta($spider_id, '_setae_is_favorite', 1);
        } else {
            delete_post_meta($spider_id, '_setae_is_favorite');
        }

        return new WP_REST_Response(array('success' => true, 'is_favorite' => $new_status), 200);
    }

    // ==========================================
    // Helpers
    // ==========================================
    private function handle_file_upload($file_key, $post_id = 0)
    {
        if (!isset($_FILES[$file_key]) || empty($_FILES[$file_key]['name'])) {
            return null; // No file uploaded
        }

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');

        $file = $_FILES[$file_key];
        $check = getimagesize($file["tmp_name"]);
        if ($check === false) {
            return new WP_Error('invalid_file', 'File is not an image.', array('status' => 400));
        }

        $attachment_id = media_handle_upload($file_key, $post_id);

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        return wp_get_attachment_url($attachment_id);
    }

    // ==========================================
    // Event Logic (Feed, Molt, etc.)
    // ==========================================
    public function log_event($request)
    {
        $user_id = get_current_user_id();
        $spider_id = $request['id'];
        $type = sanitize_key($request->get_param('type')); // feed, molt, growth
        $date = sanitize_text_field($request->get_param('date'));
        $data_json = $request->get_param('data'); // Expected JSON string or array

        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }
        if ($post->post_author != $user_id) {
            return new WP_Error('forbidden', 'Permission denied', array('status' => 403));
        }
        if (!$type || !$date) {
            return new WP_Error('missing_params', 'Type and Date are required', array('status' => 400));
        }

        // Create Log Post
        $log_title = sprintf('%s - %s (%s)', $post->post_title, ucfirst($type), $date);
        $log_data = array(
            'post_title' => $log_title,
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'post_author' => $user_id,
        );
        $log_id = wp_insert_post($log_data);

        if (is_wp_error($log_id)) {
            return new WP_Error('insert_failed', 'Could not create log', array('status' => 500));
        }

        // [追加] 画像アップロード処理
        if (!empty($_FILES['image'])) {
            // 既存のヘルパーメソッドを利用してアップロード
            $image_url = $this->handle_file_upload('image', $log_id);

            if (!is_wp_error($image_url) && $image_url) {
                // 画像URLをログのメタデータとして保存
                update_post_meta($log_id, '_setae_log_image', $image_url);
            }
        }

        // Save Meta
        update_post_meta($log_id, '_setae_log_spider_id', $spider_id);
        update_post_meta($log_id, '_setae_log_type', $type);
        update_post_meta($log_id, '_setae_log_date', $date);
        update_post_meta($log_id, '_setae_log_data', $data_json); // Store raw JSON string or serialized array

        // == Updates on Spider State ==
        // Update Last Feed / Molt Date on Spider
        if ($type === 'feed') {
            $parsed = is_string($data_json) ? json_decode($data_json, true) : $data_json;
            if (empty($parsed['refused'])) {
                update_post_meta($spider_id, '_setae_last_feed_date', $date);
                if (!empty($parsed['prey_type'])) {
                    update_post_meta($spider_id, '_setae_last_prey', sanitize_text_field($parsed['prey_type']));
                }
            }
        }
        if ($type === 'molt') {
            update_post_meta($spider_id, '_setae_last_molt_date', $date);
            // Auto update status? Maybe optional.
        }

        return new WP_REST_Response(array('success' => true, 'id' => $log_id), 201);
    }

    public function get_events($request)
    {
        $spider_id = $request['id'];
        // Check permission if private? For now, public or check owner.
        // Assuming My Spiders context mostly, but let's check ownership if strict.
        // public read for now is fine for "community" sharing? Or restrict? 
        // Code implies owner context largely, but let's allow read if spider is visible.

        $args = array(
            'post_type' => 'setae_log',
            'posts_per_page' => 50,
            'meta_query' => array(
                array(
                    'key' => '_setae_log_spider_id',
                    'value' => $spider_id
                )
            ),
            'orderby' => 'meta_value',
            'meta_key' => '_setae_log_date',
            'order' => 'DESC'
        );

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $data[] = array(
                    'id' => get_the_ID(),
                    'type' => get_post_meta(get_the_ID(), '_setae_log_type', true),
                    'date' => get_post_meta(get_the_ID(), '_setae_log_date', true),
                    'data' => get_post_meta(get_the_ID(), '_setae_log_data', true),
                    'note' => get_the_content(),
                    'image' => get_post_meta(get_the_ID(), '_setae_log_image', true)
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }
}
