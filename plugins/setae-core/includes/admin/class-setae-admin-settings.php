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
    }

    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Setae Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'setae_options_group' ); ?>
                <?php do_settings_sections( 'setae_options_group' ); ?>
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

    public function save_ban_field( $user_id ) {
        if ( ! current_user_can( 'edit_user', $user_id ) ) { return false; }
        update_user_meta( $user_id, 'setae_is_banned', isset( $_POST['setae_is_banned'] ) );
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
