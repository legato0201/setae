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
                <th><label for="setae_last_molt_date">Last Molt</label></th>
                <td><input type="date" name="setae_last_molt_date" id="setae_last_molt_date"
                        value="<?php echo esc_attr($molt_date); ?>" /></td>
            </tr>
            <tr>
                <th><label for="setae_last_feed_date">Last Feed</label></th>
                <td><input type="date" name="setae_last_feed_date" id="setae_last_feed_date"
                        value="<?php echo esc_attr($feed_date); ?>" /></td>
            </tr>
            <tr>
                <th><label for="setae_bl_recruiting">BL募集</label></th>
                <td>
                    <input type="checkbox" name="setae_bl_recruiting" id="setae_bl_recruiting" value="1" <?php checked(get_post_meta($post->ID, '_setae_bl_recruiting', true), '1'); ?> />
                    <label for="setae_bl_recruiting">この個体をブリーディングローン募集に出す</label>
                </td>
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
        if (isset($_POST['setae_last_molt_date']))
            update_post_meta($post_id, '_setae_last_molt_date', sanitize_text_field($_POST['setae_last_molt_date']));
        if (isset($_POST['setae_last_feed_date']))
            update_post_meta($post_id, '_setae_last_feed_date', sanitize_text_field($_POST['setae_last_feed_date']));

        $recruiting = isset($_POST['setae_bl_recruiting']) ? '1' : '0';
        update_post_meta($post_id, '_setae_bl_recruiting', $recruiting);

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
                    'last_molt' => get_post_meta($object['id'], '_setae_last_molt_date', true),
                    'last_feed' => get_post_meta($object['id'], '_setae_last_feed_date', true),
                    'recruiting' => get_post_meta($object['id'], '_setae_bl_recruiting', true),
                    'owner_id' => get_post_meta($object['id'], '_setae_owner_id', true),
                );
            },
            'update_callback' => function ($meta_value, $object, $field_name) {
                if (!is_array($meta_value)) {
                    return;
                }
                if (isset($meta_value['species_id'])) {
                    update_post_meta($object->ID, '_setae_species_id', sanitize_text_field($meta_value['species_id']));
                }
                if (isset($meta_value['last_molt'])) {
                    update_post_meta($object->ID, '_setae_last_molt_date', sanitize_text_field($meta_value['last_molt']));
                }
                if (isset($meta_value['last_feed'])) {
                    update_post_meta($object->ID, '_setae_last_feed_date', sanitize_text_field($meta_value['last_feed']));
                }
                if (isset($meta_value['recruiting'])) {
                    update_post_meta($object->ID, '_setae_bl_recruiting', sanitize_text_field($meta_value['recruiting']));
                }
                return true;
            },
            'schema' => null,
        ));
    }
}
