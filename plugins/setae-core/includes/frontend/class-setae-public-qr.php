<?php

/** Request controller and explicit public view-model for permanent QR passports. */
class Setae_Public_QR
{
    private $version;
    private $page_data = null;
    private $page_code = '';

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function register_query_var($vars)
    {
        $vars[] = 'setae_qr';
        return $vars;
    }

    public function render_page()
    {
        $code = $this->get_requested_code();
        if (!$code) {
            return;
        }
        $rate_limit = Setae_App_Operations::consume_request_limit('qr_passport_page', 180, 5 * MINUTE_IN_SECONDS);
        if (is_wp_error($rate_limit)) {
            wp_die(esc_html($rate_limit->get_error_message()), 'SETAE', array('response' => 429));
        }
        $target = Setae_QR_Manager::get_target_by_code($code);
        if (!$target) {
            $missing_limit = Setae_App_Operations::consume_request_limit('qr_passport_page_missing', 20, 10 * MINUTE_IN_SECONDS);
            if (is_wp_error($missing_limit)) {
                wp_die(esc_html($missing_limit->get_error_message()), 'SETAE', array('response' => 429));
            }
            return;
        }
        global $wp_query;
        status_header(200);
        if ($wp_query) {
            $wp_query->is_404 = false;
        }
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        nocache_headers();

        // Keep the existing nonce, POST fields, request action and PRG redirects.
        $message = '';
        $message_type = 'success';
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['setae_qr_claim'])) {
            if (!is_user_logged_in()) {
                wp_safe_redirect(Setae_App_Shell::login_url(add_query_arg('claim', '1', Setae_QR_Manager::get_short_url($code))));
                exit;
            }
            if (!isset($_POST['setae_qr_claim_nonce']) || !is_scalar($_POST['setae_qr_claim_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['setae_qr_claim_nonce'])), 'setae_qr_claim_' . $code)) {
                $message = '確認の有効期限が切れました。もう一度お試しください。';
                $message_type = 'error';
            } else {
                $request = Setae_QR_Manager::create_transfer_request($target, get_current_user_id());
                if (is_wp_error($request)) {
                    $message = $request->get_error_message();
                    $message_type = 'error';
                } else {
                    wp_safe_redirect(add_query_arg('requested', '1', Setae_QR_Manager::get_short_url($code)));
                    exit;
                }
            }
        }
        $data = Setae_QR_Manager::get_public_target_data($target, get_current_user_id());
        if (!$data) {
            status_header(404);
            return;
        }
        // A query string alone is not evidence that an application was accepted.
        if (isset($_GET['requested']) && !empty($data['request_status']) && $message_type !== 'error') {
            $message = '引き継ぎ申請を送信しました。現在の所有者の承認をお待ちください。';
        }
        $this->page_data = $data;
        $this->page_code = $code;
        $context = $this->build_template_context($data, $code, $message, $message_type);

        show_admin_bar(false);
        add_filter('pre_get_document_title', array($this, 'filter_document_title'));
        add_filter('body_class', array($this, 'add_body_class'));
        add_action('wp_head', array($this, 'render_meta_tags'), 1);
        add_action('wp_enqueue_scripts', array($this, 'isolate_passport_assets'), 1000);
        add_action('wp_print_styles', array($this, 'isolate_passport_assets'), 1000);
        add_action('wp_print_scripts', array($this, 'isolate_passport_assets'), 1000);
        add_action('wp_print_footer_scripts', array($this, 'isolate_passport_assets'), 0);
        remove_action('wp_head', '_wp_render_title_tag', 1);
        remove_action('wp_head', 'rel_canonical');
        remove_action('wp_head', 'wp_robots', 1);
        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_enqueue_scripts', 'wp_enqueue_emoji_styles');
        remove_action('wp_head', '_admin_bar_bump_cb');
        remove_action('wp_head', 'wp_custom_css_cb', 101);
        remove_action('wp_head', '_custom_background_cb');
        Setae_Public_Home::enqueue_passport($this->version);
        $this->render_document($context);
        exit;
    }

    public function redirect_pending_claim($redirect_to, $requested_redirect_to, $user)
    {
        if (is_wp_error($user) || !($user instanceof WP_User)) {
            return $redirect_to;
        }
        $code = Setae_QR_Manager::get_pending_claim($user->ID);
        if (!$code) {
            return $redirect_to;
        }
        $target = Setae_QR_Manager::get_target_by_code($code);
        $label = $target ? Setae_QR_Manager::get_target_label_data($target) : null;
        global $wpdb;
        if ((!$label || $label['target_type'] !== 'spider') && !empty($wpdb->last_error)) {
            return $redirect_to; // A failed lookup is not proof that the target disappeared.
        }
        if (!$label || $label['target_type'] !== 'spider' || (int) $target->post_author === (int) $user->ID
            || get_post_meta($label['object_id'], '_setae_transfer_receipt', true) === '1') {
            Setae_QR_Manager::clear_pending_claim($user->ID, $code);
            return $redirect_to;
        }
        return add_query_arg('claim', '1', Setae_QR_Manager::get_short_url($code));
    }

    /** The standalone document must not inherit theme or legacy app assets. */
    public function isolate_passport_assets()
    {
        global $wp_styles, $wp_scripts;
        $allowed = array('setae-public-foundation', 'setae-public-passport', 'setae-public-registration', 'setae-public-product-events');
        foreach ((array) ($wp_styles->queue ?? array()) as $handle) {
            if (!in_array($handle, $allowed, true)) {
                wp_dequeue_style($handle);
            }
        }
        foreach ((array) ($wp_scripts->queue ?? array()) as $handle) {
            if (!in_array($handle, $allowed, true)) {
                wp_dequeue_script($handle);
            }
        }
    }

    public function filter_document_title($title)
    {
        $seo = $this->build_seo_context($this->page_data ?: array(), $this->page_code);
        return $seo['title'];
    }

    public function add_body_class($classes)
    {
        $classes[] = 'setae-public-document';
        $classes[] = 'setae-qr-public-document';
        return array_unique($classes);
    }

    public function render_meta_tags()
    {
        $seo = $this->build_seo_context($this->page_data ?: array(), $this->page_code);
        echo '<meta name="robots" content="noindex,follow">' . "\n";
        echo '<link rel="canonical" href="' . esc_url($seo['canonical']) . '">' . "\n";
        foreach (array('description' => $seo['description'], 'twitter:card' => $seo['image'] ? 'summary_large_image' : 'summary', 'twitter:title' => $seo['title'], 'twitter:description' => $seo['description']) as $name => $value) {
            echo '<meta name="' . esc_attr($name) . '" content="' . esc_attr($value) . '">' . "\n";
        }
        foreach (array('og:type' => 'profile', 'og:site_name' => 'SETAE', 'og:title' => $seo['title'], 'og:description' => $seo['description'], 'og:url' => $seo['canonical']) as $name => $value) {
            echo '<meta property="' . esc_attr($name) . '" content="' . esc_attr($value) . '">' . "\n";
        }
        if ($seo['image']) {
            echo '<meta property="og:image" content="' . esc_url($seo['image']) . '">' . "\n";
            echo '<meta property="og:image:alt" content="' . esc_attr($seo['image_alt']) . '">' . "\n";
            echo '<meta name="twitter:image" content="' . esc_url($seo['image']) . '">' . "\n";
        }
    }

    private function build_seo_context($data, $code)
    {
        $visibility = $data['visibility'] ?? 'private';
        $public = empty($data['private']) && !empty($data['is_public']) && in_array($visibility, array('basic', 'life_history'), true);
        $label = $public ? ($data['label'] ?? array()) : array();
        $name = $this->normalize_display_text($label['title'] ?? '');
        $species = $this->normalize_display_text($label['species_name'] ?? '');
        $canonical = Setae_QR_Manager::get_short_url($code ?: ($data['label']['code'] ?? ''));
        $canonical = remove_query_arg(array('claim', 'requested', 'register', 'ref'), $canonical);
        return array(
            'title' => $public ? (($name ?: '公開個体') . ' | SETAE') : 'SETAE 管理QR',
            'description' => $public
                ? ($name ?: '公開個体') . ($species ? '（' . $species . '）' : '') . ($visibility === 'life_history' ? 'の公開個体パスポート。公開された生活史と写真記録。' : 'の公開個体パスポート。所有者が公開している基本情報。')
                : 'SETAEの管理QRページです。個体の公開範囲は所有者が設定します。',
            'canonical' => $canonical,
            'image' => $public ? esc_url_raw($label['image'] ?? '') : '',
            'image_alt' => $public ? ($name ?: '公開個体') . 'の写真' : '',
        );
    }

    /** Safe acquisition status may be shown even when the specimen itself is private. */
    private function claim_notice($code, $data)
    {
        if (!is_user_logged_in() || !isset($_GET['claim_error']) || !is_string($_GET['claim_error'])) {
            return null;
        }
        $user_id = get_current_user_id();
        if ((int) get_user_meta($user_id, '_setae_is_verified', true) !== 1
            || $code !== Setae_QR_Manager::sanitize_code(get_user_meta($user_id, Setae_Claim_Registration::RETURN_CODE_META, true))) {
            return null;
        }
        $messages = array(
            'claim_closed' => 'この個体は現在、引き継ぎを受け付けていません。現在の所有者にご確認ください。',
            'claim_already_owned' => 'この個体はすでにあなたが管理しています。',
            'claim_unavailable' => '引き継ぎ申請を完了できませんでした。受付中の場合は、このページからもう一度申請してください。',
        );
        $error = $_GET['claim_error'];
        if (!isset($messages[$error]) || !empty($data['request_status'])
            || ($error === 'claim_already_owned' && empty($data['is_owner']))
            || ($error === 'claim_closed' && !empty($data['transfer_enabled']) && empty($data['label']['archived']))) {
            return null;
        }
        return array('type' => 'danger', 'text' => $messages[$error]);
    }

    /** Pure state resolution: an explicit private flag always fails closed. */
    private function resolve_passport_mode($data)
    {
        if (!empty($data['is_owner'])) {
            return 'owner';
        }
        if (!empty($data['private'])) {
            return 'private';
        }
        if (!empty($data['is_public']) && in_array($data['visibility'] ?? '', array('basic', 'life_history'), true)) {
            return $data['visibility'];
        }
        if (!empty($data['transfer_enabled']) && empty($data['label']['archived'])) {
            return 'transfer';
        }
        return 'private';
    }

    /** No raw label, owner object, internal notes or task data cross this boundary. */
    private function build_template_context($data, $code, $message = '', $message_type = 'success')
    {
        $mode = $this->resolve_passport_mode($data);
        $is_owner = $mode === 'owner';
        $visitor_data = $data;
        $visitor_data['is_owner'] = false;
        $visitor_data['private'] = empty($data['is_public']) && (empty($data['transfer_enabled']) || !empty($data['label']['archived']));
        $visitor_mode = $is_owner ? $this->resolve_passport_mode($visitor_data) : $mode;
        $labels = array('private' => '非公開の管理QR', 'transfer' => '引き継ぎ受付中', 'basic' => '公開個体・基本情報', 'life_history' => '公開個体・生活史');
        $current_url = Setae_QR_Manager::get_short_url($code);
        $is_logged_in = is_user_logged_in();
        $can_share = $visitor_mode !== 'private';
        $transfer_enabled = $mode !== 'private' && !empty($data['transfer_enabled']) && empty($data['label']['archived']);
        $context = array(
            'mode' => $mode,
            'visitor_mode' => $visitor_mode,
            'state_label' => $labels[$visitor_mode],
            'is_owner' => $is_owner,
            'is_logged_in' => $is_logged_in,
            'can_share' => $can_share,
            'identity' => array(),
            'hero' => null,
            'gallery' => array(),
            'summary' => array(),
            'care_summary' => array(),
            'history' => array('items' => array(), 'limit' => 20, 'note' => ''),
            'owner' => array(),
            'messages' => array(),
            'actions' => array(
                'home_url' => home_url('/'),
                'app_url' => Setae_App_Shell::app_url(),
                'login_url' => Setae_App_Shell::login_url($current_url),
                'claim_login_url' => Setae_App_Shell::login_url(add_query_arg('claim', '1', $current_url)),
                'register_url' => Setae_App_Shell::app_url(array('setae_auth' => 'register')),
                'share_url' => $can_share ? $current_url : '',
                'share_title' => 'SETAE 管理QR',
                'share_text' => 'SETAEの管理QRページです。',
                'transfer_enabled' => $transfer_enabled,
                'request_status' => $transfer_enabled && $is_logged_in ? sanitize_key($data['request_status'] ?? '') : '',
                'claim_code' => $transfer_enabled && !$is_owner ? $code : '',
                'claim_url' => $transfer_enabled && !$is_owner ? $current_url : '',
            ),
            'registration' => Setae_Public_Registration::build_context('public_passport', array(
                'qr_claim_code' => $mode !== 'private' && !$is_owner ? $code : '',
                'qr_claim_intent' => $transfer_enabled && !$is_owner ? 'request_after_verification' : '',
                'enabled' => $mode !== 'private' && !$is_owner,
                'title' => $transfer_enabled ? '引き継ぎの準備をする' : '無料で始める',
                'description' => $transfer_enabled ? '認証とログイン後、この個体の引き継ぎを申請できます。現在の所有者の承認で引き継ぎが完了します。' : 'メール認証後、最初の個体を登録できます。',
            )),
            'seo' => $this->build_seo_context($data, $code),
        );
        if ($message && $mode !== 'private') {
            $context['messages'][] = array('text' => sanitize_text_field($message), 'type' => $message_type === 'error' ? 'danger' : 'success');
        }
        $claim_notice = $this->claim_notice($code, $data);
        if ($claim_notice) { $context['messages'][] = $claim_notice; }
        if ($mode === 'private') {
            return $context;
        }
        $label = $data['label'] ?? array();
        $title = $this->normalize_display_text($label['title'] ?? '') ?: '個体';
        $species = $this->normalize_display_text($label['species_name'] ?? '') ?: '種類未設定';
        $context['identity'] = array(
            'title' => $title,
            'species_name' => $species,
            'code' => strtoupper($code),
            'classification' => sanitize_key($label['classification'] ?? 'tarantula'),
            'gender' => $this->get_gender_label($data['gender'] ?? 'unknown'),
            'stage' => $this->get_stage_label($data['stage'] ?? 'undetermined'),
            'origin' => $this->get_origin_label($data['origin'] ?? ''),
            'family_name' => $this->normalize_display_text($data['family_name'] ?? ''),
        );
        $show_history = $visitor_mode === 'life_history';
        $gallery_data = array('gallery' => $show_history ? ($data['gallery'] ?? array()) : array());
        $context['gallery'] = $this->build_public_gallery($label, $gallery_data);
        $context['hero'] = $context['gallery'][0] ?? null;
        if (in_array($visitor_mode, array('basic', 'life_history'), true)) {
            $context['actions']['share_title'] = $title . ' | SETAE';
            $context['actions']['share_text'] = $title . '（' . $species . '）の公開個体パスポート';
        }
        if ($show_history) {
            $history = $this->build_history_items($data['life_history'] ?? array(), $context['gallery'], true, 20);
            $context['history'] = array('items' => $history, 'limit' => 20, 'note' => count($history) >= 20 ? '最新20件を表示' : '最新の公開記録（最大20件）');
            $dates = array_filter(array_merge(array_column($history, 'date'), array_column($context['gallery'], 'date')));
            rsort($dates);
            $context['summary'] = array(
                array('label' => '管理日数', 'value' => !empty($data['management_days']) ? number_format_i18n(absint($data['management_days'])) . '日' : '—'),
                array('label' => '公開記録', 'value' => number_format_i18n(count($history)) . '件', 'note' => '表示中の生活史'),
                array('label' => '最終公開', 'value' => $this->format_public_date($dates[0] ?? '')),
            );
            // Raw last_* and record_count include private records. Use only public items.
            $context['care_summary'] = $this->build_care_summary(array_merge($history, $context['gallery']));
        }
        if ($is_owner) {
            $manage_url = Setae_App_Shell::app_url(array('setae_qr_scan' => $code, 'setae_qr_action' => 'open'));
            $context['owner'] = array(
                'private_identity' => $visitor_mode === 'private',
                'manage_url' => $manage_url,
                'settings_url' => $manage_url,
                'qr_url' => Setae_App_Shell::app_url(array('setae_qr_scan' => $code)),
                'has_settings' => ($label['target_type'] ?? '') === 'spider',
                'history' => $this->build_history_items($data['recent_activity'] ?? array(), array(), false, 6),
                'history_limit' => 6,
                'summary' => array(
                    array('label' => '管理記録', 'value' => number_format_i18n(absint($data['record_count'] ?? 0)) . '件'),
                    array('label' => '最終記録', 'value' => $this->format_public_date($data['latest_record_date'] ?? '')),
                ),
                'care_summary' => $this->build_care_summary(array(
                    array('type' => 'feed', 'date' => $data['last_feed'] ?? ''),
                    array('type' => 'molt', 'date' => $data['last_molt'] ?? ''),
                    array('type' => 'observation', 'date' => $data['last_observation'] ?? ''),
                    array('type' => 'pairing', 'date' => $data['last_pairing'] ?? ''),
                )),
            );
        }
        return $context;
    }

    private function render_document($context)
    {
        if (class_exists('Setae_Product_Events')) {
            $event_context = array();
            if (!empty($context['can_share']) && !empty($this->page_data['label']['object_id'])) {
                $event_context = array('object_type' => 'spider', 'object_id' => absint($this->page_data['label']['object_id']));
            }
            wp_enqueue_script('setae-public-product-events', SETAE_PLUGIN_URL . 'assets/js/public-product-events.js', array(), $this->version, true);
            wp_add_inline_script('setae-public-product-events', 'window.SetaeProductEventsConfig=' . wp_json_encode(Setae_Product_Events::public_config('passport', $event_context)) . ';', 'before');
        }
        $setae_passport = $context;
        require SETAE_PLUGIN_DIR . 'templates/public/passport-document.php';
    }

    private function is_public_item($item)
    {
        if (!is_array($item) || !empty($item['private']) || ($item['visibility'] ?? '') === 'private') {
            return false;
        }
        foreach (array('is_public', '_is_public', 'public', 'shared', '_setae_log_shared') as $key) {
            if (array_key_exists($key, $item) && !filter_var($item[$key], FILTER_VALIDATE_BOOLEAN)) {
                return false;
            }
        }
        return true;
    }

    private function build_history_items($items, $gallery, $public_only, $limit)
    {
        $history = array();
        foreach ((array) $items as $item) {
            if (!is_array($item) || ($public_only && !$this->is_public_item($item))) {
                continue;
            }
            $type = sanitize_key($item['type'] ?? 'record');
            if ($public_only && !in_array($type, array('molt', 'growth', 'pairing'), true)) {
                continue;
            }
            $date = (string) ($item['date'] ?? '');
            $display_date = $this->format_public_date($date);
            if ($display_date === '—') {
                continue;
            }
            $photo_count = count(array_filter($gallery, function ($photo) use ($date, $type) {
                return ($photo['date'] ?? '') === $date && ($photo['type'] ?? '') === $type;
            }));
            $history[] = array('type' => $type, 'label' => $this->get_log_type_label($type), 'date' => $date, 'display_date' => $display_date, 'summary' => $this->get_log_type_label($type) . 'の記録', 'photo_count' => $photo_count);
        }
        usort($history, function ($a, $b) { return strcmp($b['date'], $a['date']); });
        return array_slice($history, 0, $limit);
    }

    private function build_care_summary($items)
    {
        $latest = array();
        foreach ($items as $item) {
            $type = sanitize_key($item['type'] ?? '');
            $date = (string) ($item['date'] ?? '');
            if ($this->format_public_date($date) !== '—' && $date > ($latest[$type] ?? '')) {
                $latest[$type] = $date;
            }
        }
        $summary = array();
        foreach (array('feed' => '最終給餌', 'molt' => '最終脱皮', 'observation' => '最終観察', 'pairing' => 'ペアリング') as $type => $label) {
            $summary[] = array('label' => $label, 'date' => $latest[$type] ?? '', 'value' => $this->format_public_date($latest[$type] ?? ''));
        }
        return $summary;
    }

    private function build_public_gallery($label, $data)
    {
        $gallery = array();
        $seen = array();
        $primary = esc_url_raw($label['image'] ?? '');
        $primary_source = sanitize_key($label['image_source'] ?? 'none');
        $append = function ($url, $date, $photo_label, $type = '') use (&$gallery, &$seen) {
            $url = esc_url_raw($url);
            if (!$url || isset($seen[$url])) {
                return;
            }
            $seen[$url] = true;
            $valid_date = $this->format_public_date($date) !== '—' ? (string) $date : '';
            $gallery[] = array('url' => $url, 'date' => $valid_date, 'display_date' => $valid_date ? $this->format_public_date($valid_date) : '', 'label' => sanitize_text_field($photo_label), 'type' => sanitize_key($type));
        };
        if ($primary && $primary_source === 'individual') {
            $append($primary, '', '現在の個体写真');
        }
        foreach ((array) ($data['gallery'] ?? array()) as $photo) {
            if (!$this->is_public_item($photo)) {
                continue;
            }
            $photo_label = !empty($photo['label']) ? sanitize_text_field($photo['label']) . 'の記録' : '飼育記録の写真';
            $append($photo['url'] ?? '', $photo['date'] ?? '', $photo_label, $photo['type'] ?? '');
        }
        if ($primary && $primary_source !== 'individual') {
            $append($primary, '', $primary_source === 'enclosure' ? '管理対象の写真' : '種類の参考写真');
        }
        return array_slice($gallery, 0, 9);
    }

    private function normalize_display_text($value)
    {
        $text = wp_strip_all_tags((string) $value);
        for ($pass = 0; $pass < 2; $pass++) {
            $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($decoded === $text) {
                break;
            }
            $text = $decoded;
        }
        return trim(wp_strip_all_tags($text));
    }

    private function format_public_date($date, $format = 'Y.m.d')
    {
        $date = sanitize_text_field($date);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return '—';
        }
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, wp_timezone());
        return $parsed && $parsed->format('Y-m-d') === $date ? $parsed->format($format) : '—';
    }

    private function get_gender_label($gender)
    {
        $labels = array('female' => 'メス', 'male' => 'オス', 'unknown' => '未判定');
        return $labels[sanitize_key($gender)] ?? '未判定';
    }

    private function get_stage_label($stage)
    {
        $stage = sanitize_key($stage);
        if (preg_match('/^instar_(\d{1,2})$/', $stage, $matches)) {
            return absint($matches[1]) . '齢';
        }
        $labels = array('juvenile' => '幼体', 'subadult' => '亜成体', 'adult' => '成体', 'undetermined' => '未判定');
        return $labels[$stage] ?? '未判定';
    }

    private function get_origin_label($origin)
    {
        $labels = array('CB' => '飼育下繁殖（CB）', 'CBB' => '飼育下出生・繁殖（CBB）', 'WC' => '野外採集（WC）', 'CB/WC' => '飼育下繁殖／野外採集（CB/WC）', 'CAPTIVE BRED' => '飼育下繁殖', 'WILD CAUGHT' => '野外採集');
        return $labels[strtoupper(trim((string) $origin))] ?? '—';
    }

    private function get_log_type_label($type)
    {
        $labels = array('feed' => '給餌', 'feeding' => '給餌', 'molt' => '脱皮', 'growth' => '成長', 'pairing' => 'ペアリング', 'observation' => '観察', 'cleaning' => '環境整備', 'water' => '給水', 'health' => '健康記録', 'photo' => '写真');
        return $labels[$type] ?? '飼育記録';
    }

    private function get_requested_code()
    {
        $query_code = get_query_var('setae_qr');
        if (!$query_code && isset($_GET['setae_qr'])) {
            $query_code = sanitize_text_field(wp_unslash($_GET['setae_qr']));
        }
        if ($query_code) {
            return Setae_QR_Manager::sanitize_code($query_code);
        }
        if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return '';
        }
        $path = trim((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
        if (!$path || strpos($path, '/') !== false) {
            return '';
        }
        return Setae_QR_Manager::sanitize_code(rawurldecode($path));
    }
}
