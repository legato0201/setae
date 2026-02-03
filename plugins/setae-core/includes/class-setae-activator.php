<?php

/**
 * Fired during plugin activation
 */
class Setae_Activator
{

    /**
     * Create valid databases and permissions.
     */
    public static function activate()
    {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        // Custom Table: Breeding Loan Contracts
        $table_name = $wpdb->prefix . 'setae_bl_contracts';

        $sql = "CREATE TABLE $table_name (
			id mediumint(9) NOT NULL AUTO_INCREMENT,
			owner_id bigint(20) NOT NULL,
			breeder_id bigint(20) NOT NULL,
			spider_id bigint(20) NOT NULL,
			status varchar(50) DEFAULT 'REQUESTED' NOT NULL,
            message text DEFAULT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id)
		) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Add Custom Role for App Users
        add_role(
            'setae_user',
            'Setae User',
            array(
                'read' => true,
                'upload_files' => true,
                'level_0' => true // Basic subscriber level equivalent
            )
        );
    }
}
