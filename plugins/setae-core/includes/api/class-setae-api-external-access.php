<?php

/**
 * External API access for user-owned husbandry data.
 *
 * Plaintext access tokens are returned once and only a keyed hash is stored.
 */
class Setae_API_External_Access
{
    const TOKEN_META_KEY = '_setae_external_access_v1';
    const REQUEST_META_KEY = '_setae_external_request_key';
    const LOG_SOURCE_META_KEY = '_setae_log_source';
    const TOKEN_VERSION = 1;

    private $external_auth = null;

    public function register_routes()
    {
        register_rest_route('setae/v1', '/external-access', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_access_status'),
            'permission_callback' => array($this, 'management_permissions_check'),
        ));

        register_rest_route('setae/v1', '/external-access/token', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'issue_access_token'),
            'permission_callback' => array($this, 'management_permissions_check'),
            'args' => array(
                'mode' => array(
                    'default' => 'read_write',
                    'sanitize_callback' => 'sanitize_key',
                    'validate_callback' => function ($value) {
                        return in_array($value, array('read', 'read_write'), true);
                    },
                ),
            ),
        ));

        register_rest_route('setae/v1', '/external-access/disable', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'disable_access'),
            'permission_callback' => array($this, 'management_permissions_check'),
        ));

        register_rest_route('setae/v1', '/external/openapi', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_openapi_schema'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/external/spiders', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_external_spiders'),
            'permission_callback' => array($this, 'external_read_permissions_check'),
            'args' => array(
                'q' => array(
                    'default' => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'scope' => array(
                    'default' => 'active',
                    'sanitize_callback' => 'sanitize_key',
                    'validate_callback' => function ($value) {
                        return in_array($value, array('active', 'archived', 'all'), true);
                    },
                ),
                'classification' => array(
                    'default' => '',
                    'sanitize_callback' => 'sanitize_key',
                ),
                'status' => array(
                    'default' => '',
                    'sanitize_callback' => 'sanitize_key',
                ),
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($value) {
                        return (int) $value >= 1;
                    },
                ),
                'per_page' => array(
                    'default' => 50,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($value) {
                        $value = (int) $value;
                        return $value >= 1 && $value <= 100;
                    },
                ),
            ),
        ));

        register_rest_route('setae/v1', '/external/spiders/(?P<id>\d+)/records', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'add_external_record'),
            'permission_callback' => array($this, 'external_write_permissions_check'),
            'args' => array(
                'id' => array(
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($value) {
                        return (int) $value > 0;
                    },
                ),
            ),
        ));
    }

    public function management_permissions_check()
    {
        if (!is_user_logged_in() || !current_user_can('read')) {
            return new WP_Error(
                'setae_external_login_required',
                'ログインが必要です。',
                array('status' => 401)
            );
        }

        if (!$this->is_secure_request()) {
            return new WP_Error(
                'setae_external_https_required',
                'アクセストークンの管理にはHTTPS接続が必要です。',
                array('status' => 403)
            );
        }

        return true;
    }

    public function external_read_permissions_check($request)
    {
        return $this->authenticate_external_request($request, 'spiders:read');
    }

    public function external_write_permissions_check($request)
    {
        return $this->authenticate_external_request($request, 'records:write');
    }

    public function get_access_status()
    {
        $user_id = get_current_user_id();

        return $this->private_response(array(
            'success' => true,
            'access' => $this->build_access_status($user_id),
            'openapi_url' => esc_url_raw(rest_url('setae/v1/external/openapi')),
            'api_base_url' => esc_url_raw(rest_url('setae/v1/external')),
            'prompt' => $this->get_voice_operation_prompt(),
        ));
    }

    public function issue_access_token($request)
    {
        $user_id = get_current_user_id();
        $rate_limit = $this->consume_rate_limit('manage_issue_' . $user_id, 6, 300);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $mode = sanitize_key($request->get_param('mode') ?: 'read_write');
        if (!in_array($mode, array('read', 'read_write'), true)) {
            return new WP_Error(
                'setae_external_invalid_mode',
                '権限設定が正しくありません。',
                array('status' => 400)
            );
        }

        $token_id = $this->generate_token_id();
        $secret = wp_generate_password(48, false, false);
        if (!$token_id || !$secret) {
            return new WP_Error(
                'setae_external_token_generation_failed',
                'トークンを発行できませんでした。',
                array('status' => 500)
            );
        }

        $scopes = $this->get_mode_scopes($mode);
        $record = array(
            'version' => self::TOKEN_VERSION,
            'token_id' => $token_id,
            'secret_hash' => $this->hash_token_secret($token_id, $secret),
            'secret_last4' => substr($secret, -4),
            'enabled' => true,
            'mode' => $mode,
            'scopes' => $scopes,
            'created_at' => gmdate('c'),
            'last_used_at' => '',
        );

        $saved = update_user_meta($user_id, self::TOKEN_META_KEY, $record);
        if ($saved === false) {
            return new WP_Error(
                'setae_external_token_save_failed',
                'トークンを保存できませんでした。',
                array('status' => 500)
            );
        }

        $token = 'setae_v1_' . $user_id . '_' . $token_id . '_' . $secret;

        return $this->private_response(array(
            'success' => true,
            'token' => $token,
            'token_type' => 'Bearer',
            'shown_once' => true,
            'access' => $this->build_access_status($user_id),
            'openapi_url' => esc_url_raw(rest_url('setae/v1/external/openapi')),
            'api_base_url' => esc_url_raw(rest_url('setae/v1/external')),
            'prompt' => $this->get_voice_operation_prompt(),
        ), 201);
    }

    public function disable_access()
    {
        $user_id = get_current_user_id();
        $rate_limit = $this->consume_rate_limit('manage_disable_' . $user_id, 10, 300);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        delete_user_meta($user_id, self::TOKEN_META_KEY);

        return $this->private_response(array(
            'success' => true,
            'access' => $this->build_access_status($user_id),
            'message' => '外部アクセスを停止しました。',
            'openapi_url' => esc_url_raw(rest_url('setae/v1/external/openapi')),
            'api_base_url' => esc_url_raw(rest_url('setae/v1/external')),
            'prompt' => $this->get_voice_operation_prompt(),
        ));
    }

    /**
     * Internal service entry point used by authenticated integrations.
     */
    public function list_spiders_for_user($user_id, $params = array())
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return new WP_Error(
                'setae_external_invalid_user',
                'ユーザーを確認できません。',
                array('status' => 401)
            );
        }

        $request = new WP_REST_Request('GET', '/setae/v1/external/spiders');
        $request->set_query_params(array(
            'q' => sanitize_text_field($params['q'] ?? ''),
            'scope' => sanitize_key($params['scope'] ?? 'active'),
            'classification' => sanitize_key($params['classification'] ?? ''),
            'status' => sanitize_key($params['status'] ?? ''),
            'page' => max(1, absint($params['page'] ?? 1)),
            'per_page' => min(50, max(1, absint($params['per_page'] ?? 30))),
        ));

        $previous_auth = $this->external_auth;
        $this->external_auth = array(
            'user_id' => $user_id,
            'token_id' => 'internal',
            'mode' => 'read_write',
            'scopes' => array('spiders:read', 'records:write'),
        );

        try {
            return $this->get_external_spiders($request);
        } finally {
            $this->external_auth = $previous_auth;
        }
    }

    /**
     * Return one owned animal and its recent records.
     */
    public function get_spider_for_user($user_id, $spider_id, $history_limit = 20)
    {
        $user_id = absint($user_id);
        $spider_id = absint($spider_id);
        $post = get_post($spider_id);

        if (
            !$user_id
            || !$post
            || $post->post_type !== 'setae_spider'
            || $post->post_status !== 'publish'
            || (int) $post->post_author !== $user_id
        ) {
            return new WP_Error(
                'setae_external_spider_not_found',
                '対象の個体が見つかりません。',
                array('status' => 404)
            );
        }

        $history_limit = min(50, max(1, absint($history_limit)));
        $log_ids = get_posts(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'author' => $user_id,
            'posts_per_page' => $history_limit,
            'fields' => 'ids',
            'meta_key' => '_setae_log_date',
            'orderby' => array(
                'meta_value' => 'DESC',
                'ID' => 'DESC',
            ),
            'meta_query' => array(
                array(
                    'key' => '_setae_log_spider_id',
                    'value' => $spider_id,
                    'compare' => '=',
                ),
            ),
            'no_found_rows' => true,
        ));

        $records = array();
        foreach ($log_ids as $log_id) {
            $records[] = $this->build_external_log(absint($log_id));
        }

        return array(
            'success' => true,
            'animal' => $this->build_external_spider($spider_id),
            'records' => $records,
        );
    }

    /**
     * Add a record on behalf of an already authenticated integration.
     */
    public function add_record_for_user(
        $user_id,
        $spider_id,
        $params,
        $source = 'external_api'
    ) {
        $user_id = absint($user_id);
        $spider_id = absint($spider_id);
        if (!$user_id || !$spider_id || !is_array($params)) {
            return new WP_Error(
                'setae_external_invalid_record_target',
                '記録先の個体を確認できません。',
                array('status' => 400)
            );
        }

        $request = new WP_REST_Request(
            'POST',
            '/setae/v1/external/spiders/' . $spider_id . '/records'
        );
        $request->set_url_params(array('id' => $spider_id));
        $request->set_body_params($params);

        $previous_auth = $this->external_auth;
        $this->external_auth = array(
            'user_id' => $user_id,
            'token_id' => 'internal',
            'mode' => 'read_write',
            'scopes' => array('spiders:read', 'records:write'),
        );

        try {
            $result = $this->add_external_record($request);
        } finally {
            $this->external_auth = $previous_auth;
        }

        if (!is_wp_error($result)) {
            $data = $result instanceof WP_REST_Response ? $result->get_data() : $result;
            $log_id = is_array($data) ? absint($data['record']['id'] ?? 0) : 0;
            if ($log_id) {
                update_post_meta(
                    $log_id,
                    self::LOG_SOURCE_META_KEY,
                    sanitize_key($source) ?: 'external_api'
                );
            }
        }

        return $result;
    }

    /**
     * Validate and normalize a record without writing it.
     */
    public function preview_record_for_user($user_id, $spider_id, $params)
    {
        $user_id = absint($user_id);
        $spider_id = absint($spider_id);
        $post = get_post($spider_id);

        if (
            !$user_id
            || !$post
            || $post->post_type !== 'setae_spider'
            || $post->post_status !== 'publish'
            || (int) $post->post_author !== $user_id
        ) {
            return new WP_Error(
                'setae_external_spider_not_found',
                '対象の個体が見つかりません。',
                array('status' => 404)
            );
        }

        if (get_post_meta($spider_id, '_setae_spider_archived', true) === '1') {
            return new WP_Error(
                'setae_external_spider_archived',
                'アーカイブ中の個体には記録を追加できません。',
                array('status' => 409)
            );
        }

        if (!is_array($params)) {
            return new WP_Error(
                'setae_external_invalid_record',
                '記録内容を確認できません。',
                array('status' => 400)
            );
        }

        $request = new WP_REST_Request(
            'POST',
            '/setae/v1/external/spiders/' . $spider_id . '/records'
        );
        $request->set_url_params(array('id' => $spider_id));
        $request->set_body_params($params);
        $validated = $this->validate_record_request($request);
        if (is_wp_error($validated)) {
            return $validated;
        }

        $normalized = array(
            'request_id' => $validated['request_id'],
            'type' => $validated['type'],
            'date' => $validated['date'],
        );
        $data = is_array($validated['data']) ? $validated['data'] : array();
        if (array_key_exists('prey_type', $data)) {
            $normalized['prey_type'] = $data['prey_type'];
        }
        if (array_key_exists('refused', $data)) {
            $normalized['refused'] = (bool) $data['refused'];
        }
        if (array_key_exists('label', $data)) {
            $normalized['label'] = $data['label'];
        }
        if (array_key_exists('note', $data)) {
            $normalized['note'] = $data['note'];
        }
        if (array_key_exists('size', $data)) {
            $normalized['size_cm'] = (float) $data['size'];
        }

        return array(
            'success' => true,
            'animal' => $this->build_external_spider($spider_id),
            'params' => $normalized,
        );
    }

    /**
     * Update a small, explicit set of owned-animal fields.
     */
    public function update_spider_for_user(
        $user_id,
        $spider_id,
        $params,
        $source = 'external_api'
    ) {
        $user_id = absint($user_id);
        $spider_id = absint($spider_id);
        $post = get_post($spider_id);

        if (
            !$user_id
            || !$post
            || $post->post_type !== 'setae_spider'
            || $post->post_status !== 'publish'
            || (int) $post->post_author !== $user_id
        ) {
            return new WP_Error(
                'setae_external_spider_not_found',
                '対象の個体が見つかりません。',
                array('status' => 404)
            );
        }

        if (!is_array($params)) {
            return new WP_Error(
                'setae_external_invalid_update',
                '更新内容を確認できません。',
                array('status' => 400)
            );
        }

        $expected_version = sanitize_text_field($params['expected_version'] ?? '');
        $current = $this->build_external_spider($spider_id);
        if (
            $expected_version === ''
            || empty($current['version'])
            || !hash_equals((string) $current['version'], $expected_version)
        ) {
            return new WP_Error(
                'setae_external_version_conflict',
                '個体情報が別の操作で更新されています。最新の詳細を取得してからやり直してください。',
                array('status' => 409)
            );
        }

        $allowed_fields = array(
            'name',
            'gender',
            'status',
            'species_id',
            'species_name',
            'archived',
        );
        $updates = array();
        foreach ($allowed_fields as $field) {
            if (array_key_exists($field, $params)) {
                $updates[$field] = $params[$field];
            }
        }

        if (empty($updates)) {
            return new WP_Error(
                'setae_external_update_empty',
                '変更する項目を1つ以上指定してください。',
                array('status' => 400)
            );
        }

        if (isset($updates['species_id']) && isset($updates['species_name'])) {
            return new WP_Error(
                'setae_external_species_conflict',
                'species_idとspecies_nameは同時に指定できません。',
                array('status' => 400)
            );
        }

        if (isset($updates['name'])) {
            $updates['name'] = sanitize_text_field($updates['name']);
            if ($updates['name'] === '' || mb_strlen($updates['name']) > 100) {
                return new WP_Error(
                    'setae_external_invalid_name',
                    '個体名は1〜100文字で指定してください。',
                    array('status' => 400)
                );
            }
        }

        if (isset($updates['gender'])) {
            $updates['gender'] = sanitize_key($updates['gender']);
            if (!in_array($updates['gender'], array('unknown', 'female', 'male'), true)) {
                return new WP_Error(
                    'setae_external_invalid_gender',
                    'genderはunknown、female、maleのいずれかで指定してください。',
                    array('status' => 400)
                );
            }
        }

        if (isset($updates['status'])) {
            $updates['status'] = sanitize_key($updates['status']);
            if (
                !in_array(
                    $updates['status'],
                    array('normal', 'fasting', 'pre_molt', 'post_molt'),
                    true
                )
            ) {
                return new WP_Error(
                    'setae_external_invalid_status',
                    'statusの値が正しくありません。',
                    array('status' => 400)
                );
            }
        }

        if (isset($updates['species_id'])) {
            $updates['species_id'] = absint($updates['species_id']);
            $species = get_post($updates['species_id']);
            if (
                !$updates['species_id']
                || !$species
                || $species->post_type !== 'setae_species'
                || $species->post_status !== 'publish'
            ) {
                return new WP_Error(
                    'setae_external_invalid_species',
                    '指定された図鑑の種類が見つかりません。',
                    array('status' => 400)
                );
            }
        }

        if (isset($updates['species_name'])) {
            $updates['species_name'] = sanitize_text_field($updates['species_name']);
            if (
                $updates['species_name'] === ''
                || mb_strlen($updates['species_name']) > 160
            ) {
                return new WP_Error(
                    'setae_external_invalid_species_name',
                    '種類名は1〜160文字で指定してください。',
                    array('status' => 400)
                );
            }
        }

        if (isset($updates['archived']) && !is_bool($updates['archived'])) {
            return new WP_Error(
                'setae_external_invalid_archived',
                'archivedはtrueまたはfalseで指定してください。',
                array('status' => 400)
            );
        }
        if (
            array_key_exists('archived', $updates)
            && $updates['archived'] === false
            && get_post_meta($spider_id, '_setae_transfer_receipt', true) === '1'
        ) {
            return new WP_Error(
                'setae_external_transfer_receipt_locked',
                '譲渡済みの記録は飼育一覧へ戻せません。',
                array('status' => 400)
            );
        }

        if (!class_exists('Setae_API_Spiders')) {
            require_once __DIR__ . '/class-setae-api-spiders.php';
        }
        if (!class_exists('Setae_API_Spiders')) {
            return new WP_Error(
                'setae_external_update_handler_missing',
                '個体情報の更新処理を開始できませんでした。',
                array('status' => 500)
            );
        }

        $internal_request = new WP_REST_Request(
            'POST',
            '/setae/v1/spiders/' . $spider_id
        );
        $internal_request->set_url_params(array('id' => $spider_id));
        $internal_request->set_body_params($updates);

        $previous_user_id = get_current_user_id();
        try {
            wp_set_current_user($user_id);
            $spider_controller = new Setae_API_Spiders();
            $result = $spider_controller->update_spider($internal_request);
        } finally {
            wp_set_current_user($previous_user_id);
        }

        if (is_wp_error($result)) {
            return $result;
        }

        wp_update_post(array(
            'ID' => $spider_id,
            'post_modified' => current_time('mysql'),
            'post_modified_gmt' => current_time('mysql', true),
        ));
        update_post_meta(
            $spider_id,
            '_setae_last_external_edit_source',
            sanitize_key($source) ?: 'external_api'
        );
        update_post_meta($spider_id, '_setae_last_external_edit_at', gmdate('c'));

        return array(
            'success' => true,
            'changed_fields' => array_values(array_keys($updates)),
            'animal' => $this->build_external_spider($spider_id),
        );
    }

    public function get_external_spiders($request)
    {
        $user_id = (int) $this->external_auth['user_id'];
        $scope = sanitize_key($request->get_param('scope') ?: 'active');
        $classification_filter = sanitize_key($request->get_param('classification') ?: '');
        $status_filter = sanitize_key($request->get_param('status') ?: '');
        $query_text = $this->normalize_display_text($request->get_param('q') ?: '');
        $page = max(1, absint($request->get_param('page') ?: 1));
        $per_page = min(100, max(1, absint($request->get_param('per_page') ?: 50)));

        $query_args = array(
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'author' => $user_id,
            'posts_per_page' => -1,
            'fields' => 'ids',
            'orderby' => array(
                'title' => 'ASC',
                'ID' => 'ASC',
            ),
            'no_found_rows' => true,
        );

        $archive_meta_query = $this->get_archive_meta_query($scope);
        if (!empty($archive_meta_query)) {
            $query_args['meta_query'] = $archive_meta_query;
        }

        $spider_ids = get_posts($query_args);
        $matching = array();

        foreach ($spider_ids as $spider_id) {
            $spider = $this->build_external_spider((int) $spider_id);
            if (!$spider) {
                continue;
            }
            if ($classification_filter && $spider['classification'] !== $classification_filter) {
                continue;
            }
            if ($status_filter && $spider['status'] !== $status_filter) {
                continue;
            }
            if ($query_text && !$this->spider_matches_query($spider, $query_text)) {
                continue;
            }
            $matching[] = $spider;
        }

        $total = count($matching);
        $total_pages = $total ? (int) ceil($total / $per_page) : 0;
        $offset = ($page - 1) * $per_page;
        $items = array_slice($matching, $offset, $per_page);

        $response = $this->private_response(array(
            'success' => true,
            'items' => $items,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => $total_pages,
                'has_more' => $offset + count($items) < $total,
            ),
            'filters' => array(
                'q' => $query_text,
                'scope' => $scope,
                'classification' => $classification_filter,
                'status' => $status_filter,
            ),
        ));
        $response->header('X-WP-Total', (string) $total);
        $response->header('X-WP-TotalPages', (string) $total_pages);

        return $response;
    }

    public function add_external_record($request)
    {
        $user_id = (int) $this->external_auth['user_id'];
        $spider_id = absint($request['id']);
        $spider_post = get_post($spider_id);

        if (
            !$spider_post
            || $spider_post->post_type !== 'setae_spider'
            || $spider_post->post_status !== 'publish'
            || (int) $spider_post->post_author !== $user_id
        ) {
            return new WP_Error(
                'setae_external_spider_not_found',
                '対象の個体が見つかりません。',
                array('status' => 404)
            );
        }

        if (get_post_meta($spider_id, '_setae_spider_archived', true) === '1') {
            return new WP_Error(
                'setae_external_spider_archived',
                'アーカイブ中の個体には記録を追加できません。',
                array('status' => 409)
            );
        }

        $validated = $this->validate_record_request($request);
        if (is_wp_error($validated)) {
            return $validated;
        }

        $request_id = $validated['request_id'];
        $request_key = $this->hash_request_id($user_id, $request_id);
        $existing = $this->find_existing_request_log($user_id, $request_key);

        if ($existing) {
            return $this->duplicate_record_response($existing, $spider_id, $request_id);
        }

        $lock_name = 'setae_ext_lock_' . $request_key;
        if (!$this->acquire_request_lock($lock_name)) {
            $existing = $this->find_existing_request_log($user_id, $request_key);
            if ($existing) {
                return $this->duplicate_record_response($existing, $spider_id, $request_id);
            }

            return new WP_Error(
                'setae_external_request_in_progress',
                '同じ操作を処理中です。同じrequest_idのまま少し待って再試行してください。',
                array(
                    'status' => 409,
                    'retryable' => true,
                )
            );
        }

        try {
            $existing = $this->find_existing_request_log($user_id, $request_key);
            if ($existing) {
                return $this->duplicate_record_response($existing, $spider_id, $request_id);
            }

            if (!class_exists('Setae_API_Spiders')) {
                return new WP_Error(
                    'setae_external_record_handler_missing',
                    '記録処理を開始できませんでした。',
                    array('status' => 500)
                );
            }

            $internal_request = new WP_REST_Request(
                'POST',
                '/setae/v1/spider/' . $spider_id . '/events'
            );
            $internal_request->set_url_params(array('id' => $spider_id));
            $internal_request->set_body_params(array(
                'type' => $validated['type'],
                'date' => $validated['date'],
                'data' => wp_json_encode($validated['data'], JSON_UNESCAPED_UNICODE),
                'compact_response' => true,
            ));

            $previous_user_id = get_current_user_id();
            try {
                wp_set_current_user($user_id);
                $spider_controller = new Setae_API_Spiders();
                $result = $spider_controller->log_event($internal_request);
            } finally {
                wp_set_current_user($previous_user_id);
            }

            if (is_wp_error($result)) {
                return $result;
            }

            $result_data = $result instanceof WP_REST_Response ? $result->get_data() : $result;
            $log_id = is_array($result_data) && !empty($result_data['id'])
                ? absint($result_data['id'])
                : 0;

            if (!$log_id) {
                return new WP_Error(
                    'setae_external_record_failed',
                    '記録を保存できませんでした。',
                    array('status' => 500)
                );
            }

            update_post_meta($log_id, self::REQUEST_META_KEY, $request_key);
            update_post_meta($log_id, self::LOG_SOURCE_META_KEY, 'external_api');

            return $this->private_response(array(
                'success' => true,
                'duplicate' => false,
                'request_id' => $request_id,
                'record' => $this->build_external_log($log_id),
                'spider' => $this->build_external_spider($spider_id),
            ), 201);
        } catch (Throwable $error) {
            return new WP_Error(
                'setae_external_record_failed',
                '記録を保存できませんでした。',
                array('status' => 500)
            );
        } finally {
            delete_option($lock_name);
        }
    }

    public function get_openapi_schema()
    {
        $server_url = untrailingslashit(rest_url('setae/v1'));
        $record_schema = array(
            'type' => 'object',
            'additionalProperties' => false,
            'required' => array('request_id', 'type', 'date'),
            'properties' => array(
                'request_id' => array(
                    'type' => 'string',
                    'minLength' => 8,
                    'maxLength' => 80,
                    'pattern' => '^[A-Za-z0-9._:-]+$',
                    'description' => '操作ごとの一意なID。再試行では必ず同じ値を使う。',
                ),
                'type' => array(
                    'type' => 'string',
                    'enum' => array('feed', 'molt', 'pairing', 'observation', 'growth'),
                    'description' => '記録種別。',
                ),
                'date' => array(
                    'type' => 'string',
                    'format' => 'date',
                    'description' => '記録日。Asia/TokyoのYYYY-MM-DD。',
                ),
                'prey_type' => array(
                    'type' => 'string',
                    'maxLength' => 100,
                    'description' => '給餌した餌。feedで使用。',
                ),
                'refused' => array(
                    'type' => 'boolean',
                    'default' => false,
                    'description' => '拒食ならtrue。feedで使用。',
                ),
                'size_cm' => array(
                    'type' => 'number',
                    'minimum' => 0.01,
                    'maximum' => 100,
                    'description' => '計測サイズ(cm)。growthでは必須。',
                ),
                'label' => array(
                    'type' => 'string',
                    'maxLength' => 120,
                    'description' => '観察の短い見出し。',
                ),
                'note' => array(
                    'type' => 'string',
                    'maxLength' => 2000,
                    'description' => '自由記述メモ。',
                ),
            ),
        );

        $schema = array(
            'openapi' => '3.1.0',
            'info' => array(
                'title' => 'SETAE External Care API',
                'version' => '1.0.0',
                'description' => 'ログインユーザー本人の個体一覧を取得し、飼育記録を追加するAPI。',
            ),
            'servers' => array(
                array('url' => $server_url),
            ),
            'security' => array(
                array('BearerAuth' => array()),
            ),
            'paths' => array(
                '/external/spiders' => array(
                    'get' => array(
                        'operationId' => 'listSetaeSpiders',
                        'summary' => '自分の個体一覧を検索する',
                        'description' => '名前、種類名、個体IDで検索できる。書き込み前の個体特定に必ず使用する。',
                        'parameters' => array(
                            array(
                                'name' => 'q',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array('type' => 'string', 'maxLength' => 100),
                                'description' => '個体名、種類名、または個体ID。',
                            ),
                            array(
                                'name' => 'scope',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array(
                                    'type' => 'string',
                                    'enum' => array('active', 'archived', 'all'),
                                    'default' => 'active',
                                ),
                            ),
                            array(
                                'name' => 'classification',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array('type' => 'string'),
                            ),
                            array(
                                'name' => 'status',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array('type' => 'string'),
                            ),
                            array(
                                'name' => 'page',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array('type' => 'integer', 'minimum' => 1, 'default' => 1),
                            ),
                            array(
                                'name' => 'per_page',
                                'in' => 'query',
                                'required' => false,
                                'schema' => array(
                                    'type' => 'integer',
                                    'minimum' => 1,
                                    'maximum' => 100,
                                    'default' => 50,
                                ),
                            ),
                        ),
                        'responses' => array(
                            '200' => array(
                                'description' => '個体一覧。',
                                'content' => array(
                                    'application/json' => array(
                                        'schema' => array(
                                            'type' => 'object',
                                            'properties' => array(
                                                'success' => array('type' => 'boolean'),
                                                'items' => array(
                                                    'type' => 'array',
                                                    'items' => array('$ref' => '#/components/schemas/Spider'),
                                                ),
                                                'pagination' => array('$ref' => '#/components/schemas/Pagination'),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                            '401' => array('$ref' => '#/components/responses/Unauthorized'),
                            '429' => array('$ref' => '#/components/responses/RateLimited'),
                        ),
                    ),
                ),
                '/external/spiders/{id}/records' => array(
                    'post' => array(
                        'operationId' => 'addSetaeSpiderRecord',
                        'summary' => '個体に飼育記録を追加する',
                        'description' => '給餌、脱皮、ペアリング、観察、成長記録を追加する。曖昧な個体には実行しない。',
                        'parameters' => array(
                            array(
                                'name' => 'id',
                                'in' => 'path',
                                'required' => true,
                                'schema' => array('type' => 'integer', 'minimum' => 1),
                                'description' => 'listSetaeSpidersで確認した個体ID。',
                            ),
                        ),
                        'requestBody' => array(
                            'required' => true,
                            'content' => array(
                                'application/json' => array('schema' => $record_schema),
                            ),
                        ),
                        'responses' => array(
                            '201' => array(
                                'description' => '記録を保存した。',
                                'content' => array(
                                    'application/json' => array(
                                        'schema' => array('$ref' => '#/components/schemas/RecordResult'),
                                    ),
                                ),
                            ),
                            '200' => array(
                                'description' => '同じrequest_idで既に保存済みの記録。',
                                'content' => array(
                                    'application/json' => array(
                                        'schema' => array('$ref' => '#/components/schemas/RecordResult'),
                                    ),
                                ),
                            ),
                            '400' => array('$ref' => '#/components/responses/BadRequest'),
                            '401' => array('$ref' => '#/components/responses/Unauthorized'),
                            '403' => array('$ref' => '#/components/responses/Forbidden'),
                            '409' => array('$ref' => '#/components/responses/Conflict'),
                            '429' => array('$ref' => '#/components/responses/RateLimited'),
                        ),
                    ),
                ),
            ),
            'components' => array(
                'securitySchemes' => array(
                    'BearerAuth' => array(
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'SETAE access token',
                    ),
                ),
                'schemas' => array(
                    'Spider' => array(
                        'type' => 'object',
                        'properties' => array(
                            'id' => array('type' => 'integer'),
                            'reference' => array('type' => 'string'),
                            'name' => array('type' => 'string'),
                            'species_name' => array('type' => 'string'),
                            'classification' => array('type' => 'string'),
                            'gender' => array('type' => 'string'),
                            'status' => array('type' => 'string'),
                            'last_feed' => array('type' => array('string', 'null'), 'format' => 'date'),
                            'last_molt' => array('type' => array('string', 'null'), 'format' => 'date'),
                            'last_pairing' => array('type' => array('string', 'null'), 'format' => 'date'),
                            'last_observation' => array('type' => array('string', 'null'), 'format' => 'date'),
                            'last_observation_label' => array('type' => 'string'),
                            'last_prey' => array('type' => 'string'),
                            'archived' => array('type' => 'boolean'),
                        ),
                    ),
                    'Pagination' => array(
                        'type' => 'object',
                        'properties' => array(
                            'page' => array('type' => 'integer'),
                            'per_page' => array('type' => 'integer'),
                            'total' => array('type' => 'integer'),
                            'total_pages' => array('type' => 'integer'),
                            'has_more' => array('type' => 'boolean'),
                        ),
                    ),
                    'RecordResult' => array(
                        'type' => 'object',
                        'properties' => array(
                            'success' => array('type' => 'boolean'),
                            'duplicate' => array('type' => 'boolean'),
                            'request_id' => array('type' => 'string'),
                            'record' => array('type' => 'object'),
                            'spider' => array('$ref' => '#/components/schemas/Spider'),
                        ),
                    ),
                    'Error' => array(
                        'type' => 'object',
                        'properties' => array(
                            'code' => array('type' => 'string'),
                            'message' => array('type' => 'string'),
                            'data' => array('type' => 'object'),
                        ),
                    ),
                ),
                'responses' => array(
                    'BadRequest' => $this->openapi_error_response('入力内容が正しくない。'),
                    'Unauthorized' => $this->openapi_error_response('トークンが無効。'),
                    'Forbidden' => $this->openapi_error_response('トークンに必要な権限がない。'),
                    'Conflict' => $this->openapi_error_response('アーカイブ中、重複処理中などの競合。'),
                    'RateLimited' => $this->openapi_error_response('リクエスト回数が上限を超えた。'),
                ),
            ),
        );

        $response = new WP_REST_Response($schema, 200);
        $response->header('Cache-Control', 'public, max-age=300');

        return $response;
    }

    private function validate_record_request($request)
    {
        $raw_request_id = $request->get_param('request_id');
        $request_id = is_scalar($raw_request_id) ? trim((string) $raw_request_id) : '';
        if (
            strlen($request_id) < 8
            || strlen($request_id) > 80
            || !preg_match('/^[A-Za-z0-9._:-]+$/', $request_id)
        ) {
            return new WP_Error(
                'setae_external_invalid_request_id',
                'request_idは8〜80文字の半角英数字と . _ : - で指定してください。',
                array('status' => 400)
            );
        }

        $type = sanitize_key($request->get_param('type'));
        if ($type === 'memo' || $type === 'note') {
            $type = 'observation';
        }
        if (!in_array($type, array('feed', 'molt', 'pairing', 'observation', 'growth'), true)) {
            return new WP_Error(
                'setae_external_invalid_record_type',
                'typeはfeed、molt、pairing、observation、growthのいずれかで指定してください。',
                array('status' => 400)
            );
        }

        $date = sanitize_text_field($request->get_param('date'));
        if (!$this->is_valid_record_date($date)) {
            return new WP_Error(
                'setae_external_invalid_date',
                'dateは今日以前の日付をYYYY-MM-DDで指定してください。',
                array('status' => 400)
            );
        }

        $note = sanitize_textarea_field($request->get_param('note') ?: '');
        $label = sanitize_text_field($request->get_param('label') ?: '');
        $prey_type = sanitize_text_field($request->get_param('prey_type') ?: '');

        if (mb_strlen($note) > 2000) {
            return new WP_Error(
                'setae_external_note_too_long',
                'noteは2000文字以内で指定してください。',
                array('status' => 400)
            );
        }
        if (mb_strlen($label) > 120) {
            return new WP_Error(
                'setae_external_label_too_long',
                'labelは120文字以内で指定してください。',
                array('status' => 400)
            );
        }
        if (mb_strlen($prey_type) > 100) {
            return new WP_Error(
                'setae_external_prey_too_long',
                'prey_typeは100文字以内で指定してください。',
                array('status' => 400)
            );
        }

        $data = array();
        if ($note !== '') {
            $data['note'] = $note;
        }

        if ($type === 'feed') {
            if ($prey_type !== '') {
                $data['prey_type'] = $prey_type;
            }
            $data['refused'] = rest_sanitize_boolean($request->get_param('refused'));
        }

        if ($type === 'observation') {
            if ($label === '' && $note === '') {
                return new WP_Error(
                    'setae_external_observation_empty',
                    'observationにはlabelまたはnoteが必要です。',
                    array('status' => 400)
                );
            }
            $data['label'] = $label !== '' ? $label : 'メモ';
        }

        if ($type === 'growth') {
            $raw_size = $request->get_param('size_cm');
            if (!is_numeric($raw_size)) {
                return new WP_Error(
                    'setae_external_size_required',
                    'growthにはsize_cmが必要です。',
                    array('status' => 400)
                );
            }
            $size = (float) $raw_size;
            if ($size < 0.01 || $size > 100) {
                return new WP_Error(
                    'setae_external_invalid_size',
                    'size_cmは0.01〜100の範囲で指定してください。',
                    array('status' => 400)
                );
            }
            $data['size'] = $size;
        }

        return array(
            'request_id' => $request_id,
            'type' => $type,
            'date' => $date,
            'data' => $data,
        );
    }

    private function authenticate_external_request($request, $required_scope)
    {
        $this->external_auth = null;

        if (!$this->is_secure_request()) {
            return new WP_Error(
                'setae_external_https_required',
                '外部APIはHTTPS接続でのみ利用できます。',
                array('status' => 403)
            );
        }

        $invalid_limit = $this->get_invalid_attempt_limit();
        if (is_wp_error($invalid_limit)) {
            return $invalid_limit;
        }

        $raw_token = $this->extract_bearer_token($request);
        if (!$raw_token || strlen($raw_token) > 160) {
            $this->record_invalid_attempt();
            return $this->authentication_error();
        }

        $parts = explode('_', $raw_token);
        if (
            count($parts) !== 5
            || $parts[0] !== 'setae'
            || $parts[1] !== 'v1'
            || !ctype_digit($parts[2])
            || !preg_match('/^[a-f0-9]{24}$/', $parts[3])
            || !preg_match('/^[A-Za-z0-9]{48}$/', $parts[4])
        ) {
            $this->record_invalid_attempt();
            return $this->authentication_error();
        }

        $user_id = absint($parts[2]);
        $token_id = $parts[3];
        $secret = $parts[4];
        $record = get_user_meta($user_id, self::TOKEN_META_KEY, true);

        if (
            !$user_id
            || !is_array($record)
            || empty($record['enabled'])
            || (int) ($record['version'] ?? 0) !== self::TOKEN_VERSION
            || !hash_equals((string) ($record['token_id'] ?? ''), $token_id)
            || empty($record['secret_hash'])
            || !hash_equals(
                (string) $record['secret_hash'],
                $this->hash_token_secret($token_id, $secret)
            )
        ) {
            $this->record_invalid_attempt();
            return $this->authentication_error();
        }

        $scopes = isset($record['scopes']) && is_array($record['scopes'])
            ? array_values(array_map(array($this, 'sanitize_external_scope'), $record['scopes']))
            : $this->get_mode_scopes($record['mode'] ?? 'read');

        if (!in_array($required_scope, $scopes, true)) {
            return new WP_Error(
                'setae_external_scope_forbidden',
                'このトークンには必要な権限がありません。',
                array('status' => 403)
            );
        }

        $limit = $required_scope === 'records:write' ? 30 : 120;
        $rate_limit = $this->consume_rate_limit(
            'token_' . $token_id . '_' . $required_scope,
            $limit,
            60
        );
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $this->external_auth = array(
            'user_id' => $user_id,
            'token_id' => $token_id,
            'mode' => sanitize_key($record['mode'] ?? 'read'),
            'scopes' => $scopes,
        );
        $this->maybe_update_last_used($user_id, $token_id, $record);

        return true;
    }

    private function extract_bearer_token($request)
    {
        $authorization = trim((string) $request->get_header('authorization'));
        if ($authorization === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = trim((string) wp_unslash($_SERVER['HTTP_AUTHORIZATION']));
        }
        if ($authorization === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = trim((string) wp_unslash($_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
        }

        if (!preg_match('/^Bearer\s+([A-Za-z0-9_]+)$/i', $authorization, $matches)) {
            return '';
        }

        return $matches[1];
    }

    private function build_access_status($user_id)
    {
        $record = get_user_meta($user_id, self::TOKEN_META_KEY, true);
        $enabled = is_array($record)
            && !empty($record['enabled'])
            && !empty($record['token_id'])
            && !empty($record['secret_hash'])
            && (int) ($record['version'] ?? 0) === self::TOKEN_VERSION;

        if (!$enabled) {
            return array(
                'enabled' => false,
                'mode' => 'read_write',
                'scopes' => array(),
                'token_hint' => '',
                'created_at' => '',
                'last_used_at' => '',
            );
        }

        $mode = in_array(($record['mode'] ?? ''), array('read', 'read_write'), true)
            ? $record['mode']
            : 'read';
        $token_id = sanitize_text_field($record['token_id']);
        $last4 = sanitize_text_field($record['secret_last4'] ?? '');

        return array(
            'enabled' => true,
            'mode' => $mode,
            'scopes' => $this->get_mode_scopes($mode),
            'token_hint' => 'setae_v1_' . $user_id . '_' . substr($token_id, 0, 6) . '...' . $last4,
            'created_at' => sanitize_text_field($record['created_at'] ?? ''),
            'last_used_at' => sanitize_text_field($record['last_used_at'] ?? ''),
        );
    }

    private function get_mode_scopes($mode)
    {
        $scopes = array('spiders:read');
        if ($mode === 'read_write') {
            $scopes[] = 'records:write';
        }
        return $scopes;
    }

    private function generate_token_id()
    {
        try {
            return bin2hex(random_bytes(12));
        } catch (Exception $error) {
            return substr(str_replace('-', '', wp_generate_uuid4()), 0, 24);
        }
    }

    private function hash_token_secret($token_id, $secret)
    {
        return hash_hmac('sha256', $token_id . ':' . $secret, wp_salt('auth'));
    }

    private function hash_request_id($user_id, $request_id)
    {
        return hash_hmac(
            'sha256',
            (int) $user_id . ':' . $request_id,
            wp_salt('nonce')
        );
    }

    private function build_external_spider($spider_id)
    {
        $post = get_post($spider_id);
        if (!$post || $post->post_type !== 'setae_spider') {
            return null;
        }

        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        $custom_name = get_post_meta($spider_id, '_setae_custom_species_name', true);
        if ($species_id) {
            $species_name = get_the_title($species_id);
        } elseif ($custom_name) {
            $species_name = $custom_name;
        } else {
            $species_name = '種類不明';
        }

        $terms = get_the_terms($spider_id, 'setae_classification');
        $classification = ($terms && !is_wp_error($terms))
            ? sanitize_key($terms[0]->slug)
            : 'tarantula';

        return array(
            'id' => (int) $spider_id,
            'reference' => '#' . (int) $spider_id,
            'name' => $this->normalize_display_text($post->post_title),
            'species_id' => $species_id,
            'species_name' => $this->normalize_display_text($species_name),
            'classification' => $classification,
            'gender' => sanitize_key(get_post_meta($spider_id, '_setae_gender', true) ?: 'unknown'),
            'status' => sanitize_key(get_post_meta($spider_id, '_setae_status', true) ?: 'normal'),
            'last_feed' => $this->date_or_null(get_post_meta($spider_id, '_setae_last_feed_date', true)),
            'last_molt' => $this->date_or_null(get_post_meta($spider_id, '_setae_last_molt_date', true)),
            'last_pairing' => $this->date_or_null(get_post_meta($spider_id, '_setae_last_pairing_date', true)),
            'last_observation' => $this->date_or_null(get_post_meta($spider_id, '_setae_last_observation_date', true)),
            'last_observation_label' => sanitize_text_field(get_post_meta($spider_id, '_setae_last_observation_label', true)),
            'last_prey' => sanitize_text_field(get_post_meta($spider_id, '_setae_last_prey', true)),
            'archived' => get_post_meta($spider_id, '_setae_spider_archived', true) === '1',
            'archived_at' => sanitize_text_field(get_post_meta($spider_id, '_setae_spider_archived_at', true)),
            'created_at' => get_post_time(DATE_ATOM, true, $post),
            'updated_at' => get_post_modified_time(DATE_ATOM, true, $post),
            'version' => $this->build_spider_version($spider_id, $post),
        );
    }

    private function build_spider_version($spider_id, $post = null)
    {
        $post = $post ?: get_post($spider_id);
        if (!$post) {
            return '';
        }

        $snapshot = array(
            'id' => (int) $spider_id,
            'title' => $this->normalize_display_text($post->post_title),
            'modified_gmt' => (string) $post->post_modified_gmt,
            'species_id' => (string) get_post_meta($spider_id, '_setae_species_id', true),
            'species_name' => $this->normalize_display_text(
                get_post_meta($spider_id, '_setae_custom_species_name', true)
            ),
            'gender' => (string) get_post_meta($spider_id, '_setae_gender', true),
            'status' => (string) get_post_meta($spider_id, '_setae_status', true),
            'archived' => (string) get_post_meta($spider_id, '_setae_spider_archived', true),
        );

        return substr(hash('sha256', wp_json_encode($snapshot)), 0, 24);
    }

    private function build_external_log($log_id)
    {
        $raw_data = get_post_meta($log_id, '_setae_log_data', true);
        $data = is_string($raw_data) ? json_decode($raw_data, true) : $raw_data;

        return array(
            'id' => (int) $log_id,
            'spider_id' => absint(get_post_meta($log_id, '_setae_log_spider_id', true)),
            'type' => sanitize_key(get_post_meta($log_id, '_setae_log_type', true)),
            'date' => sanitize_text_field(get_post_meta($log_id, '_setae_log_date', true)),
            'data' => is_array($data) ? $data : array(),
            'created_at' => get_post_time(DATE_ATOM, true, $log_id),
        );
    }

    private function spider_matches_query($spider, $query_text)
    {
        $haystack = $this->lowercase(
            implode(' ', array(
                (string) $spider['id'],
                $spider['reference'],
                $spider['name'],
                $spider['species_name'],
                $spider['classification'],
                $spider['status'],
            ))
        );
        $tokens = preg_split('/\s+/u', $this->lowercase(trim($query_text)));

        foreach ($tokens as $token) {
            if ($token !== '' && strpos($haystack, $token) === false) {
                return false;
            }
        }

        return true;
    }

    private function get_archive_meta_query($scope)
    {
        if ($scope === 'all') {
            return array();
        }
        if ($scope === 'archived') {
            return array(
                array(
                    'key' => '_setae_spider_archived',
                    'value' => '1',
                    'compare' => '=',
                ),
            );
        }

        return array(
            'relation' => 'OR',
            array(
                'key' => '_setae_spider_archived',
                'compare' => 'NOT EXISTS',
            ),
            array(
                'key' => '_setae_spider_archived',
                'value' => '1',
                'compare' => '!=',
            ),
        );
    }

    private function find_existing_request_log($user_id, $request_key)
    {
        $logs = get_posts(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'author' => (int) $user_id,
            'posts_per_page' => 1,
            'fields' => 'ids',
            'no_found_rows' => true,
            'meta_query' => array(
                array(
                    'key' => self::REQUEST_META_KEY,
                    'value' => $request_key,
                    'compare' => '=',
                ),
            ),
        ));

        return !empty($logs) ? absint($logs[0]) : 0;
    }

    private function duplicate_record_response($log_id, $spider_id, $request_id)
    {
        $record_spider_id = absint(get_post_meta($log_id, '_setae_log_spider_id', true));
        if ($record_spider_id !== (int) $spider_id) {
            return new WP_Error(
                'setae_external_request_id_conflict',
                'このrequest_idは別の個体の操作で使用済みです。新しいrequest_idを指定してください。',
                array('status' => 409)
            );
        }

        return $this->private_response(array(
            'success' => true,
            'duplicate' => true,
            'request_id' => $request_id,
            'record' => $this->build_external_log($log_id),
            'spider' => $this->build_external_spider($spider_id),
        ));
    }

    private function acquire_request_lock($lock_name)
    {
        $now = time();
        if (add_option($lock_name, (string) $now, '', false)) {
            return true;
        }

        $locked_at = (int) get_option($lock_name, 0);
        if ($locked_at && $locked_at < $now - 60) {
            delete_option($lock_name);
            return add_option($lock_name, (string) $now, '', false);
        }

        return false;
    }

    private function is_valid_record_date($date)
    {
        if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }

        $timezone = function_exists('wp_timezone') ? wp_timezone() : new DateTimeZone('Asia/Tokyo');
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        if (!$parsed || $parsed->format('Y-m-d') !== $date) {
            return false;
        }

        $today = new DateTimeImmutable('today', $timezone);
        $minimum = new DateTimeImmutable('1900-01-01', $timezone);

        return $parsed >= $minimum && $parsed <= $today;
    }

    private function date_or_null($value)
    {
        $value = sanitize_text_field($value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    private function normalize_display_text($value)
    {
        $text = is_scalar($value) ? (string) $value : '';
        for ($pass = 0; $pass < 2; $pass++) {
            $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($decoded === $text) {
                break;
            }
            $text = $decoded;
        }

        return wp_strip_all_tags($text);
    }

    private function lowercase($value)
    {
        return function_exists('mb_strtolower')
            ? mb_strtolower((string) $value, 'UTF-8')
            : strtolower((string) $value);
    }

    private function sanitize_external_scope($scope)
    {
        return preg_replace('/[^a-z0-9:_-]/', '', strtolower((string) $scope));
    }

    private function maybe_update_last_used($user_id, $token_id, $record)
    {
        $last_used_at = !empty($record['last_used_at'])
            ? strtotime($record['last_used_at'])
            : 0;
        if ($last_used_at && $last_used_at > time() - 300) {
            return;
        }

        $fresh = get_user_meta($user_id, self::TOKEN_META_KEY, true);
        if (
            !is_array($fresh)
            || !hash_equals((string) ($fresh['token_id'] ?? ''), (string) $token_id)
        ) {
            return;
        }

        $fresh['last_used_at'] = gmdate('c');
        update_user_meta($user_id, self::TOKEN_META_KEY, $fresh);
    }

    private function is_secure_request()
    {
        if (is_ssl()) {
            return true;
        }

        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host);
        $is_local = in_array($host, array('localhost', '127.0.0.1', '::1'), true);

        return $is_local && defined('WP_DEBUG') && WP_DEBUG;
    }

    private function authentication_error()
    {
        return new WP_Error(
            'setae_external_authentication_failed',
            '認証できません。アクセストークンを確認してください。',
            array('status' => 401)
        );
    }

    private function get_invalid_attempt_limit()
    {
        $key = $this->invalid_attempt_key();
        $state = get_transient($key);
        if (!is_array($state) || empty($state['reset_at']) || (int) $state['reset_at'] <= time()) {
            return true;
        }

        if ((int) ($state['count'] ?? 0) < 20) {
            return true;
        }

        return new WP_Error(
            'setae_external_rate_limited',
            '認証試行回数が上限を超えました。しばらく待って再試行してください。',
            array(
                'status' => 429,
                'retry_after' => max(1, (int) $state['reset_at'] - time()),
            )
        );
    }

    private function record_invalid_attempt()
    {
        $key = $this->invalid_attempt_key();
        $now = time();
        $state = get_transient($key);

        if (!is_array($state) || empty($state['reset_at']) || (int) $state['reset_at'] <= $now) {
            $state = array(
                'count' => 0,
                'reset_at' => $now + 300,
            );
        }

        $state['count'] = (int) $state['count'] + 1;
        set_transient($key, $state, max(1, (int) $state['reset_at'] - $now));
    }

    private function invalid_attempt_key()
    {
        $ip = isset($_SERVER['REMOTE_ADDR'])
            ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
            : 'unknown';
        $hash = hash_hmac('sha256', $ip, wp_salt('nonce'));

        return 'setae_ext_bad_' . substr($hash, 0, 32);
    }

    private function consume_rate_limit($bucket, $limit, $window)
    {
        $now = time();
        $hash = hash_hmac('sha256', (string) $bucket, wp_salt('nonce'));
        $key = 'setae_ext_rl_' . substr($hash, 0, 32);
        $state = get_transient($key);

        if (!is_array($state) || empty($state['reset_at']) || (int) $state['reset_at'] <= $now) {
            $state = array(
                'count' => 0,
                'reset_at' => $now + (int) $window,
            );
        }

        if ((int) $state['count'] >= (int) $limit) {
            return new WP_Error(
                'setae_external_rate_limited',
                'リクエスト回数が上限を超えました。少し待って再試行してください。',
                array(
                    'status' => 429,
                    'retry_after' => max(1, (int) $state['reset_at'] - $now),
                )
            );
        }

        $state['count'] = (int) $state['count'] + 1;
        set_transient($key, $state, max(1, (int) $state['reset_at'] - $now));

        return true;
    }

    private function get_voice_operation_prompt()
    {
        return implode("\n", array(
            'あなたはSETAEの飼育記録アシスタントです。登録済みのSETAE Actionだけを使い、音声で伝えられた飼育内容を正確に検索・記録してください。',
            '',
            '【基本ルール】',
            '- 日付はAsia/Tokyoとして解釈し、APIにはYYYY-MM-DDで渡す。',
            '- ユーザーが記録を指示していない内容を推測して保存しない。',
            '- 書き込み前にlistSetaeSpidersで対象を検索し、返された個体IDを使う。',
            '- 名前が同じ個体や候補が複数ある場合は、種類名と個体IDを示してユーザーに確認する。曖昧なまま保存しない。',
            '- 候補が1匹に特定でき、日付・記録種別・内容が明確なら、余分な確認を挟まず記録する。',
            '- 複数個体への指示は個体ごとに別のrequest_idで記録する。3匹以上を一度に変更する場合は、対象名を復唱して実行前に確認する。',
            '- APIが2xxを返す前に「保存しました」と言わない。失敗時は保存できなかった理由を短く伝える。',
            '- request_idは操作ごとに一意な半角英数字で作る。同じ操作の通信再試行では必ず同じrequest_idを再利用し、別の操作では新しくする。',
            '- アクセストークン、Authorizationヘッダー、内部レスポンスの秘密情報を会話に表示しない。',
            '',
            '【記録種別】',
            '- 給餌・餌やり: type=feed。食べなかった、拒食の場合はrefused=true。',
            '- 脱皮: type=molt。',
            '- ペアリング・交接: type=pairing。',
            '- 観察・メモ: type=observation。短い見出しをlabel、詳細をnoteにする。',
            '- サイズ・体長: type=growth。cmに換算してsize_cmに入れる。',
            '',
            '【応答】',
            '- 保存後は「個体名・日付・記録内容」を一文で復唱する。',
            '- duplicate=trueは同じ操作がすでに保存済みなので、重ねて追加せず「保存済み」と伝える。',
            '- 403で書き込み権限がない場合は、SETAEの外部連携を「一覧＋記録」に再設定するよう案内する。',
        ));
    }

    private function openapi_error_response($description)
    {
        return array(
            'description' => $description,
            'content' => array(
                'application/json' => array(
                    'schema' => array('$ref' => '#/components/schemas/Error'),
                ),
            ),
        );
    }

    private function private_response($data, $status = 200)
    {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('Pragma', 'no-cache');

        return $response;
    }
}
