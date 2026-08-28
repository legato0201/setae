<?php
require_once __DIR__ . '/public-passport-fixture.php';
require_once __DIR__ . '/public-surfaces-fixture.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-profile.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-care-share.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-partner.php';

/** Real existing public-page renderers, supplied with synthetic public view data. */
function setae_fixture_registration_surface($surface, $options = array())
{
    setae_fixture_seed($options);
    $_GET['ref'] = 'PUBLIC_REF_247';
    Setae_Public_Registration::enqueue(SETAE_VERSION);
    if ($surface === 'public_profile') {
        $profile = array(
            'user_id' => 31, 'referral_code' => 'PROFILE_REF_247', 'name' => '飼育者の公開プロフィール',
            'public_handle' => 'st_public247', 'avatar' => '', 'initial' => '飼',
            'lead' => '日々の飼育と成長の記録を残しています。', 'spider_count' => 6,
            'shared_count' => 9, 'latest_label' => '2026.08.27', 'is_limited' => false,
            'profile_url' => home_url('/setae-user/PROFILE_REF_247/'),
            'invite_url' => home_url('/setae-user/PROFILE_REF_247/?ref=PROFILE_REF_247'),
            'meta_title' => '公開飼育者 | SETAE', 'meta_description' => '公開された個体とフィールドノート。',
            'og_image' => '/tests/fixtures/passport-247-photo.svg?photo=profile',
            'share_text' => 'SETAEの公開プロフィール', 'share_copy_text' => '公開プロフィールを紹介します。',
            'x_share_url' => 'https://twitter.com/intent/tweet?text=fixture',
            'line_share_url' => 'https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fsetae.test',
            'logs' => array(),
        );
        for ($index = 0; $index < 9; $index++) {
            $profile['logs'][] = array('share_url' => home_url('/setae-care/' . (401 + $index) . '/'), 'spider_title' => '個体 ' . ($index + 1), 'type_label' => '脱皮', 'image' => '/tests/fixtures/passport-247-photo.svg?photo=' . $index, 'classification' => 'tarantula', 'species_name' => 'Phormingochilus sp.', 'date_iso' => '2026-08-27', 'display_date' => '2026.08.27', 'summary' => '公開された成長の記録です。');
        }
        $controller = new Setae_Public_Profile(SETAE_VERSION);
        setae_fixture_property($controller, 'current_profile', $profile);
        add_filter('pre_get_document_title', array($controller, 'filter_document_title'));
        add_filter('body_class', array($controller, 'add_body_class'));
        add_action('wp_head', array($controller, 'render_meta_tags'), 1);
        Setae_Public_Home::enqueue_public_profile(SETAE_VERSION);
        ob_start(); setae_fixture_invoke($controller, 'render_document', $profile); return ob_get_clean();
    }
    if ($surface === 'public_care_share') {
        list($controller, $view) = setae_fixture_care($options);
        return setae_fixture_surface_render($controller, $view, 'care');
    }
    if ($surface === 'public_partner') {
        list($controller, $view) = setae_fixture_partner($options);
        return setae_fixture_surface_render($controller, $view, 'partner');
    }
    throw new InvalidArgumentException('Unknown public surface ' . $surface);
}
