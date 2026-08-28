<?php
/** Standalone public record document, independent of theme templates. */
if (!defined('ABSPATH')) {
    exit;
}
$surface = $setae_care_share['surface'];
?><!doctype html>
<html class="setae-public-surface-document" <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html($setae_care_share['seo']['title']); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class('setae-public-document setae-care-share-document'); ?>>
<?php wp_body_open(); ?>
<a class="setae-public-skip-link" href="#setae-care-share-main">本文へ移動</a>
<?php require SETAE_PLUGIN_DIR . 'templates/public/surface-header.php'; ?>
<?php if ($setae_care_share['found']): ?>
    <?php require SETAE_PLUGIN_DIR . 'templates/public/care-share-content.php'; ?>
<?php else: ?>
    <?php require SETAE_PLUGIN_DIR . 'templates/public/care-share-not-found.php'; ?>
<?php endif; ?>
<?php require SETAE_PLUGIN_DIR . 'templates/public/surface-footer.php'; ?>
<?php Setae_Public_Registration::render($setae_care_share['registration']); ?>
<?php wp_footer(); ?>
</body>
</html>
