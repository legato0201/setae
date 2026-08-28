<?php

require_once __DIR__ . '/class-setae-product-event-catalog.php';

/** Private, append-only product measurements. Never a business transaction gate. */
class Setae_Product_Events
{
    const SCHEMA_VERSION = '1.0.0';
    const SCHEMA_OPTION = 'setae_product_events_schema_version';
    const STARTED_OPTION = 'setae_product_events_started_at';
    const ANONYMOUS_COOKIE = 'setae_product_anonymous_id';
    const SESSION_COOKIE = 'setae_product_session_id';

    public static function table()
    {
        global $wpdb;
        return $wpdb->prefix . 'setae_product_events';
    }

    public static function maybe_upgrade()
    {
        return get_option(self::SCHEMA_OPTION) === self::SCHEMA_VERSION ? true : self::install_schema();
    }

    public static function install_schema()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            idempotency_key varchar(80) NOT NULL,
            event_name varchar(64) NOT NULL,
            event_origin varchar(12) NOT NULL DEFAULT 'client',
            user_id bigint(20) unsigned NULL,
            anonymous_id varchar(64) NOT NULL DEFAULT '',
            session_id varchar(64) NOT NULL DEFAULT '',
            acquisition_source varchar(64) NOT NULL DEFAULT '',
            partner_user_id bigint(20) unsigned NULL,
            object_type varchar(32) NOT NULL DEFAULT '',
            object_id bigint(20) unsigned NULL,
            path varchar(255) NOT NULL DEFAULT '',
            plan_id varchar(40) NOT NULL DEFAULT '',
            app_version varchar(24) NOT NULL DEFAULT '',
            properties longtext NULL,
            occurred_at datetime NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY idempotency_key (idempotency_key),
            KEY event_time (event_name,occurred_at),
            KEY origin_event_time (event_origin,event_name,occurred_at),
            KEY user_time (user_id,occurred_at),
            KEY source_time (acquisition_source,occurred_at),
            KEY partner_time (partner_user_id,occurred_at)
        ) $charset;");
        $found = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table)));
        if ($found !== $table) {
            return self::storage_error();
        }
        update_option(self::SCHEMA_OPTION, self::SCHEMA_VERSION, false);
        if (!get_option(self::STARTED_OPTION)) {
            update_option(self::STARTED_OPTION, gmdate('Y-m-d H:i:s'), false);
        }
        return true;
    }

    /** Context is supplied by trusted business code, never copied from a REST body. */
    public static function record($event_name, array $context = array())
    {
        try {
            return self::write($event_name, $context, 'server');
        } catch (Throwable $error) {
            return self::storage_error();
        }
    }

    /** Compatibility for old Ajax callers; this is NOT an authoritative server event. */
    public static function record_legacy($event_name)
    {
        return self::record_client(array('event' => is_string($event_name) ? sanitize_key($event_name) : ''));
    }

    public static function record_client($data, $request = null)
    {
        try {
            if (!is_array($data) || ($request && method_exists($request, 'get_body') && strlen($request->get_body()) > 16384)) {
                return new WP_Error('setae_event_body_limit', 'イベントが上限を超えています。', array('status' => 413));
            }
            $event = isset($data['event']) && is_string($data['event']) ? $data['event'] : '';
            if (!Setae_Product_Event_Catalog::is_allowed($event, 'client')) {
                return new WP_Error($event ? 'invalid_event' : 'missing_event', '許可されていないイベントです。', array('status' => 400));
            }
            $origin = $request && method_exists($request, 'get_header') ? $request->get_header('origin') : ($_SERVER['HTTP_ORIGIN'] ?? '');
            $site = $request && method_exists($request, 'get_header') ? $request->get_header('sec-fetch-site') : ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '');
            if ($site === 'cross-site' || ($origin && !self::same_origin($origin, home_url('/')))) {
                return new WP_Error('setae_event_origin', 'この送信元からは計測できません。', array('status' => 403));
            }
            $user_id = get_current_user_id();
            $rate = Setae_App_Operations::consume_request_limit('product_events', $user_id ? 240 : 60, 60);
            if (is_wp_error($rate)) {
                return $rate;
            }
            $payload = isset($data['payload']) ? $data['payload'] : array();
            $properties = Setae_Product_Event_Catalog::properties($event, $payload);
            if (is_wp_error($properties)) {
                return $properties;
            }
            $payload = (array) $payload;
            $trusted = self::resolve_context(isset($payload['context_token']) ? $payload['context_token'] : '');
            if (is_wp_error($trusted)) {
                return $trusted;
            }
            $event_id = isset($data['event_id']) && $data['event_id'] !== '' ? self::uuid($data['event_id']) : wp_generate_uuid4();
            $anonymous = self::identity($data, 'anonymous_id', self::ANONYMOUS_COOKIE);
            $session = self::identity($data, 'session_id', self::SESSION_COOKIE);
            if (!$event_id || is_wp_error($anonymous) || is_wp_error($session)) {
                return new WP_Error('setae_event_identity', 'イベント識別子が不正です。', array('status' => 400));
            }
            $surface = isset($trusted['surface']) ? $trusted['surface'] : self::event_surface($event);
            $source = !empty($trusted['source']) ? $trusted['source'] : self::source_for_user($user_id, $surface);
            // A client property cannot override attribution, actor, plan, object or version.
            unset($properties['source']);
            $context = array(
                'idempotency_key' => 'client:' . $event_id,
                'user_id' => $user_id,
                'anonymous_id' => $anonymous,
                'session_id' => $session,
                'acquisition_source' => $source,
                'surface' => $surface,
                'properties' => $properties,
                'object_type' => isset($trusted['object_type']) ? $trusted['object_type'] : '',
                'object_id' => isset($trusted['object_id']) ? $trusted['object_id'] : 0,
            );
            if (isset($trusted['partner_user_id'])) {
                $context['partner_user_id'] = $trusted['partner_user_id'];
            }
            if ($event === 'app_session_started') {
                if (!$user_id || !$session) {
                    return new WP_Error('setae_event_session', 'ログインとセッション識別子が必要です。', array('status' => 403));
                }
                $context['idempotency_key'] = 'client-session:' . hash('sha256', $user_id . '|' . $session);
            }
            return self::write($event, $context, 'client');
        } catch (Throwable $error) {
            return self::storage_error();
        }
    }

    private static function write($event, array $context, $origin)
    {
        global $wpdb;
        if (!is_string($event) || !Setae_Product_Event_Catalog::is_allowed($event, $origin)) {
            return new WP_Error('invalid_event', '許可されていないイベントです。', array('status' => 400));
        }
        $user_id = self::positive_id(isset($context['user_id']) ? $context['user_id'] : get_current_user_id());
        if ($origin === 'server' && !$user_id && in_array($event, Setae_Product_Event_Catalog::server_events(), true)) {
            return new WP_Error('setae_event_user', '対象の利用者が必要です。', array('status' => 400));
        }
        $key = isset($context['idempotency_key']) ? $context['idempotency_key'] : '';
        if ($origin === 'server' && $event === 'first_record_created' && $user_id) {
            $key = 'first-record:' . $user_id;
        }
        if (!is_string($key) || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,79}$/D', $key)
            || ($origin === 'server' && strpos($key, 'client') === 0)) {
            return new WP_Error('setae_event_key', '業務イベントの識別子が必要です。', array('status' => 400));
        }
        $properties = Setae_Product_Event_Catalog::properties($event, isset($context['properties']) ? $context['properties'] : array());
        if (is_wp_error($properties)) {
            return $properties;
        }
        $object_type = isset($context['object_type']) && in_array($context['object_type'], array('spider', 'baby_group', 'log', 'transfer', 'label', 'subscription'), true)
            ? $context['object_type'] : '';
        $object_id = self::positive_id(isset($context['object_id']) ? $context['object_id'] : 0);
        if ($origin === 'server' && $event === 'first_record_created') {
            if ($object_type === 'log' && $object_id) {
                $properties['record_id'] = $object_id;
                $object_id = self::positive_id(get_post_meta($object_id, '_setae_log_spider_id', true));
                $object_type = 'spider';
            }
            $post = $object_id ? get_post($object_id) : null;
            $expected_type = $object_type === 'spider' ? 'setae_spider' : 'setae_baby_group';
            if (!$user_id || !in_array($object_type, array('spider', 'baby_group'), true)
                || !$post || $post->post_type !== $expected_type || (int) $post->post_author !== $user_id) {
                return new WP_Error('setae_event_subject', '記録対象を確認できません。', array('status' => 400));
            }
        }
        $source = isset($context['acquisition_source']) ? Setae_Product_Event_Catalog::source($context['acquisition_source']) : self::source_for_user($user_id);
        $partner_id = self::positive_id(array_key_exists('partner_user_id', $context) ? $context['partner_user_id']
            : ($user_id ? get_user_meta($user_id, '_setae_referred_by_user_id', true) : 0));
        if ($partner_id && !get_userdata($partner_id)) {
            $partner_id = 0;
        }
        $anonymous = self::identity($context, 'anonymous_id', self::ANONYMOUS_COOKIE);
        $session = self::identity($context, 'session_id', self::SESSION_COOKIE);
        if (is_wp_error($anonymous) || is_wp_error($session)) {
            return new WP_Error('setae_event_identity', 'イベント識別子が不正です。', array('status' => 400));
        }
        $plan = $user_id && class_exists('Setae_Entitlements') ? Setae_Entitlements::get_plan_id($user_id) : 'keeper_free';
        $plan = in_array($plan, array('keeper_free', 'breeder_trial', 'breeder_starter', 'legacy_premium'), true) ? $plan : 'keeper_free';
        $now = gmdate('Y-m-d H:i:s');
        $row = array(
            'idempotency_key' => $key, 'event_name' => $event, 'event_origin' => $origin,
            'user_id' => $user_id ?: null, 'anonymous_id' => $anonymous, 'session_id' => $session,
            'acquisition_source' => $source, 'partner_user_id' => $partner_id ?: null,
            'object_type' => $object_type, 'object_id' => $object_id ?: null,
            'path' => self::canonical_path(isset($context['surface']) ? $context['surface'] : self::event_surface($event)),
            'plan_id' => $plan, 'app_version' => defined('SETAE_VERSION') ? substr(SETAE_VERSION, 0, 24) : '',
            'properties' => wp_json_encode($properties), 'occurred_at' => $now, 'created_at' => $now,
        );
        $placeholders = array();
        $values = array();
        foreach ($row as $column => $value) {
            if ($value === null) {
                $placeholders[] = 'NULL';
            } else {
                $placeholders[] = is_int($value) ? '%d' : '%s';
                $values[] = $value;
            }
        }
        // All values are bounded/typed above. A unique key makes concurrent retries atomic.
        $sql = 'INSERT IGNORE INTO ' . self::table() . ' (' . implode(',', array_keys($row)) . ') VALUES (' . implode(',', $placeholders) . ')';
        $written = $wpdb->query($wpdb->prepare($sql, $values));
        if ($written === false) {
            return self::storage_error();
        }
        $duplicate = $written === 0;
        if ($origin === 'server' && $event === 'first_record_created'
            && !get_user_meta($user_id, '_setae_first_record_created_at', true)) {
            $first_at = $duplicate ? $wpdb->get_var($wpdb->prepare(
                'SELECT occurred_at FROM ' . self::table() . ' WHERE idempotency_key = %s', $key)) : $now;
            $timestamp = $first_at ? strtotime($first_at . ' UTC') : false;
            if ($timestamp !== false) {
                update_user_meta($user_id, '_setae_first_record_created_at', $timestamp);
            }
        }
        $count = null;
        // One-release compatibility only. Authoritative server events do not double-count
        // the existing legacy call made by registration/email verification operations.
        if ($origin === 'client' && in_array($event, Setae_Product_Event_Catalog::legacy_events(), true)) {
            $day = 'setae_metrics_' . gmdate('Ymd');
            $metrics = get_option($day, array());
            $metrics = is_array($metrics) ? $metrics : array();
            if (!$duplicate) {
                $metrics[$event] = isset($metrics[$event]) ? (int) $metrics[$event] + 1 : 1;
                update_option($day, $metrics, false);
            }
            $count = isset($metrics[$event]) ? (int) $metrics[$event] : 0;
        }
        return array('event' => $event, 'accepted' => true, 'duplicate' => $duplicate, 'count' => $count);
    }

    /** Signed context contains no user ID, email, QR code, URL or private text. */
    public static function public_config($surface, array $context = array())
    {
        $surface = in_array($surface, array('home', 'partner', 'passport', 'profile', 'care'), true) ? $surface : 'home';
        $claims = array('surface' => $surface, 'expires' => time() + DAY_IN_SECONDS);
        if ($surface === 'passport' && isset($context['object_type']) && $context['object_type'] === 'spider') {
            $claims['object_id'] = self::positive_id(isset($context['object_id']) ? $context['object_id'] : 0);
        } elseif (!empty($context['partner_user_id'])) {
            $code = (string) get_user_meta(self::positive_id($context['partner_user_id']), '_setae_referral_code', true);
            if (strlen($code) <= 192 && preg_match('/^[\p{L}\p{N}_-]+$/uD', $code)) {
                $claims['referral'] = $code;
            }
        }
        $encoded = rtrim(strtr(base64_encode(wp_json_encode($claims)), '+/', '-_'), '=');
        return array('endpoint' => rest_url('setae/v1/metrics/events'), 'nonce' => wp_create_nonce('wp_rest'),
            'surface' => $surface, 'path' => self::canonical_path($surface),
            'context_token' => $encoded . '.' . hash_hmac('sha256', $encoded, wp_salt('auth')));
    }

    private static function resolve_context($token)
    {
        if ($token === '') {
            return array();
        }
        if (!is_string($token) || strlen($token) > 1024 || substr_count($token, '.') !== 1) {
            return new WP_Error('setae_event_context', '計測の文脈を確認できません。', array('status' => 400));
        }
        list($encoded, $signature) = explode('.', $token, 2);
        if (!hash_equals(hash_hmac('sha256', $encoded, wp_salt('auth')), $signature)) {
            return new WP_Error('setae_event_context', '計測の文脈を確認できません。', array('status' => 400));
        }
        $claims = json_decode(base64_decode(strtr($encoded, '-_', '+/'), true), true);
        if (!is_array($claims) || !isset($claims['expires'], $claims['surface']) || $claims['expires'] < time()
            || $claims['expires'] > time() + DAY_IN_SECONDS + 60) {
            return new WP_Error('setae_event_context_expired', '計測の文脈の有効期限が切れています。', array('status' => 400));
        }
        $surface = $claims['surface'];
        $context = array('surface' => $surface, 'source' => self::surface_source($surface));
        if ($surface === 'passport' && !empty($claims['object_id'])) {
            $id = self::positive_id($claims['object_id']);
            $post = get_post($id);
            if ($post && $post->post_type === 'setae_spider' && class_exists('Setae_QR_Manager')
                && (Setae_QR_Manager::get_spider_public_mode($id) !== 'private'
                    || get_post_meta($id, Setae_QR_Manager::TRANSFER_ENABLED_META, true) === '1')) {
                $context['object_type'] = 'spider';
                $context['object_id'] = $id;
                $context['partner_user_id'] = (int) $post->post_author;
            }
        } elseif (!empty($claims['referral'])) {
            $users = get_users(array('meta_key' => '_setae_referral_code', 'meta_value' => $claims['referral'], 'number' => 1, 'fields' => 'ids'));
            $context['partner_user_id'] = $users ? self::positive_id(reset($users)) : 0;
        }
        return $context;
    }

    private static function identity($data, $key, $cookie)
    {
        $explicit = isset($data[$key]);
        $value = $explicit ? $data[$key] : (isset($_COOKIE[$cookie]) ? $_COOKIE[$cookie] : '');
        if ($value === '') {
            return '';
        }
        $id = self::uuid($value);
        if (!$explicit && !$id) {
            return '';
        }
        return $id ?: new WP_Error('setae_event_identity', 'イベント識別子が不正です。', array('status' => 400));
    }

    public static function uuid($value)
    {
        return is_string($value) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iD', $value) ? strtolower($value) : '';
    }

    private static function positive_id($value)
    {
        return (is_int($value) || (is_string($value) && ctype_digit($value))) && (int) $value > 0 ? (int) $value : 0;
    }

    private static function source_for_user($user_id, $surface = '')
    {
        $source = $user_id ? Setae_Product_Event_Catalog::source(get_user_meta($user_id, '_setae_registration_source', true)) : 'unknown';
        return $source === 'unknown' && $surface ? self::surface_source($surface) : $source;
    }

    private static function surface_source($surface)
    {
        $sources = array('home' => 'public_home', 'partner' => 'public_partner', 'passport' => 'public_passport',
            'profile' => 'public_profile', 'care' => 'public_care', 'app' => 'app');
        return isset($sources[$surface]) ? $sources[$surface] : 'unknown';
    }

    private static function event_surface($event)
    {
        if (strpos($event, 'passport') !== false || $event === 'claim_cta_clicked') return 'passport';
        if (strpos($event, 'partner') !== false) return 'partner';
        if (strpos($event, 'public_home') !== false) return 'home';
        if (strpos($event, 'profile') !== false) return 'profile';
        if (strpos($event, 'care_share') === 0) return 'care';
        return 'app';
    }

    private static function canonical_path($surface)
    {
        $paths = array('home' => '/', 'partner' => '/partner/', 'passport' => '/s/:code/',
            'profile' => '/setae-user/:ref/', 'care' => '/care/:id/', 'app' => '/app/');
        return isset($paths[$surface]) ? $paths[$surface] : '/app/';
    }

    private static function same_origin($left, $right)
    {
        $a = wp_parse_url($left);
        $b = wp_parse_url($right);
        return is_array($a) && is_array($b) && !isset($a['user']) && !isset($a['pass'])
            && strtolower($a['scheme'] ?? '') === strtolower($b['scheme'] ?? '')
            && strtolower($a['host'] ?? '') === strtolower($b['host'] ?? '')
            && (int) ($a['port'] ?? 0) === (int) ($b['port'] ?? 0);
    }

    private static function storage_error()
    {
        return new WP_Error('setae_event_unavailable', '計測を保存できませんでした。', array('status' => 503));
    }
}
