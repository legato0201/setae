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
        
        // ▼▼▼ 追加: 料金IDの登録 ▼▼▼
        register_setting('setae_options_group', 'setae_stripe_price_id');
        register_setting('setae_options_group', 'setae_stripe_price_breeder_starter', array('sanitize_callback' => 'sanitize_text_field', 'default' => ''));
        register_setting('setae_options_group', 'setae_plan_breeder_starter_price_label', array('sanitize_callback' => 'sanitize_text_field', 'default' => '月額1,480円'));
        register_setting('setae_options_group', 'setae_billing_grace_days', array('sanitize_callback' => function ($value) { return max(1, min(30, absint($value))); }, 'default' => 7));

        // ChatGPT公開アプリのディレクトリURL
        register_setting('setae_options_group', 'setae_chatgpt_app_url', array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => '',
        ));

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
        $metric_labels = array(
            'public_home_view' => '公開トップ閲覧',
            'register_start' => '登録開始',
            'register_referral_prefill' => '紹介コード自動入力',
            'register_submit_success' => '仮登録完了',
            'register_referral_submit_success' => '紹介経由の仮登録完了',
            'profile_public_link_copy' => '自分の公開プロフィールコピー',
            'profile_qr_open' => '公開プロフィールQR表示',
            'profile_qr_download' => '公開プロフィールQR保存',
            'profile_qr_link_copy' => '公開プロフィールQRからURLコピー',
            'profile_qr_source_change' => '公開プロフィールQR用途変更',
            'public_profile_view' => '公開プロフィール閲覧',
            'public_profile_link_copy' => '公開プロフィールリンクコピー',
            'public_profile_text_copy' => '公開プロフィール紹介文コピー',
            'public_profile_x_click' => '公開プロフィールX共有',
            'public_profile_line_click' => '公開プロフィールLINE共有',
            'partner_page_view' => 'ショップ向けページ閲覧',
            'partner_page_link_copy' => 'ショップ向けページURLコピー',
            'partner_page_text_copy' => 'ショップ向け案内文コピー',
            'partner_page_x_click' => 'ショップ向けページX共有',
            'partner_page_line_click' => 'ショップ向けページLINE共有',
            'email_verified' => 'メール認証完了',
            'empty_my_spiders_seen' => '初回空状態表示',
            'my_spiders_filter_empty_seen' => 'マイ個体検索/条件空表示',
            'my_spiders_filter_reset' => 'マイ個体検索/条件リセット',
            'first_spider_start' => '初回個体登録開始',
            'first_record_prompt_seen' => '初回記録促進表示',
            'first_record_prompt_click' => '初回記録促進クリック',
            'daily_streak_panel_seen' => '連続記録パネル表示',
            'daily_streak_modal_seen' => '連続記録達成表示',
            'daily_streak_calendar_open' => '連続記録カレンダー表示',
            'daily_streak_log_open' => '連続記録から記録詳細',
            'daily_streak_quick_record_open' => '連続記録から記録開始',
            'daily_streak_share_to_feed' => '連続記録からフィード共有',
            'daily_streak_invite_copy' => '連続記録から紹介文コピー',
            'daily_streak_invite_x' => '連続記録からX共有',
            'continue_spider_panel_seen' => '前回の続き表示',
            'continue_spider_open' => '前回の続きから詳細',
            'continue_spider_dismiss' => '前回の続き非表示',
            'detail_spider_nav_click' => '詳細画面の前後移動',
            'detail_topic_click' => '詳細画面から相談',
            'encyclopedia_empty_seen' => '図鑑検索/条件空表示',
            'encyclopedia_empty_reset' => '図鑑検索/条件リセット',
            'encyclopedia_empty_topic_cta' => '図鑑空状態から相談へ',
            'spider_create_success' => '個体登録完了',
            'spider_first_photo_add' => '初回写真追加',
            'baby_group_create' => 'ベビー群作成',
            'baby_bulk_update' => 'ベビー一括記録',
            'baby_filter_change' => 'ベビー表示切替',
            'baby_codes_copy' => 'ベビー番号コピー',
            'baby_label_print' => 'ベビーラベル印刷',
            'baby_csv_download' => 'ベビーCSV保存',
            'baby_range_select' => 'ベビー範囲選択',
            'baby_bulk_invalid_block' => 'ベビー不正番号で一括停止',
            'baby_bulk_large_dead_confirm' => 'ベビー大量死亡確認',
            'today_check_record_click' => '今日の確認から記録',
            'today_check_topic_click' => '今日の確認から相談',
            'log_date_quick_select' => '記録日付クイック選択',
            'log_draft_restored' => '記録下書き復元',
            'log_draft_discard' => '記録下書き破棄',
            'log_note_template_click' => 'メモ候補クリック',
            'log_feed_choice_saved' => '餌/水やり選択を保存',
            'log_save_next_click' => '記録後に次の個体へ',
            'log_create_success' => '記録追加完了',
            'log_create_error' => '記録追加失敗',
            'care_feed_share_success' => 'お世話フィード共有',
            'care_feed_share_link_copy' => '共有リンクコピー',
            'care_feed_share_text_copy' => 'フィード紹介文コピー',
            'care_feed_share_x' => 'フィードX共有',
            'care_feed_share_line' => 'フィードLINE共有',
            'care_feed_activity_panel_seen' => 'フィード反応通知表示',
            'care_feed_activity_open' => 'フィード反応通知から詳細',
            'care_feed_quick_comment_select' => 'フィード定型コメント選択',
            'care_feed_comment_success' => 'フィードコメント投稿完了',
            'care_feed_comment_cta_open' => 'フィードコメント導線クリック',
            'care_feed_preview_comment_open' => 'フィード最新コメント表示',
            'care_feed_comments_empty_focus' => 'フィード空コメントから入力',
            'care_feed_reply_start' => 'フィード返信開始',
            'care_feed_reply_success' => 'フィード返信投稿完了',
            'care_feed_reply_parent_open' => 'フィード返信元を表示',
            'care_feed_sort_change' => 'フィード並び替え変更',
            'care_feed_empty_seen' => 'フィード空状態表示',
            'care_feed_empty_filter_reset' => 'フィード空状態から全件表示',
            'care_feed_empty_record_cta' => 'フィード空状態から記録へ',
            'care_share_view' => '共有ページ閲覧',
            'care_share_link_copy' => '共有ページリンクコピー',
            'care_share_text_copy' => '共有ページ紹介文コピー',
            'care_share_x_click' => '共有ページX共有',
            'care_share_line_click' => '共有ページLINE共有',
            'bl_empty_seen' => '旧繁殖募集の空状態表示',
            'bl_empty_my_spiders_cta' => '旧繁殖募集からマイ個体へ',
            'bl_empty_board_cta' => '旧繁殖募集から募集一覧へ',
            'topic_comment_success' => '相談コメント投稿完了',
            'topic_draft_restored' => '相談下書き復元',
            'topic_draft_discard' => '相談下書き破棄',
            'topic_comment_template_select' => '相談コメント定型文選択',
            'topic_comment_empty_focus' => '相談コメント空状態から入力',
            'topic_comment_reply_start' => '相談コメント返信開始',
            'topic_comment_read_from_start' => '相談コメントを最初から読む',
            'community_empty_seen' => 'コミュニティ空表示',
            'community_empty_reset' => 'コミュニティ空状態から条件リセット',
            'community_empty_topic_cta' => 'コミュニティ空状態から相談作成',
            'community_topic_created_open_detail' => '相談作成後に詳細表示',
        );
        $recent_metrics = $this->get_recent_metrics(7);
        ?>
        <div class="wrap">
            <h1>Setae Settings</h1>

            <h2>利用ファネル（直近7日）</h2>
            <table class="widefat striped" style="max-width: 980px; margin-bottom: 24px;">
                <thead>
                    <tr>
                        <th>日付</th>
                        <?php foreach ($metric_labels as $label): ?>
                            <th><?php echo esc_html($label); ?></th>
                        <?php endforeach; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recent_metrics as $date_key => $metrics): ?>
                        <tr>
                            <th scope="row"><?php echo esc_html(substr($date_key, 0, 4) . '-' . substr($date_key, 4, 2) . '-' . substr($date_key, 6, 2)); ?></th>
                            <?php foreach ($metric_labels as $event_key => $label): ?>
                                <td><?php echo esc_html(isset($metrics[$event_key]) ? (int) $metrics[$event_key] : 0); ?></td>
                            <?php endforeach; ?>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <form method="post" action="options.php">
                <?php settings_fields( 'setae_options_group' ); ?>
                <?php do_settings_sections( 'setae_options_group' ); ?>

                <h2>Stripe 決済連携</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">接続準備状況</th>
                        <td>
                            <?php
                            $stripe_checks = array(
                                'Stripe PHP SDK' => class_exists('\Stripe\StripeClient'),
                                'シークレットキー' => (bool) get_option('setae_stripe_secret_key'),
                                'Webhook シークレット' => (bool) get_option('setae_stripe_webhook_secret'),
                                'Breeder Starter 料金ID' => (bool) get_option('setae_stripe_price_breeder_starter'),
                            );
                            foreach ($stripe_checks as $label => $is_ready) :
                                $color = $is_ready ? '#137333' : '#b3261e';
                                $status = $is_ready ? '設定済み' : '未設定';
                                ?>
                                <span style="display:inline-block;margin:0 12px 6px 0;color:<?php echo esc_attr($color); ?>;font-weight:600;">
                                    <?php echo esc_html($label . ': ' . $status); ?>
                                </span>
                            <?php endforeach; ?>
                            <?php if (class_exists('\Stripe\Stripe')) : ?>
                                <p class="description">SDK version: <?php echo esc_html(\Stripe\Stripe::VERSION); ?></p>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">シークレットキー</th>
                        <td><input type="password" name="setae_stripe_secret_key" value="<?php echo esc_attr(get_option('setae_stripe_secret_key')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Webhook シークレット</th>
                        <td><input type="password" name="setae_stripe_webhook_secret" value="<?php echo esc_attr(get_option('setae_stripe_webhook_secret')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">従来プレミアム料金ID (互換用)</th>
                        <td>
                            <input type="text" name="setae_stripe_price_id" value="<?php echo esc_attr(get_option('setae_stripe_price_id')); ?>" class="regular-text" placeholder="price_xxxxxxxx" />
                            <p class="description">既存契約の照合に使います。削除しないでください。新規Breeder Starterの決済には使いません。</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Breeder Starter 料金ID</th>
                        <td><input type="text" name="setae_stripe_price_breeder_starter" value="<?php echo esc_attr(get_option('setae_stripe_price_breeder_starter', '')); ?>" class="regular-text" placeholder="price_…" />
                            <p class="description">Stripeに設定した月額の継続料金ID。未設定時は新規申込みを「現在準備中」にします。</p></td>
                    </tr>
                    <tr>
                        <th scope="row">Breeder Starter 表示価格</th>
                        <td><input type="text" name="setae_plan_breeder_starter_price_label" value="<?php echo esc_attr(get_option('setae_plan_breeder_starter_price_label', '月額1,480円')); ?>" class="regular-text" />
                            <p class="description">表示文だけを変更します。課金額は上のPrice IDで決まります。必ずStripeの金額と一致させてください。</p></td>
                    </tr>
                    <tr>
                        <th scope="row">支払い遅延時の猶予日数</th>
                        <td><input type="number" min="1" max="30" name="setae_billing_grace_days" value="<?php echo esc_attr(get_option('setae_billing_grace_days', 7)); ?>" /> 日
                            <p class="description">既定7日。猶予終了後も既存個体の閲覧・編集・記録・エクスポートは維持します。</p></td>
                    </tr>
                </table>
                <?php
                $billing_review_users = get_users(array(
                    'fields' => 'ID', 'number' => 101,
                    'meta_query' => array('relation' => 'OR',
                        array('key' => '_setae_billing_warning', 'compare' => 'EXISTS'),
                        array('relation' => 'AND',
                            array('key' => '_setae_stripe_customer_id', 'value' => '', 'compare' => '!='),
                            array('key' => '_setae_stripe_subscription_id', 'compare' => 'NOT EXISTS'),
                        ),
                    ),
                ));
                if ($billing_review_users) : ?>
                    <div class="notice notice-warning inline"><p><?php echo esc_html(count($billing_review_users) > 100 ? '契約情報の確認が必要なユーザーが100人以上います。' : '契約情報の確認が必要なユーザーが' . count($billing_review_users) . '人います。'); ?>
                        旧Stripe情報が不足している場合は推測でプランを下げません。Stripeの契約状況とユーザーのプランを確認してください。</p></div>
                <?php endif; ?>

                <h2>ChatGPT App 連携</h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">MCPサーバーURL</th>
                        <td>
                            <code><?php echo esc_html(rest_url('setae/v1/chatgpt/mcp')); ?></code>
                            <p class="description">OpenAIのプラグイン申請で使用する公開MCPエンドポイントです。OpenAPIスキーマは使用しません。</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">OAuthメタデータ</th>
                        <td>
                            <code><?php echo esc_html(home_url('/.well-known/oauth-authorization-server')); ?></code><br>
                            <code><?php echo esc_html(home_url('/.well-known/oauth-protected-resource')); ?></code>
                            <p class="description">ChatGPTのCIMD、PKCE、OAuth 2.1によるユーザー認証に使用します。</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">公開アプリURL</th>
                        <td>
                            <input
                                type="url"
                                name="setae_chatgpt_app_url"
                                value="<?php echo esc_attr(get_option('setae_chatgpt_app_url', '')); ?>"
                                class="regular-text"
                                placeholder="https://chatgpt.com/..."
                            >
                            <p class="description">OpenAIの審査通過後に、Plugin DirectoryのSETAEページURLを設定します。ユーザー画面の「ChatGPTで接続」に使われます。</p>
                        </td>
                    </tr>
                </table>

                <h2>ユーザー制限</h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">通常ユーザーの生体登録上限</th>
                        <td>
                            <input type="number" name="setae_free_spider_limit" value="<?php echo esc_attr(get_option('setae_free_spider_limit', SETAE_DEFAULT_FREE_SPIDER_LIMIT)); ?>" class="small-text" /> 匹
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

    private function get_recent_metrics($days = 7) {
        $rows = array();
        $now = time();

        for ($i = 0; $i < $days; $i++) {
            $date_key = gmdate('Ymd', $now - ($i * DAY_IN_SECONDS));
            $metrics = get_option('setae_metrics_' . $date_key, array());
            $rows[$date_key] = is_array($metrics) ? $metrics : array();
        }

        return $rows;
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
        $columns['setae_ip'] = 'IPアドレス';
        $columns['setae_spiders'] = '登録個体';
        $columns['setae_status'] = '状態';
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
            $plan = Setae_Entitlements::get_plan_id($user_id);
            $plans = Setae_Entitlements::get_plan_catalog();
            $inventory = Setae_Entitlements::get_inventory_usage($user_id);
            $limit = $inventory['limit'] < 0 ? '無制限' : (string) $inventory['limit'];
            return esc_html($plans[$plan]['label']) . '<br><small>'
                . esc_html(sprintf('有効枠 %d / %s ・受領 %d（枠外）', $inventory['active_slot_bearing'], $limit, $inventory['received_exempt']))
                . '</small>';
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
        
        $plan = Setae_Entitlements::get_plan_id($user->ID);
        $plans = Setae_Entitlements::get_plan_catalog();
        $bonus_limit = get_user_meta($user->ID, '_setae_bonus_spider_limit', true);
        wp_nonce_field('setae_plan_profile_' . $user->ID, 'setae_plan_profile_nonce');
        ?>
        <h3>Setae ユーザー設定</h3>
        <table class="form-table">
            <tr>
                <th><label for="setae_plan_override">プラン</label></th>
                <td>
                    <p><?php echo esc_html($plans[$plan]['label'] . ' / ' . Setae_Entitlements::get_plan_status($user->ID)); ?></p>
                    <select name="setae_plan_override" id="setae_plan_override">
                        <option value="">変更しない</option>
                        <?php foreach (array('keeper_free', 'breeder_starter', 'legacy_premium') as $id) : ?>
                            <option value="<?php echo esc_attr($id); ?>"><?php echo esc_html($plans[$id]['label']); ?></option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description">明示的な管理者変更です。Legacy Premiumは既存の無制限枠です。試用の開始・再設定はできません。Stripeの契約自体は変更しません。</p>
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
        if (!current_user_can('manage_options') || !current_user_can('edit_user', $user_id)) return false;
        if (empty($_POST['setae_plan_profile_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['setae_plan_profile_nonce'])), 'setae_plan_profile_' . $user_id)) {
            return false;
        }
        if (!empty($_POST['setae_plan_override'])) {
            $updated = Setae_Entitlements::set_admin_plan($user_id, sanitize_key(wp_unslash($_POST['setae_plan_override'])));
            if (is_wp_error($updated)) { return false; }
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
