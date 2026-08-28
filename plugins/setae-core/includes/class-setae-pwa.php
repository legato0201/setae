<?php

/**
 * PWA assets, Web Push delivery, and scheduled care reminders.
 */
class Setae_PWA
{
    const CRON_HOOK = 'setae_pwa_hourly_reminders';
    const CRON_SCHEDULE = 'setae_five_minutes';
    const TOPIC_PUSH_HOOK = 'setae_pwa_send_topic_reply';
    const REWRITE_VERSION = '1.0.186';
    const SUBSCRIPTIONS_META = '_setae_push_subscriptions';
    const PREFERENCES_META = '_setae_push_preferences';

    private $version;

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function register_rewrite_rules()
    {
        add_rewrite_rule('^setae-sw\.js$', 'index.php?setae_pwa_asset=service-worker', 'top');
        add_rewrite_rule('^setae-manifest\.webmanifest$', 'index.php?setae_pwa_asset=manifest', 'top');
    }

    public function maybe_flush_rewrite_rules()
    {
        if (get_option('_setae_pwa_rewrite_version') === self::REWRITE_VERSION) {
            return;
        }

        $this->register_rewrite_rules();
        flush_rewrite_rules(false);
        update_option('_setae_pwa_rewrite_version', self::REWRITE_VERSION, false);
    }

    public function register_query_var($vars)
    {
        $vars[] = 'setae_pwa_asset';
        return $vars;
    }

    public function render_asset()
    {
        $asset = get_query_var('setae_pwa_asset');
        if ($asset === 'service-worker') {
            $this->render_service_worker();
        }
        if ($asset === 'manifest') {
            $this->render_manifest();
        }
    }

    private function render_service_worker()
    {
        $path = SETAE_PLUGIN_DIR . 'assets/js/setae-sw.js';
        if (!is_readable($path)) {
            status_header(404);
            exit;
        }

        nocache_headers();
        header('Content-Type: application/javascript; charset=UTF-8');
        header('Service-Worker-Allowed: /');
        header('X-Content-Type-Options: nosniff');

        $source = file_get_contents($path);
        $icon_base = trailingslashit(SETAE_PLUGIN_URL) . 'assets/app/icons/';
        $replacements = array(
            '__SETAE_CACHE_VERSION__' => 'setae-' . preg_replace('/[^a-zA-Z0-9._-]/', '-', $this->version),
            '__SETAE_OFFLINE_URL__' => esc_url_raw(
                class_exists('Setae_App_Shell')
                    ? Setae_App_Shell::app_url()
                    : home_url('/')
            ),
            '__SETAE_ICON_192__' => esc_url_raw(add_query_arg('ver', $this->version, $icon_base . 'setae-icon-192.png')),
            '__SETAE_BADGE_96__' => esc_url_raw(add_query_arg('ver', $this->version, $icon_base . 'setae-badge-96.png')),
        );
        echo strtr($source, $replacements); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        exit;
    }

