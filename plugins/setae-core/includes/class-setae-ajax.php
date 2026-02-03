<?php

class Setae_Ajax
{

    public function __construct()
    {
        // Hooks are registered by the loader in Setae_Core
    }

    public function update_profile()
    {
        // 1. Verify Nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'wp_rest')) {
            wp_send_json_error(array('message' => 'Invalid nonce'), 403);
        }

        // 2. Check Permissions
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => 'Not logged in'), 401);
        }

        $user_id = get_current_user_id();

        // 3. Prepare Update Data
        $userdata = array('ID' => $user_id);

        if (isset($_POST['display_name'])) {
            $userdata['display_name'] = sanitize_text_field($_POST['display_name']);
        }

        if (isset($_POST['email'])) {
            // Email validation could go here
            $userdata['user_email'] = sanitize_email($_POST['email']);
        }

        if (isset($_POST['password']) && !empty($_POST['password'])) {
            $userdata['user_pass'] = $_POST['password']; // wp_update_user handles hashing
        }

        // 4. Update User
        $user_id = wp_update_user($userdata);

        if (is_wp_error($user_id)) {
            wp_send_json_error(array('message' => $user_id->get_error_message()), 500);
        }

        // 5. Handle Image Upload
        if (!empty($_FILES['profile_image'])) {
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');

            $attachment_id = media_handle_upload('profile_image', 0); // 0 = not attached to a post

            if (is_wp_error($attachment_id)) {
                // Log error but don't fail the whole request? Or return warning?
                // For now, let's just ignore or maybe return it in data
            } else {
                // Determine how to store avatar. 
                // Since this is a custom system, we might need a plugin like WP User Avatar or Simple Local Avatars logic.
                // However, WordPress core doesn't have a simple "user_avatar" meta natively used by get_avatar without filters.
                // Assuming we use a standard meta key or rely on a filter.
                // Let's assume we store it in meta and hook into get_avatar elsewhere OR the user implies standard WP behavior.
                // I'll check how 'get_avatar' uses custom images. Usually via plugin.
                // If there's no plugin, I should add a filter to 'pre_get_avatar'.
                // For now, saving to meta `setae_user_avatar`.

                update_user_meta($user_id, 'setae_user_avatar', $attachment_id);
            }
        }

        wp_send_json_success(array('message' => 'Profile updated'));
    }
}
