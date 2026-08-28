<?php

class Setae_Public_Profile
{
    const QUERY_VAR = 'setae_profile';
    const REWRITE_OPTION = 'setae_public_profile_rewrite_version';

    private $version;
    private $current_profile = null;
    private $not_found = false;

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function register_rewrite_rule()
    {
        add_rewrite_rule('^setae-user/([^/]+)/?$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top');
    }

    public function register_query_var($vars)
    {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    public function maybe_flush_rewrite_rules()
    {
        if (get_option(self::REWRITE_OPTION) === $this->version) {
            return;
        }

        flush_rewrite_rules(false);
        update_option(self::REWRITE_OPTION, $this->version, false);
    }

    public function render_profile_page()
    {
        $code = (string) get_query_var(self::QUERY_VAR);
        if (!$code && isset($_GET[self::QUERY_VAR])) {
            $code = (string) wp_unslash($_GET[self::QUERY_VAR]);
        }

        $code = $this->normalize_referral_code($code);
        if (!$code) {
            return;
        }

        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        nocache_headers();

        $profile = $this->build_profile($code);
        $this->current_profile = $profile;
        $this->not_found = !$profile;
        if ($this->not_found) {
            status_header(404);
        }

        add_filter('wp_title', array($this, 'filter_wp_title'), 10, 3);
        add_filter('pre_get_document_title', array($this, 'filter_document_title'));
        add_filter('body_class', array($this, 'add_body_class'));
        add_action('wp_head', array($this, 'render_meta_tags'), 1);
        add_action('wp_enqueue_scripts', array($this, 'isolate_profile_assets'), 1000);
        add_action('wp_print_styles', array($this, 'isolate_profile_assets'), 1000);
        Setae_Public_Home::enqueue_public_profile($this->version);

        $this->render_document($profile);
        exit;
    }

    public function filter_wp_title($title, $sep, $seplocation)
    {
        $page_title = $this->profile_title();
        return $page_title ? $page_title . ' ' . $sep . ' ' : $title;
    }

    public function filter_document_title($title)
    {
        return $this->profile_title() ?: $title;
    }

    public function add_body_class($classes)
    {
        $classes[] = 'setae-public-profile-document';
        return $classes;
    }

    public function render_meta_tags()
    {
        if ($this->not_found) {
            echo '<meta name="robots" content="noindex,follow">' . "\n";
            return;
        }

        if (!$this->current_profile) {
            return;
        }

        $profile = $this->current_profile;
        ?>
        <meta name="description" content="<?php echo esc_attr($profile['meta_description']); ?>">
        <link rel="canonical" href="<?php echo esc_url($profile['profile_url']); ?>">
        <meta property="og:type" content="profile">
        <meta property="og:site_name" content="SETAE">
        <meta property="og:title" content="<?php echo esc_attr($profile['meta_title']); ?>">
        <meta property="og:description" content="<?php echo esc_attr($profile['meta_description']); ?>">
        <meta property="og:url" content="<?php echo esc_url($profile['profile_url']); ?>">
        <meta property="og:image" content="<?php echo esc_url($profile['og_image']); ?>">
        <meta property="og:image:alt" content="<?php echo esc_attr($profile['name'] . 'の公開プロフィール'); ?>">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="<?php echo esc_attr($profile['meta_title']); ?>">
        <meta name="twitter:description" content="<?php echo esc_attr($profile['meta_description']); ?>">
        <meta name="twitter:image" content="<?php echo esc_url($profile['og_image']); ?>">
        <script type="application/ld+json"><?php echo wp_json_encode(array(
            '@context' => 'https://schema.org',
            '@type' => 'ProfilePage',
            'url' => $profile['profile_url'],
            'name' => $profile['meta_title'],
            'mainEntity' => array(
                '@type' => 'Person',
                'name' => $profile['name'],
                'url' => $profile['profile_url'],
                'image' => $profile['avatar'] ?: null,
                'memberOf' => array(
                    '@type' => 'Organization',
                    'name' => 'SETAE',
                    'url' => home_url('/'),
                ),
            ),
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
        <?php
    }

    public function isolate_profile_assets()
    {
        $handles = array(
            'setae-public-pages',
            'setae-global',
            'setae-layout',
            'setae-cards',
            'setae-modals',
            'setae-views',
            'setae-unified-design',
            'setae-dark-mode',
            'setae-specimen-dashboard',
        );
        foreach ($handles as $handle) {
            wp_dequeue_style($handle);
        }
    }

    private function profile_title()
    {
        if ($this->current_profile) {
            return $this->current_profile['meta_title'];
        }
        return $this->not_found ? 'プロフィールが見つかりません | SETAE' : '';
    }

    private function render_document($profile)
    {
        $setae_profile = $profile;
        $setae_not_found = $this->not_found;
        $registration = Setae_Public_Registration::build_context('public_profile', array(
            'enabled' => !$this->not_found,
            'referral_code' => $profile ? $profile['referral_code'] : '',
            'analytics_id' => $profile ? $profile['user_id'] : 0,
        ));
        $setae_context = array(
            'is_logged_in' => is_user_logged_in(),
            'registration_enabled' => $registration['enabled'],
            'registration' => $registration,
            'app_url' => Setae_App_Shell::app_url(),
            'login_url' => Setae_App_Shell::login_url($profile ? $profile['profile_url'] : home_url('/')),
            'register_url' => Setae_App_Shell::app_url(array('setae_auth' => 'register')),
            'home_url' => home_url('/'),
        );
        require SETAE_PLUGIN_DIR . 'templates/public/profile-document.php';
    }

    private function build_profile($referral_code)
    {
        $users = get_users(array(
            'meta_key' => '_setae_referral_code',
            'meta_value' => $referral_code,
            'number' => 1,
            'fields' => 'all',
        ));

        if (empty($users)) {
            return null;
        }

        $user = $users[0];
        $user_id = (int) $user->ID;
        $name = trim((string) $user->display_name);
        if (!$name) {
            $name = 'SETAEユーザー';
        }
        $public_handle = Setae_Public_Identity::get_handle($user_id);
        $avatar = $this->resolve_avatar($user_id);

        $profile_url = $this->get_profile_url($referral_code);
        $invite_url = add_query_arg('ref', $referral_code, $profile_url);
        $log_query = new WP_Query(array(
            'post_type' => 'setae_log',
            'post_status' => 'publish',
            'author' => $user_id,
            'meta_key' => '_setae_log_date',
            'orderby' => 'meta_value',
            'order' => 'DESC',
            'posts_per_page' => 9,
            'meta_query' => array(
                array(
                    'key' => '_setae_log_shared',
                    'value' => 1,
                    'compare' => '=',
                ),
            ),
        ));

        $logs = array();
        foreach ($log_query->posts as $post) {
            $item = $this->build_log_item($post->ID, $referral_code);
            if ($item) {
                $logs[] = $item;
            }
        }

        $shared_count = (int) $log_query->found_posts;
        $spider_count = count_user_posts($user_id, 'setae_spider', true);
        $latest_label = !empty($logs) ? $logs[0]['display_date_short'] : '未公開';
        $lead = $shared_count > 0
            ? 'SETAEで共有されているお世話記録をまとめて見られます。'
            : 'SETAEで個体管理をしているユーザーの公開プロフィールです。';
        $share_text = $this->build_profile_share_text($name);

        return array(
            'user_id' => $user_id,
            'name' => $name,
            'public_handle' => $public_handle,
            'initial' => $this->first_character($name),
            'avatar' => $avatar,
            'referral_code' => $referral_code,
            'profile_url' => $profile_url,
            'invite_url' => $invite_url,
            'share_text' => $share_text,
            'share_copy_text' => $share_text . "\n" . $invite_url,
            'x_share_url' => 'https://twitter.com/intent/tweet?' . http_build_query(array(
                'text' => $share_text,
                'url' => $invite_url,
            )),
            'line_share_url' => 'https://social-plugins.line.me/lineit/share?' . http_build_query(array(
                'url' => $invite_url,
            )),
            'og_image' => $avatar ?: $this->get_default_og_image(),
            'meta_title' => $name . 'の公開プロフィール | SETAE',
            'meta_description' => $this->make_excerpt($name . 'さんの共有お世話記録をSETAEで見る。写真、給餌、脱皮、成長メモを個体ごとに残せます。', 120),
            'lead' => $lead,
            'logs' => $logs,
            'visible_count' => count($logs),
            'is_limited' => $shared_count > count($logs),
            'shared_count' => $shared_count,
            'spider_count' => (int) $spider_count,
            'latest_label' => $latest_label,
        );
    }

    private function build_log_item($log_id, $referral_code)
    {
        if ((int) get_post_meta($log_id, '_setae_log_shared', true) !== 1) {
            return null;
        }

        $spider_id = (int) get_post_meta($log_id, '_setae_log_spider_id', true);
        $spider = $spider_id ? get_post($spider_id) : null;
        if (!$spider || $spider->post_type !== 'setae_spider') {
            return null;
        }

        $raw_data = get_post_meta($log_id, '_setae_log_data', true);
        $data = is_string($raw_data) ? json_decode($raw_data, true) : $raw_data;
        if (!is_array($data)) {
            $data = array();
        }

        $species_id = get_post_meta($spider_id, '_setae_species_id', true);
        $custom_name = get_post_meta($spider_id, '_setae_custom_species_name', true);
        $species_name = $species_id ? get_the_title($species_id) : ($custom_name ?: '種類不明');
        $terms = get_the_terms($spider_id, 'setae_classification');
        $classification = ($terms && !is_wp_error($terms)) ? $terms[0]->slug : 'tarantula';
        $log_type = get_post_meta($log_id, '_setae_log_type', true);
        $log_date = get_post_meta($log_id, '_setae_log_date', true);
        $image = get_post_meta($log_id, '_setae_log_image', true);
        if (!$image) {
            $image = get_post_meta($spider_id, '_setae_spider_image', true);
        }
        if (!$image && $species_id) {
            $image = get_the_post_thumbnail_url($species_id, 'large');
        }

        $note = !empty($data['note']) ? sanitize_textarea_field($data['note']) : '';
        $type_label = $this->get_log_type_label($log_type, $classification);

        return array(
            'id' => $log_id,
            'spider_title' => get_the_title($spider_id),
            'species_name' => $species_name,
            'type_label' => $type_label,
            'classification_label' => $this->get_classification_label($classification),
            'classification' => $classification,
            'classification_emoji' => $this->get_classification_emoji($classification),
            'image' => $image ?: '',
            'summary' => $note ? $this->make_excerpt($note, 72) : $type_label . 'の公開記録です。',
            'date_iso' => $log_date ?: '',
            'display_date' => $this->format_date($log_date),
            'display_date_short' => $this->format_date_short($log_date),
            'share_url' => add_query_arg('ref', $referral_code, $this->get_care_share_url($log_id)),
        );
    }

    private function get_profile_url($referral_code)
    {
        if (get_option('permalink_structure')) {
            return home_url('/setae-user/' . rawurlencode($referral_code) . '/');
        }

        return add_query_arg(self::QUERY_VAR, $referral_code, home_url('/'));
    }

    private function resolve_avatar($user_id)
    {
        $attachment_id = absint(get_user_meta($user_id, 'setae_user_avatar', true));
        $avatar = $attachment_id ? wp_get_attachment_image_url($attachment_id, 'thumbnail') : '';
        if (!$avatar) {
            $avatar = get_avatar_url($user_id, array('size' => 192));
        }
        if ($avatar && strpos($avatar, 'mystery') !== false) {
            return '';
        }
        return $avatar ?: '';
    }

    private function get_care_share_url($log_id)
    {
        if (get_option('permalink_structure')) {
            return home_url('/setae-care/' . absint($log_id) . '/');
        }

        return add_query_arg('setae_care_share', absint($log_id), home_url('/'));
    }

    private function normalize_referral_code($code)
    {
        $code = rawurldecode((string) $code);
        $code = sanitize_text_field($code);
        return trim($code);
    }

    private function build_profile_share_text($name)
    {
        return 'SETAEで' . $name . 'さんの公開お世話記録を見られます。' . "\n" . 'タランチュラなどの写真・給餌・脱皮・成長記録を個体ごとに残せるサービスです。';
    }

    private function get_log_type_label($type, $classification = 'tarantula')
    {
        if ($type === 'feed') {
            return $classification === 'plant' ? '水やり' : '給餌';
        }
        if ($type === 'molt') {
            return $classification === 'plant' ? '植え替え' : '脱皮';
        }
        if ($type === 'growth') {
            return '成長';
        }
        if ($type === 'observation') {
            return '観察';
        }
        return 'メモ';
    }

    private function get_classification_label($classification)
    {
        $labels = array(
            'tarantula' => 'タランチュラ',
            'scorpion' => 'サソリ',
            'reptile' => '爬虫類',
            'plant' => '植物',
            'other' => 'その他',
        );

        return isset($labels[$classification]) ? $labels[$classification] : 'その他';
    }

    private function get_classification_emoji($classification)
    {
        $icons = array(
            'tarantula' => '🕷️',
            'scorpion' => '🦂',
            'reptile' => '🦎',
            'plant' => '🌿',
            'other' => '📝',
        );

        return isset($icons[$classification]) ? $icons[$classification] : $icons['other'];
    }

    private function get_default_og_image()
    {
        if (function_exists('get_theme_file_uri')) {
            return get_theme_file_uri('images/apple-touch-icon.png');
        }

        return Setae_Icon_Registry::asset_url('specimen.spider');
    }

    private function format_date($date)
    {
        if (!$date) {
            return '日付未設定';
        }

        $timestamp = strtotime($date);
        if (!$timestamp) {
            return $date;
        }

        return wp_date('Y年n月j日', $timestamp);
    }

    private function format_date_short($date)
    {
        if (!$date) {
            return '未公開';
        }

        $timestamp = strtotime($date);
        if (!$timestamp) {
            return $date;
        }

        return wp_date('n/j', $timestamp);
    }

    private function make_excerpt($text, $limit)
    {
        $text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags((string) $text)));
        if ($text === '') {
            return '';
        }

        if (function_exists('mb_strlen') && mb_strlen($text, 'UTF-8') > $limit) {
            return mb_substr($text, 0, $limit, 'UTF-8') . '...';
        }

        if (!function_exists('mb_strlen') && strlen($text) > $limit) {
            return substr($text, 0, $limit) . '...';
        }

        return $text;
    }

    private function first_character($text)
    {
        $text = trim((string) $text);
        if ($text === '') {
            return '?';
        }

        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, 1, 'UTF-8');
        }

        return substr($text, 0, 1);
    }
}
