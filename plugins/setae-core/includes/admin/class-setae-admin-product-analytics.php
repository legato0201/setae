<?php

/** Aggregate-only administration. No records, names, email or raw URLs are shown. */
class Setae_Admin_Product_Analytics
{
    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_menu'));
    }

    public function add_menu()
    {
        add_options_page('SETAE Product Analytics', 'SETAE Product Analytics', 'manage_options',
            'setae-product-analytics', array($this, 'render'));
    }

    public static function stages()
    {
        return array(
            'passport_viewed' => array('個体パスポート閲覧', 'client'),
            'claim_cta_clicked' => array('引継ぎCTA', 'client'),
            'registration_started' => array('登録開始', 'client'),
            'registration_submitted' => array('登録完了', 'server'),
            'email_verified' => array('メール認証', 'server'),
            'transfer_requested' => array('引継ぎ申請', 'server'),
            'transfer_completed' => array('引継ぎ完了', 'server'),
            'animal_received' => array('個体受領', 'server'),
            'first_record_created' => array('初回記録', 'server'),
            'trial_started' => array('試用開始', 'server'),
            'checkout_started' => array('Checkout開始', 'server'),
            'subscription_started' => array('有料契約開始', 'server'),
        );
    }

    /** Counts are UTC and limited to the selected measured interval. */
    public static function get_report($days = 7, $now = null)
    {
        global $wpdb;
        $days = in_array((int) $days, array(7, 30, 90), true) ? (int) $days : 7;
        $now = $now === null ? time() : (int) $now;
        $end = gmdate('Y-m-d H:i:s', $now);
        $start = gmdate('Y-m-d 00:00:00', $now - ($days - 1) * DAY_IN_SECONDS);
        $measured = get_option(Setae_Product_Events::STARTED_OPTION, '');
        $report = array('days' => $days, 'start' => $start, 'end' => $end, 'timezone' => 'UTC',
            'measurement_started_at' => $measured ?: null, 'partial_period' => $measured && $measured > $start,
            'funnel' => array(), 'activation' => null, 'retention' => array(),
            'sources' => array(), 'partners' => array(), 'plans' => array(),
            'current_plans' => self::current_plan_counts());
        foreach (self::stages() as $name => $stage) {
            $report['funnel'][$name] = array('label' => $stage[0], 'events' => $measured ? 0 : null,
                'people' => $measured ? 0 : null, 'unidentified_events' => $measured ? 0 : null);
        }
        if (!$measured) {
            return $report;
        }
        $table = Setae_Product_Events::table();
        // A single anonymous identity can be linked only when registration resolves
        // it to exactly one account. Shared browsers are not guessed into an account.
        $identity_join = "LEFT JOIN (SELECT anonymous_id, CASE WHEN COUNT(DISTINCT user_id) = 1 THEN MIN(user_id) ELSE NULL END linked_user_id
            FROM $table WHERE event_origin = 'server' AND event_name = 'registration_submitted'
            AND anonymous_id <> '' AND user_id IS NOT NULL GROUP BY anonymous_id) identity_map ON identity_map.anonymous_id = e.anonymous_id";
        $person = "CASE WHEN e.user_id IS NOT NULL THEN CONCAT('u:',e.user_id)
            WHEN identity_map.linked_user_id IS NOT NULL THEN CONCAT('u:',identity_map.linked_user_id)
            WHEN e.anonymous_id <> '' THEN CONCAT('a:',e.anonymous_id) ELSE NULL END";
        $rows = $wpdb->get_results($wpdb->prepare("/* setae:product:funnel */
            SELECT e.event_name,e.event_origin,COUNT(*) event_count,COUNT(DISTINCT $person) people,
                SUM(CASE WHEN ($person) IS NULL THEN 1 ELSE 0 END) unidentified
            FROM $table e $identity_join WHERE e.occurred_at >= %s AND e.occurred_at <= %s
            GROUP BY e.event_name,e.event_origin", $start, $end), ARRAY_A);
        if (!is_array($rows)) {
            return self::query_error();
        }
        $stages = self::stages();
        foreach ($rows as $row) {
            if (isset($stages[$row['event_name']]) && $stages[$row['event_name']][1] === $row['event_origin']) {
                $report['funnel'][$row['event_name']]['events'] = (int) $row['event_count'];
                $report['funnel'][$row['event_name']]['people'] = (int) $row['people'];
                $report['funnel'][$row['event_name']]['unidentified_events'] = (int) $row['unidentified'];
            }
        }
        foreach (array('sources' => 'acquisition_source', 'partners' => 'partner_user_id') as $key => $column) {
            $extra = $key === 'partners' ? 'AND e.partner_user_id IS NOT NULL' : '';
            $rows = $wpdb->get_results($wpdb->prepare("/* setae:product:$key */
                SELECT e.$column dimension,COUNT(*) event_count,COUNT(DISTINCT $person) people,
                    COUNT(DISTINCT CASE WHEN e.event_origin = 'server' AND e.event_name = 'registration_submitted' THEN e.user_id ELSE NULL END) registrations
                FROM $table e $identity_join WHERE e.occurred_at >= %s AND e.occurred_at <= %s $extra
                GROUP BY e.$column ORDER BY event_count DESC LIMIT 100", $start, $end), ARRAY_A);
            if (!is_array($rows)) return self::query_error();
            $report[$key] = $rows;
        }
        $plans = $wpdb->get_results($wpdb->prepare("/* setae:product:plans */
            SELECT e.plan_id dimension,COUNT(*) people FROM $table e
            INNER JOIN (SELECT user_id,MAX(id) last_id FROM $table
                WHERE user_id IS NOT NULL AND occurred_at >= %s AND occurred_at <= %s GROUP BY user_id) latest ON e.id = latest.last_id
            GROUP BY e.plan_id ORDER BY people DESC", $start, $end), ARRAY_A);
        if (!is_array($plans)) return self::query_error();
        $report['plans'] = $plans;

        $mature_at = gmdate('Y-m-d H:i:s', $now - DAY_IN_SECONDS);
        $activation = $wpdb->get_row($wpdb->prepare("/* setae:product:activation */
            SELECT COUNT(DISTINCT s.user_id) cohort,
                COUNT(DISTINCT CASE WHEN s.occurred_at <= %s THEN s.user_id ELSE NULL END) eligible,
                COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN s.user_id ELSE NULL END) activated,
                COUNT(DISTINCT CASE WHEN f.id IS NOT NULL AND s.occurred_at <= %s THEN s.user_id ELSE NULL END) activated_eligible
            FROM $table s LEFT JOIN $table f ON f.user_id = s.user_id
                AND f.event_origin = 'server' AND f.event_name = 'first_record_created'
                AND f.object_type IN ('spider','baby_group') AND f.object_id IS NOT NULL
                AND f.occurred_at >= s.occurred_at AND f.occurred_at <= DATE_ADD(s.occurred_at,INTERVAL 24 HOUR)
                AND (s.event_name <> 'baby_group_created' OR f.object_type = 'baby_group')
            WHERE s.event_origin = 'server' AND s.user_id IS NOT NULL
                AND s.event_name IN ('registration_submitted','animal_received','baby_group_created')
                AND NOT EXISTS (SELECT 1 FROM $table prior WHERE prior.user_id = s.user_id
                    AND prior.event_origin = 'server' AND prior.event_name = 'first_record_created'
                    AND prior.occurred_at < s.occurred_at)
                AND s.occurred_at >= %s AND s.occurred_at <= %s",
            $mature_at, $mature_at, $start, $end), ARRAY_A);
        if (!is_array($activation)) return self::query_error();
        $report['activation'] = array_map('intval', $activation);
        $report['activation']['pending'] = max(0, $report['activation']['cohort'] - $report['activation']['eligible']);
        $report['activation']['rate'] = self::rate($report['activation']['activated_eligible'], $report['activation']['eligible']);

        // User-first record keys prevent multiple activations; only a verified
        // registration/receipt (or nursery start) within 24 hours qualifies.
        $activation_query = "SELECT f.user_id,MIN(f.occurred_at) activated_at FROM $table f
            WHERE f.event_origin = 'server' AND f.event_name = 'first_record_created'
                AND f.object_type IN ('spider','baby_group') AND f.object_id IS NOT NULL
                AND EXISTS (SELECT 1 FROM $table s WHERE s.user_id = f.user_id AND s.event_origin = 'server'
                    AND (s.event_name IN ('registration_submitted','animal_received')
                        OR (s.event_name = 'baby_group_created' AND f.object_type = 'baby_group'))
                    AND s.occurred_at <= f.occurred_at AND s.occurred_at >= DATE_SUB(f.occurred_at,INTERVAL 24 HOUR))
            GROUP BY f.user_id";
        foreach (array(1, 7, 30) as $day) {
            $retention = $wpdb->get_row($wpdb->prepare("/* setae:product:retention:$day */
                SELECT COUNT(*) cohort,
                    SUM(CASE WHEN DATE_ADD(DATE(a.activated_at),INTERVAL $day DAY) < DATE(%s) THEN 1 ELSE 0 END) eligible,
                    SUM(CASE WHEN DATE_ADD(DATE(a.activated_at),INTERVAL $day DAY) < DATE(%s)
                        AND EXISTS (SELECT 1 FROM $table sessions WHERE sessions.user_id = a.user_id
                            AND sessions.event_name = 'app_session_started' AND sessions.event_origin = 'client'
                            AND sessions.occurred_at >= DATE_ADD(DATE(a.activated_at),INTERVAL $day DAY)
                            AND sessions.occurred_at < DATE_ADD(DATE(a.activated_at),INTERVAL " . ($day + 1) . " DAY))
                        THEN 1 ELSE 0 END) retained
                FROM ($activation_query) a WHERE a.activated_at >= %s AND a.activated_at <= %s",
                $end, $end, $start, $end), ARRAY_A);
            if (!is_array($retention)) return self::query_error();
            $retention = array_map('intval', $retention);
            $retention['pending'] = max(0, $retention['cohort'] - $retention['eligible']);
            $retention['rate'] = self::rate($retention['retained'], $retention['eligible']);
            $report['retention']['D' . $day] = $retention;
        }
        return $report;
    }

    public static function rate($numerator, $denominator)
    {
        return (int) $denominator > 0 ? round(100 * (int) $numerator / (int) $denominator, 1) : null;
    }

    /** Current-site accounts, including people with no measured events. No lazy migration. */
    public static function current_plan_counts()
    {
        if (!is_callable(array('Setae_Entitlements', 'peek_plan_id'))) {
            return new WP_Error('setae_plan_analytics_unavailable', '現在のプラン人数を取得できませんでした。');
        }
        try {
            $counts = array('keeper_free' => 0, 'breeder_trial' => 0, 'breeder_starter' => 0, 'legacy_premium' => 0);
            $offset = 0;
            do {
                $ids = get_users(array('fields' => 'ID', 'number' => 500, 'offset' => $offset,
                    'orderby' => 'ID', 'order' => 'ASC', 'count_total' => false));
                if (!is_array($ids)) throw new RuntimeException('Plan account query failed.');
                if ($ids) update_meta_cache('user', array_map('intval', $ids));
                foreach ($ids as $id) {
                    $plan = Setae_Entitlements::peek_plan_id((int) $id);
                    $counts[isset($counts[$plan]) ? $plan : 'keeper_free']++;
                }
                $offset += count($ids);
            } while (count($ids) === 500);
            return $counts;
        } catch (Throwable $error) {
            return new WP_Error('setae_plan_analytics_unavailable', '現在のプラン人数を取得できませんでした。');
        }
    }

    public function render()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html('この画面を表示する権限がありません。'), '', array('response' => 403));
            return;
        }
        $days = isset($_GET['days']) && is_scalar($_GET['days']) ? (int) $_GET['days'] : 7;
        $report = self::get_report($days);
        echo '<div class="wrap"><h1>SETAE Product Analytics</h1><p>公開閲覧から初回記録・契約までの計測。個人名、連絡先、記録本文は表示しません。</p>';
        if (is_wp_error($report)) {
            echo '<div class="notice notice-error"><p>' . esc_html($report->get_error_message()) . '</p></div></div>';
            return;
        }
        echo '<nav aria-label="集計期間"><p>';
        foreach (array(7, 30, 90) as $days) {
            $url = add_query_arg(array('page' => 'setae-product-analytics', 'days' => $days), admin_url('options-general.php'));
            echo '<a class="button' . ($report['days'] === $days ? ' button-primary' : '') . '" href="' . esc_url($url) . '"'
                . ($report['days'] === $days ? ' aria-current="page"' : '') . '>' . esc_html($days . '日') . '</a> ';
        }
        echo '</p></nav><p>期間: ' . esc_html($report['start'] . ' – ' . $report['end']) . ' UTC</p>';
        echo '<p>計測開始: ' . esc_html($report['measurement_started_at'] ?: '未計測') . '</p>';
        if ($report['partial_period']) echo '<p>この期間には計測開始前が含まれます。開始前の行動は未計測であり、0件ではありません。</p>';
        echo '<h2>ファネル</h2><p>重要な成立イベントはサーバー起源のみ。各段階の期間内件数・人数であり、同一人物が全段階を通過した割合ではありません。匿名IDのない閲覧は人数に含めません。</p>';
        echo '<table class="widefat striped"><thead><tr><th scope="col">段階</th><th scope="col">イベント</th><th scope="col">計測利用者</th><th scope="col">識別不可イベント</th></tr></thead><tbody>';
        foreach ($report['funnel'] as $row) {
            echo '<tr><th scope="row">' . esc_html($row['label']) . '</th><td>' . esc_html(self::number($row['events']))
                . '</td><td>' . esc_html(self::number($row['people'])) . '</td><td>' . esc_html(self::number($row['unidentified_events'])) . '</td></tr>';
        }
        echo '</tbody></table><h2>アクティベーション</h2><p>登録・個体受領から24時間以内に管理対象への初回記録を作成。ベビー群を主目的とする場合は群作成と初回群記録も対象です。率の分母は24時間の観測を終えた利用者のみです。</p>';
        if ($report['activation']) {
            $a = $report['activation'];
            echo '<p>' . esc_html(self::percentage($a['rate']) . '（' . $a['activated_eligible'] . ' / ' . $a['eligible'] . '人）')
                . '</p><p>' . esc_html('期間内対象 ' . $a['cohort'] . '人、成立 ' . $a['activated'] . '人、観測待ち ' . $a['pending'] . '人') . '</p>';
        } else echo '<p>未計測</p>';
        echo '<h2>継続率</h2><p>期間内に初回アクティベーションした利用者の、UTCでD1・D7・D30当日のアプリセッションを集計します。対象日が終了するまで分母に含めません。計測開始以前のアクティベーションは復元しません。</p>';
        echo '<table class="widefat striped"><thead><tr><th scope="col">日</th><th scope="col">継続</th><th scope="col">観測完了</th><th scope="col">観測待ち</th><th scope="col">率</th></tr></thead><tbody>';
        foreach (array('D1', 'D7', 'D30') as $day) {
            $row = isset($report['retention'][$day]) ? $report['retention'][$day] : array('retained' => null, 'eligible' => null, 'pending' => null, 'rate' => null);
            echo '<tr><th scope="row">' . esc_html($day) . '</th><td>' . esc_html(self::number($row['retained'])) . '</td><td>'
                . esc_html(self::number($row['eligible'])) . '</td><td>' . esc_html(self::number($row['pending'])) . '</td><td>' . esc_html(self::percentage($row['rate'])) . '</td></tr>';
        }
        echo '</tbody></table>';
        $this->render_breakdown('流入元', $report['sources'], false, $report['measurement_started_at']);
        $this->render_breakdown('パートナー／QR発行者（イベント数上位100件）', $report['partners'], true, $report['measurement_started_at']);
        echo '<h2>プラン別計測利用者</h2><p>期間内の最終計測時プランで1人1回集計します。サイトの全登録者数ではありません。</p><table class="widefat striped"><thead><tr><th scope="col">プラン</th><th scope="col">利用者</th></tr></thead><tbody>';
        foreach ($report['plans'] as $row) echo '<tr><th scope="row">' . esc_html($row['dimension']) . '</th><td>' . esc_html((int) $row['people']) . '</td></tr>';
        if (!$report['plans']) echo '<tr><td colspan="2">' . esc_html($report['measurement_started_at'] ? '期間内の計測利用者は0人です。' : '未計測') . '</td></tr>';
        echo '</tbody></table><h2>現在の全ユーザーの実効プラン</h2><p>このサイトの全登録ユーザーを、表示時点の権限で集計します。選択期間やイベントの有無に依存しません。期限切れ試用・支払い猶予を反映し、管理者権限による無制限利用も従来プレミアムに含みます。契約の購入者数とは異なります。</p>';
        if (is_wp_error($report['current_plans'])) {
            echo '<p role="status">' . esc_html($report['current_plans']->get_error_message()) . '</p>';
        } else {
            echo '<table class="widefat striped"><thead><tr><th scope="col">現在の実効プラン</th><th scope="col">ユーザー数</th></tr></thead><tbody>';
            foreach ($report['current_plans'] as $id => $count) echo '<tr><th scope="row">' . esc_html($id) . '</th><td>' . esc_html($count) . '</td></tr>';
            echo '</tbody></table>';
        }
        echo '</div>';
    }

    private function render_breakdown($title, $rows, $partner, $measured)
    {
        echo '<h2>' . esc_html($title) . '</h2><table class="widefat striped"><thead><tr><th scope="col">区分</th><th scope="col">イベント合計</th><th scope="col">計測利用者</th><th scope="col">登録完了</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            $label = $partner ? '発行者 #' . (int) $row['dimension'] : $row['dimension'];
            echo '<tr><th scope="row">' . esc_html($label) . '</th><td>' . esc_html((int) $row['event_count']) . '</td><td>' . esc_html((int) $row['people']) . '</td><td>' . esc_html((int) $row['registrations']) . '</td></tr>';
        }
        if (!$rows) echo '<tr><td colspan="4">' . esc_html($measured ? '期間内の計測は0件です。' : '未計測') . '</td></tr>';
        echo '</tbody></table>';
    }

    private static function number($value) { return $value === null ? '未計測' : (string) (int) $value; }
    private static function percentage($value) { return $value === null ? '未計測（分母なし／観測待ち）' : $value . '%'; }
    private static function query_error() { return new WP_Error('setae_analytics_unavailable', '集計を取得できませんでした。'); }
}
