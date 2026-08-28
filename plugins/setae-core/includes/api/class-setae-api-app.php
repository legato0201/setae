<?php

/**
 * REST endpoints that define the GUI-independent application shell.
 */
class Setae_API_App
{
    const NAMESPACE = 'setae/v1';

    public function register_routes()
    {
        register_rest_route(self::NAMESPACE, '/app/bootstrap', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_bootstrap'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::NAMESPACE, '/operations', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_operations'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route(self::NAMESPACE, '/registration', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'register_user'),
            'permission_callback' => '__return_true',
            'args' => array(
                'email' => array('required' => true, 'type' => 'string'),
                'password' => array('required' => true, 'type' => 'string'),
                'username' => array('type' => 'string', 'default' => ''),
                'referral_code' => array('type' => 'string', 'default' => ''),
                'referral_source' => array('type' => 'string', 'default' => 'unknown'),
                'qr_claim_code' => array('type' => 'string', 'default' => ''),
                'qr_claim_intent' => array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'default' => ''),
                'return_url' => array('type' => 'string', 'default' => ''),
                'terms_accepted' => array('required' => true, 'type' => 'boolean'),
                'terms_version' => array('type' => 'string', 'default' => Setae_App_Operations::TERMS_VERSION),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/session', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_session'),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'create_session'),
                'permission_callback' => '__return_true',
                'args' => array(
                    'login' => array('required' => true, 'type' => 'string'),
                    'password' => array('required' => true, 'type' => 'string'),
                    'remember' => array('type' => 'boolean', 'default' => true),
                ),
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array($this, 'delete_session'),
                'permission_callback' => array($this, 'require_login'),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/password-reset', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'request_password_reset'),
            'permission_callback' => '__return_true',
            'args' => array(
                'login' => array('required' => true, 'type' => 'string'),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/email-verification', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'verify_email'),
            'permission_callback' => '__return_true',
            'args' => array(
                'user_id' => array('required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'token' => array('required' => true, 'type' => 'string'),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/me', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_me'),
                'permission_callback' => array($this, 'require_login'),
            ),
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array($this, 'update_me'),
                'permission_callback' => array($this, 'require_login'),
                'args' => array(
                    'display_name' => array('type' => 'string'),
                    'email' => array('type' => 'string'),
                    'password' => array('type' => 'string'),
                    'theme_preference' => array(
                        'type' => 'string',
                        'enum' => array('light', 'dark', 'system'),
                    ),
                    'show_care_focus' => array('type' => 'boolean'),
                ),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/ui/preferences', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_ui_preferences'),
                'permission_callback' => array($this, 'require_login'),
            ),
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array($this, 'update_ui_preferences'),
                'permission_callback' => array($this, 'require_login'),
                'args' => array(
                    'dashboard_widgets' => array('type' => 'array'),
                    'dashboard_sections' => array('type' => 'array'),
                    'animal_saved_views' => array('type' => 'array'),
                    'animal_card' => array('type' => 'object'),
                    'personalization' => array('type' => 'object'),
                    'care_profile' => array('type' => 'object'),
                    'enclosure_care_profile' => array('type' => 'object'),
                    'nursery_care_profile' => array('type' => 'object'),
                    'today_tasks' => array('type' => 'object'),
                    'animal_view' => array(
                        'type' => 'string',
                        'enum' => array('gallery', 'table'),
                    ),
                    'collection_tab' => array(
                        'type' => 'string',
                        'enum' => array('animals', 'babies', 'feeders'),
                    ),
                    'husbandry_tab' => array(
                        'type' => 'string',
                        'enum' => array('enclosures', 'feeders', 'care'),
                    ),
                ),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/species/(?P<id>\d+)/suggestions', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'create_species_suggestion'),
            'permission_callback' => '__return_true',
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'absint'),
                'suggested_description' => array('type' => 'string'),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/metrics/events', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'track_event'),
            'permission_callback' => '__return_true',
            'args' => array(
                'event' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_key'),
                'event_id' => array('type' => 'string', 'default' => '', 'maxLength' => 36),
                'anonymous_id' => array('type' => 'string', 'default' => '', 'maxLength' => 36),
                'session_id' => array('type' => 'string', 'default' => '', 'maxLength' => 36),
                'path' => array('type' => 'string', 'default' => ''),
                'payload' => array('default' => array()),
            ),
        ));

        register_rest_route(self::NAMESPACE, '/admin/best-shots/(?P<id>\d+)', array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => array($this, 'moderate_best_shot'),
            'permission_callback' => array($this, 'require_admin'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'absint'),
                'action' => array(
                    'required' => true,
                    'type' => 'string',
                    'enum' => array('approve', 'reject', 'revoke'),
                ),
                'species_id' => array('type' => 'integer', 'sanitize_callback' => 'absint'),
                'image_id' => array('type' => 'integer', 'sanitize_callback' => 'absint'),
            ),
        ));
    }

    public function require_login()
    {
        if (!is_user_logged_in() || !current_user_can('read')) {
            return new WP_Error('rest_not_logged_in', 'ログインが必要です。', array('status' => 401));
        }
        return true;
    }

    public function require_admin()
    {
        if (!is_user_logged_in()) {
            return new WP_Error('rest_not_logged_in', 'ログインが必要です。', array('status' => 401));
        }
        if (!current_user_can('manage_options')) {
            return new WP_Error('rest_forbidden', 'この操作を行う権限がありません。', array('status' => 403));
        }
        return true;
    }

    public function get_bootstrap()
    {
        $user_id = get_current_user_id();
        $data = array(
            'api_version' => 'v1',
            'plugin_version' => defined('SETAE_VERSION') ? SETAE_VERSION : '',
            'authenticated' => (bool) $user_id,
            'nonce' => $user_id ? wp_create_nonce('wp_rest') : null,
            'registration_enabled' => (bool) get_option('setae_enable_registration'),
            'terms_version' => Setae_App_Operations::TERMS_VERSION,
            'features' => array(
                'encyclopedia',
                'spiders',
                'care_records',
                'care_feed',
                'community',
                'baby_groups',
                'feeders',
                'qr',
                'breeding_board',
                'pwa_notifications',
                'external_access',
            ),
            'upload_limits' => array(
                'profile_image_bytes' => Setae_App_Operations::PROFILE_IMAGE_MAX_BYTES,
                'suggestion_image_bytes' => Setae_App_Operations::SUGGESTION_IMAGE_MAX_BYTES,
            ),
            'links' => array(
                'api_root' => esc_url_raw(rest_url(self::NAMESPACE . '/')),
                'operations' => esc_url_raw(rest_url(self::NAMESPACE . '/operations')),
                'login' => esc_url_raw(Setae_App_Shell::login_url()),
                'password_reset' => esc_url_raw(wp_lostpassword_url(home_url('/'))),
                'terms' => Setae_App_Operations::get_terms_url(),
                'privacy' => Setae_App_Operations::get_privacy_url(),
            ),
            'user' => null,
        );
        if ($user_id) {
            $profile = Setae_App_Operations::get_profile($user_id);
            if (!is_wp_error($profile)) {
                $data['user'] = $profile;
            }
        }
        return $this->private_response($data, 200);
    }

    public function get_operations()
    {
        $server = rest_get_server();
        $registered_routes = $server->get_routes();
        $operations = array();

        foreach ($registered_routes as $route => $endpoints) {
            if (strpos($route, '/' . self::NAMESPACE . '/') !== 0) {
                continue;
            }
            foreach ($endpoints as $endpoint) {
                if (empty($endpoint['methods']) || !is_array($endpoint['methods'])) {
                    continue;
                }
                $methods = array_keys(array_filter($endpoint['methods']));
                $methods = array_values(array_diff($methods, array('HEAD', 'OPTIONS')));
                if (!$methods) {
                    continue;
                }
                $args = array();
                if (!empty($endpoint['args']) && is_array($endpoint['args'])) {
                    foreach ($endpoint['args'] as $name => $schema) {
                        $args[] = array(
                            'name' => $name,
                            'required' => !empty($schema['required']),
                            'type' => isset($schema['type']) ? $schema['type'] : null,
                            'default' => array_key_exists('default', $schema) ? $schema['default'] : null,
                            'enum' => isset($schema['enum']) ? array_values((array) $schema['enum']) : null,
                        );
                    }
                }
                foreach ($methods as $method) {
                    $operations[] = array(
                        'method' => $method,
                        'path' => $route,
                        'access' => $this->describe_access($route, $method),
                        'arguments' => $args,
                    );
                }
            }
        }

        usort($operations, function ($a, $b) {
            $path_compare = strcmp($a['path'], $b['path']);
            return $path_compare !== 0 ? $path_compare : strcmp($a['method'], $b['method']);
        });

        return new WP_REST_Response(array(
            'namespace' => self::NAMESPACE,
            'generated_at' => current_time('c'),
            'total' => count($operations),
            'operations' => $operations,
        ), 200);
    }

    public function register_user($request)
    {
        $result = Setae_App_Operations::register_user($request->get_params());
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 201);
    }

    public function get_session()
    {
        $user_id = get_current_user_id();
        $data = array(
            'authenticated' => (bool) $user_id,
            'nonce' => $user_id ? wp_create_nonce('wp_rest') : null,
            'user' => null,
        );
        if ($user_id) {
            $profile = Setae_App_Operations::get_profile($user_id);
            if (!is_wp_error($profile)) {
                $data['user'] = $profile;
            }
        }
        return $this->private_response($data, 200);
    }

    public function create_session($request)
    {
        $rate_limit = Setae_App_Operations::consume_request_limit('login', 10, 15 * MINUTE_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $login = trim(sanitize_text_field($request->get_param('login')));
        $password = (string) $request->get_param('password');
        if (!$login || !$password) {
            return new WP_Error('missing_credentials', 'ログイン名とパスワードを入力してください。', array('status' => 400));
        }

        $user = wp_authenticate($login, $password);
        if (is_wp_error($user)) {
            return new WP_Error('invalid_credentials', 'ログイン情報を確認してください。', array('status' => 401));
        }

        $remember = rest_sanitize_boolean($request->get_param('remember'));
        $secure = is_ssl();
        $expiration = time() + apply_filters(
            'auth_cookie_expiration',
            $remember ? 14 * DAY_IN_SECONDS : 2 * DAY_IN_SECONDS,
            $user->ID,
            $remember
        );
        $session_manager = WP_Session_Tokens::get_instance($user->ID);
        $token = $session_manager->create($expiration);

        // The nonce must use the same session token as the cookie issued in this response.
        wp_set_auth_cookie($user->ID, $remember, $secure, $token);
        $_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'logged_in', $token);
        if ($secure) {
            $_COOKIE[SECURE_AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'secure_auth', $token);
        } else {
            $_COOKIE[AUTH_COOKIE] = wp_generate_auth_cookie($user->ID, $expiration, 'auth', $token);
        }

        wp_set_current_user($user->ID);
        do_action('wp_login', $user->user_login, $user);
        $profile = Setae_App_Operations::get_profile($user->ID);
        if (is_wp_error($profile)) {
            return $profile;
        }
        return $this->private_response(array(
            'authenticated' => true,
            'nonce' => wp_create_nonce('wp_rest'),
            'user' => $profile,
        ), 200);
    }

    public function delete_session()
    {
        wp_logout();
        return $this->private_response(array('authenticated' => false, 'nonce' => null), 200);
    }

    public function request_password_reset($request)
    {
        $rate_limit = Setae_App_Operations::consume_request_limit('password_reset', 4, HOUR_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $login = trim(sanitize_text_field($request->get_param('login')));
        if (!$login) {
            return new WP_Error('missing_login', 'メールアドレスまたはユーザー名を入力してください。', array('status' => 400));
        }

        $result = retrieve_password($login);
        if (is_wp_error($result) && $result->get_error_code() === 'retrieve_password_email_failure') {
            error_log('SETAE password reset email failed.');
        }

        return new WP_REST_Response(array(
            'accepted' => true,
            'message' => '該当するアカウントがある場合、パスワード再設定メールを送信しました。',
        ), 202);
    }

    public function verify_email($request)
    {
        $rate_limit = Setae_App_Operations::consume_request_limit('email_verification', 20, HOUR_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }
        $result = Setae_App_Operations::verify_email(
            $request->get_param('user_id'),
            $request->get_param('token')
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 200);
    }

    public function get_me()
    {
        $profile = Setae_App_Operations::get_profile(get_current_user_id());
        if (is_wp_error($profile)) {
            return $profile;
        }
        return $this->private_response($profile, 200);
    }

    public function update_me($request)
    {
        $result = Setae_App_Operations::update_profile(
            get_current_user_id(),
            $request->get_params(),
            $request->get_file_params()
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return $this->private_response($result, 200);
    }

    public function get_ui_preferences()
    {
        return $this->private_response($this->read_ui_preferences(get_current_user_id()), 200);
    }

    public function update_ui_preferences($request)
    {
        $user_id = get_current_user_id();
        $preferences = $this->read_ui_preferences($user_id);

        if ($request->has_param('dashboard_widgets')) {
            $allowed_keys = array('pre_molt', 'babies', 'feeders', 'collection');
            $widgets = array();
            foreach ((array) $request->get_param('dashboard_widgets') as $widget) {
                if (!is_array($widget)) {
                    continue;
                }
                $key = isset($widget['key']) ? sanitize_key($widget['key']) : '';
                if (!$key || !in_array($key, $allowed_keys, true) || isset($widgets[$key])) {
                    continue;
                }
                $size = isset($widget['size']) && in_array($widget['size'], array('normal', 'wide'), true)
                    ? $widget['size']
                    : 'normal';
                $widgets[$key] = array(
                    'key' => $key,
                    'visible' => !isset($widget['visible']) || rest_sanitize_boolean($widget['visible']),
                    'size' => $size,
                );
            }
            foreach ($this->default_dashboard_widgets() as $default_widget) {
                if (!isset($widgets[$default_widget['key']])) {
                    $widgets[$default_widget['key']] = $default_widget;
                }
            }
            $preferences['dashboard_widgets'] = array_values($widgets);
        }

        if ($request->has_param('dashboard_sections')) {
            $preferences['dashboard_sections'] = $this->sanitize_dashboard_sections(
                $request->get_param('dashboard_sections')
            );
        }

        if ($request->has_param('animal_saved_views')) {
            $preferences['animal_saved_views'] = $this->sanitize_animal_saved_views(
                $request->get_param('animal_saved_views')
            );
        }

        if ($request->has_param('animal_card')) {
            $preferences['animal_card'] = $this->sanitize_animal_card_config(
                $request->get_param('animal_card')
            );
        }

        if ($request->has_param('personalization')) {
            $preferences['personalization'] = $this->sanitize_personalization(
                $request->get_param('personalization')
            );
        }

        if ($request->has_param('care_profile')) {
            $preferences['care_profile'] = $this->sanitize_care_profile(
                $request->get_param('care_profile')
            );
        }

        if ($request->has_param('enclosure_care_profile')) {
            $preferences['enclosure_care_profile'] = $this->sanitize_enclosure_care_profile(
                $request->get_param('enclosure_care_profile')
            );
        }

        if ($request->has_param('nursery_care_profile')) {
            $preferences['nursery_care_profile'] = $this->sanitize_nursery_care_profile(
                $request->get_param('nursery_care_profile')
            );
        }

        if ($request->has_param('today_tasks')) {
            $preferences['today_tasks'] = $this->sanitize_today_tasks(
                $request->get_param('today_tasks')
            );
        }

        if ($request->has_param('animal_view')) {
            $animal_view = sanitize_key($request->get_param('animal_view'));
            if (in_array($animal_view, array('gallery', 'table'), true)) {
                $preferences['animal_view'] = $animal_view;
            }
        }

        if ($request->has_param('collection_tab')) {
            $collection_tab = sanitize_key($request->get_param('collection_tab'));
            if (in_array($collection_tab, array('animals', 'babies', 'feeders'), true)) {
                $preferences['collection_tab'] = $collection_tab;
            }
        }

        if ($request->has_param('husbandry_tab')) {
            $husbandry_tab = sanitize_key($request->get_param('husbandry_tab'));
            if (in_array($husbandry_tab, array('enclosures', 'feeders', 'care'), true)) {
                $preferences['husbandry_tab'] = $husbandry_tab;
            }
        }

        update_user_meta($user_id, '_setae_ui_preferences_v2', $preferences);
        return $this->private_response($preferences, 200);
    }

    public function create_species_suggestion($request)
    {
        $params = $request->get_params();
        $params['species_id'] = absint($request['id']);
        $result = Setae_App_Operations::submit_species_suggestion(
            $params,
            $request->get_file_params(),
            get_current_user_id()
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 201);
    }

    public function track_event($request)
    {
        $result = Setae_Product_Events::record_client($request->get_params(), $request);
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 202);
    }

    public function moderate_best_shot($request)
    {
        $params = $request->get_params();
        $params['log_id'] = absint($request['id']);
        $result = Setae_App_Operations::moderate_best_shot($params);
        if (is_wp_error($result)) {
            return $result;
        }
        return $this->private_response($result, 200);
    }

    private function describe_access($route, $method)
    {
        $public_reads = array(
            '/setae/v1/app/bootstrap',
            '/setae/v1/operations',
            '/setae/v1/session',
            '/setae/v1/pwa/config',
            '/setae/v1/external/openapi',
            '/setae/v1/bl-candidates',
            '/setae/v1/chatgpt/oauth-protected-resource',
            '/setae/v1/chatgpt/oauth-authorization-server',
        );
        $public_posts = array(
            '/setae/v1/registration',
            '/setae/v1/session',
            '/setae/v1/password-reset',
            '/setae/v1/email-verification',
            '/setae/v1/metrics/events',
        );

        if (strpos($route, '/setae/v1/admin/') === 0) {
            return 'administrator';
        }
        if (strpos($route, '/setae/v1/external/spiders') === 0) {
            return 'bearer_token';
        }
        if ($route === '/setae/v1/stripe/webhook') {
            return 'stripe_signature';
        }
        if ($method === 'GET' && in_array($route, $public_reads, true)) {
            return 'public';
        }
        if (strpos($route, '/setae/v1/chatgpt/') === 0 && strpos($route, '/setae/v1/chatgpt/access') !== 0) {
            return 'oauth_or_protocol';
        }
        if ($method === 'GET' && strpos($route, '/setae/v1/ads/species/') === 0) {
            return 'public';
        }
        if ($method === 'GET' && strpos($route, '/setae/v1/species') === 0) {
            return 'public_or_species_editor';
        }
        if ($method === 'GET' && $route === '/setae/v1/topics') {
            return 'public';
        }
        if (
            $method === 'GET'
            && strpos($route, '/setae/v1/topics/(?P<id>') === 0
            && strpos(substr($route, strlen('/setae/v1/topics/')), '/') === false
        ) {
            return 'public';
        }
        if ($method === 'POST' && in_array($route, $public_posts, true)) {
            return 'public';
        }
        if (
            $method === 'POST'
            && strpos($route, '/setae/v1/species/(?P<id>') === 0
            && substr($route, -strlen('/suggestions')) === '/suggestions'
        ) {
            return 'public';
        }
        if (strpos($route, '/setae/v1/species/') === 0 && $method !== 'GET') {
            return 'species_editor';
        }
        return 'login';
    }

    private function private_response($data, $status)
    {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, private');
        return $response;
    }

    private function read_ui_preferences($user_id)
    {
        $stored = get_user_meta($user_id, '_setae_ui_preferences_v2', true);
        if (!is_array($stored)) {
            $stored = array();
        }
        $legacy_care_focus = get_user_meta($user_id, '_setae_show_care_focus', true);
        $legacy_visible = $legacy_care_focus === ''
            ? true
            : !in_array((string) $legacy_care_focus, array('0', 'false', 'off'), true);
        return array(
            'dashboard_widgets' => !empty($stored['dashboard_widgets']) && is_array($stored['dashboard_widgets'])
                ? array_values($stored['dashboard_widgets'])
                : $this->default_dashboard_widgets(),
            'dashboard_sections' => !empty($stored['dashboard_sections']) && is_array($stored['dashboard_sections'])
                ? array_values($stored['dashboard_sections'])
                : array(),
            'animal_saved_views' => !empty($stored['animal_saved_views']) && is_array($stored['animal_saved_views'])
                ? array_values($stored['animal_saved_views'])
                : array(),
            'animal_card' => isset($stored['animal_card']) && is_array($stored['animal_card'])
                ? $this->sanitize_animal_card_config($stored['animal_card'])
                : $this->default_animal_card_config(),
            'personalization' => isset($stored['personalization']) && is_array($stored['personalization'])
                ? $this->sanitize_personalization($stored['personalization'])
                : $this->default_personalization(),
            'care_profile' => isset($stored['care_profile']) && is_array($stored['care_profile'])
                ? $this->sanitize_care_profile($stored['care_profile'])
                : $this->default_care_profile(),
            'enclosure_care_profile' => isset($stored['enclosure_care_profile']) && is_array($stored['enclosure_care_profile'])
                ? $this->sanitize_enclosure_care_profile($stored['enclosure_care_profile'])
                : $this->default_enclosure_care_profile(),
            'nursery_care_profile' => isset($stored['nursery_care_profile']) && is_array($stored['nursery_care_profile'])
                ? $this->sanitize_nursery_care_profile($stored['nursery_care_profile'])
                : $this->default_nursery_care_profile(),
            'today_tasks' => isset($stored['today_tasks']) && is_array($stored['today_tasks'])
                ? $this->sanitize_today_tasks($stored['today_tasks'])
                : $this->sanitize_today_tasks(array('visible' => $legacy_visible)),
            'animal_view' => isset($stored['animal_view']) && in_array($stored['animal_view'], array('gallery', 'table'), true)
                ? $stored['animal_view']
                : 'gallery',
            'collection_tab' => isset($stored['collection_tab']) && in_array($stored['collection_tab'], array('animals', 'babies', 'feeders'), true)
                ? $stored['collection_tab']
                : 'animals',
            'husbandry_tab' => isset($stored['husbandry_tab']) && in_array($stored['husbandry_tab'], array('enclosures', 'feeders', 'care'), true)
                ? $stored['husbandry_tab']
                : 'enclosures',
        );
    }

    private function sanitize_today_tasks($raw)
    {
        $raw = is_array($raw) ? $raw : array();
        $sections = isset($raw['sections']) && is_array($raw['sections']) ? $raw['sections'] : array();
        $defaults = array('overdue' => true, 'today' => true, 'upcoming' => false);
        $clean_sections = array();
        foreach ($defaults as $key => $default) {
            $clean_sections[$key] = array_key_exists($key, $sections)
                ? rest_sanitize_boolean($sections[$key])
                : $default;
        }
        return array(
            'visible' => array_key_exists('visible', $raw) ? rest_sanitize_boolean($raw['visible']) : true,
            'collapsed' => array_key_exists('collapsed', $raw) ? rest_sanitize_boolean($raw['collapsed']) : false,
            'showAll' => array_key_exists('showAll', $raw) ? rest_sanitize_boolean($raw['showAll']) : false,
            'sections' => $clean_sections,
        );
    }

    private function default_dashboard_widgets()
    {
        return array(
            array('key' => 'pre_molt', 'visible' => true, 'size' => 'normal'),
            array('key' => 'babies', 'visible' => true, 'size' => 'normal'),
            array('key' => 'feeders', 'visible' => true, 'size' => 'normal'),
            array('key' => 'collection', 'visible' => true, 'size' => 'wide'),
        );
    }

    private function default_animal_card_config()
    {
        return array(
            'mode' => 'hybrid',
            'density' => 'standard',
            'fields' => array(
                'scientificName' => true,
                'gender' => true,
                'instar' => true,
                'status' => true,
                'lastFeed' => true,
                'lastMolt' => true,
                'lastObservation' => false,
                'origin' => false,
                'temperature' => false,
                'humidity' => false,
                'enclosure' => false,
                'acquiredDate' => false,
            ),
            'quickActions' => array('feed', 'observation'),
        );
    }

    private function sanitize_animal_card_config($raw_config)
    {
        $defaults = $this->default_animal_card_config();
        $raw_config = is_array($raw_config) ? $raw_config : array();
        $mode = isset($raw_config['mode']) ? sanitize_key($raw_config['mode']) : $defaults['mode'];
        $density = isset($raw_config['density']) ? sanitize_key($raw_config['density']) : $defaults['density'];
        $raw_fields = isset($raw_config['fields']) && is_array($raw_config['fields'])
            ? $raw_config['fields']
            : array();
        $fields = array();

        foreach ($defaults['fields'] as $key => $default_value) {
            $fields[$key] = array_key_exists($key, $raw_fields)
                ? rest_sanitize_boolean($raw_fields[$key])
                : $default_value;
        }

        $quick_actions = array();
        $raw_actions = array_key_exists('quickActions', $raw_config) && is_array($raw_config['quickActions'])
            ? $raw_config['quickActions']
            : $defaults['quickActions'];
        foreach ($raw_actions as $action) {
            $action = sanitize_key($action);
            if (!in_array($action, array('feed', 'observation', 'molt', 'growth'), true) || in_array($action, $quick_actions, true)) {
                continue;
            }
            $quick_actions[] = $action;
            if (count($quick_actions) >= 3) {
                break;
            }
        }

        return array(
            'mode' => in_array($mode, array('photo', 'hybrid', 'data'), true) ? $mode : $defaults['mode'],
            'density' => in_array($density, array('compact', 'standard', 'detailed'), true) ? $density : $defaults['density'],
            'fields' => $fields,
            'quickActions' => $quick_actions,
        );
    }

    private function default_personalization()
    {
        return array(
            'presetId' => 'custom',
            'customized' => false,
            'setupCompleted' => false,
        );
    }

    private function default_care_profile()
    {
        return array(
            'defaults' => array(
                'feedIntervalDays' => 7,
                'observationIntervalDays' => 14,
                'preMoltObservationDays' => 1,
                'postMoltFeedDelayDays' => 3,
                'dueSoonDays' => 3,
                'excludePreMoltFeed' => true,
            ),
            'species' => array(),
            'animals' => array(),
        );
    }

    private function sanitize_care_profile($raw_profile)
    {
        $defaults = $this->default_care_profile();
        $raw_profile = is_array($raw_profile) ? $raw_profile : array();
        $result = array(
            'defaults' => $this->sanitize_care_rules(isset($raw_profile['defaults']) ? $raw_profile['defaults'] : array(), false),
            'species' => array(),
            'animals' => array(),
        );

        foreach (array('species', 'animals') as $scope) {
            $source = isset($raw_profile[$scope]) && is_array($raw_profile[$scope]) ? $raw_profile[$scope] : array();
            foreach (array_slice($source, 0, 250, true) as $key => $rules) {
                $key = substr(sanitize_text_field((string) $key), 0, 160);
                if (!$key || !is_array($rules)) {
                    continue;
                }
                $sanitized = $this->sanitize_care_rules($rules, true);
                if (!empty($sanitized)) {
                    $result[$scope][$key] = $sanitized;
                }
            }
        }

        return $result;
    }

    private function sanitize_care_rules($raw_rules, $partial)
    {
        $raw_rules = is_array($raw_rules) ? $raw_rules : array();
        $ranges = array(
            'feedIntervalDays' => array(1, 365, 7),
            'observationIntervalDays' => array(1, 365, 14),
            'preMoltObservationDays' => array(1, 30, 1),
            'postMoltFeedDelayDays' => array(0, 90, 3),
            'dueSoonDays' => array(1, 30, 3),
        );
        $result = array();
        foreach ($ranges as $key => $range) {
            if ($partial && !array_key_exists($key, $raw_rules)) {
                continue;
            }
            $value = array_key_exists($key, $raw_rules) ? (int) $raw_rules[$key] : $range[2];
            $result[$key] = max($range[0], min($range[1], $value));
        }
        if (!$partial || array_key_exists('excludePreMoltFeed', $raw_rules)) {
            $result['excludePreMoltFeed'] = array_key_exists('excludePreMoltFeed', $raw_rules)
                ? rest_sanitize_boolean($raw_rules['excludePreMoltFeed'])
                : true;
        }
        return $result;
    }

    private function default_enclosure_care_profile()
    {
        return array(
            'defaults' => array(
                'environment' => 1,
                'misting' => 0,
                'watering' => 0,
                'maintenance' => 14,
                'substrate' => 0,
                'dueSoonDays' => 3,
            ),
            'types' => array(),
            'enclosures' => array(),
        );
    }

    private function sanitize_enclosure_care_profile($raw_profile)
    {
        $raw_profile = is_array($raw_profile) ? $raw_profile : array();
        $result = array(
            'defaults' => $this->sanitize_enclosure_care_rules(isset($raw_profile['defaults']) ? $raw_profile['defaults'] : array(), false),
            'types' => array(),
            'enclosures' => array(),
        );
        foreach (array('types', 'enclosures') as $scope) {
            $source = isset($raw_profile[$scope]) && is_array($raw_profile[$scope]) ? $raw_profile[$scope] : array();
            foreach (array_slice($source, 0, 250, true) as $key => $rules) {
                $key = substr(sanitize_text_field((string) $key), 0, 80);
                if (!$key || !is_array($rules)) {
                    continue;
                }
                $sanitized = $this->sanitize_enclosure_care_rules($rules, true);
                if (!empty($sanitized)) {
                    $result[$scope][$key] = $sanitized;
                }
            }
        }
        return $result;
    }

    private function sanitize_enclosure_care_rules($raw_rules, $partial)
    {
        $raw_rules = is_array($raw_rules) ? $raw_rules : array();
        $defaults = array('environment' => 1, 'misting' => 0, 'watering' => 0, 'maintenance' => 14, 'substrate' => 0);
        $result = array();
        foreach ($defaults as $key => $fallback) {
            if ($partial && !array_key_exists($key, $raw_rules)) {
                continue;
            }
            $value = array_key_exists($key, $raw_rules) ? (int) $raw_rules[$key] : $fallback;
            $result[$key] = max(0, min(3650, $value));
        }
        if (!$partial || array_key_exists('dueSoonDays', $raw_rules)) {
            $value = array_key_exists('dueSoonDays', $raw_rules) ? (int) $raw_rules['dueSoonDays'] : 3;
            $result['dueSoonDays'] = max(1, min(30, $value));
        }
        return $result;
    }

    private function default_nursery_care_profile()
    {
        return array(
            'defaults' => array('feed' => 3, 'observation' => 2, 'count' => 7, 'environment' => 1, 'dueSoonDays' => 3),
            'species' => array(),
            'nurseries' => array(),
        );
    }

    private function sanitize_nursery_care_profile($raw_profile)
    {
        $raw_profile = is_array($raw_profile) ? $raw_profile : array();
        $result = array(
            'defaults' => $this->sanitize_nursery_care_rules(isset($raw_profile['defaults']) ? $raw_profile['defaults'] : array(), false),
            'species' => array(),
            'nurseries' => array(),
        );
        foreach (array('species', 'nurseries') as $scope) {
            $source = isset($raw_profile[$scope]) && is_array($raw_profile[$scope]) ? $raw_profile[$scope] : array();
            foreach (array_slice($source, 0, 250, true) as $key => $rules) {
                $key = substr(sanitize_text_field((string) $key), 0, $scope === 'species' ? 160 : 80);
                if (!$key || !is_array($rules)) {
                    continue;
                }
                $sanitized = $this->sanitize_nursery_care_rules($rules, true);
                if (!empty($sanitized)) {
                    $result[$scope][$key] = $sanitized;
                }
            }
        }
        return $result;
    }

    private function sanitize_nursery_care_rules($raw_rules, $partial)
    {
        $raw_rules = is_array($raw_rules) ? $raw_rules : array();
        $defaults = array('feed' => 3, 'observation' => 2, 'count' => 7, 'environment' => 1);
        $result = array();
        foreach ($defaults as $key => $fallback) {
            if ($partial && !array_key_exists($key, $raw_rules)) {
                continue;
            }
            $value = array_key_exists($key, $raw_rules) ? (int) $raw_rules[$key] : $fallback;
            $result[$key] = max(0, min(3650, $value));
        }
        if (!$partial || array_key_exists('dueSoonDays', $raw_rules)) {
            $value = array_key_exists('dueSoonDays', $raw_rules) ? (int) $raw_rules['dueSoonDays'] : 3;
            $result['dueSoonDays'] = max(1, min(30, $value));
        }
        return $result;
    }

    private function sanitize_personalization($raw_personalization)
    {
        $defaults = $this->default_personalization();
        $raw_personalization = is_array($raw_personalization) ? $raw_personalization : array();
        $preset_id = isset($raw_personalization['presetId'])
            ? sanitize_key($raw_personalization['presetId'])
            : $defaults['presetId'];

        return array(
            'presetId' => in_array($preset_id, array('simple', 'collection', 'breeder', 'research', 'custom'), true)
                ? $preset_id
                : $defaults['presetId'],
            'customized' => array_key_exists('customized', $raw_personalization)
                ? rest_sanitize_boolean($raw_personalization['customized'])
                : $defaults['customized'],
            'setupCompleted' => array_key_exists('setupCompleted', $raw_personalization)
                ? rest_sanitize_boolean($raw_personalization['setupCompleted'])
                : $defaults['setupCompleted'],
        );
    }

    private function sanitize_dashboard_sections($raw_sections)
    {
        $sections = array();
        foreach (array_slice((array) $raw_sections, 0, 12) as $section) {
            if (!is_array($section)) {
                continue;
            }
            $id = isset($section['id']) ? sanitize_key($section['id']) : '';
            if (!$id) {
                $id = 'section-' . (count($sections) + 1);
            }
            $widgets = array();
            foreach (array_slice((array) ($section['widgets'] ?? array()), 0, 20) as $widget) {
                $sanitized = $this->sanitize_dashboard_widget($widget);
                if ($sanitized) {
                    $widgets[] = $sanitized;
                }
            }
            $sections[] = array(
                'id' => $id,
                'title' => $this->sanitize_ui_label($section['title'] ?? '', 'セクション', 40),
                'widgets' => $widgets,
            );
        }
        return $sections;
    }

    private function sanitize_dashboard_widget($widget)
    {
        if (!is_array($widget)) {
            return null;
        }
        $allowed_types = array(
            'care_queue', 'smart_animals', 'status_summary', 'feed_due', 'recent_molts',
            'recent_records', 'favorites', 'baby_summary', 'feeder_stock', 'egg_schedule',
            'breeding', 'recent_photos', 'collection_stats', 'growth', 'quick_actions',
        );
        $type = isset($widget['type']) ? sanitize_key($widget['type']) : '';
        if (!in_array($type, $allowed_types, true)) {
            return null;
        }
        $size = isset($widget['size']) ? sanitize_key($widget['size']) : 'medium';
        if (!in_array($size, array('small', 'medium', 'large'), true)) {
            $size = 'medium';
        }
        return array(
            'id' => isset($widget['id']) && sanitize_key($widget['id'])
                ? sanitize_key($widget['id'])
                : 'widget-' . wp_generate_password(8, false, false),
            'type' => $type,
            'title' => $this->sanitize_ui_label($widget['title'] ?? '', $type, 40),
            'size' => $size,
            'config' => $this->sanitize_dashboard_widget_config((array) ($widget['config'] ?? array())),
        );
    }

    private function sanitize_dashboard_widget_config($config)
    {
        $sanitized = array();
        if (isset($config['limit'])) {
            $sanitized['limit'] = min(30, max(1, absint($config['limit'])));
        }
        if (isset($config['days'])) {
            $sanitized['days'] = min(365, max(1, absint($config['days'])));
        }
        if (isset($config['quickAction'])) {
            $action = sanitize_key($config['quickAction']);
            $sanitized['quickAction'] = in_array($action, array('', 'feed', 'observation', 'molt'), true) ? $action : '';
        }
        if (isset($config['display'])) {
            $display = sanitize_key($config['display']);
            $sanitized['display'] = in_array($display, array('compact', 'list'), true) ? $display : 'compact';
        }
        if (isset($config['query']) && is_array($config['query'])) {
            $sanitized['query'] = $this->sanitize_animal_query($config['query']);
        }
        return $sanitized;
    }

    private function sanitize_animal_saved_views($raw_views)
    {
        $views = array();
        foreach (array_slice((array) $raw_views, 0, 30) as $view) {
            if (!is_array($view)) {
                continue;
            }
            $id = isset($view['id']) ? sanitize_key($view['id']) : '';
            if (!$id) {
                $id = 'view-' . wp_generate_password(8, false, false);
            }
            $views[] = array(
                'id' => $id,
                'title' => $this->sanitize_ui_label($view['title'] ?? '', '新しいView', 40),
                'builtin' => false,
                'query' => $this->sanitize_animal_query((array) ($view['query'] ?? array())),
            );
        }
        return $views;
    }

    private function sanitize_animal_query($query)
    {
        $allowed_fields = array(
            'id', 'code', 'species_id', 'species_name', 'classification', 'status',
            'gender', 'instar', 'is_favorite', 'days_since_feed', 'days_since_molt', 'acquired_date',
        );
        $allowed_operators = array('=', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'in', 'exists');
        $filters = array();
        foreach (array_slice((array) ($query['filters'] ?? array()), 0, 12) as $filter) {
            if (!is_array($filter)) {
                continue;
            }
            $field = isset($filter['field']) ? sanitize_key($filter['field']) : '';
            $operator = isset($filter['operator']) ? sanitize_text_field($filter['operator']) : '=';
            if (!in_array($field, $allowed_fields, true) || !in_array($operator, $allowed_operators, true)) {
                continue;
            }
            $value = $filter['value'] ?? '';
            if (is_array($value)) {
                $value = array_map('sanitize_text_field', array_slice($value, 0, 30));
            } elseif (is_bool($value)) {
                $value = $value;
            } elseif (is_numeric($value)) {
                $value = 0 + $value;
            } else {
                $value = sanitize_text_field($value);
            }
            $filters[] = array('field' => $field, 'operator' => $operator, 'value' => $value);
        }
        $sort = is_array($query['sort'] ?? null) ? $query['sort'] : array();
        $sort_field = isset($sort['field']) ? sanitize_key($sort['field']) : 'code';
        if (!in_array($sort_field, $allowed_fields, true)) {
            $sort_field = 'code';
        }
        $direction = isset($sort['direction']) && $sort['direction'] === 'desc' ? 'desc' : 'asc';
        $sanitized = array(
            'filters' => $filters,
            'sort' => array('field' => $sort_field, 'direction' => $direction),
        );
        if (isset($query['limit'])) {
            $sanitized['limit'] = min(30, max(0, absint($query['limit'])));
        }
        return $sanitized;
    }

    private function sanitize_ui_label($value, $fallback, $limit)
    {
        $value = sanitize_text_field($value);
        if (!$value) {
            return $fallback;
        }
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit * 3);
    }
}
