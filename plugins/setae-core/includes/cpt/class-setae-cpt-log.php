<?php

class Setae_CPT_Log
{

    public function register()
    {
        $labels = array(
            'name' => 'Logs',
            'singular_name' => 'Log',
            'menu_name' => 'Logs',
            'add_new' => 'ログ追加',
            'add_new_item' => 'ログを追加',
            'edit_item' => 'ログを編集',
            'view_item' => 'ログを表示',
            'all_items' => 'すべてのログ',
        );

        $args = array(
            'labels' => $labels,
            'public' => false, // Internal use only
            'publicly_queryable' => false,
            'show_ui' => true, // Visible in admin for debugging
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'log'),
            'capability_type' => 'setae_log',
            'map_meta_cap' => true,
            'has_archive' => false,
            'hierarchical' => false,
            'menu_position' => 20,
            'supports' => array('title', 'editor', 'custom-fields', 'author'),
            'show_in_rest' => true,
        );

        register_post_type('setae_log', $args);
    }
}
