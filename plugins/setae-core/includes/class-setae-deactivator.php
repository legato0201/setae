<?php

/**
 * Fired during plugin deactivation
 */
class Setae_Deactivator
{

    /**
     * Short Description. (use period)
     *
     * Long Description.
     */
    public static function deactivate()
    {
        // Flush rewrite rules if CPTs were registered
        flush_rewrite_rules();
    }

}
