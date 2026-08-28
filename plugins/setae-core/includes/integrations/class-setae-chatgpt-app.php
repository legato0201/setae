<?php

/**
 * ChatGPT App integration for SETAE.
 *
 * Exposes a stateless MCP endpoint and an OAuth 2.1 authorization-code flow
 * with PKCE. Access and refresh tokens are opaque, hashed at rest, and bound
 * to the SETAE user, ChatGPT client, scopes, and MCP resource.
 */
class Setae_ChatGPT_App
{
    const CONNECTION_META_KEY = '_setae_chatgpt_connections_v1';
    const AUTH_CODE_PREFIX = 'setae_chatgpt_code_';
    const REWRITE_VERSION_OPTION = 'setae_chatgpt_rewrite_version';
    const REWRITE_VERSION = '1';
    const PROTOCOL_VERSION = '2025-06-18';
    const ACCESS_TOKEN_TTL = 3600;
    const REFRESH_TOKEN_TTL = 2592000;
    const MAX_CONNECTIONS = 5;

    private $external_access_controller;

    public function __construct()
    {
        add_action('parse_request', array($this, 'maybe_serve_well_known'), 0);
        add_action('init', array($this, 'register_rewrite_rule'));
        add_action('init', array($this, 'maybe_flush_rewrite_rules'), 30);
        add_filter('query_vars', array($this, 'register_query_vars'));
        add_action('template_redirect', array($this, 'maybe_render_authorization_page'), 0);
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    public function register_rewrite_rule()
    {
        add_rewrite_rule(
            '^chatgpt/oauth/authorize/?$',
            'index.php?setae_chatgpt_oauth=authorize',
            'top'
        );
    }

    public function maybe_flush_rewrite_rules()
    {
        if (get_option(self::REWRITE_VERSION_OPTION) === self::REWRITE_VERSION) {
            return;
        }

        flush_rewrite_rules(false);
        update_option(self::REWRITE_VERSION_OPTION, self::REWRITE_VERSION, false);
    }

    public function register_query_vars($vars)
    {
        $vars[] = 'setae_chatgpt_oauth';
        return $vars;
    }

    public function register_rest_routes()
    {
        register_rest_route('setae/v1', '/chatgpt/mcp', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'handle_mcp_request'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/chatgpt/oauth-protected-resource', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_protected_resource_metadata'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/chatgpt/oauth-authorization-server', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_authorization_server_metadata'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/chatgpt/oauth/token', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'handle_token_request'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/chatgpt/oauth/revoke', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'handle_revoke_request'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/chatgpt/access', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_user_connection_status'),
            'permission_callback' => array($this, 'management_permissions_check'),
        ));

