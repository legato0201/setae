<?php

/**
 * REST endpoints for feeder inventory, maintenance, and egg batches.
 */
class Setae_API_Feeders
{
    const INVENTORY_META_KEY = '_setae_feeder_inventory_v1';
    const EVENTS_META_KEY = '_setae_feeder_events_v1';
    const EGG_BATCHES_META_KEY = '_setae_feeder_egg_batches_v1';

    public function register_routes()
    {
        register_rest_route('setae/v1', '/feeders', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_dashboard'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/feeders/actions', array(
            'methods' => 'POST',
            'callback' => array($this, 'record_action'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/feeders/eggs', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_egg_batch'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/feeders/eggs/(?P<id>[a-zA-Z0-9-]+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_egg_batch'),
            'permission_callback' => array($this, 'check_auth'),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    public function get_dashboard()
    {
        return new WP_REST_Response($this->build_dashboard(get_current_user_id()), 200);
    }

    public function record_action($request)
    {
        $user_id = get_current_user_id();
        $types = $this->get_feeder_types();
        $type_key = sanitize_key($request->get_param('feeder_type'));
        $action = sanitize_key($request->get_param('action'));
        $allowed_actions = array('purchase', 'consume', 'breed', 'box_reset', 'adjust');

        if (!isset($types[$type_key])) {
            return new WP_Error('invalid_feeder_type', '餌の種類を選択してください。', array('status' => 400));
        }

        if (!in_array($action, $allowed_actions, true)) {
            return new WP_Error('invalid_feeder_action', '記録の種類が正しくありません。', array('status' => 400));
        }

        $date = $this->normalize_date($request->get_param('date'), current_time('Y-m-d'));
        if (!$date) {
            return new WP_Error('invalid_feeder_date', '日付を正しく入力してください。', array('status' => 400));
        }

        $quantity_param = $request->get_param('quantity');
        $quantity = $action === 'box_reset'
            ? 0
            : filter_var($quantity_param, FILTER_VALIDATE_INT);
        $minimum_quantity = $action === 'adjust' ? 0 : 1;
        if ($action !== 'box_reset' && ($quantity === false || $quantity < $minimum_quantity || $quantity > 100000)) {
            $message = $action === 'breed'
                ? '繁殖で増えた匹数を1〜100,000匹で入力してください。'
                : '匹数は1〜100,000で入力してください。';
            return new WP_Error('invalid_feeder_quantity', $message, array('status' => 400));
        }

        $inventory = $this->get_inventory($user_id);
        $item = $inventory[$type_key];
        $before_count = (int) $item['count'];
        $after_count = $before_count;

        if ($action === 'purchase' || $action === 'breed') {
            $after_count += $quantity;
        } elseif ($action === 'consume') {
            if ($quantity > $before_count) {
                return new WP_Error(
                    'feeder_stock_shortage',
                    '現在の在庫より多い匹数は使用できません。先に在庫数を調整してください。',
                    array('status' => 400)
                );
            }
            $after_count -= $quantity;
        } elseif ($action === 'adjust') {
            $after_count = $quantity;
        } elseif ($action === 'box_reset') {
            $item['last_cleaned_at'] = $date;
        }

        $item['count'] = max(0, $after_count);
        $item['initialized'] = true;
        $item['last_action_at'] = current_time('mysql');
        $inventory[$type_key] = $item;
        update_user_meta($user_id, self::INVENTORY_META_KEY, $inventory);

        $event = array(
            'id' => wp_generate_uuid4(),
            'feeder_type' => $type_key,
            'feeder_label' => $types[$type_key]['label'],
            'action' => $action,
            'action_label' => $this->get_action_label($action),
            'quantity' => $action === 'box_reset' ? 0 : $quantity,
            'before_count' => $before_count,
            'after_count' => (int) $item['count'],
            'date' => $date,
            'note' => sanitize_textarea_field($request->get_param('note')),
            'created_at' => current_time('mysql'),
        );
        $this->prepend_event($user_id, $event);

        return new WP_REST_Response(array(
            'success' => true,
            'dashboard' => $this->build_dashboard($user_id),
        ), 200);
    }

    public function create_egg_batch($request)
    {
        $user_id = get_current_user_id();
        $types = $this->get_feeder_types();
        $type_key = sanitize_key($request->get_param('feeder_type'));

        if (!isset($types[$type_key])) {
            return new WP_Error('invalid_feeder_type', '餌の種類を選択してください。', array('status' => 400));
        }

        $set_date = $this->normalize_date($request->get_param('set_date'), current_time('Y-m-d'));
        if (!$set_date) {
            return new WP_Error('invalid_set_date', '卵をセットした日を正しく入力してください。', array('status' => 400));
        }

        $temperature = (float) $request->get_param('temperature');
        if ($temperature < 18 || $temperature > 35) {
            return new WP_Error('invalid_temperature', '温度は18〜35℃の範囲で入力してください。', array('status' => 400));
        }

        $estimate = $this->calculate_hatch_estimate($types[$type_key], $set_date, $temperature);
        $batch = array(
            'id' => wp_generate_uuid4(),
            'feeder_type' => $type_key,
            'feeder_label' => $types[$type_key]['label'],
            'set_date' => $set_date,
            'temperature' => round($temperature, 1),
            'estimated_days' => $estimate['days'],
            'uncertainty_days' => $estimate['uncertainty_days'],
            'estimated_hatch_date' => $estimate['estimated_hatch_date'],
            'estimated_start_date' => $estimate['estimated_start_date'],
            'estimated_end_date' => $estimate['estimated_end_date'],
            'status' => 'incubating',
            'note' => sanitize_textarea_field($request->get_param('note')),
            'actual_hatch_date' => '',
            'hatched_count' => 0,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql'),
        );

        $batches = $this->get_egg_batches($user_id);
        array_unshift($batches, $batch);
        update_user_meta($user_id, self::EGG_BATCHES_META_KEY, array_slice($batches, 0, 100));

        $this->prepend_event($user_id, array(
            'id' => wp_generate_uuid4(),
            'feeder_type' => $type_key,
            'feeder_label' => $types[$type_key]['label'],
            'action' => 'egg_set',
            'action_label' => '卵をセット',
            'quantity' => 0,
            'before_count' => null,
            'after_count' => null,
            'date' => $set_date,
            'note' => sanitize_textarea_field($request->get_param('note')),
            'created_at' => current_time('mysql'),
        ));

        return new WP_REST_Response(array(
            'success' => true,
            'batch' => $batch,
            'dashboard' => $this->build_dashboard($user_id),
        ), 201);
    }

    public function update_egg_batch($request)
    {
        $user_id = get_current_user_id();
        $batch_id = sanitize_text_field($request['id']);
        $status = sanitize_key($request->get_param('status'));
        $allowed_statuses = array('hatched', 'cancelled');

        if (!in_array($status, $allowed_statuses, true)) {
            return new WP_Error('invalid_egg_status', '卵の状態が正しくありません。', array('status' => 400));
        }

        $batches = $this->get_egg_batches($user_id);
        $batch_index = null;
        foreach ($batches as $index => $batch) {
            if (!empty($batch['id']) && hash_equals((string) $batch['id'], (string) $batch_id)) {
                $batch_index = $index;
                break;
            }
        }

        if ($batch_index === null) {
            return new WP_Error('egg_batch_not_found', '卵セットが見つかりません。', array('status' => 404));
        }

        if (($batches[$batch_index]['status'] ?? '') !== 'incubating') {
            return new WP_Error('egg_batch_closed', 'この卵セットはすでに完了しています。', array('status' => 400));
        }

        $actual_date = $this->normalize_date($request->get_param('actual_hatch_date'), current_time('Y-m-d'));
        $hatched_count = absint($request->get_param('hatched_count'));
        if ($status === 'hatched' && $hatched_count > 100000) {
            return new WP_Error('invalid_hatched_count', '孵化数は100,000以下で入力してください。', array('status' => 400));
        }

        $batch = $batches[$batch_index];
        $batch['status'] = $status;
        $batch['updated_at'] = current_time('mysql');
        if ($status === 'hatched') {
            $batch['actual_hatch_date'] = $actual_date;
            $batch['hatched_count'] = $hatched_count;
        }
        $batches[$batch_index] = $batch;
        update_user_meta($user_id, self::EGG_BATCHES_META_KEY, $batches);

        $types = $this->get_feeder_types();
        $type_key = sanitize_key($batch['feeder_type']);
        $before_count = null;
        $after_count = null;

        if ($status === 'hatched' && $hatched_count > 0 && isset($types[$type_key])) {
            $inventory = $this->get_inventory($user_id);
            $before_count = (int) $inventory[$type_key]['count'];
            $inventory[$type_key]['count'] = $before_count + $hatched_count;
            $inventory[$type_key]['initialized'] = true;
            $inventory[$type_key]['last_action_at'] = current_time('mysql');
            $after_count = (int) $inventory[$type_key]['count'];
            update_user_meta($user_id, self::INVENTORY_META_KEY, $inventory);
        }

        $this->prepend_event($user_id, array(
            'id' => wp_generate_uuid4(),
            'feeder_type' => $type_key,
            'feeder_label' => $types[$type_key]['label'] ?? ($batch['feeder_label'] ?? '餌'),
            'action' => $status === 'hatched' ? 'hatched' : 'egg_cancelled',
            'action_label' => $status === 'hatched' ? '孵化を記録' : '卵セットを終了',
            'quantity' => $status === 'hatched' ? $hatched_count : 0,
            'before_count' => $before_count,
            'after_count' => $after_count,
            'date' => $status === 'hatched' ? $actual_date : current_time('Y-m-d'),
            'note' => sanitize_textarea_field($request->get_param('note')),
            'created_at' => current_time('mysql'),
        ));

        return new WP_REST_Response(array(
            'success' => true,
            'dashboard' => $this->build_dashboard($user_id),
        ), 200);
    }

    private function get_feeder_types()
    {
        return array(
            'croco' => array(
                'key' => 'croco',
                'label' => 'フタホシコオロギ',
                'common_name' => 'クロコオロギ',
                'scientific_name' => 'Gryllus bimaculatus',
                'category' => 'cricket',
                'incubation' => array('reference_temp' => 28, 'reference_days' => 10, 'sensitivity' => 1.2, 'min_days' => 6, 'max_days' => 36),
            ),
            'ieko' => array(
                'key' => 'ieko',
                'label' => 'ヨーロッパイエコオロギ',
                'common_name' => 'イエコ',
                'scientific_name' => 'Acheta domesticus',
                'category' => 'cricket',
                'incubation' => array('reference_temp' => 30, 'reference_days' => 13, 'sensitivity' => 1.1, 'min_days' => 7, 'max_days' => 30),
            ),
            'red_runner' => array(
                'key' => 'red_runner',
                'label' => 'トルキスタンゴキブリ',
                'common_name' => 'レッドローチ',
                'scientific_name' => 'Shelfordella lateralis',
                'category' => 'roach',
                'incubation' => array('reference_temp' => 28, 'reference_days' => 45, 'sensitivity' => 2.0, 'min_days' => 28, 'max_days' => 90),
            ),
            'field_cricket' => array(
                'key' => 'field_cricket',
                'label' => 'タンボコオロギ',
                'common_name' => '',
                'scientific_name' => 'Modicogryllus siamensis',
                'category' => 'cricket',
                'incubation' => array('reference_temp' => 28, 'reference_days' => 10, 'sensitivity' => 1.3, 'min_days' => 6, 'max_days' => 36),
            ),
            'mealworm' => array(
                'key' => 'mealworm',
                'label' => 'チャイロコメノゴミムシダマシ',
                'common_name' => 'ミルワーム（幼虫）',
                'scientific_name' => 'Tenebrio molitor',
                'category' => 'beetle',
                'incubation' => array('reference_temp' => 27, 'reference_days' => 8, 'sensitivity' => 0.8, 'min_days' => 4, 'max_days' => 19),
            ),
        );
    }

    private function get_inventory($user_id)
    {
        $saved = get_user_meta($user_id, self::INVENTORY_META_KEY, true);
        if (!is_array($saved)) {
            $saved = array();
        }

        $inventory = array();
        foreach ($this->get_feeder_types() as $key => $type) {
            $item = isset($saved[$key]) && is_array($saved[$key]) ? $saved[$key] : array();
            $inventory[$key] = array(
                'feeder_type' => $key,
                'label' => $type['label'],
                'common_name' => $type['common_name'],
                'scientific_name' => $type['scientific_name'],
                'category' => $type['category'],
                'count' => max(0, (int) ($item['count'] ?? 0)),
                'low_stock_threshold' => max(1, (int) ($item['low_stock_threshold'] ?? 20)),
                'initialized' => !empty($item['initialized']),
                'last_cleaned_at' => sanitize_text_field($item['last_cleaned_at'] ?? ''),
                'last_action_at' => sanitize_text_field($item['last_action_at'] ?? ''),
            );
        }

        return $inventory;
    }

    private function get_events($user_id)
    {
        $events = get_user_meta($user_id, self::EVENTS_META_KEY, true);
        return is_array($events) ? $events : array();
    }

    private function prepend_event($user_id, $event)
    {
        $events = $this->get_events($user_id);
        array_unshift($events, $event);
        update_user_meta($user_id, self::EVENTS_META_KEY, array_slice($events, 0, 200));
    }

    private function get_egg_batches($user_id)
    {
        $batches = get_user_meta($user_id, self::EGG_BATCHES_META_KEY, true);
        return is_array($batches) ? $batches : array();
    }

    private function build_dashboard($user_id)
    {
        $types = $this->get_feeder_types();
        $inventory = array_values($this->get_inventory($user_id));
        $batches = $this->get_egg_batches($user_id);
        $events = $this->get_events($user_id);
        $today = current_time('Y-m-d');

        foreach ($batches as &$batch) {
            $type_key = sanitize_key($batch['feeder_type'] ?? '');
            if (!isset($types[$type_key])) {
                continue;
            }
            $batch['feeder_label'] = $types[$type_key]['label'];
            $batch['feeder_common_name'] = $types[$type_key]['common_name'];
            $batch['scientific_name'] = $types[$type_key]['scientific_name'];
        }
        unset($batch);

        foreach ($events as &$event) {
            $type_key = sanitize_key($event['feeder_type'] ?? '');
            if (isset($types[$type_key])) {
                $event['feeder_label'] = $types[$type_key]['label'];
            }
        }
        unset($event);

        usort($batches, function ($a, $b) {
            $a_active = (($a['status'] ?? '') === 'incubating') ? 0 : 1;
            $b_active = (($b['status'] ?? '') === 'incubating') ? 0 : 1;
            if ($a_active !== $b_active) {
                return $a_active <=> $b_active;
            }
            return strcmp((string) ($a['estimated_hatch_date'] ?? ''), (string) ($b['estimated_hatch_date'] ?? ''));
        });

        $total_count = 0;
        $low_stock_count = 0;
        foreach ($inventory as $item) {
            $total_count += (int) $item['count'];
            if (!empty($item['initialized']) && (int) $item['count'] <= (int) $item['low_stock_threshold']) {
                $low_stock_count++;
            }
        }

        $active_batches = array_values(array_filter($batches, function ($batch) {
            return ($batch['status'] ?? '') === 'incubating';
        }));
        $next_batch = !empty($active_batches) ? $active_batches[0] : null;

        return array(
            'today' => $today,
            'types' => array_values($types),
            'inventory' => $inventory,
            'egg_batches' => array_slice($batches, 0, 50),
            'events' => array_slice($events, 0, 60),
            'summary' => array(
                'total_count' => $total_count,
                'low_stock_count' => $low_stock_count,
                'active_egg_batches' => count($active_batches),
                'next_hatch_date' => $next_batch['estimated_hatch_date'] ?? '',
                'next_hatch_label' => $next_batch['feeder_label'] ?? '',
            ),
        );
    }

    private function calculate_hatch_estimate($type, $set_date, $temperature)
    {
        $profile = $type['incubation'];
        $days = (int) round(
            (float) $profile['reference_days']
            - (($temperature - (float) $profile['reference_temp']) * (float) $profile['sensitivity'])
        );
        $days = max((int) $profile['min_days'], min((int) $profile['max_days'], $days));
        $uncertainty_days = max(2, (int) ceil($days * 0.2));
        $start_offset = max(1, $days - $uncertainty_days);

        return array(
            'days' => $days,
            'uncertainty_days' => $uncertainty_days,
            'estimated_hatch_date' => $this->shift_date($set_date, $days),
            'estimated_start_date' => $this->shift_date($set_date, $start_offset),
            'estimated_end_date' => $this->shift_date($set_date, $days + $uncertainty_days),
        );
    }

    private function shift_date($date, $days)
    {
        $value = DateTimeImmutable::createFromFormat('!Y-m-d', $date, wp_timezone());
        if (!$value) {
            return '';
        }

        return $value->modify('+' . absint($days) . ' days')->format('Y-m-d');
    }

    private function normalize_date($value, $fallback = '')
    {
        $value = sanitize_text_field($value);
        if (!$value) {
            $value = $fallback;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, wp_timezone());
        if (!$date || $date->format('Y-m-d') !== $value) {
            return '';
        }

        return $value;
    }

    private function get_action_label($action)
    {
        $labels = array(
            'purchase' => '追加購入',
            'consume' => '給餌に使用',
            'breed' => '自家繁殖',
            'box_reset' => 'ボックス清掃',
            'adjust' => '在庫数を調整',
        );

        return $labels[$action] ?? '記録';
    }
}
