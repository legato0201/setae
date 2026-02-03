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

}
