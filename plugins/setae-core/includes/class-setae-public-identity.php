<?php

/**
 * Provides a stable public handle that is independent from WordPress credentials.
 */
class Setae_Public_Identity
{
    const META_KEY = '_setae_public_handle';
    const PREFIX = 'st_';
    const BODY_LENGTH = 10;
    const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

    public static function render_brand($url = '')
    {
        $url = $url ?: home_url('/');
        return '<a class="setae-brand setae-brand-lockup" href="' . esc_url($url) . '" aria-label="SETAE">'
            . '<span class="setae-brand-icon" aria-hidden="true"></span>'
            . '<span class="setae-brand-copy"><strong class="setae-brand-title">SETAE</strong>'
            . '<small class="setae-brand-subtitle">Living Collection</small></span></a>';
    }

    /**
     * Return a public handle, creating one when necessary.
     */
    public static function get_handle($user_id, $create = true)
    {
        $user_id = absint($user_id);
        if (!$user_id || !get_userdata($user_id)) {
            return '';
        }

        $stored = self::normalize_handle(get_user_meta($user_id, self::META_KEY, true));
        if ($stored) {
            return $stored;
        }

        if (!$create) {
            return '';
        }

        $handle = self::generate_unique_handle($user_id);
        if (!$handle) {
            return '';
        }

        update_user_meta($user_id, self::META_KEY, $handle);
        return $handle;
    }

    /**
     * Hook target for newly registered users.
     */
    public function ensure_for_user($user_id)
    {
        self::get_handle($user_id, true);
    }

    private static function normalize_handle($value)
    {
        $handle = strtolower(sanitize_key((string) $value));
        if (strlen($handle) !== strlen(self::PREFIX) + self::BODY_LENGTH) {
            return '';
        }

        if (strpos($handle, self::PREFIX) !== 0) {
            return '';
        }

        $body = substr($handle, strlen(self::PREFIX));
        if (strlen($body) !== self::BODY_LENGTH || strspn($body, self::ALPHABET) !== self::BODY_LENGTH) {
            return '';
        }

        return $handle;
    }

    private static function generate_unique_handle($user_id)
    {
        $alphabet_length = strlen(self::ALPHABET);

        for ($attempt = 0; $attempt < 24; $attempt++) {
            $body = '';
            try {
                for ($index = 0; $index < self::BODY_LENGTH; $index++) {
                    $body .= self::ALPHABET[random_int(0, $alphabet_length - 1)];
                }
            } catch (Exception $exception) {
                return self::generate_fallback_handle($user_id);
            }

            $candidate = self::PREFIX . $body;
            if (!self::handle_exists($candidate, $user_id)) {
                return $candidate;
            }
        }

        return self::generate_fallback_handle($user_id);
    }

    private static function generate_fallback_handle($user_id)
    {
        $alphabet_length = strlen(self::ALPHABET);

        for ($attempt = 0; $attempt < 24; $attempt++) {
            $seed = hash(
                'sha256',
                wp_salt('auth') . '|' . absint($user_id) . '|' . microtime(true) . '|' . $attempt,
                true
            );
            $body = '';
            for ($index = 0; $index < self::BODY_LENGTH; $index++) {
                $body .= self::ALPHABET[ord($seed[$index]) % $alphabet_length];
            }

            $candidate = self::PREFIX . $body;
            if (!self::handle_exists($candidate, $user_id)) {
                return $candidate;
            }
        }

        return '';
    }

    private static function handle_exists($handle, $exclude_user_id)
    {
        global $wpdb;

        $owner_id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT user_id
             FROM {$wpdb->usermeta}
             WHERE meta_key = %s AND meta_value = %s
             LIMIT 1",
            self::META_KEY,
            $handle
        ));

        return $owner_id && $owner_id !== absint($exclude_user_id);
    }
}
