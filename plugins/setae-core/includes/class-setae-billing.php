<?php

/** Stripe subscription state -> the shared entitlement contract. */
class Setae_Billing
{
    public static function starter_configuration()
    {
        return array(
            'plan' => 'breeder_starter',
            'price_label' => (string) get_option('setae_plan_breeder_starter_price_label', '月額1,480円'),
            'available' => class_exists('\\Stripe\\StripeClient')
                && trim((string) get_option('setae_stripe_price_breeder_starter', '')) !== ''
                && trim((string) get_option('setae_stripe_secret_key', '')) !== ''
                && trim((string) get_option('setae_stripe_webhook_secret', '')) !== '',
        );
    }

    public static function array_value($object)
    {
        if (is_object($object) && method_exists($object, 'toArray')) {
            return $object->toArray();
        }
        return is_array($object) ? $object : (array) $object;
    }

    public static function object_id($value)
    {
        if (is_string($value)) {
            return $value;
        }
        $value = self::array_value($value);
        return isset($value['id']) ? (string) $value['id'] : '';
    }

    public static function subscription_id($type, $object)
    {
        $data = self::array_value($object);
        if (strpos($type, 'customer.subscription.') === 0) {
            return self::object_id($data);
        }
        if (!empty($data['subscription'])) {
            return self::object_id($data['subscription']);
        }
        // Clover and later expose an invoice's subscription under parent.
        return self::object_id($data['parent']['subscription_details']['subscription'] ?? '');
    }

    public static function resolve_user($subscription)
    {
        $data = self::array_value($subscription);
        $customer = self::object_id($data['customer'] ?? '');
        $id = self::object_id($data);
        if ($customer === '' || $id === '') {
            return 0;
        }
        foreach (array('_setae_stripe_subscription_id' => $id, '_setae_stripe_customer_id' => $customer) as $key => $value) {
            $users = get_users(array('meta_key' => $key, 'meta_value' => $value, 'number' => 2, 'fields' => 'ID'));
            if (count($users) > 1) {
                return 0; // Ambiguous identity must be resolved by an administrator.
            }
            if (count($users) === 1) {
                $user_id = absint(is_object($users[0]) ? $users[0]->ID : $users[0]);
                $known = (string) get_user_meta($user_id, '_setae_stripe_customer_id', true);
                return $known === '' || $known === $customer ? $user_id : 0;
            }
        }
        $user_id = absint($data['metadata']['setae_user_id'] ?? 0);
        if (!$user_id || !get_userdata($user_id)) {
            return 0;
        }
        $known = (string) get_user_meta($user_id, '_setae_stripe_customer_id', true);
        return $known === '' || $known === $customer ? $user_id : 0;
    }

    public static function price_plan($data, $user_id)
    {
        $starter = trim((string) get_option('setae_stripe_price_breeder_starter', ''));
        $legacy = trim((string) get_option('setae_stripe_price_id', ''));
        $stored = (string) get_user_meta($user_id, '_setae_stripe_price_id', true);
        $stored_plan = (string) get_user_meta($user_id, '_setae_billing_subscription_plan', true);
        $checkout_price = self::pending_checkout_price($data, $user_id);
        foreach (($data['items']['data'] ?? array()) as $item) {
            $item = self::array_value($item);
            $price = self::object_id($item['price'] ?? ($item['plan'] ?? ''));
            if ($price !== '' && $starter !== '' && hash_equals($starter, $price)) {
                return array('plan' => 'breeder_starter', 'price' => $price);
            }
            if ($price !== '' && $legacy !== '' && hash_equals($legacy, $price)) {
                return array('plan' => 'legacy_premium', 'price' => $price);
            }
            // An administrator can change the price offered to new buyers without
            // invalidating a previously verified recurring subscription.
            if ($price !== '' && $stored !== '' && hash_equals($stored, $price)
                && in_array($stored_plan, array('breeder_starter', 'legacy_premium'), true)) {
                return array('plan' => $stored_plan, 'price' => $price);
            }
            // An already issued Checkout remains valid if the administrator changes
            // the Price for new buyers before this subscription's first webhook.
            if ($price !== '' && $checkout_price !== '' && hash_equals($checkout_price, $price)) {
                return array('plan' => 'breeder_starter', 'price' => $price);
            }
        }
        return null;
    }

