<?php

if (!defined('ABSPATH'))
    exit;

function setae_theme_enqueue_scripts()
{
    // Dashboard assets, including offline-capable QR and chart libraries, are
    // registered by Setae Core to keep one deterministic dependency graph.
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

// Theme Setup
function setae_theme_setup()
{
    // Add support for post thumbnails (featured images)
    add_theme_support('post-thumbnails');
}
add_action('after_setup_theme', 'setae_theme_setup');