        register_rest_route('setae/v1', '/chatgpt/access/disable', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'disable_user_connections'),
            'permission_callback' => array($this, 'management_permissions_check'),
        ));
    }

    public function maybe_serve_well_known($wp)
    {
        $path = $this->get_relative_request_path();
        if ($path === '.well-known/oauth-authorization-server') {
            $this->send_json_document($this->build_authorization_server_metadata());
        }

        if ($path === '.well-known/oauth-protected-resource') {
            $this->send_json_document($this->build_protected_resource_metadata());
        }
    }

    public function get_protected_resource_metadata()
    {
        return $this->no_store_response($this->build_protected_resource_metadata());
    }

    public function get_authorization_server_metadata()
    {
        $response = new WP_REST_Response($this->build_authorization_server_metadata(), 200);
        $response->header('Cache-Control', 'public, max-age=300');
        return $response;
    }

    public function management_permissions_check()
    {
        if (!is_user_logged_in() || !current_user_can('read')) {
            return new WP_Error(
                'setae_chatgpt_login_required',
                'ログインが必要です。',
                array('status' => 401)
            );
        }

        if (!$this->is_secure_request()) {
            return new WP_Error(
                'setae_chatgpt_https_required',
                'ChatGPT連携の管理にはHTTPS接続が必要です。',
                array('status' => 403)
            );
        }

        return true;
    }

    public function get_user_connection_status()
    {
        $user_id = get_current_user_id();
        $connections = $this->get_connections($user_id);
        $status = $this->build_connection_status($connections);

        return $this->no_store_response(array(
            'success' => true,
            'access' => $status,
            'app_url' => esc_url_raw(get_option('setae_chatgpt_app_url', '')),
            'mcp_url' => esc_url_raw($this->get_resource_url()),
            'prompt' => $this->get_operation_prompt(),
            'availability' => array(
                'regular_chat' => true,
                'free_plan_targeted' => true,
                'openai_availability_dependent' => true,
                'dictation' => true,
                'live_voice_mode' => false,
            ),
        ));
    }

    public function disable_user_connections()
    {
        $user_id = get_current_user_id();
        $rate_limit = $this->consume_rate_limit('disconnect_' . $user_id, 10, 300);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $lock = $this->acquire_connection_lock($user_id);
        if (is_wp_error($lock)) {
            return $lock;
        }

        try {
            delete_user_meta($user_id, self::CONNECTION_META_KEY);
        } finally {
            $this->release_connection_lock($lock);
        }

        return $this->no_store_response(array(
            'success' => true,
            'access' => $this->build_connection_status(array()),
            'app_url' => esc_url_raw(get_option('setae_chatgpt_app_url', '')),
            'mcp_url' => esc_url_raw($this->get_resource_url()),
            'prompt' => $this->get_operation_prompt(),
            'availability' => array(
                'regular_chat' => true,
                'free_plan_targeted' => true,
                'openai_availability_dependent' => true,
                'dictation' => true,
                'live_voice_mode' => false,
            ),
            'message' => 'ChatGPTからのアクセスを停止しました。',
        ));
    }

    public function maybe_render_authorization_page()
    {
        if (get_query_var('setae_chatgpt_oauth') !== 'authorize') {
            return;
        }

        if (!$this->is_secure_request()) {
            $this->render_oauth_error_page(
                '安全な接続を確認できません',
                'ChatGPTとの連携はHTTPS接続でのみ利用できます。',
                403
            );
        }

        $rate_limit = $this->consume_rate_limit(
            'oauth_authorize_' . $this->get_request_ip_hash(),
            30,
            300
        );
        if (is_wp_error($rate_limit)) {
            $this->render_oauth_error_page(
                '接続リクエストが集中しています',
                '少し待ってからChatGPTとの接続をやり直してください。',
                429
            );
        }

        $params = $this->get_authorization_params();
        $validated = $this->validate_authorization_request($params);
        if (is_wp_error($validated)) {
            $error_data = $validated->get_error_data();
            $this->render_oauth_error_page(
                '連携リクエストを確認できません',
                $validated->get_error_message(),
                is_array($error_data) ? (int) ($error_data['status'] ?? 400) : 400
            );
        }

        if (!is_user_logged_in()) {
            wp_safe_redirect(wp_login_url($this->current_authorization_url()));
            exit;
        }

        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
            $nonce = isset($_POST['_setae_chatgpt_nonce'])
                ? sanitize_text_field(wp_unslash($_POST['_setae_chatgpt_nonce']))
                : '';
            if (!wp_verify_nonce($nonce, 'setae_chatgpt_oauth_consent')) {
                $this->render_oauth_error_page(
                    '確認画面の有効期限が切れました',
                    'ChatGPTからもう一度接続を開始してください。',
                    403
                );
            }

            $decision = isset($_POST['decision'])
                ? sanitize_key(wp_unslash($_POST['decision']))
                : 'deny';
            if ($decision !== 'approve') {
                $this->redirect_oauth_result(
                    $validated['redirect_uri'],
                    array(
                        'error' => 'access_denied',
                        'error_description' => 'The user denied the SETAE connection.',
                        'state' => $validated['state'],
                    )
                );
            }

            $code = $this->issue_authorization_code(get_current_user_id(), $validated);
            if (is_wp_error($code)) {
                $this->render_oauth_error_page(
                    '連携を開始できませんでした',
                    $code->get_error_message(),
                    500
                );
            }

            $this->redirect_oauth_result(
                $validated['redirect_uri'],
                array(
                    'code' => $code,
                    'state' => $validated['state'],
                )
            );
        }

        $this->render_authorization_consent($validated);
    }

    public function handle_token_request($request)
    {
        if (!$this->is_secure_request()) {
            return $this->oauth_error('invalid_request', 'HTTPS is required.', 400);
        }

        $rate_limit = $this->consume_rate_limit(
            'oauth_token_' . $this->get_request_ip_hash(),
            40,
            300
        );
        if (is_wp_error($rate_limit)) {
            return $this->oauth_error('slow_down', 'Too many token requests.', 429);
        }

        $grant_type = sanitize_text_field($request->get_param('grant_type'));
        if ($grant_type === 'authorization_code') {
            return $this->exchange_authorization_code($request);
        }
        if ($grant_type === 'refresh_token') {
            return $this->exchange_refresh_token($request);
        }

        return $this->oauth_error(
            'unsupported_grant_type',
            'Only authorization_code and refresh_token are supported.',
            400
        );
    }

    public function handle_revoke_request($request)
    {
        if (!$this->is_secure_request()) {
            return $this->oauth_error('invalid_request', 'HTTPS is required.', 400);
        }

        $rate_limit = $this->consume_rate_limit(
            'oauth_revoke_' . $this->get_request_ip_hash(),
            40,
            300
        );
        if (is_wp_error($rate_limit)) {
            return $this->oauth_error('slow_down', 'Too many revocation requests.', 429);
        }

        $token = trim((string) $request->get_param('token'));
        $client_id = trim((string) $request->get_param('client_id'));
        if ($token === '' || $client_id === '') {
            return $this->no_store_response(array(), 200);
        }

        $parsed = $this->parse_connection_token($token);
        if (!is_wp_error($parsed)) {
            $lock = $this->acquire_connection_lock($parsed['user_id']);
            if (is_wp_error($lock)) {
                return $this->oauth_error(
                    'temporarily_unavailable',
                    'Unable to revoke the connection right now.',
                    503
                );
            }

            try {
                $connections = $this->get_connections($parsed['user_id']);
                if (
                    isset($connections[$parsed['connection_id']])
                    && hash_equals(
                        (string) $connections[$parsed['connection_id']]['client_id'],
                        $client_id
                    )
                ) {
                    unset($connections[$parsed['connection_id']]);
                    $this->save_connections($parsed['user_id'], $connections);
                }
            } finally {
                $this->release_connection_lock($lock);
            }
        }

        return $this->no_store_response(array(), 200);
    }

    public function handle_mcp_request($request)
    {
        $rate_limit = $this->consume_rate_limit(
            'mcp_ip_' . $this->get_request_ip_hash(),
            240,
            60
        );
        if (is_wp_error($rate_limit)) {
            return $this->jsonrpc_error(null, -32029, 'Too many requests.', 429);
        }

        $payload = $request->get_json_params();
        if (!is_array($payload) || isset($payload[0])) {
            return $this->jsonrpc_error(null, -32600, 'Invalid Request.', 400);
        }

        $id = array_key_exists('id', $payload) ? $payload['id'] : null;
        $method = isset($payload['method']) ? (string) $payload['method'] : '';
        $params = isset($payload['params']) && is_array($payload['params'])
            ? $payload['params']
            : array();

        if (($payload['jsonrpc'] ?? '') !== '2.0' || $method === '') {
            return $this->jsonrpc_error($id, -32600, 'Invalid Request.', 400);
        }

        if ($method === 'initialize') {
            return $this->jsonrpc_result($id, array(
                'protocolVersion' => self::PROTOCOL_VERSION,
                'capabilities' => array(
                    'tools' => array('listChanged' => false),
                ),
                'serverInfo' => array(
                    'name' => 'SETAE',
                    'title' => 'SETAE 飼育管理',
                    'version' => defined('SETAE_VERSION') ? SETAE_VERSION : '1.0.0',
                ),
                'instructions' => $this->get_server_instructions(),
            ));
        }

        if ($method === 'notifications/initialized' || $method === 'notifications/cancelled') {
            return new WP_REST_Response(null, 202);
        }

        if ($method === 'ping') {
            return $this->jsonrpc_result($id, (object) array());
        }

        if ($method === 'tools/list') {
            return $this->jsonrpc_result($id, array(
                'tools' => $this->get_tool_definitions(),
            ));
        }

        if ($method === 'tools/call') {
            return $this->handle_tool_call($id, $params, $request);
        }

        return $this->jsonrpc_error($id, -32601, 'Method not found.', 404);
    }

    private function handle_tool_call($id, $params, $request)
    {
        $name = isset($params['name']) ? sanitize_key($params['name']) : '';
        $arguments = isset($params['arguments']) && is_array($params['arguments'])
            ? $params['arguments']
            : array();
        $scope_map = array(
            'list_animals' => array('animals:read'),
            'get_animal' => array('animals:read'),
            'add_care_record' => array('animals:read', 'records:write'),
            'update_animal' => array('animals:read', 'animals:write'),
        );

        if (!isset($scope_map[$name])) {
            return $this->jsonrpc_error($id, -32602, 'Unknown tool.', 400);
        }

        $auth = $this->authenticate_mcp_request($request, $scope_map[$name]);
        if (is_wp_error($auth)) {
            if ($auth->get_error_code() === 'rate_limited') {
                return $this->jsonrpc_result(
                    $id,
                    $this->tool_error('操作が集中しています。少し待ってから再試行してください。', 'rate_limited')
                );
            }
            return $this->jsonrpc_result(
                $id,
                $this->build_mcp_authentication_error(
                    implode(' ', $scope_map[$name]),
                    $auth
                )
            );
        }

        $controller = $this->get_external_access_controller();
        if (!$controller) {
            return $this->jsonrpc_result(
                $id,
                $this->tool_error('SETAEの飼育管理を読み込めませんでした。')
            );
        }

        if ($name === 'list_animals') {
            $result = $controller->list_spiders_for_user($auth['user_id'], $arguments);
        } elseif ($name === 'get_animal') {
            $result = $controller->get_spider_for_user(
                $auth['user_id'],
                absint($arguments['id'] ?? 0),
                min(50, max(1, absint($arguments['history_limit'] ?? 20)))
            );
        } elseif ($name === 'add_care_record') {
            $spider_id = absint($arguments['id'] ?? 0);
            unset($arguments['id']);
            $result = $controller->add_record_for_user(
                $auth['user_id'],
                $spider_id,
                $arguments,
                'chatgpt_app'
            );
        } else {
            $spider_id = absint($arguments['id'] ?? 0);
            unset($arguments['id']);
            $result = $controller->update_spider_for_user(
                $auth['user_id'],
                $spider_id,
                $arguments,
                'chatgpt_app'
            );
        }

        if (is_wp_error($result)) {
            return $this->jsonrpc_result(
                $id,
                $this->tool_error($result->get_error_message(), $result->get_error_code())
            );
        }

        if ($result instanceof WP_REST_Response) {
            $result = $result->get_data();
        }

        return $this->jsonrpc_result($id, $this->tool_success($name, $result));
    }

    private function get_tool_definitions()
    {
        $read_security = array(
            array('type' => 'oauth2', 'scopes' => array('animals:read')),
        );
        $record_security = array(
            array('type' => 'oauth2', 'scopes' => array('animals:read', 'records:write')),
        );
        $edit_security = array(
            array('type' => 'oauth2', 'scopes' => array('animals:read', 'animals:write')),
        );

        return array(
            array(
                'name' => 'list_animals',
                'title' => '飼育個体を検索',
                'description' => 'Use this when the user wants to see or identify animals in their own SETAE account. Search before any write when the target is named rather than identified by an exact SETAE ID.',
                'inputSchema' => array(
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => array(
                        'q' => array(
                            'type' => 'string',
                            'maxLength' => 100,
                            'description' => '個体名、種類名、または #123 のようなSETAE ID。',
                        ),
                        'scope' => array(
                            'type' => 'string',
                            'enum' => array('active', 'archived', 'all'),
                            'default' => 'active',
                        ),
                        'classification' => array(
                            'type' => 'string',
                            'maxLength' => 50,
                            'description' => '分類スラッグ。例: tarantula。',
                        ),
                        'status' => array(
                            'type' => 'string',
                            'enum' => array('normal', 'fasting', 'pre_molt', 'post_molt'),
                        ),
                        'page' => array('type' => 'integer', 'minimum' => 1, 'default' => 1),
                        'per_page' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'maximum' => 50,
                            'default' => 30,
                        ),
                    ),
                ),
                'outputSchema' => array(
                    'type' => 'object',
                    'required' => array('success', 'items', 'pagination'),
                    'properties' => array(
                        'success' => array('type' => 'boolean'),
                        'items' => array('type' => 'array', 'items' => array('type' => 'object')),
                        'pagination' => array('type' => 'object'),
                        'filters' => array('type' => 'object'),
                    ),
                ),
                'securitySchemes' => $read_security,
                'annotations' => array(
                    'readOnlyHint' => true,
                    'openWorldHint' => false,
                    'destructiveHint' => false,
                ),
                '_meta' => array(
                    'securitySchemes' => $read_security,
                    'openai/toolInvocation/invoking' => '飼育一覧を確認しています',
                    'openai/toolInvocation/invoked' => '飼育一覧を確認しました',
                ),
            ),
            array(
                'name' => 'get_animal',
                'title' => '個体の詳細を取得',
                'description' => 'Use this when the user asks about one exact SETAE animal or before editing it. Returns current details, a concurrency version, and recent care records.',
                'inputSchema' => array(
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => array('id'),
                    'properties' => array(
                        'id' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'description' => 'list_animalsで確認したSETAE個体ID。',
                        ),
                        'history_limit' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'maximum' => 50,
                            'default' => 20,
                        ),
                    ),
                ),
                'outputSchema' => array(
                    'type' => 'object',
                    'required' => array('success', 'animal', 'records'),
                    'properties' => array(
                        'success' => array('type' => 'boolean'),
                        'animal' => array('type' => 'object'),
                        'records' => array('type' => 'array', 'items' => array('type' => 'object')),
                    ),
                ),
                'securitySchemes' => $read_security,
                'annotations' => array(
                    'readOnlyHint' => true,
                    'openWorldHint' => false,
                    'destructiveHint' => false,
                ),
                '_meta' => array(
                    'securitySchemes' => $read_security,
                    'openai/toolInvocation/invoking' => '個体のカルテを確認しています',
                    'openai/toolInvocation/invoked' => '個体のカルテを確認しました',
                ),
            ),
            array(
                'name' => 'add_care_record',
                'title' => '飼育記録を追加',
                'description' => 'Use this only when the user explicitly asks to save a feeding, molt, pairing, observation, or growth record for one exact SETAE animal. Never infer missing dates or targets.',
                'inputSchema' => array(
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => array('id', 'request_id', 'type', 'date'),
                    'properties' => array(
                        'id' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'description' => 'list_animalsで一意に特定したSETAE個体ID。',
                        ),
                        'request_id' => array(
                            'type' => 'string',
                            'minLength' => 8,
                            'maxLength' => 80,
                            'pattern' => '^[A-Za-z0-9._:-]+$',
                            'description' => '操作ごとの一意なID。通信再試行では同じ値を再利用する。',
                        ),
                        'type' => array(
                            'type' => 'string',
                            'enum' => array('feed', 'molt', 'pairing', 'observation', 'growth'),
                        ),
                        'date' => array(
                            'type' => 'string',
                            'format' => 'date',
                            'description' => 'Asia/TokyoのYYYY-MM-DD。未来日は不可。',
                        ),
                        'prey_type' => array('type' => 'string', 'maxLength' => 100),
                        'refused' => array('type' => 'boolean', 'default' => false),
                        'size_cm' => array('type' => 'number', 'minimum' => 0.01, 'maximum' => 100),
                        'label' => array('type' => 'string', 'maxLength' => 120),
                        'note' => array('type' => 'string', 'maxLength' => 2000),
                    ),
                ),
                'outputSchema' => array(
                    'type' => 'object',
                    'required' => array('success', 'duplicate', 'request_id', 'record', 'spider'),
                    'properties' => array(
                        'success' => array('type' => 'boolean'),
                        'duplicate' => array('type' => 'boolean'),
                        'request_id' => array('type' => 'string'),
                        'record' => array('type' => 'object'),
                        'spider' => array('type' => 'object'),
                    ),
                ),
                'securitySchemes' => $record_security,
                'annotations' => array(
                    'readOnlyHint' => false,
                    'openWorldHint' => false,
                    'destructiveHint' => false,
                ),
                '_meta' => array(
                    'securitySchemes' => $record_security,
                    'openai/toolInvocation/invoking' => '飼育記録を保存しています',
                    'openai/toolInvocation/invoked' => '飼育記録を保存しました',
                ),
            ),
            array(
                'name' => 'update_animal',
                'title' => '個体の基本情報を更新',
                'description' => 'Use this only when the user explicitly asks to edit an exact SETAE animal. Call get_animal first and pass its current version as expected_version. Only provided fields are changed.',
                'inputSchema' => array(
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => array('id', 'expected_version'),
                    'properties' => array(
                        'id' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'description' => 'get_animalで確認したSETAE個体ID。',
                        ),
                        'expected_version' => array(
                            'type' => 'string',
                            'minLength' => 16,
                            'maxLength' => 64,
                            'description' => 'get_animalが返した現在のversion。古い情報の上書きを防ぐ。',
                        ),
                        'name' => array('type' => 'string', 'minLength' => 1, 'maxLength' => 100),
                        'gender' => array(
                            'type' => 'string',
                            'enum' => array('unknown', 'female', 'male'),
                        ),
                        'status' => array(
                            'type' => 'string',
                            'enum' => array('normal', 'fasting', 'pre_molt', 'post_molt'),
                        ),
                        'species_id' => array(
                            'type' => 'integer',
                            'minimum' => 1,
                            'description' => 'SETAE図鑑の種類ID。species_nameと同時指定しない。',
                        ),
                        'species_name' => array(
                            'type' => 'string',
                            'minLength' => 1,
                            'maxLength' => 160,
                            'description' => '図鑑外の自由入力種類名。species_idと同時指定しない。',
                        ),
                        'archived' => array(
                            'type' => 'boolean',
                            'description' => '管理一覧からアーカイブする場合true。',
                        ),
                    ),
                ),
                'outputSchema' => array(
                    'type' => 'object',
                    'required' => array('success', 'changed_fields', 'animal'),
                    'properties' => array(
                        'success' => array('type' => 'boolean'),
                        'changed_fields' => array(
                            'type' => 'array',
                            'items' => array('type' => 'string'),
                        ),
                        'animal' => array('type' => 'object'),
                    ),
                ),
                'securitySchemes' => $edit_security,
                'annotations' => array(
                    'readOnlyHint' => false,
                    'openWorldHint' => false,
                    'destructiveHint' => false,
                ),
                '_meta' => array(
                    'securitySchemes' => $edit_security,
                    'openai/toolInvocation/invoking' => '個体情報を更新しています',
                    'openai/toolInvocation/invoked' => '個体情報を更新しました',
                ),
            ),
        );
    }

    private function exchange_authorization_code($request)
    {
        $code = trim((string) $request->get_param('code'));
        $client_id = trim((string) $request->get_param('client_id'));
        $redirect_uri = esc_url_raw($request->get_param('redirect_uri'));
        $code_verifier = trim((string) $request->get_param('code_verifier'));
        $resource = esc_url_raw($request->get_param('resource'));

        if (
            $code === ''
            || $client_id === ''
            || $redirect_uri === ''
            || $code_verifier === ''
            || $resource === ''
        ) {
            return $this->oauth_error(
                'invalid_request',
                'code, client_id, redirect_uri, code_verifier, and resource are required.',
                400
            );
        }

        $key = $this->authorization_code_key($code);
        $record = get_transient($key);
        if (!is_array($record)) {
            return $this->oauth_error('invalid_grant', 'The authorization code is invalid or expired.', 400);
        }

        if (
            !hash_equals((string) $record['client_id'], $client_id)
            || !hash_equals((string) $record['redirect_uri'], $redirect_uri)
            || !hash_equals((string) $record['resource'], $resource)
            || !hash_equals($this->get_resource_url(), $resource)
        ) {
            return $this->oauth_error('invalid_grant', 'Authorization request binding mismatch.', 400);
        }

        if (
            !preg_match('/^[A-Za-z0-9._~-]{43,128}$/', $code_verifier)
            || !hash_equals(
                (string) $record['code_challenge'],
                $this->base64url_encode(hash('sha256', $code_verifier, true))
            )
        ) {
            return $this->oauth_error('invalid_grant', 'PKCE verification failed.', 400);
        }

        delete_transient($key);

        $tokens = $this->issue_connection_tokens(
            absint($record['user_id']),
            $client_id,
            $resource,
            (array) $record['scopes']
        );
        if (is_wp_error($tokens)) {
            return $this->oauth_error('server_error', 'Unable to create the connection.', 500);
        }

        return $this->no_store_response($tokens, 200);
    }

    private function exchange_refresh_token($request)
    {
        $refresh_token = trim((string) $request->get_param('refresh_token'));
        $client_id = trim((string) $request->get_param('client_id'));
        $resource = esc_url_raw($request->get_param('resource'));
        if ($refresh_token === '' || $client_id === '' || $resource === '') {
            return $this->oauth_error(
                'invalid_request',
                'refresh_token, client_id, and resource are required.',
                400
            );
        }

        $parsed = $this->parse_connection_token($refresh_token, 'refresh');
        if (is_wp_error($parsed)) {
            return $this->oauth_error('invalid_grant', 'The refresh token is invalid.', 400);
        }

        $lock = $this->acquire_connection_lock($parsed['user_id']);
        if (is_wp_error($lock)) {
            return $this->oauth_error(
                'temporarily_unavailable',
                'Unable to refresh the connection right now.',
                503
            );
        }

        try {
            $connections = $this->get_connections($parsed['user_id']);
            $record = $connections[$parsed['connection_id']] ?? null;
            if (
                !is_array($record)
                || !hash_equals((string) $record['client_id'], $client_id)
                || !hash_equals((string) $record['resource'], $resource)
                || !hash_equals($this->get_resource_url(), $resource)
                || (int) ($record['refresh_expires_at'] ?? 0) <= time()
                || !hash_equals(
                    (string) ($record['refresh_hash'] ?? ''),
                    $this->hash_token_secret(
                        'refresh',
                        $parsed['connection_id'],
                        $parsed['secret']
                    )
                )
            ) {
                return $this->oauth_error(
                    'invalid_grant',
                    'The refresh token is invalid or expired.',
                    400
                );
            }

            $requested_scopes = $this->parse_scope(
                $request->get_param('scope'),
                false
            );
            if (is_wp_error($requested_scopes)) {
                return $this->oauth_error(
                    'invalid_scope',
                    $requested_scopes->get_error_message(),
                    400
                );
            }
            if (empty($requested_scopes)) {
                $requested_scopes = (array) $record['scopes'];
            }
            if (array_diff($requested_scopes, (array) $record['scopes'])) {
                return $this->oauth_error(
                    'invalid_scope',
                    'Refresh cannot expand the granted scopes.',
                    400
                );
            }

            $rotated = $this->rotate_connection_tokens(
                $parsed['user_id'],
                $parsed['connection_id'],
                $record,
                $requested_scopes
            );
            if (is_wp_error($rotated)) {
                return $this->oauth_error(
                    'server_error',
                    'Unable to refresh the connection.',
                    500
                );
            }

            return $this->no_store_response($rotated, 200);
        } finally {
            $this->release_connection_lock($lock);
        }
    }

    private function validate_authorization_request($params)
    {
        if (($params['response_type'] ?? '') !== 'code') {
            return new WP_Error(
                'setae_chatgpt_invalid_response_type',
                'ChatGPTからの認可方式が正しくありません。',
                array('status' => 400)
            );
        }

        $client_id = trim((string) ($params['client_id'] ?? ''));
        $redirect_uri = esc_url_raw($params['redirect_uri'] ?? '');
        if (!$this->validate_chatgpt_client($client_id, $redirect_uri)) {
            return new WP_Error(
                'setae_chatgpt_invalid_client',
                'ChatGPTの接続元を確認できませんでした。',
                array('status' => 400)
            );
        }

        $resource = esc_url_raw($params['resource'] ?? '');
        if ($resource === '' || !hash_equals($this->get_resource_url(), $resource)) {
            return new WP_Error(
                'setae_chatgpt_invalid_resource',
                '接続先がSETAEのMCPサーバーと一致しません。',
                array('status' => 400)
            );
        }

        $challenge = trim((string) ($params['code_challenge'] ?? ''));
        if (
            ($params['code_challenge_method'] ?? '') !== 'S256'
            || !preg_match('/^[A-Za-z0-9_-]{43,128}$/', $challenge)
        ) {
            return new WP_Error(
                'setae_chatgpt_invalid_pkce',
                '安全な認可確認（PKCE）を確認できませんでした。',
                array('status' => 400)
            );
        }

        $scopes = $this->parse_scope($params['scope'] ?? '', true);
        if (is_wp_error($scopes)) {
            return $scopes;
        }

        $state = is_scalar($params['state'] ?? '') ? (string) $params['state'] : '';
        if (strlen($state) > 2048) {
            return new WP_Error(
                'setae_chatgpt_invalid_state',
                '認可状態の値が長すぎます。',
                array('status' => 400)
            );
        }

        return array(
            'response_type' => 'code',
            'client_id' => $client_id,
            'redirect_uri' => $redirect_uri,
            'resource' => $resource,
            'scope' => implode(' ', $scopes),
            'scopes' => $scopes,
            'state' => $state,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
        );
    }

    private function validate_chatgpt_client($client_id, $redirect_uri)
    {
        if (
            strlen($client_id) > 2048
            || !$this->is_allowed_chatgpt_url($client_id)
            || !$this->is_allowed_chatgpt_url($redirect_uri)
        ) {
            return false;
        }

        $cache_key = 'setae_cimd_' . substr(
            hash_hmac('sha256', $client_id, wp_salt('nonce')),
            0,
            32
        );
        $metadata = get_transient($cache_key);
        if (!is_array($metadata)) {
            $response = wp_safe_remote_get($client_id, array(
                'timeout' => 8,
                'redirection' => 0,
                'limit_response_size' => 32768,
                'headers' => array('Accept' => 'application/json'),
            ));
            if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                return false;
            }

            $metadata = json_decode(wp_remote_retrieve_body($response), true);
            if (!is_array($metadata)) {
                return false;
            }
            set_transient($cache_key, $metadata, 10 * MINUTE_IN_SECONDS);
        }

        if (
            isset($metadata['client_id'])
            && !hash_equals((string) $metadata['client_id'], $client_id)
        ) {
            return false;
        }

        $redirect_uris = isset($metadata['redirect_uris']) && is_array($metadata['redirect_uris'])
            ? array_values(array_filter(array_map('esc_url_raw', $metadata['redirect_uris'])))
            : array();
        if (!in_array($redirect_uri, $redirect_uris, true)) {
            return false;
        }

        $method = $metadata['token_endpoint_auth_method']
            ?? ($metadata['token_endpoint_auth_methods_supported'] ?? 'none');
        if (is_array($method)) {
            if (!in_array('none', array_map('strval', $method), true)) {
                return false;
            }
        } elseif ($method !== 'none') {
            return false;
        }

        return true;
    }

    private function is_allowed_chatgpt_url($url)
    {
        $parts = wp_parse_url($url);
        if (
            !is_array($parts)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || empty($parts['host'])
            || !empty($parts['user'])
            || !empty($parts['pass'])
            || !empty($parts['fragment'])
            || (!empty($parts['port']) && (int) $parts['port'] !== 443)
        ) {
            return false;
        }

        $host = strtolower((string) $parts['host']);
        return $host === 'chatgpt.com'
            || substr($host, -12) === '.chatgpt.com'
            || $host === 'openai.com'
            || substr($host, -11) === '.openai.com';
    }

    private function issue_authorization_code($user_id, $validated)
    {
        try {
            $code = $this->base64url_encode(random_bytes(32));
        } catch (Exception $error) {
            return new WP_Error(
                'setae_chatgpt_code_generation_failed',
                '安全な認可コードを生成できませんでした。'
            );
        }

        $saved = set_transient(
            $this->authorization_code_key($code),
            array(
                'user_id' => (int) $user_id,
                'client_id' => $validated['client_id'],
                'redirect_uri' => $validated['redirect_uri'],
                'resource' => $validated['resource'],
                'scopes' => $validated['scopes'],
                'code_challenge' => $validated['code_challenge'],
                'created_at' => time(),
            ),
            5 * MINUTE_IN_SECONDS
        );

        if (!$saved) {
            return new WP_Error(
                'setae_chatgpt_code_save_failed',
                '認可状態を保存できませんでした。'
            );
        }

        return $code;
    }

    private function issue_connection_tokens($user_id, $client_id, $resource, $scopes)
    {
        try {
            $connection_id = bin2hex(random_bytes(12));
            $access_secret = $this->base64url_encode(random_bytes(32));
            $refresh_secret = $this->base64url_encode(random_bytes(40));
        } catch (Exception $error) {
            return new WP_Error('setae_chatgpt_token_generation_failed', 'Token generation failed.');
        }

        $now = time();
        $record = array(
            'version' => 1,
            'connection_id' => $connection_id,
            'client_id' => $client_id,
            'resource' => $resource,
            'scopes' => array_values($scopes),
            'access_hash' => $this->hash_token_secret('access', $connection_id, $access_secret),
            'access_expires_at' => $now + self::ACCESS_TOKEN_TTL,
            'refresh_hash' => $this->hash_token_secret('refresh', $connection_id, $refresh_secret),
            'refresh_expires_at' => $now + self::REFRESH_TOKEN_TTL,
            'created_at' => gmdate('c', $now),
            'last_used_at' => '',
        );

        $lock = $this->acquire_connection_lock($user_id);
        if (is_wp_error($lock)) {
            return $lock;
        }

        try {
            $connections = $this->get_connections($user_id);
            $connections[$connection_id] = $record;
            $connections = $this->prune_connections($connections);
            if (!$this->save_connections($user_id, $connections)) {
                return new WP_Error(
                    'setae_chatgpt_token_save_failed',
                    'Token storage failed.'
                );
            }

            return $this->format_token_response(
                $user_id,
                $connection_id,
                $access_secret,
                $refresh_secret,
                $scopes
            );
        } finally {
            $this->release_connection_lock($lock);
        }
    }

    private function rotate_connection_tokens($user_id, $connection_id, $record, $scopes)
    {
        try {
            $access_secret = $this->base64url_encode(random_bytes(32));
            $refresh_secret = $this->base64url_encode(random_bytes(40));
        } catch (Exception $error) {
            return new WP_Error('setae_chatgpt_token_generation_failed', 'Token generation failed.');
        }

        $now = time();
        $record['scopes'] = array_values($scopes);
        $record['access_hash'] = $this->hash_token_secret('access', $connection_id, $access_secret);
        $record['access_expires_at'] = $now + self::ACCESS_TOKEN_TTL;
        $record['refresh_hash'] = $this->hash_token_secret('refresh', $connection_id, $refresh_secret);
        $record['refresh_expires_at'] = $now + self::REFRESH_TOKEN_TTL;
        $record['last_used_at'] = gmdate('c', $now);

        $connections = $this->get_connections($user_id);
        $connections[$connection_id] = $record;
        if (!$this->save_connections($user_id, $connections)) {
            return new WP_Error('setae_chatgpt_token_save_failed', 'Token storage failed.');
        }

        return $this->format_token_response(
            $user_id,
            $connection_id,
            $access_secret,
            $refresh_secret,
            $scopes
        );
    }

    private function format_token_response(
        $user_id,
        $connection_id,
        $access_secret,
        $refresh_secret,
        $scopes
    ) {
        return array(
            'access_token' => implode('.', array(
                'setae',
                'mcp',
                'v1',
                (int) $user_id,
                $connection_id,
                $access_secret,
            )),
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TOKEN_TTL,
            'refresh_token' => implode('.', array(
                'setae',
                'mcp',
                'refresh',
                'v1',
                (int) $user_id,
                $connection_id,
                $refresh_secret,
            )),
            'scope' => implode(' ', $scopes),
        );
    }

    private function authenticate_mcp_request($request, $required_scopes)
    {
        if (!$this->is_secure_request()) {
            return new WP_Error('https_required', 'HTTPS is required.');
        }

        $required_scopes = is_array($required_scopes)
            ? $required_scopes
            : array($required_scopes);
        $required_scopes = array_values(array_unique(array_filter(array_map(
            array($this, 'normalize_scope'),
            $required_scopes
        ))));

        $authorization = trim((string) $request->get_header('authorization'));
        if ($authorization === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $authorization = trim((string) wp_unslash($_SERVER['HTTP_AUTHORIZATION']));
        }
        if ($authorization === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authorization = trim((string) wp_unslash($_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
        }
        if (!preg_match('/^Bearer\s+([A-Za-z0-9._~-]+)$/i', $authorization, $matches)) {
            return new WP_Error('missing_token', 'No access token was provided.');
        }

        $parsed = $this->parse_connection_token($matches[1], 'access');
        if (is_wp_error($parsed)) {
            return $parsed;
        }

        $connections = $this->get_connections($parsed['user_id']);
        $record = $connections[$parsed['connection_id']] ?? null;
        if (
            !is_array($record)
            || (int) ($record['access_expires_at'] ?? 0) <= time()
            || !hash_equals((string) ($record['resource'] ?? ''), $this->get_resource_url())
            || !hash_equals(
                (string) ($record['access_hash'] ?? ''),
                $this->hash_token_secret('access', $parsed['connection_id'], $parsed['secret'])
            )
        ) {
            return new WP_Error('invalid_token', 'The access token is invalid or expired.');
        }

        $scopes = isset($record['scopes']) && is_array($record['scopes'])
            ? array_values(array_map(array($this, 'normalize_scope'), $record['scopes']))
            : array();
        if (array_diff($required_scopes, $scopes)) {
            return new WP_Error('insufficient_scope', 'The connection does not grant this permission.');
        }

        $is_write = !empty(array_intersect(
            $required_scopes,
            array('animals:write', 'records:write')
        ));
        $limit = $is_write ? 40 : 120;
        $rate_limit = $this->consume_rate_limit(
            'mcp_' . $parsed['connection_id'] . '_' . implode('_', $required_scopes),
            $limit,
            60
        );
        if (is_wp_error($rate_limit)) {
            return new WP_Error('rate_limited', 'The connection is sending too many requests.');
        }

        $this->maybe_update_connection_last_used(
            $parsed['user_id'],
            $parsed['connection_id'],
            $record
        );

        return array(
            'user_id' => $parsed['user_id'],
            'connection_id' => $parsed['connection_id'],
            'client_id' => $record['client_id'],
            'scopes' => $scopes,
        );
    }

    private function parse_connection_token($token, $expected_type = '')
    {
        $parts = explode('.', (string) $token);
        $type = '';

        if (
            count($parts) === 6
            && $parts[0] === 'setae'
            && $parts[1] === 'mcp'
            && $parts[2] === 'v1'
        ) {
            $type = 'access';
            $user_index = 3;
            $connection_index = 4;
            $secret_index = 5;
        } elseif (
            count($parts) === 7
            && $parts[0] === 'setae'
            && $parts[1] === 'mcp'
            && $parts[2] === 'refresh'
            && $parts[3] === 'v1'
        ) {
            $type = 'refresh';
            $user_index = 4;
            $connection_index = 5;
            $secret_index = 6;
        } else {
            return new WP_Error('invalid_token', 'Invalid token.');
        }

        if ($expected_type !== '' && $type !== $expected_type) {
            return new WP_Error('invalid_token_type', 'Invalid token type.');
        }

        if (
            !ctype_digit($parts[$user_index])
            || !preg_match('/^[a-f0-9]{24}$/', $parts[$connection_index])
            || !preg_match('/^[A-Za-z0-9_-]{40,80}$/', $parts[$secret_index])
        ) {
            return new WP_Error('invalid_token', 'Invalid token.');
        }

        return array(
            'type' => $type,
            'user_id' => absint($parts[$user_index]),
            'connection_id' => $parts[$connection_index],
            'secret' => $parts[$secret_index],
        );
    }

    private function get_connections($user_id)
    {
        $connections = get_user_meta((int) $user_id, self::CONNECTION_META_KEY, true);
        return is_array($connections) ? $this->prune_connections($connections) : array();
    }

    private function save_connections($user_id, $connections)
    {
        if (empty($connections)) {
            delete_user_meta((int) $user_id, self::CONNECTION_META_KEY);
            return true;
        }

        $existing = get_user_meta((int) $user_id, self::CONNECTION_META_KEY, true);
        if (is_array($existing) && $existing === $connections) {
            return true;
        }

        return update_user_meta((int) $user_id, self::CONNECTION_META_KEY, $connections) !== false;
    }

    private function prune_connections($connections)
    {
        $now = time();
        foreach ($connections as $connection_id => $record) {
            if (
                !is_array($record)
                || !preg_match('/^[a-f0-9]{24}$/', (string) $connection_id)
                || (int) ($record['refresh_expires_at'] ?? 0) <= $now
            ) {
                unset($connections[$connection_id]);
            }
        }

        uasort($connections, function ($left, $right) {
            return strcmp(
                (string) ($right['created_at'] ?? ''),
                (string) ($left['created_at'] ?? '')
            );
        });

        return array_slice($connections, 0, self::MAX_CONNECTIONS, true);
    }

    private function build_connection_status($connections)
    {
        $connections = $this->prune_connections($connections);
        $created = array();
        $last_used = array();
        $scope_union = array();

        foreach ($connections as $record) {
            if (!empty($record['created_at'])) {
                $created[] = $record['created_at'];
            }
            if (!empty($record['last_used_at'])) {
                $last_used[] = $record['last_used_at'];
            }
            $scope_union = array_merge($scope_union, (array) ($record['scopes'] ?? array()));
        }

        sort($created);
        rsort($last_used);

        return array(
            'enabled' => !empty($connections),
            'connection_count' => count($connections),
            'scopes' => array_values(array_unique(array_map(
                array($this, 'normalize_scope'),
                $scope_union
            ))),
            'connected_at' => !empty($created) ? $created[0] : '',
            'last_used_at' => !empty($last_used) ? $last_used[0] : '',
        );
    }

    private function maybe_update_connection_last_used(
        $user_id,
        $connection_id,
        $record
    ) {
        $last_used = !empty($record['last_used_at']) ? strtotime($record['last_used_at']) : 0;
        if ($last_used && $last_used > time() - 300) {
            return;
        }

        $lock = $this->acquire_connection_lock($user_id);
        if (is_wp_error($lock)) {
            return;
        }

        try {
            $connections = $this->get_connections($user_id);
            $fresh = $connections[$connection_id] ?? null;
            if (
                !is_array($fresh)
                || !hash_equals(
                    (string) ($fresh['access_hash'] ?? ''),
                    (string) ($record['access_hash'] ?? '')
                )
            ) {
                return;
            }

            $fresh_last_used = !empty($fresh['last_used_at'])
                ? strtotime($fresh['last_used_at'])
                : 0;
            if ($fresh_last_used && $fresh_last_used > time() - 300) {
                return;
            }

            $fresh['last_used_at'] = gmdate('c');
            $connections[$connection_id] = $fresh;
            $this->save_connections($user_id, $connections);
        } finally {
            $this->release_connection_lock($lock);
        }
    }

    private function get_external_access_controller()
    {
        if ($this->external_access_controller instanceof Setae_API_External_Access) {
            return $this->external_access_controller;
        }

        $file = dirname(__DIR__) . '/api/class-setae-api-external-access.php';
        if (!class_exists('Setae_API_External_Access') && file_exists($file)) {
            require_once $file;
        }

        if (!class_exists('Setae_API_External_Access')) {
            return null;
        }

        $this->external_access_controller = new Setae_API_External_Access();
        return $this->external_access_controller;
    }

    private function build_mcp_authentication_error($scope, $error)
    {
        $error_code = $error->get_error_code() === 'insufficient_scope'
            ? 'insufficient_scope'
            : 'invalid_token';
        $description = $error_code === 'insufficient_scope'
            ? 'SETAEとの接続に必要な権限がありません。再接続してください。'
            : 'SETAEアカウントを接続してください。';
        $challenge = sprintf(
            'Bearer resource_metadata="%s", scope="%s", error="%s", error_description="%s"',
            esc_url_raw($this->get_protected_resource_metadata_url()),
            sanitize_text_field($scope),
            $error_code,
            $description
        );

        return array(
            'content' => array(
                array('type' => 'text', 'text' => $description),
            ),
            '_meta' => array(
                'mcp/www_authenticate' => array($challenge),
            ),
            'isError' => true,
        );
    }

    private function tool_success($tool_name, $data)
    {
        $messages = array(
            'list_animals' => 'SETAEの飼育一覧を取得しました。',
            'get_animal' => 'SETAEの個体情報を取得しました。',
            'add_care_record' => !empty($data['duplicate'])
                ? 'この飼育記録はすでに保存済みです。'
                : 'SETAEに飼育記録を保存しました。',
            'update_animal' => 'SETAEの個体情報を更新しました。',
        );

        return array(
            'structuredContent' => $data,
            'content' => array(
                array(
                    'type' => 'text',
                    'text' => $messages[$tool_name] ?? 'SETAEの処理が完了しました。',
                ),
            ),
            'isError' => false,
        );
    }

    private function tool_error($message, $code = '')
    {
        return array(
            'structuredContent' => array(
                'success' => false,
                'code' => sanitize_key($code),
                'message' => sanitize_text_field($message),
            ),
            'content' => array(
                array('type' => 'text', 'text' => sanitize_text_field($message)),
            ),
            'isError' => true,
        );
    }

    private function build_protected_resource_metadata()
    {
        return array(
            'resource' => $this->get_resource_url(),
            'authorization_servers' => array($this->get_issuer_url()),
            'scopes_supported' => $this->get_supported_scopes(),
            'bearer_methods_supported' => array('header'),
            'resource_documentation' => esc_url_raw(home_url('/')),
        );
    }

    private function build_authorization_server_metadata()
    {
        return array(
            'issuer' => $this->get_issuer_url(),
            'authorization_endpoint' => esc_url_raw(home_url('/chatgpt/oauth/authorize')),
            'token_endpoint' => esc_url_raw(rest_url('setae/v1/chatgpt/oauth/token')),
            'revocation_endpoint' => esc_url_raw(rest_url('setae/v1/chatgpt/oauth/revoke')),
            'response_types_supported' => array('code'),
            'grant_types_supported' => array('authorization_code', 'refresh_token'),
            'code_challenge_methods_supported' => array('S256'),
            'token_endpoint_auth_methods_supported' => array('none'),
            'client_id_metadata_document_supported' => true,
            'scopes_supported' => $this->get_supported_scopes(),
        );
    }

    private function get_supported_scopes()
    {
        return array('animals:read', 'animals:write', 'records:write');
    }

    private function parse_scope($scope, $use_defaults)
    {
        $scope = is_scalar($scope) ? trim((string) $scope) : '';
        $requested = $scope === ''
            ? array()
            : preg_split('/\s+/', $scope, -1, PREG_SPLIT_NO_EMPTY);
        $requested = array_values(array_unique(array_map(
            array($this, 'normalize_scope'),
            $requested
        )));

        if (empty($requested) && $use_defaults) {
            return $this->get_supported_scopes();
        }
        if (array_diff($requested, $this->get_supported_scopes())) {
            return new WP_Error(
                'setae_chatgpt_invalid_scope',
                'ChatGPTが要求した権限をSETAEは提供していません。',
                array('status' => 400)
            );
        }

        return $requested;
    }

    private function get_authorization_params()
    {
        $source = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST'
            ? $_POST
            : $_GET;
        $keys = array(
            'response_type',
            'client_id',
            'redirect_uri',
            'scope',
            'state',
            'resource',
            'code_challenge',
            'code_challenge_method',
        );
        $params = array();

        foreach ($keys as $key) {
            $params[$key] = isset($source[$key]) && is_scalar($source[$key])
                ? wp_unslash($source[$key])
                : '';
        }

        return $params;
    }

    private function render_authorization_consent($validated)
    {
        $user = wp_get_current_user();
        $scope_labels = array(
            'animals:read' => '自分の飼育一覧と個体カルテを確認',
            'animals:write' => '個体名・種類・性別・状態などを編集',
            'records:write' => '給餌・脱皮・ペアリング・観察・成長記録を追加',
        );

        nocache_headers();
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        status_header(200);
        ?>
        <!doctype html>
        <html lang="ja">
        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>ChatGPTとSETAEを接続</title>
            <style>
                :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
                * { box-sizing: border-box; }
                body { margin: 0; min-height: 100vh; background: #f4f6f5; color: #17201d; display: grid; place-items: center; padding: 24px 16px; }
                main { width: min(100%, 520px); background: #fff; border: 1px solid #dce3df; border-radius: 16px; box-shadow: 0 18px 50px rgba(24, 42, 34, .10); overflow: hidden; }
                header { padding: 26px 28px 20px; border-bottom: 1px solid #e7ece9; }
                .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
                .brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: #173d33; color: #fff; font-weight: 800; letter-spacing: 0; }
                .brand strong, .brand span { display: block; }
                .brand span { margin-top: 2px; color: #64726c; font-size: 12px; }
                h1 { margin: 0; font-size: 24px; line-height: 1.35; letter-spacing: 0; }
                .lead { margin: 8px 0 0; color: #596761; line-height: 1.7; font-size: 14px; }
                .body { padding: 22px 28px 28px; }
                .account { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 13px 14px; background: #f5f8f6; border-radius: 12px; margin-bottom: 18px; }
                .account span { color: #68756f; font-size: 12px; }
                .account strong { display: block; margin-top: 2px; font-size: 14px; overflow-wrap: anywhere; }
                h2 { margin: 0 0 10px; font-size: 14px; letter-spacing: 0; }
                ul { margin: 0 0 22px; padding: 0; list-style: none; display: grid; gap: 10px; }
                li { position: relative; padding-left: 28px; color: #33413b; font-size: 14px; line-height: 1.55; }
                li::before { content: "✓"; position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; background: #e5f3eb; color: #12613f; display: grid; place-items: center; font-weight: 800; font-size: 12px; }
                .note { margin: 0 0 20px; padding: 12px 14px; border-left: 3px solid #3d7c67; background: #f5f8f6; color: #56645e; font-size: 12px; line-height: 1.65; }
                .actions { display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; }
                button { min-height: 46px; border-radius: 12px; border: 1px solid #cfd8d3; background: #fff; color: #26332e; font: inherit; font-weight: 700; cursor: pointer; }
                button[name="decision"][value="approve"] { border-color: #173d33; background: #173d33; color: #fff; }
                button:focus-visible { outline: 3px solid rgba(23, 61, 51, .25); outline-offset: 2px; }
                @media (max-width: 520px) {
                    body { align-items: end; padding: 12px; }
                    main { border-radius: 16px; }
                    header, .body { padding-left: 20px; padding-right: 20px; }
                    .actions { grid-template-columns: 1fr; }
                    button[name="decision"][value="approve"] { order: -1; }
                }
            </style>
        </head>
        <body>
            <main>
                <header>
                    <div class="brand">
                        <span class="brand-mark" aria-hidden="true">S</span>
                        <div>
                            <strong>SETAE</strong>
                            <span>ChatGPT App</span>
                        </div>
                    </div>
                    <h1>ChatGPTと飼育データを接続</h1>
                    <p class="lead">会話の中から、あなた自身の個体だけを確認・更新できるようにします。</p>
                </header>
                <div class="body">
                    <div class="account">
                        <div>
                            <span>接続するSETAEアカウント</span>
                            <strong><?php echo esc_html($user->display_name ?: $user->user_login); ?></strong>
                        </div>
                        <span><?php echo esc_html($user->user_email); ?></span>
                    </div>
                    <h2>ChatGPTに許可する操作</h2>
                    <ul>
                        <?php foreach ($validated['scopes'] as $scope) : ?>
                            <li><?php echo esc_html($scope_labels[$scope] ?? $scope); ?></li>
                        <?php endforeach; ?>
                    </ul>
                    <p class="note">変更操作はChatGPT側の確認設定に従います。接続はSETAEのプロフィール設定からいつでも停止できます。</p>
                    <form method="post" action="">
                        <?php foreach ($validated as $key => $value) : ?>
                            <?php if ($key === 'scopes') continue; ?>
                            <input type="hidden" name="<?php echo esc_attr($key); ?>" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>
                        <input type="hidden" name="_setae_chatgpt_nonce" value="<?php echo esc_attr(wp_create_nonce('setae_chatgpt_oauth_consent')); ?>">
                        <div class="actions">
                            <button type="submit" name="decision" value="deny">キャンセル</button>
                            <button type="submit" name="decision" value="approve">接続を許可</button>
                        </div>
                    </form>
                </div>
            </main>
        </body>
        </html>
        <?php
        exit;
    }

    private function render_oauth_error_page($title, $message, $status)
    {
        nocache_headers();
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        status_header($status);
        ?>
        <!doctype html>
        <html lang="ja">
        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title><?php echo esc_html($title); ?></title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; min-height: 100vh; padding: 24px; display: grid; place-items: center; background: #f4f6f5; color: #17201d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
                main { width: min(100%, 460px); padding: 28px; border: 1px solid #dce3df; border-radius: 16px; background: #fff; box-shadow: 0 18px 50px rgba(24, 42, 34, .10); }
                h1 { margin: 0 0 10px; font-size: 22px; letter-spacing: 0; }
                p { margin: 0; color: #5b6963; line-height: 1.7; }
            </style>
        </head>
        <body>
            <main>
                <h1><?php echo esc_html($title); ?></h1>
                <p><?php echo esc_html($message); ?></p>
            </main>
        </body>
        </html>
        <?php
        exit;
    }

    private function redirect_oauth_result($redirect_uri, $params)
    {
        $params = array_filter($params, function ($value) {
            return $value !== '';
        });
        wp_redirect(add_query_arg($params, $redirect_uri));
        exit;
    }

    private function current_authorization_url()
    {
        return add_query_arg(
            $this->get_authorization_params(),
            home_url('/chatgpt/oauth/authorize')
        );
    }

    private function get_relative_request_path()
    {
        $request_path = (string) wp_parse_url(
            wp_unslash($_SERVER['REQUEST_URI'] ?? '/'),
            PHP_URL_PATH
        );
        $home_path = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        if ($home_path !== '/' && strpos($request_path, $home_path) === 0) {
            $request_path = substr($request_path, strlen($home_path));
        }

        return trim($request_path, '/');
    }

    private function send_json_document($document)
    {
        status_header(200);
        nocache_headers();
        header('Content-Type: application/json; charset=' . get_option('blog_charset', 'UTF-8'));
        header('X-Content-Type-Options: nosniff');
        echo wp_json_encode($document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function jsonrpc_result($id, $result)
    {
        $response = new WP_REST_Response(array(
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $result,
        ), 200);
        $response->header('Cache-Control', 'no-store');
        return $response;
    }

    private function jsonrpc_error($id, $code, $message, $http_status)
    {
        $response = new WP_REST_Response(array(
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => array(
                'code' => (int) $code,
                'message' => (string) $message,
            ),
        ), $http_status);
        $response->header('Cache-Control', 'no-store');
        return $response;
    }

    private function oauth_error($error, $description, $status)
    {
        return $this->no_store_response(array(
            'error' => sanitize_key($error),
            'error_description' => sanitize_text_field($description),
        ), $status);
    }

    private function no_store_response($data, $status = 200)
    {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('Pragma', 'no-cache');
        $response->header('X-Content-Type-Options', 'nosniff');
        return $response;
    }

    private function authorization_code_key($code)
    {
        return self::AUTH_CODE_PREFIX . substr(
            hash_hmac('sha256', (string) $code, wp_salt('auth')),
            0,
            32
        );
    }

    private function hash_token_secret($type, $connection_id, $secret)
    {
        return hash_hmac(
            'sha256',
            sanitize_key($type) . ':' . $connection_id . ':' . $secret,
            wp_salt('auth')
        );
    }

    private function base64url_encode($value)
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function normalize_scope($scope)
    {
        return preg_replace('/[^a-z0-9:_-]/', '', strtolower((string) $scope));
    }

    private function get_resource_url()
    {
        return esc_url_raw(rest_url('setae/v1/chatgpt/mcp'));
    }

    private function get_protected_resource_metadata_url()
    {
        return esc_url_raw(home_url('/.well-known/oauth-protected-resource'));
    }

    private function get_issuer_url()
    {
        return untrailingslashit(esc_url_raw(home_url('/')));
    }

    private function is_secure_request()
    {
        if (is_ssl()) {
            return true;
        }

        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host);
        return in_array($host, array('localhost', '127.0.0.1', '::1'), true)
            && defined('WP_DEBUG')
            && WP_DEBUG;
    }

    private function get_request_ip_hash()
    {
        $ip = isset($_SERVER['REMOTE_ADDR'])
            ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
            : 'unknown';
        return substr(hash_hmac('sha256', $ip, wp_salt('nonce')), 0, 32);
    }

    private function acquire_connection_lock($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return new WP_Error(
                'setae_chatgpt_invalid_connection_user',
                '接続するユーザーを確認できません。',
                array('status' => 400)
            );
        }

        $key = 'setae_cg_conn_lock_' . $user_id;
        $now = time();
        if (add_option($key, (string) $now, '', false)) {
            return $key;
        }

        $locked_at = (int) get_option($key, 0);
        if ($locked_at && $locked_at < $now - 30) {
            delete_option($key);
            if (add_option($key, (string) $now, '', false)) {
                return $key;
            }
        }

        return new WP_Error(
            'setae_chatgpt_connection_busy',
            'ChatGPT連携を更新中です。少し待ってから再試行してください。',
            array('status' => 409)
        );
    }

    private function release_connection_lock($key)
    {
        if (is_string($key) && strpos($key, 'setae_cg_conn_lock_') === 0) {
            delete_option($key);
        }
    }

    private function consume_rate_limit($bucket, $limit, $window)
    {
        $now = time();
        $key = 'setae_cg_rl_' . substr(
            hash_hmac('sha256', (string) $bucket, wp_salt('nonce')),
            0,
            32
        );
        $state = get_transient($key);
        if (!is_array($state) || (int) ($state['reset_at'] ?? 0) <= $now) {
            $state = array('count' => 0, 'reset_at' => $now + (int) $window);
        }

        if ((int) $state['count'] >= (int) $limit) {
            return new WP_Error(
                'setae_chatgpt_rate_limited',
                'リクエスト回数が上限を超えました。',
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

    private function get_server_instructions()
    {
        return implode("\n", array(
            'SETAE manages the authenticated user’s husbandry animals.',
            'Search before writing when a user names an animal without an exact SETAE ID.',
            'Never expose another user’s data, access tokens, OAuth data, or internal metadata.',
            'Do not infer a date, animal, species, sex, status, or care event that the user did not state.',
            'If multiple animals match, show concise candidates and ask the user to choose.',
            'Call get_animal immediately before update_animal and pass the returned version.',
            'Use a unique request_id for every new care event and reuse it only when retrying the same event.',
            'Only say that a change was saved after a successful tool result.',
            'Interpret relative dates in Asia/Tokyo and send YYYY-MM-DD.',
        ));
    }

    private function get_operation_prompt()
    {
        return implode("\n", array(
            'この会話ではSETAEアプリを使って、私自身の飼育個体と飼育記録を管理してください。',
            '個体名だけで変更を頼んだ場合は、最初にSETAEの一覧を検索してください。候補が複数なら種類名とSETAE IDを示して確認し、曖昧なまま保存しないでください。',
            '個体情報の編集前には最新の詳細を取得し、取得したversionを使って更新してください。',
            '日付は日本時間として扱い、私が言っていない日付・個体・内容を推測して保存しないでください。',
            '保存に成功した後だけ、個体名・日付・変更内容を短く復唱してください。',
        ));
    }
}
