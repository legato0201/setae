<?php

class Setae_Species_Meta
{

    public function __construct()
    {
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post', array($this, 'save_fields'));
        // Expose to REST API
        add_action('rest_api_init', array($this, 'register_rest_fields'));
    }

    public function add_meta_boxes()
    {
        add_meta_box('setae_species_details', 'Species Details', array($this, 'render_meta_box'), 'setae_species', 'normal', 'high');
    }

    public function render_meta_box($post)
    {
        // Nonce
        wp_nonce_field('setae_species_save', 'setae_species_nonce');

        // Fields
        $description = get_post_meta($post->ID, '_setae_description', true);
        $lifespan = get_post_meta($post->ID, '_setae_lifespan', true);
        $size = get_post_meta($post->ID, '_setae_size', true);
        ?>
        <table class="form-table">
            <tr>
                <th><label for="setae_lifespan">Lifespan / Growth</label></th>
                <td><input type="text" name="setae_lifespan" id="setae_lifespan" value="<?php echo esc_attr($lifespan); ?>"
                        class="regular-text"></td>
            </tr>
            <tr>
                <th><label for="setae_size">Max Legspan (cm)</label></th>
                <td><input type="number" step="0.1" name="setae_size" id="setae_size" value="<?php echo esc_attr($size); ?>"
                        class="regular-text"></td>
            </tr>
        </table>
        <?php
    }

    public function save_fields($post_id)
    {
        if (!isset($_POST['setae_species_nonce']) || !wp_verify_nonce($_POST['setae_species_nonce'], 'setae_species_save')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)
            return;
        if (!current_user_can('edit_post', $post_id))
            return;

        if (isset($_POST['setae_lifespan']))
            update_post_meta($post_id, '_setae_lifespan', sanitize_text_field($_POST['setae_lifespan']));
        if (isset($_POST['setae_size']))
            update_post_meta($post_id, '_setae_size', sanitize_text_field($_POST['setae_size']));
    }

    public function register_rest_fields()
    {
        register_rest_field('setae_species', 'meta_data', array(
            'get_callback' => function ($object) {
                return array(
                    'lifespan' => get_post_meta($object['id'], '_setae_lifespan', true),
                    'size' => get_post_meta($object['id'], '_setae_size', true),
                    'featured_images' => get_post_meta($object['id'], '_setae_featured_images', true) ?: [],
                );
            },
            'schema' => null,
        ));
    }

}
