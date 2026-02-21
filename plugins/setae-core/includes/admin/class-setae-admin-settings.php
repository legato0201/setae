<?php

class Setae_Admin_Settings {

    public function __construct() {
        // SMTP Settings
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'phpmailer_init', array( $this, 'configure_smtp' ) );

        // User Columns
        add_filter( 'manage_users_columns', array( $this, 'add_user_columns' ) );
        add_action( 'manage_users_custom_column', array( $this, 'show_user_columns' ), 10, 3 );
        
        // Tracking & Ban
        add_action( 'wp_login', array( $this, 'capture_login_ip' ), 10, 2 );
        add_action( 'user_register', array( $this, 'capture_register_ip' ) );
        add_filter( 'authenticate', array( $this, 'check_ban_status' ), 30, 3 );
        
        // Admin Profile Fields for BAN
        add_action( 'show_user_profile', array( $this, 'add_ban_field' ) );
        add_action( 'edit_user_profile', array( $this, 'add_ban_field' ) );
        add_action( 'personal_options_update', array( $this, 'save_ban_field' ) );
        add_action( 'edit_user_profile_update', array( $this, 'save_ban_field' ) );

        // ▼▼▼ 新規追加: ユーザー編集画面での権限・ボーナス枠操作 ▼▼▼
        add_action('show_user_profile', array($this, 'add_custom_user_profile_fields'));
        add_action('edit_user_profile', array($this, 'add_custom_user_profile_fields'));
        add_action('personal_options_update', array($this, 'save_custom_user_profile_fields'));
        add_action('edit_user_profile_update', array($this, 'save_custom_user_profile_fields'));
        // ▲▲▲ 新規追加ここまで ▲▲▲
    }

    // --- SMTP Settings ---

    public function add_admin_menu() {
        add_options_page( 'Setae Settings', 'Setae Settings', 'manage_options', 'setae_settings', array( $this, 'render_settings_page' ) );
    }

    public function register_settings() {
        register_setting( 'setae_options_group', 'setae_smtp_host' );
        register_setting( 'setae_options_group', 'setae_smtp_port' );
        register_setting( 'setae_options_group', 'setae_smtp_user' );
        register_setting( 'setae_options_group', 'setae_smtp_pass' );
        register_setting( 'setae_options_group', 'setae_smtp_from' );

        // Registration Settings
        register_setting('setae_options_group', 'setae_enable_registration');
        // ▼ 追加: 利用規約URLの設定
        register_setting('setae_options_group', 'setae_tos_url');

        // Stripe設定
        register_setting('setae_options_group', 'setae_stripe_secret_key');
        register_setting('setae_options_group', 'setae_stripe_webhook_secret');
        // 基本の生体登録上限数
        register_setting('setae_options_group', 'setae_free_spider_limit', array(
            'type' => 'integer',
            'default' => 5,
            'sanitize_callback' => 'absint'
        ));

        add_settings_section(
            'setae_general_section',
            'General Settings',
            null,
            'setae_options_group'
        );

        add_settings_field(
            'setae_enable_registration',
            '新規ユーザー登録',
            array($this, 'render_checkbox_field'),
            'setae_options_group',
            'setae_general_section',
            array(
                'label_for' => 'setae_enable_registration',
                'description' => 'ログイン画面に「新規登録」ボタンを表示し、登録を受け付ける'
            )
        );

        // ▼ 追加: 利用規約URLフィールドの表示
        add_settings_field(
            'setae_tos_url',
            '利用規約ページURL',
            array($this, 'render_input_field'), // 汎用入力メソッドを使用
            'setae_options_group',
            'setae_general_section',
            array(
                'label_for' => 'setae_tos_url',
                'description' => '新規登録画面のリンク先となる利用規約ページのURL（例: /terms/）'
            )
        );
    }

    // ▼ 追加: テキスト入力フィールド描画用
    public function render_input_field($args) {
        $option_name = $args['label_for'];
        $value = get_option($option_name);
        echo '<input type="text" id="' . esc_attr($option_name) . '" name="' . esc_attr($option_name) . '" value="' . esc_attr($value) . '" class="regular-text" />';
        if (isset($args['description'])) {
            echo '<p class="description">' . esc_html($args['description']) . '</p>';
        }
    }

    public function render_checkbox_field($args) {
        $option_name = $args['label_for'];
        $value = get_option($option_name);
        echo '<input type="checkbox" id="' . esc_attr($option_name) . '" name="' . esc_attr($option_name) . '" value="1" ' . checked(1, $value, false) . ' />';
        if (isset($args['description'])) {
            echo '<p class="description">' . esc_html($args['description']) . '</p>';
        }
    }

    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Setae Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'setae_options_group' ); ?>
                <?php do_settings_sections( 'setae_options_group' ); ?>

                <h2>Stripe 決済連携</h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">シークレットキー</th>
                        <td><input type="password" name="setae_stripe_secret_key" value="<?php echo esc_attr(get_option('setae_stripe_secret_key')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Webhook シークレット</th>
                        <td><input type="password" name="setae_stripe_webhook_secret" value="<?php echo esc_attr(get_option('setae_stripe_webhook_secret')); ?>" class="regular-text" /></td>
                    </tr>
                </table>

                <h2>ユーザー制限</h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">通常ユーザーの生体登録上限</th>
                        <td>
                            <input type="number" name="setae_free_spider_limit" value="<?php echo esc_attr(get_option('setae_free_spider_limit', 5)); ?>" class="small-text" /> 匹
                            <p class="description">無料プランのユーザーが登録できるデフォルトの上限数です。</p>
                        </td>
                    </tr>
                </table>

                <h2>SMTP Configuration</h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">SMTP Host</th>
                        <td><input type="text" name="setae_smtp_host" value="<?php echo esc_attr( get_option('setae_smtp_host') ); ?>" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">SMTP Port</th>
                        <td><input type="text" name="setae_smtp_port" value="<?php echo esc_attr( get_option('setae_smtp_port') ); ?>" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">SMTP User</th>
                        <td><input type="text" name="setae_smtp_user" value="<?php echo esc_attr( get_option('setae_smtp_user') ); ?>" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">SMTP Password</th>
                        <td><input type="password" name="setae_smtp_pass" value="<?php echo esc_attr( get_option('setae_smtp_pass') ); ?>" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">From Email</th>
                        <td><input type="text" name="setae_smtp_from" value="<?php echo esc_attr( get_option('setae_smtp_from') ); ?>" /></td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function configure_smtp( $phpmailer ) {
        $host = get_option( 'setae_smtp_host' );
        if ( ! empty( $host ) ) {
            $phpmailer->isSMTP();
            $phpmailer->Host = $host;
            $phpmailer->Port = get_option( 'setae_smtp_port', 587 );
            $phpmailer->SMTPAuth = true;
            $phpmailer->Username = get_option( 'setae_smtp_user' );
            $phpmailer->Password = get_option( 'setae_smtp_pass' );
            $phpmailer->SMTPSecure = 'tls';
            $phpmailer->From = get_option( 'setae_smtp_from' );
            $phpmailer->FromName = 'SETAE Platform';
        }
    }

    // --- User Columns (IP, Spiders) ---

    public function add_user_columns( $columns ) {
        $columns['setae_ip'] = 'IP Address';
        $columns['setae_spiders'] = 'My Spiders';
        $columns['setae_status'] = 'Status';
        $columns['setae_plan'] = 'プラン・登録枠'; // ▼追加
        return $columns;
    }

    public function show_user_columns( $value, $column_name, $user_id ) {
        if ( 'setae_ip' == $column_name ) {
            return get_user_meta( $user_id, 'setae_last_ip', true ) ?: '-';
        }
        if ( 'setae_spiders' == $column_name ) {
            $count = count_user_posts( $user_id, 'setae_spider' ); // Assuming strict CPT 'setae_spider'
            return $count . ' 匹';
        }
        if ( 'setae_status' == $column_name ) {
             $banned = get_user_meta( $user_id, 'setae_is_banned', true );
             return $banned ? '<span style="color:red;font-weight:bold;">BANNED</span>' : '<span style="color:green;">Active</span>';
        }
        if ($column_name === 'setae_plan') {
            $is_premium = get_user_meta($user_id, '_setae_is_premium', true);
            $bonus_limit = (int) get_user_meta($user_id, '_setae_bonus_spider_limit', true);
            
            $plan_badge = $is_premium 
                ? '<span style="background:#FDB931; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">PREMIUM</span>' 
                : '<span style="background:#eee; color:#666; padding:2px 6px; border-radius:4px; font-size:11px;">通常</span>';
            
            $bonus_text = $bonus_limit > 0 ? "<br><small>ボーナス枠: +{$bonus_limit}</small>" : "";

            return $plan_badge . $bonus_text;
        }
        return $value;
    }

    // --- Tracking & Ban Logic ---

    public function capture_login_ip( $user_login, $user ) {
        update_user_meta( $user->ID, 'setae_last_ip', $_SERVER['REMOTE_ADDR'] );
        update_user_meta( $user->ID, 'setae_last_login', current_time( 'mysql' ) );
    }

    public function capture_register_ip( $user_id ) {
        update_user_meta( $user_id, 'setae_register_ip', $_SERVER['REMOTE_ADDR'] );
        update_user_meta( $user_id, 'setae_last_ip', $_SERVER['REMOTE_ADDR'] );
    }

    public function add_ban_field( $user ) {
        $is_banned = get_user_meta( $user->ID, 'setae_is_banned', true );
        ?>
        <h3>SETAE Account Status</h3>
        <table class="form-table">
            <tr>
                <th><label for="setae_is_banned">Ban User</label></th>
                <td>
                    <input type="checkbox" name="setae_is_banned" id="setae_is_banned" value="1" <?php checked( $is_banned, 1 ); ?> />
                    <span class="description">Check this box to ban the user from logging in.</span>
                </td>
            </tr>
        </table>
        <?php
    }

    // ユーザー編集画面へのフィールド追加
    public function add_custom_user_profile_fields($user)
    {
        // 管理者のみ操作可能にする
        if (!current_user_can('manage_options')) return;
        
        $is_premium = get_user_meta($user->ID, '_setae_is_premium', true);
        $bonus_limit = get_user_meta($user->ID, '_setae_bonus_spider_limit', true);
        ?>
        <h3>Setae ユーザー設定</h3>
        <table class="form-table">
            <tr>
                <th><label for="_setae_is_premium">プレミアムプラン</label></th>
                <td>
                    <label>
                        <input type="checkbox" name="_setae_is_premium" id="_setae_is_premium" value="1" <?php checked($is_premium, 1); ?> />
                        このユーザーをプレミアム会員にする
                    </label>
                    <p class="description">※通常はStripeのWebhookで自動で切り替わります。手動で付与・剥奪する場合に使用します。</p>
                </td>
            </tr>
            <tr>
                <th><label for="_setae_bonus_spider_limit">ボーナス登録枠 (匹)</label></th>
                <td>
                    <input type="number" name="_setae_bonus_spider_limit" id="_setae_bonus_spider_limit" value="<?php echo esc_attr($bonus_limit ?: 0); ?>" class="regular-text" />
                    <p class="description">図鑑提供やベストショット採用で付与された追加枠です。手動で調整可能です。</p>
                </td>
            </tr>
        </table>
        <?php
    }

    public function save_ban_field( $user_id ) {
        if ( ! current_user_can( 'edit_user', $user_id ) ) { return false; }
        update_user_meta( $user_id, 'setae_is_banned', isset( $_POST['setae_is_banned'] ) );
    }

    // ユーザー保存時の処理
    public function save_custom_user_profile_fields($user_id)
    {
        if (!current_user_can('manage_options')) return false;

        if (isset($_POST['_setae_is_premium'])) {
            update_user_meta($user_id, '_setae_is_premium', 1);
        } else {
            delete_user_meta($user_id, '_setae_is_premium');
        }

        if (isset($_POST['_setae_bonus_spider_limit'])) {
            update_user_meta($user_id, '_setae_bonus_spider_limit', absint($_POST['_setae_bonus_spider_limit']));
        }
    }

    public function check_ban_status( $user, $username, $password ) {
        if ( is_a( $user, 'WP_User' ) ) {
            if ( get_user_meta( $user->ID, 'setae_is_banned', true ) ) {
                return new WP_Error( 'banned', 'Your account has been suspended.' );
            }
        }
        return $user;
    }

}
