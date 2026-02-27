<?php

/**
 * Manage custom user profile fields in WP Admin
 */
class Setae_Admin_Users
{

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
        ?>
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
        if (!current_user_can('manage_options')) {
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
        return $value;
    }
    // --- ここまで追加 ---
}
