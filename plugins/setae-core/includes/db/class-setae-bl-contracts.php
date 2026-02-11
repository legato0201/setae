<?php

class Setae_BL_Contracts
{

    private $table_name;

    public function __construct()
    {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'setae_bl_contracts';
    }

    public function create_request($owner_id, $breeder_id, $spider_id, $message = '')
    {
        global $wpdb;
        return $wpdb->insert(
            $this->table_name,
            array(
                'owner_id' => $owner_id,
                'breeder_id' => $breeder_id,
                'spider_id' => $spider_id,
                'status' => 'REQUESTED',
                'message' => $message,
                'created_at' => current_time('mysql'),
            ),
            array('%d', '%d', '%d', '%s', '%s', '%s')
        );
    }

    public function update_status($id, $status)
    {
        global $wpdb;
        $allowed_statuses = array('REQUESTED', 'APPROVED', 'REJECTED', 'PAIRED', 'SUCCESS', 'FAIL');

        if (!in_array($status, $allowed_statuses)) {
            return false;
        }

        return $wpdb->update(
            $this->table_name,
            array(
                'status' => $status,
                'updated_at' => current_time('mysql')
            ),
            array('id' => $id),
            array('%s', '%s'),
            array('%d')
        );
    }

    public function get_contracts_by_user($user_id)
    {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $this->table_name WHERE owner_id = %d OR breeder_id = %d ORDER BY created_at DESC",
            $user_id,
            $user_id
        ));
    }

    public function get_contract($id)
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $this->table_name WHERE id = %d", $id));
    }

    /**
     * Get list of spiders recruiting for BL
     *
     * @return array List of spider data
     */
    public function get_recruiting_spiders()
    {
        $args = array(
            'post_type' => 'setae_spider',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_setae_bl_status',
                    'value' => 'recruiting',
                    'compare' => '='
                )
            )
        );

        $query = new WP_Query($args);
        $spiders = array();

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $spider_id = get_the_ID();

                // 自分の個体は除外するなどのロジックもここに記述可能

                // Get Species Name
                $species_id = get_post_meta($spider_id, '_setae_species_id', true);
                $species_name = $species_id ? get_the_title($species_id) : 'Unknown Species';

                $spiders[] = array(
                    'id' => $spider_id,
                    'name' => get_the_title(),
                    'species' => $species_name,
                    'gender' => get_post_meta($spider_id, '_setae_spider_gender', true),   // Assuming this meta exists or will be added
                    'image' => get_the_post_thumbnail_url($spider_id, 'medium'),
                    'author_name' => get_the_author_meta('display_name'),
                    'terms' => get_post_meta($spider_id, '_setae_bl_terms', true)
                );
            }
            wp_reset_postdata();
        }
        return $spiders;
    }

}
