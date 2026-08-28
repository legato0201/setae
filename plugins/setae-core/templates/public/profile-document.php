<?php
/**
 * Standalone document for the public keeper profile.
 *
 * Available variables: $setae_profile, $setae_context, $setae_not_found.
 */
if (!defined('ABSPATH')) {
    exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f3f2ed">
    <?php wp_head(); ?>
</head>
<body <?php body_class('setae-public-profile-document'); ?>>
<?php wp_body_open(); ?>
<?php
if ($setae_not_found) {
    require SETAE_PLUGIN_DIR . 'templates/public/profile-not-found.php';
} else {
    require SETAE_PLUGIN_DIR . 'templates/public/profile-content.php';
    Setae_Public_Registration::render($setae_context['registration']);
}
?>
<?php wp_footer(); ?>
</body>
</html>
