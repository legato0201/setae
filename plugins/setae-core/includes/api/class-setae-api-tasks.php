<?php

/**
 * REST persistence for generated task outcomes such as snooze and skip.
 */
class Setae_API_Tasks
{
    const META_KEY = '_setae_task_actions_v1';

    public function register_routes()
    {
        register_rest_route('setae/v1', '/task-actions', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_items'),
                'permission_callback' => array($this, 'check_auth'),
            ),
            array(
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => array($this, 'save_item'),
                'permission_callback' => array($this, 'check_auth'),
                'args' => array(
                    'outcome' => array(
                        'type' => 'string',
                        'enum' => array('completed', 'attempted', 'deferred', 'skipped'),
                        'required' => true,
                    ),
                ),
            ),
        ));
        register_rest_route('setae/v1', '/task-actions/batch', array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => array($this, 'save_items'),
            'permission_callback' => array($this, 'check_auth'),
            'args' => array(
                'items' => array('type' => 'array', 'required' => true),
            ),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    public function get_items($request)
    {
        $since = $this->valid_date($request->get_param('since'));
        $items = $this->read(get_current_user_id());
        if ($since) {
            $items = array_values(array_filter($items, function ($item) use ($since) {
                return !empty($item['acted_on']) && $item['acted_on'] >= $since;
            }));
        }
        return $this->private_response(array('items' => $items, 'total' => count($items)), 200);
    }

    public function save_item($request)
    {
        $user_id = get_current_user_id();
        $item = $this->prepare_item($request->get_params(), $user_id);
        if (is_wp_error($item)) {
            return $item;
        }
        $this->store($user_id, array($item));
        return $this->private_response(array('item' => $item), 200);
    }

    public function save_items($request)
    {
        $user_id = get_current_user_id();
        $source = array_slice((array) $request->get_param('items'), 0, 100);
        if (!$source) {
            return new WP_Error('missing_task_actions', '保存するTask結果がありません。', array('status' => 400));
        }
        $items = array();
        foreach ($source as $params) {
            $item = $this->prepare_item(is_array($params) ? $params : array(), $user_id);
            if (is_wp_error($item)) {
                return $item;
            }
            $items[] = $item;
        }
        $this->store($user_id, $items);
        return $this->private_response(array('items' => $items, 'total' => count($items)), 200);
    }

    public function save_offline_item($params, $user_id)
    {
        $item = $this->prepare_item(is_array($params) ? $params : array(), $user_id);
        if (is_wp_error($item)) {
            return $item;
        }
        $this->store($user_id, array($item));
        return array('entity' => 'task_action', 'id' => $item['id']);
    }

    public function save_offline_items($params, $user_id)
    {
        $source = isset($params['items']) && is_array($params['items']) ? array_slice($params['items'], 0, 100) : array();
        if (!$source) {
            return new WP_Error('missing_task_actions', '保存するTask結果がありません。');
        }
        $items = array();
        foreach ($source as $value) {
            $item = $this->prepare_item(is_array($value) ? $value : array(), $user_id);
            if (is_wp_error($item)) {
                return $item;
            }
            $items[] = $item;
        }
        $this->store($user_id, $items);
        return array('entity' => 'task_action_batch', 'total' => count($items));
    }

    private function prepare_item($params, $user_id)
    {
        $target_type = sanitize_key($this->param($params, 'targetType', 'target_type'));
        $target_id = absint($this->param($params, 'targetId', 'target_id'));
        $task_type = sanitize_key($this->param($params, 'type', 'taskType', 'task_type'));
        $scheduled_for = $this->valid_date($this->param($params, 'scheduledFor', 'scheduled_for'));
        $acted_on = $this->valid_date($this->param($params, 'actedOn', 'acted_on')) ?: current_time('Y-m-d');
        $outcome = sanitize_key($this->param($params, 'outcome'));
        $retry_at = $this->valid_date($this->param($params, 'retryAt', 'retry_at'));

        if (!$this->owns_target($user_id, $target_type, $target_id)) {
            return new WP_Error('task_target_not_found', '対象が見つかりません。', array('status' => 404));
        }
        if (!$scheduled_for || !in_array($task_type, $this->allowed_task_types(), true)) {
            return new WP_Error('invalid_task_action', 'Taskの指定が正しくありません。', array('status' => 400));
        }
        if (!in_array($outcome, array('completed', 'attempted', 'deferred', 'skipped'), true)) {
            return new WP_Error('invalid_task_outcome', 'Task結果が正しくありません。', array('status' => 400));
        }
        if (in_array($outcome, array('attempted', 'deferred', 'skipped'), true) && !$retry_at) {
            return new WP_Error('missing_task_retry', '再確認日を指定してください。', array('status' => 400));
        }

        $task_id = $target_type . ':' . $target_id . ':' . $task_type;
        $key = $task_id . '@' . $scheduled_for;
        $item = array(
            'id' => $key,
            'task_id' => $task_id,
            'target_type' => $target_type,
            'target_id' => $target_id,
            'task_type' => $task_type,
            'scheduled_for' => $scheduled_for,
            'outcome' => $outcome,
            'retry_at' => $retry_at ?: '',
            'acted_on' => $acted_on,
            'reason' => mb_substr(sanitize_text_field($this->param($params, 'reason')), 0, 240),
            'title' => mb_substr(sanitize_text_field($this->param($params, 'title')), 0, 120),
            'subtitle' => mb_substr(sanitize_text_field($this->param($params, 'subtitle')), 0, 180),
            'was_required' => rest_sanitize_boolean($this->param($params, 'required', 'was_required')),
            'updated_at' => current_time('mysql'),
        );
        return $item;
    }

    private function store($user_id, $new_items)
    {
        $items = $this->read($user_id);
        $map = array();
        foreach ($items as $existing) {
            if (!empty($existing['id'])) {
                $map[$existing['id']] = $existing;
            }
        }
        foreach ($new_items as $item) {
            $map[$item['id']] = $item;
        }
        $items = array_values($map);
        usort($items, function ($left, $right) {
            return strcmp($right['updated_at'], $left['updated_at']);
        });
        update_user_meta($user_id, self::META_KEY, array_slice($items, 0, 500));
    }

    private function param($params)
    {
        foreach (array_slice(func_get_args(), 1) as $key) {
            if (array_key_exists($key, $params)) {
                return $params[$key];
            }
        }
        return '';
    }

    private function read($user_id)
    {
        $stored = get_user_meta(absint($user_id), self::META_KEY, true);
        return is_array($stored) ? array_values(array_filter($stored, 'is_array')) : array();
    }

    private function owns_target($user_id, $target_type, $target_id)
    {
        if ($target_type === 'animal') {
            $post = get_post($target_id);
            return $post && $post->post_type === 'setae_spider' && (int) $post->post_author === (int) $user_id;
        }
        if ($target_type === 'enclosure') {
            return (bool) Setae_Enclosures::get_for_user($user_id, $target_id);
        }
        $post = $target_type === 'nursery' ? get_post($target_id) : null;
        return $post && $post->post_type === 'setae_baby_group' && (int) $post->post_author === (int) $user_id;
    }

    private function allowed_task_types()
    {
        return array('feed', 'observation', 'count', 'environment', 'misting', 'watering', 'maintenance', 'substrate');
    }

    private function valid_date($value)
    {
        $value = sanitize_text_field((string) $value);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date && $date->format('Y-m-d') === $value ? $value : '';
    }

    private function private_response($data, $status)
    {
        $response = new WP_REST_Response($data, $status);
        $response->header('Cache-Control', 'no-store, private');
        return $response;
    }
}
