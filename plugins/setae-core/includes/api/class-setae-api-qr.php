<?php

class Setae_API_QR
{
    public function register_routes()
    {
        register_rest_route('setae/v1', '/qr/targets', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_targets'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/resolve', array(
            'methods' => 'POST',
            'callback' => array($this, 'resolve_target'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/passport/(?P<code>[23456789abcdefghjkmnpqrstuvwxyz]{4,8})', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_public_passport'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('setae/v1', '/qr/records', array(
            'methods' => 'POST',
            'callback' => array($this, 'record_targets'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/spiders/(?P<id>\d+)/settings', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_spider_settings'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/transfers', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_transfers'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/transfers/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'respond_to_transfer'),
            'permission_callback' => array($this, 'require_login'),
        ));

        register_rest_route('setae/v1', '/qr/notifications/read', array(
            'methods' => 'POST',
            'callback' => array($this, 'mark_notifications_read'),
            'permission_callback' => array($this, 'require_login'),
        ));
    }

    public function require_login()
    {
        return is_user_logged_in();
    }

    public function get_targets($request)
    {
        $source = sanitize_key($request->get_param('source') ?: 'spider');
        $user_id = get_current_user_id();
        $targets = array();

        if ($source === 'baby') {
            $group_id = absint($request->get_param('group_id'));
            $group = get_post($group_id);
            if (!$group || $group->post_type !== 'setae_baby_group') {
                return new WP_Error('qr_group_not_found', 'ベビー群が見つかりません。', array('status' => 404));
            }
            if ((int) $group->post_author !== $user_id && !current_user_can('manage_options')) {
                return new WP_Error('qr_forbidden', 'このベビー群のQRは発行できません。', array('status' => 403));
            }

            $codes = array_values(array_unique($this->parse_list($request->get_param('codes'))));
            $allowed = $this->check_label_batch($user_id, count($codes));
            if (is_wp_error($allowed)) {
                return $allowed;
            }
            foreach ($codes as $baby_code) {
                $target = Setae_QR_Manager::ensure_baby_target($group_id, $baby_code);
                if (is_wp_error($target)) {
                    return $target;
                }
                $data = Setae_QR_Manager::get_target_label_data($target);
                if ($data) {
                    $targets[] = $data;
                }
            }
        } elseif ($source === 'enclosure') {
            $ids = array_map('absint', $this->parse_list($request->get_param('ids')));
            $ids = array_values(array_unique(array_filter($ids)));
            $allowed = $this->check_label_batch($user_id, count($ids));
            if (is_wp_error($allowed)) {
                return $allowed;
            }
            foreach ($ids as $enclosure_id) {
                $target = Setae_QR_Manager::ensure_enclosure_target($enclosure_id, $user_id);
                if (is_wp_error($target)) {
                    return $target;
                }
                $data = Setae_QR_Manager::get_target_label_data($target);
                if ($data) {
                    $targets[] = $data;
                }
            }
        } else {
            $ids = array_map('absint', $this->parse_list($request->get_param('ids')));
            $ids = array_values(array_unique(array_filter($ids)));
            $allowed = $this->check_label_batch($user_id, count($ids));
            if (is_wp_error($allowed)) {
                return $allowed;
            }
            foreach ($ids as $spider_id) {
                $spider = get_post($spider_id);
                if (!$spider || $spider->post_type !== 'setae_spider') {
                    continue;
                }
                if ((int) $spider->post_author !== $user_id && !current_user_can('manage_options')) {
                    return new WP_Error('qr_forbidden', 'この個体のQRは発行できません。', array('status' => 403));
                }
                $target = Setae_QR_Manager::ensure_spider_target($spider_id);
                if (is_wp_error($target)) {
                    return $target;
                }
                $data = Setae_QR_Manager::get_target_label_data($target);
                if ($data) {
                    $targets[] = $data;
                }
            }
        }

        // Target lookup also powers Passport URL copying; count only explicit label generation.
        if ($targets && $request->get_param('purpose') === 'labels' && class_exists('Setae_Product_Events')) {
            $operation_id = $request->get_param('operation_id');
            $operation_id = is_string($operation_id) && preg_match('/^[a-zA-Z0-9_-]{8,80}$/', $operation_id)
                ? $operation_id : wp_generate_uuid4();
            Setae_Entitlements::record_event('label_exported', array(
                'idempotency_key' => 'label-batch:' . hash('sha256', $user_id . '|' . $operation_id),
                'user_id' => $user_id,
                'object_type' => 'label',
                'acquisition_source' => 'app',
                'properties' => array('count' => count($targets), 'source' => $source === 'baby' ? 'nursery_promotion' : 'manual'),
            ));
        }
        return new WP_REST_Response(array('items' => $targets, 'count' => count($targets)), 200);
    }

    private function check_label_batch($user_id, $count)
    {
        // Resource protection is separate from the plan's 20 / 100 / unlimited entitlement.
        if ($count > 5000) {
            return new WP_Error('qr_label_resource_limit', '一度に生成できるのは5000件までです。選択件数を減らして分けて生成してください。', array(
                'status' => 400, 'reason' => 'resource_limit', 'resource_limit' => 5000, 'count' => (int) $count,
            ));
        }
        return Setae_Entitlements::can_export_label_batch($user_id, $count);
    }

    public function resolve_target($request)
    {
        $code = $this->code_from_value($request->get_param('code'));
        $target = Setae_QR_Manager::get_target_by_code($code);
        if (!$target) {
            return new WP_Error('qr_not_found', 'SETAEのQRを確認できませんでした。', array('status' => 404));
        }
        if (!Setae_QR_Manager::user_owns_target($target, get_current_user_id())) {
            return new WP_Error('qr_not_owned', 'このQRは自分の管理対象ではありません。', array('status' => 403));
        }
        $data = Setae_QR_Manager::get_target_label_data($target);
        if (!$data) {
            return new WP_Error('qr_target_missing', 'QRに紐づく個体が見つかりません。', array('status' => 404));
        }
        return new WP_REST_Response($data, 200);
    }

    public function get_public_passport($request)
    {
        $rate_limit = Setae_App_Operations::consume_request_limit('qr_passport', 120, 5 * MINUTE_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            return $rate_limit;
        }
        $target = Setae_QR_Manager::get_target_by_code($request['code']);
        if (!$target) {
            $missing_limit = Setae_App_Operations::consume_request_limit('qr_passport_missing', 20, 10 * MINUTE_IN_SECONDS);
            if (is_wp_error($missing_limit)) {
                return $missing_limit;
            }
            return new WP_Error('qr_not_found', 'SETAEのQRを確認できませんでした。', array('status' => 404));
        }
        $passport = Setae_QR_Manager::get_public_passport_data($target, get_current_user_id());
        if (!$passport) {
            return new WP_Error('qr_passport_unavailable', 'このQRには公開Passportがありません。', array('status' => 404));
        }
        return new WP_REST_Response($passport, 200);
    }

    public function record_targets($request)
    {
        $codes = $request->get_param('codes');
        if (is_string($codes)) {
            $decoded = json_decode($codes, true);
            $codes = is_array($decoded) ? $decoded : $this->parse_list($codes);
        }

        $records = $request->get_param('records');
        if (is_string($records)) {
            $decoded_records = json_decode($records, true);
            $records = is_array($decoded_records) ? $decoded_records : array();
        }

        $entries = $request->get_param('entries');
        if (is_string($entries)) {
            $decoded_entries = json_decode($entries, true);
            $entries = is_array($decoded_entries) ? $decoded_entries : array();
        }
        if (is_array($entries) && !empty($entries)) {
            $result = Setae_QR_Manager::record_target_entries($entries, get_current_user_id());
            if (is_wp_error($result)) {
                return $result;
            }
            return new WP_REST_Response($result, 201);
        }

        if (is_array($records) && !empty($records)) {
            $result = Setae_QR_Manager::record_target_batch((array) $codes, $records);
            if (is_wp_error($result)) {
                return $result;
            }
            return new WP_REST_Response($result, 201);
        }

        $result = Setae_QR_Manager::record_targets(
            (array) $codes,
            $request->get_param('type'),
            $request->get_param('date'),
            $request->get_param('note'),
            $request->get_param('prey_type')
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 201);
    }

    public function update_spider_settings($request)
    {
        $result = Setae_QR_Manager::update_spider_settings(
            absint($request['id']),
            get_current_user_id(),
            $request->get_param('public'),
            $request->get_param('transfer_enabled'),
            $request->get_param('visibility')
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response(array('success' => true, 'target' => $result), 200);
    }

    public function get_transfers()
    {
        return new WP_REST_Response(Setae_QR_Manager::get_transfer_overview(get_current_user_id()), 200);
    }

    public function respond_to_transfer($request)
    {
        $result = Setae_QR_Manager::respond_to_transfer(
            absint($request['id']),
            sanitize_key($request->get_param('action')),
            get_current_user_id()
        );
        if (is_wp_error($result)) {
            return $result;
        }
        return new WP_REST_Response($result, 200);
    }

    public function mark_notifications_read()
    {
        $items = Setae_QR_Manager::mark_notifications_read(get_current_user_id());
        return new WP_REST_Response(array('success' => true, 'items' => $items), 200);
    }

    private function parse_list($value)
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('sanitize_text_field', $value)));
        }
        return array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', (string) $value))));
    }

    private function code_from_value($value)
    {
        $value = trim((string) $value);
        if (filter_var($value, FILTER_VALIDATE_URL)) {
            $path = trim((string) parse_url($value, PHP_URL_PATH), '/');
            $parts = array_values(array_filter(explode('/', $path)));
            $value = $parts ? end($parts) : '';
        }
        return Setae_QR_Manager::sanitize_code($value);
    }
}