    private static function pending_checkout_price($data, $user_id)
    {
        $attempt = get_user_meta($user_id, '_setae_checkout_attempt', true);
        $request = is_array($attempt) ? ($attempt['request'] ?? null) : null;
        if (!is_array($request) || ($request['mode'] ?? '') !== 'subscription'
            || !preg_match('/^[a-f0-9]{32}$/D', (string) ($attempt['id'] ?? ''))
            || !is_array($request['line_items'] ?? null) || count($request['line_items']) !== 1) {
            return '';
        }
        // Stripe metadata alone never grants a plan: require this exact server-saved
        // attempt, owner, purpose and price, including the subscription request copy.
        foreach (array(self::array_value($data['metadata'] ?? array()), $request['metadata'] ?? array(),
            $request['subscription_data']['metadata'] ?? array()) as $metadata) {
            if (!is_array($metadata) || ($metadata['setae_user_id'] ?? '') !== (string) $user_id
                || ($metadata['setae_plan_id'] ?? '') !== 'breeder_starter'
                || ($metadata['setae_checkout_attempt_id'] ?? '') !== $attempt['id']) {
                return '';
            }
        }
        $item = $request['line_items'][0] ?? array();
        return ($item['quantity'] ?? 0) === 1 && is_string($item['price'] ?? null) ? trim($item['price']) : '';
    }

