<?php

/**
 * Server authority for plans, active inventory and creation gates.
 * Existing records remain editable after expiry. Call creation gates inside
 * with_user_lock(), so another tab cannot consume the same final slot.
 */
class Setae_Entitlements
{
    const SOURCE_META = '_setae_acquisition_source';
    const RECORDER_META = '_setae_log_recorded_by_user_id';
    const TRIAL_PROMOTED_META = '_setae_trial_promoted_count';
    private static $locks = array();
    private static $rest_locks = array();
    private static $admin_locks = array();
    private static $rest_log_creates = array();
    private static $classic_log_creates = array();
    private static $hooks_registered = false;
    private static $transaction = null;

    public static function get_plan_catalog()
    {
        $free = max(0, (int) get_option('setae_free_spider_limit', defined('SETAE_DEFAULT_FREE_SPIDER_LIMIT') ? SETAE_DEFAULT_FREE_SPIDER_LIMIT : 8));
        $defaults = array(
            'keeper_free' => array('label' => 'Keeper Free', 'specimens' => $free, 'nursery_groups' => 1, 'promotions' => 0, 'label_batch' => 20),
            'breeder_trial' => array('label' => 'Breeder Trial', 'specimens' => 20, 'nursery_groups' => 1, 'promotions' => 20, 'label_batch' => 20),
            'breeder_starter' => array('label' => 'Breeder Starter', 'specimens' => 100, 'nursery_groups' => 10, 'promotions' => -1, 'label_batch' => 100),
            'legacy_premium' => array('label' => 'Legacy Premium', 'specimens' => -1, 'nursery_groups' => -1, 'promotions' => -1, 'label_batch' => -1),
        );
        $configured = get_option('setae_plan_limits', array());
        $configured = is_array($configured) ? $configured : array();
        $configured = apply_filters('setae_entitlement_plan_limits', $configured, $defaults);
        $configured = is_array($configured) ? $configured : array();
        foreach ($defaults as $id => &$plan) {
            if ($id === 'legacy_premium') {
                continue; // Existing unlimited customers must never be narrowed by defaults.
            }
            foreach (array('specimens', 'nursery_groups', 'promotions', 'label_batch') as $key) {
                if (isset($configured[$id][$key]) && is_numeric($configured[$id][$key])) {
                    $plan[$key] = max(-1, (int) $configured[$id][$key]);
                }
            }
        }
        unset($plan);
        return $defaults;
    }

