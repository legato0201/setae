<?php

class Setae_CPT_Thread
{
    public function register()
    {
        $labels = array(
            'name' => 'Community Threads',
            'singular_name' => 'Thread',
            'menu_name' => 'Community',
            'add_new' => '新規スレッド',
            'add_new_item' => 'スレッドを追加',
            'edit_item' => 'スレッドを編集',
            'view_item' => 'スレッドを表示',
            'all_items' => 'すべてのスレッド',
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'thread'),
            'capability_type' => 'post',
            'has_archive' => true,
            'hierarchical' => false,
            'menu_position' => 7,
            'supports' => array('title', 'editor', 'author', 'comments', 'custom-fields'),
            'show_in_rest' => true,
        );

        register_post_type('setae_thread', $args);
    }
}
