<?php

/** Public Field Note: request, public data and view context only. */
class Setae_Public_Care_Share
{
    const QUERY_VAR = 'setae_care_share';
    const REWRITE_OPTION = 'setae_care_share_rewrite_version';

    private $version;
    private $current_item = null;
    private $current_view = null;

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function register_rewrite_rule()
    {
        add_rewrite_rule('^setae-care/([0-9]+)/?$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top');
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

    public function render_share_page()
    {
        $log_id = absint(get_query_var(self::QUERY_VAR));
        if (!$log_id && isset($_GET[self::QUERY_VAR]) && is_scalar($_GET[self::QUERY_VAR])) {
            $log_id = absint($_GET[self::QUERY_VAR]);
        }
        if (!$log_id) {
            return;
        }
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        nocache_headers();

        $item = $this->build_share_item($log_id);
        if (!$item) {
            $this->render_not_found();
            exit;
        }
        $this->render_document($this->build_view_context($item));
        exit;
    }

    public function filter_wp_title($title, $sep, $seplocation)
    {
        return $this->current_view ? $this->current_view['seo']['title'] . ' ' . $sep . ' ' : $title;
    }

    public function filter_document_title($title)
    {
        return $this->current_view ? $this->current_view['seo']['title'] : $title;
    }

    public function add_body_class($classes)
    {
        $classes[] = 'setae-public-document';
        $classes[] = 'setae-care-share-document';
        return array_unique($classes);
    }

    public function render_meta_tags()
    {
        if (!$this->current_item) {
            return;
        }
        $item = $this->current_item;
        ?>
        <meta name="description" content="<?php echo esc_attr($item['meta_description']); ?>">
        <link rel="canonical" href="<?php echo esc_url($item['share_url']); ?>">
        <meta property="og:type" content="article">
        <meta property="og:site_name" content="SETAE">
        <meta property="og:title" content="<?php echo esc_attr($item['meta_title']); ?>">
        <meta property="og:description" content="<?php echo esc_attr($item['meta_description']); ?>">
        <meta property="og:url" content="<?php echo esc_url($item['share_url']); ?>">
        <meta property="og:image" content="<?php echo esc_url($item['og_image']); ?>">
        <meta property="og:image:alt" content="<?php echo esc_attr($item['og_image_alt']); ?>">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="<?php echo esc_attr($item['meta_title']); ?>">
        <meta name="twitter:description" content="<?php echo esc_attr($item['meta_description']); ?>">
        <meta name="twitter:image" content="<?php echo esc_url($item['og_image']); ?>">
        <?php if ($item['created_at_iso']): ?>
            <meta property="article:published_time" content="<?php echo esc_attr($item['created_at_iso']); ?>">
        <?php endif; ?>
        <?php
    }

    private function build_view_context($item)
    {
        $found = is_array($item);
        $home_url = home_url('/');
        $page_url = $found ? $item['share_url'] : $home_url;
        $logged_in = is_user_logged_in();
        $registration = Setae_Public_Registration::build_context('public_care_share', array(
            'analytics_id' => $found ? $item['id'] : 0,
            'enabled' => $found,
        ));

        return array(
            'found' => $found,
            'item' => $item,
            'is_logged_in' => $logged_in,
            'surface' => array(
                'brand_url' => $home_url,
                'home_url' => $home_url,
                'terms_url' => Setae_App_Operations::get_terms_url(),
                'label' => 'Public Field Note',
                'login_url' => Setae_App_Shell::login_url($page_url),
                'app_url' => Setae_App_Shell::app_url(),
                'is_logged_in' => $logged_in,
            ),
            'actions' => array(
                'app_url' => Setae_App_Shell::app_url(),
                'login_url' => Setae_App_Shell::login_url($page_url),
                'register_url' => Setae_App_Shell::app_url(array('setae_auth' => 'register')),
            ),
            'registration' => $registration,
            'seo' => array(
                'title' => $found ? $item['meta_title'] : '共有記録が見つかりません | SETAE',
                'description' => $found ? $item['meta_description'] : '共有が解除されたか、URLが変更された可能性があります。',
            ),
        );
    }

    private function render_document($view)
    {
        $this->current_view = $view;
        $this->current_item = $view['found'] ? $view['item'] : null;
        status_header($view['found'] ? 200 : 404);
        show_admin_bar(false);
        add_filter('wp_title', array($this, 'filter_wp_title'), 10, 3);
        add_filter('pre_get_document_title', array($this, 'filter_document_title'));
        add_filter('body_class', array($this, 'add_body_class'));
        add_action('wp_head', array($this, 'render_meta_tags'), 1);
        remove_action('wp_head', '_wp_render_title_tag', 1);
        remove_action('wp_head', 'rel_canonical');
        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_enqueue_scripts', 'wp_enqueue_emoji_styles');
        remove_action('wp_head', '_admin_bar_bump_cb');
        Setae_Public_Home::enqueue_public_care_share($this->version);
        $setae_care_share = $view;
        require SETAE_PLUGIN_DIR . 'templates/public/care-share-document.php';
    }

    private function render_not_found()
    {
        $this->render_document($this->build_view_context(null));
    }

    private function build_share_item($log_id)
    {
        $log_id = absint($log_id);
        $log = get_post($log_id);
        if (!$log || $log->post_type !== 'setae_log' || $log->post_status !== 'publish') {
            return null;
        }
        if (!in_array(get_post_meta($log_id, '_setae_log_shared', true), array('1', 1, true), true)) {
            return null;
        }

        $spider_id = absint(get_post_meta($log_id, '_setae_log_spider_id', true));
        $spider = $spider_id ? get_post($spider_id) : null;
        if (!$spider || $spider->post_type !== 'setae_spider') {
            return null;
        }

        $data = $this->get_public_log_data($this->decode_log_data(get_post_meta($log_id, '_setae_log_data', true)));
        $species_id = absint(get_post_meta($spider_id, '_setae_species_id', true));
        $custom_name = $this->clean_text(get_post_meta($spider_id, '_setae_custom_species_name', true));
        $species_name = $this->clean_text($species_id ? get_the_title($species_id) : ($custom_name ?: '種類不明'));
        $terms = get_the_terms($spider_id, 'setae_classification');
        $classification = ($terms && !is_wp_error($terms)) ? sanitize_key($terms[0]->slug) : 'tarantula';
        $log_type = $this->clean_text(get_post_meta($log_id, '_setae_log_type', true));
        $log_date = $this->clean_text(get_post_meta($log_id, '_setae_log_date', true));
        $image = $this->clean_url(get_post_meta($log_id, '_setae_log_image', true));
        $fallback_image = $this->clean_url(get_post_meta($spider_id, '_setae_spider_image', true));
        if (!$fallback_image && $species_id) {
            $fallback_image = $this->clean_url(get_the_post_thumbnail_url($species_id, 'large'));
        }

        $author_id = absint(get_post_field('post_author', $log_id));
        $author = get_userdata($author_id);
        $author_name = $author ? $this->clean_text($author->display_name) : 'ユーザー不明';
        $avatar = Setae_Public_Visual::avatar_context($author_id, $author_name);
        $note = isset($data['note']) ? $data['note'] : '';
        $share_url = $this->get_share_url($log_id);
        $invite_share_url = $this->get_invite_share_url($share_url);
        $title = $this->clean_text(get_the_title($spider_id));
        $type_label = $this->get_log_type_label($log_type, $classification);
        $heading = $type_label === 'メモ' ? 'メモ' : $type_label . 'の記録';
        $description = $this->make_excerpt(implode(' / ', array_filter(array($heading, $species_name, $note))), 92);
        $share_text = $this->build_share_text($title, $type_label, $species_name, $note);
        $published_at = $this->clean_text(get_post_time('c', true, $log_id));

        // Only public text/URLs/counts enter the view; no raw post, user or comment objects.
        return array(
            'id' => $log_id,
            'type_label' => $type_label,
            'heading' => $heading,
            'date' => $this->iso_date($log_date),
            'display_date' => $this->format_date($log_date),
            'created_at_iso' => $published_at,
            'published_date' => $this->format_date($published_at),
            'note' => $note,
            'data' => $data,
            'properties' => $this->build_properties($data, $classification),
            'display_image' => $image ?: $fallback_image,
            'og_image' => $image ?: ($fallback_image ?: $this->get_default_og_image()),
            'og_image_alt' => $title . ' · ' . $heading,
            'classification' => $classification,
            'classification_label' => $this->get_classification_label($classification),
            'share_url' => $share_url,
            'invite_share_url' => $invite_share_url,
            'share_text' => $share_text,
            'share_copy_text' => $share_text . "\n" . $invite_share_url,
            'x_share_url' => 'https://twitter.com/intent/tweet?' . http_build_query(array('text' => $share_text, 'url' => $invite_share_url)),
            'line_share_url' => 'https://social-plugins.line.me/lineit/share?' . http_build_query(array('url' => $invite_share_url)),
            'meta_title' => $title . ' · ' . $heading . ' | SETAE',
            'meta_description' => $description ?: 'SETAEで共有された飼育記録です。',
            'spider' => array('title' => $title, 'species_name' => $species_name),
            'author' => array(
                'name' => $author_name,
                'avatar' => $avatar['url'],
                'initial' => $avatar['initial'],
                'profile_url' => $this->get_user_public_profile_url($author_id),
            ),
            'comments' => $this->get_public_comments($log_id),
            'reactions' => $this->get_public_reactions($log_id),
        );
    }

    private function decode_log_data($raw_data)
    {
        if (is_string($raw_data)) {
            $decoded = json_decode($raw_data, true);
            return is_array($decoded) ? $decoded : array();
        }
        return is_array($raw_data) ? $raw_data : array();
    }

    private function get_public_log_data($data)
    {
        $public = array();
        if (isset($data['note']) && is_scalar($data['note'])) {
            $public['note'] = sanitize_textarea_field((string) $data['note']);
        }
        foreach (array('prey_type', 'size') as $key) {
            if (isset($data[$key]) && is_scalar($data[$key]) && (string) $data[$key] !== '') {
                $public[$key] = $this->clean_text($data[$key]);
            }
        }
        foreach (array('refused', 'is_best_shot') as $key) {
            if (!empty($data[$key]) && is_scalar($data[$key])) {
                $public[$key] = true;
            }
        }
        return $public;
    }

    private function build_properties($data, $classification)
    {
        $properties = array(array('label' => '分類', 'value' => $this->get_classification_label($classification)));
        if (!empty($data['prey_type'])) {
            $properties[] = array('label' => '餌', 'value' => $data['prey_type']);
        }
        if (!empty($data['refused'])) {
            $properties[] = array('label' => '拒食', 'value' => 'あり');
        }
        if (isset($data['size']) && $data['size'] !== '') {
            $properties[] = array('label' => 'サイズ', 'value' => $data['size'] . ' cm');
        }
        if (!empty($data['is_best_shot'])) {
            $properties[] = array('label' => '図鑑候補写真', 'value' => 'あり');
        }
        return $properties;
    }

    private function get_public_comments($log_id)
    {
        $comments = get_comments(array(
            'post_id' => $log_id,
            'status' => 'approve',
            'type' => 'setae_care_feed',
            'orderby' => 'comment_date_gmt',
            'order' => 'DESC',
            'number' => 3,
        ));
        // Recheck the returned objects too: filters must not widen the public boundary.
        $comments = array_values(array_filter((array) $comments, static function ($comment) use ($log_id) {
            return is_object($comment)
                && isset($comment->comment_approved, $comment->comment_type, $comment->comment_post_ID)
                && (string) $comment->comment_approved === '1'
                && $comment->comment_type === 'setae_care_feed'
                && (int) $comment->comment_post_ID === (int) $log_id;
        }));
        usort($comments, static function ($first, $second) {
            return strcmp((string) ($second->comment_date_gmt ?? ''), (string) ($first->comment_date_gmt ?? ''));
        });

        $items = array();
        foreach (array_slice($comments, 0, 3) as $comment) {
            $date = $this->clean_text($comment->comment_date ?? '');
            $items[] = array(
                'content' => is_scalar($comment->comment_content) ? sanitize_textarea_field((string) $comment->comment_content) : '',
                'date' => $this->format_date($date),
                'datetime' => $this->iso_date($date),
                'author' => array('name' => $this->clean_text($comment->comment_author) ?: 'ユーザー不明'),
            );
        }
        return $items;
    }

    private function get_public_reactions($log_id)
    {
        $labels = array('useful' => '参考になる', 'photo' => '良い写真', 'cheer' => '応援', 'same' => 'うちも');
        $raw = get_post_meta($log_id, '_setae_care_reactions', true);
        $raw = is_array($raw) ? $raw : array();
        $reactions = array();
        foreach ($labels as $key => $label) {
            $count = isset($raw[$key]) && is_array($raw[$key]) ? count($raw[$key]) : 0;
            if ($count > 0) {
                $reactions[] = array('label' => $label, 'count' => $count);
            }
        }
        return $reactions;
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
        $labels = array('tarantula' => 'タランチュラ', 'scorpion' => 'サソリ', 'reptile' => '爬虫類', 'plant' => '植物', 'other' => 'その他');
        return isset($labels[$classification]) ? $labels[$classification] : 'その他';
    }

    private function get_share_url($log_id)
    {
        if (get_option('permalink_structure')) {
            return home_url('/setae-care/' . absint($log_id) . '/');
        }
        return add_query_arg(self::QUERY_VAR, absint($log_id), home_url('/'));
    }

    private function get_invite_share_url($share_url)
    {
        $referral_code = $this->get_current_or_incoming_referral_code();
        return $referral_code ? add_query_arg('ref', $referral_code, $share_url) : $share_url;
    }

    private function get_current_or_incoming_referral_code()
    {
        $user_id = get_current_user_id();
        if ($user_id) {
            $code = $this->clean_text(get_user_meta($user_id, '_setae_referral_code', true));
            if ($code) {
                return $code;
            }
        }
        return $this->get_incoming_referral_code();
    }

    private function get_user_public_profile_url($user_id)
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return home_url('/');
        }
        $referral_code = $this->clean_text(get_user_meta($user_id, '_setae_referral_code', true));
        if (!$referral_code) {
            return home_url('/');
        }
        $url = get_option('permalink_structure')
            ? home_url('/setae-user/' . rawurlencode($referral_code) . '/')
            : add_query_arg('setae_profile', $referral_code, home_url('/'));
        return add_query_arg('ref', $referral_code, $url);
    }

    private function get_incoming_referral_code()
    {
        foreach (array('ref', 'referral_code') as $key) {
            if (isset($_GET[$key]) && is_scalar($_GET[$key])) {
                $code = $this->clean_text(wp_unslash($_GET[$key]));
                if ($code !== '') {
                    return $code;
                }
            }
        }
        return '';
    }

    private function get_default_og_image()
    {
        return SETAE_PLUGIN_URL . 'assets/app/icons/setae-icon-512.png';
    }

    private function clean_text($value)
    {
        return is_scalar($value) ? sanitize_text_field((string) $value) : '';
    }

    private function clean_url($value)
    {
        return is_scalar($value) ? esc_url_raw((string) $value) : '';
    }

    private function iso_date($date)
    {
        $timestamp = $date ? strtotime($date) : false;
        return $timestamp === false ? '' : wp_date('Y-m-d', $timestamp);
    }

    private function format_date($date)
    {
        $timestamp = $date ? strtotime($date) : false;
        return $timestamp === false ? '日付未設定' : wp_date('Y年n月j日', $timestamp);
    }

    private function make_excerpt($text, $limit)
    {
        $text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($text)));
        if (function_exists('mb_strlen') && mb_strlen($text, 'UTF-8') > $limit) {
            return mb_substr($text, 0, $limit, 'UTF-8') . '…';
        }
        if (!function_exists('mb_strlen') && strlen($text) > $limit) {
            return substr($text, 0, $limit) . '…';
        }
        return $text;
    }

    private function build_share_text($title, $type_label, $species_name, $note)
    {
        $parts = array('SETAEで「' . $title . '」の' . $type_label . '記録を共有しました。');
        if ($species_name && $species_name !== '種類不明') {
            $parts[] = '種類: ' . $species_name;
        }
        if ($note) {
            $parts[] = $this->make_excerpt($note, 54);
        }
        return implode("\n", $parts);
    }
}
