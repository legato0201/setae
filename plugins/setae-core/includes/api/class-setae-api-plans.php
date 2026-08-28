<?php

class Setae_API_Plans
{
    public function register_routes()
    {
        register_rest_route('setae/v1', '/plans', array(
            'methods' => 'GET', 'callback' => array($this, 'get_plans'), 'permission_callback' => '__return_true',
        ));
        register_rest_route('setae/v1', '/plans/trial', array(
            'methods' => 'POST', 'callback' => array($this, 'start_trial'),
            'permission_callback' => function () { return is_user_logged_in(); },
        ));
    }

    public function get_plans($request)
    {
        // Public display configuration only. Never expose a Stripe Price or key.
        return new WP_REST_Response(array('breeder_starter' => Setae_Billing::starter_configuration()), 200);
    }

    public function start_trial($request)
    {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return new WP_Error('rest_not_logged_in', 'ログインしてください。', array('status' => 401));
        }
        $result = Setae_Entitlements::start_breeder_trial($user_id);
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response(array(
            'trial' => Setae_Entitlements::get_trial_state($user_id),
            'plan_id' => Setae_Entitlements::get_plan_id($user_id),
            'inventory' => Setae_Entitlements::get_inventory_usage($user_id),
            'entitlements' => Setae_Entitlements::get_entitlements($user_id),
        ), 200);
    }
}
