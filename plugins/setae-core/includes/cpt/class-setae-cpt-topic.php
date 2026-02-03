<?php

class Setae_CPT_Topic
{

    public function register()
    {
        $labels = array(
            'name' => 'コミュニティ',
            'singular_name' => 'トピック',
            'menu_name' => 'コミュニティ',
            'add_new' => 'トピック作成',
            'add_new_item' => 'トピックを追加',
            'edit_item' => 'トピックを編集',
            'view_item' => 'トピックを表示',
            'all_items' => 'すべてのトピック',
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'community'),
            'capability_type' => 'setae_topic',
            'map_meta_cap' => true,
            'has_archive' => true,
            'hierarchical' => false,
            'menu_position' => 7,
            'supports' => array('title', 'editor', 'author', 'thumbnail', 'comments', 'custom-fields'),
            'show_in_rest' => true,
        );

        register_post_type('setae_topic', $args);
    }
}
