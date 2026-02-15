<?php

class Setae_BL_Contracts
{

    private $table_name;
    private $chat_table_name; // 追加

    public function __construct()
    {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'setae_bl_contracts';
        $this->chat_table_name = $wpdb->prefix . 'setae_bl_chat'; // 追加
    }

    // ▼▼▼ 追加: チャット機能用メソッド ▼▼▼

    /**
     * チャットメッセージを送信（保存）
     */
    public function send_chat_message($contract_id, $user_id, $message)
    {
        global $wpdb;
        return $wpdb->insert(
            $this->chat_table_name,
            array(
                'contract_id' => $contract_id,
                'user_id' => $user_id,
                'message' => $message,
                'created_at' => current_time('mysql')
            ),
            array('%d', '%d', '%s', '%s')
        );
    }

    /**
     * 契約に関連するメッセージ履歴を取得
     */
    public function get_chat_history($contract_id)
    {
        global $wpdb;
        $sql = $wpdb->prepare(
            "SELECT * FROM {$this->chat_table_name} WHERE contract_id = %d ORDER BY created_at ASC",
            $contract_id
        );
        return $wpdb->get_results($sql);
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

                // Get Species Name
                $species_id = get_post_meta($spider_id, '_setae_species_id', true);
                $species_name = $species_id ? get_the_title($species_id) : 'Unknown Species';

                // Check Proven Status
                $is_proven = $this->check_is_proven($spider_id);

                $spiders[] = array(
                    'id' => $spider_id,
                    'title' => get_the_title(), // Changed from 'name' to 'title' to match JS usage in some places, or keep consistent
                    'name' => get_the_title(),
                    'species' => $species_name,
                    'gender' => get_post_meta($spider_id, '_setae_spider_gender', true),
                    'image' => get_the_post_thumbnail_url($spider_id, 'medium') ?: SETAE_PLUGIN_URL . 'assets/images/default-spider.png',
                    'image' => get_the_post_thumbnail_url($spider_id, 'medium') ?: SETAE_PLUGIN_URL . 'assets/images/default-spider.png',
                    'author_name' => get_the_author_meta('display_name'),
                    'owner_name' => get_the_author_meta('display_name'), // ★Added for JS compatibility
                    'gender' => get_post_meta($spider_id, '_setae_gender', true) ?: 'unknown', // ★Added
                    'terms' => get_post_meta($spider_id, '_setae_bl_terms', true),
                    'last_molt' => get_post_meta($spider_id, '_setae_last_molt_date', true),
                    'is_proven' => $is_proven
                );
            }
            wp_reset_postdata();
        }
        return $spiders;
    }

    public function check_is_proven($spider_id)
    {
        global $wpdb;
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $this->table_name WHERE spider_id = %d AND status = 'SUCCESS'",
            $spider_id
        ));
        return $count > 0;
    }

}
