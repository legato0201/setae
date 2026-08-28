<?php

class Setae_CPT_Ad
{
    public function __construct()
    {
        add_action('init', array($this, 'register_cpt'));
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post_setae_ad', array($this, 'save_meta_boxes'));
        add_action('rest_api_init', array($this, 'register_api_routes'));
    }

    public function register_cpt()
    {
        $labels = array(
            'name' => 'ショップ掲載管理',
            'singular_name' => 'ショップ掲載',
            'menu_name' => 'ショップ掲載',
            'add_new' => '新規追加',
            'add_new_item' => 'ショップ掲載を追加',
            'edit_item' => 'ショップ掲載を編集',
            'new_item' => '新しいショップ掲載',
            'search_items' => 'ショップ掲載を検索',
            'not_found' => 'ショップ掲載が見つかりません',
        );

        register_post_type('setae_ad', array(
            'labels' => $labels,
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=setae_species',
            'supports' => array('title'),
            'hierarchical' => false,
            'has_archive' => false,
        ));
    }

    public function add_meta_boxes()
    {
        add_meta_box(
            'setae_ad_settings',
            '承認ショップ・販売リンク設定',
            array($this, 'render_meta_box'),
            'setae_ad',
            'normal',
            'high'
        );
    }

    public function render_meta_box($post)
    {
        wp_nonce_field('setae_ad_save', 'setae_ad_nonce');

        $values = array(
            'approved' => get_post_meta($post->ID, '_setae_ad_shop_approved', true),
            'shop_name' => get_post_meta($post->ID, '_setae_ad_shop_name', true),
            'url' => get_post_meta($post->ID, '_setae_ad_shop_url', true),
            'image' => get_post_meta($post->ID, '_setae_ad_shop_image', true),
            'price_label' => get_post_meta($post->ID, '_setae_ad_price_label', true),
            'stock_label' => get_post_meta($post->ID, '_setae_ad_stock_label', true),
            'description' => get_post_meta($post->ID, '_setae_ad_description', true),
            'cta_label' => get_post_meta($post->ID, '_setae_ad_cta_label', true) ?: '販売情報を見る',
            'target_type' => get_post_meta($post->ID, '_setae_ad_target_type', true) ?: 'specific',
            'target_species' => get_post_meta($post->ID, '_setae_ad_target_species', true) ?: array(),
            'start_date' => get_post_meta($post->ID, '_setae_ad_start_date', true),
            'end_date' => get_post_meta($post->ID, '_setae_ad_end_date', true),
            'legacy_html' => get_post_meta($post->ID, '_setae_ad_html', true),
        );

        $species_posts = get_posts(array(
            'post_type' => 'setae_species',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'orderby' => 'title',
            'order' => 'ASC',
        ));
        ?>
        <div class="setae-shop-admin" style="max-width:920px; padding:8px 0;">
            <p style="padding:12px; border-left:4px solid #2271b1; background:#f0f6fc;">
                <label>
                    <input type="checkbox" name="setae_ad_shop_approved" value="1" <?php checked($values['approved'], '1'); ?>>
                    <strong>掲載申請を確認し、承認ショップとして公開する</strong>
                </label><br>
                <span style="color:#50575e;">このチェックと投稿の「公開」が揃った販売リンクだけ図鑑に表示されます。</span>
            </p>

            <table class="form-table" role="presentation">
                <tr>
                    <th><label for="setae-ad-shop-name">ショップ名</label></th>
                    <td><input id="setae-ad-shop-name" class="regular-text" type="text" name="setae_ad_shop_name" value="<?php echo esc_attr($values['shop_name']); ?>"></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-shop-url">販売ページURL</label></th>
                    <td><input id="setae-ad-shop-url" class="large-text" type="url" name="setae_ad_shop_url" value="<?php echo esc_attr($values['url']); ?>" placeholder="https://"></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-shop-image">商品画像URL</label></th>
                    <td><input id="setae-ad-shop-image" class="large-text" type="url" name="setae_ad_shop_image" value="<?php echo esc_attr($values['image']); ?>" placeholder="https://"></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-price-label">価格表示</label></th>
                    <td><input id="setae-ad-price-label" class="regular-text" type="text" name="setae_ad_price_label" value="<?php echo esc_attr($values['price_label']); ?>" placeholder="例: 12,800円"></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-stock-label">在庫表示</label></th>
                    <td><input id="setae-ad-stock-label" class="regular-text" type="text" name="setae_ad_stock_label" value="<?php echo esc_attr($values['stock_label']); ?>" placeholder="例: 在庫あり"></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-description">補足</label></th>
                    <td><textarea id="setae-ad-description" class="large-text" rows="3" name="setae_ad_description"><?php echo esc_textarea($values['description']); ?></textarea></td>
                </tr>
                <tr>
                    <th><label for="setae-ad-cta-label">リンク文言</label></th>
                    <td><input id="setae-ad-cta-label" class="regular-text" type="text" name="setae_ad_cta_label" value="<?php echo esc_attr($values['cta_label']); ?>"></td>
                </tr>
                <tr>
                    <th>掲載期間</th>
                    <td>
                        <input type="date" name="setae_ad_start_date" value="<?php echo esc_attr($values['start_date']); ?>">
                        から
                        <input type="date" name="setae_ad_end_date" value="<?php echo esc_attr($values['end_date']); ?>">
                    </td>
                </tr>
            </table>

            <hr>
            <p><strong>表示対象の種</strong></p>
            <p>
                <label style="margin-right:16px;">
                    <input type="radio" name="setae_ad_target_type" value="specific" <?php checked($values['target_type'], 'specific'); ?>> 指定した種
                </label>
                <label>
                    <input type="radio" name="setae_ad_target_type" value="all" <?php checked($values['target_type'], 'all'); ?>> すべての種
                </label>
            </p>
            <div id="setae_ad_species_select" style="<?php echo $values['target_type'] === 'specific' ? '' : 'display:none;'; ?> border:1px solid #c3c4c7; padding:14px; max-height:280px; overflow:auto; background:#fff;">
                <?php foreach ($species_posts as $species): ?>
                    <label style="display:inline-block; width:48%; margin-bottom:7px;">
                        <input type="checkbox" name="setae_ad_target_species[]" value="<?php echo esc_attr($species->ID); ?>" <?php checked(in_array($species->ID, (array) $values['target_species'], true)); ?>>
                        <?php echo esc_html($species->post_title); ?>
                    </label>
                <?php endforeach; ?>
            </div>

            <?php if ($values['legacy_html']): ?>
                <details style="margin-top:20px;">
                    <summary>旧広告HTML（互換表示用）</summary>
                    <textarea name="setae_ad_html" rows="6" style="width:100%; margin-top:8px; font-family:monospace;"><?php echo esc_textarea($values['legacy_html']); ?></textarea>
                </details>
            <?php endif; ?>
        </div>
        <script>
            document.querySelectorAll('input[name="setae_ad_target_type"]').forEach(function (radio) {
                radio.addEventListener('change', function () {
                    document.getElementById('setae_ad_species_select').style.display = this.value === 'specific' ? 'block' : 'none';
                });
            });
        </script>
        <?php
    }

