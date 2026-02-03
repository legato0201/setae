<?php

if (!defined('ABSPATH'))
    exit;

function setae_theme_enqueue_scripts()
{
    // Global Styles (Optionally keep if they define basics not in plugin)
    // wp_enqueue_style('setae-global', get_template_directory_uri() . '/assets/css/setae-global.css', array(), '1.0.0');

    // NOTE: Assets are now managed by Setae Core Plugin (class-setae-dashboard.php)

    // Enqueue QRCode Lib (Ensure it's loaded if Plugin doesn't?)
    // Plugin ui module depends on 'qrcode-js', so we should ensure it's registered or loaded here or there.
    // Plugin uses 'qrcode-js' in dependency array.
    wp_enqueue_script('qrcode-js', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', array(), '1.0.0', true);

    // Enqueue Chart.js
    wp_enqueue_script('chart-js', 'https://cdn.jsdelivr.net/npm/chart.js', array(), '4.4.0', true);

    // User Settings & Localization (Moved to Plugin?)
    // The plugin dashboard class handles localization for 'setae-app-core'.
    // We should NOT duplicate it here to avoid conflicts or overwrites.
}
add_action('wp_enqueue_scripts', 'setae_theme_enqueue_scripts');

// Remove Admin Bar for non-admins to enhance App feel (Now for everyone as requested)
add_filter('show_admin_bar', '__return_false');
// Custom Avatar Support
add_filter('get_avatar', 'setae_get_avatar', 10, 5);
function setae_get_avatar($avatar, $id_or_email, $size, $default, $alt)
{
    $user = false;

    if (is_numeric($id_or_email)) {
        $id = (int) $id_or_email;
        $user = get_user_by('id', $id);
    } elseif (is_object($id_or_email)) {
        if (!empty($id_or_email->user_id)) {
            $id = (int) $id_or_email->user_id;
            $user = get_user_by('id', $id);
        }
    } else {
        $user = get_user_by('email', $id_or_email);
    }

    if ($user) {
        $icon_id = get_user_meta($user->ID, 'setae_user_icon', true);
        if ($icon_id) {
            $img_url = wp_get_attachment_image_url($icon_id, 'thumbnail'); // Use thumbnail size
            if (!$img_url)
                $img_url = wp_get_attachment_url($icon_id); // Fallback

            if ($img_url) {
                return "<img alt='{$alt}' src='{$img_url}' class='avatar avatar-{$size} photo' height='{$size}' width='{$size}' style='object-fit:cover; border-radius:50%;' />";
            }
        }
    }
    return $avatar;
}
