<?php

class Setae_CPT_Baby_Group
{
    public function register()
    {
        $labels = array(
            'name' => 'ベビー群',
            'singular_name' => 'ベビー群',
            'menu_name' => 'ベビー群',
            'add_new' => 'ベビー群を追加',
            'add_new_item' => 'ベビー群を追加',
            'edit_item' => 'ベビー群を編集',
            'view_item' => 'ベビー群を表示',
            'all_items' => 'すべてのベビー群',
        );

        $args = array(
            'labels' => $labels,
            'public' => false,
            'publicly_queryable' => false,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => false,
            'capability_type' => 'post',
            'map_meta_cap' => true,
            'has_archive' => false,
            'hierarchical' => false,
            'menu_position' => 21,
            'supports' => array('title', 'custom-fields', 'author'),
            'show_in_rest' => false,
        );

        register_post_type('setae_baby_group', $args);
    }
}
