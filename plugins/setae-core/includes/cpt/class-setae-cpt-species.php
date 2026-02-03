<?php

class Setae_CPT_Species
{

    public function register()
    {
        $labels = array(
            'name' => '図鑑',
            'singular_name' => '図鑑',
            'menu_name' => '図鑑',
            'name_admin_bar' => '図鑑',
            'add_new' => '新規追加',
            'add_new_item' => '新規種を追加',
            'new_item' => '新しい種',
            'edit_item' => '種を編集',
            'view_item' => '種を表示',
            'all_items' => 'すべての種',
            'search_items' => '種を検索',
            'not_found' => '見つかりませんでした',
            'not_found_in_trash' => 'ゴミ箱に見つかりませんでした',
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'encyclopedia'),
            'capability_type' => 'post',
            'has_archive' => true,
            'hierarchical' => false,
            'menu_position' => 5,
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt', 'custom-fields'),
            'show_in_rest' => true,
        );

        register_post_type('setae_species', $args);

        // Taxonomies
        $this->register_taxonomies();

        // Admin Columns
        add_filter('manage_setae_species_posts_columns', array($this, 'set_custom_columns'));
        add_action('manage_setae_species_posts_custom_column', array($this, 'render_custom_column'), 10, 2);
        add_filter('manage_edit-setae_species_sortable_columns', array($this, 'set_sortable_columns'));
    }

    private function register_taxonomies()
    {
        // Genus
        register_taxonomy('setae_genus', 'setae_species', array(
            'label' => '属 (Genus)',
            'rewrite' => array('slug' => 'genus'),
            'hierarchical' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Habitat
        register_taxonomy('setae_habitat', 'setae_species', array(
            'label' => '生息地 (Habitat)', // e.g. New World / Old World
            'hierarchical' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Temperament
        register_taxonomy('setae_temperament', 'setae_species', array(
            'label' => '性格 (Temperament)',
            'hierarchical' => false,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Initialize Meta Boxes
        require_once plugin_dir_path(__FILE__) . 'class-setae-species-meta.php';
        new Setae_Species_Meta();
    }



    public function set_custom_columns($columns)
    {
        // Reorder columns: Checkbox, Thumb, Title, Genus, Habitat, Date
        $new_columns = array();
        $new_columns['cb'] = $columns['cb'];
        $new_columns['setae_thumb'] = 'Image';
        $new_columns['title'] = 'Name (Japanese / Common)';
        $new_columns['setae_size'] = 'Max Legspan (cm)';

        // Add taxonomies (added auto by WP, but we want to control order)
        if (isset($columns['taxonomy-setae_genus']))
            $new_columns['taxonomy-setae_genus'] = $columns['taxonomy-setae_genus'];
        if (isset($columns['taxonomy-setae_habitat']))
            $new_columns['taxonomy-setae_habitat'] = $columns['taxonomy-setae_habitat'];
        if (isset($columns['taxonomy-setae_temperament']))
            $new_columns['taxonomy-setae_temperament'] = $columns['taxonomy-setae_temperament'];

        // Merge remaining
        foreach ($columns as $key => $value) {
            if (!isset($new_columns[$key])) {
                $new_columns[$key] = $value;
            }
        }
        return $new_columns;
    }

    public function render_custom_column($column, $post_id)
    {
        switch ($column) {
            case 'setae_thumb':
                if (has_post_thumbnail($post_id)) {
                    echo get_the_post_thumbnail($post_id, 'thumbnail', array('style' => 'width:50px; height:50px; object-fit:cover; border-radius:4px;'));
                } else {
                    echo '-';
                }
                break;
            case 'setae_size':
                $size = get_post_meta($post_id, '_setae_size', true);
                echo $size ? esc_html($size) . ' cm' : '-';
                break;
        }
    }

    public function set_sortable_columns($columns)
    {
        $columns['taxonomy-setae_genus'] = 'taxonomy-setae_genus';
        $columns['taxonomy-setae_habitat'] = 'taxonomy-setae_habitat';
        return $columns;
    }

}