    public function save_meta_boxes($post_id)
    {
        if (!isset($_POST['setae_ad_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['setae_ad_nonce'])), 'setae_ad_save')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        update_post_meta($post_id, '_setae_ad_shop_approved', isset($_POST['setae_ad_shop_approved']) ? '1' : '0');

        $text_fields = array(
            'setae_ad_shop_name' => '_setae_ad_shop_name',
            'setae_ad_price_label' => '_setae_ad_price_label',
            'setae_ad_stock_label' => '_setae_ad_stock_label',
            'setae_ad_cta_label' => '_setae_ad_cta_label',
        );
        foreach ($text_fields as $request_key => $meta_key) {
            $value = isset($_POST[$request_key]) ? sanitize_text_field(wp_unslash($_POST[$request_key])) : '';
            update_post_meta($post_id, $meta_key, $value);
        }

        $url_fields = array(
            'setae_ad_shop_url' => '_setae_ad_shop_url',
            'setae_ad_shop_image' => '_setae_ad_shop_image',
        );
        foreach ($url_fields as $request_key => $meta_key) {
            $value = isset($_POST[$request_key]) ? esc_url_raw(wp_unslash($_POST[$request_key])) : '';
            update_post_meta($post_id, $meta_key, $value);
        }

        $description = isset($_POST['setae_ad_description']) ? sanitize_textarea_field(wp_unslash($_POST['setae_ad_description'])) : '';
        update_post_meta($post_id, '_setae_ad_description', $description);

        $target_type = isset($_POST['setae_ad_target_type']) ? sanitize_key($_POST['setae_ad_target_type']) : 'specific';
        update_post_meta($post_id, '_setae_ad_target_type', $target_type === 'all' ? 'all' : 'specific');

        $target_species = isset($_POST['setae_ad_target_species'])
            ? array_values(array_unique(array_filter(array_map('absint', (array) $_POST['setae_ad_target_species']))))
            : array();
        update_post_meta($post_id, '_setae_ad_target_species', $target_species);

        foreach (array('start_date', 'end_date') as $date_key) {
            $request_key = 'setae_ad_' . $date_key;
            $value = isset($_POST[$request_key]) ? sanitize_text_field(wp_unslash($_POST[$request_key])) : '';
            if ($value && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                $value = '';
            }
            update_post_meta($post_id, '_setae_ad_' . $date_key, $value);
        }

        if (isset($_POST['setae_ad_html'])) {
            update_post_meta($post_id, '_setae_ad_html', wp_kses_post(wp_unslash($_POST['setae_ad_html'])));
        }
    }

    public function register_api_routes()
    {
        register_rest_route('setae/v1', '/ads/species/(?P<id>\d+)', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'get_species_ads'),
            'permission_callback' => '__return_true',
        ));
    }

    public function get_species_ads($request)
    {
        $species_id = absint($request['id']);
        $shops = self::get_approved_shop_links($species_id);
        $legacy_html = self::get_legacy_ad_html($species_id);

        return new WP_REST_Response(array(
            'has_ad' => !empty($shops) || !empty($legacy_html),
            'shops' => $shops,
            'html' => $legacy_html,
        ), 200);
    }

    public static function get_approved_shop_links($species_id)
    {
        $species_id = absint($species_id);
        $items = array();
        $ads = self::get_active_ads();

        foreach ($ads as $ad) {
            if (!self::ad_targets_species($ad->ID, $species_id)) {
                continue;
            }
            if (get_post_meta($ad->ID, '_setae_ad_shop_approved', true) !== '1') {
                continue;
            }

            $url = esc_url_raw(get_post_meta($ad->ID, '_setae_ad_shop_url', true));
            $shop_name = sanitize_text_field(get_post_meta($ad->ID, '_setae_ad_shop_name', true));
            if (!$url || !$shop_name) {
                continue;
            }

            $items[] = array(
                'id' => (int) $ad->ID,
                'title' => sanitize_text_field($ad->post_title),
                'shop_name' => $shop_name,
                'url' => $url,
                'image' => esc_url_raw(get_post_meta($ad->ID, '_setae_ad_shop_image', true)),
                'price_label' => sanitize_text_field(get_post_meta($ad->ID, '_setae_ad_price_label', true)),
                'stock_label' => sanitize_text_field(get_post_meta($ad->ID, '_setae_ad_stock_label', true)),
                'description' => sanitize_textarea_field(get_post_meta($ad->ID, '_setae_ad_description', true)),
                'cta_label' => sanitize_text_field(get_post_meta($ad->ID, '_setae_ad_cta_label', true)) ?: '販売情報を見る',
                'approved' => true,
            );
        }

        return $items;
    }

    private static function get_active_ads()
    {
        $ads = get_posts(array(
            'post_type' => 'setae_ad',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'orderby' => array('menu_order' => 'ASC', 'date' => 'DESC'),
        ));
        $today = current_time('Y-m-d');

        return array_values(array_filter($ads, function ($ad) use ($today) {
            $start = get_post_meta($ad->ID, '_setae_ad_start_date', true);
            $end = get_post_meta($ad->ID, '_setae_ad_end_date', true);
            return (!$start || $today >= $start) && (!$end || $today <= $end);
        }));
    }

    private static function ad_targets_species($ad_id, $species_id)
    {
        $target_type = get_post_meta($ad_id, '_setae_ad_target_type', true) ?: 'all';
        if ($target_type === 'all') {
            return true;
        }

        $targets = get_post_meta($ad_id, '_setae_ad_target_species', true);
        return in_array(absint($species_id), array_map('absint', (array) $targets), true);
    }

    private static function get_legacy_ad_html($species_id)
    {
        $fallback = '';
        foreach (self::get_active_ads() as $ad) {
            $html = get_post_meta($ad->ID, '_setae_ad_html', true);
            if (!$html || !self::ad_targets_species($ad->ID, $species_id)) {
                continue;
            }

            $safe_html = wp_kses_post($html);
            if ((get_post_meta($ad->ID, '_setae_ad_target_type', true) ?: 'all') === 'specific') {
                return $safe_html;
            }
            if (!$fallback) {
                $fallback = $safe_html;
            }
        }

        return $fallback;
    }
}
