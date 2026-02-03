<?php

class Setae_CPT_Spider
{

    public function register()
    {
        $labels = array(
            'name' => 'My Spiders',
            'singular_name' => 'Spider',
            'menu_name' => 'My Spiders',
            'add_new' => '個体登録',
            'add_new_item' => '個体を追加',
            'edit_item' => '個体を編集',
            'view_item' => '個体を表示',
            'all_items' => 'すべての個体',
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'spider'),
            'capability_type' => 'setae_spider',
            'map_meta_cap' => true,
            'has_archive' => false,
            'hierarchical' => false,
            'menu_position' => 6,
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields', 'author'), // Added author support
            'show_in_rest' => true,
        );

        register_post_type('setae_spider', $args);

        // Initialize Meta Boxes
        require_once plugin_dir_path(__FILE__) . 'class-setae-spider-meta.php';
        new Setae_Spider_Meta();
    }
}
