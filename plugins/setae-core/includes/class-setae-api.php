<?php

class Setae_API
{

    public function __construct()
    {
        // Register REST API routes
        add_action('rest_api_init', array($this, 'register_routes'));

        // Legacy AJAX support if needed (keeping it modern with REST where possible, but user asked for admin-ajax in plan. I'll stick to REST + AJAX hybrid if easier, but REST is better for App feel.)
        // Let's stick to REST API for the "App" feel.
    }

    public function register_routes()
    {
        register_rest_route('setae/v1', '/species', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_species_list'),
            'permission_callback' => '__return_true', // Public data
        ));

        register_rest_route('setae/v1', '/spider/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_spider_detail'),
            'permission_callback' => '__return_true', // Public
        ));

        // BL Candidates
        register_rest_route('setae/v1', '/bl-candidates', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_bl_candidates'),
            'permission_callback' => '__return_true',
        ));

        // Contracts
        register_rest_route('setae/v1', '/contracts', array(
            'methods' => array('GET', 'POST'),
            'callback' => array($this, 'handle_contracts'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        register_rest_route('setae/v1', '/contracts/(?P<id>\d+)/status', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_contract_status'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // User Registration
        register_rest_route('setae/v1', '/register', array(
            'methods' => 'POST',
            'callback' => array($this, 'register_user'),
            'permission_callback' => '__return_true',
        ));

        // User Profile Update
        register_rest_route('setae/v1', '/user/profile', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_user_profile'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // My Spiders Management
        register_rest_route('setae/v1', '/spiders', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        register_rest_route('setae/v1', '/my-spiders', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_my_spiders'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)/favorite', array(
            'methods' => 'POST',
            'callback' => array($this, 'toggle_favorite'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Delete/Update Spider
        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        register_rest_route('setae/v1', '/spiders/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_spider'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // Spider Events
        register_rest_route('setae/v1', '/spider/(?P<id>\d+)/events', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_spider_events'),
            'permission_callback' => array($this, 'check_spider_read_permission')
        ));

        register_rest_route('setae/v1', '/spider/(?P<id>\d+)/events', array(
            'methods' => 'POST',
            'callback' => array($this, 'add_spider_event'),
            'permission_callback' => array($this, 'check_spider_write_permission')
        ));

        register_rest_route('setae/v1', '/spider/event/(?P<id>\d+)', array( // ID here is index actually, or we need unique IDs for events. 
            // Using existing post_meta structure (array of objects), deleting by index is risky if concurrent.
            // Better to assign unique ID to each event on creation.
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_spider_event'),
            'permission_callback' => array($this, 'check_spider_write_permission_by_event')
            // Logic: pass spider_id in body or param?
            // Actually, easier to pass spider_id and event_id in query or body.
            // Let's use /spider/(?P<id>\d+)/events/(?P<event_id>\w+)
        ));

        register_rest_route('setae/v1', '/spider/(?P<id>\d+)/events/(?P<event_id>[a-zA-Z0-9_]+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_spider_event'),
            'permission_callback' => array($this, 'check_spider_write_permission')
        ));

        // Community Threads
        register_rest_route('setae/v1', '/threads', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_threads'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/threads', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_thread'),
            'permission_callback' => function () {
                return is_user_logged_in();
            },
        ));

        // User Settings (Preferences)
        register_rest_route('setae/v1', '/user/settings', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_settings'),
            'permission_callback' => function () {
                return is_user_logged_in();
            }
        ));
        register_rest_route('setae/v1', '/user/settings', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_user_settings'),
            'permission_callback' => function () {
                return is_user_logged_in();
            }
        ));
    }

    public function get_species_list($request)
    {
        $search = $request->get_param('search');
        $offset = $request->get_param('offset') ?: 0;

        // ベースとなる引数
        $base_args = array(
            'post_type' => 'setae_species',
            'posts_per_page' => 20,
            'offset' => $offset,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
            'fields' => 'ids', // IDのみ取得して後でマージする
        );

        $final_ids = array();

        if (!empty($search)) {
            // クエリ1: 学名 (タイトル) で検索
            $args_title = $base_args;
            $args_title['s'] = $search;
            $query_title = new WP_Query($args_title);
            $ids_title = $query_title->posts;

            // クエリ2: 和名 (メタデータ) で検索
            $args_meta = $base_args;
            $args_meta['meta_query'] = array(
                array(
                    'key' => '_setae_common_name_ja',
                    'value' => $search,
                    'compare' => 'LIKE'
                )
            );
            $query_meta = new WP_Query($args_meta);
            $ids_meta = $query_meta->posts;

            // 結果を結合して重複を削除
            $final_ids = array_unique(array_merge($ids_title, $ids_meta));

            // ヒットなしの場合は空を返す
            if (empty($final_ids)) {
                return new WP_REST_Response(array(), 200);
            }
        } else {
            // 検索なしの場合
            $query = new WP_Query($base_args);
            $final_ids = $query->posts;
        }

        // 最終的なデータ取得 (詳細情報の取得)
        $args_final = array(
            'post_type' => 'setae_species',
            'post__in' => $final_ids,
            'posts_per_page' => 20,
            'orderby' => 'post__in', // 検索ヒット順などを考慮する場合はここを調整
        );

        $query = new WP_Query($args_final);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $terms = get_the_terms(get_the_ID(), 'setae_genus');
                $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';

                // 和名を取得
                $ja_name = get_post_meta(get_the_ID(), '_setae_common_name_ja', true);

                $data[] = array(
                    'id' => get_the_ID(),
                    'title' => get_the_title(),
                    'ja_name' => $ja_name, // ★ここを追加
                    'genus' => $genus,
                    'thumb' => get_the_post_thumbnail_url(get_the_ID(), 'medium'),
                    'link' => get_permalink(),
                );
            }
            wp_reset_postdata();
        }

        return new WP_REST_Response($data, 200);
    }

    public function get_spider_detail($request)
    {
        $spider_id = $request['id'];
        $post = get_post($spider_id);

        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        $meta = array(
            'species_id' => get_post_meta($spider_id, '_setae_species_id', true),
            'last_molt' => get_post_meta($spider_id, '_setae_last_molt_date', true),
            'last_feed' => get_post_meta($spider_id, '_setae_last_feed_date', true),
            'owner_id' => get_post_meta($spider_id, '_setae_owner_id', true),
        );

        $data = array(
            'id' => $spider_id,
            'title' => $post->post_title,
            'meta' => $meta
        );

        return new WP_REST_Response($data, 200);
    }

    public function get_bl_candidates($request)
    {
        $db = new Setae_BL_Contracts();
        $data = $db->get_recruiting_spiders();
        return new WP_REST_Response($data, 200);
    }

    public function handle_contracts($request)
    {
        $method = $request->get_method();
        $db = new Setae_BL_Contracts(); // Ensure included
        $user_id = get_current_user_id();

        if ($method === 'POST') {
            // Create Contract Request
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
            // GET: List my contracts
            $contracts = $db->get_contracts_by_user($user_id);
            // Enrich data with names
            foreach ($contracts as $c) {
                $c->spider_name = get_the_title($c->spider_id);
                $c->owner_name = get_the_author_meta('display_name', $c->owner_id);
                $c->breeder_name = get_the_author_meta('display_name', $c->breeder_id);
            }
            return new WP_REST_Response($contracts, 200);
        }
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
        // Permission check: Only owner or breeder involved can update?
        // Usually Owner approves/rejects REQUEST.

        if ($contract->owner_id != $user_id && $contract->breeder_id != $user_id) {
            return new WP_Error('forbidden', 'You are not part of this contract', array('status' => 403));
        }

        // Logic check: Only Owner can Approve/Reject a REQUEST?
        // Use simplified logic for now: Allow status update if user is involved.

        $result = $db->update_status($id, $status);
        return new WP_REST_Response(array('success' => !!$result), 200);
    }

    public function register_user($request)
    {
        $username = sanitize_user($request->get_param('username'));
        $email = sanitize_email($request->get_param('email'));
        $password = $request->get_param('password');

        if (empty($username) || empty($email) || empty($password)) {
            return new WP_Error('missing_params', 'All fields are required', array('status' => 400));
        }

        if (username_exists($username) || email_exists($email)) {
            return new WP_Error('exists', 'Username or Email already exists', array('status' => 409));
        }

        // $user_id = wp_create_user($username, $password, $email); // Defaults to Subscriber
        $user_id = wp_insert_user(array(
            'user_login' => $username,
            'user_pass' => $password,
            'user_email' => $email,
            'role' => 'setae_user' // Use our custom role with upload caps
        ));

        if (is_wp_error($user_id)) {
            return new WP_Error('registration_failed', $user_id->get_error_message(), array('status' => 400));
        }

        return new WP_REST_Response(array('success' => true, 'id' => $user_id), 201);
    }

    public function update_user_profile($request)
    {
        $user_id = get_current_user_id();
        $display_name = sanitize_text_field($request->get_param('display_name'));
        $email = sanitize_email($request->get_param('email'));
        $password = $request->get_param('password');
        $user_icon_id = $request->get_param('user_icon_id');

        $args = array('ID' => $user_id);

        if (!empty($display_name)) {
            $args['display_name'] = $display_name;
        }
        if (!empty($email)) {
            $args['user_email'] = $email;
        }
        if (!empty($password)) {
            $args['user_pass'] = $password;
        }

        $result = wp_update_user($args);

        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), array('status' => 400));
        }

        // Handle File Upload (Icon)
        if (!empty($_FILES['icon'])) {
            // Need to include these manually for frontend ajax calls sometimes
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');

            $attachment_id = media_handle_upload('icon', 0); // 0 = no post parent
            if (!is_wp_error($attachment_id)) {
                update_user_meta($user_id, 'setae_user_icon', $attachment_id);
            }
        } elseif (!empty($user_icon_id)) {
            update_user_meta($user_id, 'setae_user_icon', absint($user_icon_id));
        }

        return new WP_REST_Response(array(
            'success' => true,
            'user' => array(
                'display_name' => get_the_author_meta('display_name', $user_id),
                'email' => get_the_author_meta('user_email', $user_id),
                'icon' => wp_get_attachment_url(get_user_meta($user_id, 'setae_user_icon', true))
            )
        ), 200);
    }

    // ==========================================
    // User Settings (Preferences)
    // ==========================================
    public function get_user_settings($request)
    {
        $user_id = get_current_user_id();

        // Defaults
        $default_feed_types = ['ショウジョウバエ (Fruit Fly)', 'コオロギ (Cricket)', 'レッドローチ (Red Roach)', 'デュビア (Dubia)', 'ピンクマウス (Pinky)'];

        $saved = get_user_meta($user_id, 'setae_user_settings', true);
        if (!$saved)
            $saved = [];

        // Merge defaults if not present
        if (!isset($saved['feed_types'])) {
            $saved['feed_types'] = $default_feed_types;
        }

        return new WP_REST_Response($saved, 200);
    }

    public function update_user_settings($request)
    {
        $user_id = get_current_user_id();
        $params = $request->get_json_params();

        $current = get_user_meta($user_id, 'setae_user_settings', true);
        if (!$current)
            $current = [];

        // Update Keys provided
        if (isset($params['feed_types']) && is_array($params['feed_types'])) {
            $current['feed_types'] = array_map('sanitize_text_field', $params['feed_types']);
        }

        update_user_meta($user_id, 'setae_user_settings', $current);

        return new WP_REST_Response($current, 200);
    }

    // ==========================================
    // File Handling Helper
    // ==========================================
    private function handle_file_upload($file_key, $post_id = 0)
    {
        if (!isset($_FILES[$file_key]) || empty($_FILES[$file_key]['name'])) {
            return null; // No file uploaded
        }

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');

        // Check if file is image
        $file = $_FILES[$file_key];
        $check = getimagesize($file["tmp_name"]);
        if ($check === false) {
            return new WP_Error('invalid_file', 'File is not an image.', array('status' => 400));
        }

        // Upload
        $attachment_id = media_handle_upload($file_key, $post_id);

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        // Resize / Compress (WP does this by default on upload, but let's ensure we get the right size URL)
        // We can just return the URL of the 'large' or 'medium' size.
        // Or if we want to enforce max 1200px, WP settings usually handle this or we can add custom image size.
        // For simplicity, let's return the full URL of the uploaded attachment.

        return wp_get_attachment_url($attachment_id);
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
            // Also set as featured image? Not strictly necessary if we use meta key, but good for WP compat.
            // Actually handle_file_upload returns URL, media_handle_upload returns ID. 
            // We might want to keep ID for featured image.
            // Let's modify logic slightly above? No, keeping URL in meta is fine for REST.
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

        $name = sanitize_text_field($request->get_param('name'));

        if ($name) {
            wp_update_post(array('ID' => $spider_id, 'post_title' => $name));
        }

        // Handle Image Upload
        if (!empty($_FILES['image'])) {
            $image_url = $this->handle_file_upload('image', $spider_id);
            if (is_wp_error($image_url)) {
                return $image_url; // Return the specific upload error
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
        if ($request->get_param('status'))
            update_post_meta($spider_id, '_setae_status', sanitize_key($request->get_param('status')));

        return new WP_REST_Response(array('success' => true), 200);
    }

    // ... (delete_spider remains same)

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

    public function toggle_favorite($request)
    {
        $user_id = get_current_user_id();
        $spider_id = $request['id'];

        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return new WP_Error('not_found', 'Spider not found', array('status' => 404));
        }

        // Only owner can favorite for now (concept: Smart Decks are personal)
        // If we want users to favorite other's spiders, we need user_meta logic instead of post_meta logic.
        // For "My Spiders" section, post_meta is sufficient.
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

    // ... (create_thread, get_threads remain same)

    public function delete_spider($request)
    {
        // ... (Keep existing implementation)
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

    public function add_spider_event($request)
    {
        $spider_id = $request['id'];

        // Handle multipart params differently than JSON body
        // $request->get_params() handles both query and body (if parsable)
        // But for multipart, JSON body is not parsed automatically into JSON structure if mixed with files.
        // We expect individual fields in $_POST.

        $type = $request->get_param('type');
        $date = $request->get_param('date');

        if (!$type || !$date) {
            return new WP_Error('invalid_data', 'Type and Date are required', array('status' => 400));
        }

        $events = get_post_meta($spider_id, '_setae_spider_events', true);
        if (!is_array($events))
            $events = [];

        // Handle Image Upload
        $image_url = $this->handle_file_upload('image', $spider_id);

        // Handle other data (JSON stringified in 'data' field? or individual fields?)
        // Let's assume simpler structure: note, and data (JSON string or array)
        $data_param = $request->get_param('data');
        $data = is_string($data_param) ? json_decode(stripslashes($data_param), true) : $data_param;
        if (!$data)
            $data = array();

        $new_event = array(
            'id' => uniqid('evt_'),
            'type' => sanitize_text_field($type),
            'date' => sanitize_text_field($date),
            'note' => sanitize_textarea_field($request->get_param('note') ?: ''),
            'data' => $data,
            'image' => $image_url // Add image URL to event
        );

        $events[] = $new_event;
        update_post_meta($spider_id, '_setae_spider_events', $events);

        // Update main meta logic (same as before)
        if ($new_event['type'] === 'molt') {
            update_post_meta($spider_id, '_setae_last_molt_date', $new_event['date']);
            update_post_meta($spider_id, '_setae_status', 'post_molt');
        }
        if ($new_event['type'] === 'feed') {
            if (empty($new_event['data']['refused'])) {
                // Ate -> Normal
                update_post_meta($spider_id, '_setae_last_feed_date', $new_event['date']);
                update_post_meta($spider_id, '_setae_status', 'normal');
                if (!empty($new_event['data']['prey_type'])) {
                    update_post_meta($spider_id, '_setae_last_prey', sanitize_text_field($new_event['data']['prey_type']));
                }
            } else {
                // Refused -> Fasting (only if Normal)
                $current_status = get_post_meta($spider_id, '_setae_status', true) ?: 'normal';
                if ($current_status === 'normal') {
                    update_post_meta($spider_id, '_setae_status', 'fasting');
                }
            }
        }

        return new WP_REST_Response($new_event, 201);
    }

    public function delete_spider_event($request)
    {
        $spider_id = $request['id'];
        // Supporting both event_id in path or query
        $event_id = $request['event_id'];

        $events = get_post_meta($spider_id, '_setae_spider_events', true);
        if (!is_array($events))
            return new WP_Error('no_events', 'No events found', array('status' => 404));

        $updated_events = array_values(array_filter($events, function ($e) use ($event_id) {
            return $e['id'] !== $event_id;
        }));

        update_post_meta($spider_id, '_setae_spider_events', $updated_events);
        return new WP_REST_Response(array('deleted' => true, 'remaining' => count($updated_events)), 200);
    }

    // Permission Helpers
    public function check_spider_read_permission($request)
    {
        $spider_id = $request['id'];
        $user_id = get_current_user_id();
        $spider = get_post($spider_id);

        if (!$spider || $spider->post_type !== 'setae_spider')
            return false;

        // Owner always can read
        if ($spider->post_author == $user_id)
            return true;

        // Admin always can read
        if (current_user_can('manage_options'))
            return true;

        // If spider is public or part of a contract? 
        // For now, let's restrict "Detail Management" to owner.
        // Public profile might show limited info, but full logs are private management data.
        return false;
    }

    public function check_spider_write_permission($request)
    {
        $spider_id = $request['id'];
        $user_id = get_current_user_id();
        $spider = get_post($spider_id);

        if (!$spider || $spider->post_type !== 'setae_spider')
            return false;

        return ($spider->post_author == $user_id);
    }

    public function get_spider_events($request)
    {
        $spider_id = $request['id'];
        $events = get_post_meta($spider_id, '_setae_spider_events', true);
        if (!is_array($events)) {
            $events = [];
        }

        // Add robust sorting
        usort($events, function ($a, $b) {
            $date_a = isset($a['date']) ? $a['date'] : '';
            $date_b = isset($b['date']) ? $b['date'] : '';
            if (empty($date_a) && empty($date_b))
                return 0;
            if (empty($date_a))
                return 1;
            if (empty($date_b))
                return -1;
            return strtotime($date_b) - strtotime($date_a);
        });

        return new WP_REST_Response($events, 200);
    }

}
