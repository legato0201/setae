<!DOCTYPE html>
<html <?php language_attributes(); ?>>

<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

    <meta name="theme-color" content="#f5f7fa">

    <meta name="apple-mobile-web-app-title" content="SETAE">

    <link rel="apple-touch-icon" href="<?php echo get_template_directory_uri(); ?>/images/apple-touch-icon.png">

    <link rel="icon" href="<?php echo get_template_directory_uri(); ?>/images/favicon.ico">
    <title>
        <?php wp_title('|', true, 'right'); ?>
    </title>
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>