    public static function sync_legacy_state($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return 'keeper_free';
        }
        $plan = (string) get_user_meta($user_id, '_setae_plan_id', true);
        if ($plan === '') {
            $plan = get_user_meta($user_id, '_setae_is_premium', true) ? 'legacy_premium' : 'keeper_free';
            // Unique insert preserves a concurrent explicit billing/admin decision.
            add_user_meta($user_id, '_setae_plan_id', $plan, true);
            add_user_meta($user_id, '_setae_plan_status', 'active', true);
            $plan = (string) get_user_meta($user_id, '_setae_plan_id', true);
        }
        if ($plan === 'legacy_premium' && get_user_meta($user_id, '_setae_stripe_customer_id', true)
            && !get_user_meta($user_id, '_setae_stripe_subscription_id', true)
            && !get_user_meta($user_id, '_setae_billing_warning', true)) {
            update_user_meta($user_id, '_setae_billing_warning', 'legacy_subscription_unlinked');
        }
        $effective = self::resolve_plan($user_id, $plan);
        $premium = in_array($effective, array('legacy_premium', 'breeder_starter'), true) ? 1 : 0;
        if ((string) get_user_meta($user_id, '_setae_is_premium', true) !== (string) $premium) {
            update_user_meta($user_id, '_setae_is_premium', $premium);
        }
        return $effective;
    }

    private static function resolve_plan($user_id, $stored)
    {
        if (user_can($user_id, 'manage_options')) {
            return 'legacy_premium';
        }
        if ($stored === 'legacy_premium') {
            $verified = get_user_meta($user_id, '_setae_billing_subscription_plan', true) === 'legacy_premium'
                && get_user_meta($user_id, '_setae_stripe_subscription_id', true);
            $grace = (int) get_user_meta($user_id, '_setae_plan_grace_until', true);
            if ($verified && get_user_meta($user_id, '_setae_plan_status', true) === 'past_due' && $grace > 0 && $grace <= time()) {
                return 'keeper_free';
            }
            return 'legacy_premium'; // Missing/unverified old billing never revokes access.
        }
        if ($stored === 'breeder_trial') {
            return (int) get_user_meta($user_id, '_setae_trial_ends_at', true) > time() ? 'breeder_trial' : 'keeper_free';
        }
        if ($stored === 'breeder_starter') {
            $status = (string) get_user_meta($user_id, '_setae_plan_status', true);
            if (in_array($status, array('active', 'trialing'), true)
                || ($status === 'past_due' && (int) get_user_meta($user_id, '_setae_plan_grace_until', true) > time())) {
                return 'breeder_starter';
            }
        }
        return 'keeper_free';
    }

    public static function get_plan_id($user_id)
    {
        return self::sync_legacy_state($user_id);
    }

    /** Read-only effective plan for administrative aggregates; never migrates meta. */
    public static function peek_plan_id($user_id)
    {
        if (!absint($user_id)) { return 'keeper_free'; }
        $stored = (string) get_user_meta($user_id, '_setae_plan_id', true);
        if ($stored === '') {
            $stored = get_user_meta($user_id, '_setae_is_premium', true) ? 'legacy_premium' : 'keeper_free';
        }
        return self::resolve_plan($user_id, $stored);
    }

    public static function get_plan_status($user_id)
    {
        $plan = self::get_plan_id($user_id);
        if ($plan === 'legacy_premium') {
            return !user_can($user_id, 'manage_options')
                && get_user_meta($user_id, '_setae_billing_subscription_plan', true) === 'legacy_premium'
                && get_user_meta($user_id, '_setae_stripe_subscription_id', true)
                && get_user_meta($user_id, '_setae_plan_status', true) === 'past_due' ? 'past_due' : 'active';
        }
        if ($plan === 'breeder_trial') {
            return 'trialing';
        }
        $stored = (string) get_user_meta($user_id, '_setae_plan_status', true);
        if (get_user_meta($user_id, '_setae_plan_id', true) === 'breeder_trial') {
            return 'active'; // Trial expiry changes permissions, never the saved records.
        }
        return in_array($stored, array('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'), true) ? $stored : 'active';
    }

    private static function limits($user_id)
    {
        $plans = self::get_plan_catalog();
        $plan = $plans[self::get_plan_id($user_id)];
        if ($plan['specimens'] >= 0) {
            $plan['specimens'] += max(0, (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true));
        }
        return $plan;
    }

    private static function user_post_ids($user_id, $post_type)
    {
        if (!absint($user_id)) {
            return array();
        }
        $ids = get_posts(array(
            'post_type' => $post_type,
            'post_status' => array('publish', 'private', 'draft', 'pending', 'future'),
            'author' => absint($user_id), 'posts_per_page' => -1, 'fields' => 'ids',
            'no_found_rows' => true, 'orderby' => 'ID', 'order' => 'ASC',
        ));
        if ($ids) { update_meta_cache('post', $ids); }
        return $ids;
    }

    public static function get_inventory_usage($user_id)
    {
        $usage = array('active_slot_bearing' => 0, 'received_exempt' => 0, 'receipt_exempt' => 0, 'archived' => 0, 'inactive' => 0);
        foreach (self::user_post_ids($user_id, 'setae_spider') as $post_id) {
            if (get_post_meta($post_id, '_setae_spider_archived', true) === '1') {
                $usage['archived']++;
                continue;
            }
            if (self::is_inactive_specimen($post_id)) {
                $usage['inactive']++;
                continue;
            }
            $source = self::get_specimen_source($post_id);
            if (get_post_meta($post_id, '_setae_transfer_receipt', true) || $source === 'transfer_receipt') {
                $usage['receipt_exempt']++;
            } elseif ($source === 'transfer_received') {
                $usage['received_exempt']++;
            } else {
                $usage['active_slot_bearing']++;
            }
        }
        $limits = self::limits($user_id);
        $usage['limit'] = $limits['specimens'];
        $usage['remaining'] = self::remaining($usage['active_slot_bearing'], $usage['limit']);
        $usage['over_limit'] = $usage['limit'] >= 0 && $usage['active_slot_bearing'] > $usage['limit'];
        return $usage;
    }

    private static function is_inactive_specimen($post_id)
    {
        // The live app also uses normal/fasting/pre_molt/post_molt/unknown: all active.
        $terminal = array('dead', 'deceased', 'sold', 'rehomed', 'transferred', 'archived');
        return in_array(sanitize_key(get_post_meta($post_id, '_setae_status', true)), $terminal, true);
    }

    public static function get_nursery_usage($user_id)
    {
        $count = 0;
        foreach (self::user_post_ids($user_id, 'setae_baby_group') as $post_id) {
            if (get_post_meta($post_id, '_setae_baby_archived', true) !== '1') {
                $count++;
            }
        }
        $limits = self::limits($user_id);
        return array('active_groups' => $count, 'limit' => $limits['nursery_groups'], 'remaining' => self::remaining($count, $limits['nursery_groups']));
    }

    private static function remaining($usage, $limit)
    {
        return $limit < 0 ? -1 : max(0, $limit - $usage);
    }

    private static function count_error($count)
    {
        return !is_numeric($count) || (int) $count < 1 || (float) $count !== (float) (int) $count
            ? new WP_Error('setae_invalid_count', '件数は1以上の整数で指定してください。', array('status' => 400)) : null;
    }

    private static function allowed($user_id, $usage, $limit)
    {
        return array('allowed' => true, 'plan_id' => self::get_plan_id($user_id), 'usage' => $usage, 'limit' => $limit, 'remaining' => self::remaining($usage, $limit));
    }

    private static function denied($user_id, $code, $message, $usage, $limit)
    {
        $trial = self::get_trial_state($user_id);
        return new WP_Error($code, $message, array(
            'status' => 403, 'reason' => $code, 'plan_id' => self::get_plan_id($user_id),
            'usage' => $usage, 'limit' => $limit, 'remaining' => self::remaining($usage, $limit),
            'trial_available' => $trial['available'], 'upgrade_plan' => 'breeder_starter',
        ));
    }

    public static function can_create_specimen($user_id, $source = 'manual', $count = 1)
    {
        if (!absint($user_id)) { return new WP_Error('setae_auth_required', 'ログインしてください。', array('status' => 401)); }
        $invalid = self::count_error($count);
        if ($invalid) { return $invalid; }
        if (!in_array($source, self::sources(), true)) {
            return new WP_Error('setae_invalid_acquisition_source', '取得元が正しくありません。', array('status' => 400));
        }
        $usage = self::get_inventory_usage($user_id);
        if (in_array($source, array('transfer_received', 'transfer_receipt'), true)
            || $usage['limit'] < 0 || $usage['active_slot_bearing'] + (int) $count <= $usage['limit']) {
            return self::allowed($user_id, $usage['active_slot_bearing'], $usage['limit']);
        }
        return self::denied($user_id, 'setae_manual_specimen_limit', '有効な個体の登録枠に達しています。既存の個体は引き続き編集・記録できます。', $usage['active_slot_bearing'], $usage['limit']);
    }

    public static function can_create_nursery_group($user_id, $count = 1)
    {
        if (!absint($user_id)) { return new WP_Error('setae_auth_required', 'ログインしてください。', array('status' => 401)); }
        $invalid = self::count_error($count);
        if ($invalid) { return $invalid; }
        $usage = self::get_nursery_usage($user_id);
        return $usage['limit'] < 0 || $usage['active_groups'] + (int) $count <= $usage['limit']
            ? self::allowed($user_id, $usage['active_groups'], $usage['limit'])
            : self::denied($user_id, 'setae_nursery_group_limit', '有効なベビー群の作成枠に達しています。既存の群は引き続き記録できます。', $usage['active_groups'], $usage['limit']);
    }

    public static function can_promote_babies($user_id, $count = 1)
    {
        if (!absint($user_id)) { return new WP_Error('setae_auth_required', 'ログインしてください。', array('status' => 401)); }
        $invalid = self::count_error($count);
        if ($invalid) { return $invalid; }
        $plan = self::get_plan_id($user_id);
        $trial = self::get_trial_state($user_id);
        if ($plan === 'keeper_free') {
            $code = self::get_plan_status($user_id) === 'past_due' ? 'setae_billing_past_due' : ($trial['expired'] ? 'setae_trial_expired' : 'setae_trial_required');
            return self::denied($user_id, $code, '個体への昇格にはBreeder TrialまたはBreeder Starterが必要です。試用は確認画面から開始できます。', $trial['promoted_count'], 0);
        }
        if ($plan === 'breeder_trial' && $trial['promotion_limit'] >= 0 && $trial['promoted_count'] + (int) $count > $trial['promotion_limit']) {
            return self::denied($user_id, 'setae_trial_promotion_limit', '試用中の昇格累計に達しています。アーカイブや削除で試用の累計は戻りません。', $trial['promoted_count'], $trial['promotion_limit']);
        }
        return self::can_create_specimen($user_id, 'nursery_promotion', $count);
    }

    public static function can_export_label_batch($user_id, $count)
    {
        if (!absint($user_id)) { return new WP_Error('setae_auth_required', 'ログインしてください。', array('status' => 401)); }
        $invalid = self::count_error($count);
        if ($invalid) { return $invalid; }
        $limit = self::limits($user_id)['label_batch'];
        return $limit < 0 || (int) $count <= $limit ? self::allowed($user_id, (int) $count, $limit)
            : self::denied($user_id, 'setae_label_batch_limit', '一度に出力できるラベル枚数を超えています。対象を分けて出力できます。', (int) $count, $limit);
    }

    public static function get_entitlements($user_id)
    {
        $limits = self::limits($user_id);
        return array(
            'can_create_specimen' => !is_wp_error(self::can_create_specimen($user_id)),
            'can_create_nursery_group' => !is_wp_error(self::can_create_nursery_group($user_id)),
            'can_promote_babies' => !is_wp_error(self::can_promote_babies($user_id)),
            'label_batch_limit' => $limits['label_batch'],
        );
    }

    public static function get_trial_state($user_id)
    {
        $started = (int) get_user_meta($user_id, '_setae_trial_started_at', true);
        $ends = (int) get_user_meta($user_id, '_setae_trial_ends_at', true);
        $used = (bool) get_user_meta($user_id, '_setae_breeder_trial_used', true) || $started > 0 || $ends > 0;
        $plan = self::get_plan_id($user_id);
        $plans = self::get_plan_catalog();
        $count = max(0, (int) get_user_meta($user_id, self::TRIAL_PROMOTED_META, true));
        $limit = $plans['breeder_trial']['promotions'];
        return array(
            'available' => absint($user_id) > 0 && !$used && $plan === 'keeper_free' && !user_can($user_id, 'manage_options'),
            'used' => $used, 'active' => $plan === 'breeder_trial', 'expired' => $used && $ends > 0 && $ends <= time(),
            'started_at' => self::iso_time($started), 'ends_at' => self::iso_time($ends),
            'days_remaining' => $ends > time() ? (int) ceil(($ends - time()) / 86400) : 0,
            'promoted_count' => $count, 'promotion_limit' => $limit, 'promotion_remaining' => self::remaining($count, $limit),
        );
    }

    public static function start_breeder_trial($user_id)
    {
        return self::with_user_lock($user_id, function () use ($user_id) {
            $trial = self::get_trial_state($user_id);
            if (!$trial['available']) {
                return self::denied($user_id, 'setae_trial_unavailable', '試用は1アカウントにつき1回のみ利用できます。現在のプランもご確認ください。', $trial['promoted_count'], $trial['promotion_limit']);
            }
            $saved = self::with_transaction(array($user_id), function () use ($user_id) {
                $now = time();
                return self::save_user_meta_checked($user_id, array(
                    '_setae_breeder_trial_used' => 1, '_setae_trial_started_at' => $now,
                    '_setae_trial_ends_at' => $now + 30 * 86400, '_setae_plan_id' => 'breeder_trial',
                    '_setae_plan_status' => 'trialing', '_setae_is_premium' => 0,
                ));
            }, false);
            if (is_wp_error($saved)) { return $saved; }
            // Analytics must run after commit and cannot consume a failed trial.
            self::record_event('trial_started', array('idempotency_key' => 'trial:' . $user_id, 'user_id' => $user_id));
            return self::get_trial_state($user_id);
        });
    }

    /** Part of the same transaction as the new specimen and its nursery item. */
    public static function record_trial_promotion($user_id, $spider_id, $authorized_in_trial = false)
    {
        if ((!$authorized_in_trial && self::get_plan_id($user_id) !== 'breeder_trial') || get_post_meta($spider_id, '_setae_trial_promotion_counted', true)) {
            return true;
        }
        if (self::$transaction === null || !isset(self::$locks[absint($user_id)])) {
            return self::transaction_error('setae_transaction_required');
        }
        $count = max(0, (int) get_user_meta($user_id, self::TRIAL_PROMOTED_META, true));
        $saved = self::save_user_meta_checked($user_id, array(self::TRIAL_PROMOTED_META => $count + 1));
        if (is_wp_error($saved)) { return $saved; }
        return self::save_post_meta_checked($spider_id, array('_setae_trial_promotion_counted' => (int) $user_id));
    }

    public static function sources()
    {
        return array('manual', 'nursery_promotion', 'import', 'transfer_received', 'transfer_receipt', 'legacy_manual');
    }

    public static function mark_specimen_source($spider_id, $source)
    {
        if (!in_array($source, self::sources(), true)) {
            return new WP_Error('setae_invalid_acquisition_source', '取得元が正しくありません。', array('status' => 400));
        }
        $saved = self::save_post_meta_checked($spider_id, array(self::SOURCE_META => $source));
        return is_wp_error($saved) ? $saved : $source;
    }

    public static function get_specimen_source($spider_id)
    {
        $source = (string) get_post_meta($spider_id, self::SOURCE_META, true);
        if (in_array($source, self::sources(), true)) {
            return $source;
        }
        if (get_post_meta($spider_id, '_setae_transfer_receipt', true)) {
            $source = 'transfer_receipt';
        } elseif (get_post_meta($spider_id, '_setae_transferred_from_user', true)) {
            $source = 'transfer_received';
        } elseif (get_post_meta($spider_id, '_setae_baby_origin_group_id', true)) {
            $source = 'nursery_promotion';
        } else {
            $source = 'legacy_manual';
        }
        // Reads use the fallback without mass-writing a user's inventory. Actual
        // create/receive/promotion operations explicitly persist their source.
        return $source;
    }

    public static function is_slot_exempt_specimen($spider_id)
    {
        return (bool) get_post_meta($spider_id, '_setae_transfer_receipt', true)
            || in_array(self::get_specimen_source($spider_id), array('transfer_received', 'transfer_receipt'), true);
    }

    public static function mark_log_recorder($log_id, $user_id = 0)
    {
        $previous = get_post_meta($log_id, self::RECORDER_META, true);
        $recorded = absint($previous);
        if ($recorded) { return $recorded; }
        $post = get_post($log_id);
        if (!$post || $post->post_type !== 'setae_log') { return 0; }
        $user_id = absint($user_id) ?: absint($post->post_author);
        if ($user_id) {
            if ($previous === '') {
                add_post_meta($log_id, self::RECORDER_META, $user_id, true);
            } else {
                // Repair an old empty/zero marker without overwriting a concurrent creator.
                update_post_meta($log_id, self::RECORDER_META, $user_id, $previous);
            }
        }
        return absint(get_post_meta($log_id, self::RECORDER_META, true));
    }

    /** Explicit administrator override; never starts or resets a user's trial. */
    public static function set_admin_plan($user_id, $plan)
    {
        if (!current_user_can('manage_options') || !current_user_can('edit_user', $user_id)) {
            return new WP_Error('setae_plan_forbidden', 'プランを変更する権限がありません。', array('status' => 403));
        }
        if (!in_array($plan, array('keeper_free', 'breeder_starter', 'legacy_premium'), true)) {
            return new WP_Error('setae_invalid_plan', '手動変更できないプランです。試用の開始・再設定はできません。', array('status' => 400));
        }
        return self::with_user_lock($user_id, function () use ($user_id, $plan) {
            update_user_meta($user_id, '_setae_plan_id', $plan);
            update_user_meta($user_id, '_setae_plan_status', 'active');
            return self::sync_legacy_state($user_id);
        });
    }

    public static function iso_time($timestamp)
    {
        return (int) $timestamp > 0 ? gmdate('Y-m-d\TH:i:s\Z', (int) $timestamp) : null;
    }

    /** Event storage is secondary: never turn a successful business write into a failure. */
    public static function record_event($event, array $context)
    {
        if (!class_exists('Setae_Product_Events')) { return; }
        try {
            Setae_Product_Events::record($event, $context);
        } catch (\Throwable $error) {
            // No payload, personal data or provider messages in logs.
            error_log('SETAE product event unavailable: ' . sanitize_key($event));
        }
    }

    /**
     * Named locks are connection-scoped and survive nested WP/QR transactions.
     * No transient fallback: an unavailable database lock must not permit overbooking.
     */
    public static function with_user_lock($user_id, $callback)
    {
        $acquired = self::acquire_user_lock($user_id);
        if (is_wp_error($acquired)) { return $acquired; }
        try {
            return call_user_func($callback);
        } finally {
            self::release_user_lock($user_id);
        }
    }

    /**
     * Own one database transaction; callers keep their business/user lock.
     * Unknown engines, autocommit settings and an existing transaction fail
     * closed. No table conversion, save retry or compensating quota decrement.
     */
    public static function with_transaction(array $user_ids, $callback, $inventory = true)
    {
        global $wpdb;
        if (self::$transaction !== null) { return self::transaction_error('setae_transaction_nested'); }
        $tables = array($wpdb->usermeta);
        if ($inventory) {
            $tables = array_merge($tables, array($wpdb->users, $wpdb->posts, $wpdb->postmeta,
                $wpdb->terms, $wpdb->term_taxonomy, $wpdb->term_relationships, $wpdb->termmeta));
        }
        $previous_errors = $wpdb->suppress_errors(true);
        $started = false;
        $committed = false;
        $cache_suspended = null;
        $previous_retries = null;
        try {
            $previous_retries = self::suspend_database_reconnect();
            if (is_wp_error($previous_retries)) { return $previous_retries; }
            foreach (array_unique($tables) as $table) {
                $engine = $wpdb->get_var($wpdb->prepare(
                    'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s', $table
                ));
                if (strtoupper((string) $engine) !== 'INNODB') {
                    return self::transaction_error('setae_transaction_unsupported');
                }
            }
            // SET TRANSACTION (without SESSION/GLOBAL) is rejected inside an
            // active transaction, so START cannot accidentally commit an owner.
            if ((string) $wpdb->get_var('SELECT @@SESSION.autocommit') !== '1'
                || $wpdb->query('SET TRANSACTION READ WRITE') === false
                || $wpdb->query('START TRANSACTION') === false) {
                return self::transaction_error('setae_transaction_unavailable');
            }
            $started = true;
            self::$transaction = array('users' => array_fill_keys(array_map('absint', $user_ids), true), 'posts' => array(), 'terms' => array());
            $cache_suspended = wp_suspend_cache_addition();
            wp_suspend_cache_addition(true);
            add_action('wp_after_insert_post', array(__CLASS__, 'track_transaction_post'), 0, 1);
            add_action('created_term', array(__CLASS__, 'track_transaction_term'), 0, 3);
            // Keep the savepoint until just before commit. If any hook ended
            // the transaction, its missing savepoint must not look successful.
            if ($wpdb->query('SAVEPOINT setae_entitlement_write') === false) {
                return self::transaction_error('setae_transaction_unavailable');
            }
            foreach (array_keys(self::$transaction['users']) as $user_id) { wp_cache_delete($user_id, 'user_meta'); }
            $result = call_user_func($callback);
            if (is_wp_error($result)) { return $result; }
            if ($wpdb->query('RELEASE SAVEPOINT setae_entitlement_write') === false) {
                return self::transaction_error('setae_transaction_state_lost');
            }
            if ($wpdb->query('COMMIT') === false) {
                // An interrupted COMMIT is uncertain, not proof of rollback.
                // Persisted item/trial identity makes a later retry safe.
                return self::transaction_error('setae_transaction_commit_unconfirmed');
            }
            $committed = true;
            return $result;
        } catch (\Throwable $error) {
            return self::transaction_error('setae_transaction_failed');
        } finally {
            if ($started && !$committed) { $wpdb->query('ROLLBACK'); }
            if (self::$transaction !== null) {
                remove_action('wp_after_insert_post', array(__CLASS__, 'track_transaction_post'), 0);
                remove_action('created_term', array(__CLASS__, 'track_transaction_term'), 0);
                $touched = self::$transaction;
                self::$transaction = null;
                if ($cache_suspended !== null) { wp_suspend_cache_addition($cache_suspended); }
                foreach ($touched['posts'] as $post_id => $post_type) {
                    wp_cache_delete($post_id, 'posts');
                    wp_cache_delete($post_id, 'post_meta');
                    clean_post_cache($post_id);
                    if ($post_type) { clean_object_term_cache($post_id, $post_type); }
                }
                foreach ($touched['terms'] as $taxonomy => $term_ids) { clean_term_cache(array_keys($term_ids), $taxonomy); }
                foreach (array_keys($touched['users']) as $user_id) { wp_cache_delete($user_id, 'user_meta'); }
            }
            if (is_int($previous_retries)) { $wpdb->reconnect_retries = $previous_retries; }
            $wpdb->suppress_errors($previous_errors);
        }
    }

    /** Safe to call in shared QR helpers even without an outer transaction. */
    public static function track_transaction_post($post_id)
    {
        if (self::$transaction === null || !absint($post_id)) { return; }
        self::$transaction['posts'][absint($post_id)] = get_post_type($post_id);
    }

    public static function track_transaction_term($term_id, $term_taxonomy_id = 0, $taxonomy = '')
    {
        if (self::$transaction !== null && $taxonomy && absint($term_id)) {
            self::$transaction['terms'][$taxonomy][absint($term_id)] = true;
        }
    }

    /** Read the database after invalidating WP's metadata cache, including no-op writes. */
    public static function save_post_meta_checked($post_id, array $values)
    {
        self::track_transaction_post($post_id);
        foreach ($values as $key => $value) { update_post_meta($post_id, $key, wp_slash($value)); }
        wp_cache_delete($post_id, 'post_meta');
        foreach ($values as $key => $value) {
            if (!metadata_exists('post', $post_id, $key) || !self::same_meta_value(get_post_meta($post_id, $key, true), $value)) {
                return self::transaction_error('setae_metadata_save_failed');
            }
        }
        return true;
    }

    public static function save_user_meta_checked($user_id, array $values)
    {
        if (self::$transaction !== null) { self::$transaction['users'][absint($user_id)] = true; }
        foreach ($values as $key => $value) { update_user_meta($user_id, $key, wp_slash($value)); }
        wp_cache_delete($user_id, 'user_meta');
        foreach ($values as $key => $value) {
            if (!metadata_exists('user', $user_id, $key) || !self::same_meta_value(get_user_meta($user_id, $key, true), $value)) {
                return self::transaction_error('setae_metadata_save_failed');
            }
        }
        return true;
    }

    private static function same_meta_value($actual, $expected)
    {
        return is_scalar($actual) && is_scalar($expected) ? (string) $actual === (string) $expected : $actual === $expected;
    }

    private static function transaction_error($code)
    {
        return new WP_Error($code, '保存結果を確認できませんでした。画面を更新して状態を確認してください。繰り返す場合は管理者へご連絡ください。', array('status' => 503));
    }

    private static function suspend_database_reconnect()
    {
        global $wpdb;
        // wpdb::query otherwise reconnects and repeats a lost statement on a
        // fresh autocommit connection, without this transaction or named lock.
        if (!property_exists($wpdb, 'reconnect_retries') || !is_int($wpdb->reconnect_retries)) {
            return self::transaction_error('setae_transaction_unsupported');
        }
        $previous = $wpdb->reconnect_retries;
        $wpdb->reconnect_retries = 0;
        if ($wpdb->reconnect_retries !== 0) {
            return self::transaction_error('setae_transaction_unsupported');
        }
        return $previous;
    }

    private static function acquire_user_lock($user_id)
    {
        global $wpdb;
        $user_id = absint($user_id);
        if (!$user_id) {
            return new WP_Error('setae_auth_required', 'ログインしてください。', array('status' => 401));
        }
        if (isset(self::$locks[$user_id])) {
            self::$locks[$user_id]['depth']++;
            return true;
        }
        $previous_retries = self::suspend_database_reconnect();
        if (is_wp_error($previous_retries)) { return $previous_retries; }
        $key = 'setae:quota:' . substr(hash('sha256', $wpdb->prefix . ':' . $user_id), 0, 48);
        $locked = $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, %d)', $key, 5));
        if ((string) $locked !== '1') {
            $wpdb->reconnect_retries = $previous_retries;
            return new WP_Error('setae_entitlement_lock_unavailable', '別の保存処理を確認できませんでした。少し待ってから再試行してください。', array('status' => 503, 'reason' => 'lock_unavailable'));
        }
        self::$locks[$user_id] = array('key' => $key, 'depth' => 1, 'reconnect_retries' => $previous_retries);
        wp_cache_delete($user_id, 'user_meta');
        return true;
    }

    private static function release_user_lock($user_id)
    {
        global $wpdb;
        $user_id = absint($user_id);
        if (!isset(self::$locks[$user_id]) || --self::$locks[$user_id]['depth'] > 0) { return; }
        $key = self::$locks[$user_id]['key'];
        $previous_retries = self::$locks[$user_id]['reconnect_retries'];
        unset(self::$locks[$user_id]);
        try { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $key)); }
        finally { $wpdb->reconnect_retries = $previous_retries; }
    }

    /** Core CPT REST creates are another creation surface; updates remain ungated. */
    public static function register_hooks()
    {
        if (self::$hooks_registered) { return; }
        self::$hooks_registered = true;
        foreach (array('setae_spider', 'setae_baby_group') as $type) {
            add_filter('rest_pre_insert_' . $type, array(__CLASS__, 'guard_core_rest_create'), 10, 2);
            add_action('rest_after_insert_' . $type, array(__CLASS__, 'finish_core_rest_create'), 10, 3);
        }
        add_filter('rest_post_dispatch', array(__CLASS__, 'release_core_rest_locks'), 999, 3);
        add_action('shutdown', array(__CLASS__, 'release_core_rest_locks'));
        add_action('admin_init', array(__CLASS__, 'guard_classic_create'));
        add_action('wp_after_insert_post', array(__CLASS__, 'finish_classic_create'), 100, 4);
        add_filter('rest_pre_insert_setae_log', array(__CLASS__, 'protect_core_log_recorder'), 10, 2);
        add_action('rest_after_insert_setae_log', array(__CLASS__, 'finish_core_rest_log'), 10, 3);
    }

    public static function guard_core_rest_create($prepared, $request)
    {
        if (is_wp_error($prepared)) { return $prepared; }
        // Protect creation provenance on updates too; it is server-maintained.
        $meta = $request->get_param('meta');
        if (is_array($meta)) {
            foreach (array(self::SOURCE_META, '_setae_transfer_receipt', '_setae_transferred_from_user', '_setae_baby_origin_group_id', '_setae_trial_promotion_counted') as $protected) {
                unset($meta[$protected]);
            }
            $request->set_param('meta', $meta);
        }
        if (!empty($prepared->ID)) {
            $existing = get_post($prepared->ID);
            // The block editor creates an empty auto-draft before its first save.
            // That ID is not existing inventory and must not bypass a create gate.
            if (!$existing || $existing->post_status !== 'auto-draft') { return $prepared; }
        }
        $user_id = !empty($prepared->post_author) ? absint($prepared->post_author) : get_current_user_id();
        $acquired = self::acquire_user_lock($user_id);
        if (is_wp_error($acquired)) { return $acquired; }
        $key = spl_object_hash($request);
        self::$rest_locks[$key] = $user_id;
        $is_group = isset($prepared->post_type) && $prepared->post_type === 'setae_baby_group';
        $allowed = $is_group ? self::can_create_nursery_group($user_id) : self::can_create_specimen($user_id, 'manual');
        if (is_wp_error($allowed)) {
            self::release_user_lock($user_id);
            unset(self::$rest_locks[$key]);
            return $allowed;
        }
        return $prepared;
    }

    public static function finish_core_rest_create($post, $request, $creating)
    {
        $key = spl_object_hash($request);
        if (!$creating && !isset(self::$rest_locks[$key])) { return; }
        if ($post->post_type === 'setae_spider') {
            self::mark_specimen_source($post->ID, 'manual');
            self::record_event('specimen_created', array('idempotency_key' => 'specimen:' . $post->ID, 'user_id' => (int) $post->post_author, 'object_type' => 'spider', 'object_id' => (int) $post->ID, 'acquisition_source' => 'manual'));
        } elseif ($post->post_type === 'setae_baby_group') {
            self::record_event('baby_group_created', array('idempotency_key' => 'baby-group:' . $post->ID, 'user_id' => (int) $post->post_author, 'object_type' => 'baby_group', 'object_id' => (int) $post->ID));
        }
        if (isset(self::$rest_locks[$key])) {
            self::release_user_lock(self::$rest_locks[$key]);
            unset(self::$rest_locks[$key]);
        }
    }

    public static function release_core_rest_locks($response = null, $server = null, $request = null)
    {
        if (is_object($request)) {
            // A nested internal REST request must not release its parent's lock.
            $key = spl_object_hash($request);
            if (isset(self::$rest_locks[$key])) {
                self::release_user_lock(self::$rest_locks[$key]);
                unset(self::$rest_locks[$key]);
            }
            unset(self::$rest_log_creates[$key]);
            return $response;
        }
        foreach (self::$rest_locks as $user_id) { self::release_user_lock($user_id); }
        self::$rest_locks = array();
        foreach (self::$admin_locks as $user_id) { self::release_user_lock($user_id); }
        self::$admin_locks = array();
        self::$rest_log_creates = array();
        self::$classic_log_creates = array();
        return $response;
    }

    public static function protect_core_log_recorder($prepared, $request)
    {
        $meta = $request->get_param('meta');
        if (is_array($meta)) {
            unset($meta[self::RECORDER_META]);
            $request->set_param('meta', $meta);
        }
        if (!is_wp_error($prepared)) {
            $existing = !empty($prepared->ID) ? get_post($prepared->ID) : null;
            if (empty($prepared->ID) || ($existing && $existing->post_status === 'auto-draft')) {
                self::$rest_log_creates[spl_object_hash($request)] = true;
            }
        }
        return $prepared;
    }

    public static function finish_core_rest_log($post, $request, $creating)
    {
        $key = spl_object_hash($request);
        if (!$creating && empty(self::$rest_log_creates[$key])) { return; }
        unset(self::$rest_log_creates[$key]);
        $recorder = get_current_user_id() ?: (int) $post->post_author;
        self::mark_log_recorder($post->ID, $recorder);
        $spider_id = absint(get_post_meta($post->ID, '_setae_log_spider_id', true));
        if ($spider_id) {
            self::record_event('first_record_created', array(
                'idempotency_key' => 'first-record:' . $recorder, 'user_id' => $recorder,
                'object_type' => 'spider', 'object_id' => $spider_id,
                'properties' => array('record_id' => (int) $post->ID, 'record_type' => sanitize_key(get_post_meta($post->ID, '_setae_log_type', true))),
            ));
        }
    }

    /** Classic WP editing has the same auto-draft first-save path as core REST. */
    public static function guard_classic_create()
    {
        global $pagenow;
        if ($pagenow !== 'post.php' || ($_POST['action'] ?? '') !== 'editpost') { return; }
        $post_id = absint($_POST['post_ID'] ?? 0);
        $post = get_post($post_id);
        if (!$post || $post->post_status !== 'auto-draft'
            || !in_array($post->post_type, array('setae_spider', 'setae_baby_group', 'setae_log'), true)) { return; }
        if (!current_user_can('edit_post', $post_id)
            || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'] ?? '')), 'update-post_' . $post_id)) { return; }
        $user_id = (int) $post->post_author;
        if (current_user_can('manage_options') && !empty($_POST['post_author_override'])) {
            $user_id = absint($_POST['post_author_override']);
        }
        if ($post->post_type === 'setae_log') {
            self::$classic_log_creates[$post_id] = $user_id;
            return; // Recording existing data never needs an inventory lock/gate.
        }
        $lock = self::acquire_user_lock($user_id);
        if (is_wp_error($lock)) { wp_die(esc_html($lock->get_error_message()), '', array('response' => 503)); }
        self::$admin_locks[$post_id] = $user_id;
        $allowed = $post->post_type === 'setae_baby_group'
            ? self::can_create_nursery_group($user_id) : self::can_create_specimen($user_id, 'manual');
        if (is_wp_error($allowed)) {
            self::release_user_lock($user_id);
            unset(self::$admin_locks[$post_id]);
            wp_die(esc_html($allowed->get_error_message()), '', array('response' => 403));
        }
    }

    public static function finish_classic_create($post_id, $post, $update, $before)
    {
        if (isset(self::$classic_log_creates[$post_id]) && $post->post_status !== 'auto-draft') {
            self::finish_core_rest_log($post, new \stdClass(), true);
            unset(self::$classic_log_creates[$post_id]);
        }
        if (!isset(self::$admin_locks[$post_id]) || $post->post_status === 'auto-draft') { return; }
        // Metadata has finished saving when wp_after_insert_post runs.
        self::finish_core_rest_create($post, new \stdClass(), true);
        self::release_user_lock(self::$admin_locks[$post_id]);
        unset(self::$admin_locks[$post_id]);
    }
}
