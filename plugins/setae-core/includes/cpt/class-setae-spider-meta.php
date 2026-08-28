<?php

class Setae_Spider_Meta
{

    public function __construct()
    {
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_fields'));
        add_action('rest_api_init', array($this, 'register_rest_fields'));
    }

    public function add_meta_boxes()
    {
        add_meta_box('setae_spider_details', 'Spider Details', array($this, 'render_meta_box'), 'setae_spider', 'normal', 'high');
    }

    public function render_meta_box($post)
    {
        wp_nonce_field('setae_spider_save', 'setae_spider_nonce');

        $species_id = get_post_meta($post->ID, '_setae_species_id', true);
        $molt_date = get_post_meta($post->ID, '_setae_last_molt_date', true);
        $feed_date = get_post_meta($post->ID, '_setae_last_feed_date', true);

        // Retrieve available species for dropdown
        $species_list = get_posts(array('post_type' => 'setae_species', 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC'));
        ?>
        <table class="form-table">
            <tr>
                <th><label for="setae_species_id">Species</label></th>
                <td>
                    <select name="setae_species_id" id="setae_species_id" class="regular-text">
                        <option value="">-- Select Species --</option>
                        <?php foreach ($species_list as $species): ?>
                            <option value="<?php echo esc_attr($species->ID); ?>" <?php selected($species_id, $species->ID); ?>>
                                <?php echo esc_html($species->post_title); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="setae_gender">性別</label></th>
                <td>
                    <select name="setae_gender" id="setae_gender">
                        <option value="unknown" <?php selected(get_post_meta($post->ID, '_setae_gender', true), 'unknown'); ?>>
                            不明</option>
                        <option value="female" <?php selected(get_post_meta($post->ID, '_setae_gender', true), 'female'); ?>>
                            メス ♀</option>
                        <option value="male" <?php selected(get_post_meta($post->ID, '_setae_gender', true), 'male'); ?>>オス ♂</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="setae_last_molt_date">最終脱皮日</label></th>
                <td><input type="date" name="setae_last_molt_date" id="setae_last_molt_date"
                        value="<?php echo esc_attr($molt_date); ?>" /></td>
            </tr>
            <tr>
                <th><label for="setae_last_feed_date">最終給餌日</label></th>
                <td><input type="date" name="setae_last_feed_date" id="setae_last_feed_date"
                        value="<?php echo esc_attr($feed_date); ?>" /></td>
            </tr>
            <tr>
                <th><label for="setae_bl_status">繁殖募集</label></th>
                <td>
                    <select name="setae_bl_status" id="setae_bl_status">
                        <option value="none" <?php selected(get_post_meta($post->ID, '_setae_bl_status', true), 'none'); ?>>募集なし</option>
                        <option value="recruiting" <?php selected(get_post_meta($post->ID, '_setae_bl_status', true), 'recruiting'); ?>>募集中</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="setae_bl_terms">募集条件・備考</label></th>
                <td>
                    <input type="text" name="setae_bl_terms" id="setae_bl_terms" class="regular-text"
                        value="<?php echo esc_attr(get_post_meta($post->ID, '_setae_bl_terms', true)); ?>"
                        placeholder="例: 産卵した場合は折半、送料は申請者負担" />
                </td>
            </tr>
            <tr>
                <th><label for="setae_breeding_contact_url">外部連絡先</label></th>
                <td>
                    <input type="url" name="setae_breeding_contact_url" id="setae_breeding_contact_url" class="regular-text"
                        value="<?php echo esc_attr(get_post_meta($post->ID, '_setae_breeding_contact_url', true)); ?>"
                        placeholder="https://..." />
                    <p class="description">募集中にする場合はHTTPSの外部連絡先が必要です。</p>
                </td>
            </tr>
            <tr>
                <th><label for="setae_breeding_contact_label">リンクの表示名</label></th>
                <td><input type="text" name="setae_breeding_contact_label" id="setae_breeding_contact_label" class="regular-text"
                    maxlength="80" value="<?php echo esc_attr(get_post_meta($post->ID, '_setae_breeding_contact_label', true)); ?>" /></td>
            </tr>
        </table>
        <?php
    }

    public function save_fields($post_id)
    {
        if (!isset($_POST['setae_spider_nonce']) || !wp_verify_nonce($_POST['setae_spider_nonce'], 'setae_spider_save')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)
            return;
        if (!current_user_can('edit_post', $post_id))
            return;

        if (isset($_POST['setae_species_id']))
            update_post_meta($post_id, '_setae_species_id', sanitize_text_field($_POST['setae_species_id']));

        if (isset($_POST['setae_gender']))
            update_post_meta($post_id, '_setae_gender', sanitize_text_field($_POST['setae_gender']));

        if (isset($_POST['setae_last_molt_date']))
            update_post_meta($post_id, '_setae_last_molt_date', sanitize_text_field($_POST['setae_last_molt_date']));
        if (isset($_POST['setae_last_feed_date']))
            update_post_meta($post_id, '_setae_last_feed_date', sanitize_text_field($_POST['setae_last_feed_date']));

        $bl_status = isset($_POST['setae_bl_status']) ? sanitize_key($_POST['setae_bl_status']) : 'none';
        if (!in_array($bl_status, array('none', 'recruiting'), true)) {
            $bl_status = 'none';
        }

        $contact_url = isset($_POST['setae_breeding_contact_url']) ? esc_url_raw(wp_unslash($_POST['setae_breeding_contact_url'])) : '';
        $contact_parts = $contact_url ? wp_parse_url($contact_url) : array();
        if (!$contact_url || empty($contact_parts['scheme']) || strtolower($contact_parts['scheme']) !== 'https') {
            $contact_url = '';
            if ($bl_status === 'recruiting') {
                $bl_status = 'none';
            }
        }
        update_post_meta($post_id, '_setae_bl_status', $bl_status);
        if ($contact_url) {
            update_post_meta($post_id, '_setae_breeding_contact_url', $contact_url);
        } else {
            delete_post_meta($post_id, '_setae_breeding_contact_url');
        }

        $contact_label = isset($_POST['setae_breeding_contact_label'])
            ? mb_substr(sanitize_text_field(wp_unslash($_POST['setae_breeding_contact_label'])), 0, 80)
            : '';
        if ($contact_label) {
            update_post_meta($post_id, '_setae_breeding_contact_label', $contact_label);
        } else {
            delete_post_meta($post_id, '_setae_breeding_contact_label');
        }

        if (isset($_POST['setae_bl_terms']))
            update_post_meta($post_id, '_setae_bl_terms', sanitize_text_field($_POST['setae_bl_terms']));

        // Auto-save owner ID if not set (for admin convenience, though owner should be set on creation)
        $owner_id = get_post_meta($post_id, '_setae_owner_id', true);
        if (!$owner_id) {
            update_post_meta($post_id, '_setae_owner_id', get_post_field('post_author', $post_id));
        }
    }

    public function register_rest_fields()
    {
        register_rest_field('setae_spider', 'meta_data', array(
            'get_callback' => function ($object) {
                $species_id = get_post_meta($object['id'], '_setae_species_id', true);
                $species_name = $species_id ? get_the_title($species_id) : '種類未設定';
                return array(
                    'species_id' => $species_id,
                    'species_name' => $species_name,
                    'gender' => get_post_meta($object['id'], '_setae_gender', true) ?: 'unknown',
                    'last_molt' => get_post_meta($object['id'], '_setae_last_molt_date', true),
                    'last_feed' => get_post_meta($object['id'], '_setae_last_feed_date', true),
                    'bl_status' => get_post_meta($object['id'], '_setae_bl_status', true),
                    'bl_terms' => get_post_meta($object['id'], '_setae_bl_terms', true),
                    'breeding_contact_url' => get_post_meta($object['id'], '_setae_breeding_contact_url', true),
                    'breeding_contact_label' => get_post_meta($object['id'], '_setae_breeding_contact_label', true),
                    'owner_id' => get_post_meta($object['id'], '_setae_owner_id', true),
                );
            },
            'update_callback' => function ($meta_value, $object, $field_name) {
                if (!is_array($meta_value)) {
                    return;
                }
                $bl_status = isset($meta_value['bl_status'])
                    ? sanitize_key($meta_value['bl_status'])
                    : sanitize_key(get_post_meta($object->ID, '_setae_bl_status', true));
                $contact_url = isset($meta_value['breeding_contact_url'])
                    ? esc_url_raw($meta_value['breeding_contact_url'])
                    : esc_url_raw(get_post_meta($object->ID, '_setae_breeding_contact_url', true));
                $contact_parts = $contact_url ? wp_parse_url($contact_url) : array();
                if ($contact_url && (empty($contact_parts['scheme']) || strtolower($contact_parts['scheme']) !== 'https')) {
                    return new WP_Error('invalid_breeding_contact_url', '外部連絡先はHTTPSのURLを入力してください。', array('status' => 400));
                }
                if ($bl_status === 'recruiting' && !$contact_url) {
                    return new WP_Error('breeding_contact_required', '繁殖募集を公開するには外部連絡先が必要です。', array('status' => 400));
                }
                if (isset($meta_value['species_id'])) {
                    update_post_meta($object->ID, '_setae_species_id', sanitize_text_field($meta_value['species_id']));
                }
                if (isset($meta_value['gender'])) {
                    update_post_meta($object->ID, '_setae_gender', sanitize_text_field($meta_value['gender']));
                }
                if (isset($meta_value['last_molt'])) {
                    update_post_meta($object->ID, '_setae_last_molt_date', sanitize_text_field($meta_value['last_molt']));
                }
                if (isset($meta_value['last_feed'])) {
                    update_post_meta($object->ID, '_setae_last_feed_date', sanitize_text_field($meta_value['last_feed']));
                }
                if (isset($meta_value['bl_status'])) {
                    update_post_meta($object->ID, '_setae_bl_status', in_array($bl_status, array('none', 'recruiting'), true) ? $bl_status : 'none');
                }
                if (isset($meta_value['bl_terms'])) {
                    update_post_meta($object->ID, '_setae_bl_terms', sanitize_text_field($meta_value['bl_terms']));
                }
                if (array_key_exists('breeding_contact_url', $meta_value)) {
                    if ($contact_url) update_post_meta($object->ID, '_setae_breeding_contact_url', $contact_url);
                    else delete_post_meta($object->ID, '_setae_breeding_contact_url');
                }
                if (array_key_exists('breeding_contact_label', $meta_value)) {
                    $label = mb_substr(sanitize_text_field($meta_value['breeding_contact_label']), 0, 80);
                    if ($label) update_post_meta($object->ID, '_setae_breeding_contact_label', $label);
                    else delete_post_meta($object->ID, '_setae_breeding_contact_label');
                }
                return true;
            },
            'schema' => null,
        ));
    }
}
