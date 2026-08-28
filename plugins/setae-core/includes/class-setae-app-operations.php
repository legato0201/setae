<?php

/**
 * Shared application operations used by both REST and legacy Ajax endpoints.
 */
class Setae_App_Operations
{
    const PROFILE_IMAGE_MAX_BYTES = 2097152;
    const SUGGESTION_IMAGE_MAX_BYTES = 5242880;
    const TERMS_VERSION = '2026-03-01';

    public static function get_terms_url()
    {
        $configured = trim((string) get_option('setae_tos_url', ''));
        if (!$configured || $configured === '#') {
            $configured = home_url('/terms/');
        }
        $url = esc_url_raw($configured);
        return $url ?: esc_url_raw(home_url('/terms/'));
    }

    public static function get_privacy_url()
    {
        $configured = function_exists('get_privacy_policy_url') ? get_privacy_policy_url() : '';
        $url = esc_url_raw($configured);
        return $url ?: esc_url_raw(home_url('/privacy-policy/'));
    }

    public static function get_allowed_metric_events()
    {
        return array(
            'public_home_view',
            'register_start',
            'register_referral_prefill',
            'register_submit_success',
            'register_referral_submit_success',
            'profile_public_link_copy',
            'profile_qr_open',
            'profile_qr_download',
            'profile_qr_link_copy',
            'profile_qr_source_change',
            'public_profile_view',
            'public_profile_link_copy',
            'public_profile_text_copy',
            'public_profile_x_click',
            'public_profile_line_click',
            'partner_page_view',
            'partner_page_link_copy',
            'partner_page_text_copy',
            'partner_page_x_click',
            'partner_page_line_click',
            'email_verified',
            'empty_my_spiders_seen',
            'my_spiders_filter_empty_seen',
            'my_spiders_filter_reset',
            'first_spider_start',
            'first_record_prompt_seen',
            'first_record_prompt_click',
            'daily_streak_panel_seen',
            'daily_streak_modal_seen',
            'daily_streak_calendar_open',
            'daily_streak_log_open',
            'daily_streak_quick_record_open',
            'daily_streak_share_to_feed',
            'daily_streak_invite_copy',
            'daily_streak_invite_x',
            'continue_spider_panel_seen',
            'continue_spider_open',
            'continue_spider_dismiss',
            'detail_spider_nav_click',
            'detail_topic_click',
            'encyclopedia_empty_seen',
            'encyclopedia_empty_reset',
            'encyclopedia_empty_topic_cta',
            'spider_create_success',
            'spider_first_photo_add',
            'baby_group_create',
            'baby_bulk_update',
            'baby_filter_change',
            'baby_codes_copy',
            'baby_label_print',
            'baby_csv_download',
            'baby_range_select',
            'baby_bulk_invalid_block',
            'baby_bulk_large_dead_confirm',
            'today_check_record_click',
            'today_check_topic_click',
            'log_date_quick_select',
            'log_draft_restored',
            'log_draft_discard',
            'log_note_template_click',
            'log_feed_choice_saved',
            'log_save_next_click',
            'log_create_success',
            'log_create_error',
            'care_feed_share_success',
            'care_feed_share_link_copy',
            'care_feed_share_text_copy',
            'care_feed_share_x',
            'care_feed_share_line',
            'care_feed_activity_panel_seen',
            'care_feed_activity_open',
            'care_feed_quick_comment_select',
            'care_feed_comment_success',
            'care_feed_comment_cta_open',
            'care_feed_preview_comment_open',
            'care_feed_comments_empty_focus',
            'care_feed_reply_start',
            'care_feed_reply_success',
            'care_feed_reply_parent_open',
            'care_feed_sort_change',
            'care_feed_empty_seen',
            'care_feed_empty_filter_reset',
            'care_feed_empty_record_cta',
            'care_share_view',
            'care_share_link_copy',
            'care_share_text_copy',
            'care_share_x_click',
            'care_share_line_click',
            'bl_empty_seen',
            'bl_empty_my_spiders_cta',
            'bl_empty_board_cta',
            'topic_comment_success',
            'topic_draft_restored',
            'topic_draft_discard',
            'topic_comment_template_select',
            'topic_comment_empty_focus',
            'topic_comment_reply_start',
            'topic_comment_read_from_start',
            'community_empty_seen',
            'community_empty_reset',
            'community_empty_topic_cta',
            'community_topic_created_open_detail',
        );
    }

