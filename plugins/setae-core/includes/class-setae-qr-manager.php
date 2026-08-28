<?php

/**
 * Shared data layer for QR labels, scanner records, and ownership transfers.
 */
class Setae_QR_Manager
{
    const TARGET_POST_TYPE = 'setae_qr_target';
    const TRANSFER_POST_TYPE = 'setae_transfer';
    const CODE_META = '_setae_qr_code';
    const TARGET_ID_META = '_setae_qr_target_id';
    const PUBLIC_META = '_setae_qr_public';
    const PUBLIC_MODE_META = '_setae_qr_public_mode';
    const TRANSFER_ENABLED_META = '_setae_transfer_enabled';
    const NOTIFICATION_META = '_setae_qr_notifications';
    const PENDING_CLAIM_META = '_setae_pending_qr_claim';
    const PENDING_CLAIM_INTENT_META = '_setae_pending_qr_claim_intent';

    private static $alphabet = '23456789abcdefghjkmnpqrstuvwxyz';

    /** Join an enclosing business transaction without opening a nested transaction. */
    private static function track_transaction_post($post_id)
    {
        if (method_exists('Setae_Entitlements', 'track_transaction_post')) {
            Setae_Entitlements::track_transaction_post(absint($post_id));
        }
    }

    private static function write_post_meta_checked($post_id, array $values)
    {
        return !is_wp_error(Setae_Entitlements::save_post_meta_checked($post_id, $values));
    }

    private static function clear_post_meta_checked($post_id, array $keys)
    {
        self::track_transaction_post($post_id);
        foreach ($keys as $key) { delete_post_meta($post_id, $key); }
        wp_cache_delete($post_id, 'post_meta');
        foreach ($keys as $key) { if (metadata_exists('post', $post_id, $key)) { return false; } }
        return true;
    }

    public function register_post_types()
    {
        register_post_type(self::TARGET_POST_TYPE, array(
            'labels' => array('name' => 'QR Targets', 'singular_name' => 'QR Target'),
            'public' => false,
            'show_ui' => false,
            'show_in_rest' => false,
            'supports' => array('title', 'author', 'custom-fields'),
        ));

        register_post_type(self::TRANSFER_POST_TYPE, array(
            'labels' => array('name' => 'QR Transfers', 'singular_name' => 'QR Transfer'),
            'public' => false,
            'show_ui' => false,
            'show_in_rest' => false,
            'supports' => array('title', 'author', 'custom-fields'),
        ));
    }

    public function cleanup_deleted_post($post_id)
    {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }

        if ($post->post_type === 'setae_spider') {
            $target_id = absint(get_post_meta($post_id, self::TARGET_ID_META, true));
            if ($target_id) {
                self::cancel_pending_transfers($target_id, 0, '個体の管理が終了したため、引き継ぎ申請は終了しました。');
                wp_delete_post($target_id, true);
            }
        }

