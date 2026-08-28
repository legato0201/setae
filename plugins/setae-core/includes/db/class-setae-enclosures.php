<?php

/**
 * Persistence and legacy migration for managed enclosures.
 */
class Setae_Enclosures
{
    const SCHEMA_VERSION = '1.0.0';
    const SCHEMA_OPTION = 'setae_enclosure_schema_version';
    const MIGRATION_META = '_setae_enclosure_legacy_migrated_v1';

    public static function maybe_upgrade()
    {
        if (get_option(self::SCHEMA_OPTION) !== self::SCHEMA_VERSION) {
            self::install_schema();
        }
    }

    public static function install_schema()
    {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $tables = self::tables();

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta("CREATE TABLE {$tables['enclosures']} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            code varchar(50) NOT NULL,
            name varchar(120) NOT NULL DEFAULT '',
            enclosure_type varchar(60) NOT NULL DEFAULT 'unspecified',
            width_mm decimal(8,2) DEFAULT NULL,
            depth_mm decimal(8,2) DEFAULT NULL,
            height_mm decimal(8,2) DEFAULT NULL,
            location varchar(180) NOT NULL DEFAULT '',
            target_temp_min decimal(5,2) DEFAULT NULL,
            target_temp_max decimal(5,2) DEFAULT NULL,
            target_humidity_min decimal(5,2) DEFAULT NULL,
            target_humidity_max decimal(5,2) DEFAULT NULL,
            substrate varchar(180) NOT NULL DEFAULT '',
            substrate_depth_mm decimal(8,2) DEFAULT NULL,
            photo_url text NULL,
            environment_interval_days smallint(5) unsigned NOT NULL DEFAULT 1,
            maintenance_interval_days smallint(5) unsigned NOT NULL DEFAULT 14,
            status varchar(20) NOT NULL DEFAULT 'active',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY user_code (user_id,code),
            KEY user_status (user_id,status)
        ) $charset;");

        dbDelta("CREATE TABLE {$tables['occupancies']} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            enclosure_id bigint(20) unsigned NOT NULL,
            animal_id bigint(20) unsigned NOT NULL,
            started_at date NOT NULL,
            ended_at date DEFAULT NULL,
            note text NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY enclosure_active (enclosure_id,ended_at),
            KEY animal_active (animal_id,ended_at)
        ) $charset;");

        dbDelta("CREATE TABLE {$tables['events']} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            enclosure_id bigint(20) unsigned NOT NULL,
            user_id bigint(20) unsigned NOT NULL,
            animal_id bigint(20) unsigned DEFAULT NULL,
            event_type varchar(40) NOT NULL,
            event_date date NOT NULL,
            temperature decimal(5,2) DEFAULT NULL,
            humidity decimal(5,2) DEFAULT NULL,
            note text NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY enclosure_date (enclosure_id,event_date),
            KEY user_date (user_id,event_date)
        ) $charset;");

        update_option(self::SCHEMA_OPTION, self::SCHEMA_VERSION, false);
    }

    public static function tables()
    {
        global $wpdb;
        return array(
            'enclosures' => $wpdb->prefix . 'setae_enclosures',
            'occupancies' => $wpdb->prefix . 'setae_enclosure_occupancies',
            'events' => $wpdb->prefix . 'setae_enclosure_events',
        );
    }

    public static function migrate_legacy_for_user($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id || get_user_meta($user_id, self::MIGRATION_META, true)) {
            return;
        }

        $animals = get_posts(array(
            'post_type' => 'setae_spider',
            'post_status' => array('publish', 'private', 'draft'),
            'author' => $user_id,
            'posts_per_page' => -1,
            'fields' => 'ids',
        ));