    private function render_manifest()
    {
        nocache_headers();
        header('Content-Type: application/manifest+json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');

        $icon_base = trailingslashit(SETAE_PLUGIN_URL) . 'assets/app/icons/';
        $manifest = array(
            'id' => home_url('/'),
            'name' => 'SETAE 飼育管理',
            'short_name' => 'SETAE',
            'description' => '生体ごとの給餌、脱皮、写真、飼育リズムを管理します。',
            'start_url' => class_exists('Setae_App_Shell')
                ? Setae_App_Shell::app_url()
                : home_url('/'),
            'scope' => home_url('/'),
            'display' => 'standalone',
            'display_override' => array('window-controls-overlay', 'standalone', 'minimal-ui'),
            'background_color' => '#f3f2ed',
            'theme_color' => '#20231f',
            'orientation' => 'any',
            'lang' => 'ja',
            'categories' => array('lifestyle', 'utilities'),
            'icons' => array(
                array(
                    'src' => add_query_arg('ver', $this->version, $icon_base . 'setae-icon-192.png'),
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ),
                array(
                    'src' => add_query_arg('ver', $this->version, $icon_base . 'setae-icon-512.png'),
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ),
                array(
                    'src' => add_query_arg('ver', $this->version, $icon_base . 'setae-icon-maskable-512.png'),
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'maskable',
                ),
            ),
            'shortcuts' => array(
                array(
                    'name' => 'マイ個体',
                    'short_name' => 'マイ個体',
                    'url' => class_exists('Setae_App_Shell')
                        ? Setae_App_Shell::app_url(array('setae_view' => 'my'))
                        : add_query_arg('setae_view', 'my', home_url('/')),
                    'icons' => array(array(
                        'src' => add_query_arg('ver', $this->version, $icon_base . 'setae-icon-192.png'),
                        'sizes' => '192x192',
                    )),
                ),
                array(
                    'name' => '記録を追加',
                    'short_name' => '記録',
                    'url' => class_exists('Setae_App_Shell')
                        ? Setae_App_Shell::app_url(array('setae_action' => 'record'))
                        : add_query_arg('setae_action', 'record', home_url('/')),
                    'icons' => array(array(
                        'src' => add_query_arg('ver', $this->version, $icon_base . 'setae-icon-192.png'),
                        'sizes' => '192x192',
                    )),
                ),
            ),
        );

        echo wp_json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public function ensure_schedule()
    {
        $scheduled = wp_next_scheduled(self::CRON_HOOK);
        if ($scheduled && wp_get_schedule(self::CRON_HOOK) !== self::CRON_SCHEDULE) {
            wp_clear_scheduled_hook(self::CRON_HOOK);
            $scheduled = false;
        }
        if (!$scheduled) {
            wp_schedule_event(time() + 60, self::CRON_SCHEDULE, self::CRON_HOOK);
        }
    }

    public function add_cron_schedule($schedules)
    {
        $schedules[self::CRON_SCHEDULE] = array(
            'interval' => 5 * MINUTE_IN_SECONDS,
            'display' => 'SETAE every five minutes',
        );
        return $schedules;
    }

    public static function activate()
    {
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 60, self::CRON_SCHEDULE, self::CRON_HOOK);
        }
        update_option('_setae_pwa_rewrite_version', '', false);
    }

    public static function deactivate()
    {
        wp_clear_scheduled_hook(self::CRON_HOOK);
        wp_clear_scheduled_hook(self::TOPIC_PUSH_HOOK);
    }

    public static function is_configured()
    {
        return class_exists('\Minishlink\WebPush\WebPush')
            && self::get_vapid_public_key()
            && self::get_vapid_private_key()
            && self::get_vapid_subject();
    }

    public static function get_vapid_public_key()
    {
        if (defined('SETAE_VAPID_PUBLIC_KEY')) {
            return trim((string) SETAE_VAPID_PUBLIC_KEY);
        }
        return trim((string) get_option('setae_vapid_public_key', ''));
    }

    private static function get_vapid_private_key()
    {
        if (defined('SETAE_VAPID_PRIVATE_KEY')) {
            return trim((string) SETAE_VAPID_PRIVATE_KEY);
        }
        return trim((string) get_option('setae_vapid_private_key', ''));
    }

    private static function get_vapid_subject()
    {
        if (defined('SETAE_VAPID_SUBJECT')) {
            return trim((string) SETAE_VAPID_SUBJECT);
        }
        return trim((string) get_option('setae_vapid_subject', home_url('/')));
    }

    public static function default_preferences()
    {
        return array(
            'enabled' => true,
            'care_reminders' => true,
            'community_messages' => true,
            'care_hour' => 20,
            'care_minute' => 0,
            'timezone' => 'Asia/Tokyo',
        );
    }

    public static function get_preferences($user_id)
    {
        $stored = get_user_meta(absint($user_id), self::PREFERENCES_META, true);
        return wp_parse_args(is_array($stored) ? $stored : array(), self::default_preferences());
    }

    public static function get_subscriptions($user_id)
    {
        $items = get_user_meta(absint($user_id), self::SUBSCRIPTIONS_META, true);
        return is_array($items) ? array_values($items) : array();
    }

    public static function send_to_user($user_id, $payload, $options = array())
    {
        $user_id = absint($user_id);
        if (!$user_id || !self::is_configured()) {
            return false;
        }

        $subscriptions = self::get_subscriptions($user_id);
        if (!$subscriptions) {
            return false;
        }

        $auth = array(
            'VAPID' => array(
                'subject' => self::get_vapid_subject(),
                'publicKey' => self::get_vapid_public_key(),
                'privateKey' => self::get_vapid_private_key(),
            ),
        );
        $default_options = array(
            'TTL' => isset($options['TTL']) ? absint($options['TTL']) : 21600,
            'urgency' => isset($options['urgency']) ? sanitize_key($options['urgency']) : 'normal',
            'topic' => isset($options['topic']) ? substr(sanitize_key($options['topic']), 0, 32) : 'setae',
            'batchSize' => 100,
        );

        try {
            $web_push = new \Minishlink\WebPush\WebPush(
                $auth,
                $default_options,
                20,
                array(
                    'allow_redirects' => false,
                    'connect_timeout' => 10,
                )
            );
            $web_push->setReuseVAPIDHeaders(true);
            $encoded_payload = wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $queued = 0;

            foreach ($subscriptions as $item) {
                if (
                    empty($item['endpoint'])
                    || strpos($item['endpoint'], 'https://') !== 0
                    || !wp_http_validate_url($item['endpoint'])
                    || empty($item['keys']['p256dh'])
                    || empty($item['keys']['auth'])
                ) {
                    continue;
                }

                try {
                    $subscription = \Minishlink\WebPush\Subscription::create(array(
                        'endpoint' => $item['endpoint'],
                        'publicKey' => $item['keys']['p256dh'],
                        'authToken' => $item['keys']['auth'],
                        'contentEncoding' => !empty($item['contentEncoding']) ? $item['contentEncoding'] : 'aes128gcm',
                    ));
                    $web_push->queueNotification($subscription, $encoded_payload);
                    $queued++;
                } catch (\Throwable $error) {
                    error_log('SETAE invalid Web Push subscription: ' . $error->getMessage());
                }
            }

            if (!$queued) {
                return false;
            }

            $expired = array();
            $delivered = false;
            foreach ($web_push->flush() as $report) {
                if ($report->isSuccess()) {
                    $delivered = true;
                }
                if ($report->isSubscriptionExpired()) {
                    $expired[] = $report->getEndpoint();
                }
            }

            if ($expired) {
                $subscriptions = array_values(array_filter($subscriptions, function ($item) use ($expired) {
                    return empty($item['endpoint']) || !in_array($item['endpoint'], $expired, true);
                }));
                update_user_meta($user_id, self::SUBSCRIPTIONS_META, $subscriptions);
            }

            return $delivered;
        } catch (\Throwable $error) {
            error_log('SETAE Web Push error: ' . $error->getMessage());
            return false;
        }
    }

    public static function queue_topic_reply($topic_id, $comment_id, $sender_id)
    {
        $args = array(absint($topic_id), absint($comment_id), absint($sender_id));
        if (!wp_next_scheduled(self::TOPIC_PUSH_HOOK, $args)) {
            wp_schedule_single_event(time() + 5, self::TOPIC_PUSH_HOOK, $args);
        }
    }

    public function send_topic_reply($topic_id, $comment_id, $sender_id)
    {
        $topic = get_post(absint($topic_id));
        $comment = get_comment(absint($comment_id));
        if (!$topic || $topic->post_type !== 'setae_topic' || !$comment) {
            return;
        }

        $recipient_ids = array(absint($topic->post_author));
        $commenters = get_comments(array(
            'post_id' => $topic->ID,
            'status' => 'approve',
            'fields' => 'ids',
            'number' => 250,
            'orderby' => 'comment_ID',
            'order' => 'DESC',
        ));
        foreach ($commenters as $related_comment_id) {
            $related_comment = get_comment($related_comment_id);
            $related_user_id = $related_comment ? absint($related_comment->user_id) : 0;
            if ($related_user_id) {
                $recipient_ids[] = $related_user_id;
            }
        }

        $recipient_ids = array_values(array_unique(array_filter($recipient_ids)));
        $recipient_ids = array_values(array_diff($recipient_ids, array(absint($sender_id))));
        $sender = get_userdata(absint($sender_id));
        $sender_name = $sender ? $sender->display_name : '参加者';
        $sender_blocked_user_ids = get_user_meta(absint($sender_id), '_setae_social_blocked_users', true);
        $sender_blocked_user_ids = is_array($sender_blocked_user_ids)
            ? array_map('absint', $sender_blocked_user_ids)
            : array();
        $excerpt = wp_html_excerpt(wp_strip_all_tags($comment->comment_content), 80, '…');
        $url = add_query_arg(array(
            'setae_view' => 'community',
            'topic' => $topic->ID,
        ), home_url('/'));

        foreach ($recipient_ids as $recipient_id) {
            if (in_array(absint($recipient_id), $sender_blocked_user_ids, true)) {
                continue;
            }
            $preferences = self::get_preferences($recipient_id);
            if (empty($preferences['enabled']) || empty($preferences['community_messages'])) {
                continue;
            }
            $blocked_user_ids = get_user_meta($recipient_id, '_setae_social_blocked_users', true);
            $blocked_user_ids = is_array($blocked_user_ids) ? array_map('absint', $blocked_user_ids) : array();
            if (in_array(absint($sender_id), $blocked_user_ids, true)) {
                continue;
            }

            self::send_to_user($recipient_id, array(
                'title' => '相談広場に新しい返信',
                'body' => $sender_name . 'さん: ' . ($excerpt ?: '新しい返信が届きました'),
                'url' => $url,
                'tag' => 'setae-topic-' . $topic->ID,
                'badgeCount' => 1,
                'data' => array(
                    'type' => 'community',
                    'topic_id' => $topic->ID,
                    'comment_id' => $comment->comment_ID,
                ),
            ), array(
                'TTL' => DAY_IN_SECONDS,
                'urgency' => 'normal',
                'topic' => 'topic-' . $topic->ID,
            ));
        }
    }

    public function send_care_reminders()
    {
        $page = 1;
        do {
            $users = get_users(array(
                'fields' => 'ids',
                'number' => 500,
                'paged' => $page,
                'meta_key' => self::SUBSCRIPTIONS_META,
                'meta_compare' => 'EXISTS',
            ));

            foreach ($users as $user_id) {
                $preferences = self::get_preferences($user_id);
                if (empty($preferences['enabled']) || empty($preferences['care_reminders'])) {
                    continue;
                }

                $timezone_name = in_array($preferences['timezone'], timezone_identifiers_list(), true)
                    ? $preferences['timezone']
                    : 'Asia/Tokyo';
                try {
                    $now = new DateTimeImmutable('now', new DateTimeZone($timezone_name));
                } catch (\Throwable $error) {
                    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Tokyo'));
                }

                $care_hour = min(23, max(0, absint($preferences['care_hour'])));
                $care_minute = min(55, max(0, absint($preferences['care_minute'])));
                $care_minute = (int) (floor($care_minute / 5) * 5);
                $target_time = $now->setTime($care_hour, $care_minute, 0);
                if ($now < $target_time || $now > $target_time->modify('+2 hours')) {
                    continue;
                }

                $local_date = $now->format('Y-m-d');
                if (get_user_meta($user_id, '_setae_push_last_care_date', true) === $local_date) {
                    continue;
                }

                $spider_ids = get_posts(array(
                    'post_type' => 'setae_spider',
                    'post_status' => 'publish',
                    'author' => $user_id,
                    'fields' => 'ids',
                    'posts_per_page' => -1,
                    'meta_query' => array(
                        'relation' => 'OR',
                        array('key' => '_setae_spider_archived', 'compare' => 'NOT EXISTS'),
                        array('key' => '_setae_spider_archived', 'value' => '1', 'compare' => '!='),
                    ),
                ));
                $spider_ids = array_map('absint', $spider_ids);

                $checked_spiders = array();
                if ($spider_ids) {
                    $today_logs = get_posts(array(
                        'post_type' => 'setae_log',
                        'post_status' => 'publish',
                        'author' => $user_id,
                        'fields' => 'ids',
                        'posts_per_page' => 1000,
                        'meta_query' => array(
                            array(
                                'key' => '_setae_log_date',
                                'value' => $local_date,
                                'compare' => '=',
                                'type' => 'DATE',
                            ),
                        ),
                    ));
                    foreach ($today_logs as $log_id) {
                        $log_spider_id = absint(get_post_meta($log_id, '_setae_log_spider_id', true));
                        if ($log_spider_id && in_array($log_spider_id, $spider_ids, true)) {
                            $checked_spiders[$log_spider_id] = true;
                        }
                    }
                }
                $due = max(0, count($spider_ids) - count($checked_spiders));
                if (!$due) {
                    update_user_meta($user_id, '_setae_push_last_care_date', $local_date);
                    continue;
                }

                $sent = self::send_to_user($user_id, array(
                    'title' => '今日の飼育チェック',
                    'body' => 'まだ確認していない個体が' . $due . '匹います。短いメモだけでも記録できます。',
                    'url' => add_query_arg('setae_view', 'my', home_url('/')),
                    'tag' => 'setae-care-' . $local_date,
                    'badgeCount' => $due,
                    'data' => array('type' => 'care', 'count' => $due),
                ), array(
                    'TTL' => 43200,
                    'urgency' => 'normal',
                    'topic' => 'care-' . str_replace('-', '', $local_date),
                ));

                if ($sent) {
                    update_user_meta($user_id, '_setae_push_last_care_date', $local_date);
                }
            }
            $page++;
        } while (count($users) === 500);
    }
}
