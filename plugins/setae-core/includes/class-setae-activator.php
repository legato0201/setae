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
        require_once plugin_dir_path(__FILE__) . 'db/class-setae-enclosures.php';
        Setae_Enclosures::install_schema();
        require_once plugin_dir_path(__FILE__) . 'db/class-setae-product-events.php';
        require_once plugin_dir_path(__FILE__) . 'db/class-setae-billing-events.php';
        Setae_Product_Events::install_schema();
        Setae_Billing_Events::install_schema();

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

        $administrator = get_role('administrator');
        if ($administrator) {
            $administrator->add_cap('manage_setae_species_api');
        }
    }
}