        if ($post->post_type === 'setae_baby_group') {
            $target_map = get_post_meta($post_id, '_setae_baby_qr_targets', true);
            foreach ((array) $target_map as $target_id) {
                if ($target_id) {
                    wp_delete_post(absint($target_id), true);
                }
            }
        }
    }

    public static function ensure_spider_target($spider_id)
    {
        $spider_id = absint($spider_id);
        $spider = get_post($spider_id);
        if (!$spider || $spider->post_type !== 'setae_spider') {
            return new WP_Error('qr_spider_not_found', '個体が見つかりません。', array('status' => 404));
        }

        $target_id = absint(get_post_meta($spider_id, self::TARGET_ID_META, true));
        $target = $target_id ? get_post($target_id) : null;
        if ($target && $target->post_type === self::TARGET_POST_TYPE) {
            return self::sync_target_owner($target_id, (int) $spider->post_author);
        }

        $target = self::create_target('spider', $spider_id, '', (int) $spider->post_author);
        if (is_wp_error($target)) {
            return $target;
        }

        if (!self::write_post_meta_checked($spider_id, array(self::TARGET_ID_META => $target->ID, self::CODE_META => $target->post_name))) {
            return new WP_Error('qr_target_link_failed', '個体とQRの対応を保存できませんでした。', array('status' => 503));
        }
        return $target;
    }

    public static function ensure_baby_target($group_id, $baby_code)
    {
        $group_id = absint($group_id);
        $group = get_post($group_id);
        if (!$group || $group->post_type !== 'setae_baby_group') {
            return new WP_Error('qr_group_not_found', 'ベビー群が見つかりません。', array('status' => 404));
        }

        $baby_code = self::normalize_baby_code($group_id, $baby_code);
        if (!$baby_code) {
            return new WP_Error('qr_baby_not_found', 'ベビー番号が見つかりません。', array('status' => 404));
        }

        $target_map = get_post_meta($group_id, '_setae_baby_qr_targets', true);
        $target_map = is_array($target_map) ? $target_map : array();
        $target_id = isset($target_map[$baby_code]) ? absint($target_map[$baby_code]) : 0;
        $target = $target_id ? get_post($target_id) : null;

        if ($target && $target->post_type === self::TARGET_POST_TYPE) {
            return self::sync_target_owner($target_id, (int) $group->post_author);
        }

        $target = self::create_target('baby', $group_id, $baby_code, (int) $group->post_author);
        if (is_wp_error($target)) {
            return $target;
        }

        $target_map[$baby_code] = $target->ID;
        if (!self::write_post_meta_checked($group_id, array('_setae_baby_qr_targets' => $target_map))) {
            return new WP_Error('qr_target_link_failed', 'ベビーとQRの対応を保存できませんでした。', array('status' => 503));
        }
        return $target;
    }

    public static function ensure_enclosure_target($enclosure_id, $user_id)
    {
        $enclosure_id = absint($enclosure_id);
        $user_id = absint($user_id);
        if (!class_exists('Setae_Enclosures') || !Setae_Enclosures::get_for_user($user_id, $enclosure_id)) {
            return new WP_Error('qr_enclosure_not_found', '飼育容器が見つかりません。', array('status' => 404));
        }
        $targets = get_posts(array(
            'post_type' => self::TARGET_POST_TYPE,
            'post_status' => array('private', 'publish'),
            'author' => $user_id,
            'posts_per_page' => 1,
            'fields' => 'ids',
            'meta_query' => array(
                'relation' => 'AND',
                array('key' => '_setae_qr_target_type', 'value' => 'enclosure', 'compare' => '='),
                array('key' => '_setae_qr_object_id', 'value' => $enclosure_id, 'compare' => '=', 'type' => 'NUMERIC'),
            ),
        ));
        if ($targets) {
            $target = get_post((int) $targets[0]);
            return self::sync_target_owner($target->ID, $user_id);
        }
        return self::create_target('enclosure', $enclosure_id, '', $user_id);
    }

    private static function create_target($type, $object_id, $baby_code, $owner_id)
    {
        for ($attempt = 0; $attempt < 80; $attempt++) {
            $length = $attempt < 64 ? 6 : ($attempt < 76 ? 7 : 8);
            $code = self::random_code($length);
            if (self::get_target_by_code($code) || self::code_conflicts_with_site($code)) {
                continue;
            }

            $target_id = wp_insert_post(array(
                'post_type' => self::TARGET_POST_TYPE,
                'post_status' => 'private',
                'post_title' => $code,
                'post_name' => $code,
                'post_author' => absint($owner_id),
            ), true);

            if (is_wp_error($target_id)) {
                return $target_id;
            }
            if (!$target_id) {
                continue;
            }
            self::track_transaction_post($target_id);

            $saved_code = get_post_field('post_name', $target_id);
            if ($saved_code !== $code) {
                wp_delete_post($target_id, true);
                continue;
            }

            if (!self::write_post_meta_checked($target_id, array(
                '_setae_qr_target_type' => $type,
                '_setae_qr_object_id' => absint($object_id),
                '_setae_qr_baby_code' => sanitize_text_field($baby_code),
                '_setae_qr_created_at' => current_time('mysql'),
            ))) {
                wp_delete_post($target_id, true);
                return new WP_Error('qr_target_save_failed', 'QRの対応情報を保存できませんでした。', array('status' => 503));
            }
            return get_post($target_id);
        }

        return new WP_Error('qr_code_exhausted', '短縮コードを発行できませんでした。もう一度お試しください。', array('status' => 500));
    }

    private static function random_code($length)
    {
        $code = '';
        $max = strlen(self::$alphabet) - 1;
        for ($index = 0; $index < $length; $index++) {
            $code .= self::$alphabet[random_int(0, $max)];
        }
        return $code;
    }

    private static function code_conflicts_with_site($code)
    {
        $public_types = get_post_types(array('public' => true), 'names');
        if (!$public_types) {
            return false;
        }
        return (bool) get_page_by_path($code, OBJECT, array_values($public_types));
    }

    public static function sanitize_code($value)
    {
        $code = strtolower(trim((string) $value));
        return preg_match('/^[23456789abcdefghjkmnpqrstuvwxyz]{4,8}$/', $code) ? $code : '';
    }

    public static function get_target_by_code($code)
    {
        $code = self::sanitize_code($code);
        if (!$code) {
            return null;
        }

        $target = get_page_by_path($code, OBJECT, self::TARGET_POST_TYPE);
        return ($target && $target->post_type === self::TARGET_POST_TYPE) ? $target : null;
    }

    public static function get_short_url($code)
    {
        $code = self::sanitize_code($code);
        if (!$code) {
            return '';
        }

        if (get_option('permalink_structure')) {
            return home_url('/' . rawurlencode($code) . '/');
        }
        return add_query_arg('setae_qr', $code, home_url('/'));
    }

    public static function get_target_label_data($target)
    {
        if (!$target || $target->post_type !== self::TARGET_POST_TYPE) {
            return null;
        }

        $type = get_post_meta($target->ID, '_setae_qr_target_type', true);
        $object_id = absint(get_post_meta($target->ID, '_setae_qr_object_id', true));
        $baby_code = sanitize_text_field(get_post_meta($target->ID, '_setae_qr_baby_code', true));

        if ($type === 'spider') {
            $spider = get_post($object_id);
            if (!$spider || $spider->post_type !== 'setae_spider') {
                return null;
            }
            $species = self::get_spider_species_name($object_id);
            $classification = self::get_spider_classification($object_id);
            $image = esc_url_raw(get_post_meta($object_id, '_setae_spider_image', true));
            $image_source = $image ? 'individual' : 'none';
            if (!$image) {
                $species_id = absint(get_post_meta($object_id, '_setae_species_id', true));
                $image = $species_id ? esc_url_raw(get_the_post_thumbnail_url($species_id, 'thumbnail')) : '';
                $image_source = $image ? 'species' : 'none';
            }

            return array(
                'target_id' => (int) $target->ID,
                'target_type' => 'spider',
                'object_id' => $object_id,
                'baby_code' => '',
                'code' => $target->post_name,
                'url' => self::get_short_url($target->post_name),
                'title' => get_the_title($object_id),
                'species_name' => $species,
                'short_name' => self::abbreviate_species($species, $classification),
                'manage_code' => self::build_manage_code(get_the_title($object_id), $object_id, ''),
                'management_start_date' => self::get_management_start_date($object_id),
                'birth_date' => self::get_spider_origin_birth_date($object_id),
                'classification' => $classification,
                'status' => sanitize_key(get_post_meta($object_id, '_setae_status', true) ?: 'normal'),
                'image' => $image,
                'image_source' => $image_source,
                'archived' => (bool) get_post_meta($object_id, '_setae_spider_archived', true),
                'transfer_receipt' => get_post_meta($object_id, '_setae_transfer_receipt', true) === '1',
                'visibility' => self::get_spider_public_mode($object_id),
                'public' => self::get_spider_public_mode($object_id) !== 'private',
                'transfer_enabled' => get_post_meta($object_id, self::TRANSFER_ENABLED_META, true) === '1',
            );
        }

        if ($type === 'baby') {
            $group = get_post($object_id);
            if (!$group || $group->post_type !== 'setae_baby_group') {
                return null;
            }
            $item = self::get_baby_item($object_id, $baby_code);
            if (!$item) {
                return null;
            }
            $species = sanitize_text_field(get_post_meta($object_id, '_setae_baby_species_name', true));
            $species_id = absint(get_post_meta($object_id, '_setae_baby_species_id', true));
            $image = $species_id ? esc_url_raw(get_the_post_thumbnail_url($species_id, 'thumbnail')) : '';

            return array(
                'target_id' => (int) $target->ID,
                'target_type' => 'baby',
                'object_id' => $object_id,
                'baby_code' => $baby_code,
                'code' => $target->post_name,
                'url' => self::get_short_url($target->post_name),
                'title' => get_the_title($object_id),
                'species_name' => $species,
                'short_name' => self::abbreviate_species($species, 'tarantula'),
                'manage_code' => self::build_manage_code('', $object_id, $baby_code),
                'management_start_date' => self::get_management_start_date($object_id),
                'birth_date' => self::normalize_label_date(get_post_meta($object_id, '_setae_baby_birth_date', true)),
                'classification' => 'tarantula',
                'status' => $item['status'],
                'image' => $image,
                'image_source' => $image ? 'species' : 'none',
                'archived' => get_post_meta($object_id, '_setae_baby_archived', true) === '1',
                'public' => false,
                'transfer_enabled' => false,
            );
        }

        if ($type === 'enclosure' && class_exists('Setae_Enclosures')) {
            $enclosure = Setae_Enclosures::get_for_user((int) $target->post_author, $object_id);
            if (!$enclosure) {
                return null;
            }
            return array(
                'target_id' => (int) $target->ID,
                'target_type' => 'enclosure',
                'object_id' => $object_id,
                'enclosure_id' => $object_id,
                'baby_code' => '',
                'code' => $target->post_name,
                'url' => self::get_short_url($target->post_name),
                'title' => $enclosure['code'],
                'species_name' => $enclosure['name'] ?: $enclosure['type_label'],
                'short_name' => $enclosure['type_label'],
                'manage_code' => $enclosure['code'],
                'management_start_date' => self::normalize_label_date($enclosure['created_at']),
                'birth_date' => '',
                'classification' => 'enclosure',
                'status' => $enclosure['status'],
                'image' => $enclosure['photo_url'],
                'image_source' => $enclosure['photo_url'] ? 'enclosure' : 'none',
                'archived' => $enclosure['status'] === 'archived',
                'public' => false,
                'transfer_enabled' => false,
                'location' => $enclosure['location'],
            );
        }

        return null;
    }

    public static function user_owns_target($target, $user_id)
    {
        if (!$target || !$user_id) {
            return false;
        }
        return (int) $target->post_author === absint($user_id) || user_can($user_id, 'manage_options');
    }

    public static function update_spider_settings($spider_id, $user_id, $public, $transfer_enabled, $visibility = '')
    {
        // Preserve the existing full-settings API, including its legacy public
        // boolean fallback. Individual editing uses the sparse patch API below.
        return self::apply_spider_settings_patch($spider_id, $user_id, array(
            'qr_visibility' => self::normalize_public_mode($visibility, $public),
            'transfer_enabled' => filter_var($transfer_enabled, FILTER_VALIDATE_BOOLEAN),
        ));
    }

    /** Validate without generating a QR target or changing any public state. */
    public static function prepare_spider_settings_patch($spider_id, $user_id, array $changes, $final_archived = null)
    {
        $spider = get_post(absint($spider_id));
        if (!$spider || $spider->post_type !== 'setae_spider') {
            return new WP_Error('qr_spider_not_found', '個体が見つかりません。', array('status' => 404));
        }
        if ((int) $spider->post_author !== absint($user_id) && !user_can($user_id, 'manage_options')) {
            return new WP_Error('qr_forbidden', 'この個体の設定は変更できません。', array('status' => 403));
        }
        if (get_post_meta($spider->ID, '_setae_transfer_receipt', true) === '1') {
            return new WP_Error('qr_transfer_receipt', '譲渡済みアーカイブのQR設定は変更できません。', array('status' => 400));
        }
        $patch = array();
        if (array_key_exists('qr_visibility', $changes)) {
            if (!is_string($changes['qr_visibility']) || !in_array($changes['qr_visibility'], array('private', 'basic', 'life_history'), true)) {
                return new WP_Error('qr_invalid_visibility', '公開範囲を選び直してください。', array('status' => 400));
            }
            $patch['qr_visibility'] = $changes['qr_visibility'];
        }
        if (array_key_exists('transfer_enabled', $changes)) {
            $value = $changes['transfer_enabled'];
            if (!is_bool($value) && !in_array($value, array(0, 1, '0', '1'), true)) {
                return new WP_Error('qr_invalid_transfer_enabled', '引き継ぎ受付の設定が正しくありません。', array('status' => 400));
            }
            $patch['transfer_enabled'] = $value === true || $value === 1 || $value === '1';
        }
        $archived = $final_archived === null
            ? get_post_meta($spider->ID, '_setae_spider_archived', true) === '1'
            : (bool) $final_archived;
        if ($archived && !empty($patch['transfer_enabled'])) {
            return new WP_Error('qr_archived_transfer', 'アーカイブ中の個体は引き継ぎ受付を開始できません。', array('status' => 400));
        }
        // Archiving already ends reception in the ordinary edit API. Preserve
        // that rule even when only visibility was explicitly included.
        if ($final_archived === true && $patch) {
            $patch['transfer_enabled'] = false;
        }
        return $patch;
    }

    /** Commit only public settings together, after the caller's ordinary edits. */
    public static function apply_spider_settings_patch($spider_id, $user_id, array $changes)
    {
        $spider_id = absint($spider_id);
        $spider = get_post($spider_id);
        $owner_id = $spider ? absint($spider->post_author) : absint($user_id);
        return Setae_Entitlements::with_user_lock($owner_id, function () use ($spider_id, $user_id, $owner_id, $changes) {
            clean_post_cache($spider_id);
            wp_cache_delete($spider_id, 'post_meta');
            $patch = self::prepare_spider_settings_patch($spider_id, $user_id, $changes);
            if (is_wp_error($patch)) { return $patch; }
            $spider = get_post($spider_id);
            if (!$spider || (int) $spider->post_author !== $owner_id) {
                return new WP_Error('qr_settings_stale', '所有者情報が変わりました。画面を更新してください。', array('status' => 409));
            }
            if (!$patch) { return array(); }
            $saved = Setae_Entitlements::with_transaction(array($owner_id), function () use ($spider_id, $user_id, $owner_id, $patch) {
                global $wpdb;
                self::track_transaction_post($spider_id);
                $locked = $wpdb->get_var($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID = %d FOR UPDATE", $spider_id));
                if ((int) $locked !== $spider_id) {
                    return new WP_Error('qr_settings_stale', '対象の個体を確認できませんでした。', array('status' => 409));
                }
                clean_post_cache($spider_id);
                wp_cache_delete($spider_id, 'post_meta');
                $spider = get_post($spider_id);
                if (!$spider || (int) $spider->post_author !== $owner_id) {
                    return new WP_Error('qr_settings_stale', '所有者情報が変わりました。画面を更新してください。', array('status' => 409));
                }
                $patch = self::prepare_spider_settings_patch($spider_id, $user_id, $patch);
                if (is_wp_error($patch)) { return $patch; }
                $target = self::ensure_spider_target($spider_id);
                if (is_wp_error($target)) { return $target; }
                $values = $clear = $notifications = array();
                if (array_key_exists('qr_visibility', $patch)) {
                    $values[self::PUBLIC_MODE_META] = $patch['qr_visibility'];
                    if ($patch['qr_visibility'] === 'private') { $clear[] = self::PUBLIC_META; }
                    else { $values[self::PUBLIC_META] = '1'; }
                }
                if (array_key_exists('transfer_enabled', $patch)) {
                    if ($patch['transfer_enabled']) { $values[self::TRANSFER_ENABLED_META] = '1'; }
                    else { $clear[] = self::TRANSFER_ENABLED_META; }
                }
                if (!self::write_post_meta_checked($spider_id, $values) || !self::clear_post_meta_checked($spider_id, $clear)) {
                    return new WP_Error('qr_settings_save_failed', '公開・引き継ぎ設定を保存できませんでした。画面を更新して確認してください。', array('status' => 503));
                }
                if (array_key_exists('transfer_enabled', $patch) && !$patch['transfer_enabled']) {
                    $message = get_post_meta($spider_id, '_setae_spider_archived', true) === '1'
                        ? '個体がアーカイブされたため、引き継ぎ申請は終了しました。'
                        : '所有者が引き継ぎ受付を終了しました。';
                    $notifications = self::cancel_pending_transfers($target->ID, 0, $message, true);
                    if (is_wp_error($notifications)) { return $notifications; }
                }
                $label = self::get_target_label_data($target);
                if (!$label || (int) $label['object_id'] !== $spider_id
                    || (array_key_exists('qr_visibility', $patch) && $label['visibility'] !== $patch['qr_visibility'])
                    || (array_key_exists('transfer_enabled', $patch) && $label['transfer_enabled'] !== $patch['transfer_enabled'])) {
                    return new WP_Error('qr_settings_save_failed', '公開設定の保存結果を確認できませんでした。', array('status' => 503));
                }
                return array('target' => $label, 'notifications' => $notifications);
            });
            if (is_wp_error($saved)) { return $saved; }
            foreach ($saved['notifications'] as $notification) {
                self::add_notification($notification['user_id'], 'transfer_cancelled', $notification['message'], array('request_id' => $notification['request_id']));
            }
            return $saved['target'];
        });
    }

    public static function get_spider_public_mode($spider_id)
    {
        $mode = sanitize_key(get_post_meta(absint($spider_id), self::PUBLIC_MODE_META, true));
        if (in_array($mode, array('private', 'basic', 'life_history'), true)) {
            return $mode;
        }
        return get_post_meta(absint($spider_id), self::PUBLIC_META, true) === '1'
            ? 'life_history'
            : 'private';
    }

    private static function normalize_public_mode($mode, $legacy_public = false)
    {
        $mode = sanitize_key((string) $mode);
        if (in_array($mode, array('private', 'basic', 'life_history'), true)) {
            return $mode;
        }
        return filter_var($legacy_public, FILTER_VALIDATE_BOOLEAN) ? 'life_history' : 'private';
    }

    public static function disable_spider_transfer($spider_id, $message = '')
    {
        $spider_id = absint($spider_id);
        delete_post_meta($spider_id, self::TRANSFER_ENABLED_META);
        $target_id = absint(get_post_meta($spider_id, self::TARGET_ID_META, true));
        if ($target_id) {
            self::cancel_pending_transfers(
                $target_id,
                0,
                $message ?: '引き継ぎ受付が終了しました。'
            );
        }
    }

    private static function set_boolean_meta($post_id, $key, $value)
    {
        if (filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
            update_post_meta($post_id, $key, '1');
        } else {
            delete_post_meta($post_id, $key);
        }
    }

    public static function record_targets($codes, $type, $date, $note, $prey_type)
    {
        return self::record_target_batch($codes, array(array(
            'type' => $type,
            'date' => $date,
            'note' => $note,
            'prey_type' => $prey_type,
        )));
    }

    public static function record_target_batch($codes, $records)
    {
        $user_id = get_current_user_id();
        $codes = array_values(array_unique(array_filter(array_map(array(__CLASS__, 'sanitize_code'), (array) $codes))));
        if (!$codes || count($codes) > 100) {
            return new WP_Error('qr_invalid_targets', '1〜100件のQRを選択してください。', array('status' => 400));
        }

        $records = array_values((array) $records);
        if (!$records || count($records) > 20) {
            return new WP_Error('qr_invalid_record_count', '1〜20件の記録を追加してください。', array('status' => 400));
        }
        if (count($codes) * count($records) > 500) {
            return new WP_Error('qr_batch_too_large', '一度に保存できるのは合計500件までです。', array('status' => 400));
        }

        $normalized_records = array();
        foreach ($records as $record_index => $record) {
            $normalized = self::normalize_qr_record($record);
            if (is_wp_error($normalized)) {
                return $normalized;
            }
            $normalized['_index'] = (int) $record_index;
            $normalized_records[] = $normalized;
        }
        $targets = self::prepare_record_targets($codes, $user_id);
        if (is_wp_error($targets)) {
            return $targets;
        }

        $pairs = array();
        foreach ($normalized_records as $record) {
            foreach ($targets as $target_row) {
                $pairs[] = array('target' => $target_row['data'], 'record' => $record);
            }
        }
        return self::persist_record_pairs($pairs, count($targets), count($normalized_records), $user_id);
    }

    public static function record_target_entries($entries, $user_id = 0)
    {
        $user_id = absint($user_id) ?: get_current_user_id();
        $entries = array_values((array) $entries);
        if (!$entries || count($entries) > 100) {
            return new WP_Error('qr_invalid_entry_count', '1〜100件の個別記録を入力してください。', array('status' => 400));
        }

        $codes = array();
        $normalized_entries = array();
        foreach ($entries as $index => $entry) {
            if (!is_array($entry)) {
                return new WP_Error('qr_invalid_entry', '個別記録の内容を確認してください。', array('status' => 400));
            }
            $code = self::sanitize_code($entry['code'] ?? '');
            if (!$code) {
                return new WP_Error('qr_invalid_entry_code', 'すべての個別記録にQRコードが必要です。', array('status' => 400));
            }
            $record = self::normalize_qr_record($entry);
            if (is_wp_error($record)) {
                return $record;
            }
            $record['_index'] = (int) $index;
            $codes[] = $code;
            $normalized_entries[] = array('code' => $code, 'record' => $record);
        }

        $targets = self::prepare_record_targets(array_values(array_unique($codes)), $user_id);
        if (is_wp_error($targets)) {
            return $targets;
        }
        $target_map = array();
        foreach ($targets as $target_row) {
            $target_map[$target_row['data']['code']] = $target_row['data'];
        }
        $pairs = array_map(function ($entry) use ($target_map) {
            return array('target' => $target_map[$entry['code']], 'record' => $entry['record']);
        }, $normalized_entries);

        return self::persist_record_pairs($pairs, count($target_map), count($normalized_entries), $user_id);
    }

    private static function prepare_record_targets($codes, $user_id)
    {
        $targets = array();
        foreach ((array) $codes as $code) {
            $target = self::get_target_by_code($code);
            if (!$target || !self::user_owns_target($target, $user_id)) {
                return new WP_Error('qr_target_forbidden', '自分の管理対象ではないQRが含まれています。', array('status' => 403));
            }
            $data = self::get_target_label_data($target);
            if (!$data || !empty($data['archived']) || in_array($data['status'], array('dead', 'rehomed', 'transferred'), true)) {
                return new WP_Error('qr_target_inactive', '記録できないQRが含まれています。', array('status' => 400));
            }
            if ($data['target_type'] === 'enclosure') {
                return new WP_Error('qr_enclosure_record_unsupported', '飼育容器QRは容器の記録画面から記録してください。', array('status' => 400));
            }
            $targets[] = array('post' => $target, 'data' => $data);
        }
        return $targets;
    }

    private static function persist_record_pairs($pairs, $target_count, $record_count, $user_id)
    {
        usort($pairs, function ($left, $right) {
            $date_order = strcmp($left['record']['date'], $right['record']['date']);
            return $date_order !== 0 ? $date_order : ($left['record']['_index'] <=> $right['record']['_index']);
        });

        $result = Setae_Entitlements::with_user_lock($user_id, function () use ($pairs, $target_count, $record_count, $user_id) {
            // A QR can be promoted or transferred while this request waits for its lock.
            $codes = array();
            foreach ($pairs as $pair) {
                $data = $pair['target'];
                $codes[$data['code']] = true;
                foreach (array($data['target_id'], $data['object_id']) as $id) {
                    clean_post_cache($id);
                    wp_cache_delete($id, 'post_meta');
                }
            }
            $fresh = self::prepare_record_targets(array_keys($codes), $user_id);
            if (is_wp_error($fresh)) { return $fresh; }
            $targets = array();
            foreach ($fresh as $row) { $targets[$row['data']['code']] = $row['data']; }
            foreach ($pairs as $pair) {
                $old = $pair['target'];
                $current = $targets[$old['code']];
                foreach (array('target_type', 'object_id', 'baby_code') as $key) {
                    if ((string) ($old[$key] ?? '') !== (string) ($current[$key] ?? '')) {
                        return new WP_Error('qr_target_changed', '管理対象が更新されました。QRを読み直してから記録してください。', array('status' => 409));
                    }
                }
            }
            return Setae_Entitlements::with_transaction(array($user_id), function () use ($pairs, $targets, $target_count, $record_count, $user_id) {
                $created = array();
                $baby_updates = array();
                $record_dates = array();
                foreach ($pairs as $pair) {
                    $data = $targets[$pair['target']['code']];
                    $record = $pair['record'];
                    $type = $record['type'];
                    $date = $record['date'];
                    $note = $record['note'];
                    $prey_type = $record['prey_type'];
                    $record_dates[$date] = true;

                    if ($data['target_type'] === 'spider') {
                        $log_id = self::create_spider_log($data['object_id'], $user_id, $type, $date, $note, $prey_type);
                        if (is_wp_error($log_id)) {
                            return $log_id;
                        }
                        $created[] = array('code' => $data['code'], 'target_type' => 'spider', 'log_id' => (int) $log_id, 'type' => $type, 'date' => $date);
                        continue;
                    }

                    $group_id = (int) $data['object_id'];
                    if (!isset($baby_updates[$group_id])) {
                        $changes = get_post_meta($group_id, '_setae_baby_items', true);
                        $baby_updates[$group_id] = is_array($changes) ? $changes : array();
                    }
                    self::apply_baby_record($baby_updates[$group_id], $data['baby_code'], $type, $date, $note, $prey_type);
                    $created[] = array('code' => $data['code'], 'target_type' => 'baby', 'baby_code' => $data['baby_code'], 'type' => $type, 'date' => $date);
                }

                foreach ($baby_updates as $group_id => $changes) {
                    if (!self::write_post_meta_checked($group_id, array('_setae_baby_items' => $changes))) {
                        return new WP_Error('qr_baby_record_failed', 'ベビーの記録を保存できませんでした。', array('status' => 503));
                    }
                }
                return array('created' => $created, 'count' => count($created), 'target_count' => (int) $target_count, 'record_count' => (int) $record_count, '_record_dates' => array_keys($record_dates));
            });
        });
        if (is_wp_error($result)) { return $result; }
        foreach ($result['_record_dates'] as $record_date) { self::touch_daily_streak($user_id, $record_date); }
        unset($result['_record_dates']);
        foreach ($result['created'] as $record) {
            $object_id = 0;
            foreach ($pairs as $pair) {
                if ($pair['target']['code'] === $record['code']) { $object_id = (int) $pair['target']['object_id']; break; }
            }
            $properties = array('record_type' => $record['type']);
            if (isset($record['log_id'])) { $properties['record_id'] = $record['log_id']; }
            Setae_Entitlements::record_event('first_record_created', array(
                'idempotency_key' => 'first-record:' . $user_id,
                'user_id' => $user_id,
                'object_type' => $record['target_type'] === 'spider' ? 'spider' : 'baby_group',
                'object_id' => $object_id,
                'acquisition_source' => 'qr',
                'properties' => $properties,
            ));
            break;
        }
        return $result;
    }

    private static function normalize_qr_record($record)
    {
        if (!is_array($record)) {
            return new WP_Error('qr_invalid_record', '記録内容を確認してください。', array('status' => 400));
        }
        foreach (array('type', 'date', 'note', 'prey_type') as $field) {
            if (isset($record[$field]) && !is_scalar($record[$field])) {
                return new WP_Error('qr_invalid_record', '記録内容を確認してください。', array('status' => 400));
            }
        }

        $type = sanitize_key((string) (isset($record['type']) ? $record['type'] : ''));
        $date = sanitize_text_field((string) (isset($record['date']) ? $record['date'] : ''));
        $note = sanitize_textarea_field((string) (isset($record['note']) ? $record['note'] : ''));
        $prey_type = sanitize_text_field((string) (isset($record['prey_type']) ? $record['prey_type'] : ''));

        if (!in_array($type, array('feed', 'molt', 'pairing', 'observation'), true)) {
            return new WP_Error('qr_invalid_record_type', '記録の種類が正しくありません。', array('status' => 400));
        }
        $date_value = DateTime::createFromFormat('!Y-m-d', $date);
        $date_errors = DateTime::getLastErrors();
        if (!$date_value || ($date_errors && ($date_errors['warning_count'] || $date_errors['error_count'])) || $date_value->format('Y-m-d') !== $date) {
            return new WP_Error('qr_invalid_date', 'すべての記録に日付を入力してください。', array('status' => 400));
        }
        if (function_exists('mb_strlen') ? mb_strlen($note, 'UTF-8') > 5000 : strlen($note) > 5000) {
            return new WP_Error('qr_note_too_long', 'メモは5000文字以内で入力してください。', array('status' => 400));
        }
        if ($type === 'observation' && $note === '') {
            return new WP_Error('qr_note_required', 'メモ記録には内容を入力してください。', array('status' => 400));
        }

        return array(
            'type' => $type,
            'date' => $date,
            'note' => $note,
            'prey_type' => $type === 'feed' ? $prey_type : '',
        );
    }

    private static function create_spider_log($spider_id, $user_id, $type, $date, $note, $prey_type)
    {
        $spider = get_post($spider_id);
        if (!$spider || (int) $spider->post_author !== (int) $user_id) {
            return new WP_Error('qr_spider_forbidden', '個体へ記録できません。', array('status' => 403));
        }

        $data = array('source' => 'qr_scan');
        if ($note) {
            $data['note'] = $note;
        }
        if ($type === 'feed') {
            $data['prey_type'] = $prey_type ?: '未設定';
            $data['refused'] = false;
        } elseif ($type === 'pairing') {
            $data['label'] = 'ペアリング';
        } elseif ($type === 'observation') {
            $data['label'] = 'QRからメモ';
        }

        $log_id = wp_insert_post(array(
            'post_title' => sanitize_text_field(sprintf('%s - %s (%s)', $spider->post_title, ucfirst($type), $date)),
            'post_content' => $note,
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'post_author' => $user_id,
        ), true);
        if (is_wp_error($log_id) || !$log_id) {
            return new WP_Error('qr_log_failed', '記録を保存できませんでした。', array('status' => 500));
        }

        self::track_transaction_post($log_id);
        self::track_transaction_post($spider_id);
        $recorder = Setae_Entitlements::mark_log_recorder($log_id, $user_id);
        $log_meta = array(
            '_setae_log_spider_id' => $spider_id,
            '_setae_log_type' => $type,
            '_setae_log_date' => $date,
            '_setae_log_data' => wp_json_encode($data, JSON_UNESCAPED_UNICODE),
        );
        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        if ($species_id) {
            $log_meta['_setae_related_species_id'] = $species_id;
        }
        if ($recorder !== (int) $user_id || !self::write_post_meta_checked($log_id, $log_meta)) {
            return new WP_Error('qr_log_meta_failed', '記録と記録者情報を保存できませんでした。', array('status' => 503));
        }

        $summary = array();
        if ($type === 'feed') {
            $current_date = (string) get_post_meta($spider_id, '_setae_last_feed_date', true);
            $current_molt_date = (string) get_post_meta($spider_id, '_setae_last_molt_date', true);
            if (!$current_date || $date >= $current_date) {
                $summary['_setae_last_feed_date'] = $date;
                if ($prey_type) {
                    $summary['_setae_last_prey'] = $prey_type;
                }
            }
            if ((!$current_date || $date >= $current_date) && (!$current_molt_date || $date >= $current_molt_date)) {
                $summary['_setae_status'] = 'normal';
            }
        } elseif ($type === 'molt') {
            $current_date = (string) get_post_meta($spider_id, '_setae_last_molt_date', true);
            $current_feed_date = (string) get_post_meta($spider_id, '_setae_last_feed_date', true);
            if (!$current_date || $date >= $current_date) {
                $summary['_setae_last_molt_date'] = $date;
            }
            if ((!$current_date || $date >= $current_date) && (!$current_feed_date || $date >= $current_feed_date)) {
                $summary['_setae_status'] = 'post_molt';
            }
        } elseif ($type === 'pairing') {
            $current_date = (string) get_post_meta($spider_id, '_setae_last_pairing_date', true);
            if (!$current_date || $date >= $current_date) {
                $summary['_setae_last_pairing_date'] = $date;
            }
        } else {
            $current_date = (string) get_post_meta($spider_id, '_setae_last_observation_date', true);
            if (!$current_date || $date >= $current_date) {
                $summary['_setae_last_observation_date'] = $date;
                $summary['_setae_last_observation_label'] = 'QRからメモ';
            }
        }
        if (!self::write_post_meta_checked($spider_id, $summary)) {
            return new WP_Error('qr_log_summary_failed', '個体の記録状態を保存できませんでした。', array('status' => 503));
        }
        return $log_id;
    }

    private static function apply_baby_record(&$changes, $baby_code, $type, $date, $note, $prey_type)
    {
        $item = isset($changes[$baby_code]) && is_array($changes[$baby_code]) ? $changes[$baby_code] : array();
        $history = isset($item['history']) && is_array($item['history']) ? $item['history'] : array();
        $entry = array('type' => $type, 'date' => $date, 'note' => $note);
        if ($type === 'feed' && $prey_type) {
            $entry['prey_type'] = $prey_type;
        }

        $exists = false;
        foreach ($history as $index => $existing) {
            if (!is_array($existing)) {
                continue;
            }
            if (($existing['type'] ?? '') === $type && ($existing['date'] ?? '') === $date) {
                $history[$index] = array_merge($existing, $entry);
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $history[] = $entry;
        }

        if ($type === 'molt') {
            $molts = isset($item['molts']) && is_array($item['molts']) ? $item['molts'] : array();
            if (!in_array($date, $molts, true)) {
                $molts[] = $date;
                sort($molts);
            }
            $item['molts'] = $molts;
        }
        if ($note) {
            $item['note'] = $note;
        }
        $item['history'] = $history;
        $item['updated_at'] = current_time('mysql');
        $changes[$baby_code] = $item;
    }

    private static function touch_daily_streak($user_id, $date)
    {
        if ($date !== current_time('Y-m-d')) {
            return;
        }
        $last = (string) get_user_meta($user_id, '_setae_daily_check_last_date', true);
        if ($last === $date) {
            return;
        }
        $current = (int) get_user_meta($user_id, '_setae_daily_check_streak', true);
        $yesterday = date('Y-m-d', current_time('timestamp') - DAY_IN_SECONDS);
        $next = $last === $yesterday ? $current + 1 : 1;
        update_user_meta($user_id, '_setae_daily_check_last_date', $date);
        update_user_meta($user_id, '_setae_daily_check_streak', $next);
        update_user_meta($user_id, '_setae_daily_check_best_streak', max($next, (int) get_user_meta($user_id, '_setae_daily_check_best_streak', true)));
    }

    public static function promote_baby_target($group_id, $baby_code, $spider_id)
    {
        $spider = get_post($spider_id);
        if (!$spider || $spider->post_type !== 'setae_spider') {
            return new WP_Error('qr_spider_not_found', '移動先の個体を確認できません。', array('status' => 404));
        }
        self::track_transaction_post($group_id);
        self::track_transaction_post($spider_id);
        $baby_code = self::normalize_baby_code($group_id, $baby_code);
        if (!$baby_code) {
            return new WP_Error('qr_baby_not_found', '移動元のベビー番号を確認できません。', array('status' => 404));
        }
        $target_map = get_post_meta($group_id, '_setae_baby_qr_targets', true);
        $target_map = is_array($target_map) ? $target_map : array();
        $target_id = is_array($target_map) && isset($target_map[$baby_code]) ? absint($target_map[$baby_code]) : 0;
        $target = $target_id ? get_post($target_id) : null;

        if (!$target || $target->post_type !== self::TARGET_POST_TYPE) {
            unset($target_map[$baby_code]);
            $saved = $target_map
                ? self::write_post_meta_checked($group_id, array('_setae_baby_qr_targets' => $target_map))
                : self::clear_post_meta_checked($group_id, array('_setae_baby_qr_targets'));
            if (!$saved) {
                return new WP_Error('qr_promotion_map_failed', 'ベビーとQRの対応を更新できませんでした。', array('status' => 503));
            }
            return self::ensure_spider_target($spider_id);
        }
        self::track_transaction_post($target_id);
        $saved_code = $target->post_name;
        $saved = self::write_post_meta_checked($target_id, array('_setae_qr_target_type' => 'spider', '_setae_qr_object_id' => absint($spider_id)))
            && self::clear_post_meta_checked($target_id, array('_setae_qr_baby_code'))
            && self::write_post_meta_checked($spider_id, array(self::TARGET_ID_META => $target_id, self::CODE_META => $saved_code));
        $target = self::sync_target_owner($target_id, (int) $spider->post_author);
        if (!$saved || is_wp_error($target) || $target->post_name !== $saved_code) {
            return new WP_Error('qr_promotion_target_failed', 'QRの引き継ぎ情報を保存できませんでした。', array('status' => 503));
        }
        unset($target_map[$baby_code]);
        $saved = $target_map
            ? self::write_post_meta_checked($group_id, array('_setae_baby_qr_targets' => $target_map))
            : self::clear_post_meta_checked($group_id, array('_setae_baby_qr_targets'));
        if (!$saved) {
            return new WP_Error('qr_promotion_map_failed', 'ベビーとQRの対応を更新できませんでした。', array('status' => 503));
        }
        return $target;
    }

    public static function store_pending_claim($user_id, $code, $request_after_verification = false)
    {
        $user_id = absint($user_id);
        $target = self::get_target_by_code($code);
        $label = $target ? self::get_target_label_data($target) : null;
        if (!$user_id || !$label || $label['target_type'] !== 'spider' || (int) $target->post_author === $user_id
            || get_post_meta($label['object_id'], '_setae_transfer_receipt', true) === '1') {
            return false;
        }
        if (!$request_after_verification && !self::is_transfer_available($target)) {
            return false;
        }
        update_user_meta($user_id, self::PENDING_CLAIM_META, $target->post_name);
        if ($request_after_verification === true) {
            // Bind consent to this exact code, not to a later or unrelated pending claim.
            update_user_meta($user_id, self::PENDING_CLAIM_INTENT_META, $target->post_name);
        } else {
            delete_user_meta($user_id, self::PENDING_CLAIM_INTENT_META);
        }
        return true;
    }

    public static function get_pending_claim($user_id)
    {
        return self::sanitize_code(get_user_meta(absint($user_id), self::PENDING_CLAIM_META, true));
    }

    public static function pending_claim_has_intent($user_id)
    {
        $code = self::get_pending_claim($user_id);
        return $code !== '' && $code === self::sanitize_code(get_user_meta(absint($user_id), self::PENDING_CLAIM_INTENT_META, true));
    }

    public static function clear_pending_claim($user_id, $expected_code = '')
    {
        $user_id = absint($user_id);
        $code = self::get_pending_claim($user_id);
        if ($expected_code && $code !== self::sanitize_code($expected_code)) {
            return;
        }
        delete_user_meta($user_id, self::PENDING_CLAIM_META, $code);
        delete_user_meta($user_id, self::PENDING_CLAIM_INTENT_META, $code);
    }

    /** Called only after fresh email verification, never from a Passport GET. */
    public static function request_pending_claim($user_id)
    {
        $user_id = absint($user_id);
        $code = self::get_pending_claim($user_id);
        if (!$code || !self::pending_claim_has_intent($user_id) || (int) get_user_meta($user_id, '_setae_is_verified', true) !== 1) {
            return new WP_Error('qr_claim_not_requested', '引き継ぎ申請の確認が必要です。', array('status' => 400));
        }
        $target = self::get_target_by_code($code);
        $result = self::create_transfer_request($target, $user_id);
        global $wpdb;
        if (is_wp_error($result) && empty($wpdb->last_error) && in_array($result->get_error_code(), array('qr_transfer_invalid_target', 'qr_transfer_same_owner'), true)) {
            self::clear_pending_claim($user_id, $code);
        }
        return $result;
    }

    public static function is_transfer_available($target)
    {
        $label = self::get_target_label_data($target);
        return $label
            && $label['target_type'] === 'spider'
            && empty($label['archived'])
            && get_post_meta($label['object_id'], self::TRANSFER_ENABLED_META, true) === '1';
    }

    public static function get_public_target_data($target, $viewer_id = 0)
    {
        $label = self::get_target_label_data($target);
        if (!$label) {
            return null;
        }

        $owner_id = (int) $target->post_author;
        $is_owner = $viewer_id && ($viewer_id === $owner_id || user_can($viewer_id, 'manage_options'));
        if ($label['target_type'] !== 'spider') {
            return array(
                'label' => $label,
                'is_owner' => $is_owner,
                'is_public' => false,
                'transfer_enabled' => false,
                'private' => true,
            );
        }

        $spider_id = (int) $label['object_id'];
        $visibility = self::get_spider_public_mode($spider_id);
        $is_public = $visibility !== 'private';
        $transfer_enabled = get_post_meta($spider_id, self::TRANSFER_ENABLED_META, true) === '1';
        $owner = get_userdata($owner_id);
        $request = $viewer_id ? self::find_pending_transfer($target->ID, $viewer_id) : null;
        $care_summary = ($visibility === 'life_history' || $is_owner)
            ? self::get_public_care_summary($spider_id, $label)
            : self::get_empty_public_care_summary();
        $referral_code = sanitize_text_field(get_user_meta($owner_id, '_setae_referral_code', true));
        $profile_url = '';
        if ($referral_code) {
            $profile_url = get_option('permalink_structure')
                ? home_url('/setae-user/' . rawurlencode($referral_code) . '/')
                : add_query_arg('setae_profile', $referral_code, home_url('/'));
            $profile_url = add_query_arg('ref', $referral_code, $profile_url);
        }
        $passport = self::get_public_passport_data($target, $viewer_id);

        return array(
            'label' => $label,
            'is_owner' => $is_owner,
            'is_public' => $is_public,
            'visibility' => $visibility,
            'transfer_enabled' => $transfer_enabled,
            'private' => !$is_owner && !$is_public && !$transfer_enabled,
            'owner' => $is_owner ? array(
                'id' => $owner_id,
                'name' => $owner ? $owner->display_name : 'SETAEユーザー',
                'avatar' => get_avatar_url($owner_id, array('size' => 96)),
                'profile_url' => $profile_url,
            ) : array(),
            'gender' => sanitize_key(get_post_meta($spider_id, '_setae_gender', true) ?: 'unknown'),
            'family_name' => sanitize_text_field($passport['family_name'] ?? ''),
            'stage' => sanitize_key($passport['stage'] ?? 'undetermined'),
            'origin' => sanitize_text_field($passport['origin'] ?? ''),
            'life_history' => isset($passport['life_history']) && is_array($passport['life_history']) ? $passport['life_history'] : array(),
            'last_feed' => get_post_meta($spider_id, '_setae_last_feed_date', true),
            'last_molt' => get_post_meta($spider_id, '_setae_last_molt_date', true),
            'last_pairing' => get_post_meta($spider_id, '_setae_last_pairing_date', true),
            'last_observation' => get_post_meta($spider_id, '_setae_last_observation_date', true),
            'record_count' => $care_summary['record_count'],
            'management_days' => $care_summary['management_days'],
            'latest_record_date' => $care_summary['latest_record_date'],
            'recent_activity' => $care_summary['recent_activity'],
            'gallery' => $care_summary['gallery'],
            'request_status' => $request ? get_post_meta($request->ID, '_setae_transfer_status', true) : '',
        );
    }

    public static function get_public_passport_data($target, $viewer_id = 0)
    {
        $label = self::get_target_label_data($target);
        if (!$label || $label['target_type'] !== 'spider') {
            return null;
        }

        $spider_id = (int) $label['object_id'];
        $is_owner = self::user_owns_target($target, absint($viewer_id));
        $visibility = self::get_spider_public_mode($spider_id);
        $transfer_available = self::is_transfer_available($target);
        $effective_visibility = $visibility === 'private' && $transfer_available ? 'basic' : $visibility;
        $passport = array(
            'visibility' => $effective_visibility,
            'code' => sanitize_text_field($label['title']),
            'permanent_url' => esc_url_raw($label['url']),
            'managed_by_viewer' => (bool) $is_owner,
            'transfer_available' => (bool) $transfer_available,
        );

        if ($effective_visibility === 'private' && !$is_owner) {
            return $passport;
        }

        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        $instar = absint(get_post_meta($spider_id, '_setae_spider_instar', true));
        $stage = sanitize_key(get_post_meta($spider_id, '_setae_spider_stage', true));
        if (!$stage && $instar) {
            $stage = 'instar_' . $instar;
        }

        $passport = array_merge($passport, array(
            'scientific_name' => sanitize_text_field($label['species_name']),
            'family_name' => self::get_public_family_name($species_id, $label['classification']),
            'stage' => $stage ?: 'undetermined',
            'sex' => sanitize_key(get_post_meta($spider_id, '_setae_gender', true) ?: 'unknown'),
            'origin' => self::get_public_origin($spider_id),
            'image_url' => esc_url_raw($label['image']),
            'life_history' => $effective_visibility === 'life_history'
                ? self::get_public_life_history($spider_id)
                : array(),
        ));
        return $passport;
    }

    private static function get_public_family_name($species_id, $classification)
    {
        $family = $species_id ? sanitize_text_field(get_post_meta($species_id, '_setae_family_name', true)) : '';
        if ($family) {
            return $family;
        }
        return sanitize_key($classification) === 'tarantula' ? 'Theraphosidae' : '';
    }

    private static function get_public_origin($spider_id)
    {
        $origin = strtoupper(trim(sanitize_text_field(get_post_meta(absint($spider_id), '_setae_spider_origin', true))));
        $allowed = array('CB', 'CBB', 'WC', 'CB/WC', 'CAPTIVE BRED', 'WILD CAUGHT');
        return in_array($origin, $allowed, true) ? $origin : '';
    }

    private static function get_public_life_history($spider_id)
    {
        $log_ids = get_posts(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'fields' => 'ids',
            'posts_per_page' => 20,
            'meta_key' => '_setae_log_date',
            'orderby' => array('meta_value' => 'DESC', 'date' => 'DESC'),
            'meta_query' => array(
                'relation' => 'AND',
                array('key' => '_setae_log_spider_id', 'value' => absint($spider_id), 'compare' => '=', 'type' => 'NUMERIC'),
                array('key' => '_setae_log_type', 'value' => array('molt', 'growth', 'pairing'), 'compare' => 'IN'),
            ),
        ));
        $events = array();
        foreach ($log_ids as $log_id) {
            $date = self::normalize_label_date(get_post_meta($log_id, '_setae_log_date', true));
            if (!$date) {
                continue;
            }
            $type = sanitize_key(get_post_meta($log_id, '_setae_log_type', true));
            $events[] = array('type' => $type, 'date' => $date, 'label' => self::get_public_log_type_label($type));
        }
        return $events;
    }

    private static function get_empty_public_care_summary()
    {
        return array(
            'record_count' => 0,
            'management_days' => 0,
            'latest_record_date' => '',
            'recent_activity' => array(),
            'gallery' => array(),
        );
    }

    private static function get_public_care_summary($spider_id, $label)
    {
        $spider_id = absint($spider_id);
        $summary = self::get_empty_public_care_summary();
        if (!$spider_id) {
            return $summary;
        }

        $recent_query = new WP_Query(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'fields' => 'ids',
            'posts_per_page' => 6,
            'meta_key' => '_setae_log_date',
            'orderby' => array(
                'meta_value' => 'DESC',
                'date' => 'DESC',
            ),
            'meta_query' => array(
                array(
                    'key' => '_setae_log_spider_id',
                    'value' => $spider_id,
                    'compare' => '=',
                    'type' => 'NUMERIC',
                ),
            ),
        ));

        $summary['record_count'] = (int) $recent_query->found_posts;
        foreach ($recent_query->posts as $log_id) {
            $type = sanitize_key(get_post_meta($log_id, '_setae_log_type', true));
            $date = self::normalize_label_date(get_post_meta($log_id, '_setae_log_date', true));
            if (!$date) {
                continue;
            }
            $summary['recent_activity'][] = array(
                'id' => (int) $log_id,
                'type' => $type ?: 'record',
                'label' => self::get_public_log_type_label($type),
                'date' => $date,
            );
        }
        if (!empty($summary['recent_activity'])) {
            $summary['latest_record_date'] = $summary['recent_activity'][0]['date'];
        }

        $management_start = self::normalize_label_date($label['management_start_date'] ?? '');
        if ($management_start) {
            $start = DateTimeImmutable::createFromFormat('!Y-m-d', $management_start, wp_timezone());
            $today = new DateTimeImmutable('today', wp_timezone());
            if ($start && $start <= $today) {
                $summary['management_days'] = (int) $start->diff($today)->days + 1;
            }
        }

        $gallery_ids = get_posts(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'fields' => 'ids',
            'posts_per_page' => 8,
            'meta_key' => '_setae_log_date',
            'orderby' => 'meta_value',
            'order' => 'DESC',
            'meta_query' => array(
                'relation' => 'AND',
                array(
                    'key' => '_setae_log_spider_id',
                    'value' => $spider_id,
                    'compare' => '=',
                    'type' => 'NUMERIC',
                ),
                array(
                    'key' => '_setae_log_shared',
                    'value' => '1',
                    'compare' => '=',
                ),
                array(
                    'key' => '_setae_log_image',
                    'compare' => 'EXISTS',
                ),
            ),
        ));

        $seen_images = array();
        foreach ($gallery_ids as $log_id) {
            $image = esc_url_raw(get_post_meta($log_id, '_setae_log_image', true));
            if (!$image || isset($seen_images[$image])) {
                continue;
            }
            $seen_images[$image] = true;
            $summary['gallery'][] = array(
                'url' => $image,
                'date' => self::normalize_label_date(get_post_meta($log_id, '_setae_log_date', true)),
                'type' => sanitize_key(get_post_meta($log_id, '_setae_log_type', true)),
                'label' => self::get_public_log_type_label(get_post_meta($log_id, '_setae_log_type', true)),
            );
        }

        return $summary;
    }

    private static function get_public_log_type_label($type)
    {
        $labels = array(
            'feed' => '給餌',
            'molt' => '脱皮',
            'pairing' => 'ペアリング',
            'observation' => '観察',
            'growth' => '成長',
            'cleaning' => '環境整備',
            'water' => '給水',
            'health' => '健康記録',
            'photo' => '写真',
        );
        $type = sanitize_key($type);
        return isset($labels[$type]) ? $labels[$type] : '飼育記録';
    }

    public static function create_transfer_request($target, $to_user_id)
    {
        if (!$target || $target->post_type !== self::TARGET_POST_TYPE || !absint($to_user_id)) {
            return new WP_Error('qr_transfer_invalid_target', 'このQRは引き継ぎできません。');
        }
        $target_id = (int) $target->ID;
        return Setae_Entitlements::with_user_lock(absint($to_user_id), function () use ($target_id, $to_user_id) {
            clean_post_cache($target_id);
            wp_cache_delete($target_id, 'post_meta');
            return self::create_transfer_request_locked(get_post($target_id), $to_user_id);
        });
    }

    private static function create_transfer_request_locked($target, $to_user_id)
    {
        global $wpdb;
        $to_user_id = absint($to_user_id);
        $label = self::get_target_label_data($target);
        if (!$label || $label['target_type'] !== 'spider' || get_post_meta($label['object_id'], '_setae_transfer_receipt', true) === '1') {
            return new WP_Error('qr_transfer_invalid_target', 'このQRは引き継ぎできません。');
        }

        $from_user_id = (int) $target->post_author;
        $spider = get_post($label['object_id']);
        if (!$spider || $spider->post_type !== 'setae_spider' || $spider->post_status !== 'publish' || (int) $spider->post_author !== $from_user_id) {
            return new WP_Error('qr_transfer_invalid_target', '個体の所有者情報を確認できません。');
        }
        if (!$to_user_id || $to_user_id === $from_user_id) {
            return new WP_Error('qr_transfer_same_owner', '現在の所有者には引き継ぎ申請できません。');
        }
        if (get_post_meta($label['object_id'], self::TRANSFER_ENABLED_META, true) !== '1') {
            return new WP_Error('qr_transfer_closed', 'この個体は現在、引き継ぎを受け付けていません。');
        }
        if (get_post_meta($label['object_id'], '_setae_spider_archived', true) === '1') {
            return new WP_Error('qr_transfer_archived', 'アーカイブ中の個体は引き継ぎできません。');
        }

        $existing = self::find_pending_transfer($target->ID, $to_user_id);
        if ($wpdb->last_error) { return new WP_Error('qr_transfer_lookup_failed', '申請状況を確認できませんでした。', array('status' => 503)); }
        if ($existing) {
            self::clear_pending_claim($to_user_id, $target->post_name);
            return $existing;
        }

        $request_id = Setae_Entitlements::with_transaction(array($from_user_id, $to_user_id), function () use ($target, $label, $from_user_id, $to_user_id) {
            $id = wp_insert_post(array(
                'post_type' => self::TRANSFER_POST_TYPE,
                'post_status' => 'publish',
                'post_title' => sprintf('%s -> %d', $target->post_name, $to_user_id),
                'post_author' => $from_user_id,
            ), true);
            if (is_wp_error($id) || !$id) {
                return new WP_Error('qr_transfer_create_failed', '引き継ぎ申請を送信できませんでした。');
            }
            if (!self::write_post_meta_checked($id, array(
                '_setae_transfer_target_id' => $target->ID,
                '_setae_transfer_spider_id' => $label['object_id'],
                '_setae_transfer_from_user' => $from_user_id,
                '_setae_transfer_to_user' => $to_user_id,
                '_setae_transfer_status' => 'pending',
                '_setae_transfer_requested_at' => current_time('mysql'),
            ))) { return new WP_Error('qr_transfer_create_failed', '引き継ぎ申請を保存できませんでした。', array('status' => 503)); }
            return (int) $id;
        });
        if (is_wp_error($request_id)) { return $request_id; }

        $claimant = get_userdata($to_user_id);
        self::add_notification(
            $from_user_id,
            'transfer_request',
            sprintf('%sさんから「%s」の引き継ぎ申請が届きました。', $claimant ? $claimant->display_name : 'ユーザー', $label['title']),
            array('request_id' => $request_id, 'spider_id' => $label['object_id'])
        );
        self::clear_pending_claim($to_user_id, $target->post_name);
        if (class_exists('Setae_Product_Events')) {
            Setae_Entitlements::record_event('transfer_requested', array(
                'idempotency_key' => 'transfer-request:' . $request_id,
                'user_id' => $to_user_id,
                'object_type' => 'transfer',
                'object_id' => (int) $request_id,
                'partner_user_id' => $from_user_id,
                'acquisition_source' => 'public_passport',
                'properties' => array(),
            ));
        }
        return get_post($request_id);
    }

    public static function has_pending_transfer($target_id, $to_user_id)
    {
        return self::find_pending_transfer($target_id, $to_user_id) !== null;
    }

    private static function find_pending_transfer($target_id, $to_user_id)
    {
        $items = get_posts(array(
            'post_type' => self::TRANSFER_POST_TYPE,
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'meta_query' => array(
                'relation' => 'AND',
                array('key' => '_setae_transfer_target_id', 'value' => absint($target_id)),
                array('key' => '_setae_transfer_to_user', 'value' => absint($to_user_id)),
                array('key' => '_setae_transfer_status', 'value' => 'pending'),
            ),
        ));
        return $items ? $items[0] : null;
    }

    public static function get_transfer_overview($user_id)
    {
        $user_id = absint($user_id);
        $requests = get_posts(array(
            'post_type' => self::TRANSFER_POST_TYPE,
            'post_status' => 'publish',
            'posts_per_page' => 100,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => array(
                'relation' => 'OR',
                array('key' => '_setae_transfer_from_user', 'value' => $user_id),
                array('key' => '_setae_transfer_to_user', 'value' => $user_id),
            ),
        ));

        $incoming = array();
        $outgoing = array();
        foreach ($requests as $request) {
            $row = self::build_transfer_response($request, $user_id);
            if (!$row) {
                continue;
            }
            if ($row['from_user_id'] === $user_id) {
                $incoming[] = $row;
            }
            if ($row['to_user_id'] === $user_id) {
                $outgoing[] = $row;
            }
        }

        $notifications = self::get_notifications($user_id);
        return array(
            'incoming' => $incoming,
            'outgoing' => $outgoing,
            'pending_count' => count(array_filter($incoming, function ($item) {
                return $item['status'] === 'pending';
            })),
            'notifications' => $notifications,
            'unread_count' => count(array_filter($notifications, function ($item) {
                return empty($item['read']);
            })),
        );
    }

    private static function build_transfer_response($request, $viewer_id)
    {
        $from_user_id = absint(get_post_meta($request->ID, '_setae_transfer_from_user', true));
        $to_user_id = absint(get_post_meta($request->ID, '_setae_transfer_to_user', true));
        if ($viewer_id !== $from_user_id && $viewer_id !== $to_user_id && !user_can($viewer_id, 'manage_options')) {
            return null;
        }
        $spider_id = absint(get_post_meta($request->ID, '_setae_transfer_spider_id', true));
        $target_id = absint(get_post_meta($request->ID, '_setae_transfer_target_id', true));
        $target = get_post($target_id);
        $from = get_userdata($from_user_id);
        $to = get_userdata($to_user_id);

        return array(
            'id' => (int) $request->ID,
            'status' => sanitize_key(get_post_meta($request->ID, '_setae_transfer_status', true) ?: 'pending'),
            'spider_id' => $spider_id,
            'spider_name' => get_the_title($spider_id) ?: sanitize_text_field(get_post_meta($request->ID, '_setae_transfer_spider_name', true)),
            'code' => $target ? $target->post_name : sanitize_text_field(get_post_meta($request->ID, '_setae_transfer_code', true)),
            'from_user_id' => $from_user_id,
            'from_user_name' => $from ? $from->display_name : 'ユーザー',
            'to_user_id' => $to_user_id,
            'to_user_name' => $to ? $to->display_name : 'ユーザー',
            'requested_at' => get_post_meta($request->ID, '_setae_transfer_requested_at', true),
            'completed_at' => get_post_meta($request->ID, '_setae_transfer_completed_at', true),
            'can_respond' => $viewer_id === $from_user_id && get_post_meta($request->ID, '_setae_transfer_status', true) === 'pending',
        );
    }

    public static function respond_to_transfer($request_id, $action, $user_id)
    {
        $request_id = absint($request_id);
        $from = absint(get_post_meta($request_id, '_setae_transfer_from_user', true));
        $to = absint(get_post_meta($request_id, '_setae_transfer_to_user', true));
        if (!$from || !$to) { return new WP_Error('qr_transfer_not_found', '引き継ぎ申請が見つかりません。', array('status' => 404)); }
        if ($from !== absint($user_id) && !user_can($user_id, 'manage_options')) {
            return new WP_Error('qr_transfer_forbidden', 'この申請を操作できません。', array('status' => 403));
        }
        // Use the same order for opposite-direction transfers and nursery/record writes.
        $users = array($from, $to);
        sort($users, SORT_NUMERIC);
        return Setae_Entitlements::with_user_lock($users[0], function () use ($users, $request_id, $action, $user_id) {
            return Setae_Entitlements::with_user_lock($users[1], function () use ($request_id, $action, $user_id) {
                clean_post_cache($request_id);
                wp_cache_delete($request_id, 'post_meta');
                return self::respond_to_transfer_locked($request_id, $action, $user_id);
            });
        });
    }

    private static function respond_to_transfer_locked($request_id, $action, $user_id)
    {
        $request = get_post(absint($request_id));
        if (!$request || $request->post_type !== self::TRANSFER_POST_TYPE) {
            return new WP_Error('qr_transfer_not_found', '引き継ぎ申請が見つかりません。', array('status' => 404));
        }
        $from_user_id = absint(get_post_meta($request->ID, '_setae_transfer_from_user', true));
        $to_user_id = absint(get_post_meta($request->ID, '_setae_transfer_to_user', true));
        if ($from_user_id !== absint($user_id) && !user_can($user_id, 'manage_options')) {
            return new WP_Error('qr_transfer_forbidden', 'この申請を操作できません。', array('status' => 403));
        }
        if (get_post_meta($request->ID, '_setae_transfer_status', true) !== 'pending') {
            return new WP_Error('qr_transfer_closed', 'この申請はすでに処理されています。', array('status' => 400));
        }

        if ($action === 'reject') {
            $saved = Setae_Entitlements::with_transaction(array($from_user_id, $to_user_id), function () use ($request) {
                return Setae_Entitlements::save_post_meta_checked($request->ID, array(
                    '_setae_transfer_status' => 'rejected',
                    '_setae_transfer_completed_at' => current_time('mysql'),
                ));
            });
            if (is_wp_error($saved)) { return $saved; }
            self::add_notification($to_user_id, 'transfer_rejected', '個体の引き継ぎ申請が見送られました。', array('request_id' => $request->ID));
            return self::build_transfer_response($request, $user_id);
        }
        if ($action !== 'approve') {
            return new WP_Error('qr_transfer_invalid_action', '操作が正しくありません。', array('status' => 400));
        }
        $capacity = Setae_Entitlements::can_create_specimen($to_user_id, 'transfer_received', 1);
        if (is_wp_error($capacity)) {
            return $capacity;
        }

        return self::complete_transfer($request, $from_user_id, $to_user_id);
    }

    private static function complete_transfer($request, $from_user_id, $to_user_id)
    {
        global $wpdb;
        $spider_id = absint(get_post_meta($request->ID, '_setae_transfer_spider_id', true));
        $target_id = absint(get_post_meta($request->ID, '_setae_transfer_target_id', true));
        $spider = get_post($spider_id);
        $target = get_post($target_id);
        if (!$spider || !$target || (int) $spider->post_author !== $from_user_id) {
            return new WP_Error('qr_transfer_stale', '所有者情報が変更されたため、申請を完了できません。', array('status' => 409));
        }
        if (get_post_meta($spider_id, self::TRANSFER_ENABLED_META, true) !== '1') {
            return new WP_Error('qr_transfer_closed', '引き継ぎ設定がオフになっています。', array('status' => 409));
        }
        if (get_post_meta($spider_id, '_setae_spider_archived', true) === '1') {
            return new WP_Error('qr_transfer_archived', '個体がアーカイブされたため、引き継ぎを完了できません。', array('status' => 409));
        }

        $transaction = Setae_Entitlements::with_transaction(array($from_user_id, $to_user_id), function () use ($request, $from_user_id, $to_user_id, $spider_id, $target_id) {
            global $wpdb;
            foreach (array($request->ID, $spider_id, $target_id) as $id) { self::track_transaction_post($id); }
            $locked_user = $wpdb->get_var($wpdb->prepare("SELECT ID FROM {$wpdb->users} WHERE ID = %d FOR UPDATE", $to_user_id));
            $capacity = Setae_Entitlements::can_create_specimen($to_user_id, 'transfer_received', 1);
            if (!$locked_user || is_wp_error($capacity)) {
                return is_wp_error($capacity) ? $capacity : new WP_Error('qr_transfer_recipient_missing', '引き継ぎ先を確認できません。', array('status' => 409));
            }
            $locked_ids = array_filter(array((int) $request->ID, $spider_id, $target_id));
            sort($locked_ids, SORT_NUMERIC);
            $placeholders = implode(',', array_fill(0, count($locked_ids), '%d'));
            $locked_posts = $wpdb->get_results($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID IN ($placeholders) ORDER BY ID FOR UPDATE", $locked_ids));
            if (!is_array($locked_posts) || $wpdb->last_error) {
                return new WP_Error('qr_transfer_lock_failed', '引き継ぎ対象を確認できませんでした。', array('status' => 503));
            }
            clean_post_cache($request->ID);
            clean_post_cache($spider_id);
            clean_post_cache($target_id);
            wp_cache_delete($request->ID, 'post_meta');
            wp_cache_delete($spider_id, 'post_meta');
            wp_cache_delete($target_id, 'post_meta');
            $request = get_post($request->ID);
            $spider = get_post($spider_id);
            $target = get_post($target_id);
            if (!$request || get_post_meta($request->ID, '_setae_transfer_status', true) !== 'pending' || !$spider || !$target || (int) $spider->post_author !== $from_user_id || (int) $target->post_author !== $from_user_id) {
                return new WP_Error('qr_transfer_stale', '所有者情報が変更されたため、申請を完了できません。', array('status' => 409));
            }
            if (get_post_meta($spider_id, self::TRANSFER_ENABLED_META, true) !== '1') {
                return new WP_Error('qr_transfer_closed', '引き継ぎ設定がオフになっています。', array('status' => 409));
            }
            if (get_post_meta($spider_id, '_setae_spider_archived', true) === '1') {
                return new WP_Error('qr_transfer_archived', '個体がアーカイブされたため、引き継ぎを完了できません。', array('status' => 409));
            }
            $snapshot_id = self::create_transfer_snapshot($spider, $from_user_id, $to_user_id, $request->ID, $target->post_name);
            if (is_wp_error($snapshot_id)) {
                return $snapshot_id;
            }

            $updated = wp_update_post(array('ID' => $spider_id, 'post_author' => $to_user_id), true);
            $saved_spider = get_post($spider_id);
            if (is_wp_error($updated) || !$updated || !$saved_spider || (int) $saved_spider->post_author !== $to_user_id) {
                return new WP_Error('qr_transfer_failed', '所有権を更新できませんでした。', array('status' => 500));
            }
            $source = Setae_Entitlements::mark_specimen_source($spider_id, 'transfer_received');
            $received_at = time();
            $saved = self::write_post_meta_checked($spider_id, array(
                '_setae_owner_id' => $to_user_id,
                self::PUBLIC_MODE_META => 'private',
                '_setae_transferred_from_user' => $from_user_id,
                '_setae_transferred_at' => current_time('mysql'),
                '_setae_received_at' => $received_at,
            )) && self::clear_post_meta_checked($spider_id, array('_setae_spider_archived', '_setae_spider_archived_at', self::TRANSFER_ENABLED_META, self::PUBLIC_META));
            $target_owner = self::sync_target_owner($target_id, $to_user_id);
            if (!$saved || is_wp_error($source) || get_post_meta($spider_id, Setae_Entitlements::SOURCE_META, true) !== 'transfer_received' || is_wp_error($target_owner)) {
                return new WP_Error('qr_transfer_meta_failed', '受領情報を保存できませんでした。所有権は変更されていません。', array('status' => 503));
            }

            $log_ids = get_posts(array(
                'post_type' => 'setae_log',
                'post_status' => 'any',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'meta_key' => '_setae_log_spider_id',
                'meta_value' => $spider_id,
            ));
            if ($wpdb->last_error) { return new WP_Error('qr_transfer_log_failed', '飼育履歴を確認できませんでした。', array('status' => 503)); }
            foreach ($log_ids as $log_id) {
                // Ownership controls access. The original recorder remains immutable provenance.
                self::track_transaction_post($log_id);
                $recorder = Setae_Entitlements::mark_log_recorder($log_id);
                if (!$recorder || (int) get_post_meta($log_id, Setae_Entitlements::RECORDER_META, true) !== $recorder || !self::clear_post_meta_checked($log_id, array('_setae_log_shared'))) {
                    return new WP_Error('qr_transfer_recorder_failed', '元の記録者情報を保存できませんでした。', array('status' => 503));
                }
                $log_updated = wp_update_post(array('ID' => $log_id, 'post_author' => $to_user_id), true);
                $saved_log = get_post($log_id);
                if (is_wp_error($log_updated) || !$log_updated || !$saved_log || (int) $saved_log->post_author !== $to_user_id) {
                    return new WP_Error('qr_transfer_log_failed', '飼育履歴の所有者を更新できませんでした。', array('status' => 500));
                }
            }
            if (!self::write_post_meta_checked($request->ID, array(
                '_setae_transfer_status' => 'approved',
                '_setae_transfer_completed_at' => current_time('mysql'),
                '_setae_transfer_snapshot_id' => $snapshot_id,
                '_setae_transfer_spider_name' => $spider->post_title,
                '_setae_transfer_code' => $target->post_name,
            ))) {
                return new WP_Error('qr_transfer_request_save_failed', '引き継ぎ申請の完了状態を保存できませんでした。', array('status' => 503));
            }
            $notifications = self::cancel_pending_transfers($target_id, $request->ID, '別の引き継ぎが完了したため、申請は終了しました。', true);
            if (is_wp_error($notifications)) { return $notifications; }
            return array('snapshot_id' => $snapshot_id, 'notifications' => $notifications);
        });
        if (is_wp_error($transaction)) { return $transaction; }
        $snapshot_id = $transaction['snapshot_id'];
        foreach ($transaction['notifications'] as $notification) {
            self::add_notification($notification['user_id'], 'transfer_cancelled', $notification['message'], array('request_id' => $notification['request_id']));
        }

        if (class_exists('Setae_Product_Events')) {
            $event_context = array(
                'idempotency_key' => 'transfer-complete:' . $request->ID,
                'user_id' => $from_user_id,
                'object_type' => 'transfer',
                'object_id' => (int) $request->ID,
                'partner_user_id' => $from_user_id,
                'acquisition_source' => 'public_passport',
                'properties' => array(),
            );
            Setae_Entitlements::record_event('transfer_completed', $event_context);
            $event_context['idempotency_key'] = 'animal-received:' . $request->ID;
            $event_context['user_id'] = $to_user_id;
            $event_context['object_type'] = 'spider';
            $event_context['object_id'] = $spider_id;
            Setae_Entitlements::record_event('animal_received', $event_context);
        }

        $to = get_userdata($to_user_id);
        self::add_notification($from_user_id, 'transfer_completed', sprintf('「%s」を%sさんへ譲渡し、アーカイブへ保存しました。', $spider->post_title, $to ? $to->display_name : '新しい所有者'), array('snapshot_id' => $snapshot_id));
        self::add_notification($to_user_id, 'transfer_received', sprintf('「%s」の飼育記録を引き継ぎました。', $spider->post_title), array('spider_id' => $spider_id));

        return array(
            'success' => true,
            'spider_id' => $spider_id,
            'snapshot_id' => $snapshot_id,
            'request' => self::build_transfer_response($request, $from_user_id),
        );
    }

    private static function create_transfer_snapshot($spider, $from_user_id, $to_user_id, $request_id, $code)
    {
        global $wpdb;
        $snapshot_id = wp_insert_post(array(
            'post_type' => 'setae_spider',
            'post_status' => 'publish',
            'post_title' => $spider->post_title,
            'post_content' => $spider->post_content,
            'post_excerpt' => $spider->post_excerpt,
            'post_author' => $from_user_id,
        ), true);
        if (is_wp_error($snapshot_id) || !$snapshot_id) {
            return new WP_Error('qr_snapshot_failed', '譲渡記録をアーカイブへ保存できませんでした。', array('status' => 500));
        }
        self::track_transaction_post($snapshot_id);

        $skip = array(
            self::TARGET_ID_META,
            self::CODE_META,
            self::PUBLIC_META,
            self::PUBLIC_MODE_META,
            self::TRANSFER_ENABLED_META,
            Setae_Entitlements::SOURCE_META,
            '_setae_received_at',
            '_setae_spider_archived',
            '_setae_spider_archived_at',
            '_edit_lock',
            '_edit_last',
        );
        foreach (get_post_meta($spider->ID) as $key => $values) {
            if (in_array($key, $skip, true)) {
                continue;
            }
            foreach ((array) $values as $value) {
                if (!add_post_meta($snapshot_id, $key, wp_slash(maybe_unserialize($value)))) {
                    return new WP_Error('qr_snapshot_meta_failed', '譲渡前の個体情報を保存できませんでした。', array('status' => 503));
                }
            }
        }
        $terms = wp_get_object_terms($spider->ID, 'setae_classification', array('fields' => 'slugs'));
        if (is_wp_error($terms) || is_wp_error(wp_set_object_terms($snapshot_id, $terms, 'setae_classification'))) {
            return new WP_Error('qr_snapshot_terms_failed', '譲渡前の分類情報を保存できませんでした。', array('status' => 503));
        }
        $source = Setae_Entitlements::mark_specimen_source($snapshot_id, 'transfer_receipt');
        if (is_wp_error($source) || get_post_meta($snapshot_id, Setae_Entitlements::SOURCE_META, true) !== 'transfer_receipt'
            || !self::write_post_meta_checked($snapshot_id, array(
                '_setae_spider_archived' => '1',
                '_setae_spider_archived_at' => current_time('mysql'),
                '_setae_transfer_receipt' => '1',
                self::PUBLIC_MODE_META => 'private',
                '_setae_transfer_request_id' => absint($request_id),
                '_setae_transfer_original_spider_id' => (int) $spider->ID,
                '_setae_transfer_to_user' => absint($to_user_id),
                '_setae_transfer_original_code' => sanitize_text_field($code),
            ))) {
            return new WP_Error('qr_snapshot_receipt_failed', '枠外の譲渡控えを保存できませんでした。', array('status' => 503));
        }

        $logs = get_posts(array(
            'post_type' => 'setae_log',
            'post_status' => 'any',
            'posts_per_page' => -1,
            'meta_key' => '_setae_log_spider_id',
            'meta_value' => $spider->ID,
        ));
        if ($wpdb->last_error) { return new WP_Error('qr_snapshot_log_failed', '譲渡前の履歴を確認できませんでした。', array('status' => 503)); }
        foreach ($logs as $log) {
            // Capture legacy recorders before copying and before changing the source owner.
            self::track_transaction_post($log->ID);
            $recorder = Setae_Entitlements::mark_log_recorder($log->ID, (int) $log->post_author);
            if (!$recorder || (int) get_post_meta($log->ID, Setae_Entitlements::RECORDER_META, true) !== $recorder) {
                return new WP_Error('qr_snapshot_recorder_failed', '元の記録者情報を保存できませんでした。', array('status' => 503));
            }
            $new_log_id = wp_insert_post(array(
                'post_type' => 'setae_log',
                'post_status' => $log->post_status,
                'post_title' => $log->post_title,
                'post_content' => $log->post_content,
                'post_excerpt' => $log->post_excerpt,
                'post_author' => $from_user_id,
                'post_date' => $log->post_date,
                'post_date_gmt' => $log->post_date_gmt,
            ), true);
            if (is_wp_error($new_log_id) || !$new_log_id) {
                return new WP_Error('qr_snapshot_log_failed', '譲渡前の履歴を保存できませんでした。', array('status' => 500));
            }
            self::track_transaction_post($new_log_id);
            $skip_log_meta = array('_setae_log_shared', '_setae_is_best_shot', '_best_shot_status');
            foreach (get_post_meta($log->ID) as $key => $values) {
                if (in_array($key, $skip_log_meta, true)) {
                    continue;
                }
                foreach ((array) $values as $value) {
                    $meta_value = $key === '_setae_log_spider_id' ? $snapshot_id : maybe_unserialize($value);
                    if (!add_post_meta($new_log_id, $key, wp_slash($meta_value))) {
                        return new WP_Error('qr_snapshot_log_meta_failed', '譲渡前の履歴情報を保存できませんでした。', array('status' => 503));
                    }
                }
            }
            if ((int) get_post_meta($new_log_id, Setae_Entitlements::RECORDER_META, true) !== $recorder
                || (int) get_post_meta($new_log_id, '_setae_log_spider_id', true) !== (int) $snapshot_id) {
                return new WP_Error('qr_snapshot_log_meta_failed', '譲渡前の履歴と記録者情報を確認できませんでした。', array('status' => 503));
            }
        }

        return (int) $snapshot_id;
    }

    private static function cancel_pending_transfers($target_id, $except_request_id, $message, $defer_notifications = false)
    {
        global $wpdb;
        $notifications = array();
        $requests = get_posts(array(
            'post_type' => self::TRANSFER_POST_TYPE,
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'meta_query' => array(
                'relation' => 'AND',
                array('key' => '_setae_transfer_target_id', 'value' => absint($target_id)),
                array('key' => '_setae_transfer_status', 'value' => 'pending'),
            ),
        ));
        if (!empty($wpdb->last_error)) {
            return new WP_Error('qr_transfer_lookup_failed', '終了する引き継ぎ申請を確認できませんでした。', array('status' => 503));
        }
        foreach ($requests as $request) {
            if ((int) $request->ID === absint($except_request_id)) {
                continue;
            }
            if (!self::write_post_meta_checked($request->ID, array('_setae_transfer_status' => 'cancelled', '_setae_transfer_completed_at' => current_time('mysql')))) {
                return new WP_Error('qr_transfer_cancel_failed', '他の引き継ぎ申請の終了を保存できませんでした。', array('status' => 503));
            }
            $to_user_id = absint(get_post_meta($request->ID, '_setae_transfer_to_user', true));
            if ($to_user_id) {
                if ($defer_notifications) {
                    $notifications[] = array('user_id' => $to_user_id, 'message' => $message, 'request_id' => $request->ID);
                } else {
                    self::add_notification($to_user_id, 'transfer_cancelled', $message, array('request_id' => $request->ID));
                }
            }
        }
        return $notifications;
    }

    public static function add_notification($user_id, $type, $message, $data = array())
    {
        $notifications = get_user_meta($user_id, self::NOTIFICATION_META, true);
        $notifications = is_array($notifications) ? $notifications : array();
        array_unshift($notifications, array(
            'id' => wp_generate_uuid4(),
            'type' => sanitize_key($type),
            'message' => sanitize_text_field($message),
            'data' => is_array($data) ? $data : array(),
            'created_at' => current_time('mysql'),
            'read' => false,
        ));
        update_user_meta($user_id, self::NOTIFICATION_META, array_slice($notifications, 0, 50));
    }

    public static function get_notifications($user_id)
    {
        $notifications = get_user_meta($user_id, self::NOTIFICATION_META, true);
        return is_array($notifications) ? array_values($notifications) : array();
    }

    public static function mark_notifications_read($user_id)
    {
        $notifications = self::get_notifications($user_id);
        foreach ($notifications as &$notification) {
            $notification['read'] = true;
        }
        unset($notification);
        update_user_meta($user_id, self::NOTIFICATION_META, $notifications);
        return $notifications;
    }

    private static function sync_target_owner($target_id, $owner_id)
    {
        $target = get_post($target_id);
        if ($target && (int) $target->post_author !== (int) $owner_id) {
            self::track_transaction_post($target_id);
            $updated = wp_update_post(array('ID' => $target_id, 'post_author' => absint($owner_id)), true);
            if (is_wp_error($updated) || !$updated) { return new WP_Error('qr_target_owner_failed', 'QRの所有者を保存できませんでした。', array('status' => 503)); }
        }
        $target = get_post($target_id);
        return $target && (int) $target->post_author === absint($owner_id)
            ? $target : new WP_Error('qr_target_owner_failed', 'QRの所有者を確認できませんでした。', array('status' => 503));
    }

    private static function get_spider_species_name($spider_id)
    {
        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        if ($species_id) {
            return get_the_title($species_id);
        }
        return sanitize_text_field(get_post_meta($spider_id, '_setae_custom_species_name', true));
    }

    private static function get_spider_classification($spider_id)
    {
        $terms = get_the_terms($spider_id, 'setae_classification');
        return ($terms && !is_wp_error($terms)) ? $terms[0]->slug : 'tarantula';
    }

    private static function get_management_start_date($object_id)
    {
        $stored = self::normalize_label_date(get_post_meta($object_id, '_setae_management_start_date', true));
        if ($stored) {
            return $stored;
        }

        $post = get_post($object_id);
        if (!$post || empty($post->post_date)) {
            return '';
        }
        return self::normalize_label_date(substr((string) $post->post_date, 0, 10));
    }

    private static function get_spider_origin_birth_date($spider_id)
    {
        $stored = self::normalize_label_date(get_post_meta($spider_id, '_setae_baby_origin_birth_date', true));
        if ($stored) {
            return $stored;
        }

        $group_id = absint(get_post_meta($spider_id, '_setae_baby_origin_group_id', true));
        return $group_id
            ? self::normalize_label_date(get_post_meta($group_id, '_setae_baby_birth_date', true))
            : '';
    }

    private static function normalize_label_date($value)
    {
        $value = sanitize_text_field($value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
    }

    private static function abbreviate_species($species, $classification)
    {
        $species = trim(wp_strip_all_tags((string) $species));
        $parts = preg_split('/\s+/', $species);
        if (count($parts) >= 2 && preg_match('/^[A-Za-z]/', $parts[0]) && preg_match('/^[A-Za-z]/', $parts[1])) {
            return strtoupper(substr($parts[0], 0, 1)) . '.' . strtolower(substr(preg_replace('/[^A-Za-z]/', '', $parts[1]), 0, 10));
        }
        $ascii = preg_replace('/[^A-Za-z0-9]/', '', $species);
        if ($ascii) {
            return substr($ascii, 0, 12);
        }
        $fallbacks = array(
            'tarantula' => 'TARA',
            'scorpion' => 'SCORP',
            'reptile' => 'REPT',
            'plant' => 'PLANT',
            'other' => 'OTHER',
        );
        return isset($fallbacks[$classification]) ? $fallbacks[$classification] : 'SETAE';
    }

    private static function build_manage_code($title, $object_id, $baby_code)
    {
        $candidate = $baby_code ?: $title;
        $candidate = strtoupper(preg_replace('/[^A-Za-z0-9.-]/', '', (string) $candidate));
        if ($candidate) {
            return substr($candidate, -12);
        }
        return 'S' . strtoupper(substr(base_convert((string) absint($object_id), 10, 36), -5));
    }

    private static function normalize_baby_code($group_id, $baby_code)
    {
        $count = max(1, min(500, absint(get_post_meta($group_id, '_setae_baby_count', true))));
        $prefix = strtoupper(sanitize_key(get_post_meta($group_id, '_setae_baby_prefix', true)));
        $prefix = preg_replace('/[^A-Z0-9]/', '', $prefix);
        $prefix = $prefix ?: 'B';
        $padding = max(3, strlen((string) $count));
        $baby_code = strtoupper(trim((string) $baby_code));
        if (strpos($baby_code, $prefix) !== 0) {
            return '';
        }
        $number = absint(preg_replace('/[^0-9]/', '', substr($baby_code, strlen($prefix))));
        if ($number < 1 || $number > $count) {
            return '';
        }
        return $prefix . str_pad((string) $number, $padding, '0', STR_PAD_LEFT);
    }

    private static function get_baby_item($group_id, $baby_code)
    {
        $baby_code = self::normalize_baby_code($group_id, $baby_code);
        if (!$baby_code) {
            return null;
        }
        $changes = get_post_meta($group_id, '_setae_baby_items', true);
        $change = is_array($changes) && isset($changes[$baby_code]) && is_array($changes[$baby_code]) ? $changes[$baby_code] : array();
        $status = 'alive';
        if (!empty($change['transferred_spider_id']) || (isset($change['status']) && $change['status'] === 'transferred')) {
            $status = 'transferred';
        } elseif (isset($change['status']) && $change['status'] === 'dead') {
            $status = 'dead';
        } elseif (isset($change['status']) && $change['status'] === 'rehomed') {
            $status = 'rehomed';
        }
        return array_merge($change, array('code' => $baby_code, 'status' => $status));
    }
}
