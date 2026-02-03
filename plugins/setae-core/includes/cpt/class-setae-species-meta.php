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
        $difficulty = get_post_meta($post->ID, '_setae_difficulty', true);
        $temp = get_post_meta($post->ID, '_setae_temperature', true);
        $humidity = get_post_meta($post->ID, '_setae_humidity', true);

        $featured_images = get_post_meta($post->ID, '_setae_featured_images', true) ?: array();
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
            <tr>
                <th><label for="setae_difficulty">Difficulty</label></th>
                <td>
                    <select name="setae_difficulty" id="setae_difficulty">
                        <option value="">Select...</option>
                        <option value="beginner" <?php selected($difficulty, 'beginner'); ?>>Beginner (初心者向け)</option>
                        <option value="intermediate" <?php selected($difficulty, 'intermediate'); ?>>Intermediate (中級者向け)
                        </option>
                        <option value="expert" <?php selected($difficulty, 'expert'); ?>>Expert (上級者向け)</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="setae_temperature">Temp / Humidity</label></th>
                <td>
                    <input type="text" name="setae_temperature" placeholder="24-28°C" value="<?php echo esc_attr($temp); ?>"
                        size="15">
                    <input type="text" name="setae_humidity" placeholder="60-70%" value="<?php echo esc_attr($humidity); ?>"
                        size="15">
                </td>
            </tr>
        </table>

        <hr>
        <h4>Community Gallery Approval (Best Shots)</h4>
        <div class="setae-gallery-approval" style="display:flex; flex-wrap:wrap; gap:10px;">
            <?php
            // 1. Get Spiders of this Species
            $spiders = get_posts(array(
                'post_type' => 'setae_spider',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'meta_query' => array(
                    array('key' => '_setae_species_id', 'value' => $post->ID)
                )
            ));

            if (!empty($spiders)) {
                // 2. Get Best Shot Logs for these spiders
                $logs = get_posts(array(
                    'post_type' => 'setae_log',
                    'posts_per_page' => 20, // Limit for now
                    'meta_query' => array(
                        array('key' => '_setae_is_best_shot', 'value' => 1),
                        array('key' => '_setae_log_spider_id', 'value' => $spiders, 'compare' => 'IN')
                    )
                ));

                if ($logs) {
                    foreach ($logs as $log) {
                        $log_data_str = get_post_meta($log->ID, '_setae_log_data', true);
                        $log_data = is_string($log_data_str) ? json_decode($log_data_str, true) : $log_data_str;
                        // Log images are stored in JSON usually? No, `logEvent` sends file.
                        // `class-setae-api-spiders.php` saves image to Media Library and usually just returns URL.
                        // Where is the image URL stored in Log?
                        // `log_event` does: `$image_url = wp_get_attachment_url(...)`.
                        // It puts it into `$data` array? No.
                        // Wait, `log_event` logic: `update_post_meta($log_id, '_setae_log_data', $data_json);`
                        // In `Step 557`, I see `$data['image'] = $image_url`. 
                        // Ah, `Setae_API_Spiders->log_event` does `$data['image'] = $image_url` BEFORE saving `_setae_log_data`.
                        // So correct.
    
                        $img_url = isset($log_data['image']) ? $log_data['image'] : '';
                        if (!$img_url)
                            continue;

                        $is_featured = in_array($img_url, $featured_images);
                        ?>
                        <div
                            style="width:120px; border:1px solid #ddd; padding:5px; background:<?php echo $is_featured ? '#e3f2fd' : '#fff'; ?>">
                            <img src="<?php echo esc_url($img_url); ?>" style="width:100%; height:80px; object-fit:cover;">
                            <label style="display:block; font-size:11px; margin-top:5px;">
                                <input type="checkbox" name="setae_featured_images[]" value="<?php echo esc_attr($img_url); ?>" <?php checked($is_featured); ?>>
                                Approve
                            </label>
                        </div>
                        <?php
                    }
                } else {
                    echo '<p>No "Best Shot" candidates found.</p>';
                }
            } else {
                echo '<p>No spiders linked to this species yet.</p>';
            }
            ?>
        </div>
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

        $fields = ['setae_lifespan', 'setae_size', 'setae_difficulty', 'setae_temperature', 'setae_humidity'];
        foreach ($fields as $field) {
            if (isset($_POST[$field])) {
                update_post_meta($post_id, '_' . $field, sanitize_text_field($_POST[$field]));
            }
        }

        // Featured Images (Array)
        if (isset($_POST['setae_featured_images'])) {
            $imgs = array_map('esc_url_raw', $_POST['setae_featured_images']);
            update_post_meta($post_id, '_setae_featured_images', $imgs);
        } else {
            // If strictly needed to clear when unchecked all?
            // Yes, if checkbox is unchecked, it sends nothing.
            // But usually hidden input is safer. For now simpler logic: 
            // If we are in this save block, update it.
            // CAUTION: If no checkboxes are checked, `setae_featured_images` key won't exist in $_POST.
            // So we should handle "Reset" if we are sure we are submitting the form.
            // But for safety (not overwriting with empty if not intended), verify context?
            // Assuming this save function triggers on full edit screen save.
            update_post_meta($post_id, '_setae_featured_images', array());
        }
    }

    public function register_rest_fields()
    {
        register_rest_field('setae_species', 'meta_data', array(
            'get_callback' => function ($object) {
                return array(
                    'lifespan' => get_post_meta($object['id'], '_setae_lifespan', true),
                    'size' => get_post_meta($object['id'], '_setae_size', true),
                    'difficulty' => get_post_meta($object['id'], '_setae_difficulty', true),
                    'temperature' => get_post_meta($object['id'], '_setae_temperature', true),
                    'humidity' => get_post_meta($object['id'], '_setae_humidity', true),
                    'featured_images' => get_post_meta($object['id'], '_setae_featured_images', true) ?: [],
                );
            },
            'schema' => null,
        ));
    }

}
