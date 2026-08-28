<?php

/**
 * Handler for baby clutch / lot management.
 */
class Setae_API_Baby_Groups
{
    const NURSERY_EVENTS_META = '_setae_nursery_events_v1';
    const NURSERY_RECORDERS_META = '_setae_nursery_event_recorders_v1';

    public function register_routes()
    {
        register_rest_route('setae/v1', '/baby-groups', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_groups'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_group'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_group'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_group'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_group'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)/bulk', array(
            'methods' => 'POST',
            'callback' => array($this, 'bulk_update'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)/promote', array(
            'methods' => 'POST',
            'callback' => array($this, 'promote_to_spiders'),
            'permission_callback' => array($this, 'check_auth'),
        ));

        register_rest_route('setae/v1', '/baby-groups/(?P<id>\d+)/events', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_nursery_events'),
                'permission_callback' => array($this, 'check_auth'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'record_nursery_event'),
                'permission_callback' => array($this, 'check_auth'),
            ),
        ));
    }

    public function check_auth()
    {
        return is_user_logged_in();
    }

    public function get_groups()
    {
        $query = new WP_Query(array(
            'post_type' => 'setae_baby_group',
            'post_status' => 'publish',
            'author' => get_current_user_id(),
            'posts_per_page' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
        ));

        $items = array();
        $archived_items = array();
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $group = $this->build_group_response(get_the_ID(), false);
                if (!empty($group['archived'])) {
                    $archived_items[] = $group;
                } else {
                    $items[] = $group;
                }
            }
            wp_reset_postdata();
        }

        $all_groups = array_merge($items, $archived_items);

        return new WP_REST_Response(array(
            'items' => $items,
            'archived_items' => $archived_items,
            'summary' => $this->build_dashboard_summary($all_groups),
        ), 200);
    }

    public function get_group($request)
    {
        $group_id = absint($request['id']);
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }

        return new WP_REST_Response($this->build_group_response($group_id, true), 200);
    }

    public function create_group($request)
    {
        return Setae_Entitlements::with_user_lock(get_current_user_id(), function () use ($request) {
            return $this->create_group_locked($request);
        });
    }

    private function create_group_locked($request)
    {
        $user_id = get_current_user_id();
        $allowed = Setae_Entitlements::can_create_nursery_group($user_id);
        if (is_wp_error($allowed)) { return $allowed; }
        $name = sanitize_text_field($request->get_param('name'));
        $prefix = $this->normalize_prefix($request->get_param('prefix'));
        $count = absint($request->get_param('count'));
        $birth_date = sanitize_text_field($request->get_param('birth_date'));
        $species_id = $this->normalize_species_id($request->get_param('species_id'));
        $species_name = sanitize_text_field($request->get_param('species_name'));
        $parent_spider_ids = $this->parse_spider_ids($request->get_param('parent_spider_ids'));

        if ($species_id && !$species_name) {
            $species_name = get_the_title($species_id);
        }

        $parent_note = sanitize_textarea_field($request->get_param('parent_note'));

        if (!$name) {
            return new WP_Error('missing_name', '管理名を入力してください。', array('status' => 400));
        }

        if ($count < 1 || $count > 500) {
            return new WP_Error('invalid_count', '管理数は1〜500で入力してください。', array('status' => 400));
        }

        if (!$prefix) {
            $prefix = 'B';
        }

        $prefix_conflict = $this->find_prefix_conflict($prefix, $user_id);
        if ($prefix_conflict) {
            return new WP_Error(
                'duplicate_baby_prefix',
                sprintf(
                    '番号の頭文字「%s」は「%s」で使用中です。アーカイブ済みの群を含め、別の頭文字を指定してください。',
                    $prefix,
                    get_the_title($prefix_conflict)
                ),
                array('status' => 409, 'group_id' => (int) $prefix_conflict)
            );
        }

        $post_id = wp_insert_post(array(
            'post_type' => 'setae_baby_group',
            'post_status' => 'publish',
            'post_title' => $name,
            'post_author' => $user_id,
        ));

        if (is_wp_error($post_id)) {
            return $post_id;
        }
        if (!$post_id) {
            return new WP_Error('create_failed', 'ベビー群の作成に失敗しました。', array('status' => 500));
        }

        update_post_meta($post_id, '_setae_baby_prefix', $prefix);
        update_post_meta($post_id, '_setae_baby_count', $count);
        update_post_meta($post_id, '_setae_baby_birth_date', $this->normalize_date($birth_date));
        update_post_meta($post_id, '_setae_baby_species_id', $species_id);
        update_post_meta($post_id, '_setae_baby_species_name', $species_name);
        update_post_meta($post_id, '_setae_baby_parent_spider_ids', $parent_spider_ids);
        update_post_meta($post_id, '_setae_baby_parent_note', $parent_note);
        update_post_meta($post_id, '_setae_baby_items', array());

        Setae_Entitlements::record_event('baby_group_created', array(
            'idempotency_key' => 'baby-group:' . $post_id, 'user_id' => $user_id,
            'object_type' => 'baby_group', 'object_id' => (int) $post_id,
        ));
        return new WP_REST_Response($this->build_group_response($post_id, true), 201);
    }

    public function update_group($request)
    {
        $group_id = absint($request['id']);
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }

        $has_name = $request->has_param('name');
        $name = $has_name ? trim(sanitize_text_field($request->get_param('name'))) : get_the_title($group_id);
        if ($has_name && !$name) {
            return new WP_Error('missing_name', '管理名を入力してください。', array('status' => 400));
        }

        $updated = wp_update_post(array(
            'ID' => $group_id,
            'post_title' => $name,
        ), true);

        if (is_wp_error($updated)) {
            return new WP_Error('update_failed', 'ベビー群の更新に失敗しました。', array('status' => 500));
        }
        if (!$updated) {
            return new WP_Error('update_failed', 'ベビー群の更新に失敗しました。', array('status' => 500));
        }

        if ($request->has_param('archived')) {
            $archived = filter_var($request->get_param('archived'), FILTER_VALIDATE_BOOLEAN);
            if ($archived) {
                update_post_meta($group_id, '_setae_baby_archived', '1');
                update_post_meta($group_id, '_setae_baby_archived_at', current_time('mysql'));
            } else {
                delete_post_meta($group_id, '_setae_baby_archived');
                delete_post_meta($group_id, '_setae_baby_archived_at');
            }
        }

        return new WP_REST_Response($this->build_group_response($group_id, true), 200);
    }

    public function delete_group($request)
    {
        $group_id = absint($request['id']);
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }

        $deleted = wp_delete_post($group_id, true);
        if (!$deleted) {
            return new WP_Error('delete_failed', 'ベビー群の削除に失敗しました。', array('status' => 500));
        }

        return new WP_REST_Response(array(
            'success' => true,
            'deleted_id' => $group_id,
        ), 200);
    }

    public function get_nursery_events($request)
    {
        $group_id = absint($request['id']);
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }
        $events = $this->read_nursery_events($group_id);
        return new WP_REST_Response(array('items' => $events, 'total' => count($events)), 200);
    }

    public function record_nursery_event($request)
    {
        $group_id = absint($request['id']);
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }
        $group = $this->get_group_meta($group_id);
        if (!empty($group['archived'])) {
            return new WP_Error('group_archived', 'アーカイブ中のベビー群には記録できません。', array('status' => 400));
        }

        $event = $this->prepare_nursery_event($request->get_params(), $group_id, $group);
        if (is_wp_error($event)) {
            return $event;
        }
        $events = $this->read_nursery_events($group_id);
        array_unshift($events, $event);
        usort($events, array($this, 'compare_nursery_events'));
        $events = array_slice($events, 0, 500);
        foreach ($events as &$stored_event) { unset($stored_event['recorded_by_current_user']); }
        unset($stored_event);
        update_post_meta($group_id, self::NURSERY_EVENTS_META, $events);
        // Internal creator map never travels in an event response. Do not infer
        // authorship for older events that predate this provenance field.
        $recorders = get_post_meta($group_id, self::NURSERY_RECORDERS_META, true);
        $recorders = is_array($recorders) ? $recorders : array();
        $recorders[(string) $event['id']] = get_current_user_id();
        $recorders = array_intersect_key($recorders, array_fill_keys(array_column($events, 'id'), true));
        update_post_meta($group_id, self::NURSERY_RECORDERS_META, $recorders);
        $event['recorded_by_current_user'] = true;
        Setae_Entitlements::record_event('first_record_created', array(
            'idempotency_key' => 'first-record:' . get_current_user_id(), 'user_id' => get_current_user_id(),
            'object_type' => 'baby_group', 'object_id' => (int) $group_id,
            'properties' => array('record_id' => $event['id'], 'record_type' => $event['type']),
        ));
        wp_update_post(array('ID' => $group_id));

        return new WP_REST_Response(array(
            'event' => $event,
            'group' => $this->build_group_response($group_id, true),
        ), 201);
    }

    public static function recent_events_for_user($user_id, $limit = 50, $offset = 0, $type = '')
    {
        $controller = new self();
        $allowed = array('feed', 'observation', 'count_check', 'environment_check');
        if ($type && !in_array($type, $allowed, true)) {
            return array('items' => array(), 'total' => 0);
        }
        $group_ids = get_posts(array(
            'post_type' => 'setae_baby_group',
            'post_status' => 'publish',
            'author' => absint($user_id),
            'fields' => 'ids',
            'posts_per_page' => -1,
        ));
        $items = array();
        foreach ($group_ids as $group_id) {
            $group = $controller->get_group_meta($group_id);
            $living = $controller->living_count($group);
            foreach ($controller->read_nursery_events($group_id) as $event) {
                if ($type && $event['type'] !== $type) {
                    continue;
                }
                $items[] = array(
                    'target_type' => 'nursery',
                    'target_id' => (int) $group_id,
                    'nursery_id' => (int) $group_id,
                    'nursery' => array(
                        'id' => (int) $group_id,
                        'name' => get_the_title($group_id),
                        'prefix' => $group['prefix'],
                        'species_name' => $group['species_name'],
                        'living_count' => $living,
                    ),
                    'event' => $event,
                );
            }
        }
        usort($items, function ($left, $right) use ($controller) {
            return $controller->compare_nursery_events($left['event'], $right['event']);
        });
        $total = count($items);
        return array('items' => array_slice($items, max(0, (int) $offset), max(1, (int) $limit)), 'total' => $total);
    }

    public function bulk_update($request)
    {
        // This writes the same item map as promotion. A stale map must never
        // resurrect a committed promotion and make its code eligible again.
        return Setae_Entitlements::with_user_lock(get_current_user_id(), function () use ($request) {
            return $this->bulk_update_locked($request);
        });
    }

    private function bulk_update_locked($request)
    {
        $group_id = absint($request['id']);
        wp_cache_delete($group_id, 'post_meta');
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }

        $event = sanitize_key($request->get_param('event'));
        $date = $this->normalize_date($request->get_param('date'));
        $codes_input = (string) $request->get_param('codes');
        $note = sanitize_textarea_field($request->get_param('note'));

        if (!in_array($event, array('molt', 'dead', 'alive', 'rehomed'), true)) {
            return new WP_Error('invalid_event', '記録種別が不正です。', array('status' => 400));
        }

        if (!$date) {
            return new WP_Error('missing_date', '日付を入力してください。', array('status' => 400));
        }

        $group = $this->get_group_meta($group_id);
        if (!empty($group['archived'])) {
            return new WP_Error('group_archived', 'アーカイブ中のベビー群は、再開してから記録してください。', array('status' => 400));
        }
        $codes = $this->parse_codes($codes_input, $group['prefix'], $group['count'], $group['padding']);
        if (empty($codes)) {
            return new WP_Error('missing_codes', '番号を入力してください。', array('status' => 400));
        }

        $items = $group['changes'];
        $now = current_time('mysql');

        foreach ($codes as $code) {
            $item = isset($items[$code]) && is_array($items[$code]) ? $items[$code] : array();
            $molts = isset($item['molts']) && is_array($item['molts']) ? array_values($item['molts']) : array();
            $history = $this->normalize_item_history(isset($item['history']) ? $item['history'] : array());
            $current_status = $this->get_item_status($item);

            if (in_array($event, array('molt', 'dead', 'rehomed'), true) && $current_status !== 'alive') {
                return new WP_Error('item_not_active', '死亡・譲渡・マイ個体へ移動済みの番号には、この記録を追加できません。', array('status' => 400));
            }
            if ($event === 'alive' && $current_status === 'transferred') {
                return new WP_Error('item_transferred', 'マイ個体へ移動済みの番号は、ベビー管理へ戻せません。', array('status' => 400));
            }

            if ($event === 'molt') {
                if (!in_array($date, $molts, true)) {
                    $molts[] = $date;
                    sort($molts);
                }
                $item['molts'] = $molts;
            } elseif ($event === 'dead') {
                $item['status'] = 'dead';
                $item['death_date'] = $date;
            } elseif ($event === 'alive') {
                $item['status'] = 'alive';
                $item['death_date'] = '';
                $item['rehomed_date'] = '';
                $item['rehomed_at'] = '';
            } elseif ($event === 'rehomed') {
                $item['status'] = 'rehomed';
                $item['rehomed_date'] = $date;
                $item['rehomed_at'] = $now;
            }

            if ($note) {
                $item['note'] = $note;
            }
            $item['history'] = $this->append_item_history($history, $event, $date, $note);
            $item['updated_at'] = $now;
            $items[$code] = $item;
        }

        $saved = Setae_Entitlements::save_post_meta_checked($group_id, array('_setae_baby_items' => $items));
        if (is_wp_error($saved)) { return $saved; }

        return new WP_REST_Response(array(
            'updated' => count($codes),
            'codes' => $codes,
            'group' => $this->build_group_response($group_id, true),
        ), 200);
    }

    public function promote_to_spiders($request)
    {
        return Setae_Entitlements::with_user_lock(get_current_user_id(), function () use ($request) {
            return $this->promote_to_spiders_locked($request);
        });
    }

    private function promote_to_spiders_locked($request)
    {
        $group_id = absint($request['id']);
        wp_cache_delete($group_id, 'post_meta');
        $post = $this->get_owned_group($group_id);
        if (is_wp_error($post)) {
            return $post;
        }

        $group = $this->get_group_meta($group_id);
        if (!empty($group['archived'])) {
            return new WP_Error('group_archived', 'アーカイブ中のベビー群は、再開してからマイ個体へ移動してください。', array('status' => 400));
        }
        $codes = $this->parse_codes((string) $request->get_param('codes'), $group['prefix'], $group['count'], $group['padding']);
        if (empty($codes)) {
            return new WP_Error('missing_codes', 'マイ個体へ移動する番号を選択してください。', array('status' => 400));
        }

        $items = $group['changes'];
        $eligible_codes = array();
        foreach ($codes as $code) {
            $item = isset($items[$code]) && is_array($items[$code]) ? $items[$code] : array();
            $status = $this->get_item_status($item);
            if ($status !== 'alive') {
                continue;
            }
            $eligible_codes[] = $code;
        }

        if (empty($eligible_codes)) {
            return new WP_Error('no_eligible_codes', '死亡・譲渡、またはマイ個体へ移動済みの番号は移動できません。', array('status' => 400));
        }

        $allowed = Setae_Entitlements::can_promote_babies(get_current_user_id(), count($eligible_codes));
        if (is_wp_error($allowed)) { return $allowed; }
        $authorized_in_trial = Setae_Entitlements::get_plan_id(get_current_user_id()) === 'breeder_trial';

        $created = array();
        foreach ($eligible_codes as $code) {
            // One item is one commit. A failed later item leaves only earlier
            // complete promotions, which a retry skips from the stored map.
            $created_spider = Setae_Entitlements::with_transaction(array(get_current_user_id()), function () use ($group_id, $code, $authorized_in_trial) {
                global $wpdb;
                Setae_Entitlements::track_transaction_post($group_id);
                $locked = $wpdb->get_var($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID = %d FOR UPDATE", $group_id));
                if ((int) $locked !== $group_id) {
                    return new WP_Error('group_unavailable', '移動元のベビー群を確認できませんでした。', array('status' => 409));
                }
                clean_post_cache($group_id);
                wp_cache_delete($group_id, 'post_meta');
                $post = $this->get_owned_group($group_id);
                if (is_wp_error($post)) { return $post; }
                $group = $this->get_group_meta($group_id);
                if (!empty($group['archived'])) {
                    return new WP_Error('group_archived', 'アーカイブ中のベビー群は移動できません。', array('status' => 409));
                }
                $items = $group['changes'];
                $item = isset($items[$code]) && is_array($items[$code]) ? $items[$code] : array();
                if ($this->get_item_status($item) !== 'alive') {
                    return new WP_Error('item_not_active', '対象の状態が変わりました。画面を更新してください。', array('status' => 409));
                }
                $saved = $this->create_spider_from_baby($post, $group, $code, $item);
                if (is_wp_error($saved)) { return $saved; }
                $spider_id = absint($saved['id']);
                if (class_exists('Setae_QR_Manager')) {
                    $qr_target = Setae_QR_Manager::promote_baby_target($group_id, $code, $spider_id);
                    if (is_wp_error($qr_target) || !$qr_target) {
                        return is_wp_error($qr_target) ? $qr_target
                            : new WP_Error('qr_promotion_failed', 'QRの引き継ぎに失敗しました。', array('status' => 500));
                    }
                }
                $now = current_time('mysql');
                $item['status'] = 'transferred';
                $item['transferred_spider_id'] = $spider_id;
                $item['transferred_at'] = $now;
                $item['history'] = $this->append_item_history(
                    $this->normalize_item_history(isset($item['history']) ? $item['history'] : array()),
                    'transferred', current_time('Y-m-d'), ''
                );
                $item['updated_at'] = $now;
                $items[$code] = $item;
                $item_saved = Setae_Entitlements::save_post_meta_checked($group_id, array('_setae_baby_items' => $items));
                if (is_wp_error($item_saved)) { return $item_saved; }
                $counted = Setae_Entitlements::record_trial_promotion(get_current_user_id(), $spider_id, $authorized_in_trial);
                return is_wp_error($counted) ? $counted : $saved;
            });
            if (is_wp_error($created_spider)) {
                return $created_spider;
            }
            $spider_id = absint($created_spider['id']);
            Setae_Entitlements::record_event('baby_promoted', array(
                'idempotency_key' => 'baby-promoted:' . $spider_id, 'user_id' => get_current_user_id(),
                'object_type' => 'spider', 'object_id' => (int) $spider_id, 'acquisition_source' => 'nursery_promotion',
                'properties' => array('baby_group_id' => (int) $group_id),
            ));

            $created[] = array(
                'code' => $code,
                'spider_id' => (int) $spider_id,
                'history_count' => absint($created_spider['history_count']),
            );
        }

        return new WP_REST_Response(array(
            'created' => $created,
            'group' => $this->build_group_response($group_id, true),
        ), 201);
    }

    private function get_owned_group($group_id)
    {
        $post = get_post($group_id);
        if (!$post || $post->post_type !== 'setae_baby_group') {
            return new WP_Error('not_found', 'ベビー群が見つかりません。', array('status' => 404));
        }
        if ((int) $post->post_author !== get_current_user_id()) {
            return new WP_Error('forbidden', 'Permission denied', array('status' => 403));
        }
        return $post;
    }

    private function build_group_response($group_id, $include_items)
    {
        $post = get_post($group_id);
        $group = $this->get_group_meta($group_id);
        $items = array();
        $stats = array(
            'total' => $group['count'],
            'alive' => 0,
            'dead' => 0,
            'molted' => 0,
            'transferred' => 0,
            'rehomed' => 0,
        );

        for ($i = 1; $i <= $group['count']; $i++) {
            $code = $this->format_code($group['prefix'], $i, $group['padding']);
            $change = isset($group['changes'][$code]) && is_array($group['changes'][$code]) ? $group['changes'][$code] : array();
            $molts = isset($change['molts']) && is_array($change['molts']) ? array_values($change['molts']) : array();
            $status = $this->get_item_status($change);

            if ($status === 'transferred') {
                $stats['transferred']++;
            } elseif ($status === 'dead') {
                $stats['dead']++;
            } elseif ($status === 'rehomed') {
                $stats['rehomed']++;
            } else {
                $stats['alive']++;
            }
            if (!empty($molts)) {
                $stats['molted']++;
            }

            if ($include_items) {
                $items[] = array(
                    'code' => $code,
                    'number' => $i,
                    'status' => $status,
                    'molts' => $molts,
                    'last_molt' => !empty($molts) ? end($molts) : '',
                    'death_date' => !empty($change['death_date']) ? sanitize_text_field($change['death_date']) : '',
                    'rehomed_date' => !empty($change['rehomed_date']) ? sanitize_text_field($change['rehomed_date']) : '',
                    'rehomed_at' => !empty($change['rehomed_at']) ? sanitize_text_field($change['rehomed_at']) : '',
                    'note' => !empty($change['note']) ? sanitize_textarea_field($change['note']) : '',
                    'transferred_spider_id' => !empty($change['transferred_spider_id']) ? (int) $change['transferred_spider_id'] : 0,
                    'transferred_at' => !empty($change['transferred_at']) ? sanitize_text_field($change['transferred_at']) : '',
                    'history' => $this->normalize_item_history(isset($change['history']) ? $change['history'] : array()),
                    'updated_at' => !empty($change['updated_at']) ? sanitize_text_field($change['updated_at']) : '',
                );
            }
        }

        $response = array(
            'id' => $group_id,
            'name' => $post ? get_the_title($post) : '',
            'prefix' => $group['prefix'],
            'count' => $group['count'],
            'birth_date' => $group['birth_date'],
            'species_id' => $group['species_id'],
            'species_name' => $group['species_name'],
            'species_image' => $this->get_species_thumbnail($group['species_id']),
            'parent_spider_ids' => $group['parent_spider_ids'],
            'parent_spiders' => $group['parent_spiders'],
            'parent_note' => $group['parent_note'],
            'archived' => $group['archived'],
            'archived_at' => $group['archived_at'],
            'stats' => $stats,
            'living_count' => $this->previous_count($group_id, $stats['alive']),
            'development' => $this->build_development_summary($group),
            'events' => array_slice($this->read_nursery_events($group_id), 0, $include_items ? 200 : 50),
            'updated_at' => $post ? get_post_modified_time('Y-m-d H:i:s', false, $post) : '',
        );

        if ($include_items) {
            $response['items'] = $items;
        }

        return $response;
    }

    private function prepare_nursery_event($params, $group_id, $group)
    {
        $type = sanitize_key(isset($params['type']) ? $params['type'] : '');
        $date = $this->normalize_date(isset($params['date']) ? $params['date'] : '');
        if (!in_array($type, array('feed', 'observation', 'count_check', 'environment_check'), true)) {
            return new WP_Error('invalid_nursery_event', 'Nurseryの記録種別が正しくありません。', array('status' => 400));
        }
        if (!$date) {
            return new WP_Error('missing_date', '日付を入力してください。', array('status' => 400));
        }

        $data = array();
        if ($type === 'feed') {
            $data['prey_type'] = mb_substr(sanitize_text_field(isset($params['prey_type']) ? $params['prey_type'] : ''), 0, 160);
            $data['quantity'] = min(100000, absint(isset($params['quantity']) ? $params['quantity'] : 0));
        } elseif ($type === 'observation') {
            $data['label'] = mb_substr(sanitize_text_field(isset($params['label']) ? $params['label'] : '状態確認'), 0, 120);
        } elseif ($type === 'count_check') {
            if (!array_key_exists('current_count', $params) || !is_numeric($params['current_count'])) {
                return new WP_Error('missing_current_count', '現在の生存数を入力してください。', array('status' => 400));
            }
            $current = max(0, min(500, (int) $params['current_count']));
            $previous = $this->previous_count($group_id, $this->living_count($group));
            $data['previous_count'] = $previous;
            $data['current_count'] = $current;
            $data['difference'] = $current - $previous;
        } else {
            $temperature = isset($params['temperature']) && $params['temperature'] !== '' ? (float) $params['temperature'] : null;
            $humidity = isset($params['humidity']) && $params['humidity'] !== '' ? (float) $params['humidity'] : null;
            $data['temperature'] = $temperature === null ? null : max(-50, min(100, $temperature));
            $data['humidity'] = $humidity === null ? null : max(0, min(100, $humidity));
        }

        return array(
            'id' => (int) (time() * 1000 + wp_rand(0, 999)),
            'target_type' => 'nursery',
            'target_id' => (int) $group_id,
            'type' => $type,
            'date' => $date,
            'data' => $data,
            'note' => mb_substr(sanitize_textarea_field(isset($params['note']) ? $params['note'] : ''), 0, 2000),
            'created_at' => current_time('mysql'),
        );
    }

    private function read_nursery_events($group_id)
    {
        $events = get_post_meta($group_id, self::NURSERY_EVENTS_META, true);
        if (!is_array($events)) {
            return array();
        }
        $recorders = get_post_meta($group_id, self::NURSERY_RECORDERS_META, true);
        $recorders = is_array($recorders) ? $recorders : array();
        $normalized = array();
        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }
            $type = sanitize_key(isset($event['type']) ? $event['type'] : '');
            $date = $this->normalize_date(isset($event['date']) ? $event['date'] : '');
            if (!$date || !in_array($type, array('feed', 'observation', 'count_check', 'environment_check'), true)) {
                continue;
            }
            $normalized[] = array(
                'id' => isset($event['id']) ? (int) $event['id'] : 0,
                'recorded_by_current_user' => !empty($recorders[$event['id'] ?? 0])
                    && (int) $recorders[$event['id']] === get_current_user_id(),
                'target_type' => 'nursery',
                'target_id' => (int) $group_id,
                'type' => $type,
                'date' => $date,
                'data' => isset($event['data']) && is_array($event['data']) ? $event['data'] : array(),
                'note' => sanitize_textarea_field(isset($event['note']) ? $event['note'] : ''),
                'created_at' => sanitize_text_field(isset($event['created_at']) ? $event['created_at'] : ''),
            );
        }
        usort($normalized, array($this, 'compare_nursery_events'));
        return $normalized;
    }

    private function compare_nursery_events($left, $right)
    {
        $date_order = strcmp((string) ($right['date'] ?? ''), (string) ($left['date'] ?? ''));
        if ($date_order !== 0) {
            return $date_order;
        }
        return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
    }

    private function previous_count($group_id, $fallback)
    {
        foreach ($this->read_nursery_events($group_id) as $event) {
            if ($event['type'] === 'count_check' && isset($event['data']['current_count'])) {
                return max(0, (int) $event['data']['current_count']);
            }
        }
        return max(0, (int) $fallback);
    }

    private function living_count($group)
    {
        $living = 0;
        for ($i = 1; $i <= $group['count']; $i++) {
            $code = $this->format_code($group['prefix'], $i, $group['padding']);
            $item = isset($group['changes'][$code]) && is_array($group['changes'][$code]) ? $group['changes'][$code] : array();
            if ($this->get_item_status($item) === 'alive') {
                $living++;
            }
        }
        return $living;
    }

    private function build_development_summary($group)
    {
        $counts = array();
        for ($i = 1; $i <= $group['count']; $i++) {
            $code = $this->format_code($group['prefix'], $i, $group['padding']);
            $item = isset($group['changes'][$code]) && is_array($group['changes'][$code]) ? $group['changes'][$code] : array();
            if ($this->get_item_status($item) !== 'alive') {
                continue;
            }
            $molts = isset($item['molts']) && is_array($item['molts']) ? $item['molts'] : array();
            $instar = count($molts) + 1;
            $counts[$instar] = isset($counts[$instar]) ? $counts[$instar] + 1 : 1;
        }
        ksort($counts, SORT_NUMERIC);
        return array_values(array_map(function ($instar, $count) {
            return array('instar' => (int) $instar, 'count' => (int) $count);
        }, array_keys($counts), array_values($counts)));
    }

    private function get_group_meta($group_id)
    {
        $count = absint(get_post_meta($group_id, '_setae_baby_count', true));
        $count = max(1, min(500, $count));
        $prefix = $this->normalize_prefix(get_post_meta($group_id, '_setae_baby_prefix', true));
        $padding = max(3, strlen((string) $count));
        $changes = get_post_meta($group_id, '_setae_baby_items', true);
        $species_id = $this->normalize_species_id(get_post_meta($group_id, '_setae_baby_species_id', true));
        $parent_spider_ids = $this->parse_spider_ids(get_post_meta($group_id, '_setae_baby_parent_spider_ids', true));

        return array(
            'prefix' => $prefix ?: 'B',
            'count' => $count,
            'padding' => $padding,
            'birth_date' => $this->normalize_date(get_post_meta($group_id, '_setae_baby_birth_date', true)),
            'species_id' => $species_id,
            'species_name' => sanitize_text_field(get_post_meta($group_id, '_setae_baby_species_name', true)),
            'parent_spider_ids' => $parent_spider_ids,
            'parent_spiders' => $this->build_parent_spiders($parent_spider_ids),
            'parent_note' => sanitize_textarea_field(get_post_meta($group_id, '_setae_baby_parent_note', true)),
            'archived' => get_post_meta($group_id, '_setae_baby_archived', true) === '1',
            'archived_at' => sanitize_text_field(get_post_meta($group_id, '_setae_baby_archived_at', true)),
            'changes' => is_array($changes) ? $changes : array(),
        );
    }

    private function normalize_species_id($value)
    {
        $species_id = absint($value);
        if (!$species_id) {
            return 0;
        }
        $post = get_post($species_id);
        return ($post && $post->post_type === 'setae_species') ? $species_id : 0;
    }

    private function parse_spider_ids($value)
    {
        if (is_string($value)) {
            $value = preg_split('/[,\\s]+/', $value);
        }
        if (!is_array($value)) {
            return array();
        }

        $ids = array();
        foreach ($value as $raw_id) {
            $id = absint($raw_id);
            if (!$id || isset($ids[$id])) {
                continue;
            }
            $post = get_post($id);
            if ($post && $post->post_type === 'setae_spider' && (int) $post->post_author === get_current_user_id()) {
                $ids[$id] = $id;
            }
        }
        return array_values($ids);
    }

    private function build_parent_spiders($ids)
    {
        $parents = array();
        foreach ($ids as $id) {
            $post = get_post($id);
            if (!$post || $post->post_type !== 'setae_spider' || (int) $post->post_author !== get_current_user_id()) {
                continue;
            }
            $species_id = absint(get_post_meta($id, '_setae_species_id', true));
            $custom_name = get_post_meta($id, '_setae_custom_species_name', true);
            $own_image = esc_url_raw(get_post_meta($id, '_setae_spider_image', true));
            $species_image = $this->get_species_thumbnail($species_id);
            $parents[] = array(
                'id' => (int) $id,
                'title' => get_the_title($id),
                'species_name' => $species_id ? get_the_title($species_id) : ($custom_name ?: ''),
                'image' => $own_image ?: $species_image,
                'image_source' => $own_image ? 'spider' : ($species_image ? 'species' : 'none'),
            );
        }
        return $parents;
    }

    private function get_species_thumbnail($species_id)
    {
        $species_id = absint($species_id);
        if (!$species_id) {
            return '';
        }

        $image = get_the_post_thumbnail_url($species_id, 'thumbnail');
        return $image ? esc_url_raw($image) : '';
    }

    private function get_item_status($item)
    {
        if (!is_array($item)) {
            return 'alive';
        }

        if (!empty($item['transferred_spider_id']) || (isset($item['status']) && $item['status'] === 'transferred')) {
            return 'transferred';
        }
        if (isset($item['status']) && $item['status'] === 'dead') {
            return 'dead';
        }
        if (isset($item['status']) && $item['status'] === 'rehomed') {
            return 'rehomed';
        }

        return 'alive';
    }

    private function build_dashboard_summary($groups)
    {
        $summary = array(
            'groups_total' => 0,
            'active_groups' => 0,
            'archived_groups' => 0,
            'babies_total' => 0,
            'currently_managed' => 0,
            'transferred' => 0,
            'rehomed' => 0,
            'dead' => 0,
            'species' => array(),
        );
        $species = array();

        foreach ((array) $groups as $group) {
            if (!is_array($group)) {
                continue;
            }

            $stats = isset($group['stats']) && is_array($group['stats']) ? $group['stats'] : array();
            $total = max(0, absint(isset($stats['total']) ? $stats['total'] : 0));
            $alive = max(0, absint(isset($group['living_count']) ? $group['living_count'] : (isset($stats['alive']) ? $stats['alive'] : 0)));
            $is_archived = !empty($group['archived']);

            $summary['groups_total']++;
            $summary['babies_total'] += $total;
            $summary['transferred'] += max(0, absint(isset($stats['transferred']) ? $stats['transferred'] : 0));
            $summary['rehomed'] += max(0, absint(isset($stats['rehomed']) ? $stats['rehomed'] : 0));
            $summary['dead'] += max(0, absint(isset($stats['dead']) ? $stats['dead'] : 0));

            if ($is_archived) {
                $summary['archived_groups']++;
            } else {
                $summary['active_groups']++;
                $summary['currently_managed'] += $alive;
            }

            $species_id = absint(isset($group['species_id']) ? $group['species_id'] : 0);
            $species_name = trim(sanitize_text_field(isset($group['species_name']) ? $group['species_name'] : ''));
            $species_name = $species_name ?: '種類未設定';
            $species_key = $species_id ? 'id-' . $species_id : 'name-' . md5($species_name);

            if (!isset($species[$species_key])) {
                $species[$species_key] = array(
                    'id' => $species_id,
                    'name' => $species_name,
                    'image' => esc_url_raw(isset($group['species_image']) ? $group['species_image'] : ''),
                    'count' => 0,
                    'groups' => 0,
                    'active_groups' => 0,
                );
            }

            $species[$species_key]['count'] += $total;
            $species[$species_key]['groups']++;
            if (!$is_archived) {
                $species[$species_key]['active_groups']++;
            }
            if (!$species[$species_key]['image'] && !empty($group['species_image'])) {
                $species[$species_key]['image'] = esc_url_raw($group['species_image']);
            }
        }

        usort($species, function ($a, $b) {
            $count_diff = (int) $b['count'] - (int) $a['count'];
            if ($count_diff !== 0) {
                return $count_diff;
            }
            return strcmp((string) $a['name'], (string) $b['name']);
        });

        $summary['species'] = array_values($species);
        return $summary;
    }

    private function normalize_item_history($history)
    {
        if (!is_array($history)) {
            return array();
        }

        $entries = array();
        foreach ($history as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $type = sanitize_key(isset($entry['type']) ? $entry['type'] : '');
            $date = $this->normalize_date(isset($entry['date']) ? $entry['date'] : '');
            if (!$date || !in_array($type, array('molt', 'feed', 'pairing', 'observation', 'dead', 'alive', 'rehomed', 'transferred'), true)) {
                continue;
            }

            $normalized_entry = array(
                'type' => $type,
                'date' => $date,
                'note' => !empty($entry['note']) ? sanitize_textarea_field($entry['note']) : '',
            );
            if ($type === 'feed' && !empty($entry['prey_type'])) {
                $normalized_entry['prey_type'] = sanitize_text_field($entry['prey_type']);
            }
            $entries[] = $normalized_entry;
        }

        usort($entries, function ($a, $b) {
            return strcmp($a['date'] . $a['type'], $b['date'] . $b['type']);
        });

        return $entries;
    }

    private function append_item_history($history, $event, $date, $note)
    {
        foreach ($history as $index => $entry) {
            if ($entry['type'] === $event && $entry['date'] === $date) {
                if ($note) {
                    $history[$index]['note'] = $note;
                }
                return $history;
            }
        }

        $history[] = array(
            'type' => $event,
            'date' => $date,
            'note' => $note,
        );

        return $this->normalize_item_history($history);
    }

    private function create_spider_from_baby($group_post, $group, $code, $item)
    {
        $user_id = get_current_user_id();
        $spider_id = wp_insert_post(array(
            'post_title' => $code,
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'post_author' => $user_id,
        ), true);

        if (is_wp_error($spider_id)) {
            return $spider_id;
        }
        if (!$spider_id) {
            return new WP_Error('create_spider_failed', 'マイ個体への移動に失敗しました。', array('status' => 500));
        }

        Setae_Entitlements::track_transaction_post($spider_id);
        $classification = wp_set_object_terms($spider_id, 'tarantula', 'setae_classification');
        if (is_wp_error($classification) || !$classification) {
            return new WP_Error('classification_save_failed', '分類を保存できませんでした。', array('status' => 503));
        }
        $terms = wp_get_object_terms($spider_id, 'setae_classification');
        if (is_wp_error($terms) || count($terms) !== 1 || $terms[0]->slug !== 'tarantula') {
            return new WP_Error('classification_save_failed', '分類を確認できませんでした。', array('status' => 503));
        }
        Setae_Entitlements::track_transaction_term($terms[0]->term_id, $terms[0]->term_taxonomy_id, 'setae_classification');
        $values = array(
            '_setae_owner_id' => $user_id, '_setae_status' => 'normal',
            '_setae_baby_origin_group_id' => (int) $group_post->ID,
            '_setae_baby_origin_group_name' => get_the_title($group_post),
            '_setae_baby_origin_code' => sanitize_text_field($code),
        );

        if (!empty($group['species_id'])) {
            $values['_setae_species_id'] = absint($group['species_id']);
        } elseif (!empty($group['species_name'])) {
            $values['_setae_custom_species_name'] = sanitize_text_field($group['species_name']);
        }

        $molts = isset($item['molts']) && is_array($item['molts']) ? array_values($item['molts']) : array();
        if (!empty($molts)) {
            sort($molts);
            $values['_setae_last_molt_date'] = end($molts);
        }

        $source = Setae_Entitlements::mark_specimen_source($spider_id, 'nursery_promotion');
        if (is_wp_error($source)) { return $source; }
        $management_start_date = get_post_time('Y-m-d', false, $group_post);
        if ($management_start_date) {
            $values['_setae_management_start_date'] = $management_start_date;
        }
        if (!empty($group['birth_date'])) {
            $values['_setae_baby_origin_birth_date'] = $group['birth_date'];
        }
        if (!empty($group['parent_spider_ids'])) {
            $values['_setae_parent_spider_ids'] = array_map('intval', $group['parent_spider_ids']);
        }
        $saved = Setae_Entitlements::save_post_meta_checked($spider_id, $values);
        if (is_wp_error($saved)) { return $saved; }

        $history_count = $this->copy_baby_history_to_spider($spider_id, $group_post, $code, $item);
        if (is_wp_error($history_count)) {
            wp_delete_post($spider_id, true);
            return $history_count;
        }

        return array(
            'id' => (int) $spider_id,
            'history_count' => (int) $history_count,
        );
    }

    private function copy_baby_history_to_spider($spider_id, $group_post, $code, $item)
    {
        $created_log_ids = array();
        $history_count = 0;
        $source = array(
            'source' => 'baby_group',
            'baby_group_id' => (int) $group_post->ID,
            'baby_group_name' => sanitize_text_field(get_the_title($group_post)),
            'baby_code' => sanitize_text_field($code),
        );

        foreach ($this->get_transfer_history($item) as $event) {
            $data = $source;
            if ($event['type'] === 'observation') {
                $data['label'] = 'ベビー期のメモ';
            }
            if (!empty($event['note'])) {
                $data['note'] = $event['note'];
            }
            if ($event['type'] === 'feed' && !empty($event['prey_type'])) {
                $data['prey_type'] = sanitize_text_field($event['prey_type']);
                $data['refused'] = false;
            }

            $log_id = $this->create_baby_history_log($spider_id, $event['type'], $event['date'], $data);
            if (is_wp_error($log_id)) {
                $this->delete_baby_history_logs($created_log_ids);
                return $log_id;
            }

            $created_log_ids[] = $log_id;
            $history_count++;
        }

        $transfer_data = $source;
        $transfer_data['label'] = 'ベビー管理から移動';
        $transfer_data['note'] = sprintf(
            'ベビー群「%s」の%sから移動しました。',
            $source['baby_group_name'],
            $source['baby_code']
        );
        $transfer_log_id = $this->create_baby_history_log(
            $spider_id,
            'observation',
            current_time('Y-m-d'),
            $transfer_data
        );
        if (is_wp_error($transfer_log_id)) {
            $this->delete_baby_history_logs($created_log_ids);
            return $transfer_log_id;
        }

        return $history_count;
    }

    private function get_transfer_history($item)
    {
        $events = array();
        $molt_dates = array();
        $note_values = array();
        $history = $this->normalize_item_history(isset($item['history']) ? $item['history'] : array());

        foreach ($history as $entry) {
            if ($entry['type'] === 'molt') {
                $events[] = array(
                    'type' => 'molt',
                    'date' => $entry['date'],
                    'note' => $entry['note'],
                );
                $molt_dates[$entry['date']] = true;
                if ($entry['note']) {
                    $note_values[$entry['note']] = true;
                }
                continue;
            }

            if (in_array($entry['type'], array('feed', 'pairing', 'observation'), true)) {
                $event = array(
                    'type' => $entry['type'],
                    'date' => $entry['date'],
                    'note' => $entry['note'],
                );
                if ($entry['type'] === 'feed' && !empty($entry['prey_type'])) {
                    $event['prey_type'] = sanitize_text_field($entry['prey_type']);
                }
                $events[] = $event;
                if ($entry['note']) {
                    $note_values[$entry['note']] = true;
                }
                continue;
            }

            if ($entry['note']) {
                $events[] = array(
                    'type' => 'observation',
                    'date' => $entry['date'],
                    'note' => $entry['note'],
                );
                $note_values[$entry['note']] = true;
            }
        }

        $legacy_molts = isset($item['molts']) && is_array($item['molts']) ? $item['molts'] : array();
        foreach ($legacy_molts as $date) {
            $date = $this->normalize_date($date);
            if (!$date || isset($molt_dates[$date])) {
                continue;
            }
            $events[] = array(
                'type' => 'molt',
                'date' => $date,
                'note' => '',
            );
            $molt_dates[$date] = true;
        }

        $legacy_note = !empty($item['note']) ? sanitize_textarea_field($item['note']) : '';
        $legacy_note_date = $this->history_date_from_timestamp(isset($item['updated_at']) ? $item['updated_at'] : '');
        if ($legacy_note && $legacy_note_date && !isset($note_values[$legacy_note])) {
            $events[] = array(
                'type' => 'observation',
                'date' => $legacy_note_date,
                'note' => $legacy_note,
            );
        }

        usort($events, function ($a, $b) {
            return strcmp($a['date'] . $a['type'], $b['date'] . $b['type']);
        });

        return $events;
    }

    private function history_date_from_timestamp($value)
    {
        return $this->normalize_date(substr(sanitize_text_field($value), 0, 10));
    }

    private function create_baby_history_log($spider_id, $type, $date, $data)
    {
        $date = $this->normalize_date($date);
        if (!$date) {
            return new WP_Error('history_copy_failed', 'ベビー期の履歴の引き継ぎに失敗しました。', array('status' => 500));
        }

        $note = !empty($data['note']) ? sanitize_textarea_field($data['note']) : '';
        if ($note) {
            $data['note'] = $note;
        }

        $log_id = wp_insert_post(array(
            'post_title' => sanitize_text_field(sprintf('%s - %s (%s)', get_the_title($spider_id), ucfirst($type), $date)),
            'post_content' => $note,
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'post_author' => get_current_user_id(),
        ), true);

        if (is_wp_error($log_id) || !$log_id) {
            return new WP_Error('history_copy_failed', 'ベビー期の履歴の引き継ぎに失敗しました。', array('status' => 500));
        }

        Setae_Entitlements::track_transaction_post($log_id);
        $values = array('_setae_log_spider_id' => (int) $spider_id, '_setae_log_type' => $type,
            '_setae_log_date' => $date, '_setae_log_data' => wp_json_encode($data, JSON_UNESCAPED_UNICODE));
        if (Setae_Entitlements::mark_log_recorder($log_id, get_current_user_id()) !== get_current_user_id()) {
            return new WP_Error('history_copy_failed', '履歴の記録者を保存できませんでした。', array('status' => 503));
        }

        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        if ($species_id) {
            $values['_setae_related_species_id'] = $species_id;
        }
        $saved = Setae_Entitlements::save_post_meta_checked($log_id, $values);
        if (is_wp_error($saved)) { return $saved; }

        if ($type === 'feed') {
            $current = get_post_meta($spider_id, '_setae_last_feed_date', true);
            if (!$current || strcmp($date, $current) > 0) {
                $saved = Setae_Entitlements::save_post_meta_checked($spider_id, array('_setae_last_feed_date' => $date));
            }
        } elseif ($type === 'pairing') {
            $current = get_post_meta($spider_id, '_setae_last_pairing_date', true);
            if (!$current || strcmp($date, $current) > 0) {
                $saved = Setae_Entitlements::save_post_meta_checked($spider_id, array('_setae_last_pairing_date' => $date));
            }
        }
        if (is_wp_error($saved)) { return $saved; }

        return (int) $log_id;
    }

    private function delete_baby_history_logs($log_ids)
    {
        foreach ($log_ids as $log_id) {
            if ($log_id) {
                wp_delete_post((int) $log_id, true);
            }
        }
    }

    private function parse_codes($input, $prefix, $count, $padding)
    {
        $input = str_replace(array('、', '，', "\r", "\n", "\t"), ',', strtoupper((string) $input));
        $input = str_replace(array('〜', '～', '~'), '-', $input);
        $parts = array_filter(array_map('trim', explode(',', $input)));
        $codes = array();

        foreach ($parts as $part) {
            if (strpos($part, '-') !== false) {
                $range = array_map('trim', explode('-', $part, 2));
                $start = $this->code_to_number($range[0], $prefix);
                $end = $this->code_to_number($range[1], $prefix);
                if (!$start || !$end) {
                    continue;
                }
                if ($start > $end) {
                    $tmp = $start;
                    $start = $end;
                    $end = $tmp;
                }
                for ($i = $start; $i <= $end; $i++) {
                    if ($i >= 1 && $i <= $count) {
                        $codes[] = $this->format_code($prefix, $i, $padding);
                    }
                }
            } else {
                $number = $this->code_to_number($part, $prefix);
                if ($number >= 1 && $number <= $count) {
                    $codes[] = $this->format_code($prefix, $number, $padding);
                }
            }
        }

        return array_values(array_unique($codes));
    }

    private function code_to_number($value, $prefix)
    {
        $value = strtoupper(trim((string) $value));
        $prefix = strtoupper((string) $prefix);
        if ($prefix && strpos($value, $prefix) === 0) {
            $value = substr($value, strlen($prefix));
        }
        $value = preg_replace('/[^0-9]/', '', $value);
        return $value === '' ? 0 : absint($value);
    }

    private function format_code($prefix, $number, $padding)
    {
        return strtoupper($prefix) . str_pad((string) $number, $padding, '0', STR_PAD_LEFT);
    }

    private function normalize_prefix($value)
    {
        $prefix = strtoupper(sanitize_key($value));
        $prefix = preg_replace('/[^A-Z0-9]/', '', $prefix);
        return substr($prefix, 0, 8);
    }

    private function find_prefix_conflict($prefix, $user_id, $exclude_group_id = 0)
    {
        $prefix = $this->normalize_prefix($prefix);
        if (!$prefix || !$user_id) {
            return 0;
        }

        $group_ids = get_posts(array(
            'post_type' => 'setae_baby_group',
            'post_status' => 'any',
            'author' => absint($user_id),
            'posts_per_page' => -1,
            'fields' => 'ids',
            'no_found_rows' => true,
        ));

        foreach ((array) $group_ids as $group_id) {
            $group_id = absint($group_id);
            if (!$group_id || $group_id === absint($exclude_group_id)) {
                continue;
            }
            $existing_prefix = $this->normalize_prefix(get_post_meta($group_id, '_setae_baby_prefix', true));
            if ($existing_prefix === $prefix) {
                return $group_id;
            }
        }

        return 0;
    }

    private function normalize_date($value)
    {
        $value = sanitize_text_field($value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
    }
}
