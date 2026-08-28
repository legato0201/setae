<?php

/** Event names and deliberately small, non-text property schemas. */
class Setae_Product_Event_Catalog
{
    const MAX_PAYLOAD_BYTES = 4096;
    const MAX_PAYLOAD_DEPTH = 3;

    public static function client_events()
    {
        return array('public_home_viewed', 'public_partner_viewed', 'passport_viewed',
            'claim_cta_clicked', 'registration_started', 'pricing_viewed', 'app_session_started');
    }

    public static function server_events()
    {
        return array('registration_submitted', 'email_verified', 'specimen_created',
            'first_record_created', 'baby_group_created', 'baby_promoted', 'label_exported',
            'transfer_requested', 'transfer_completed', 'animal_received', 'trial_started',
            'checkout_started', 'subscription_started', 'subscription_status_changed');
    }

    public static function legacy_events()
    {
        return class_exists('Setae_App_Operations') ? Setae_App_Operations::get_allowed_metric_events() : array();
    }

    public static function is_allowed($event, $origin)
    {
        return in_array($event, $origin === 'server' ? self::server_events() : self::client_events(), true)
            || in_array($event, self::legacy_events(), true);
    }

    public static function source($value)
    {
        $aliases = array('qr_passport' => 'public_passport', 'care_share' => 'public_care', 'public_care_share' => 'public_care',
            'partner_page' => 'public_partner', 'profile' => 'public_profile');
        $value = is_string($value) ? strtolower($value) : '';
        $value = isset($aliases[$value]) ? $aliases[$value] : $value;
        return in_array($value, array('public_home', 'public_partner', 'public_passport',
            'public_profile', 'public_care', 'app', 'qr', 'manual', 'nursery_promotion',
            'offline', 'import', 'unknown'), true) ? $value : 'unknown';
    }

    public static function properties($event, $payload)
    {
        if (is_object($payload)) {
            $payload = get_object_vars($payload);
        }
        if (!is_array($payload)) {
            return new WP_Error('setae_event_payload', 'イベントの付加情報が不正です。', array('status' => 400));
        }
        $encoded = wp_json_encode($payload);
        if ($encoded === false || strlen($encoded) > self::MAX_PAYLOAD_BYTES || self::depth($payload) > self::MAX_PAYLOAD_DEPTH) {
            return new WP_Error('setae_event_payload_limit', 'イベントの付加情報が上限を超えています。', array('status' => 413));
        }
        $schema = self::schema($event);
        $clean = array();
        foreach ($schema as $key => $type) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }
            $value = $payload[$key];
            if ($type === 'int' && (is_int($value) || (is_string($value) && ctype_digit($value)))) {
                $number = (int) $value;
                if ($number >= 0 && $number <= 1000000) {
                    $clean[$key] = $number;
                }
            } elseif ($type === 'bool' && is_bool($value)) {
                $clean[$key] = $value;
            } elseif ($type === 'source') {
                $clean[$key] = self::source($value);
            } elseif (is_array($type) && is_string($value) && in_array($value, $type, true)) {
                $clean[$key] = $value;
            }
        }
        return $clean;
    }

    private static function schema($event)
    {
        $plans = array('keeper_free', 'breeder_trial', 'breeder_starter', 'legacy_premium');
        $statuses = array('active', 'trialing', 'past_due', 'grace', 'unpaid', 'canceled',
            'incomplete', 'incomplete_expired', 'paused', 'none');
        $surfaces = array('home', 'partner', 'passport', 'profile', 'care', 'app');
        $schema = array(
            'public_home_viewed' => array('surface' => $surfaces),
            'public_partner_viewed' => array('surface' => $surfaces),
            'passport_viewed' => array('surface' => $surfaces, 'claim_available' => 'bool'),
            'claim_cta_clicked' => array('surface' => $surfaces),
            'registration_started' => array('surface' => $surfaces, 'claim_intent' => 'bool'),
            'pricing_viewed' => array('surface' => $surfaces, 'plan' => $plans),
            'app_session_started' => array(),
            'registration_submitted' => array('claim_intent' => 'bool'),
            'email_verified' => array('claim_requested' => 'bool'),
            'specimen_created' => array('count' => 'int'),
            'first_record_created' => array('record_id' => 'int', 'record_type' => array('feed', 'feeding', 'molt', 'molting', 'observation', 'condition', 'weight', 'photo', 'maintenance', 'death', 'other')),
            'baby_group_created' => array('count' => 'int'),
            'baby_promoted' => array('count' => 'int', 'group_id' => 'int'),
            'label_exported' => array('count' => 'int', 'format' => array('pdf', 'svg', 'png', 'print', '12mm', 'sheet')),
            'transfer_requested' => array('request_id' => 'int'),
            'transfer_completed' => array('request_id' => 'int'),
            'animal_received' => array('request_id' => 'int'),
            'trial_started' => array('duration_days' => 'int', 'limit' => 'int'),
            'checkout_started' => array('plan' => $plans),
            'subscription_started' => array('plan' => $plans, 'status' => $statuses),
            'subscription_status_changed' => array('plan' => $plans, 'status' => $statuses, 'previous_status' => $statuses),
        );
        // Legacy names are retained, but historical arbitrary text is not collected.
        return array_merge(array('source' => 'source'), isset($schema[$event]) ? $schema[$event] : array());
    }

    private static function depth($value, $level = 0)
    {
        if (!is_array($value) && !is_object($value)) {
            return $level;
        }
        if ($level > self::MAX_PAYLOAD_DEPTH) {
            return $level;
        }
        $maximum = $level;
        foreach ((array) $value as $child) {
            $maximum = max($maximum, self::depth($child, $level + 1));
        }
        return $maximum;
    }
}
