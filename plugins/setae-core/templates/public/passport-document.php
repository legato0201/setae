<?php
/** Standalone document. Only the controller's allowlisted $setae_passport is read. */
if (!defined('ABSPATH')) {
    exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html($setae_passport['seo']['title']); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class('setae-public-document setae-qr-public-document'); ?>>
<?php wp_body_open(); ?>
<?php require SETAE_PLUGIN_DIR . 'templates/public/passport-content.php'; ?>
<?php Setae_Public_Registration::render($setae_passport['registration']); ?>
<?php wp_footer(); ?>
</body>
</html>
