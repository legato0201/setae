<?php

/** Shared registration for the four external public entry surfaces. */
class Setae_Public_Registration
{
    /**
     * Build a view-only context. Passwords are never accepted or stored here.
     * Explicit profile/partner codes take precedence over incoming URL codes.
     */
    public static function build_context($source, array $args = array())
    {
        $sources = array('public_profile', 'public_passport', 'public_care_share', 'public_partner');
        $source = in_array($source, $sources, true) ? $source : 'public_profile';
        $referral_code = array_key_exists('referral_code', $args)
            ? self::clean_text($args['referral_code'])
            : self::query_value(array('ref', 'referral_code'));
        $referral_source = array_key_exists('referral_source', $args)
            ? self::clean_text($args['referral_source'])
            : self::query_value(array('src', 'ref_src', 'utm_source'));
        $referral_source = substr(preg_replace('/[^a-z0-9_.-]/', '_', strtolower($referral_source)), 0, 48);
        $qr_claim_code = isset($args['qr_claim_code']) ? self::clean_text($args['qr_claim_code']) : '';
        if ($qr_claim_code && class_exists('Setae_QR_Manager')) {
            $qr_claim_code = Setae_QR_Manager::sanitize_code($qr_claim_code);
        }
        $claim_context = $qr_claim_code !== '';
        $claim_intent = $claim_context && ($args['qr_claim_intent'] ?? '') === 'request_after_verification';

        $success_message = '仮登録が完了しました。認証メールをご確認ください。';
        if ($claim_intent) {
            $success_message .= 'メール内のリンクで認証すると、この個体の引き継ぎ申請を送信します。完了には現在の所有者の承認が必要です。';
        } elseif ($claim_context) {
            $success_message .= '引き継ぎ受付中の場合、認証後にこの個体の引き継ぎを申請できます。所有者の承認が必要です。';
        }
        $id = isset($args['id']) ? sanitize_html_class(self::clean_text($args['id'])) : '';

        return array(
            'enabled' => !is_user_logged_in() && (bool) get_option('setae_enable_registration')
                && (!array_key_exists('enabled', $args) || (bool) $args['enabled']),
            'id' => $id ?: 'setae-public-register-dialog',
            'source' => $source,
            'analytics_id' => isset($args['analytics_id']) ? absint($args['analytics_id']) : 0,
            'ajax_url' => admin_url('admin-ajax.php'),
            'terms_url' => Setae_App_Operations::get_terms_url(),
            'terms_version' => Setae_App_Operations::TERMS_VERSION,
            'username' => '',
            'email' => '',
            'referral_code' => function_exists('mb_substr') ? mb_substr($referral_code, 0, 64) : substr($referral_code, 0, 64),
            'referral_source' => $referral_source ?: $source,
            'qr_claim_code' => $qr_claim_code,
            'claim_context' => $claim_context,
            'qr_claim_intent' => $claim_intent ? 'request_after_verification' : '',
            'return_url' => isset($args['return_url']) ? esc_url_raw(self::clean_text($args['return_url'])) : '',
            'submit_label' => $claim_context ? '認証メールを送る' : '登録する',
            'title' => $claim_context ? 'この個体の履歴を引き継ぐ' : (isset($args['title']) ? self::clean_text($args['title']) : '無料で始める'),
            'description' => $claim_intent
                ? 'メール認証が完了すると、この個体の引き継ぎ申請を送信します。現在の所有者が承認すると、履歴ごとマイ個体へ移動します。'
                : ($claim_context ? '引き継ぎ受付中の場合、メール認証後にこの個体の引き継ぎを申請できます。完了には現在の所有者の承認が必要です。'
                    : (isset($args['description']) ? self::clean_text($args['description']) : 'メール認証後、すぐに最初の個体を登録できます。')),
            'referral_help' => $referral_code ? '紹介コードを入力済みです。必要に応じて変更できます。'
                : '紹介コードをお持ちの場合は入力してください。',
            'success_message' => isset($args['success_message']) ? self::clean_text($args['success_message']) : $success_message,
        );
    }

    public static function enqueue($version)
    {
        Setae_Public_Home::enqueue_foundation($version);
        wp_enqueue_style(
            'setae-public-registration',
            SETAE_PLUGIN_URL . 'assets/css/public-registration.css',
            array('setae-public-foundation'),
            $version
        );
        wp_enqueue_script(
            'setae-public-registration',
            SETAE_PLUGIN_URL . 'assets/js/public-registration.js',
            array(),
            $version,
            true
        );
    }

    public static function render(array $context)
    {
        if (empty($context['enabled'])) {
            return;
        }
        $registration = $context;
        require SETAE_PLUGIN_DIR . 'templates/public/registration-dialog.php';
    }

    private static function query_value(array $keys)
    {
        foreach ($keys as $key) {
            if (isset($_GET[$key]) && is_scalar($_GET[$key])) {
                $value = self::clean_text(wp_unslash($_GET[$key]));
                if ($value !== '') {
                    return $value;
                }
            }
        }
        return '';
    }

    private static function clean_text($value)
    {
        return is_scalar($value) ? trim(sanitize_text_field((string) $value)) : '';
    }
}
