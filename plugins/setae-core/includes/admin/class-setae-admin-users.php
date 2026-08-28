<?php

/**
 * Manage custom user profile fields in WP Admin
 */
class Setae_Admin_Users
{
    const BONUS_SLOT_BULK_ACTION = 'setae_add_bonus_slots';
    const BONUS_SLOT_BATCH_TTL = 900;


    /**
     * Add custom fields to user profile
     *
     * @param WP_User $user
     */
    public function add_custom_user_profile_fields($user)
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $plan_id = Setae_Entitlements::get_plan_id($user->ID);
        $plans = Setae_Entitlements::get_plan_catalog();
        $trial = Setae_Entitlements::get_trial_state($user->ID);
        $inventory = Setae_Entitlements::get_inventory_usage($user->ID);
        $nursery = Setae_Entitlements::get_nursery_usage($user->ID);
        wp_nonce_field('setae_billing_profile_' . $user->ID, 'setae_billing_profile_nonce');
        ?>
        <h3>SETAE 利用権限</h3>
        <table class="form-table">
            <tr><th>現在のプラン</th><td><?php echo esc_html($plans[$plan_id]['label'] . ' / ' . Setae_Entitlements::get_plan_status($user->ID)); ?></td></tr>
            <tr><th>有効な個体枠</th><td><?php echo esc_html($inventory['active_slot_bearing'] . ' / ' . ($inventory['limit'] < 0 ? '無制限' : $inventory['limit'])); ?> （受領 <?php echo esc_html($inventory['received_exempt']); ?>・アーカイブ <?php echo esc_html($inventory['archived']); ?> は枠外）</td></tr>
            <tr><th>有効なベビー群</th><td><?php echo esc_html($nursery['active_groups'] . ' / ' . ($nursery['limit'] < 0 ? '無制限' : $nursery['limit'])); ?></td></tr>
            <tr><th>試用の利用状況</th><td><?php echo esc_html($trial['used'] ? '使用済み' : '未使用'); ?>・累計昇格 <?php echo esc_html($trial['promoted_count']); ?> 匹<?php if ($trial['ends_at']) : ?>・終了 <?php echo esc_html($trial['ends_at']); ?><?php endif; ?></td></tr>
            <?php $billing_warning = sanitize_key(get_user_meta($user->ID, '_setae_billing_warning', true)); if ($billing_warning) : ?>
                <tr><th>契約情報の確認</th><td><?php echo esc_html('確認が必要です: ' . $billing_warning); ?><p class="description">情報不足だけで旧プランを変更しないでください。Stripeの契約と保存済みプランを照合してください。</p></td></tr>
            <?php endif; ?>
        </table>
        <h3>Stripe 決済情報 (Setae)</h3>
        <table class="form-table">
            <tr>
                <th><label for="_setae_stripe_customer_id">Stripe 顧客ID</label></th>
                <td>
                    <input type="text" name="_setae_stripe_customer_id" id="_setae_stripe_customer_id"
                        value="<?php echo esc_attr(get_user_meta($user->ID, '_setae_stripe_customer_id', true)); ?>"
                        class="regular-text" /><br />
                    <span class="description">例: cus_XXXXXXX (空白の場合はWebhookの解約処理などが連動しません)</span>
                </td>
            </tr>
            <tr>
                <th><label for="_setae_premium_cancel_at">プレミアム解約予定日 (UNIX)</label></th>
                <td>
                    <input type="text" name="_setae_premium_cancel_at" id="_setae_premium_cancel_at"
                        value="<?php echo esc_attr(get_user_meta($user->ID, '_setae_premium_cancel_at', true)); ?>"
                        class="regular-text" /><br />
                    <span class="description" style="color:#d63638; font-weight:bold;">
                        <?php
                        $cancel_at = get_user_meta($user->ID, '_setae_premium_cancel_at', true);
                        if ($cancel_at) {
                            // タイムゾーンを考慮して日時を表示
                            echo '現在設定されている解約日: ' . wp_date('Y年m月d日 H:i:s', $cancel_at);
                        } else {
                            echo '<span style="color:#00a32a;">設定なし（自動更新有効、または無料プラン）</span>';
                        }
                        ?>
                    </span>
                </td>
            </tr>
            // --- ここから追加 ---
            <tr>
                <th><label>最終ログイン</label></th>
                <td>
                    <?php
                    $last_login = get_user_meta($user->ID, '_setae_last_login', true);
                    if ($last_login) {
                        echo wp_date('Y年m月d日 H:i:s', $last_login);
                    } else {
                        echo '<span style="color:#777;">記録なし</span>';
                    }
                    ?>
                </td>
            </tr>
            // --- ここまで追加 ---
        </table>
        <?php
    }

    /**
     * Save custom fields from user profile
     *
     * @param int $user_id
     */
    public function save_custom_user_profile_fields($user_id)
    {
        if (!current_user_can('manage_options') || !current_user_can('edit_user', $user_id)) {
            return false;
        }
        if (empty($_POST['setae_billing_profile_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['setae_billing_profile_nonce'])), 'setae_billing_profile_' . $user_id)) {
            return false;
        }
        if (isset($_POST['_setae_stripe_customer_id'])) {
            update_user_meta($user_id, '_setae_stripe_customer_id', sanitize_text_field($_POST['_setae_stripe_customer_id']));
        }
        if (isset($_POST['_setae_premium_cancel_at'])) {
            update_user_meta($user_id, '_setae_premium_cancel_at', sanitize_text_field($_POST['_setae_premium_cancel_at']));
        }
    }

    // --- ここから追加 ---
    /**
     * ログイン時に最終ログイン日時を記録する
     *
     * @param string $user_login
     * @param WP_User $user
     */
    public function record_last_login($user_login, $user)
    {
        update_user_meta($user->ID, '_setae_last_login', current_time('timestamp'));
    }

    /**
     * ユーザー一覧画面に最終ログインカラムを追加する
     *
     * @param array $columns
     * @return array
     */
    public function add_last_login_column($columns)
    {
        $columns['setae_last_login'] = '最終ログイン';

        // ↓↓↓ 変更: メモ登録数カラムの定義 ↓↓↓
        $columns['setae_log_count'] = 'メモ登録数';
        // ↑↑↑ ここまで ↑↑↑

        return $columns;
    }

    /**
     * ユーザー一覧画面の最終ログインカラムに値を表示する
     *
     * @param string $value
     * @param string $column_name
     * @param int $user_id
     * @return string
     */
    public function show_last_login_column($value, $column_name, $user_id)
    {
        if ('setae_last_login' === $column_name) {
            $last_login = get_user_meta($user_id, '_setae_last_login', true);
            if ($last_login) {
                return wp_date('Y/m/d H:i:s', $last_login);
            }
            return '<span style="color:#777;">記録なし</span>';
        }

        // ↓↓↓ 変更: メモ(ログ)登録数の取得と表示 ↓↓↓
        if ('setae_log_count' === $column_name) {
            $log_count = count_user_posts($user_id, 'setae_log');
            return intval($log_count);
        }
        // ↑↑↑ ここまで ↑↑↑

        return $value;
    }

    /**
     * Add the SETAE bonus-slot command to the Users bulk action menu.
     *
     * @param array $actions
     * @return array
     */
    public function register_bonus_slot_bulk_action($actions)
    {
        if (current_user_can('manage_options')) {
            $actions[self::BONUS_SLOT_BULK_ACTION] = 'SETAE：無料枠を一括追加…';
        }

        return $actions;
    }

    /**
     * Store the selected users briefly and open the confirmation panel.
     *
     * @param string $redirect_url
     * @param string $action
     * @param array $user_ids
     * @return string
     */
    public function handle_bonus_slot_bulk_action($redirect_url, $action, $user_ids)
    {
        if (self::BONUS_SLOT_BULK_ACTION !== $action) {
            return $redirect_url;
        }

        if (!current_user_can('manage_options')) {
            return add_query_arg('setae_bonus_error', 'forbidden', admin_url('users.php'));
        }

        $user_ids = $this->normalize_user_ids($user_ids);
        $user_ids = array_values(array_filter($user_ids, 'get_userdata'));
        if (empty($user_ids)) {
            return add_query_arg('setae_bonus_error', 'no_users', admin_url('users.php'));
        }

        $token = sanitize_key(wp_generate_password(20, false, false));
        $return_url = remove_query_arg(array(
            'setae_bonus_batch',
            'setae_bonus_error',
            'setae_bonus_granted',
            'setae_bonus_amount',
            'setae_bonus_skipped',
        ), wp_validate_redirect($redirect_url, admin_url('users.php')));
        $batch = array(
            'user_ids' => $user_ids,
            'return_url' => $return_url,
            'created_at' => time(),
        );

        if (!set_transient($this->get_bonus_slot_batch_key($token), $batch, self::BONUS_SLOT_BATCH_TTL)) {
            return add_query_arg('setae_bonus_error', 'storage', admin_url('users.php'));
        }

        return add_query_arg('setae_bonus_batch', $token, admin_url('users.php'));
    }

    /**
     * Render status messages and the bulk grant confirmation form.
     */
    public function render_bonus_slot_admin_notice()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || 'users' !== $screen->id) {
            return;
        }

        $this->render_bonus_slot_result_notice();

        $token = isset($_GET['setae_bonus_batch'])
            ? sanitize_key(wp_unslash($_GET['setae_bonus_batch']))
            : '';
        if (!$token) {
            return;
        }

        $batch = get_transient($this->get_bonus_slot_batch_key($token));
        if (!is_array($batch) || empty($batch['user_ids'])) {
            echo '<div class="notice notice-error"><p>無料枠の一括付与セッションが期限切れです。ユーザーを選び直してください。</p></div>';
            return;
        }

        $users = array();
        foreach ($this->normalize_user_ids($batch['user_ids']) as $user_id) {
            $user = get_userdata($user_id);
            if ($user) {
                $users[] = $user;
            }
        }
        if (empty($users)) {
            echo '<div class="notice notice-error"><p>付与対象のユーザーが見つかりませんでした。</p></div>';
            return;
        }

        $visible_users = array_slice($users, 0, 12);
        $remaining_count = count($users) - count($visible_users);
        ?>
        <div class="notice notice-info setae-bonus-grant-notice">
            <h2>SETAE 無料枠を一括追加</h2>
            <p>
                選択した<strong><?php echo esc_html(count($users)); ?>人</strong>の現在のボーナス枠へ、
                1人あたり同じ数を加算します。既存の枠数は置き換えません。
            </p>
            <div class="setae-bonus-grant-users" aria-label="付与対象ユーザー">
                <?php foreach ($visible_users as $user): ?>
                    <?php $current_bonus = max(0, (int) get_user_meta($user->ID, '_setae_bonus_spider_limit', true)); ?>
                    <span>
                        <?php echo esc_html($user->display_name ?: $user->user_login); ?>
                        <small>現在 +<?php echo esc_html($current_bonus); ?></small>
                    </span>
                <?php endforeach; ?>
                <?php if ($remaining_count > 0): ?>
                    <span>ほか <?php echo esc_html($remaining_count); ?>人</span>
                <?php endif; ?>
            </div>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="setae-bonus-grant-form">
                <input type="hidden" name="action" value="setae_grant_bonus_slots">
                <input type="hidden" name="batch_token" value="<?php echo esc_attr($token); ?>">
                <?php wp_nonce_field('setae_grant_bonus_slots_' . $token); ?>

                <label>
                    <strong>1人あたりの追加枠</strong>
                    <span><input type="number" name="bonus_amount" value="1" min="1" step="1" inputmode="numeric"
                            class="small-text" required> 匹</span>
                </label>
                <label>
                    <strong>付与メモ</strong>
                    <input type="text" name="grant_note" maxlength="160" class="regular-text"
                        placeholder="例：Xキャンペーン 2026年8月">
                </label>
                <div class="setae-bonus-grant-actions">
                    <?php submit_button('選択ユーザーに追加', 'primary', 'submit', false); ?>
                    <a class="button" href="<?php echo esc_url($this->get_bonus_slot_return_url($batch)); ?>">キャンセル</a>
                </div>
                <p class="description">プレミアム会員にも記録され、無料プランへ戻った場合に追加枠として有効になります。</p>
            </form>
        </div>
        <style>
            .setae-bonus-grant-notice { padding: 16px 18px 18px; }
            .setae-bonus-grant-notice h2 { margin: 0 0 6px; }
            .setae-bonus-grant-users { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px; }
            .setae-bonus-grant-users > span { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid #c3c4c7; border-radius: 4px; background: #f6f7f7; }
            .setae-bonus-grant-users small { color: #50575e; }
            .setae-bonus-grant-form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px 18px; }
            .setae-bonus-grant-form > label { display: grid; gap: 5px; }
            .setae-bonus-grant-actions { display: flex; align-items: center; gap: 8px; }
            .setae-bonus-grant-form .description { flex-basis: 100%; margin: 0; }
            @media (max-width: 782px) {
                .setae-bonus-grant-form, .setae-bonus-grant-form > label { display: grid; width: 100%; }
                .setae-bonus-grant-form .regular-text { width: 100%; }
            }
        </style>
        <?php
    }

    /**
     * Apply the confirmed bonus to the users stored in the admin-bound batch.
     */
    public function handle_bonus_slot_grant()
    {
        if (!current_user_can('manage_options')) {
            wp_die('この操作を実行する権限がありません。', '', array('response' => 403));
        }

        $token = isset($_POST['batch_token'])
            ? sanitize_key(wp_unslash($_POST['batch_token']))
            : '';
        if (!$token) {
            wp_die('一括付与トークンがありません。', '', array('response' => 400));
        }

        check_admin_referer('setae_grant_bonus_slots_' . $token);
        $batch_key = $this->get_bonus_slot_batch_key($token);
        $batch = get_transient($batch_key);
        if (!is_array($batch) || empty($batch['user_ids'])) {
            wp_safe_redirect(add_query_arg('setae_bonus_error', 'expired', admin_url('users.php')));
            exit;
        }

        $amount_raw = isset($_POST['bonus_amount']) ? trim((string) wp_unslash($_POST['bonus_amount'])) : '';
        $amount = filter_var($amount_raw, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
        if (false === $amount) {
            wp_safe_redirect(add_query_arg(array(
                'setae_bonus_batch' => $token,
                'setae_bonus_error' => 'invalid_amount',
            ), admin_url('users.php')));
            exit;
        }

        $note = isset($_POST['grant_note']) ? sanitize_text_field(wp_unslash($_POST['grant_note'])) : '';
        $note = function_exists('mb_substr') ? mb_substr($note, 0, 160, 'UTF-8') : substr($note, 0, 160);
        $result = $this->apply_bonus_slots(
            $batch['user_ids'],
            (int) $amount,
            get_current_user_id(),
            $note
        );

        delete_transient($batch_key);
        $redirect_url = add_query_arg(array(
            'setae_bonus_granted' => $result['updated'],
            'setae_bonus_amount' => (int) $amount,
            'setae_bonus_skipped' => $result['skipped'],
        ), $this->get_bonus_slot_return_url($batch));
        wp_safe_redirect($redirect_url);
        exit;
    }

    /**
     * Add bonus slots to existing values and retain the last grant for auditing.
     *
     * @param array $user_ids
     * @param int $amount
     * @param int $admin_id
     * @param string $note
     * @return array
     */
    public function apply_bonus_slots($user_ids, $amount, $admin_id, $note = '')
    {
        $user_ids = $this->normalize_user_ids($user_ids);
        $amount = absint($amount);
        $admin_id = absint($admin_id);
        $note = sanitize_text_field($note);
        $result = array(
            'updated' => 0,
            'skipped' => 0,
        );

        if ($amount < 1) {
            $result['skipped'] = count($user_ids);
            return $result;
        }

        foreach ($user_ids as $user_id) {
            if (!get_userdata($user_id)) {
                $result['skipped']++;
                continue;
            }

            $previous = max(0, (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true));
            if ($amount > PHP_INT_MAX - $previous) {
                $result['skipped']++;
                continue;
            }

            $total = $previous + $amount;
            if (false === update_user_meta($user_id, '_setae_bonus_spider_limit', $total)) {
                $result['skipped']++;
                continue;
            }

            update_user_meta($user_id, '_setae_bonus_spider_limit_last_grant', array(
                'amount' => $amount,
                'previous' => $previous,
                'total' => $total,
                'admin_id' => $admin_id,
                'note' => $note,
                'granted_at' => current_time('mysql', true),
            ));
            do_action('setae_bonus_spider_limit_granted', $user_id, $amount, $total, $admin_id, $note);
            $result['updated']++;
        }

        return $result;
    }

    private function normalize_user_ids($user_ids)
    {
        return array_values(array_unique(array_filter(array_map('absint', (array) $user_ids))));
    }

    private function get_bonus_slot_batch_key($token)
    {
        return 'setae_bonus_batch_' . get_current_user_id() . '_' . sanitize_key($token);
    }

    private function get_bonus_slot_return_url($batch)
    {
        $return_url = is_array($batch) && !empty($batch['return_url'])
            ? $batch['return_url']
            : admin_url('users.php');
        return wp_validate_redirect($return_url, admin_url('users.php'));
    }

    private function render_bonus_slot_result_notice()
    {
        $error = isset($_GET['setae_bonus_error'])
            ? sanitize_key(wp_unslash($_GET['setae_bonus_error']))
            : '';
        $errors = array(
            'forbidden' => '無料枠を一括付与する権限がありません。',
            'no_users' => '付与対象のユーザーを選択してください。',
            'storage' => '一括付与の準備に失敗しました。もう一度お試しください。',
            'expired' => '一括付与セッションが期限切れです。ユーザーを選び直してください。',
            'invalid_amount' => '追加枠には1以上の整数を入力してください。',
        );
        if ($error && isset($errors[$error])) {
            echo '<div class="notice notice-error"><p>' . esc_html($errors[$error]) . '</p></div>';
        }

        if (!isset($_GET['setae_bonus_granted'], $_GET['setae_bonus_amount'])) {
            return;
        }

        $updated = absint($_GET['setae_bonus_granted']);
        $amount = absint($_GET['setae_bonus_amount']);
        $skipped = isset($_GET['setae_bonus_skipped']) ? absint($_GET['setae_bonus_skipped']) : 0;
        $message = sprintf('%1$d人に、1人あたり無料枠を+%2$d匹追加しました。', $updated, $amount);
        if ($skipped) {
            $message .= sprintf(' %d人は更新できなかったためスキップしました。', $skipped);
        }
        echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($message) . '</p></div>';
    }
    // --- ここまで追加 ---
}
