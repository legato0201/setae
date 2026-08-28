<?php

/**
 * REST endpoints for PWA notification subscriptions and preferences.
 */
class Setae_API_PWA
{
    public function register_routes()
    {
        register_rest_route('setae/v1', '/pwa/config', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_config'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/pwa/subscriptions', array(
            array(
                'methods' => 'POST',
                'callback' => array($this, 'save_subscription'),
                'permission_callback' => array($this, 'can_use_notifications'),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array($this, 'delete_subscription'),
                'permission_callback' => array($this, 'can_use_notifications'),
            ),
        ));

        register_rest_route('setae/v1', '/pwa/preferences', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'get_preferences'),
                'permission_callback' => array($this, 'can_use_notifications'),
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'save_preferences'),
                'permission_callback' => array($this, 'can_use_notifications'),
            ),
        ));

        register_rest_route('setae/v1', '/pwa/test', array(
            'methods' => 'POST',
            'callback' => array($this, 'send_test'),
            'permission_callback' => array($this, 'can_use_notifications'),
        ));
    }

    public function can_use_notifications()
    {
        return is_user_logged_in() && current_user_can('read');
    }

    public function get_config()
    {
        $user_id = get_current_user_id();
        $subscriptions = $user_id ? Setae_PWA::get_subscriptions($user_id) : array();

        return new WP_REST_Response(array(
            'configured' => Setae_PWA::is_configured(),
            'public_key' => Setae_PWA::get_vapid_public_key(),
            'authenticated' => (bool) $user_id,
            'subscribed_devices' => count($subscriptions),
            'preferences' => $user_id ? Setae_PWA::get_preferences($user_id) : null,
        ), 200);
    }

    public function save_subscription($request)
    {
        if (!Setae_PWA::is_configured()) {
            return new WP_Error(
                'push_not_configured',
                '通知サーバーがまだ設定されていません。',
                array('status' => 503)
            );
        }

        $params = $request->get_json_params();
        $subscription = isset($params['subscription']) && is_array($params['subscription'])
            ? $params['subscription']
            : $params;
        $endpoint = isset($subscription['endpoint']) ? esc_url_raw($subscription['endpoint']) : '';
        $keys = isset($subscription['keys']) && is_array($subscription['keys']) ? $subscription['keys'] : array();
        $p256dh = isset($keys['p256dh']) ? sanitize_text_field($keys['p256dh']) : '';
        $auth = isset($keys['auth']) ? sanitize_text_field($keys['auth']) : '';

        if (
            !$endpoint
            || strpos($endpoint, 'https://') !== 0
            || !wp_http_validate_url($endpoint)
            || strlen($endpoint) > 2048
            || !$this->is_base64url($p256dh, 32, 256)
            || !$this->is_base64url($auth, 8, 128)
        ) {
            return new WP_Error('invalid_subscription', '通知端末の情報が正しくありません。', array('status' => 400));
        }

        $user_id = get_current_user_id();
        $items = Setae_PWA::get_subscriptions($user_id);
        $endpoint_hash = hash('sha256', $endpoint);
        $device_name = !empty($params['device_name'])
            ? sanitize_text_field(wp_unslash($params['device_name']))
            : 'ブラウザ';
        $device_name = mb_substr($device_name, 0, 80);
        $content_encoding = !empty($subscription['contentEncoding'])
            ? sanitize_key($subscription['contentEncoding'])
            : 'aes128gcm';
        if (!in_array($content_encoding, array('aes128gcm', 'aesgcm'), true)) {
            $content_encoding = 'aes128gcm';
        }
        $new_item = array(
            'id' => $endpoint_hash,
            'endpoint' => $endpoint,
            'keys' => array(
                'p256dh' => $p256dh,
                'auth' => $auth,
            ),
            'contentEncoding' => $content_encoding,
            'device_name' => $device_name,
            'created_at' => current_time('mysql', true),
            'last_seen_at' => current_time('mysql', true),
        );

        $replaced = false;
        foreach ($items as $index => $item) {
            if (!empty($item['id']) && hash_equals((string) $item['id'], $endpoint_hash)) {
                $new_item['created_at'] = !empty($item['created_at']) ? $item['created_at'] : $new_item['created_at'];
                $items[$index] = $new_item;
                $replaced = true;
                break;
            }
        }
        if (!$replaced) {
            $items[] = $new_item;
        }

        usort($items, function ($a, $b) {
            return strcmp((string) ($b['last_seen_at'] ?? ''), (string) ($a['last_seen_at'] ?? ''));
        });
        $items = array_slice($items, 0, 8);
        update_user_meta($user_id, Setae_PWA::SUBSCRIPTIONS_META, $items);

        $preferences = Setae_PWA::get_preferences($user_id);
        $preferences['enabled'] = true;
        if (!empty($params['timezone'])) {
            $timezone = sanitize_text_field($params['timezone']);
            if (in_array($timezone, timezone_identifiers_list(), true)) {
                $preferences['timezone'] = $timezone;
            }
        }
        update_user_meta($user_id, Setae_PWA::PREFERENCES_META, $preferences);

        return new WP_REST_Response(array(
            'success' => true,
            'subscribed_devices' => count($items),
            'preferences' => $preferences,
        ), 201);
    }

    public function delete_subscription($request)
    {
        $params = $request->get_json_params();
        if (!is_array($params) || !$params) {
            $params = $request->get_params();
        }
        $endpoint = isset($params['endpoint']) ? esc_url_raw($params['endpoint']) : '';
        if (!$endpoint) {
            return new WP_Error('missing_endpoint', '解除する端末を特定できません。', array('status' => 400));
        }

        $user_id = get_current_user_id();
        $endpoint_hash = hash('sha256', $endpoint);
        $items = array_values(array_filter(
            Setae_PWA::get_subscriptions($user_id),
            function ($item) use ($endpoint_hash) {
                return empty($item['id']) || !hash_equals((string) $item['id'], $endpoint_hash);
            }
        ));
        update_user_meta($user_id, Setae_PWA::SUBSCRIPTIONS_META, $items);

        return new WP_REST_Response(array(
            'success' => true,
            'subscribed_devices' => count($items),
        ), 200);
    }

    public function get_preferences()
    {
        return new WP_REST_Response(array(
            'preferences' => Setae_PWA::get_preferences(get_current_user_id()),
            'subscribed_devices' => count(Setae_PWA::get_subscriptions(get_current_user_id())),
        ), 200);
    }

    public function save_preferences($request)
    {
        $params = $request->get_json_params();
        if (!is_array($params)) {
            $params = $request->get_params();
        }

        $preferences = Setae_PWA::get_preferences(get_current_user_id());
        foreach (array('enabled', 'care_reminders', 'community_messages') as $key) {
            if (array_key_exists($key, $params)) {
                $preferences[$key] = rest_sanitize_boolean($params[$key]);
            }
        }
        if (array_key_exists('care_hour', $params)) {
            $preferences['care_hour'] = min(23, max(0, absint($params['care_hour'])));
        }
        if (array_key_exists('care_minute', $params)) {
            $minute = min(55, max(0, absint($params['care_minute'])));
            $preferences['care_minute'] = (int) (floor($minute / 5) * 5);
        }
        if (!empty($params['timezone'])) {
            $timezone = sanitize_text_field($params['timezone']);
            if (in_array($timezone, timezone_identifiers_list(), true)) {
                $preferences['timezone'] = $timezone;
            }
        }

        update_user_meta(get_current_user_id(), Setae_PWA::PREFERENCES_META, $preferences);
        return new WP_REST_Response(array(
            'success' => true,
            'preferences' => $preferences,
        ), 200);
    }

    public function send_test()
    {
        $user_id = get_current_user_id();
        $last_test = (int) get_user_meta($user_id, '_setae_push_last_test', true);
        if ($last_test && (time() - $last_test) < 30) {
            return new WP_Error('rate_limit', 'テスト通知は30秒空けてください。', array('status' => 429));
        }

        update_user_meta($user_id, '_setae_push_last_test', time());
        $sent = Setae_PWA::send_to_user($user_id, array(
            'title' => 'SETAEの通知テスト',
            'body' => '通知の準備ができました。飼育リマインダーと相談の返信を受け取れます。',
            'url' => home_url('/'),
            'tag' => 'setae-test',
            'badgeCount' => 1,
            'data' => array('type' => 'test'),
        ), array(
            'TTL' => 300,
            'urgency' => 'normal',
            'topic' => 'test',
        ));

        if (!$sent) {
            return new WP_Error('push_failed', '通知を送信できませんでした。購読状態を確認してください。', array('status' => 500));
        }

        return new WP_REST_Response(array('success' => true), 200);
    }

    private function is_base64url($value, $min_length, $max_length)
    {
        $length = strlen((string) $value);
        return $length >= $min_length
            && $length <= $max_length
            && (bool) preg_match('/^[A-Za-z0-9_-]+={0,2}$/', (string) $value);
    }
}