    public static function track_event($event)
    {
        if (class_exists('Setae_Product_Events')) {
            return Setae_Product_Events::record_legacy($event);
        }
        $event = sanitize_key((string) $event);
        if (!$event) {
            return new WP_Error('missing_event', 'イベント名が必要です。', array('status' => 400));
        }
        if (!in_array($event, self::get_allowed_metric_events(), true)) {
            return new WP_Error('invalid_event', '許可されていないイベントです。', array('status' => 400));
        }

        $day_key = 'setae_metrics_' . gmdate('Ymd');
        $metrics = get_option($day_key, array());
        $metrics = is_array($metrics) ? $metrics : array();
        $metrics[$event] = isset($metrics[$event]) ? ((int) $metrics[$event] + 1) : 1;
        update_option($day_key, $metrics, false);

        return array('event' => $event, 'count' => $metrics[$event]);
    }

    public static function consume_request_limit($bucket, $limit, $window_seconds)
    {
        $bucket = sanitize_key((string) $bucket);
        $limit = max(1, absint($limit));
        $window_seconds = max(1, absint($window_seconds));
        $fingerprint = hash_hmac('sha256', self::get_client_ip(), wp_salt('auth'));
        $key = 'setae_rate_' . substr(hash('sha256', $bucket . '|' . $fingerprint), 0, 32);
        $state = get_transient($key);
        $state = is_array($state) ? $state : array('count' => 0, 'started_at' => time());

        if ((time() - (int) $state['started_at']) >= $window_seconds) {
            $state = array('count' => 0, 'started_at' => time());
        }
        if ((int) $state['count'] >= $limit) {
            $retry_after = max(1, $window_seconds - (time() - (int) $state['started_at']));
            return new WP_Error(
                'rate_limit',
                '試行回数が多すぎます。時間を空けてもう一度お試しください。',
                array('status' => 429, 'retry_after' => $retry_after)
            );
        }

        $state['count'] = (int) $state['count'] + 1;
        set_transient($key, $state, $window_seconds);
        return true;
    }

    public static function register_user($data)
    {
        $rate_limit = self::consume_request_limit('registration', 6, HOUR_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        if (!get_option('setae_enable_registration')) {
            return new WP_Error('registration_closed', '現在、新規登録は受け付けていません。', array('status' => 403));
        }

        $terms_accepted = isset($data['terms_accepted'])
            ? filter_var($data['terms_accepted'], FILTER_VALIDATE_BOOLEAN)
            : false;
        if (!$terms_accepted) {
            return new WP_Error('terms_not_accepted', '利用規約への同意が必要です。', array('status' => 400));
        }

        $client_ip = self::get_client_ip();
        global $wpdb;
        $ip_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(user_id) FROM {$wpdb->usermeta} WHERE meta_key = '_setae_registration_ip' AND meta_value = %s",
            $client_ip
        ));
        if ($ip_count >= 3) {
            return new WP_Error(
                'registration_ip_limit',
                'このネットワーク（IPアドレス）からの登録上限（3アカウント）に達しています。不正利用防止のため、これ以上の作成はできません。',
                array('status' => 429)
            );
        }

