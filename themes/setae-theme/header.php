<!DOCTYPE html>
<html <?php language_attributes(); ?>>

<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover">

    <?php
    $setae_header_post = get_queried_object();
    $setae_header_has_app_shortcode = $setae_header_post instanceof WP_Post
        && has_shortcode((string) $setae_header_post->post_content, 'setae_dashboard');
    $setae_header_app_requested = class_exists('Setae_App_Shell')
        ? Setae_App_Shell::is_app_page_request()
        : (
            is_front_page()
            || $setae_header_has_app_shortcode
            || (isset($_GET['try']) && '1' === sanitize_text_field(wp_unslash($_GET['try'])))
            || (isset($_GET['setae_app']) && '1' === sanitize_text_field(wp_unslash($_GET['setae_app'])))
        );
    $setae_is_public_home = is_front_page() && !$setae_header_app_requested;
    $setae_document_title = $setae_is_public_home
        ? 'SETAE | タランチュラの飼育記録アプリ'
        : wp_get_document_title();
    $setae_public_description = '給餌、脱皮、写真を個体ごとに整理。今日見る個体と成長の流れがわかる、タランチュラとエキゾチックアニマルの飼育記録アプリです。';
    $setae_theme_user_id = get_current_user_id();
    $setae_theme_preference = $setae_theme_user_id
        ? sanitize_key(get_user_meta($setae_theme_user_id, '_setae_theme_preference', true))
        : 'system';
    if (!in_array($setae_theme_preference, array('light', 'dark', 'system'), true)) {
        $setae_theme_preference = 'system';
    }
    ?>

    <meta
        id="setae-theme-color"
        name="theme-color"
        content="#f3f2ed"
        data-light-color="#f3f2ed">
    <script>
        (function () {
            var preference = <?php echo wp_json_encode($setae_theme_preference); ?>;
            var isLoggedIn = <?php echo $setae_theme_user_id ? 'true' : 'false'; ?>;
            if (!isLoggedIn) {
                try {
                    var storedPreference = localStorage.getItem('setae_theme_preference_v1');
                    if (['light', 'dark', 'system'].indexOf(storedPreference) !== -1) {
                        preference = storedPreference;
                    }
                } catch (error) {}
            }
            var systemDark = window.matchMedia
                && window.matchMedia('(prefers-color-scheme: dark)').matches;
            var resolvedTheme = preference === 'system'
                ? (systemDark ? 'dark' : 'light')
                : preference;
            document.documentElement.dataset.setaeThemePreference = preference;
            document.documentElement.dataset.setaeTheme = resolvedTheme;
            document.documentElement.style.colorScheme = resolvedTheme;
            var themeColor = document.getElementById('setae-theme-color');
            if (themeColor) {
                themeColor.setAttribute('content', resolvedTheme === 'dark' ? '#151714' : '#f3f2ed');
            }
        })();
    </script>
    <?php if ($setae_is_public_home): ?>
        <meta name="description" content="<?php echo esc_attr($setae_public_description); ?>">
        <meta property="og:title" content="<?php echo esc_attr($setae_document_title); ?>">
        <meta property="og:description" content="<?php echo esc_attr($setae_public_description); ?>">
        <meta property="og:type" content="website">
        <meta property="og:url" content="<?php echo esc_url(home_url('/')); ?>">
    <?php endif; ?>

    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">

    <meta name="apple-mobile-web-app-title" content="SETAE">

    <link rel="apple-touch-icon" href="<?php echo get_template_directory_uri(); ?>/images/apple-touch-icon.png">

    <link rel="manifest" href="<?php echo esc_url(home_url('/setae-manifest.webmanifest')); ?>">
    <link rel="icon" type="image/png" sizes="192x192" href="<?php echo esc_url(get_template_directory_uri() . '/images/pwa-icon-192.png'); ?>">
    <title><?php echo esc_html($setae_document_title); ?></title>
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
    <?php wp_body_open(); ?>

    <?php if (!$setae_header_app_requested): ?>
        <div id="setae-preloader">
            <div class="setae-spinner"></div>
        </div>

        <script>
            document.addEventListener('DOMContentLoaded', function () {
                window.addEventListener('load', function () {
                    const preloader = document.getElementById('setae-preloader');
                    if (preloader) {
                        setTimeout(function () {
                            preloader.classList.add('is-loaded');
                        }, 300);
                    }
                });
            });
        </script>
    <?php endif; ?>
