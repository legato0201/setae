<?php

class Setae_Public_Partner
{
    const QUERY_VAR = 'setae_partner';
    const REWRITE_OPTION = 'setae_public_partner_rewrite_version';

    private $version;
    private $page_url = '';
    private $seo_context = array();

    public function __construct($version)
    {
        $this->version = $version;
    }

    public function register_rewrite_rule()
    {
        add_rewrite_rule('^setae-partner/?$', 'index.php?' . self::QUERY_VAR . '=1', 'top');
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

    public function render_partner_page()
    {
        $is_partner_page = (bool) get_query_var(self::QUERY_VAR);
        if (!$is_partner_page && isset($_GET[self::QUERY_VAR])) {
            $is_partner_page = (bool) absint($_GET[self::QUERY_VAR]);
        }

        if (!$is_partner_page) {
            return;
        }

        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        nocache_headers();

        $context = $this->build_view_context();
        status_header(200);
        $this->render_document($context);
        exit;
    }

    public function filter_wp_title($title, $sep, $seplocation)
    {
        return $this->filter_document_title() . ' ' . $sep . ' ';
    }

    public function filter_document_title($title = '')
    {
        return 'ショップ・ブリーダー向け案内 | SETAE';
    }

    public function add_body_class($classes)
    {
        $classes[] = 'setae-public-document';
        $classes[] = 'setae-public-partner-document';
        return array_unique($classes);
    }

    public function render_meta_tags()
    {
        $seo = $this->seo_context ?: $this->build_seo_context();
        ?>
        <meta name="description" content="<?php echo esc_attr($seo['description']); ?>">
        <link rel="canonical" href="<?php echo esc_url($seo['canonical']); ?>">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="SETAE">
        <meta property="og:title" content="<?php echo esc_attr($seo['title']); ?>">
        <meta property="og:description" content="<?php echo esc_attr($seo['description']); ?>">
        <meta property="og:url" content="<?php echo esc_url($seo['canonical']); ?>">
        <meta property="og:image" content="<?php echo esc_url($seo['image']); ?>">
        <meta property="og:image:alt" content="<?php echo esc_attr($seo['image_alt']); ?>">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="<?php echo esc_attr($seo['title']); ?>">
        <meta name="twitter:description" content="<?php echo esc_attr($seo['description']); ?>">
        <meta name="twitter:image" content="<?php echo esc_url($seo['image']); ?>">
        <?php
    }

    /** Complete public view data; templates do not query users, options, or posts. */
    protected function build_view_context()
    {
        $this->page_url = $this->get_partner_url();
        $this->seo_context = $this->build_seo_context();
        $is_logged_in = is_user_logged_in();
        $share_text = $this->get_partner_share_text();
        $invite_text = $this->get_partner_invite_text();
        $app_url = Setae_App_Shell::app_url();
        $plan_url = add_query_arg('setae_plan', 'breeder_trial', $app_url);
        $login_url = Setae_App_Shell::login_url($this->page_url);
        $registration = Setae_Public_Registration::build_context('public_partner', array(
            'title' => 'ブリーダー機能を試す準備',
            'description' => 'メール認証後、ブリーダー機能の30日間の試用を確認できます。登録だけで試用や課金が始まることはありません。',
            'return_url' => $plan_url,
        ));

        return array(
            'surface' => array(
                'brand_url' => home_url('/'),
                'label' => 'ショップ・ブリーダー向け',
                'login_url' => $login_url,
                'is_logged_in' => $is_logged_in,
                'home_url' => home_url('/'),
                'terms_url' => Setae_App_Operations::get_terms_url(),
            ),
            'seo' => $this->seo_context,
            'is_logged_in' => $is_logged_in,
            'registration' => $registration,
            'app_url' => $app_url,
            'plan_url' => $plan_url,
            'register_url' => Setae_App_Shell::app_url(array('setae_auth' => 'register', 'setae_plan' => 'breeder_trial')),
            'share' => array(
                'title' => $this->seo_context['title'],
                'text' => $share_text,
                'url' => $this->page_url,
                'copy_text' => $invite_text,
                'x_url' => $this->get_x_share_url($share_text),
                'line_url' => $this->get_line_share_url(),
            ),
            'copy_text' => $invite_text,
            'features' => array(
                array(
                    'eyebrow' => 'BREEDING',
                    'title' => '生まれた群から、個体ごとの履歴へ',
                    'kind' => '繁殖・ベビー群',
                    'description' => 'ベビー群の給餌や脱皮を記録し、販売する個体へ昇格できます。CB個体の成長を、群から個体へつないで管理します。',
                ),
                array(
                    'eyebrow' => 'PASSPORT',
                    'title' => '履歴を添えて、次の飼育者へ',
                    'kind' => '個体ID・QR',
                    'description' => '個体IDとQRを付け、給餌・脱皮・写真・親情報などの記録を引き継げます。購入者へ見せる情報は、所有者が公開範囲を選びます。',
                ),
                array(
                    'eyebrow' => 'CONTINUE',
                    'title' => '購入後も、同じ個体に記録する',
                    'kind' => '所有者が承認する引き継ぎ',
                    'description' => '購入者はQRから公開情報を確認し、引き継ぎを申請できます。所有者の承認後、購入後の飼育記録も同じ個体パスポートに続けて残せます。',
                ),
            ),
            'steps' => array(
                array(
                    'title' => '群で記録し、個体へ昇格する',
                    'description' => '生まれたベビー群を登録し、給餌・脱皮の記録を残します。販売する個体を選び、個体登録へ昇格します。',
                ),
                array(
                    'title' => '個体IDとQRを付けて渡す',
                    'description' => 'ラベルを生成し、個体に対応するQRを購入者へ渡します。公開情報を確認できる状態にして、引き継ぎ受付を開始します。',
                ),
                array(
                    'title' => '購入者が申請し、所有者が承認する',
                    'description' => '購入者はQRからメール認証と引き継ぎ申請を行います。現在の所有者が承認すると、履歴ごとマイ個体へ移動します。',
                ),
            ),
        );
    }

    protected function render_document(array $context)
    {
        $this->seo_context = $context['seo'];
        $this->page_url = $context['share']['url'];
        show_admin_bar(false);
        add_filter('wp_title', array($this, 'filter_wp_title'), 10, 3);
        add_filter('pre_get_document_title', array($this, 'filter_document_title'));
        add_filter('body_class', array($this, 'add_body_class'));
        add_action('wp_head', array($this, 'render_meta_tags'), 1);
        Setae_Public_Home::enqueue_public_partner($this->version);
        if (class_exists('Setae_Product_Events')) {
            $referral = $context['registration']['referral_code'] ?? '';
            $partners = $referral ? get_users(array('meta_key' => '_setae_referral_code', 'meta_value' => $referral, 'number' => 1, 'fields' => 'ids')) : array();
            $event_context = array('partner_user_id' => $partners ? absint(reset($partners)) : 0);
            wp_enqueue_script('setae-public-product-events', SETAE_PLUGIN_URL . 'assets/js/public-product-events.js', array(), $this->version, true);
            wp_add_inline_script('setae-public-product-events', 'window.SetaeProductEventsConfig=' . wp_json_encode(Setae_Product_Events::public_config('partner', $event_context)) . ';', 'before');
        }

        // This document owns its title and canonical, without changing index policy.
        remove_action('wp_head', '_wp_render_title_tag', 1);
        remove_action('wp_head', 'rel_canonical');
        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_enqueue_scripts', 'wp_enqueue_emoji_styles');
        remove_action('wp_head', '_admin_bar_bump_cb');

        $setae_partner = $context;
        require SETAE_PLUGIN_DIR . 'templates/public/partner-document.php';
    }

    private function build_seo_context()
    {
        return array(
            'title' => $this->filter_document_title(),
            'description' => '売る前から、譲った後まで。SETAEはベビー群、個体ID・QR、給餌・脱皮・写真の記録を、次の飼育者へつなぐ個体パスポートです。',
            'canonical' => $this->get_partner_url(),
            'type' => 'website',
            'image' => $this->get_default_og_image(),
            'image_alt' => 'SETAE Living Collection',
        );
    }

    private function get_partner_url()
    {
        if (get_option('permalink_structure')) {
            return home_url('/setae-partner/');
        }

        return add_query_arg(self::QUERY_VAR, 1, home_url('/'));
    }

    private function get_partner_invite_text()
    {
        return $this->get_partner_share_text() . "\n" . $this->page_url;
    }

    private function get_partner_share_text()
    {
        return "売る前から、譲った後まで。\nSETAEは、生まれたCB個体の給餌・脱皮・写真などの履歴を、個体IDとQRで次の飼育者へつなぎます。\n購入した個体のQRから公開情報を確認し、引き継ぎを申請できます。完了には現在の所有者の承認が必要です。";
    }

    private function get_x_share_url($text)
    {
        return 'https://twitter.com/intent/tweet?' . http_build_query(array(
            'text' => $text,
            'url' => $this->page_url,
        ));
    }

    private function get_line_share_url()
    {
        return 'https://social-plugins.line.me/lineit/share?' . http_build_query(array(
            'url' => $this->page_url,
        ));
    }

    private function get_default_og_image()
    {
        return SETAE_PLUGIN_URL . 'assets/app/icons/setae-icon-512.png';
    }
}