        foreach ($animals as $animal_id) {
            $legacy_name = trim((string) get_post_meta($animal_id, '_setae_spider_enclosure', true));
            if ($legacy_name === '') {
                continue;
            }
            $enclosure = self::find_by_code_or_name($user_id, $legacy_name);
            if (!$enclosure) {
                $created = self::create($user_id, array(
                    'code' => self::legacy_code($user_id, $legacy_name),
                    'name' => $legacy_name,
                    'enclosure_type' => 'unspecified',
                ));
                $enclosure = is_wp_error($created) ? null : $created;
            }
            if ($enclosure) {
                self::assign_animal($user_id, (int) $enclosure['id'], (int) $animal_id, current_time('Y-m-d'), '既存の飼育容器情報から移行');
            }
        }

        update_user_meta($user_id, self::MIGRATION_META, current_time('mysql'));
    }

    public static function list_for_user($user_id, $status = 'active')
    {
        global $wpdb;
        $tables = self::tables();
        $status = in_array($status, array('active', 'archived', 'all'), true) ? $status : 'active';
        $where = 'user_id = %d';
        $args = array(absint($user_id));
        if ($status !== 'all') {
            $where .= ' AND status = %s';
            $args[] = $status;
        }
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$tables['enclosures']} WHERE $where ORDER BY code ASC, id ASC",
            $args
        ), ARRAY_A);
        return array_map(array(__CLASS__, 'hydrate'), $rows ?: array());
    }

    public static function get_for_user($user_id, $enclosure_id)
    {
        global $wpdb;
        $tables = self::tables();
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tables['enclosures']} WHERE id = %d AND user_id = %d LIMIT 1",
            absint($enclosure_id),
            absint($user_id)
        ), ARRAY_A);
        return $row ? self::hydrate($row, true) : null;
    }

    public static function create($user_id, $data)
    {
        global $wpdb;
        $tables = self::tables();
        $user_id = absint($user_id);
        $code = self::normalize_code(isset($data['code']) ? $data['code'] : '');
        if ($code === '') {
            $code = self::next_code($user_id);
        }
        if (self::find_by_code_or_name($user_id, $code, true)) {
            return new WP_Error('enclosure_code_exists', 'この容器番号はすでに使用されています。', array('status' => 409));
        }
        $now = current_time('mysql');
        $record = self::sanitize_record($data);
        $validation = self::validate_record($record);
        if (is_wp_error($validation)) {
            return $validation;
        }
        $record['user_id'] = $user_id;
        $record['code'] = $code;
        $record['created_at'] = $now;
        $record['updated_at'] = $now;
        if (!$wpdb->insert($tables['enclosures'], $record)) {
            return new WP_Error('enclosure_create_failed', '飼育容器を作成できませんでした。', array('status' => 500));
        }
        return self::get_for_user($user_id, $wpdb->insert_id);
    }

    public static function update($user_id, $enclosure_id, $data)
    {
        global $wpdb;
        $tables = self::tables();
        $current = self::get_for_user($user_id, $enclosure_id);
        if (!$current) {
            return new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        $record = self::sanitize_record(array_merge($current, $data));
        $validation = self::validate_record($record);
        if (is_wp_error($validation)) {
            return $validation;
        }
        if (array_key_exists('code', $data)) {
            $code = self::normalize_code($data['code']);
            if ($code === '') {
                return new WP_Error('invalid_enclosure_code', '容器番号を入力してください。', array('status' => 400));
            }
            $duplicate = self::find_by_code_or_name($user_id, $code, true);
            if ($duplicate && (int) $duplicate['id'] !== (int) $enclosure_id) {
                return new WP_Error('enclosure_code_exists', 'この容器番号はすでに使用されています。', array('status' => 409));
            }
            $record['code'] = $code;
        }
        $record['updated_at'] = current_time('mysql');
        $wpdb->update($tables['enclosures'], $record, array('id' => absint($enclosure_id), 'user_id' => absint($user_id)));
        return self::get_for_user($user_id, $enclosure_id);
    }

    public static function archive($user_id, $enclosure_id)
    {
        return self::update($user_id, $enclosure_id, array('status' => 'archived'));
    }

    public static function add_event($user_id, $enclosure_id, $data)
    {
        global $wpdb;
        $tables = self::tables();
        if (!self::get_for_user($user_id, $enclosure_id)) {
            return new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        $allowed = array('environment_check', 'maintenance', 'watering', 'misting', 'substrate_change', 'note');
        $type = sanitize_key(isset($data['event_type']) ? $data['event_type'] : '');
        if (!in_array($type, $allowed, true)) {
            return new WP_Error('invalid_enclosure_event', '記録種別が正しくありません。', array('status' => 400));
        }
        $date = self::valid_date(isset($data['event_date']) ? $data['event_date'] : '') ?: current_time('Y-m-d');
        $record = array(
            'enclosure_id' => absint($enclosure_id),
            'user_id' => absint($user_id),
            'animal_id' => !empty($data['animal_id']) ? absint($data['animal_id']) : null,
            'event_type' => $type,
            'event_date' => $date,
            'temperature' => self::decimal(isset($data['temperature']) ? $data['temperature'] : null, -20, 80),
            'humidity' => self::decimal(isset($data['humidity']) ? $data['humidity'] : null, 0, 100),
            'note' => sanitize_textarea_field(isset($data['note']) ? $data['note'] : ''),
            'created_at' => current_time('mysql'),
        );
        if ($type === 'environment_check' && $record['temperature'] === null && $record['humidity'] === null) {
            return new WP_Error('missing_environment_values', '温度または湿度を入力してください。', array('status' => 400));
        }
        if (!$wpdb->insert($tables['events'], $record)) {
            return new WP_Error('enclosure_event_failed', '容器記録を保存できませんでした。', array('status' => 500));
        }
        return self::get_for_user($user_id, $enclosure_id);
    }

    public static function assign_animal($user_id, $enclosure_id, $animal_id, $started_at = '', $note = '')
    {
        global $wpdb;
        $tables = self::tables();
        $animal_id = absint($animal_id);
        $enclosure_id = absint($enclosure_id);
        $animal = get_post($animal_id);
        if (!$animal || $animal->post_type !== 'setae_spider' || (int) $animal->post_author !== absint($user_id)) {
            return new WP_Error('animal_not_found', '対象の個体が見つかりません。', array('status' => 404));
        }
        $enclosure = self::get_for_user($user_id, $enclosure_id);
        if (!$enclosure) {
            return new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        $started_at = self::valid_date($started_at) ?: current_time('Y-m-d');
        $active = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tables['occupancies']} WHERE animal_id = %d AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
            $animal_id
        ), ARRAY_A);
        if ($active && (int) $active['enclosure_id'] === $enclosure_id) {
            update_post_meta($animal_id, '_setae_spider_enclosure_id', $enclosure_id);
            update_post_meta($animal_id, '_setae_spider_enclosure', $enclosure['code']);
            return $enclosure;
        }
        $wpdb->query('START TRANSACTION');
        if ($active) {
            $end_date = $started_at;
            $wpdb->update($tables['occupancies'], array('ended_at' => $end_date, 'updated_at' => current_time('mysql')), array('id' => (int) $active['id']));
            self::insert_system_event($user_id, (int) $active['enclosure_id'], 'animal_move_out', $end_date, $animal_id, '別の容器へ移動');
        }
        $now = current_time('mysql');
        $inserted = $wpdb->insert($tables['occupancies'], array(
            'enclosure_id' => $enclosure_id,
            'animal_id' => $animal_id,
            'started_at' => $started_at,
            'ended_at' => null,
            'note' => sanitize_textarea_field($note),
            'created_at' => $now,
            'updated_at' => $now,
        ));
        if (!$inserted) {
            $wpdb->query('ROLLBACK');
            return new WP_Error('occupancy_create_failed', '容器への入居を保存できませんでした。', array('status' => 500));
        }
        update_post_meta($animal_id, '_setae_spider_enclosure_id', $enclosure_id);
        update_post_meta($animal_id, '_setae_spider_enclosure', $enclosure['code']);
        self::insert_system_event($user_id, $enclosure_id, 'animal_move_in', $started_at, $animal_id, $note);
        $wpdb->query('COMMIT');
        return self::get_for_user($user_id, $enclosure_id);
    }

    public static function assign_legacy_name($user_id, $animal_id, $name, $started_at = '')
    {
        $name = trim(sanitize_text_field($name));
        if ($name === '') {
            return null;
        }
        $enclosure = self::find_by_code_or_name($user_id, $name);
        if (!$enclosure) {
            $enclosure = self::create($user_id, array(
                'code' => self::legacy_code($user_id, $name),
                'name' => $name,
                'enclosure_type' => 'unspecified',
            ));
        }
        if (is_wp_error($enclosure)) {
            return $enclosure;
        }
        return self::assign_animal($user_id, (int) $enclosure['id'], $animal_id, $started_at, '容器名から関連付け');
    }

    public static function remove_animal($user_id, $enclosure_id, $animal_id, $ended_at = '', $note = '')
    {
        global $wpdb;
        $tables = self::tables();
        if (!self::get_for_user($user_id, $enclosure_id)) {
            return new WP_Error('enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        $ended_at = self::valid_date($ended_at) ?: current_time('Y-m-d');
        $active = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tables['occupancies']} WHERE enclosure_id = %d AND animal_id = %d AND ended_at IS NULL ORDER BY id DESC LIMIT 1",
            absint($enclosure_id), absint($animal_id)
        ), ARRAY_A);
        if (!$active) {
            return new WP_Error('occupancy_not_found', 'この容器に入居している個体ではありません。', array('status' => 404));
        }
        $wpdb->update($tables['occupancies'], array('ended_at' => $ended_at, 'note' => sanitize_textarea_field($note), 'updated_at' => current_time('mysql')), array('id' => (int) $active['id']));
        delete_post_meta(absint($animal_id), '_setae_spider_enclosure_id');
        delete_post_meta(absint($animal_id), '_setae_spider_enclosure');
        self::insert_system_event($user_id, $enclosure_id, 'animal_move_out', $ended_at, absint($animal_id), $note);
        return self::get_for_user($user_id, $enclosure_id);
    }

    public static function get_active_enclosure_map($animal_ids, $user_id)
    {
        global $wpdb;
        $tables = self::tables();
        $ids = array_values(array_filter(array_map('absint', (array) $animal_ids)));
        if (!$ids) {
            return array();
        }
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $args = array_merge(array(absint($user_id)), $ids);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT o.animal_id, e.id, e.code, e.name, e.enclosure_type, e.location
             FROM {$tables['occupancies']} o
             INNER JOIN {$tables['enclosures']} e ON e.id = o.enclosure_id
             WHERE e.user_id = %d AND o.animal_id IN ($placeholders) AND o.ended_at IS NULL",
            $args
        ), ARRAY_A);
        $map = array();
        foreach ($rows ?: array() as $row) {
            $animal_id = (int) $row['animal_id'];
            unset($row['animal_id']);
            $row['id'] = (int) $row['id'];
            $map[$animal_id] = $row;
        }
        return $map;
    }

    public static function get_animal_housing($user_id, $animal_id)
    {
        global $wpdb;
        $tables = self::tables();
        $user_id = absint($user_id);
        $animal_id = absint($animal_id);
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT o.*, e.code, e.name, e.enclosure_type, e.location
             FROM {$tables['occupancies']} o
             INNER JOIN {$tables['enclosures']} e ON e.id = o.enclosure_id
             WHERE e.user_id = %d AND o.animal_id = %d
             ORDER BY o.started_at DESC, o.id DESC",
            $user_id,
            $animal_id
        ), ARRAY_A);
        $history = array();
        $current = null;
        foreach ($rows ?: array() as $row) {
            $entry = array(
                'occupancy_id' => (int) $row['id'],
                'enclosure_id' => (int) $row['enclosure_id'],
                'enclosure_code' => sanitize_text_field($row['code']),
                'enclosure_name' => sanitize_text_field($row['name']),
                'enclosure_type' => sanitize_key($row['enclosure_type']),
                'location' => sanitize_text_field($row['location']),
                'started_at' => sanitize_text_field($row['started_at']),
                'ended_at' => sanitize_text_field($row['ended_at']),
                'note' => sanitize_textarea_field($row['note']),
            );
            $history[] = $entry;
            if (!$current && empty($row['ended_at'])) {
                $current = self::get_for_user($user_id, (int) $row['enclosure_id']);
            }
        }
        return array('current' => $current, 'history' => $history);
    }

    public static function recent_events_for_user($user_id, $limit = 50, $offset = 0, $type = '')
    {
        global $wpdb;
        $tables = self::tables();
        $limit = max(1, min(200, absint($limit)));
        $offset = max(0, absint($offset));
        $type = sanitize_key($type);
        $allowed = array('environment_check', 'maintenance', 'watering', 'misting', 'substrate_change', 'note', 'animal_move_in', 'animal_move_out');
        if ($type && !in_array($type, $allowed, true)) {
            return array('items' => array(), 'total' => 0);
        }
        $where = 'ev.user_id = %d';
        $args = array(absint($user_id));
        if ($type) {
            $where .= ' AND ev.event_type = %s';
            $args[] = $type;
        }
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$tables['events']} ev WHERE $where",
            $args
        ));
        $query_args = array_merge($args, array($limit, $offset));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT ev.*, e.code AS enclosure_code, e.name AS enclosure_name, e.location AS enclosure_location
             FROM {$tables['events']} ev
             INNER JOIN {$tables['enclosures']} e ON e.id = ev.enclosure_id
             WHERE $where
             ORDER BY ev.event_date DESC, ev.id DESC
             LIMIT %d OFFSET %d",
            $query_args
        ), ARRAY_A);
        $items = array();
        foreach ($rows ?: array() as $row) {
            $event = self::hydrate_event($row);
            $event['enclosure_id'] = (int) $row['enclosure_id'];
            $event['type'] = $event['event_type'];
            $event['date'] = $event['event_date'];
            $items[] = array(
                'target_type' => 'enclosure',
                'target_id' => (int) $row['enclosure_id'],
                'enclosure_id' => (int) $row['enclosure_id'],
                'enclosure' => array(
                    'id' => (int) $row['enclosure_id'],
                    'code' => sanitize_text_field($row['enclosure_code']),
                    'name' => sanitize_text_field($row['enclosure_name']),
                    'location' => sanitize_text_field($row['enclosure_location']),
                ),
                'event' => $event,
            );
        }
        return array('items' => $items, 'total' => $count);
    }

    private static function hydrate($row, $full = false)
    {
        $id = (int) $row['id'];
        $result = array(
            'id' => $id,
            'code' => sanitize_text_field($row['code']),
            'name' => sanitize_text_field($row['name']),
            'enclosure_type' => sanitize_key($row['enclosure_type']),
            'type_label' => self::type_label($row['enclosure_type']),
            'width_mm' => self::numeric_output($row['width_mm']),
            'depth_mm' => self::numeric_output($row['depth_mm']),
            'height_mm' => self::numeric_output($row['height_mm']),
            'location' => sanitize_text_field($row['location']),
            'target_temp_min' => self::numeric_output($row['target_temp_min']),
            'target_temp_max' => self::numeric_output($row['target_temp_max']),
            'target_humidity_min' => self::numeric_output($row['target_humidity_min']),
            'target_humidity_max' => self::numeric_output($row['target_humidity_max']),
            'substrate' => sanitize_text_field($row['substrate']),
            'substrate_depth_mm' => self::numeric_output($row['substrate_depth_mm']),
            'photo_url' => esc_url_raw($row['photo_url']),
            'environment_interval_days' => max(1, (int) $row['environment_interval_days']),
            'maintenance_interval_days' => max(1, (int) $row['maintenance_interval_days']),
            'status' => sanitize_key($row['status']),
            'created_at' => sanitize_text_field($row['created_at']),
            'updated_at' => sanitize_text_field($row['updated_at']),
        );
        $result['dimensions_label'] = self::dimensions_label($result);
        $result['occupants'] = self::occupants($id, true);
        $result['occupant_count'] = count($result['occupants']);
        $events = self::events($id, $full ? 100 : 8);
        $result['events'] = $events;
        $result['last_environment'] = self::latest_event($id, array('environment_check'));
        $result['last_maintenance'] = self::latest_event($id, array('maintenance', 'substrate_change'));
        $result['care'] = self::care_status($result);
        if ($full) {
            $result['occupancy_history'] = self::occupants($id, false);
        }
        return $result;
    }

    private static function occupants($enclosure_id, $active_only)
    {
        global $wpdb;
        $tables = self::tables();
        $where = $active_only ? ' AND o.ended_at IS NULL' : '';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT o.* FROM {$tables['occupancies']} o WHERE o.enclosure_id = %d$where ORDER BY o.started_at DESC, o.id DESC",
            absint($enclosure_id)
        ), ARRAY_A);
        $items = array();
        foreach ($rows ?: array() as $row) {
            $animal = get_post((int) $row['animal_id']);
            if (!$animal || $animal->post_type !== 'setae_spider') {
                continue;
            }
            $species_id = absint(get_post_meta($animal->ID, '_setae_species_id', true));
            $species = $species_id ? get_the_title($species_id) : get_post_meta($animal->ID, '_setae_custom_species_name', true);
            $items[] = array(
                'occupancy_id' => (int) $row['id'],
                'animal_id' => (int) $animal->ID,
                'animal_code' => wp_strip_all_tags($animal->post_title),
                'species_name' => wp_strip_all_tags($species ?: '種類不明'),
                'started_at' => sanitize_text_field($row['started_at']),
                'ended_at' => sanitize_text_field($row['ended_at']),
                'note' => sanitize_textarea_field($row['note']),
            );
        }
        return $items;
    }

    private static function events($enclosure_id, $limit)
    {
        global $wpdb;
        $tables = self::tables();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$tables['events']} WHERE enclosure_id = %d ORDER BY event_date DESC, id DESC LIMIT %d",
            absint($enclosure_id), max(1, min(200, absint($limit)))
        ), ARRAY_A);
        return array_map(array(__CLASS__, 'hydrate_event'), $rows ?: array());
    }

    private static function latest_event($enclosure_id, $types)
    {
        global $wpdb;
        $tables = self::tables();
        $types = array_values(array_filter(array_map('sanitize_key', (array) $types)));
        if (!$types) {
            return null;
        }
        $placeholders = implode(',', array_fill(0, count($types), '%s'));
        $args = array_merge(array(absint($enclosure_id)), $types);
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$tables['events']} WHERE enclosure_id = %d AND event_type IN ($placeholders) ORDER BY event_date DESC, id DESC LIMIT 1",
            $args
        ), ARRAY_A);
        return $row ? self::hydrate_event($row) : null;
    }

    private static function hydrate_event($row)
    {
        $animal = !empty($row['animal_id']) ? get_post((int) $row['animal_id']) : null;
        return array(
            'id' => (int) $row['id'],
            'event_type' => sanitize_key($row['event_type']),
            'event_label' => self::event_label($row['event_type']),
            'event_date' => sanitize_text_field($row['event_date']),
            'temperature' => self::numeric_output($row['temperature']),
            'humidity' => self::numeric_output($row['humidity']),
            'note' => sanitize_textarea_field($row['note']),
            'animal_id' => !empty($row['animal_id']) ? (int) $row['animal_id'] : null,
            'animal_code' => $animal ? wp_strip_all_tags($animal->post_title) : '',
        );
    }

    private static function care_status($enclosure)
    {
        $today = new DateTimeImmutable(current_time('Y-m-d'));
        $environment_date = !empty($enclosure['last_environment']['event_date']) ? $enclosure['last_environment']['event_date'] : $enclosure['created_at'];
        $maintenance_date = !empty($enclosure['last_maintenance']['event_date']) ? $enclosure['last_maintenance']['event_date'] : $enclosure['created_at'];
        $environment_due = (new DateTimeImmutable(substr($environment_date, 0, 10)))->modify('+' . $enclosure['environment_interval_days'] . ' days');
        $maintenance_due = (new DateTimeImmutable(substr($maintenance_date, 0, 10)))->modify('+' . $enclosure['maintenance_interval_days'] . ' days');
        return array(
            'environment_due_at' => $environment_due->format('Y-m-d'),
            'environment_due' => $environment_due <= $today,
            'maintenance_due_at' => $maintenance_due->format('Y-m-d'),
            'maintenance_due' => $maintenance_due <= $today,
        );
    }

    private static function insert_system_event($user_id, $enclosure_id, $type, $date, $animal_id, $note)
    {
        global $wpdb;
        $tables = self::tables();
        $wpdb->insert($tables['events'], array(
            'enclosure_id' => absint($enclosure_id),
            'user_id' => absint($user_id),
            'animal_id' => absint($animal_id),
            'event_type' => sanitize_key($type),
            'event_date' => self::valid_date($date) ?: current_time('Y-m-d'),
            'temperature' => null,
            'humidity' => null,
            'note' => sanitize_textarea_field($note),
            'created_at' => current_time('mysql'),
        ));
    }

    private static function sanitize_record($data)
    {
        $status = isset($data['status']) && $data['status'] === 'archived' ? 'archived' : 'active';
        return array(
            'name' => mb_substr(sanitize_text_field(isset($data['name']) ? $data['name'] : ''), 0, 120),
            'enclosure_type' => self::valid_type(isset($data['enclosure_type']) ? $data['enclosure_type'] : 'unspecified'),
            'width_mm' => self::decimal(isset($data['width_mm']) ? $data['width_mm'] : null, 0, 100000),
            'depth_mm' => self::decimal(isset($data['depth_mm']) ? $data['depth_mm'] : null, 0, 100000),
            'height_mm' => self::decimal(isset($data['height_mm']) ? $data['height_mm'] : null, 0, 100000),
            'location' => mb_substr(sanitize_text_field(isset($data['location']) ? $data['location'] : ''), 0, 180),
            'target_temp_min' => self::decimal(isset($data['target_temp_min']) ? $data['target_temp_min'] : null, -20, 80),
            'target_temp_max' => self::decimal(isset($data['target_temp_max']) ? $data['target_temp_max'] : null, -20, 80),
            'target_humidity_min' => self::decimal(isset($data['target_humidity_min']) ? $data['target_humidity_min'] : null, 0, 100),
            'target_humidity_max' => self::decimal(isset($data['target_humidity_max']) ? $data['target_humidity_max'] : null, 0, 100),
            'substrate' => mb_substr(sanitize_text_field(isset($data['substrate']) ? $data['substrate'] : ''), 0, 180),
            'substrate_depth_mm' => self::decimal(isset($data['substrate_depth_mm']) ? $data['substrate_depth_mm'] : null, 0, 10000),
            'photo_url' => esc_url_raw(isset($data['photo_url']) ? $data['photo_url'] : ''),
            'environment_interval_days' => max(1, min(365, absint(isset($data['environment_interval_days']) ? $data['environment_interval_days'] : 1))),
            'maintenance_interval_days' => max(1, min(365, absint(isset($data['maintenance_interval_days']) ? $data['maintenance_interval_days'] : 14))),
            'status' => $status,
        );
    }

    private static function validate_record($record)
    {
        if ($record['target_temp_min'] !== null && $record['target_temp_max'] !== null && $record['target_temp_min'] > $record['target_temp_max']) {
            return new WP_Error('invalid_temperature_range', '目標温度の下限は上限以下にしてください。', array('status' => 400));
        }
        if ($record['target_humidity_min'] !== null && $record['target_humidity_max'] !== null && $record['target_humidity_min'] > $record['target_humidity_max']) {
            return new WP_Error('invalid_humidity_range', '目標湿度の下限は上限以下にしてください。', array('status' => 400));
        }
        return true;
    }

    private static function find_by_code_or_name($user_id, $value, $code_only = false)
    {
        global $wpdb;
        $tables = self::tables();
        $value = sanitize_text_field($value);
        $sql = $code_only
            ? "SELECT * FROM {$tables['enclosures']} WHERE user_id = %d AND code = %s LIMIT 1"
            : "SELECT * FROM {$tables['enclosures']} WHERE user_id = %d AND (code = %s OR name = %s) LIMIT 1";
        $args = $code_only ? array(absint($user_id), self::normalize_code($value)) : array(absint($user_id), self::normalize_code($value), $value);
        $row = $wpdb->get_row($wpdb->prepare($sql, $args), ARRAY_A);
        return $row ? self::hydrate($row) : null;
    }

    private static function next_code($user_id)
    {
        global $wpdb;
        $tables = self::tables();
        $codes = $wpdb->get_col($wpdb->prepare("SELECT code FROM {$tables['enclosures']} WHERE user_id = %d", absint($user_id)));
        $used = array_fill_keys($codes ?: array(), true);
        for ($index = 1; $index < 100000; $index++) {
            $code = 'E' . str_pad((string) $index, 3, '0', STR_PAD_LEFT);
            if (!isset($used[$code])) {
                return $code;
            }
        }
        return 'E' . time();
    }

    private static function legacy_code($user_id, $name)
    {
        $candidate = self::normalize_code($name);
        if ($candidate && !self::find_by_code_or_name($user_id, $candidate, true)) {
            return $candidate;
        }
        return self::next_code($user_id);
    }

    private static function normalize_code($value)
    {
        $code = strtoupper(trim((string) $value));
        $code = preg_replace('/[^A-Z0-9_-]+/', '-', $code);
        return trim(mb_substr($code, 0, 50), '-_');
    }

    private static function valid_type($value)
    {
        $value = sanitize_key($value);
        $allowed = array('acrylic', 'glass', 'plastic', 'terrarium', 'vial', 'rack_tub', 'custom', 'unspecified');
        return in_array($value, $allowed, true) ? $value : 'unspecified';
    }

    private static function type_label($value)
    {
        $labels = array('acrylic' => 'アクリル容器', 'glass' => 'ガラス容器', 'plastic' => 'プラケース', 'terrarium' => 'テラリウム', 'vial' => 'バイアル', 'rack_tub' => 'ラックケース', 'custom' => 'カスタム容器', 'unspecified' => '種類未設定');
        return isset($labels[$value]) ? $labels[$value] : '種類未設定';
    }

    private static function event_label($value)
    {
        $labels = array('environment_check' => '環境確認', 'maintenance' => 'メンテナンス', 'watering' => '給水', 'misting' => '霧吹き', 'substrate_change' => '床材交換', 'note' => 'メモ', 'animal_move_in' => '入居', 'animal_move_out' => '退居');
        return isset($labels[$value]) ? $labels[$value] : $value;
    }

    private static function decimal($value, $min, $max)
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value)) {
            return null;
        }
        $number = (float) $value;
        return ($number >= $min && $number <= $max) ? round($number, 2) : null;
    }

    private static function numeric_output($value)
    {
        if ($value === null || $value === '') {
            return null;
        }
        $number = (float) $value;
        return floor($number) == $number ? (int) $number : $number;
    }

    private static function valid_date($value)
    {
        $value = sanitize_text_field($value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return '';
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date && $date->format('Y-m-d') === $value ? $value : '';
    }

    private static function dimensions_label($data)
    {
        $values = array($data['width_mm'], $data['depth_mm'], $data['height_mm']);
        if (count(array_filter($values, function ($value) { return $value !== null; })) !== 3) {
            return '寸法未設定';
        }
        return implode(' × ', array_map(function ($value) {
            $cm = $value / 10;
            return floor($cm) == $cm ? (string) (int) $cm : number_format($cm, 1, '.', '');
        }, $values)) . ' cm';
    }

}
