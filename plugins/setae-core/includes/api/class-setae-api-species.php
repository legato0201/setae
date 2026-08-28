<?php

class Setae_API_Species extends WP_REST_Controller
{
    public function register_routes()
    {
        $version = '1';
        $namespace = 'setae/v' . $version;

        register_rest_route($namespace, '/species', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_items'),
                'permission_callback' => array($this, 'get_items_permissions_check'),
                'args' => $this->get_collection_params(),
            ),
            'schema' => array($this, 'get_public_item_schema'),
        ));

        register_rest_route($namespace, '/species/suggest', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'suggest_species'),
            'permission_callback' => '__return_true',
            'args' => array(
                'q' => array(
                    'default' => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'limit' => array(
                    'default' => 8,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($value) {
                        $value = absint($value);
                        return $value >= 1 && $value <= 12;
                    },
                ),
            ),
        ));

        register_rest_route($namespace, '/species/(?P<id>\d+)', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_species_detail'),
                'permission_callback' => array($this, 'get_item_permissions_check'),
                'args' => array(
                    'id' => array(
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ($value) {
                            return absint($value) > 0;
                        },
                    ),
                    'context' => array(
                        'default' => 'view',
                        'enum' => array('view', 'edit'),
                        'sanitize_callback' => 'sanitize_key',
                    ),
                    'include_related' => array(
                        'default' => true,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                ),
            ),
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array($this, 'update_species'),
                'permission_callback' => array($this, 'update_item_permissions_check'),
                'args' => $this->get_update_params(),
            ),
            'schema' => array($this, 'get_public_item_schema'),
        ));

        register_rest_route($namespace, '/species/(?P<id>\d+)/image', array(
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'upload_species_image'),
                'permission_callback' => array($this, 'upload_image_permissions_check'),
                'args' => array(
                    'id' => array(
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ($value) {
                            return absint($value) > 0;
                        },
                    ),
                    'role' => array(
                        'type' => 'string',
                        'default' => 'thumbnail',
                        'enum' => array('thumbnail', 'gallery', 'both'),
                        'sanitize_callback' => 'sanitize_key',
                    ),
                    'alt_text' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'caption' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => 'sanitize_textarea_field',
                    ),
                    'credit_type' => array(
                        'type' => 'string',
                        'default' => 'user',
                        'enum' => array('user', 'text'),
                        'sanitize_callback' => 'sanitize_key',
                    ),
                    'credit_text' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'credit_user' => array(
                        'type' => 'integer',
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                    'source_url' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => array($this, 'sanitize_url_param'),
                    ),
                    'license' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'expected_revision' => array(
                        'type' => 'string',
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ));

        register_rest_route($namespace, '/species/(?P<id>\d+)/stats', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_species_stats'),
            'permission_callback' => '__return_true',
        ));
    }

    public function get_items_permissions_check($request)
    {
        if ($request->get_param('context') !== 'edit') {
            return true;
        }

        return $this->get_edit_permission_result();
    }

    public function suggest_species($request)
    {
        global $wpdb;

        $query = trim((string) $request->get_param('q'));
        $query = mb_substr($query, 0, 80);
        $limit = min(12, max(1, absint($request->get_param('limit')) ?: 8));
        if ($query === '') {
            return rest_ensure_response(array());
        }

        $contains = '%' . $wpdb->esc_like($query) . '%';
        $prefix = $wpdb->esc_like($query) . '%';
        $sql = $wpdb->prepare(
            "SELECT p.ID,
                    p.post_title AS scientific_name,
                    COALESCE(common_name.meta_value, '') AS ja_name,
                    COALESCE(MAX(genus_term.name), '') AS genus
             FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} common_name
               ON common_name.post_id = p.ID
              AND common_name.meta_key = '_setae_common_name_ja'
             LEFT JOIN {$wpdb->term_relationships} genus_relationship
               ON genus_relationship.object_id = p.ID
             LEFT JOIN {$wpdb->term_taxonomy} genus_taxonomy
               ON genus_taxonomy.term_taxonomy_id = genus_relationship.term_taxonomy_id
              AND genus_taxonomy.taxonomy = 'setae_genus'
             LEFT JOIN {$wpdb->terms} genus_term
               ON genus_term.term_id = genus_taxonomy.term_id
             WHERE p.post_type = 'setae_species'
               AND p.post_status = 'publish'
               AND (
                    p.post_title LIKE %s
                    OR common_name.meta_value LIKE %s
                    OR genus_term.name LIKE %s
               )
             GROUP BY p.ID, p.post_title, common_name.meta_value
             ORDER BY CASE
                 WHEN p.post_title = %s OR common_name.meta_value = %s THEN 0
                 WHEN p.post_title LIKE %s OR common_name.meta_value LIKE %s THEN 1
                 ELSE 2
             END,
             p.post_title ASC
             LIMIT %d",
            $contains,
            $contains,
            $contains,
            $query,
            $query,
            $prefix,
            $prefix,
            $limit
        );
        $rows = $wpdb->get_results($sql, ARRAY_A);
        $items = array_map(function ($row) {
            return array(
                'id' => absint($row['ID']),
                'ja_name' => sanitize_text_field($row['ja_name']),
                'scientific_name' => sanitize_text_field($row['scientific_name']),
                'genus' => sanitize_text_field($row['genus']),
            );
        }, is_array($rows) ? $rows : array());

        return rest_ensure_response($items);
    }

    public function get_item_permissions_check($request)
    {
        if ($request->get_param('context') !== 'edit') {
            return true;
        }

        return $this->get_edit_permission_result(absint($request['id']));
    }

    public function update_item_permissions_check($request)
    {
        return $this->get_edit_permission_result(absint($request['id']));
    }

    public function upload_image_permissions_check($request)
    {
        $permission = $this->get_edit_permission_result(absint($request['id']));
        if (is_wp_error($permission)) {
            return $permission;
        }

        if (!current_user_can('upload_files')) {
            return new WP_Error(
                'setae_species_upload_forbidden',
                '画像をアップロードする権限がありません。',
                array('status' => 403)
            );
        }

        return true;
    }

    public function get_collection_params()
    {
        return array(
            'search' => array(
                'default' => '',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'page' => array(
                'default' => 1,
                'sanitize_callback' => 'absint',
                'validate_callback' => function ($value) {
                    return absint($value) > 0;
                },
            ),
            'per_page' => array(
                'default' => 20,
                'sanitize_callback' => 'absint',
                'validate_callback' => function ($value) {
                    $value = absint($value);
                    return $value >= 1 && $value <= 100;
                },
            ),
            'offset' => array(
                'sanitize_callback' => 'absint',
            ),
            'orderby' => array(
                'default' => 'title',
                'enum' => array('id', 'modified', 'title'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'order' => array(
                'default' => 'asc',
                'enum' => array('asc', 'desc'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'genus' => array(
                'default' => '',
                'sanitize_callback' => array($this, 'sanitize_slug_param'),
            ),
            'modified_after' => array(
                'default' => '',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => array($this, 'validate_iso8601'),
            ),
            'context' => array(
                'default' => 'view',
                'enum' => array('view', 'edit'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'status' => array(
                'default' => 'any',
                'enum' => array('any', 'publish', 'draft', 'pending', 'private'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'review_status' => array(
                'default' => '',
                'enum' => array('', 'unreviewed', 'draft', 'reviewed', 'verified'),
                'sanitize_callback' => 'sanitize_key',
            ),
        );
    }

    public function get_update_params()
    {
        return array(
            'id' => array(
                'sanitize_callback' => 'absint',
                'validate_callback' => function ($value) {
                    return absint($value) > 0;
                },
            ),
            'expected_revision' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'update_source' => array('type' => 'string', 'sanitize_callback' => 'sanitize_key'),
            'change_note' => array('type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'),
            'research_run_id' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'codex_model' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'validate_only' => array('type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean'),
            'title' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'scientific_name' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'ja_name' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'common_name_ja' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'description' => array('type' => 'string', 'sanitize_callback' => 'wp_kses_post'),
            'excerpt' => array('type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'),
            'slug' => array('type' => 'string', 'sanitize_callback' => array($this, 'sanitize_slug_param')),
            'status' => array(
                'type' => 'string',
                'enum' => array('publish', 'draft', 'pending', 'private'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'lifespan' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'size' => array(),
            'difficulty' => array(
                'type' => 'string',
                'enum' => array('', 'beginner', 'intermediate', 'expert'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'temperature' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'humidity' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'genus' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            'habitats' => array('type' => 'array', 'items' => array('type' => 'string')),
            'lifestyles' => array('type' => 'array', 'items' => array('type' => 'string')),
            'temperaments' => array('type' => 'array', 'items' => array('type' => 'string')),
            'featured_images' => array('type' => 'array', 'items' => array('type' => 'string', 'format' => 'uri')),
            'featured_media' => array('type' => 'integer', 'sanitize_callback' => 'absint'),
            'image_credit' => array(
                'type' => 'object',
                'properties' => array(
                    'type' => array('type' => 'string', 'enum' => array('user', 'text')),
                    'user_id' => array('type' => 'integer'),
                    'text' => array('type' => 'string'),
                ),
            ),
            'research_sources' => array('type' => 'array', 'items' => array('type' => 'object')),
            'research_notes' => array('type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'),
            'content_sections' => array('type' => 'object'),
            'care_profile' => array('type' => 'object'),
            'external_links' => array('type' => 'array', 'items' => array('type' => 'object')),
            'review_status' => array(
                'type' => 'string',
                'enum' => array('unreviewed', 'draft', 'reviewed', 'verified'),
                'sanitize_callback' => 'sanitize_key',
            ),
            'last_researched_at' => array(
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => array($this, 'validate_iso8601'),
            ),
        );
    }

    public function get_public_item_schema()
    {
        return $this->get_item_schema();
    }

    public function get_item_schema()
    {
        if ($this->schema) {
            return $this->schema;
        }

        $this->schema = array(
            '$schema' => 'http://json-schema.org/draft-04/schema#',
            'title' => 'setae_species',
            'type' => 'object',
            'properties' => array(
                'id' => array('type' => 'integer', 'readonly' => true),
                'title' => array('type' => 'string'),
                'scientific_name' => array('type' => 'string'),
                'ja_name' => array('type' => 'string'),
                'description' => array('type' => 'string'),
                'genus' => array('type' => 'string'),
                'lifespan' => array('type' => 'string'),
                'size' => array('type' => 'string'),
                'difficulty' => array('type' => 'string'),
                'temperature' => array('type' => 'string'),
                'humidity' => array('type' => 'string'),
                'featured_images' => array('type' => 'array', 'items' => array('type' => 'string', 'format' => 'uri')),
                'featured_media' => array('type' => 'integer'),
                'content_sections' => array('type' => 'object'),
                'care_profile' => array('type' => 'object'),
                'external_links' => array('type' => 'array', 'items' => array('type' => 'object')),
                'research' => array('type' => 'object'),
                'related_summary' => array('type' => 'object', 'readonly' => true),
                'breeding_candidates' => array('type' => 'array', 'readonly' => true),
                'shop_links' => array('type' => 'array', 'readonly' => true),
                'data_quality' => array('type' => 'object', 'readonly' => true),
                'modified_gmt' => array('type' => 'string', 'format' => 'date-time', 'readonly' => true),
                'revision' => array('type' => 'string', 'readonly' => true),
            ),
        );

        return $this->schema;
    }

    public function get_items($request)
    {
        global $wpdb;

        $context = $request->get_param('context') === 'edit' ? 'edit' : 'view';
        $search = trim((string) $request->get_param('search'));
        $page = max(1, absint($request->get_param('page')));
        $per_page = min(100, max(1, absint($request->get_param('per_page'))));
        $offset_param = $request->get_param('offset');
        $orderby_map = array(
            'id' => 'ID',
            'modified' => 'modified',
            'title' => 'title',
        );
        $orderby_key = sanitize_key($request->get_param('orderby'));
        $order = strtoupper((string) $request->get_param('order')) === 'DESC' ? 'DESC' : 'ASC';
        $post_status = 'publish';

        if ($context === 'edit') {
            $requested_status = sanitize_key($request->get_param('status'));
            $post_status = $requested_status === 'any'
                ? array('publish', 'draft', 'pending', 'private')
                : $requested_status;
        }

        $args = array(
            'post_type' => 'setae_species',
            'post_status' => $post_status,
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => isset($orderby_map[$orderby_key]) ? $orderby_map[$orderby_key] : 'title',
            'order' => $order,
        );

        if ($offset_param !== null && $offset_param !== '') {
            $args['offset'] = max(0, absint($offset_param));
        }

        if (!empty($search)) {
            $like_term = '%' . $wpdb->esc_like($search) . '%';
            $matching_ids = $wpdb->get_col($wpdb->prepare("
                SELECT DISTINCT p.ID
                FROM {$wpdb->posts} p
                LEFT JOIN {$wpdb->postmeta} pm
                    ON p.ID = pm.post_id
                    AND pm.meta_key = '_setae_common_name_ja'
                LEFT JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
                LEFT JOIN {$wpdb->term_taxonomy} tt
                    ON tt.term_taxonomy_id = tr.term_taxonomy_id
                    AND tt.taxonomy = 'setae_genus'
                LEFT JOIN {$wpdb->terms} genus_term ON genus_term.term_id = tt.term_id
                WHERE p.post_type = 'setae_species'
                    AND (p.post_title LIKE %s OR pm.meta_value LIKE %s OR genus_term.name LIKE %s)
            ", $like_term, $like_term, $like_term));

            if (empty($matching_ids)) {
                return $this->prepare_collection_response(array(), 0, $per_page);
            }

            $args['post__in'] = array_map('absint', $matching_ids);
        }

        $genus = $this->sanitize_slug_param($request->get_param('genus'));
        if ($genus) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'setae_genus',
                    'field' => 'slug',
                    'terms' => $genus,
                ),
            );
        }

        $modified_after = trim((string) $request->get_param('modified_after'));
        if ($modified_after) {
            $args['date_query'] = array(
                array(
                    'column' => 'post_modified_gmt',
                    'after' => $modified_after,
                    'inclusive' => false,
                ),
            );
        }

        $review_status = sanitize_key((string) $request->get_param('review_status'));
        if ($context === 'edit' && $review_status) {
            if ($review_status === 'unreviewed') {
                $args['meta_query'] = array(
                    'relation' => 'OR',
                    array(
                        'key' => '_setae_research_status',
                        'compare' => 'NOT EXISTS',
                    ),
                    array(
                        'key' => '_setae_research_status',
                        'value' => 'unreviewed',
                        'compare' => '=',
                    ),
                );
            } else {
                $args['meta_query'] = array(
                    array(
                        'key' => '_setae_research_status',
                        'value' => $review_status,
                        'compare' => '=',
                    ),
                );
            }
        }

        $query = new WP_Query($args);
        $data = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $id = get_the_ID();
                $data[] = $this->prepare_species_summary($id, $context);
            }
            wp_reset_postdata();
        }

        return $this->prepare_collection_response($data, (int) $query->found_posts, $per_page);
    }

    public function get_species_detail($request)
    {
        $id = absint($request['id']);
        $post = get_post($id);
        if (!$post || $post->post_type !== 'setae_species') {
            return new WP_Error('not_found', '種類が見つかりません', array('status' => 404));
        }

        $context = $request->get_param('context') === 'edit' ? 'edit' : 'view';
        if ($post->post_status !== 'publish' && !$this->current_user_can_edit_species($id)) {
            return new WP_Error('not_found', '種類が見つかりません', array('status' => 404));
        }
        $include_related = $request->get_param('include_related') === null
            ? true
            : rest_sanitize_boolean($request->get_param('include_related'));

        $terms = get_the_terms($id, 'setae_genus');
        $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';

        // Meta
        $featured = get_post_meta($id, '_setae_featured_images', true) ?: [];
        $lifespan = get_post_meta($id, '_setae_lifespan', true);
        $size = get_post_meta($id, '_setae_size', true);

        // ▼▼▼ 追加: ギャラリー画像の投稿者情報を取得する処理 ▼▼▼
        $featured_gallery = [];
        if (!empty($featured)) {
            global $wpdb;
            foreach ($featured as $url) {
                // その画像を持つログを検索
                $log_id = $wpdb->get_var($wpdb->prepare("
                    SELECT post_id FROM {$wpdb->postmeta}
                    WHERE meta_key = '_setae_log_image' AND meta_value = %s
                    LIMIT 1
                ", $url));

                $username = 'ユーザー不明';
                $avatar = '';

                if ($log_id) {
                    $log_post = get_post($log_id);
                    if ($log_post) {
                        $user_info = get_userdata($log_post->post_author);
                        if ($user_info) {
                            $username = $user_info->display_name;
                            $avatar_id = get_user_meta($user_info->ID, 'setae_user_avatar', true);
                            if ($avatar_id) {
                                $avatar = wp_get_attachment_url($avatar_id);
                            }
                        }
                    }
                }

                if ($username === 'ユーザー不明') {
                    $uploaded_credit = $this->get_uploaded_image_credit($id, $url);
                    if ($uploaded_credit) {
                        $username = $uploaded_credit['text'];
                        $avatar = $uploaded_credit['avatar'];
                    }
                }

                $featured_gallery[] = array(
                    'url' => $url,
                    'username' => $username,
                    'avatar' => $avatar
                );
            }
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        // Keeping Count
        $keeping_count = $this->count_active_keepers($id);
        $related_topics = $include_related
            ? $this->get_related_topics($id, $post->post_title, get_post_meta($id, '_setae_common_name_ja', true))
            : array();
        $related_care_logs = $include_related ? $this->get_related_care_logs($id) : array();
        $breeding_candidates = $include_related ? $this->get_breeding_candidates($id, 6) : array();
        $shop_links = ($include_related && class_exists('Setae_CPT_Ad'))
            ? Setae_CPT_Ad::get_approved_shop_links($id)
            : array();

        // 追加: 画像クレジット情報の構築
        $credit_type = get_post_meta($id, '_setae_image_credit_type', true) ?: 'user';
        $credit_user = get_post_meta($id, '_setae_image_credit_user', true);
        $credit_text = get_post_meta($id, '_setae_image_credit_text', true);

        $image_credit = array('type' => $credit_type, 'text' => '', 'avatar' => '');

        if ($credit_type === 'user' && $credit_user) {
            $user_info = get_userdata($credit_user);
            if ($user_info) {
                $image_credit['text'] = $user_info->display_name;
                $avatar_id = get_user_meta($user_info->ID, 'setae_user_avatar', true);
                if ($avatar_id) {
                    $image_credit['avatar'] = wp_get_attachment_url($avatar_id);
                }
            }
        } else if ($credit_type === 'text') {
            $image_credit['text'] = $credit_text;
        }
        if ($context === 'edit') {
            $image_credit['user_id'] = $credit_type === 'user' ? absint($credit_user) : 0;
        }

        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'scientific_name' => $post->post_title,
            'type' => 'setae_species',
            'slug' => $post->post_name,
            'status' => $post->post_status,
            'genus' => $genus,
            'ja_name' => get_post_meta($id, '_setae_common_name_ja', true),
            'common_name_ja' => get_post_meta($id, '_setae_common_name_ja', true),
            'description' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'thumb' => $this->get_species_representative_image($id, 'large'),
            'representative_image' => $this->get_species_representative_image_data($id, 'large', $context),
            'lifespan' => $lifespan,
            'size' => $size,
            'difficulty' => get_post_meta($id, '_setae_difficulty', true),
            'temperature' => get_post_meta($id, '_setae_temperature', true),
            'humidity' => get_post_meta($id, '_setae_humidity', true),
            'image_credit' => $image_credit, // 追加
            'featured_images' => $featured,
            'featured_media' => get_post_thumbnail_id($id) ?: 0,
            'image_records' => $this->get_species_image_records($id, $context),
            'featured_gallery' => $featured_gallery, // ★追加: ユーザー情報付きの配列をレスポンスに含める
            'keeping_count' => $keeping_count,
            'content_sections' => $this->get_structured_meta($id, '_setae_content_sections'),
            'care_profile' => $this->get_structured_meta($id, '_setae_care_profile'),
            'external_links' => $this->get_structured_meta($id, '_setae_external_links'),
            'related_topics' => $related_topics,
            'related_care_logs' => $related_care_logs,
            'breeding_candidates' => $breeding_candidates,
            'shop_links' => $shop_links,
            'research' => $this->get_species_research($id, $context),
            'related_summary' => $include_related
                ? $this->get_related_summary($id, $keeping_count, count($shop_links))
                : array(),
            'data_quality' => $this->get_species_data_quality($id, $post),
            'modified' => get_post_modified_time(DATE_ATOM, false, $post),
            'modified_gmt' => get_post_modified_time(DATE_ATOM, true, $post),
            'revision' => $this->get_species_revision($id),
            'link' => get_permalink($id),
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
            $data['temperament'] = '不明';
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

        $data['genera'] = $this->get_term_items($id, 'setae_genus');
        $data['habitats'] = $this->get_term_items($id, 'setae_habitat');
        $data['lifestyles'] = $this->get_term_items($id, 'setae_lifestyle');

        if ($context === 'edit') {
            $data['capabilities'] = array(
                'edit' => $this->current_user_can_edit_species($id),
                'upload' => current_user_can('upload_files') && $this->current_user_can_edit_species($id),
            );
            $data['last_api_update'] = get_post_meta($id, '_setae_api_last_update', true) ?: null;
            $history = get_post_meta($id, '_setae_api_update_history', true);
            $data['api_update_history'] = is_array($history) ? array_slice($history, -10) : array();
        }

        $response = new WP_REST_Response($data, 200);
        $response->header('ETag', '"' . $data['revision'] . '"');
        return $response;
    }

    public function update_species($request)
    {
        $id = absint($request['id']);
        $post = get_post($id);
        if (!$post || $post->post_type !== 'setae_species') {
            return new WP_Error('not_found', '種類が見つかりません', array('status' => 404));
        }

        $precondition = $this->check_revision_precondition($request, $id);
        if (is_wp_error($precondition)) {
            return $precondition;
        }
        $revision_before = $this->get_species_revision($id);

        $post_update = array('ID' => $id);
        $meta_updates = array();
        $taxonomy_updates = array();
        $changed_fields = array();
        $research_changed = false;
        $image_credit = null;
        $featured_media = null;

        if ($request->has_param('title') || $request->has_param('scientific_name')) {
            $scientific_name = $request->has_param('title')
                ? sanitize_text_field($request->get_param('title'))
                : sanitize_text_field($request->get_param('scientific_name'));
            if ($scientific_name === '') {
                return new WP_Error('invalid_scientific_name', '学名は空にできません。', array('status' => 400));
            }
            $post_update['post_title'] = $scientific_name;
            $changed_fields[] = 'scientific_name';
        }

        if ($request->has_param('description')) {
            $post_update['post_content'] = wp_kses_post($request->get_param('description'));
            $changed_fields[] = 'description';
        }
        if ($request->has_param('excerpt')) {
            $post_update['post_excerpt'] = sanitize_textarea_field($request->get_param('excerpt'));
            $changed_fields[] = 'excerpt';
        }
        if ($request->has_param('slug')) {
            $post_update['post_name'] = sanitize_title($request->get_param('slug'));
            $changed_fields[] = 'slug';
        }
        if ($request->has_param('status')) {
            $status = sanitize_key($request->get_param('status'));
            $allowed_statuses = array('publish', 'draft', 'pending', 'private');
            if (!in_array($status, $allowed_statuses, true)) {
                return new WP_Error('invalid_species_status', '公開状態が正しくありません。', array('status' => 400));
            }
            if ($status === 'publish' && !current_user_can('publish_posts')) {
                return new WP_Error('species_publish_forbidden', '図鑑情報を公開する権限がありません。', array('status' => 403));
            }
            $post_update['post_status'] = $status;
            $changed_fields[] = 'status';
        }

        if ($request->has_param('ja_name') || $request->has_param('common_name_ja')) {
            $meta_updates['_setae_common_name_ja'] = $request->has_param('ja_name')
                ? sanitize_text_field($request->get_param('ja_name'))
                : sanitize_text_field($request->get_param('common_name_ja'));
            $changed_fields[] = 'ja_name';
        }

        $text_meta_fields = array(
            'lifespan' => '_setae_lifespan',
            'temperature' => '_setae_temperature',
            'humidity' => '_setae_humidity',
        );
        foreach ($text_meta_fields as $request_key => $meta_key) {
            if ($request->has_param($request_key)) {
                $meta_updates[$meta_key] = sanitize_text_field($request->get_param($request_key));
                $changed_fields[] = $request_key;
            }
        }

        if ($request->has_param('size')) {
            $size = $request->get_param('size');
            if ($size !== '' && $size !== null && (!is_numeric($size) || (float) $size < 0 || (float) $size > 100)) {
                return new WP_Error('invalid_species_size', 'サイズは0〜100cmの数値で入力してください。', array('status' => 400));
            }
            $meta_updates['_setae_size'] = ($size === '' || $size === null) ? '' : $this->normalize_decimal($size);
            $changed_fields[] = 'size';
        }

        if ($request->has_param('difficulty')) {
            $difficulty = sanitize_key($request->get_param('difficulty'));
            $difficulty_map = array('' => 0, 'beginner' => 1, 'intermediate' => 2, 'expert' => 3);
            if (!array_key_exists($difficulty, $difficulty_map)) {
                return new WP_Error('invalid_species_difficulty', '難易度が正しくありません。', array('status' => 400));
            }
            $meta_updates['_setae_difficulty'] = $difficulty;
            $meta_updates['_setae_difficulty_num'] = $difficulty_map[$difficulty];
            $changed_fields[] = 'difficulty';
        }

        if ($request->has_param('featured_images')) {
            $featured_images = $this->normalize_featured_images($request->get_param('featured_images'));
            if (is_wp_error($featured_images)) {
                return $featured_images;
            }
            $meta_updates['_setae_featured_images'] = $featured_images;
            $changed_fields[] = 'featured_images';
        }

        if ($request->has_param('featured_media')) {
            $featured_media = absint($request->get_param('featured_media'));
            if ($featured_media && (!get_post($featured_media) || !wp_attachment_is_image($featured_media))) {
                return new WP_Error('invalid_featured_media', 'featured_mediaには画像の添付ファイルIDを指定してください。', array('status' => 400));
            }
            $changed_fields[] = 'featured_media';
        }

        if ($request->has_param('image_credit')) {
            $image_credit = $this->normalize_image_credit($request->get_param('image_credit'));
            if (is_wp_error($image_credit)) {
                return $image_credit;
            }
            $changed_fields[] = 'image_credit';
        }

        if ($request->has_param('research_sources')) {
            $sources = $this->normalize_research_sources($request->get_param('research_sources'));
            if (is_wp_error($sources)) {
                return $sources;
            }
            $meta_updates['_setae_research_sources'] = $sources;
            $changed_fields[] = 'research_sources';
            $research_changed = true;
        }
        if ($request->has_param('research_notes')) {
            $meta_updates['_setae_research_notes'] = sanitize_textarea_field($request->get_param('research_notes'));
            $changed_fields[] = 'research_notes';
            $research_changed = true;
        }

        if ($request->has_param('content_sections')) {
            $content_sections = $this->normalize_named_sections(
                $request->get_param('content_sections'),
                array('identification', 'distribution', 'natural_history', 'husbandry', 'feeding', 'breeding', 'conservation', 'cautions'),
                'content_sections'
            );
            if (is_wp_error($content_sections)) {
                return $content_sections;
            }
            $meta_updates['_setae_content_sections'] = $content_sections;
            $changed_fields[] = 'content_sections';
            $research_changed = true;
        }
        if ($request->has_param('care_profile')) {
            $care_profile = $this->normalize_named_sections(
                $request->get_param('care_profile'),
                array('enclosure', 'substrate', 'ventilation', 'water', 'feeding', 'growth', 'breeding', 'handling'),
                'care_profile'
            );
            if (is_wp_error($care_profile)) {
                return $care_profile;
            }
            $meta_updates['_setae_care_profile'] = $care_profile;
            $changed_fields[] = 'care_profile';
            $research_changed = true;
        }
        if ($request->has_param('external_links')) {
            $external_links = $this->normalize_external_links($request->get_param('external_links'));
            if (is_wp_error($external_links)) {
                return $external_links;
            }
            $meta_updates['_setae_external_links'] = $external_links;
            $changed_fields[] = 'external_links';
            $research_changed = true;
        }
        if ($request->has_param('review_status')) {
            $review_status = sanitize_key($request->get_param('review_status'));
            $allowed_review_statuses = array('unreviewed', 'draft', 'reviewed', 'verified');
            if (!in_array($review_status, $allowed_review_statuses, true)) {
                return new WP_Error('invalid_review_status', '調査ステータスが正しくありません。', array('status' => 400));
            }
            $meta_updates['_setae_research_status'] = $review_status;
            $changed_fields[] = 'review_status';
            $research_changed = true;
        }
        if ($request->has_param('last_researched_at')) {
            $last_researched_at = $this->normalize_iso8601($request->get_param('last_researched_at'));
            if (!$last_researched_at) {
                return new WP_Error('invalid_researched_at', '調査日時はISO 8601形式で入力してください。', array('status' => 400));
            }
            $meta_updates['_setae_last_researched_at'] = $last_researched_at;
            $changed_fields[] = 'last_researched_at';
            $research_changed = true;
        }

        if ($request->has_param('genus')) {
            $taxonomy_updates['setae_genus'] = $this->normalize_term_values($request->get_param('genus'), 1);
            $changed_fields[] = 'genus';
        }
        $taxonomy_fields = array(
            'habitats' => 'setae_habitat',
            'lifestyles' => 'setae_lifestyle',
            'temperaments' => 'setae_temperament',
        );
        foreach ($taxonomy_fields as $request_key => $taxonomy) {
            if ($request->has_param($request_key)) {
                $taxonomy_updates[$taxonomy] = $this->normalize_term_values($request->get_param($request_key), 20);
                $changed_fields[] = $request_key;
            }
        }

        if (empty($changed_fields)) {
            return new WP_Error('no_species_changes', '更新する図鑑情報を指定してください。', array('status' => 400));
        }

        if (rest_sanitize_boolean($request->get_param('validate_only'))) {
            return new WP_REST_Response(array(
                'valid' => true,
                'species_id' => $id,
                'revision' => $revision_before,
                'fields' => array_values(array_unique($changed_fields)),
                'message' => '入力内容は更新可能です。データは変更されていません。',
            ), 200);
        }

        $updated_id = wp_update_post($post_update, true);
        if (is_wp_error($updated_id)) {
            return $updated_id;
        }

        foreach ($meta_updates as $meta_key => $meta_value) {
            $this->set_species_meta($id, $meta_key, $meta_value);
        }
        if ($image_credit !== null) {
            $this->save_image_credit($id, $image_credit);
        }
        if ($featured_media !== null) {
            if ($featured_media) {
                set_post_thumbnail($id, $featured_media);
            } else {
                delete_post_thumbnail($id);
            }
        }

        foreach ($taxonomy_updates as $taxonomy => $terms) {
            $term_result = wp_set_object_terms($id, $terms, $taxonomy, false);
            if (is_wp_error($term_result)) {
                return $term_result;
            }
        }

        if ($research_changed) {
            if (!$request->has_param('last_researched_at')) {
                update_post_meta($id, '_setae_last_researched_at', gmdate('c'));
            }
            update_post_meta($id, '_setae_last_researched_by', get_current_user_id());
        }

        $this->bump_species_api_version($id);
        $this->record_api_update(
            $id,
            $changed_fields,
            sanitize_key((string) $request->get_param('update_source')) ?: 'rest_api',
            array(
                'change_note' => sanitize_textarea_field((string) $request->get_param('change_note')),
                'research_run_id' => sanitize_text_field((string) $request->get_param('research_run_id')),
                'codex_model' => sanitize_text_field((string) $request->get_param('codex_model')),
                'revision_before' => $revision_before,
                'revision_after' => $this->get_species_revision($id),
            )
        );
        clean_post_cache($id);

        $request->set_param('context', 'edit');
        $request->set_param('include_related', false);
        $response = $this->get_species_detail($request);
        if ($response instanceof WP_REST_Response) {
            $response->header('ETag', '"' . $this->get_species_revision($id) . '"');
        }

        return $response;
    }

    public function upload_species_image($request)
    {
        $id = absint($request['id']);
        $post = get_post($id);
        if (!$post || $post->post_type !== 'setae_species') {
            return new WP_Error('not_found', '種類が見つかりません', array('status' => 404));
        }

        $precondition = $this->check_revision_precondition($request, $id);
        if (is_wp_error($precondition)) {
            return $precondition;
        }

        $files = $request->get_file_params();
        $field = isset($files['file']) ? 'file' : (isset($files['image']) ? 'image' : '');
        if (!$field || empty($files[$field]['tmp_name'])) {
            return new WP_Error(
                'missing_species_image',
                '`file`または`image`フィールドで画像を送信してください。',
                array('status' => 400)
            );
        }

        $file = $files[$field];
        if (!empty($file['error'])) {
            return new WP_Error('species_image_upload_error', '画像を受け取れませんでした。', array('status' => 400));
        }

        $max_upload_size = wp_max_upload_size();
        if (!empty($file['size']) && (int) $file['size'] > $max_upload_size) {
            return new WP_Error(
                'species_image_too_large',
                '画像サイズがアップロード上限を超えています。',
                array('status' => 413, 'max_bytes' => $max_upload_size)
            );
        }

        $file_check = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
        $mime_type = !empty($file_check['type']) ? $file_check['type'] : '';
        if (!$mime_type || strpos($mime_type, 'image/') !== 0) {
            return new WP_Error(
                'invalid_species_image_type',
                'WordPressで利用可能な画像ファイルを送信してください。',
                array('status' => 415)
            );
        }

        $credit = $this->normalize_image_credit(array(
            'type' => $request->get_param('credit_type'),
            'text' => $request->get_param('credit_text'),
            'user_id' => $request->get_param('credit_user'),
        ));
        if (is_wp_error($credit)) {
            return $credit;
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        if (!isset($_FILES[$field])) {
            $_FILES[$field] = $file;
        }

        $attachment_id = media_handle_upload($field, $id, array(
            'post_title' => sanitize_text_field(pathinfo($file['name'], PATHINFO_FILENAME)),
            'post_excerpt' => sanitize_textarea_field($request->get_param('caption')),
        ));
        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        if (!wp_attachment_is_image($attachment_id)) {
            wp_delete_attachment($attachment_id, true);
            return new WP_Error('invalid_species_attachment', '画像として保存できませんでした。', array('status' => 415));
        }

        $alt_text = sanitize_text_field($request->get_param('alt_text'));
        if ($alt_text === '') {
            $common_name = get_post_meta($id, '_setae_common_name_ja', true);
            $alt_text = trim($common_name . ' ' . $post->post_title);
        }
        update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);

        $source_url = esc_url_raw($request->get_param('source_url'));
        $license = sanitize_text_field($request->get_param('license'));
        if ($source_url) {
            update_post_meta($attachment_id, '_setae_source_url', $source_url);
        }
        if ($license) {
            update_post_meta($attachment_id, '_setae_image_license', $license);
        }

        $image_url = wp_get_attachment_url($attachment_id);
        $role = sanitize_key($request->get_param('role')) ?: 'thumbnail';
        if ($role === 'thumbnail' || $role === 'both') {
            set_post_thumbnail($id, $attachment_id);
            $this->save_image_credit($id, $credit);
        }
        if ($role === 'gallery' || $role === 'both') {
            $gallery = get_post_meta($id, '_setae_featured_images', true);
            $gallery = is_array($gallery) ? $gallery : array();
            if ($image_url) {
                $gallery[] = esc_url_raw($image_url);
                update_post_meta($id, '_setae_featured_images', array_values(array_unique($gallery)));
            }
        }

        $records = $this->get_species_image_records($id, 'edit');
        $records[] = array(
            'attachment_id' => (int) $attachment_id,
            'url' => esc_url_raw($image_url),
            'role' => $role,
            'alt_text' => $alt_text,
            'credit' => $credit,
            'source_url' => $source_url,
            'license' => $license,
            'uploaded_at' => gmdate('c'),
            'uploaded_by' => get_current_user_id(),
        );
        update_post_meta($id, '_setae_species_image_records', array_slice($records, -100));

        wp_update_post(array('ID' => $id));
        $this->bump_species_api_version($id);
        $this->record_api_update($id, array('image'), 'rest_api_upload');
        clean_post_cache($id);

        $request->set_param('context', 'edit');
        $request->set_param('include_related', false);
        $detail_response = $this->get_species_detail($request);
        $detail = $detail_response instanceof WP_REST_Response ? $detail_response->get_data() : null;
        $revision = $this->get_species_revision($id);

        $response = new WP_REST_Response(array(
            'attachment' => array(
                'id' => (int) $attachment_id,
                'url' => esc_url_raw($image_url),
                'mime_type' => get_post_mime_type($attachment_id),
                'role' => $role,
                'alt_text' => $alt_text,
                'source_url' => $source_url,
                'license' => $license,
            ),
            'species' => $detail,
        ), 201);
        $response->header('Location', rest_url('wp/v2/media/' . $attachment_id));
        $response->header('ETag', '"' . $revision . '"');

        return $response;
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

    private function get_related_topics($species_id, $scientific_name, $common_name)
    {
        global $wpdb;

        $explicit_ids = get_posts(array(
            'post_type' => 'setae_topic',
            'post_status' => 'publish',
            'posts_per_page' => 5,
            'fields' => 'ids',
            'orderby' => 'modified',
            'order' => 'DESC',
            'meta_query' => array(
                array(
                    'key' => '_setae_related_species_id',
                    'value' => (int) $species_id,
                    'compare' => '=',
                ),
            ),
        ));

        $topic_ids = array_values(array_unique(array_map('absint', $explicit_ids)));

        if (count($topic_ids) < 5) {
            $terms = array_filter(array_unique(array(
                trim((string) $scientific_name),
                trim((string) $common_name),
            )));

            if (!empty($terms)) {
                $where_like = array();
                $params = array();
                foreach ($terms as $term) {
                    $like = '%' . $wpdb->esc_like($term) . '%';
                    $where_like[] = '(post_title LIKE %s OR post_content LIKE %s)';
                    $params[] = $like;
                    $params[] = $like;
                }

                $sql = "
                    SELECT ID
                    FROM {$wpdb->posts}
                    WHERE post_type = 'setae_topic'
                        AND post_status = 'publish'
                        AND (" . implode(' OR ', $where_like) . ")
                    ORDER BY post_modified_gmt DESC
                    LIMIT 10
                ";

                $fallback_ids = $wpdb->get_col($wpdb->prepare($sql, $params));
                foreach ($fallback_ids as $fallback_id) {
                    $fallback_id = absint($fallback_id);
                    if ($fallback_id && !in_array($fallback_id, $topic_ids, true)) {
                        $topic_ids[] = $fallback_id;
                    }
                    if (count($topic_ids) >= 5) {
                        break;
                    }
                }
            }
        }

        $items = array();

        foreach (array_slice($topic_ids, 0, 5) as $topic_id) {
            $item = $this->build_related_topic_item($topic_id);
            if ($item) {
                $items[] = $item;
            }
        }

        return $items;
    }

    private function build_related_topic_item($topic_id)
    {
        $topic = get_post($topic_id);
        if (!$topic || $topic->post_type !== 'setae_topic' || $topic->post_status !== 'publish') {
            return null;
        }

        $author = get_userdata($topic->post_author);
        return array(
            'id' => (int) $topic_id,
            'title' => get_the_title($topic_id),
            'type' => get_post_meta($topic_id, 'setae_topic_type', true) ?: 'general',
            'excerpt' => wp_trim_words(wp_strip_all_tags($topic->post_content), 24, '...'),
            'comment_count' => (int) get_comments_number($topic_id),
            'is_resolved' => get_post_meta($topic_id, '_setae_topic_status', true) === 'resolved',
            'updated_at' => get_post_field('post_modified', $topic_id),
            'author_name' => $author ? $author->display_name : 'ユーザー不明',
        );
    }

    private function get_related_care_logs($species_id)
    {
        $spider_ids = get_posts(array(
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'posts_per_page' => 80,
            'fields' => 'ids',
            'meta_query' => array(
                array(
                    'key' => '_setae_species_id',
                    'value' => $species_id,
                    'compare' => '=',
                ),
            ),
        ));

        $related_query = array(
            'relation' => 'OR',
            array(
                'key' => '_setae_related_species_id',
                'value' => $species_id,
                'compare' => '=',
            ),
        );

        if (!empty($spider_ids)) {
            $related_query[] = array(
                'key' => '_setae_log_spider_id',
                'value' => array_map('intval', $spider_ids),
                'compare' => 'IN',
            );
        }

        $logs = new WP_Query(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'posts_per_page' => 5,
            'meta_key' => '_setae_log_date',
            'orderby' => array(
                'meta_value' => 'DESC',
                'date' => 'DESC',
            ),
            'meta_query' => array(
                'relation' => 'AND',
                array(
                    'key' => '_setae_log_shared',
                    'value' => '1',
                ),
                $related_query,
            ),
        ));

        $items = array();
        if ($logs->have_posts()) {
            while ($logs->have_posts()) {
                $logs->the_post();
                $log_id = get_the_ID();
                $spider_id = (int) get_post_meta($log_id, '_setae_log_spider_id', true);
                $spider = $spider_id ? get_post($spider_id) : null;
                $log_type = get_post_meta($log_id, '_setae_log_type', true);
                $raw_data = get_post_meta($log_id, '_setae_log_data', true);
                $log_data = is_string($raw_data) ? json_decode($raw_data, true) : $raw_data;
                if (!is_array($log_data)) {
                    $log_data = array();
                }

                $author_id = (int) get_post_field('post_author', $log_id);
                $author = $author_id ? get_userdata($author_id) : null;
                $image = get_post_meta($log_id, '_setae_log_image', true);
                if (!$image && $spider_id) {
                    $image = get_post_meta($spider_id, '_setae_spider_image', true);
                }
                if (!$image) {
                    $image = get_the_post_thumbnail_url($species_id, 'thumbnail');
                }

                $items[] = array(
                    'id' => $log_id,
                    'type' => $log_type,
                    'type_label' => $this->get_log_type_label($log_type),
                    'date' => get_post_meta($log_id, '_setae_log_date', true),
                    'created_at' => get_post_field('post_date', $log_id),
                    'note' => !empty($log_data['note']) ? sanitize_textarea_field($log_data['note']) : '',
                    'image' => $image ?: '',
                    'spider_name' => $spider ? get_the_title($spider) : '',
                    'author_name' => $author ? $author->display_name : 'ユーザー不明',
                );
            }
            wp_reset_postdata();
        }

        return $items;
    }

    private function get_structured_meta($species_id, $meta_key)
    {
        $value = get_post_meta($species_id, $meta_key, true);
        return is_array($value) ? $value : array();
    }

    private function get_breeding_candidates($species_id, $limit = 6)
    {
        $posts = get_posts(array(
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'posts_per_page' => max(1, min(20, absint($limit))),
            'orderby' => 'modified',
            'order' => 'DESC',
            'meta_query' => array(
                'relation' => 'AND',
                array(
                    'key' => '_setae_species_id',
                    'value' => absint($species_id),
                    'compare' => '=',
                ),
                array(
                    'key' => '_setae_bl_status',
                    'value' => 'recruiting',
                    'compare' => '=',
                ),
            ),
        ));

        $items = array();
        foreach ($posts as $spider) {
            $contact_url = esc_url_raw(get_post_meta($spider->ID, '_setae_breeding_contact_url', true));
            $contact_parts = $contact_url ? wp_parse_url($contact_url) : array();
            if (!$contact_url || empty($contact_parts['scheme']) || strtolower($contact_parts['scheme']) !== 'https') {
                continue;
            }
            $image = get_post_meta($spider->ID, '_setae_spider_image', true);
            if (!$image) {
                $image = get_the_post_thumbnail_url($spider->ID, 'medium');
            }
            if (!$image) {
                $images = get_post_meta($spider->ID, '_setae_images', true);
                if (is_string($images) && strpos(ltrim($images), '[') === 0) {
                    $images = json_decode($images, true);
                }
                if (is_array($images) && !empty($images[0])) {
                    $image = $images[0];
                }
            }
            if (!$image) {
                $image = $this->get_species_representative_image($species_id, 'medium');
            }

            $owner = get_userdata($spider->post_author);
            $items[] = array(
                'id' => (int) $spider->ID,
                'name' => sanitize_text_field($spider->post_title),
                'image' => $image ? esc_url_raw($image) : '',
                'gender' => sanitize_key(get_post_meta($spider->ID, '_setae_gender', true)) ?: 'unknown',
                'owner_id' => (int) $spider->post_author,
                'owner_name' => $owner ? sanitize_text_field($owner->display_name) : 'ユーザー不明',
                'last_molt' => sanitize_text_field(
                    get_post_meta($spider->ID, '_setae_last_molt_date', true)
                        ?: get_post_meta($spider->ID, 'last_molt_date', true)
                ),
                'terms' => sanitize_textarea_field(get_post_meta($spider->ID, '_setae_bl_terms', true)),
                'contact_url' => $contact_url,
                'contact_label' => sanitize_text_field(get_post_meta($spider->ID, '_setae_breeding_contact_label', true)) ?: '外部連絡先を開く',
            );
        }

        return $items;
    }

    private function get_related_summary($species_id, $keeping_count = null, $shop_count = 0)
    {
        global $wpdb;

        $species_id = absint($species_id);
        $topic_row = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(DISTINCT topics.ID) AS topic_count,
                COUNT(DISTINCT CASE
                    WHEN status_pm.meta_value IS NULL OR status_pm.meta_value != 'resolved'
                    THEN topics.ID ELSE NULL END) AS open_count
            FROM {$wpdb->posts} topics
            INNER JOIN {$wpdb->postmeta} species_pm
                ON species_pm.post_id = topics.ID
                AND species_pm.meta_key = '_setae_related_species_id'
                AND CAST(species_pm.meta_value AS UNSIGNED) = %d
            LEFT JOIN {$wpdb->postmeta} status_pm
                ON status_pm.post_id = topics.ID
                AND status_pm.meta_key = '_setae_topic_status'
            WHERE topics.post_type = 'setae_topic'
                AND topics.post_status = 'publish'",
            $species_id
        ), ARRAY_A);

        $care_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT logs.ID)
            FROM {$wpdb->posts} logs
            INNER JOIN {$wpdb->postmeta} shared_pm
                ON shared_pm.post_id = logs.ID
                AND shared_pm.meta_key = '_setae_log_shared'
                AND shared_pm.meta_value = '1'
            LEFT JOIN {$wpdb->postmeta} direct_pm
                ON direct_pm.post_id = logs.ID
                AND direct_pm.meta_key = '_setae_related_species_id'
            LEFT JOIN {$wpdb->postmeta} spider_pm
                ON spider_pm.post_id = logs.ID
                AND spider_pm.meta_key = '_setae_log_spider_id'
            LEFT JOIN {$wpdb->postmeta} spider_species_pm
                ON spider_species_pm.post_id = CAST(spider_pm.meta_value AS UNSIGNED)
                AND spider_species_pm.meta_key = '_setae_species_id'
            WHERE logs.post_type = 'setae_log'
                AND logs.post_status = 'publish'
                AND (
                    CAST(direct_pm.meta_value AS UNSIGNED) = %d
                    OR CAST(spider_species_pm.meta_value AS UNSIGNED) = %d
                )",
            $species_id,
            $species_id
        ));

        $breeding_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT spiders.ID)
            FROM {$wpdb->posts} spiders
            INNER JOIN {$wpdb->postmeta} species_pm
                ON species_pm.post_id = spiders.ID
                AND species_pm.meta_key = '_setae_species_id'
                AND CAST(species_pm.meta_value AS UNSIGNED) = %d
            INNER JOIN {$wpdb->postmeta} status_pm
                ON status_pm.post_id = spiders.ID
                AND status_pm.meta_key = '_setae_bl_status'
                AND status_pm.meta_value = 'recruiting'
            WHERE spiders.post_type = 'setae_spider'
                AND spiders.post_status = 'publish'",
            $species_id
        ));

        $sources = get_post_meta($species_id, '_setae_research_sources', true);
        return array(
            'keepers' => $keeping_count === null ? $this->count_active_keepers($species_id) : (int) $keeping_count,
            'care_logs' => $care_count,
            'topics' => isset($topic_row['topic_count']) ? (int) $topic_row['topic_count'] : 0,
            'open_topics' => isset($topic_row['open_count']) ? (int) $topic_row['open_count'] : 0,
            'breeding_candidates' => $breeding_count,
            'shops' => (int) $shop_count,
            'research_sources' => is_array($sources) ? count($sources) : 0,
        );
    }

    private function get_species_data_quality($species_id, $post = null)
    {
        $post = $post ?: get_post($species_id);
        $sources = get_post_meta($species_id, '_setae_research_sources', true);
        $checks = array(
            'scientific_name' => $post && trim((string) $post->post_title) !== '',
            'ja_name' => trim((string) get_post_meta($species_id, '_setae_common_name_ja', true)) !== '',
            'description' => $post && trim((string) wp_strip_all_tags($post->post_content)) !== '',
            'image' => (bool) $this->get_species_representative_image($species_id, 'thumbnail'),
            'genus' => !empty($this->get_term_items($species_id, 'setae_genus')),
            'lifestyle' => !empty($this->get_term_items($species_id, 'setae_lifestyle')),
            'habitat' => !empty($this->get_term_items($species_id, 'setae_habitat')),
            'temperature' => trim((string) get_post_meta($species_id, '_setae_temperature', true)) !== '',
            'humidity' => trim((string) get_post_meta($species_id, '_setae_humidity', true)) !== '',
            'size' => trim((string) get_post_meta($species_id, '_setae_size', true)) !== '',
            'lifespan' => trim((string) get_post_meta($species_id, '_setae_lifespan', true)) !== '',
            'research_sources' => is_array($sources) && !empty($sources),
        );
        $completed = count(array_filter($checks));
        $total = count($checks);

        return array(
            'score' => $total ? (int) round(($completed / $total) * 100) : 0,
            'completed' => $completed,
            'total' => $total,
            'missing_fields' => array_values(array_keys(array_filter($checks, function ($complete) {
                return !$complete;
            }))),
        );
    }

    private function get_edit_permission_result($species_id = 0)
    {
        if (!$this->current_user_can_edit_species($species_id)) {
            return new WP_Error(
                'setae_species_edit_forbidden',
                '図鑑情報を編集する権限がありません。',
                array('status' => is_user_logged_in() ? 403 : 401)
            );
        }

        return true;
    }

    private function current_user_can_edit_species($species_id = 0)
    {
        $capability = apply_filters('setae_species_api_edit_capability', 'manage_setae_species_api', $species_id);
        if (!current_user_can($capability) && !current_user_can('manage_options')) {
            return false;
        }

        if (!$species_id && !current_user_can('edit_posts')) {
            return false;
        }

        if ($species_id) {
            $post = get_post($species_id);
            if ($post && !current_user_can('edit_post', $species_id)) {
                return false;
            }
        }

        return true;
    }

    private function prepare_collection_response($items, $total, $per_page)
    {
        $response = new WP_REST_Response(array_values($items), 200);
        $response->header('X-WP-Total', (int) $total);
        $response->header('X-WP-TotalPages', $per_page > 0 ? (int) ceil($total / $per_page) : 0);
        return $response;
    }

    private function prepare_species_summary($species_id, $context)
    {
        $post = get_post($species_id);
        $terms = get_the_terms($species_id, 'setae_genus');
        $genus = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : '';
        $common_name = get_post_meta($species_id, '_setae_common_name_ja', true);
        $research_sources = get_post_meta($species_id, '_setae_research_sources', true);
        $lifestyles = $this->get_term_items($species_id, 'setae_lifestyle');
        $habitats = $this->get_term_items($species_id, 'setae_habitat');

        $summary = array(
            'id' => (int) $species_id,
            'title' => $post ? $post->post_title : get_the_title($species_id),
            'scientific_name' => $post ? $post->post_title : get_the_title($species_id),
            'ja_name' => $common_name,
            'common_name_ja' => $common_name,
            'genus' => $genus,
            'excerpt' => $post ? ($post->post_excerpt ?: wp_trim_words(wp_strip_all_tags($post->post_content), 28, '...')) : '',
            'thumb' => $this->get_species_representative_image($species_id, 'thumbnail'),
            'representative_image' => $this->get_species_representative_image_data($species_id, 'thumbnail', $context),
            'difficulty' => get_post_meta($species_id, '_setae_difficulty', true),
            'temperature' => get_post_meta($species_id, '_setae_temperature', true),
            'humidity' => get_post_meta($species_id, '_setae_humidity', true),
            'lifestyles' => $lifestyles,
            'habitats' => $habitats,
            'research_status' => get_post_meta($species_id, '_setae_research_status', true) ?: 'unreviewed',
            'source_count' => is_array($research_sources) ? count($research_sources) : 0,
            'last_researched_at' => get_post_meta($species_id, '_setae_last_researched_at', true) ?: '',
            'data_quality' => $this->get_species_data_quality($species_id, $post),
            'link' => get_permalink($species_id),
            'modified_gmt' => get_post_modified_time(DATE_ATOM, true, $species_id),
            'revision' => $this->get_species_revision($species_id),
        );

        if ($context === 'edit' && $post) {
            $summary['status'] = $post->post_status;
            $summary['review_status'] = get_post_meta($species_id, '_setae_research_status', true) ?: 'unreviewed';
        }

        return $summary;
    }

    private function get_term_items($species_id, $taxonomy)
    {
        $terms = get_the_terms($species_id, $taxonomy);
        if (empty($terms) || is_wp_error($terms)) {
            return array();
        }

        return array_values(array_map(function ($term) {
            return array(
                'term_id' => (int) $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
            );
        }, $terms));
    }

    private function get_species_research($species_id, $context)
    {
        $research = array(
            'sources' => get_post_meta($species_id, '_setae_research_sources', true) ?: array(),
            'status' => get_post_meta($species_id, '_setae_research_status', true) ?: 'unreviewed',
            'last_researched_at' => get_post_meta($species_id, '_setae_last_researched_at', true) ?: '',
        );

        if ($context === 'edit') {
            $research['notes'] = get_post_meta($species_id, '_setae_research_notes', true) ?: '';
            $research['last_researched_by'] = (int) get_post_meta($species_id, '_setae_last_researched_by', true);
        }

        return $research;
    }

    private function get_uploaded_image_credit($species_id, $image_url)
    {
        $records = get_post_meta($species_id, '_setae_species_image_records', true);
        if (!is_array($records)) {
            return null;
        }

        foreach (array_reverse($records) as $record) {
            if (!is_array($record) || empty($record['url']) || $record['url'] !== $image_url) {
                continue;
            }

            $credit = isset($record['credit']) && is_array($record['credit']) ? $record['credit'] : array();
            if (isset($credit['type']) && $credit['type'] === 'user') {
                $user_id = isset($credit['user_id']) ? absint($credit['user_id']) : 0;
                $user = $user_id ? get_userdata($user_id) : null;
                if ($user) {
                    $avatar_id = get_user_meta($user_id, 'setae_user_avatar', true);
                    return array(
                        'text' => $user->display_name,
                        'avatar' => $avatar_id ? wp_get_attachment_url($avatar_id) : '',
                    );
                }
            }

            $text = isset($credit['text']) ? sanitize_text_field($credit['text']) : '';
            if ($text) {
                return array('text' => $text, 'avatar' => '');
            }
        }

        return null;
    }

    private function get_species_image_records($species_id, $context = 'view')
    {
        $records = get_post_meta($species_id, '_setae_species_image_records', true);
        if (!is_array($records)) {
            return array();
        }

        $prepared = array();
        foreach ($records as $record) {
            if (!is_array($record)) {
                continue;
            }

            $credit = isset($record['credit']) && is_array($record['credit']) ? $record['credit'] : array();
            $credit_type = isset($credit['type']) ? sanitize_key($credit['type']) : 'text';
            $credit_data = array('type' => $credit_type, 'text' => '');
            if ($credit_type === 'user') {
                $credit_user_id = isset($credit['user_id']) ? absint($credit['user_id']) : 0;
                $credit_user = $credit_user_id ? get_userdata($credit_user_id) : null;
                $credit_data['text'] = $credit_user ? $credit_user->display_name : '';
                if ($context === 'edit') {
                    $credit_data['user_id'] = $credit_user_id;
                }
            } else {
                $credit_data['text'] = isset($credit['text']) ? sanitize_text_field($credit['text']) : '';
            }

            $item = array(
                'attachment_id' => isset($record['attachment_id']) ? absint($record['attachment_id']) : 0,
                'url' => isset($record['url']) ? esc_url_raw($record['url']) : '',
                'role' => isset($record['role']) ? sanitize_key($record['role']) : 'gallery',
                'alt_text' => isset($record['alt_text']) ? sanitize_text_field($record['alt_text']) : '',
                'credit' => $credit_data,
                'source_url' => isset($record['source_url']) ? esc_url_raw($record['source_url']) : '',
                'license' => isset($record['license']) ? sanitize_text_field($record['license']) : '',
                'changes' => isset($record['changes']) ? sanitize_text_field($record['changes']) : '',
                'uploaded_at' => isset($record['uploaded_at']) ? sanitize_text_field($record['uploaded_at']) : '',
            );
            if ($context === 'edit') {
                $item['uploaded_by'] = isset($record['uploaded_by']) ? absint($record['uploaded_by']) : 0;
            }
            $prepared[] = $item;
        }

        return $prepared;
    }

    private function get_species_revision($species_id)
    {
        $modified_gmt = get_post_field('post_modified_gmt', $species_id);
        $api_version = (int) get_post_meta($species_id, '_setae_species_api_version', true);
        return hash('sha256', absint($species_id) . '|' . $modified_gmt . '|' . $api_version);
    }

    private function check_revision_precondition($request, $species_id)
    {
        $expected = trim((string) $request->get_param('expected_revision'));
        if ($expected === '') {
            $expected = trim((string) $request->get_header('if-match'));
        }
        $expected = trim($expected, " \t\n\r\0\x0B\"");
        if ($expected === '' || $expected === '*') {
            return true;
        }

        $current = $this->get_species_revision($species_id);
        if (!hash_equals($current, $expected)) {
            return new WP_Error(
                'species_revision_conflict',
                '図鑑情報が別の操作で更新されています。最新情報を取得してから再実行してください。',
                array(
                    'status' => 409,
                    'current_revision' => $current,
                    'modified_gmt' => get_post_modified_time(DATE_ATOM, true, $species_id),
                )
            );
        }

        return true;
    }

    private function bump_species_api_version($species_id)
    {
        $version = (int) get_post_meta($species_id, '_setae_species_api_version', true);
        update_post_meta($species_id, '_setae_species_api_version', $version + 1);
    }

    private function set_species_meta($species_id, $meta_key, $value)
    {
        if ($value === '' || $value === null) {
            delete_post_meta($species_id, $meta_key);
            return;
        }

        update_post_meta($species_id, $meta_key, $value);
    }

    private function normalize_decimal($value)
    {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');
    }

    private function normalize_featured_images($images)
    {
        if (!is_array($images)) {
            return new WP_Error('invalid_featured_images', 'featured_imagesはURLの配列で指定してください。', array('status' => 400));
        }
        if (count($images) > 50) {
            return new WP_Error('too_many_featured_images', '図鑑画像は50件以内で指定してください。', array('status' => 400));
        }

        $normalized = array();
        foreach ($images as $image) {
            $url = esc_url_raw($image);
            $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
            if (!$url || !in_array($scheme, array('http', 'https'), true)) {
                return new WP_Error('invalid_featured_image_url', '画像URLはhttpまたはhttpsで指定してください。', array('status' => 400));
            }
            $normalized[] = $url;
        }

        return array_values(array_unique($normalized));
    }

    private function normalize_image_credit($credit)
    {
        if (is_object($credit)) {
            $credit = (array) $credit;
        }
        if (!is_array($credit)) {
            return new WP_Error('invalid_image_credit', '画像クレジットの形式が正しくありません。', array('status' => 400));
        }

        $type = isset($credit['type']) ? sanitize_key($credit['type']) : 'user';
        if (!in_array($type, array('user', 'text'), true)) {
            return new WP_Error('invalid_image_credit_type', '画像クレジットの種類が正しくありません。', array('status' => 400));
        }

        if ($type === 'user') {
            $user_id = 0;
            if (isset($credit['user_id'])) {
                $user_id = absint($credit['user_id']);
            } elseif (isset($credit['user'])) {
                $user_id = absint($credit['user']);
            }
            if (!$user_id) {
                $user_id = get_current_user_id();
            }
            if (!$user_id || !get_userdata($user_id)) {
                return new WP_Error('invalid_image_credit_user', '画像提供ユーザーが見つかりません。', array('status' => 400));
            }
            return array('type' => 'user', 'user_id' => $user_id, 'text' => '');
        }

        $text = isset($credit['text']) ? sanitize_text_field($credit['text']) : '';
        if ($text === '') {
            return new WP_Error('missing_image_credit_text', '画像の提供元・ライセンスを入力してください。', array('status' => 400));
        }
        return array('type' => 'text', 'user_id' => 0, 'text' => $text);
    }

    private function save_image_credit($species_id, $credit)
    {
        update_post_meta($species_id, '_setae_image_credit_type', $credit['type']);
        if ($credit['type'] === 'user') {
            update_post_meta($species_id, '_setae_image_credit_user', absint($credit['user_id']));
            delete_post_meta($species_id, '_setae_image_credit_text');
        } else {
            update_post_meta($species_id, '_setae_image_credit_text', sanitize_text_field($credit['text']));
            delete_post_meta($species_id, '_setae_image_credit_user');
        }
    }

    private function normalize_research_sources($sources)
    {
        if (!is_array($sources)) {
            return new WP_Error('invalid_research_sources', 'research_sourcesは配列で指定してください。', array('status' => 400));
        }
        if (count($sources) > 50) {
            return new WP_Error('too_many_research_sources', '出典は50件以内で指定してください。', array('status' => 400));
        }

        $normalized = array();
        foreach ($sources as $source) {
            if (is_string($source)) {
                $source = array('url' => $source);
            } elseif (is_object($source)) {
                $source = (array) $source;
            }
            if (!is_array($source)) {
                return new WP_Error('invalid_research_source', '出典の形式が正しくありません。', array('status' => 400));
            }

            $url = isset($source['url']) ? esc_url_raw($source['url']) : '';
            $doi = isset($source['doi']) ? sanitize_text_field($source['doi']) : '';
            if ($url) {
                $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
                if (!in_array($scheme, array('http', 'https'), true)) {
                    return new WP_Error('invalid_research_source_url', '出典URLはhttpまたはhttpsで指定してください。', array('status' => 400));
                }
            }
            if (!$url && !$doi) {
                return new WP_Error('missing_research_source_locator', '各出典にはURLまたはDOIが必要です。', array('status' => 400));
            }

            $authors = isset($source['authors']) ? $source['authors'] : array();
            if (is_string($authors)) {
                $authors = array($authors);
            }
            $authors = is_array($authors)
                ? array_values(array_filter(array_map('sanitize_text_field', array_slice($authors, 0, 30))))
                : array();

            $year = isset($source['year']) ? absint($source['year']) : 0;
            if ($year && ($year < 1600 || $year > (int) gmdate('Y') + 1)) {
                return new WP_Error('invalid_research_source_year', '出典の発行年が正しくありません。', array('status' => 400));
            }

            $accessed_at = isset($source['accessed_at']) ? $this->normalize_iso8601($source['accessed_at']) : '';
            if (isset($source['accessed_at']) && !$accessed_at) {
                return new WP_Error('invalid_source_accessed_at', '出典の参照日時が正しくありません。', array('status' => 400));
            }

            $normalized[] = array(
                'title' => isset($source['title']) ? sanitize_text_field($source['title']) : '',
                'url' => $url,
                'doi' => $doi,
                'authors' => $authors,
                'year' => $year,
                'accessed_at' => $accessed_at ?: gmdate('c'),
                'note' => isset($source['note']) ? sanitize_textarea_field($source['note']) : '',
            );
        }

        return $normalized;
    }

    private function normalize_named_sections($sections, $allowed_keys, $field_name)
    {
        if (is_object($sections)) {
            $sections = (array) $sections;
        }
        if (!is_array($sections)) {
            return new WP_Error(
                'invalid_' . sanitize_key($field_name),
                $field_name . 'はオブジェクトで指定してください。',
                array('status' => 400)
            );
        }

        $unknown_keys = array_diff(array_keys($sections), $allowed_keys);
        if (!empty($unknown_keys)) {
            return new WP_Error(
                'unknown_' . sanitize_key($field_name) . '_keys',
                $field_name . 'に未対応のキーがあります。',
                array('status' => 400, 'unknown_keys' => array_values($unknown_keys), 'allowed_keys' => $allowed_keys)
            );
        }

        $normalized = array();
        foreach ($allowed_keys as $key) {
            if (!array_key_exists($key, $sections)) {
                continue;
            }
            if (!is_scalar($sections[$key]) && $sections[$key] !== null) {
                return new WP_Error(
                    'invalid_' . sanitize_key($field_name) . '_value',
                    $field_name . '.' . $key . 'は文字列で指定してください。',
                    array('status' => 400)
                );
            }
            $value = sanitize_textarea_field((string) $sections[$key]);
            if (strlen($value) > 12000) {
                return new WP_Error(
                    'oversized_' . sanitize_key($field_name) . '_value',
                    $field_name . '.' . $key . 'は12000文字以内で指定してください。',
                    array('status' => 400)
                );
            }
            $normalized[$key] = $value;
        }

        return $normalized;
    }

    private function normalize_external_links($links)
    {
        if (!is_array($links)) {
            return new WP_Error('invalid_external_links', 'external_linksは配列で指定してください。', array('status' => 400));
        }
        if (count($links) > 30) {
            return new WP_Error('too_many_external_links', '外部資料は30件以内で指定してください。', array('status' => 400));
        }

        $normalized = array();
        foreach ($links as $link) {
            if (is_object($link)) {
                $link = (array) $link;
            }
            if (!is_array($link)) {
                return new WP_Error('invalid_external_link', '外部資料の形式が正しくありません。', array('status' => 400));
            }

            $url = isset($link['url']) ? esc_url_raw($link['url']) : '';
            $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
            if (!$url || !in_array($scheme, array('http', 'https'), true)) {
                return new WP_Error('invalid_external_link_url', '外部資料URLはhttpまたはhttpsで指定してください。', array('status' => 400));
            }

            $title = isset($link['title']) ? sanitize_text_field($link['title']) : '';
            if (!$title) {
                return new WP_Error('missing_external_link_title', '各外部資料にはtitleが必要です。', array('status' => 400));
            }

            $normalized[] = array(
                'title' => $title,
                'url' => $url,
                'type' => isset($link['type']) ? sanitize_key($link['type']) : 'other',
                'note' => isset($link['note']) ? sanitize_textarea_field($link['note']) : '',
            );
        }

        return $normalized;
    }

    private function normalize_term_values($values, $limit)
    {
        if ($values === null || $values === '') {
            return array();
        }
        if (!is_array($values)) {
            $values = array($values);
        }

        $values = array_slice($values, 0, max(1, absint($limit)));
        return array_values(array_unique(array_filter(array_map('sanitize_text_field', $values))));
    }

    public function validate_iso8601($value)
    {
        if ($value === null || $value === '') {
            return true;
        }
        return (bool) $this->normalize_iso8601($value);
    }

    public function sanitize_slug_param($value)
    {
        return sanitize_title(is_scalar($value) ? (string) $value : '');
    }

    public function sanitize_url_param($value)
    {
        return esc_url_raw(is_scalar($value) ? (string) $value : '');
    }

    private function normalize_iso8601($value)
    {
        $value = trim((string) $value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}(?:[Tt ][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:[Zz]|[+-][0-2]\d:[0-5]\d)?)?$/', $value)) {
            return '';
        }
        $timestamp = strtotime($value);
        return $timestamp === false ? '' : gmdate('c', $timestamp);
    }

    private function record_api_update($species_id, $fields, $source, $context = array())
    {
        $entry = array(
            'request_id' => wp_generate_uuid4(),
            'updated_at' => gmdate('c'),
            'updated_by' => get_current_user_id(),
            'source' => sanitize_key($source) ?: 'rest_api',
            'fields' => array_values(array_unique(array_map('sanitize_key', $fields))),
        );
        if (!empty($context['change_note'])) {
            $entry['change_note'] = sanitize_textarea_field($context['change_note']);
        }
        if (!empty($context['research_run_id'])) {
            $entry['research_run_id'] = sanitize_text_field($context['research_run_id']);
        }
        if (!empty($context['codex_model'])) {
            $entry['codex_model'] = sanitize_text_field($context['codex_model']);
        }
        if (!empty($context['revision_before'])) {
            $entry['revision_before'] = sanitize_text_field($context['revision_before']);
        }
        if (!empty($context['revision_after'])) {
            $entry['revision_after'] = sanitize_text_field($context['revision_after']);
        }
        update_post_meta($species_id, '_setae_api_last_update', $entry);

        $history = get_post_meta($species_id, '_setae_api_update_history', true);
        $history = is_array($history) ? $history : array();
        $history[] = $entry;
        update_post_meta($species_id, '_setae_api_update_history', array_slice($history, -50));
    }

    private function get_log_type_label($type)
    {
        if ($type === 'feed') {
            return '給餌';
        }
        if ($type === 'molt') {
            return '脱皮';
        }
        if ($type === 'growth') {
            return '成長';
        }
        if ($type === 'observation') {
            return '観察';
        }
        return 'メモ';
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

    private function get_species_representative_image_data($species_id, $size = 'thumbnail', $context = 'view')
    {
        $species_id = absint($species_id);
        $attachment_id = absint(get_post_thumbnail_id($species_id));
        $url = $this->get_species_representative_image($species_id, $size);
        $full_url = $attachment_id ? wp_get_attachment_image_url($attachment_id, 'full') : '';
        $records = get_post_meta($species_id, '_setae_species_image_records', true);
        $records = is_array($records) ? array_reverse($records) : array();
        $matched = null;

        if ($attachment_id) {
            foreach ($records as $record) {
                if (is_array($record) && absint(isset($record['attachment_id']) ? $record['attachment_id'] : 0) === $attachment_id) {
                    $matched = $record;
                    break;
                }
            }
        }

        if (!$matched && $url) {
            foreach ($records as $record) {
                if (!is_array($record) || empty($record['url'])) {
                    continue;
                }
                $record_url = esc_url_raw($record['url']);
                if ($record_url === $url || ($full_url && $record_url === $full_url)) {
                    $matched = $record;
                    break;
                }
            }
        }

        $credit = $matched && isset($matched['credit']) && is_array($matched['credit'])
            ? $this->prepare_representative_credit($matched['credit'], $context)
            : $this->get_species_level_image_credit($species_id, $context);

        $source_url = $matched && !empty($matched['source_url'])
            ? esc_url_raw($matched['source_url'])
            : ($attachment_id ? esc_url_raw(get_post_meta($attachment_id, '_setae_source_url', true)) : '');
        $license_text = $matched && !empty($matched['license'])
            ? sanitize_text_field($matched['license'])
            : ($attachment_id ? sanitize_text_field(get_post_meta($attachment_id, '_setae_image_license', true)) : '');
        $changes = $matched && !empty($matched['changes'])
            ? sanitize_text_field($matched['changes'])
            : ($attachment_id ? sanitize_text_field(get_post_meta($attachment_id, '_setae_image_changes', true)) : '');
        $alt = $matched && !empty($matched['alt_text'])
            ? sanitize_text_field($matched['alt_text'])
            : ($attachment_id ? sanitize_text_field(get_post_meta($attachment_id, '_wp_attachment_image_alt', true)) : '');

        return array(
            'url' => esc_url_raw($url),
            'alt' => $alt ?: sanitize_text_field(get_the_title($species_id)),
            'credit' => $credit,
            'source_url' => $source_url,
            'license' => $this->normalize_image_license($license_text),
            'changes' => $changes,
        );
    }

    private function prepare_representative_credit($credit, $context = 'view')
    {
        $type = isset($credit['type']) ? sanitize_key($credit['type']) : 'text';
        $prepared = array('type' => $type, 'text' => '');
        if ($type === 'user') {
            $user_id = absint(isset($credit['user_id']) ? $credit['user_id'] : 0);
            $user = $user_id ? get_userdata($user_id) : null;
            $prepared['text'] = $user ? sanitize_text_field($user->display_name) : '';
            if ($context === 'edit') {
                $prepared['user_id'] = $user_id;
            }
        } else {
            $prepared['type'] = 'text';
            $prepared['text'] = isset($credit['text']) ? sanitize_text_field($credit['text']) : '';
        }
        return $prepared;
    }

    private function get_species_level_image_credit($species_id, $context = 'view')
    {
        return $this->prepare_representative_credit(array(
            'type' => get_post_meta($species_id, '_setae_image_credit_type', true) ?: 'text',
            'user_id' => absint(get_post_meta($species_id, '_setae_image_credit_user', true)),
            'text' => get_post_meta($species_id, '_setae_image_credit_text', true),
        ), $context);
    }

    private function normalize_image_license($license)
    {
        $label = trim(preg_replace('/\s+/', ' ', sanitize_text_field($license)));
        $known = array(
            'CC BY 4.0' => array('cc-by-4.0', 'https://creativecommons.org/licenses/by/4.0/'),
            'CC BY-SA 4.0' => array('cc-by-sa-4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'),
            'CC BY-NC 4.0' => array('cc-by-nc-4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'),
            'CC BY-NC-SA 4.0' => array('cc-by-nc-sa-4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'),
            'CC0 1.0' => array('cc0-1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
        );
        $lookup = strtoupper($label);
        if (isset($known[$lookup])) {
            return array(
                'code' => $known[$lookup][0],
                'label' => $lookup,
                'url' => $known[$lookup][1],
            );
        }
        return array('code' => '', 'label' => $label, 'url' => '');
    }
}
