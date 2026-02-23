<?php

class Setae_CPT_Ad
{

    public function __construct()
    {
        add_action('init', array($this, 'register_cpt'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_meta_boxes'));

        // ▼ 追加: REST APIの登録
        add_action('rest_api_init', array($this, 'register_api_routes'));
    }

    public function register_cpt()
    {
        $labels = array(
            'name' => '広告管理',
            'singular_name' => '広告',
            'menu_name' => '広告管理',
            'add_new' => '新規追加',
            'add_new_item' => '新しい広告を追加',
            'edit_item' => '広告を編集',
            'new_item' => '新しい広告',
            'search_items' => '広告を検索',
            'not_found' => '広告が見つかりません',
        );

        $args = array(
            'labels' => $labels,
            'public' => false, // フロントの単独ページは持たせない
            'show_ui' => true,
            // ★Species（種）のサブメニューとして配置
            'show_in_menu' => 'edit.php?post_type=setae_species',
            'supports' => array('title'), // タイトルは「依頼主名」や「管理名」として使用
            'hierarchical' => false,
            'has_archive' => false,
        );

        register_post_type('setae_ad', $args);
    }

    public function add_meta_boxes()
    {
        add_meta_box(
            'setae_ad_settings',
            '広告設定',
            array($this, 'render_meta_box'),
            'setae_ad',
            'normal',
            'high'
        );
    }

    public function render_meta_box($post)
    {
        wp_nonce_field('setae_ad_save', 'setae_ad_nonce');

        $ad_html = get_post_meta($post->ID, '_setae_ad_html', true);
        $target_type = get_post_meta($post->ID, '_setae_ad_target_type', true) ?: 'all';
        $target_species = get_post_meta($post->ID, '_setae_ad_target_species', true) ?: array();

        // ▼ 追加: 掲載期間のデータを取得
        $start_date = get_post_meta($post->ID, '_setae_ad_start_date', true);
        $end_date = get_post_meta($post->ID, '_setae_ad_end_date', true);

        // 登録されている種（Species）の一覧を取得
        $species_posts = get_posts(array(
            'post_type' => 'setae_species',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC'
        ));
        ?>
        <div style="padding: 10px 0;">
            <p>
                <label style="font-weight:bold;">広告HTMLデータ:</label><br>
                <textarea name="setae_ad_html" rows="6"
                    style="width:100%; font-family:monospace; margin-top:5px;"><?php echo esc_textarea($ad_html); ?></textarea>
                <span style="color:#666; font-size:12px;">バナー画像のタグやリンク（&lt;a&gt;タグ）などを含めたHTMLを入力してください。</span>
            </p>

            <p style="margin-top: 20px; padding: 10px; background: #f0f0f1; border-left: 4px solid #0073aa;">
                <label style="font-weight:bold;">掲載期間:</label><br>
                <input type="date" name="setae_ad_start_date" value="<?php echo esc_attr($start_date); ?>">
                〜
                <input type="date" name="setae_ad_end_date" value="<?php echo esc_attr($end_date); ?>">
                <br><span style="color:#666; font-size:12px;">※未入力の場合は期間制限なしになります。</span>
            </p>

            <p style="margin-top: 20px;">
                <label style="font-weight:bold;">表示対象の種（図鑑ページ）:</label><br>
                <label style="margin-right: 15px;">
                    <input type="radio" name="setae_ad_target_type" value="all" <?php checked($target_type, 'all'); ?>>
                    すべての種に表示
                </label>
                <label>
                    <input type="radio" name="setae_ad_target_type" value="specific" <?php checked($target_type, 'specific'); ?>> 指定した種のみに表示
                </label>
            </p>

            <div id="setae_ad_species_select"
                style="<?php echo $target_type === 'specific' ? '' : 'display:none;'; ?> border:1px solid #ccc; padding:15px; max-height:250px; overflow-y:auto; background:#f9f9f9; border-radius:4px;">
                <?php foreach ($species_posts as $sp): ?>
                    <label style="display:inline-block; width:48%; margin-bottom:5px;">
                        <input type="checkbox" name="setae_ad_target_species[]" value="<?php echo esc_attr($sp->ID); ?>" <?php checked(in_array($sp->ID, (array) $target_species)); ?>>
                        <?php echo esc_html($sp->post_title); ?>
                    </label>
                <?php endforeach; ?>
            </div>
        </div>

        <script>
            // ラジオボタンの切り替えで、種選択エリアの表示/非表示を制御
            document.querySelectorAll('input[name="setae_ad_target_type"]').forEach(function (radio) {
                radio.addEventListener('change', function () {
                    document.getElementById('setae_ad_species_select').style.display = (this.value === 'specific') ? 'block' : 'none';
                });
            });
        </script>
        <?php
    }

    public function save_meta_boxes($post_id)
    {
        if (!isset($_POST['setae_ad_nonce']) || !wp_verify_nonce($_POST['setae_ad_nonce'], 'setae_ad_save'))
            return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)
            return;
        if (!current_user_can('edit_post', $post_id))
            return;

        // HTMLタグを許可して保存
        if (isset($_POST['setae_ad_html'])) {
            update_post_meta($post_id, '_setae_ad_html', wp_unslash($_POST['setae_ad_html']));
        }
        if (isset($_POST['setae_ad_target_type'])) {
            update_post_meta($post_id, '_setae_ad_target_type', sanitize_text_field($_POST['setae_ad_target_type']));
        }

        $target_species = isset($_POST['setae_ad_target_species']) ? array_map('intval', $_POST['setae_ad_target_species']) : array();
        update_post_meta($post_id, '_setae_ad_target_species', $target_species);

        // ▼ 追加: 掲載期間の保存
        if (isset($_POST['setae_ad_start_date'])) {
            update_post_meta($post_id, '_setae_ad_start_date', sanitize_text_field($_POST['setae_ad_start_date']));
        }
        if (isset($_POST['setae_ad_end_date'])) {
            update_post_meta($post_id, '_setae_ad_end_date', sanitize_text_field($_POST['setae_ad_end_date']));
        }
    }

    public function register_api_routes()
    {
        register_rest_route('setae/v1', '/ads/species/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_ad_html'),
            'permission_callback' => '__return_true', // 誰でも広告を見れるように許可
        ));
    }

    public function get_ad_html($request)
    {
        $species_id = (int) $request['id'];

        $ads = get_posts(array(
            'post_type' => 'setae_ad',
            'posts_per_page' => -1,
            'post_status' => 'publish' // ※公開済みのものだけ対象にし、安全性を確保
        ));

        $ad_html = '';
        $fallback_ad_html = '';

        // ▼ 追加: 現在の日付（WordPressのタイムゾーン設定に基づく）を取得
        $current_date = current_time('Y-m-d');

        foreach ($ads as $ad) {
            // ▼ 追加: 掲載期間の取得と判定
            $start_date = get_post_meta($ad->ID, '_setae_ad_start_date', true);
            $end_date = get_post_meta($ad->ID, '_setae_ad_end_date', true);

            if (!empty($start_date) && $current_date < $start_date) {
                continue; // 開始日前なのでスキップ
            }
            if (!empty($end_date) && $current_date > $end_date) {
                continue; // 終了日を過ぎているのでスキップ
            }

            $html = get_post_meta($ad->ID, '_setae_ad_html', true);
            $type = get_post_meta($ad->ID, '_setae_ad_target_type', true) ?: 'all';

            if ($type === 'specific') {
                $targets = get_post_meta($ad->ID, '_setae_ad_target_species', true);
                if (is_array($targets) && in_array($species_id, $targets)) {
                    // 特定の種に指定された広告を最優先
                    $ad_html = $html;
                    break;
                }
            } else if ($type === 'all' && empty($fallback_ad_html)) {
                // 全体向けの広告をキープ
                $fallback_ad_html = $html;
            }
        }

        // 個別の広告が無ければ全体向け広告をセット
        if (empty($ad_html)) {
            $ad_html = $fallback_ad_html;
        }

        return new WP_REST_Response(array(
            'has_ad' => !empty($ad_html),
            'html' => wp_unslash($ad_html)
        ), 200);
    }
}