    /** Call only while holding Setae_Entitlements::with_user_lock(). */
    public static function sync_subscription($subscription, $user_id, $event_id, $event_type)
    {
        $data = self::array_value($subscription);
        if (!$user_id || self::resolve_user($data) !== (int) $user_id) {
            return new WP_Error('stripe_identity_unresolved', 'Subscription identity needs review.', array('status' => 409));
        }
        Setae_Entitlements::sync_legacy_state($user_id);
        $previous_plan = (string) get_user_meta($user_id, '_setae_plan_id', true);
        $previous_status = (string) get_user_meta($user_id, '_setae_plan_status', true);
        $known_subscription = (string) get_user_meta($user_id, '_setae_stripe_subscription_id', true);
        $id = self::object_id($data);
        if ($known_subscription !== '' && $known_subscription !== $id
            && !in_array($previous_status, array('canceled', 'incomplete_expired'), true)) {
            update_user_meta($user_id, '_setae_billing_warning', 'additional_subscription');
            return array('review_required' => true);
        }
        $match = self::price_plan($data, $user_id);
        if (!$match) {
            update_user_meta($user_id, '_setae_billing_warning', 'unrecognized_price');
            return array('review_required' => true); // Never infer a downgrade.
        }
        $status = (string) ($data['status'] ?? '');
        $allowed_statuses = array('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused');
        if (!in_array($status, $allowed_statuses, true)) {
            return new WP_Error('stripe_status_unknown', 'Subscription status needs review.', array('status' => 503));
        }
        if ($event_type === 'invoice.payment_failed') {
            update_user_meta($user_id, '_setae_billing_payment_failed_at', time());
            update_user_meta($user_id, '_setae_billing_warning', 'payment_failed');
            // A failed invoice alone is never a revocation instruction.
            if (!in_array($status, array('active', 'trialing', 'past_due'), true)) {
                return array('payment_attention' => true);
            }
        }
        $period_end = absint($data['current_period_end'] ?? 0);
        foreach (($data['items']['data'] ?? array()) as $item) {
            $item = self::array_value($item);
            $period_end = max($period_end, absint($item['current_period_end'] ?? 0));
        }
        $grace = 0;
        $plan = $match['plan'];
        if ($previous_plan === 'legacy_premium' && in_array($status, array('active', 'trialing', 'past_due'), true)) {
            $plan = 'legacy_premium';
        }
        if ($status === 'past_due') {
            $grace = absint(get_user_meta($user_id, '_setae_plan_grace_until', true));
            if ($previous_status !== 'past_due' || !$grace) {
                $days = max(1, min(30, (int) get_option('setae_billing_grace_days', 7)));
                $grace = time() + $days * 86400;
            }
        }
        $enabled = in_array($status, array('active', 'trialing'), true)
            || ($status === 'past_due' && $grace > time());
        // Grandfathered users retain access when the incoming state is ambiguous.
        if ($plan === 'legacy_premium' && in_array($status, array('incomplete', 'paused'), true)) {
            update_user_meta($user_id, '_setae_billing_warning', 'legacy_subscription_review');
            return array('review_required' => true);
        }
        $effective_plan = $enabled ? $plan : 'keeper_free';
        $changed = $previous_plan !== $effective_plan || $previous_status !== $status;
        if ($changed) {
            update_user_meta($user_id, '_setae_billing_transition_event', array(
                'event_id' => $event_id, 'previous_status' => $previous_status,
            ));
        }
        $values = array(
            '_setae_plan_id' => $effective_plan,
            '_setae_plan_status' => $status,
            '_setae_stripe_customer_id' => self::object_id($data['customer']),
            '_setae_stripe_subscription_id' => $id,
            '_setae_stripe_price_id' => $match['price'],
            '_setae_billing_subscription_plan' => $plan,
            '_setae_stripe_current_period_end' => $period_end,
            '_setae_stripe_cancel_at_period_end' => empty($data['cancel_at_period_end']) ? 0 : 1,
            '_setae_plan_grace_until' => $grace,
            '_setae_is_premium' => $enabled ? 1 : 0,
        );
        foreach ($values as $key => $value) {
            update_user_meta($user_id, $key, $value);
        }
        foreach ($values as $key => $value) {
            if ((string) get_user_meta($user_id, $key, true) !== (string) $value) {
                return new WP_Error('stripe_state_write_failed', 'Subscription state could not be saved.', array('status' => 503));
            }
        }
        $cancel_at = absint($data['cancel_at'] ?? 0);
        if (!$cancel_at && !empty($data['cancel_at_period_end'])) {
            $cancel_at = $period_end;
        }
        if ($cancel_at && $enabled) {
            update_user_meta($user_id, '_setae_premium_cancel_at', $cancel_at);
        } else {
            delete_user_meta($user_id, '_setae_premium_cancel_at');
        }
        if (in_array($status, array('active', 'trialing'), true) && $event_type !== 'invoice.payment_failed') {
            delete_user_meta($user_id, '_setae_billing_warning');
            delete_user_meta($user_id, '_setae_billing_payment_failed_at');
        }
        if (class_exists('Setae_Product_Events')) {
            $transition = get_user_meta($user_id, '_setae_billing_transition_event', true);
            if (is_array($transition) && ($transition['event_id'] ?? '') === $event_id) {
                Setae_Product_Events::record('subscription_status_changed', array(
                    'idempotency_key' => 'stripe:' . $event_id . ':status', 'user_id' => $user_id,
                    'object_type' => 'subscription',
                    'properties' => array('status' => $status, 'previous_status' => $transition['previous_status'], 'plan' => $effective_plan),
                ));
            }
            // Existing legacy contracts are not new acquisitions merely because v251 observes them.
            if ($plan === 'breeder_starter' && in_array($status, array('active', 'trialing'), true)) {
                Setae_Product_Events::record('subscription_started', array(
                    'idempotency_key' => 'subscription-started:' . $user_id, 'user_id' => $user_id,
                    'object_type' => 'subscription', 'properties' => array('status' => $status, 'plan' => $plan),
                ));
            }
        }
        return array('plan' => $effective_plan, 'status' => $status);
    }
}
