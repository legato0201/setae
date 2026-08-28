<?php
/** Standalone Partner document; $setae_partner contains prepared public values. */
if (!defined('ABSPATH')) {
    exit;
}
$surface = $setae_partner['surface'];
?><!doctype html>
<html class="setae-public-surface-document" <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html($setae_partner['seo']['title']); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class('setae-public-document setae-public-partner-document'); ?>>
<?php wp_body_open(); ?>
<a class="setae-public-skip-link" href="#setae-public-partner-main">本文へ</a>
<?php require SETAE_PLUGIN_DIR . 'templates/public/surface-header.php'; ?>
<?php require SETAE_PLUGIN_DIR . 'templates/public/partner-content.php'; ?>
<?php require SETAE_PLUGIN_DIR . 'templates/public/surface-footer.php'; ?>
<?php Setae_Public_Registration::render($setae_partner['registration']); ?>
<?php wp_footer(); ?>
</body>
</html>
