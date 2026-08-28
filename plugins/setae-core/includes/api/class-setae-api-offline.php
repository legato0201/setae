<?php

/**
 * Idempotent batch synchronization for IndexedDB-backed care data.
 */
class Setae_API_Offline
{
    const PROCESSED_META = '_setae_offline_processed_operations';
    const MAX_OPERATIONS = 120;
    const MAX_IMAGE_BYTES = 6291456;

    public function register_routes()
    {
        register_rest_route('setae/v1', '/offline/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'sync'),
            'permission_callback' => array($this, 'can_sync'),
        ));
    }

    public function can_sync()
    {
        return is_user_logged_in() && current_user_can('read');
    }

    public function sync($request)
    {
        $params = $request->get_json_params();
        $operations = isset($params['operations']) && is_array($params['operations'])
            ? array_values($params['operations'])
            : array();
        if (!$operations) {
            if (trim((string) $request->get_body()) !== '' && !isset($params['operations'])) {
                return new WP_Error(
                    'invalid_sync_payload',
                    '同期データを読み取れませんでした。サーバーの送信上限も確認してください。',
                    array('status' => 400)
                );
            }
            return new WP_REST_Response(array(
                'success' => true,
                'results' => array(),
                'mapping' => array(),
            ), 200);
        }
        if (count($operations) > self::MAX_OPERATIONS) {
            return new WP_Error(
                'too_many_operations',
                '一度に同期できる操作は' . self::MAX_OPERATIONS . '件までです。',
                array('status' => 413)
            );
        }

        $user_id = get_current_user_id();
        $lock_name = '_setae_offline_sync_lock_' . $user_id;
        if (!$this->acquire_sync_lock($lock_name)) {
            return new WP_Error(
                'sync_busy',
                '別の画面で同期処理中です。少し待ってから再試行します。',
                array('status' => 409)
            );
        }

        try {
            $processed = get_user_meta($user_id, self::PROCESSED_META, true);
            $processed = is_array($processed) ? $processed : array();
            $mapping = array();
            foreach ($processed as $processed_result) {
                if (!empty($processed_result['client_id']) && !empty($processed_result['server_id'])) {
                    $mapping[(string) $processed_result['client_id']] = absint($processed_result['server_id']);
                }
            }
            $results = array();

            foreach ($operations as $operation) {
                $operation_id = isset($operation['operation_id'])
                    ? sanitize_text_field($operation['operation_id'])
                    : '';
                if (!$operation_id || !preg_match('/^[a-zA-Z0-9._:-]{12,128}$/', $operation_id)) {
                    $results[] = array(
                        'operation_id' => $operation_id,
                        'success' => false,
                        'code' => 'invalid_operation_id',
                        'message' => '同期操作IDが正しくありません。',
                    );
                    continue;
                }

                $owner_id = isset($operation['owner_id']) ? absint($operation['owner_id']) : 0;
                if (!$owner_id || $owner_id !== $user_id) {
                    $results[] = array(
                        'operation_id' => $operation_id,
                        'success' => false,
                        'code' => 'offline_owner_mismatch',
                        'message' => 'このオフライン操作は現在の利用者に属していません。',
                    );
                    continue;
                }

                if (isset($processed[$operation_id]) && is_array($processed[$operation_id])) {
                    $cached = $processed[$operation_id];
                    $cached['operation_id'] = $operation_id;
                    $cached['duplicate'] = true;
                    $results[] = $cached;
                    if (!empty($cached['client_id']) && !empty($cached['server_id'])) {
                        $mapping[(string) $cached['client_id']] = absint($cached['server_id']);
                    }
                    continue;
                }

                try {
                    $result = $this->process_operation($operation, $mapping, $user_id);
                } catch (\Throwable $error) {
                    error_log('SETAE offline sync error: ' . $error->getMessage());
                    $result = new WP_Error('sync_failed', '同期処理中にエラーが発生しました。');
                }

                if (is_wp_error($result)) {
                    $results[] = array(
                        'operation_id' => $operation_id,
                        'success' => false,
                        'code' => $result->get_error_code(),
                        'message' => $result->get_error_message(),
                    );
                    continue;
                }

                $result = array_merge(array(
                    'operation_id' => $operation_id,
                    'success' => true,
                    'processed_at' => current_time('mysql', true),
                ), $result);
                $results[] = $result;
                $processed[$operation_id] = $result;

                if (!empty($result['client_id']) && !empty($result['server_id'])) {
                    $mapping[(string) $result['client_id']] = absint($result['server_id']);
                }
            }

            if (count($processed) > 400) {
                uasort($processed, function ($a, $b) {
                    return strcmp((string) ($b['processed_at'] ?? ''), (string) ($a['processed_at'] ?? ''));
                });
                $processed = array_slice($processed, 0, 400, true);
            }
            update_user_meta($user_id, self::PROCESSED_META, $processed);

            $failed = count(array_filter($results, function ($item) {
                return empty($item['success']);
            }));
            return new WP_REST_Response(array(
                'success' => $failed === 0,
                'results' => $results,
                'mapping' => (object) $mapping,
                'failed' => $failed,
                'server_time' => current_time('mysql', true),
            ), 200);
        } finally {
            delete_option($lock_name);
        }
    }

    private function acquire_sync_lock($lock_name)
    {
        $now = time();
        if (add_option($lock_name, $now, '', false)) {
            return true;
        }

        $started_at = (int) get_option($lock_name, 0);
        if ($started_at && ($now - $started_at) < 120) {
            return false;
        }

        delete_option($lock_name);
        return add_option($lock_name, $now, '', false);
    }

    private function process_operation($operation, &$mapping, $user_id)
    {
        $action = isset($operation['action']) ? sanitize_key($operation['action']) : '';
        $payload = isset($operation['payload']) && is_array($operation['payload'])
            ? $operation['payload']
            : array();
        $entity_id = isset($operation['entity_id']) ? (int) $operation['entity_id'] : 0;

        switch ($action) {
            case 'create_spider':
                return $this->create_spider($entity_id, $payload, $user_id);
            case 'update_spider':
                return $this->update_spider(
                    $this->resolve_entity_id($entity_id, $mapping),
                    $payload,
                    $user_id
                );
            case 'delete_spider':
                return $this->delete_spider(
                    $this->resolve_entity_id($entity_id, $mapping),
                    $user_id
                );
            case 'create_log':
                return $this->create_log($entity_id, $payload, $mapping, $user_id);
            case 'update_log':
                return $this->update_log(
                    $this->resolve_entity_id($entity_id, $mapping),
                    $payload,
                    $user_id
                );
            case 'delete_log':
                return $this->delete_log(
                    $this->resolve_entity_id($entity_id, $mapping),
                    $user_id
                );
            case 'save_task_action':
                return (new Setae_API_Tasks())->save_offline_item($payload, $user_id);
            case 'save_task_actions_batch':
                return (new Setae_API_Tasks())->save_offline_items($payload, $user_id);
            case 'create_qr_records':
                if (!class_exists('Setae_QR_Manager')) {
                    return new WP_Error('qr_manager_unavailable', 'QR記録機能を読み込めませんでした。');
                }
                $result = Setae_QR_Manager::record_target_entries($payload['entries'] ?? array(), $user_id);
                if (is_wp_error($result)) {
                    return $result;
                }
                return array(
                    'entity' => 'qr_records',
                    'count' => absint($result['count'] ?? 0),
                );
            default:
                return new WP_Error('unsupported_action', '未対応の同期操作です。');
        }
    }

    private function create_spider($client_id, $payload, $user_id)
    {
        return Setae_Entitlements::with_user_lock($user_id, function () use ($client_id, $payload, $user_id) {
            return $this->create_spider_locked($client_id, $payload, $user_id);
        });
    }

    private function create_spider_locked($client_id, $payload, $user_id)
    {
        $existing_id = $this->find_existing_client_entity('setae_spider', $client_id, $user_id);
        if ($existing_id) {
            $qr_code = '';
            if (class_exists('Setae_QR_Manager')) {
                $target = Setae_QR_Manager::ensure_spider_target($existing_id);
                if ($target && !is_wp_error($target)) {
                    $qr_code = $target->post_name;
                }
            }
            return array(
                'entity' => 'spider',
                'client_id' => (string) $client_id,
                'server_id' => $existing_id,
                'qr_code' => $qr_code,
            );
        }

        $limit_error = $this->validate_spider_limit($user_id);
        if (is_wp_error($limit_error)) {
            return $limit_error;
        }

        $classification = sanitize_key($payload['classification'] ?? 'tarantula');
        if (!$classification || !term_exists($classification, 'setae_classification')) {
            $classification = 'other';
        }

        $species_id = absint($payload['species_id'] ?? 0);
        $custom_species = sanitize_text_field($payload['custom_species'] ?? $payload['species_name'] ?? '');
        if ($classification === 'tarantula' && $species_id) {
            $species = $species_id ? get_post($species_id) : null;
            if (!$species || $species->post_type !== 'setae_species' || $species->post_status !== 'publish') {
                return new WP_Error('invalid_species', '選択された図鑑の種類を確認できません。');
            }
            $base_name = get_the_title($species_id);
        } else {
            if (!$custom_species) {
                return new WP_Error('missing_species', '種類名を入力してください。');
            }
            $base_name = $custom_species;
        }

        $name = sanitize_text_field($payload['name'] ?? $payload['title'] ?? '');
        $spider_id = wp_insert_post(array(
            'post_title' => $name ?: $base_name,
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'post_author' => $user_id,
        ), true);
        if (is_wp_error($spider_id)) {
            return $spider_id;
        }

        wp_set_object_terms($spider_id, $classification, 'setae_classification');
        update_post_meta($spider_id, '_setae_owner_id', $user_id);
        $source = Setae_Entitlements::mark_specimen_source($spider_id, 'manual');
        if (is_wp_error($source)) {
            wp_delete_post($spider_id, true);
            return $source;
        }
        update_post_meta($spider_id, '_setae_offline_client_id', (string) $client_id);
        if ($classification === 'tarantula' && $species_id) {
            update_post_meta($spider_id, '_setae_species_id', $species_id);
            delete_post_meta($spider_id, '_setae_custom_species_name');
        } else {
            update_post_meta($spider_id, '_setae_custom_species_name', $custom_species);
            delete_post_meta($spider_id, '_setae_species_id');
        }

        $this->save_spider_fields($spider_id, $payload);
        if (!empty($payload['image_data'])) {
            $image_url = $this->save_data_image($payload['image_data'], $spider_id);
            if (is_wp_error($image_url)) {
                wp_delete_post($spider_id, true);
                return $image_url;
            }
            update_post_meta($spider_id, '_setae_spider_image', $image_url);
        }

        $qr_code = '';
        if (class_exists('Setae_QR_Manager')) {
            $target = Setae_QR_Manager::ensure_spider_target($spider_id);
            if ($target && !is_wp_error($target)) {
                $qr_code = $target->post_name;
            }
        }

        Setae_Entitlements::record_event('specimen_created', array(
            'idempotency_key' => 'specimen:' . $spider_id, 'user_id' => $user_id,
            'object_type' => 'spider', 'object_id' => (int) $spider_id, 'acquisition_source' => 'manual',
        ));
        return array('entity' => 'spider', 'client_id' => (string) $client_id, 'server_id' => $spider_id, 'qr_code' => $qr_code);
    }

    private function update_spider($spider_id, $payload, $user_id)
    {
        $changes = isset($payload['changes']) && is_array($payload['changes'])
            ? $payload['changes']
            : $payload;
        $settings = array_intersect_key($changes, array('qr_visibility' => true, 'transfer_enabled' => true));
        if (!$settings) { return $this->update_spider_fields($spider_id, $changes, $user_id); }
        if (!class_exists('Setae_QR_Manager')) {
            return new WP_Error('qr_settings_unavailable', '公開設定を保存できません。時間をおいて再試行してください。', array('status' => 503));
        }
        $spider = $this->get_owned_post($spider_id, 'setae_spider', $user_id);
        if (is_wp_error($spider)) { return $spider; }
        $owner_id = (int) $spider->post_author;
        return Setae_Entitlements::with_user_lock($owner_id, function () use ($spider_id, $changes, $settings, $user_id, $owner_id) {
            clean_post_cache($spider_id);
            wp_cache_delete($spider_id, 'post_meta');
            $spider = $this->get_owned_post($spider_id, 'setae_spider', $user_id);
            if (is_wp_error($spider)) { return $spider; }
            if ((int) $spider->post_author !== $owner_id) {
                return new WP_Error('qr_settings_stale', '所有者情報が変わりました。画面を更新してください。', array('status' => 409));
            }
            $final_archived = array_key_exists('archived', $changes) ? rest_sanitize_boolean($changes['archived']) : null;
            $patch = Setae_QR_Manager::prepare_spider_settings_patch($spider_id, $user_id, $settings, $final_archived);
            if (is_wp_error($patch)) { return $patch; }
            return $this->update_spider_fields($spider_id, $changes, $user_id, $patch);
        });
    }

    private function update_spider_fields($spider_id, array $changes, $user_id, $settings_patch = null)
    {
        $spider = $this->get_owned_post($spider_id, 'setae_spider', $user_id);
        if (is_wp_error($spider)) {
            return $spider;
        }
        if (array_key_exists('archived', $changes) && !rest_sanitize_boolean($changes['archived'])
            && get_post_meta($spider_id, '_setae_transfer_receipt', true) === '1') {
            return new WP_Error('transfer_receipt_locked', '譲渡済みの記録は飼育一覧へ戻せません。', array('status' => 400));
        }
        if (array_key_exists('name', $changes) || array_key_exists('title', $changes)) {
            $name = sanitize_text_field($changes['name'] ?? $changes['title']);
            if ($name) {
                wp_update_post(array('ID' => $spider_id, 'post_title' => $name));
            }
        }
        if (array_key_exists('status', $changes)) {
            update_post_meta($spider_id, '_setae_status', sanitize_key($changes['status']));
        }
        if (array_key_exists('gender', $changes)) {
            update_post_meta($spider_id, '_setae_gender', sanitize_key($changes['gender']));
        }
        if (array_key_exists('archived', $changes)) {
            $archived = rest_sanitize_boolean($changes['archived']);
            if ($archived) {
                update_post_meta($spider_id, '_setae_spider_archived', '1');
                update_post_meta($spider_id, '_setae_spider_archived_at', current_time('mysql'));
            } else {
                delete_post_meta($spider_id, '_setae_spider_archived');
                delete_post_meta($spider_id, '_setae_spider_archived_at');
            }
        }

        $terms = get_the_terms($spider_id, 'setae_classification');
        $classification = ($terms && !is_wp_error($terms)) ? $terms[0]->slug : 'tarantula';
        if (array_key_exists('classification', $changes)) {
            $next_classification = sanitize_key($changes['classification']);
            if ($next_classification && term_exists($next_classification, 'setae_classification')) {
                $classification = $next_classification;
                wp_set_object_terms($spider_id, $classification, 'setae_classification');
            }
        }

        $species_id = absint($changes['species_id'] ?? 0);
        if ($classification !== 'tarantula') {
            $species_id = 0;
        }
        if ($species_id) {
            $species = get_post($species_id);
            if (!$species || $species->post_type !== 'setae_species' || $species->post_status !== 'publish') {
                return new WP_Error('invalid_species', '選択された図鑑の種類を確認できません。');
            }
            update_post_meta($spider_id, '_setae_species_id', $species_id);
            delete_post_meta($spider_id, '_setae_custom_species_name');
        } elseif (!empty($changes['species_name']) || !empty($changes['custom_species'])) {
            update_post_meta(
                $spider_id,
                '_setae_custom_species_name',
                sanitize_text_field($changes['custom_species'] ?? $changes['species_name'])
            );
            delete_post_meta($spider_id, '_setae_species_id');
        }

        $this->save_spider_fields($spider_id, $changes);
        if (!empty($changes['image_data'])) {
            $image_url = $this->save_data_image($changes['image_data'], $spider_id);
            if (is_wp_error($image_url)) {
                return $image_url;
            }
            update_post_meta($spider_id, '_setae_spider_image', $image_url);
        }

        wp_update_post(array('ID' => $spider_id));
        if ($settings_patch !== null) {
            $settings = Setae_QR_Manager::apply_spider_settings_patch($spider_id, $user_id, $settings_patch);
            if (is_wp_error($settings)) { return $settings; }
        }
        return array(
            'entity' => 'spider',
            'server_id' => $spider_id,
        );
    }

    private function delete_spider($spider_id, $user_id)
    {
        $spider = $this->get_owned_post($spider_id, 'setae_spider', $user_id);
        if (is_wp_error($spider)) {
            return $spider;
        }
        if (!wp_delete_post($spider_id, true)) {
            return new WP_Error('delete_failed', '個体を削除できませんでした。');
        }
        return array('entity' => 'spider', 'server_id' => $spider_id, 'deleted' => true);
    }

    private function create_log($client_id, $payload, &$mapping, $user_id)
    {
        $existing_id = $this->find_existing_client_entity('setae_log', $client_id, $user_id);
        if ($existing_id) {
            return array(
                'entity' => 'log',
                'client_id' => (string) $client_id,
                'server_id' => $existing_id,
                'spider_id' => absint(get_post_meta($existing_id, '_setae_log_spider_id', true)),
            );
        }

        $raw_spider_id = isset($payload['spider_id']) ? (int) $payload['spider_id'] : 0;
        $spider_id = $this->resolve_entity_id($raw_spider_id, $mapping);
        $spider = $this->get_owned_post($spider_id, 'setae_spider', $user_id);
        if (is_wp_error($spider)) {
            return $spider;
        }

        $type = sanitize_key($payload['type'] ?? '');
        if ($type === 'note' || $type === 'memo') {
            $type = 'observation';
        }
        $allowed_types = array('feed', 'molt', 'growth', 'pairing', 'observation', 'water', 'repot');
        if (!in_array($type, $allowed_types, true)) {
            return new WP_Error('invalid_log_type', '記録の種類が正しくありません。');
        }

        $date = sanitize_text_field($payload['date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return new WP_Error('invalid_log_date', '記録日が正しくありません。');
        }
        $data = $payload['data'] ?? array();
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : array();
        }
        $data = $this->sanitize_log_data(is_array($data) ? $data : array());
        if (strlen(wp_json_encode($data)) > 5000) {
            return new WP_Error('data_too_large', '記録の内容が上限を超えています。');
        }

        $log_id = wp_insert_post(array(
            'post_title' => sprintf('%s - %s (%s)', $spider->post_title, ucfirst($type), $date),
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'post_author' => $user_id,
        ), true);
        if (is_wp_error($log_id)) {
            return $log_id;
        }

        update_post_meta($log_id, '_setae_log_spider_id', $spider_id);
        update_post_meta($log_id, '_setae_log_type', $type);
        update_post_meta($log_id, '_setae_log_date', $date);
        update_post_meta($log_id, '_setae_log_data', wp_json_encode($data, JSON_UNESCAPED_UNICODE));
        update_post_meta($log_id, '_setae_offline_client_id', (string) $client_id);

        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        if ($species_id) {
            update_post_meta($log_id, '_setae_related_species_id', $species_id);
        }
        if (!empty($payload['image_data'])) {
            $image_url = $this->save_data_image($payload['image_data'], $log_id);
            if (is_wp_error($image_url)) {
                wp_delete_post($log_id, true);
                return $image_url;
            }
            update_post_meta($log_id, '_setae_log_image', $image_url);
        }

        $this->apply_log_to_spider($spider_id, $type, $date, $data);
        Setae_Entitlements::mark_log_recorder($log_id, $user_id);
        Setae_Entitlements::record_event('first_record_created', array(
            'idempotency_key' => 'first-record:' . $user_id, 'user_id' => $user_id,
            'object_type' => 'spider', 'object_id' => (int) $spider_id,
            'properties' => array('record_id' => (int) $log_id, 'record_type' => $type),
        ));
        return array(
            'entity' => 'log',
            'client_id' => (string) $client_id,
            'server_id' => $log_id,
            'spider_id' => $spider_id,
        );
    }

    private function update_log($log_id, $payload, $user_id)
    {
        $log = $this->get_owned_post($log_id, 'setae_log', $user_id);
        if (is_wp_error($log)) {
            return $log;
        }

        $raw_data = get_post_meta($log_id, '_setae_log_data', true);
        $data = json_decode((string) $raw_data, true);
        $data = is_array($data) ? $data : array();
        if (array_key_exists('refused', $payload)) {
            $data['refused'] = rest_sanitize_boolean($payload['refused']);
        }
        if (isset($payload['data']) && is_array($payload['data'])) {
            $data = array_merge($data, $this->sanitize_log_data($payload['data']));
        }
        update_post_meta($log_id, '_setae_log_data', wp_json_encode($data, JSON_UNESCAPED_UNICODE));

        return array('entity' => 'log', 'server_id' => $log_id);
    }

    private function delete_log($log_id, $user_id)
    {
        $log = $this->get_owned_post($log_id, 'setae_log', $user_id);
        if (is_wp_error($log)) {
            return $log;
        }

        $controller = new Setae_API_Spiders();
        $delete_request = new WP_REST_Request('DELETE');
        $delete_request->set_url_params(array('id' => $log_id));
        $response = $controller->delete_log_event($delete_request);
        if (is_wp_error($response)) {
            return $response;
        }
        return array('entity' => 'log', 'server_id' => $log_id, 'deleted' => true);
    }

    private function apply_log_to_spider($spider_id, $type, $date, $data)
    {
        if ($type === 'feed') {
            if (empty($data['refused'])) {
                update_post_meta($spider_id, '_setae_last_feed_date', $date);
                update_post_meta($spider_id, '_setae_status', 'normal');
                if (!empty($data['prey_type'])) {
                    update_post_meta($spider_id, '_setae_last_prey', sanitize_text_field($data['prey_type']));
                }
            } else {
                update_post_meta($spider_id, '_setae_status', 'fasting');
            }
        } elseif ($type === 'molt') {
            update_post_meta($spider_id, '_setae_last_molt_date', $date);
            update_post_meta($spider_id, '_setae_status', 'post_molt');
        } elseif ($type === 'pairing') {
            update_post_meta($spider_id, '_setae_last_pairing_date', $date);
        } elseif ($type === 'observation') {
            update_post_meta($spider_id, '_setae_last_observation_date', $date);
            update_post_meta(
                $spider_id,
                '_setae_last_observation_label',
                sanitize_text_field($data['label'] ?? '異常なし')
            );
            if (!empty($data['note'])) {
                update_post_meta($spider_id, '_setae_last_observation_note', sanitize_textarea_field($data['note']));
            }
        }
    }

    private function save_spider_fields($spider_id, $payload)
    {
        $fields = array(
            'last_molt' => '_setae_last_molt_date',
            'last_feed' => '_setae_last_feed_date',
            'last_pairing' => '_setae_last_pairing_date',
            'last_observation' => '_setae_last_observation_date',
        );
        foreach ($fields as $payload_key => $meta_key) {
            if (!empty($payload[$payload_key])) {
                $value = sanitize_text_field($payload[$payload_key]);
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                    update_post_meta($spider_id, $meta_key, $value);
                }
            }
        }
    }

    private function sanitize_log_data($data)
    {
        $sanitized = array();
        foreach ($data as $key => $value) {
            $key = sanitize_key($key);
            if (!$key || in_array($key, array('share_to_feed', 'is_best_shot'), true)) {
                continue;
            }
            if (is_bool($value)) {
                $sanitized[$key] = $value;
            } elseif (is_numeric($value)) {
                $sanitized[$key] = 0 + $value;
            } elseif (is_string($value)) {
                $sanitized[$key] = $key === 'note'
                    ? sanitize_textarea_field($value)
                    : sanitize_text_field($value);
            }
        }
        return $sanitized;
    }

    private function resolve_entity_id($entity_id, $mapping)
    {
        if ($entity_id > 0) {
            return $entity_id;
        }
        return isset($mapping[(string) $entity_id]) ? absint($mapping[(string) $entity_id]) : 0;
    }

    private function find_existing_client_entity($post_type, $client_id, $user_id)
    {
        if (!$client_id) {
            return 0;
        }

        $ids = get_posts(array(
            'post_type' => $post_type,
            'post_status' => 'publish',
            'author' => absint($user_id),
            'fields' => 'ids',
            'posts_per_page' => 1,
            'no_found_rows' => true,
            'meta_query' => array(
                array(
                    'key' => '_setae_offline_client_id',
                    'value' => (string) $client_id,
                    'compare' => '=',
                ),
            ),
        ));

        return $ids ? absint($ids[0]) : 0;
    }

    private function get_owned_post($post_id, $post_type, $user_id)
    {
        $post = get_post(absint($post_id));
        if (!$post || $post->post_type !== $post_type) {
            return new WP_Error('not_found', '同期対象のデータが見つかりません。');
        }
        if ((int) $post->post_author !== (int) $user_id && !current_user_can('manage_options')) {
            return new WP_Error('forbidden', 'このデータを変更する権限がありません。');
        }
        return $post;
    }

    private function validate_spider_limit($user_id)
    {
        return Setae_Entitlements::can_create_specimen($user_id, 'manual');
    }

    private function save_data_image($data_uri, $parent_post_id)
    {
        if (!is_string($data_uri) || !preg_match('#^data:(image/(?:jpeg|png|webp));base64,(.+)$#s', $data_uri, $matches)) {
            return new WP_Error('invalid_image', '同期する画像の形式が正しくありません。');
        }

        $binary = base64_decode(str_replace(' ', '+', $matches[2]), true);
        if ($binary === false || !$binary || strlen($binary) > self::MAX_IMAGE_BYTES) {
            return new WP_Error('invalid_image_size', '画像は6MB以下にしてください。');
        }

        $image_info = @getimagesizefromstring($binary);
        if (!$image_info || empty($image_info['mime'])) {
            return new WP_Error('invalid_image', '画像データを確認できませんでした。');
        }
        $extensions = array(
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        );
        $mime = strtolower((string) $image_info['mime']);
        if (!isset($extensions[$mime]) || $mime !== strtolower($matches[1])) {
            return new WP_Error('invalid_image', '画像の形式が宣言内容と一致しません。');
        }
        $filename = 'setae-offline-' . wp_generate_uuid4() . '.' . $extensions[$mime];
        $upload = wp_upload_bits($filename, null, $binary);
        if (!empty($upload['error'])) {
            return new WP_Error('image_upload_failed', sanitize_text_field($upload['error']));
        }

        $attachment_id = wp_insert_attachment(array(
            'post_mime_type' => $mime,
            'post_title' => sanitize_file_name(pathinfo($filename, PATHINFO_FILENAME)),
            'post_content' => '',
            'post_status' => 'inherit',
            'post_parent' => absint($parent_post_id),
        ), $upload['file'], $parent_post_id, true);
        if (is_wp_error($attachment_id)) {
            wp_delete_file($upload['file']);
            return $attachment_id;
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        $metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
        if ($metadata) {
            wp_update_attachment_metadata($attachment_id, $metadata);
        }
        return wp_get_attachment_url($attachment_id);
    }
}
