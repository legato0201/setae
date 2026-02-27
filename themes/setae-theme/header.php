<!DOCTYPE html>
<html <?php language_attributes(); ?>>

<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">

    <meta name="theme-color" content="#f5f7fa">

    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

    <meta name="apple-mobile-web-app-title" content="SETAE">

    <link rel="apple-touch-icon" href="<?php echo get_template_directory_uri(); ?>/images/apple-touch-icon.png">

    <link rel="apple-touch-startup-image" href="<?php echo get_template_directory_uri(); ?>/images/splash.png">
    <link rel="manifest" href="<?php echo get_template_directory_uri(); ?>/manifest.json">
    <link rel="icon" href="<?php echo get_template_directory_uri(); ?>/images/favicon.ico">
    <title>
        <?php wp_title('|', true, 'right'); ?>
    </title>
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>

    <div id="setae-preloader">
        <div class="setae-spinner"></div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            // ページ内の画像等すべてのリソースが読み込まれた後に発火
            window.addEventListener('load', function () {
                const preloader = document.getElementById('setae-preloader');
                if (preloader) {
                    // フェードアウトのトランジションをより自然に見せるための微小ディレイ
                    setTimeout(function () {
                        preloader.classList.add('is-loaded');
                    }, 300);
                }
            });
        });
    </script>