        $email = isset($data['email']) ? sanitize_email($data['email']) : '';
        $username = isset($data['username']) ? sanitize_user($data['username'], true) : '';
        $password = isset($data['password']) ? (string) $data['password'] : '';
        $referral_code = isset($data['referral_code']) ? sanitize_text_field($data['referral_code']) : '';
        $referral_source = self::normalize_referral_source(isset($data['referral_source']) ? $data['referral_source'] : 'unknown');
        $qr_claim_code = isset($data['qr_claim_code']) && is_scalar($data['qr_claim_code']) && class_exists('Setae_QR_Manager')
            ? Setae_QR_Manager::sanitize_code($data['qr_claim_code'])
            : '';
        // A QR return address alone is not consent to submit a transfer request.
        $qr_claim_intent = isset($data['qr_claim_intent']) && $data['qr_claim_intent'] === 'request_after_verification';

        if (!$email || !$password) {
            return new WP_Error('missing_credentials', 'メールアドレスとパスワードを入力してください。', array('status' => 400));
        }
        if (!is_email($email)) {
            return new WP_Error('invalid_email', 'メールアドレスの形式を確認してください。', array('status' => 400));
        }
        if (!$username) {
            $username = self::generate_unique_username_from_email($email);
        }
        if (username_exists($username)) {
            return new WP_Error('username_exists', 'このユーザー名は既に使用されています。', array('status' => 409));
        }
        if (email_exists($email)) {
            return new WP_Error('email_exists', 'このメールアドレスは既に登録されています。', array('status' => 409));
        }

        $user_id = wp_create_user($username, $password, $email);
        if (is_wp_error($user_id)) {
            return $user_id;
        }

        update_user_meta($user_id, '_setae_registration_ip', $client_ip);
        update_user_meta($user_id, '_setae_referral_code', self::generate_hiragana_referral_code());
        update_user_meta($user_id, '_setae_bonus_spider_limit', 0);
        update_user_meta($user_id, '_setae_registration_source', $referral_source);
        update_user_meta($user_id, '_setae_terms_accepted_at', current_time('mysql', true));
        update_user_meta($user_id, '_setae_terms_version', self::TERMS_VERSION);
        update_user_meta($user_id, '_setae_terms_url', self::get_terms_url());
        if (class_exists('Setae_Claim_Registration')) {
            Setae_Claim_Registration::store_return_url($user_id, isset($data['return_url']) ? $data['return_url'] : '');
        }
        if ($qr_claim_code && class_exists('Setae_QR_Manager')) {
            Setae_QR_Manager::store_pending_claim($user_id, $qr_claim_code, $qr_claim_intent);
        }

        if ($referral_code) {
            $referrers = get_users(array(
                'meta_key' => '_setae_referral_code',
                'meta_value' => $referral_code,
                'number' => 1,
                'fields' => 'ids',
            ));
            if ($referrers) {
                $referrer_id = (int) $referrers[0];
                update_user_meta($user_id, '_setae_bonus_spider_limit', 1);
                update_user_meta(
                    $referrer_id,
                    '_setae_bonus_spider_limit',
                    (int) get_user_meta($referrer_id, '_setae_bonus_spider_limit', true) + 1
                );
                update_user_meta($user_id, '_setae_referred_by_user_id', $referrer_id);
                update_user_meta($user_id, '_setae_referral_source', $referral_source);
                self::increment_referral_source_count($referrer_id, $referral_source);
            }
        }

        try {
            $activation_token = bin2hex(random_bytes(16));
        } catch (Exception $exception) {
            $activation_token = wp_generate_password(32, false, false);
        }
        update_user_meta($user_id, '_setae_activation_token', $activation_token);
        update_user_meta($user_id, '_setae_is_verified', 0);

        $verify_url = add_query_arg(array(
            'setae_action' => 'verify_email',
            'uid' => $user_id,
            'token' => $activation_token,
        ), home_url('/'));
        $subject = '【Setae】アカウント仮登録のお知らせと本登録のお願い';
        $message = "{$username} 様\n\n";
        $message .= "Setaeへのアカウント作成リクエストを受け付けました。\n";
        $message .= "以下のURLにアクセスして、本登録を完了させてください。\n\n{$verify_url}\n\n";
        $message .= "※お心当たりのない場合は、このメールを破棄してください。\n";
        $email_sent = (bool) wp_mail($email, $subject, $message);
        if (class_exists('Setae_Claim_Registration')) {
            Setae_Claim_Registration::record_account_event('registration_submitted', $user_id);
        }

