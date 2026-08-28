<?php

/** Connect a single-use email verification to an explicitly requested Passport claim. */
class Setae_Claim_Registration
{
    const RETURN_CODE_META = '_setae_verification_claim_code';
    const RETURN_URL_META = '_setae_registration_return_url';

    /** Only this explicit in-app confirmation destination is accepted, never arbitrary redirects. */
    public static function store_return_url($user_id, $url)
    {
        $allowed = add_query_arg('setae_plan', 'breeder_trial', Setae_App_Shell::app_url());
        if (is_string($url) && $url === $allowed) {
            update_user_meta(absint($user_id), self::RETURN_URL_META, $allowed);
            return true;
        }
        return false;
    }

    private static function app_return_url($user_id)
    {
        $allowed = add_query_arg('setae_plan', 'breeder_trial', Setae_App_Shell::app_url());
        return get_user_meta($user_id, self::RETURN_URL_META, true) === $allowed ? $allowed : Setae_App_Shell::app_url();
    }

    /** Returns a token-free local URL; only a freshly consumed token may establish a session. */
    public static function verification_redirect($user_id, $token)
    {
        $limited = Setae_App_Operations::consume_request_limit('email_verification', 20, HOUR_IN_SECONDS);
        if (is_wp_error($limited)) {
            return self::verification_error_url('verification_unavailable');
        }
        $result = Setae_App_Operations::verify_email($user_id, $token);
        if (is_wp_error($result)) {
            return self::verification_error_url($result->get_error_code());
        }
        $user_id = absint($user_id);
        if (empty($result['token_consumed']) || !empty($result['already_verified'])) {
            // An arbitrary token on an already-verified account cannot authenticate or submit anything.
            return get_current_user_id() === $user_id
                ? self::existing_session_url($user_id)
                : add_query_arg('verified', '1', Setae_App_Shell::login_url());
        }

        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, false, is_ssl());
        $user = get_userdata($user_id);
        do_action('wp_login', $user->user_login, $user);

        $code = Setae_QR_Manager::get_pending_claim($user_id);
        if (!$code) {
            return add_query_arg('verified', '1', self::app_return_url($user_id));
        }
        update_user_meta($user_id, self::RETURN_CODE_META, $code);
        if (!Setae_QR_Manager::pending_claim_has_intent($user_id)) {
            return add_query_arg(array('verified' => '1', 'claim' => '1'), Setae_QR_Manager::get_short_url($code));
        }

        // Request only: approval and transfer remain exclusively in the existing owner workflow.
        $claim = Setae_QR_Manager::request_pending_claim($user_id);
        if (is_wp_error($claim)) {
            return add_query_arg(array(
                'verified' => '1',
                'claim_error' => self::claim_error_code($claim->get_error_code()),
            ), Setae_QR_Manager::get_short_url($code));
        }
        return add_query_arg(array('verified' => '1', 'requested' => '1'), Setae_QR_Manager::get_short_url($code));
    }

    /** A revisit may show the existing state only when the browser already belongs to that user. */
    private static function existing_session_url($user_id)
    {
        $code = Setae_QR_Manager::sanitize_code(get_user_meta($user_id, self::RETURN_CODE_META, true));
        if (!$code) {
            return add_query_arg('verified', '1', self::app_return_url($user_id));
        }
        $query = array('verified' => '1');
        $target = Setae_QR_Manager::get_target_by_code($code);
        if ($target && Setae_QR_Manager::has_pending_transfer($target->ID, $user_id)) {
            $query['requested'] = '1';
        }
        return add_query_arg($query, Setae_QR_Manager::get_short_url($code));
    }

    private static function verification_error_url($code)
    {
        $safe_code = $code === 'verification_unavailable' ? $code : 'invalid_verification';
        return add_query_arg('verification_error', $safe_code, Setae_App_Shell::login_url());
    }

    private static function claim_error_code($code)
    {
        if ($code === 'qr_transfer_same_owner') {
            return 'claim_already_owned';
        }
        return in_array($code, array('qr_transfer_closed', 'qr_transfer_archived'), true)
            ? 'claim_closed' : 'claim_unavailable';
    }

    /** No token, email, password or public display name is placed in product events. */
    public static function record_account_event($name, $user_id)
    {
        if (!class_exists('Setae_Product_Events') || !in_array($name, array('registration_submitted', 'email_verified'), true)) {
            return;
        }
        $source = (string) get_user_meta($user_id, '_setae_registration_source', true);
        $allowed = array('public_home', 'public_partner', 'public_passport', 'public_profile', 'public_care', 'app', 'qr', 'manual', 'nursery_promotion', 'offline', 'import');
        $source = $source === 'public_care_share' ? 'public_care' : $source;
        $source = in_array($source, $allowed, true) ? $source : 'unknown';
        $partner_id = absint(get_user_meta($user_id, '_setae_referred_by_user_id', true));
        $code = Setae_QR_Manager::get_pending_claim($user_id);
        $target = $code ? Setae_QR_Manager::get_target_by_code($code) : null;
        if ($target) {
            $partner_id = (int) $target->post_author;
            $source = 'public_passport';
        }
        Setae_Entitlements::record_event($name, array(
            'idempotency_key' => ($name === 'email_verified' ? 'verified:' : 'registration:') . absint($user_id),
            'user_id' => absint($user_id),
            'partner_user_id' => $partner_id,
            'acquisition_source' => $source,
            'properties' => array('source' => $source),
        ));
    }
}
