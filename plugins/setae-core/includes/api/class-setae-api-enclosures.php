<?php

/**
 * REST endpoints for enclosure records, occupancy, and husbandry history.
 */
class Setae_API_Enclosures
{
    public function register_routes()
    {
        register_rest_route('setae/v1', '/enclosures', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_items'),
                'permission_callback' => array($this, 'check_auth'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'create_item'),
                'permission_callback' => array($this, 'check_auth'),
            ),
        ));

        register_rest_route('setae/v1', '/enclosures/(?P<id>\d+)', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_item'),
                'permission_callback' => array($this, 'check_auth'),
            ),
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array($this, 'update_item'),
                'permission_callback' => array($this, 'check_auth'),
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array($this, 'archive_item'),
                'permission_callback' => array($this, 'check_auth'),
            ),
        ));

        register_rest_route('setae/v1', '/enclosures/(?P<id>\d+)/events', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'create_event'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/enclosures/(?P<id>\d+)/occupancies', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'create_occupancies'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/enclosures/(?P<id>\d+)/occupancies/(?P<animal_id>\d+)', array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => array($this, 'end_occupancy'),
            'permission_callback' => array($this, 'check_auth'),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    public function get_items($request)
    {
        $user_id = get_current_user_id();
        Setae_Enclosures::migrate_legacy_for_user($user_id);
        $items = Setae_Enclosures::list_for_user($user_id, sanitize_key($request->get_param('status') ?: 'active'));
        $environment_due = 0;
        $maintenance_due = 0;
        foreach ($items as $item) {
            if (!empty($item['care']['environment_due'])) {
                $environment_due++;
            }
            if (!empty($item['care']['maintenance_due'])) {
                $maintenance_due++;
            }
        }
        return $this->private_response(array(
            'items' => $items,
            'summary' => array(
                'active' => count($items),
                'active_enclosures' => count($items),
                'occupants' => array_sum(wp_list_pluck($items, 'occupant_count')),
                'environment_due' => $environment_due,
                'maintenance_due' => $maintenance_due,
            ),
        ), 200);
    }

    public function get_item($request)
    {
        $user_id = get_current_user_id();
        Setae_Enclosures::migrate_legacy_for_user($user_id);
        $item = Setae_Enclosures::get_for_user($user_id, absint($request['id']));
        return $item
            ? $this->private_response($item, 200)
            : new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
    }

    public function create_item($request)
    {
        $item = Setae_Enclosures::create(get_current_user_id(), $request->get_params());
        if (is_wp_error($item)) {
            return $item;
        }
        $occupant_ids = $this->animal_ids($request);
        foreach ($occupant_ids as $animal_id) {
            $result = Setae_Enclosures::assign_animal(get_current_user_id(), $item['id'], $animal_id, $request->get_param('started_at'));
            if (is_wp_error($result)) {
                return $result;
            }
        }
        return $this->private_response(Setae_Enclosures::get_for_user(get_current_user_id(), $item['id']), 201);
    }

    public function update_item($request)
    {
        $item = Setae_Enclosures::update(get_current_user_id(), absint($request['id']), $request->get_params());
        return is_wp_error($item) ? $item : $this->private_response($item, 200);
    }

    public function archive_item($request)
    {
        $item = Setae_Enclosures::get_for_user(get_current_user_id(), absint($request['id']));
        if (!$item) {
            return new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        if (!empty($item['occupants'])) {
            return new WP_Error('enclosure_has_occupants', '入居中の個体を移動してからアーカイブしてください。', array('status' => 409));
        }
        $item = Setae_Enclosures::archive(get_current_user_id(), absint($request['id']));
        return is_wp_error($item) ? $item : $this->private_response(array('success' => true, 'item' => $item), 200);
    }

    public function create_event($request)
    {
        $item = Setae_Enclosures::add_event(get_current_user_id(), absint($request['id']), $request->get_params());
        return is_wp_error($item) ? $item : $this->private_response($item, 201);
    }

    public function create_occupancies($request)
    {
        $animal_ids = $this->animal_ids($request);
        if (!$animal_ids) {
            return new WP_Error('missing_animals', '入居させる個体を選択してください。', array('status' => 400));
        }
        $item = null;
        foreach ($animal_ids as $animal_id) {
            $item = Setae_Enclosures::assign_animal(
                get_current_user_id(),
                absint($request['id']),
                $animal_id,
                $request->get_param('started_at'),
                $request->get_param('note')
            );
            if (is_wp_error($item)) {
                return $item;
            }
        }
        return $this->private_response($item, 200);
    }

    public function end_occupancy($request)
    {
        $item = Setae_Enclosures::remove_animal(
            get_current_user_id(),
            absint($request['id']),
            absint($request['animal_id']),
            $request->get_param('ended_at'),
            $request->get_param('note')
        );
        return is_wp_error($item) ? $item : $this->private_response($item, 200);
    }

    private function animal_ids($request)
    {
        $values = $request->get_param('animal_ids');
        if (!is_array($values)) {
            $single = $request->get_param('animal_id');
            $values = $single ? array($single) : array();
        }
        return array_values(array_unique(array_filter(array_map('absint', $values))));
    }

    private function private_response($data, $status)
    {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, private');
        return $response;
    }
}