        return array(
            'user_id' => (int) $user_id,
            'status' => 'pending_verification',
            'email_sent' => $email_sent,
            'message' => '仮登録が完了しました。入力されたメールアドレスに認証リンクを送信しましたので、ご確認ください。',
        );
    }

    public static function verify_email($user_id, $token)
    {
        if (!is_scalar($user_id) || !is_scalar($token)) {
            return new WP_Error('invalid_verification', '無効な認証リンクです。', array('status' => 400));
        }
        $user_id = absint($user_id);
        $token = sanitize_text_field((string) $token);
        $user = get_userdata($user_id);
        if (!$user_id || !$user || !$token) {
            return new WP_Error('invalid_verification', '無効な認証リンクです。', array('status' => 400));
        }

        if ((int) get_user_meta($user_id, '_setae_is_verified', true) === 1) {
            // Idempotent API status is not authentication proof. Never reissue a cookie from it.
            return array('verified' => true, 'already_verified' => true, 'token_consumed' => false);
        }

        $saved_token = (string) get_user_meta($user_id, '_setae_activation_token', true);
        if (!$saved_token || !hash_equals($saved_token, $token)) {
            return new WP_Error(
                'invalid_verification',
                '無効な認証リンクです。URLが正しいか確認してください。',
                array('status' => 400)
            );
        }

        // Compare-and-delete is the one-shot boundary, including concurrent verification requests.
        if (!delete_user_meta($user_id, '_setae_activation_token', $saved_token)) {
            return new WP_Error('invalid_verification', 'この認証リンクは使用済みか無効です。', array('status' => 400));
        }
        update_user_meta($user_id, '_setae_is_verified', 1);
        if ((int) get_user_meta($user_id, '_setae_is_verified', true) !== 1) {
            return new WP_Error('verification_unavailable', '認証状態を保存できませんでした。', array('status' => 503));
        }
        if (class_exists('Setae_Claim_Registration')) {
            Setae_Claim_Registration::record_account_event('email_verified', $user_id);
        }
        return array('verified' => true, 'already_verified' => false, 'token_consumed' => true);
    }

    public static function get_profile($user_id)
    {
        $user_id = absint($user_id);
        $user = get_userdata($user_id);
        if (!$user) {
            return new WP_Error('user_not_found', 'ユーザーが見つかりません。', array('status' => 404));
        }

        $theme = sanitize_key(get_user_meta($user_id, '_setae_theme_preference', true));
        if (!in_array($theme, array('light', 'dark', 'system'), true)) {
            $theme = 'system';
        }
        $care_focus_meta = get_user_meta($user_id, '_setae_show_care_focus', true);
        $show_care_focus = $care_focus_meta === ''
            ? true
            : !in_array((string) $care_focus_meta, array('0', 'false', 'off'), true);
        $plan_id = Setae_Entitlements::get_plan_id($user_id);
        $plans = Setae_Entitlements::get_plan_catalog();
        $trial = Setae_Entitlements::get_trial_state($user_id);
        $inventory = Setae_Entitlements::get_inventory_usage($user_id);
        $nursery = Setae_Entitlements::get_nursery_usage($user_id);
        $billing = class_exists('Setae_Billing') ? Setae_Billing::starter_configuration() : array('available' => false, 'price_label' => '月額1,480円');
        $is_premium = in_array($plan_id, array('legacy_premium', 'breeder_starter'), true);
        $bonus_limit = (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true);
        $referral_code = sanitize_text_field(get_user_meta($user_id, '_setae_referral_code', true));
        if (!$referral_code) {
            $referral_code = self::generate_hiragana_referral_code();
            update_user_meta($user_id, '_setae_referral_code', $referral_code);
        }

        $public_profile_url = get_option('permalink_structure')
            ? home_url('/setae-user/' . rawurlencode($referral_code) . '/')
            : add_query_arg('setae_profile', $referral_code, home_url('/'));
        $public_profile_url = add_query_arg('ref', $referral_code, $public_profile_url);

        return array(
            'id' => $user_id,
            'display_name' => $user->display_name,
            'email' => $user->user_email,
            'avatar_url' => get_avatar_url($user_id),
            'theme_preference' => $theme,
            'show_care_focus' => $show_care_focus,
            'plan' => array(
                'id' => $plan_id, 'label' => $plans[$plan_id]['label'], 'status' => Setae_Entitlements::get_plan_status($user_id),
                'trial_available' => $trial['available'], 'trial_ends_at' => $trial['ends_at'],
                'cancel_at' => Setae_Entitlements::iso_time(get_user_meta($user_id, '_setae_premium_cancel_at', true)),
                'grace_until' => Setae_Entitlements::iso_time(get_user_meta($user_id, '_setae_plan_grace_until', true)),
                'current_period_end' => Setae_Entitlements::iso_time(get_user_meta($user_id, '_setae_stripe_current_period_end', true)),
                'trial_promoted_count' => $trial['promoted_count'],
                'billing_available' => !empty($billing['available']), 'price_label' => $billing['price_label'],
                'starter_limits' => $plans['breeder_starter'], 'trial_limits' => $plans['breeder_trial'],
            ),
            'onboarding' => array(
                'first_record_at' => Setae_Entitlements::iso_time(get_user_meta($user_id, '_setae_first_record_created_at', true)),
                'registered_at' => !empty($user->user_registered) ? Setae_Entitlements::iso_time(strtotime($user->user_registered . ' UTC')) : null,
            ),
            'inventory' => $inventory,
            'nursery' => $nursery,
            'entitlements' => Setae_Entitlements::get_entitlements($user_id),
            'trial' => $trial,
            'is_premium' => $is_premium,
            'cancel_timestamp' => get_user_meta($user_id, '_setae_premium_cancel_at', true),
            // Deprecated total kept for older clients; quota decisions use inventory.
            'spider_count' => count_user_posts($user_id, 'setae_spider', true),
            'spider_limit' => $inventory['limit'],
            'bonus_limit' => $bonus_limit,
            'referral_code' => $referral_code,
            'referral_stats' => self::get_referral_stats($user_id),
            'public_handle' => class_exists('Setae_Public_Identity') ? Setae_Public_Identity::get_handle($user_id) : '',
            'public_profile_url' => esc_url_raw($public_profile_url),
        );
    }

    public static function update_profile($user_id, $data, $files = array())
    {
        $user_id = absint($user_id);
        if (!$user_id || !get_userdata($user_id)) {
            return new WP_Error('user_not_found', 'ユーザーが見つかりません。', array('status' => 404));
        }

        $userdata = array('ID' => $user_id);
        $password_changed = false;
        if (array_key_exists('display_name', $data)) {
            $display_name = trim(sanitize_text_field($data['display_name']));
            if (!$display_name) {
                return new WP_Error('invalid_display_name', '表示名を入力してください。', array('status' => 400));
            }
            $userdata['display_name'] = $display_name;
        }
        if (array_key_exists('email', $data)) {
            $email = sanitize_email($data['email']);
            if (!is_email($email)) {
                return new WP_Error('invalid_email', 'メールアドレスの形式を確認してください。', array('status' => 400));
            }
            $owner = email_exists($email);
            if ($owner && (int) $owner !== $user_id) {
                return new WP_Error('email_exists', 'このメールアドレスは既に使用されています。', array('status' => 409));
            }
            $userdata['user_email'] = $email;
        }
        if (!empty($data['password'])) {
            $userdata['user_pass'] = (string) $data['password'];
            $password_changed = true;
        }

        if (count($userdata) > 1) {
            $updated = wp_update_user($userdata);
            if (is_wp_error($updated)) {
                return $updated;
            }
            if ($password_changed) {
                wp_set_current_user($user_id);
                wp_set_auth_cookie($user_id, true, is_ssl());
            }
        }

        if (array_key_exists('theme_preference', $data)) {
            $theme = sanitize_key($data['theme_preference']);
            if (!in_array($theme, array('light', 'dark', 'system'), true)) {
                return new WP_Error('invalid_theme', '表示テーマの値が正しくありません。', array('status' => 400));
            }
            update_user_meta($user_id, '_setae_theme_preference', $theme);
        }
        if (array_key_exists('show_care_focus', $data)) {
            $show = rest_sanitize_boolean($data['show_care_focus']);
            update_user_meta($user_id, '_setae_show_care_focus', $show ? '1' : '0');
        }

        if (!empty($files['profile_image']) && !empty($files['profile_image']['name'])) {
            $validation = self::validate_image_file(
                $files['profile_image'],
                self::PROFILE_IMAGE_MAX_BYTES,
                array('image/jpeg', 'image/png', 'image/webp')
            );
            if (is_wp_error($validation)) {
                return $validation;
            }
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            $attachment_id = media_handle_upload('profile_image', 0);
            if (is_wp_error($attachment_id)) {
                return new WP_Error(
                    'profile_image_upload_failed',
                    '画像のアップロードに失敗しました: ' . $attachment_id->get_error_message(),
                    array('status' => 500)
                );
            }
            update_user_meta($user_id, 'setae_user_avatar', $attachment_id);
        }

        $profile = self::get_profile($user_id);
        if (!is_wp_error($profile) && $password_changed) {
            $profile['nonce'] = wp_create_nonce('wp_rest');
        }
        return $profile;
    }

    public static function submit_species_suggestion($data, $files = array(), $user_id = 0)
    {
        $rate_limit = self::consume_request_limit('species_suggestion', 8, HOUR_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }

        $species_id = isset($data['species_id']) ? absint($data['species_id']) : 0;
        $species = get_post($species_id);
        if (!$species_id || !$species || $species->post_type !== 'setae_species') {
            return new WP_Error('species_not_found', '対象の種が見つかりません。', array('status' => 404));
        }

        $description = isset($data['suggested_description'])
            ? sanitize_textarea_field($data['suggested_description'])
            : '';
        if (mb_strlen($description) > 2000) {
            return new WP_Error('description_too_long', '提案の説明は2000文字以内で入力してください。', array('status' => 400));
        }

        $requested_name = !empty($data['species_name'])
            ? sanitize_text_field($data['species_name'])
            : $species->post_title;
        $title = '修正提案: ' . $requested_name;
        if ($user_id) {
            $user = get_userdata($user_id);
            if ($user) {
                $title .= ' (by ' . $user->display_name . ')';
            }
        }

        $suggestion_id = wp_insert_post(array(
            'post_type' => 'setae_suggestion',
            'post_title' => $title,
            'post_content' => $description,
            'post_status' => 'pending',
            'post_author' => $user_id ? absint($user_id) : 0,
        ), true);
        if (is_wp_error($suggestion_id)) {
            return $suggestion_id;
        }

        update_post_meta($suggestion_id, '_target_species_id', $species_id);
        $fields = array(
            'suggested_common_name_ja',
            'suggested_lifestyle',
            'suggested_temperature',
            'suggested_humidity',
            'suggested_lifespan',
            'suggested_size',
        );
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                update_post_meta($suggestion_id, '_' . $field, sanitize_text_field($data[$field]));
            }
        }
        if (array_key_exists('suggested_temperament_ids', $data)) {
            update_post_meta(
                $suggestion_id,
                '_suggested_temperament_ids',
                sanitize_text_field($data['suggested_temperament_ids'])
            );
        }

        if (!empty($files['suggested_image']) && !empty($files['suggested_image']['name'])) {
            $validation = self::validate_image_file(
                $files['suggested_image'],
                self::SUGGESTION_IMAGE_MAX_BYTES,
                array('image/jpeg', 'image/png', 'image/webp', 'image/gif')
            );
            if (is_wp_error($validation)) {
                wp_delete_post($suggestion_id, true);
                return $validation;
            }
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            $attachment_id = media_handle_upload('suggested_image', $suggestion_id);
            if (is_wp_error($attachment_id)) {
                wp_delete_post($suggestion_id, true);
                return new WP_Error(
                    'suggestion_image_upload_failed',
                    '画像のアップロードに失敗しました。',
                    array('status' => 500)
                );
            }
            set_post_thumbnail($suggestion_id, $attachment_id);
        }

        return array(
            'id' => (int) $suggestion_id,
            'status' => 'pending',
            'message' => '提案を受け付けました。',
        );
    }

    public static function moderate_best_shot($data)
    {
        $action = isset($data['action']) ? sanitize_key($data['action']) : '';
        $log_id = isset($data['log_id']) ? absint($data['log_id']) : 0;
        $species_id = isset($data['species_id']) ? absint($data['species_id']) : 0;
        $image_id = isset($data['image_id']) ? absint($data['image_id']) : 0;
        $log = get_post($log_id);
        if (!$log_id || !$log || $log->post_type !== 'setae_log') {
            return new WP_Error('log_not_found', '対象の記録が見つかりません。', array('status' => 404));
        }
        if (!in_array($action, array('approve', 'reject', 'revoke'), true)) {
            return new WP_Error('invalid_action', '不正な操作です。', array('status' => 400));
        }

        if ($action === 'reject') {
            update_post_meta($log_id, '_best_shot_status', 'rejected');
            return array('log_id' => $log_id, 'status' => 'rejected', 'message' => '申請を却下しました。');
        }

        $species = get_post($species_id);
        if (!$species_id || !$species || $species->post_type !== 'setae_species') {
            return new WP_Error('species_not_found', '対象の種が見つかりません。', array('status' => 404));
        }
        $image_url = get_post_meta($log_id, '_setae_log_image', true);
        if (!$image_url && $image_id) {
            $image_url = wp_get_attachment_url($image_id);
        }
        if (!$image_url) {
            return new WP_Error('image_not_found', '対象の画像が見つかりません。', array('status' => 404));
        }

        $gallery = get_post_meta($species_id, '_setae_featured_images', true);
        $gallery = is_array($gallery) ? array_values($gallery) : array();
        $index = array_search($image_url, $gallery, true);
        $previous_status = get_post_meta($log_id, '_best_shot_status', true);

        if ($action === 'approve') {
            if ($index === false) {
                $gallery[] = $image_url;
                update_post_meta($species_id, '_setae_featured_images', $gallery);
            }
            update_post_meta($log_id, '_best_shot_status', 'approved');
            if ($previous_status !== 'approved') {
                $author_id = (int) get_post_field('post_author', $log_id);
                if ($author_id) {
                    update_user_meta(
                        $author_id,
                        '_setae_bonus_spider_limit',
                        (int) get_user_meta($author_id, '_setae_bonus_spider_limit', true) + 1
                    );
                }
            }
            return array('log_id' => $log_id, 'status' => 'approved', 'message' => '承認してギャラリーに追加しました。');
        }

        if ($index !== false) {
            unset($gallery[$index]);
            update_post_meta($species_id, '_setae_featured_images', array_values($gallery));
        }
        update_post_meta($log_id, '_best_shot_status', 'pending');
        return array('log_id' => $log_id, 'status' => 'pending', 'message' => '承認を取り消し、ギャラリーから削除しました。');
    }

    private static function validate_image_file($file, $max_bytes, $allowed_mimes)
    {
        if (!empty($file['error'])) {
            return new WP_Error('image_upload_error', '画像を読み込めませんでした。', array('status' => 400));
        }
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new WP_Error('invalid_image_upload', '画像のアップロード情報が正しくありません。', array('status' => 400));
        }
        if ((int) $file['size'] > $max_bytes) {
            return new WP_Error('image_too_large', '画像サイズが上限を超えています。', array('status' => 400));
        }
        $check = @getimagesize($file['tmp_name']);
        if ($check === false || empty($check['mime']) || !in_array($check['mime'], $allowed_mimes, true)) {
            return new WP_Error('invalid_image_type', '無効な画像形式です。', array('status' => 400));
        }
        return true;
    }

    private static function get_client_ip()
    {
        $candidates = array();
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $candidates[] = $_SERVER['HTTP_CLIENT_IP'];
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $candidates = array_merge($candidates, explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
        }
        if (!empty($_SERVER['REMOTE_ADDR'])) {
            $candidates[] = $_SERVER['REMOTE_ADDR'];
        }
        foreach ($candidates as $candidate) {
            $candidate = trim((string) $candidate);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                return sanitize_text_field($candidate);
            }
        }
        return 'unknown';
    }

    private static function generate_hiragana_referral_code()
    {
        $hiragana = array('あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'ん');
        global $wpdb;
        for ($attempt = 0; $attempt < 100; $attempt++) {
            $code = '';
            for ($index = 0; $index < 5; $index++) {
                $code .= $hiragana[array_rand($hiragana)];
            }
            $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_setae_referral_code' AND meta_value = %s LIMIT 1",
                $code
            ));
            if (!$exists) {
                return $code;
            }
        }
        return 'せたえ' . wp_rand(10, 99);
    }

    private static function normalize_referral_source($source)
    {
        $source = substr(sanitize_key((string) $source), 0, 48);
        return $source ?: 'unknown';
    }

    private static function increment_referral_source_count($referrer_id, $source)
    {
        $counts = get_user_meta($referrer_id, '_setae_referral_source_counts', true);
        $counts = is_array($counts) ? $counts : array();
        $source = self::normalize_referral_source($source);
        $counts[$source] = isset($counts[$source]) ? ((int) $counts[$source] + 1) : 1;
        update_user_meta($referrer_id, '_setae_referral_source_counts', $counts);
        update_user_meta($referrer_id, '_setae_referral_registration_count', array_sum(array_map('intval', $counts)));
        update_user_meta($referrer_id, '_setae_referral_last_registration_at', current_time('mysql'));
    }

    private static function generate_unique_username_from_email($email)
    {
        $parts = explode('@', $email);
        $base = !empty($parts[0]) ? sanitize_user($parts[0], true) : 'setae_user';
        $base = $base ?: 'setae_user';
        $candidate = $base;
        $suffix = 1;
        while (username_exists($candidate)) {
            $candidate = $base . $suffix;
            $suffix++;
        }
        return $candidate;
    }

    private static function get_referral_stats($user_id)
    {
        $labels = array(
            'profile_qr' => '自分のQR',
            'shop_qr' => 'ショップ配布',
            'event_qr' => 'イベント配布',
            'public_profile' => '公開プロフィール',
            'unknown' => '未分類',
        );
        $counts = get_user_meta($user_id, '_setae_referral_source_counts', true);
        $counts = is_array($counts) ? $counts : array();
        $sources = array();
        foreach ($counts as $source => $count) {
            $source = sanitize_key($source);
            $count = (int) $count;
            if ($count < 1) {
                continue;
            }
            $sources[] = array(
                'source' => $source,
                'label' => isset($labels[$source]) ? $labels[$source] : $source,
                'count' => $count,
            );
        }
        usort($sources, function ($a, $b) {
            return $b['count'] <=> $a['count'];
        });
        return array(
            'total' => array_sum(array_map('intval', $counts)),
            'sources' => array_slice($sources, 0, 6),
        );
    }
}
