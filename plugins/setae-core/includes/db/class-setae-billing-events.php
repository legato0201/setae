<?php

/**
 * Durable webhook inbox. No payload, customer details or secrets are stored here.
 * A lease permits retries after a crash; completion is conditional on its owner.
 */
class Setae_Billing_Events
{
    const SCHEMA_VERSION = '1.0.0';
    const SCHEMA_OPTION = 'setae_billing_events_schema_version';

    public static function table()
    {
        global $wpdb;
        return $wpdb->prefix . 'setae_billing_events';
    }

    public static function maybe_upgrade()
    {
        if (get_option(self::SCHEMA_OPTION) !== self::SCHEMA_VERSION) {
            self::install_schema();
        }
    }

    public static function install_schema()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            event_id varchar(80) NOT NULL,
            state varchar(16) NOT NULL DEFAULT 'pending',
            lock_token varchar(64) NOT NULL DEFAULT '',
            locked_until datetime DEFAULT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (event_id),
            KEY state_lease (state,locked_until)
        ) $charset;");
        // Never mark an unsuccessful schema installation as complete.
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) === $table) {
            update_option(self::SCHEMA_OPTION, self::SCHEMA_VERSION, false);
        }
    }

    public static function claim($event_id)
    {
        global $wpdb;
        if (!preg_match('/^evt_[A-Za-z0-9_]{1,75}$/D', (string) $event_id)) {
            return new WP_Error('stripe_event_invalid', 'Invalid event ID.', array('status' => 400));
        }
        $table = self::table();
        $now = gmdate('Y-m-d H:i:s');
        $insert = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO $table (event_id,state,created_at,updated_at) VALUES (%s,'pending',%s,%s)",
            $event_id, $now, $now
        ));
        if ($insert === false) {
            return new WP_Error('stripe_inbox_unavailable', 'Webhook storage unavailable.', array('status' => 503));
        }
        $token = bin2hex(random_bytes(24));
        $claimed = $wpdb->query($wpdb->prepare(
            "UPDATE $table SET state='processing',lock_token=%s,locked_until=%s,updated_at=%s
             WHERE event_id=%s AND (state IN ('pending','failed') OR (state='processing' AND locked_until < %s))",
            $token, gmdate('Y-m-d H:i:s', time() + 300), $now, $event_id, $now
        ));
        if ($claimed === 1) {
            return array('duplicate' => false, 'token' => $token);
        }
        $state = $wpdb->get_var($wpdb->prepare("SELECT state FROM $table WHERE event_id=%s", $event_id));
        if ($state === 'processed') {
            return array('duplicate' => true, 'token' => '');
        }
        return new WP_Error('stripe_event_busy', 'Webhook processing is in progress. Retry later.', array('status' => 503));
    }

    public static function finish($event_id, $token, $success)
    {
        global $wpdb;
        return $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET state=%s,lock_token=%s,locked_until=NULL,updated_at=%s WHERE event_id=%s AND lock_token=%s AND state=%s',
            $success ? 'processed' : 'failed', '', gmdate('Y-m-d H:i:s'), $event_id, $token, 'processing'
        )) === 1;
    }
}
