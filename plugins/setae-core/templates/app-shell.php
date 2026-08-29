<?php
/**
 * Standalone document for the REST-driven SETAE application.
 */
if (!defined('ABSPATH')) {
    exit;
}
?><!doctype html>
<html <?php language_attributes(); ?> class="setae-app-document">
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <?php echo Setae_App_Shell::render_initial_theme_script(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#20231f">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="SETAE">
    <link rel="manifest" href="<?php echo esc_url(home_url('/setae-manifest.webmanifest')); ?>">
    <link rel="apple-touch-icon" sizes="180x180" href="<?php echo esc_url(add_query_arg('ver', SETAE_VERSION, SETAE_PLUGIN_URL . 'assets/app/icons/apple-touch-icon-180.png')); ?>">
    <link rel="icon" type="image/png" sizes="192x192" href="<?php echo esc_url(add_query_arg('ver', SETAE_VERSION, SETAE_PLUGIN_URL . 'assets/app/icons/setae-icon-192.png')); ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="<?php echo esc_url(add_query_arg('ver', SETAE_VERSION, SETAE_PLUGIN_URL . 'assets/app/icons/setae-favicon-32.png')); ?>">
    <?php wp_head(); ?>
</head>
<body class="setae-app-document">
<?php echo Setae_App_Shell::render_mount(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
<?php wp_footer(); ?>
</body>
</html>
