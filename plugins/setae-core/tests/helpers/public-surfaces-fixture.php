<?php
/** Actual Care/Partner controllers and templates; synthetic WordPress datastore. */
require_once __DIR__ . '/public-passport-fixture.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-care-share.php';
require_once SETAE_PLUGIN_DIR . 'includes/frontend/class-setae-public-partner.php';

function get_post_field($field, $id) { return get_post($id)->$field ?? ''; }
function get_post_time($format, $gmt = false, $id = 0) { return date($format, strtotime(get_post_field('post_date', $id))); }
function show_admin_bar($show) { $GLOBALS['setae_fixture_admin_bar'] = $show; }
function wp_get_attachment_image_url($id, $size = '') { return $GLOBALS['setae_fixture_attachments'][$id] ?? ''; }
function get_theme_file_uri($file = '') { $GLOBALS['setae_fixture_theme_reads']++; return 'https://forbidden-theme.test/' . $file; }
function setae_fixture_surface_theme($enabled)
{
    if (!$enabled) { return; }
    // Append a real linked stylesheet after the production enqueue order.
    // Asset ownership/isolation is tested separately with actual WP registries.
    add_action('wp_head', function () {
        wp_enqueue_style('fixture-theme-248', '/tests/fixtures/public-theme-hostile-v248.css');
    }, PHP_INT_MAX);
}
function get_comments($args = array())
{
    $GLOBALS['setae_fixture_comment_queries'][] = $args;
    $comments = array_values(array_filter($GLOBALS['setae_fixture_comments'] ?? array(), function ($comment) use ($args) {
        if (isset($args['post_id']) && (int) $args['post_id'] !== (int) $comment->comment_post_ID) { return false; }
        if (isset($args['type']) && $args['type'] !== $comment->comment_type) { return false; }
        if (($args['status'] ?? '') === 'approve' && (string) $comment->comment_approved !== '1') { return false; }
        return true;
    }));
    usort($comments, function ($a, $b) { return strcmp($b->comment_date_gmt, $a->comment_date_gmt); });
    if (!empty($args['count'])) { return count($comments); }
    return isset($args['number']) ? array_slice($comments, 0, $args['number']) : $comments;
}

function setae_fixture_care_seed($options = array())
{
    $options = array_merge(array('viewer' => 0, 'registration' => true, 'photo' => true, 'note' => true, 'reactions' => true, 'comments' => 5, 'long' => false, 'avatar' => 'initial', 'classification' => 'tarantula', 'log_type' => 'feed'), $options);
    setae_fixture_seed(array_merge($options, array('history' => 0, 'photos' => 0)));
    setae_fixture_surface_theme(!empty($options['theme']));
    $GLOBALS['setae_fixture_theme_reads'] = 0;
    $GLOBALS['setae_fixture_comment_queries'] = $GLOBALS['setae_fixture_comments'] = array();
    $GLOBALS['setae_fixture_http_status'] = 200;
    $_GET = array('ref' => 'REF248', 'referral_code' => 'REFALT248', 'register' => '1');
    if (!empty($options['tracking'])) { $_GET['utm_source'] = 'fixture'; }
    $_SERVER['REQUEST_URI'] = '/setae-care/401/?' . http_build_query($_GET);
    $name = $options['long'] ? '三十文字以上のとても長い飼育者表示名で折り返しと読みやすさを確認する公開飼育者' : '公開飼育者248';
    $GLOBALS['setae_fixture_users'][31] = (object) array('ID' => 31, 'display_name' => $name, 'user_email' => 'PRIVATE_AUTHOR_EMAIL_248@example.test', 'user_login' => 'PRIVATE_INTERNAL_LOGIN_248');
    $GLOBALS['setae_fixture_user_meta'][31] = array('_setae_referral_code' => 'CARE_REF_248', '_setae_public_handle' => 'st_care248', '_setae_private_note' => 'PRIVATE_USER_META_248');
    $photo = '/tests/fixtures/passport-247-photo.svg?photo=care248';
    $GLOBALS['setae_fixture_avatars'][31] = in_array($options['avatar'], array('wordpress', 'setae'), true) ? $photo . '&avatar=wordpress' : ($options['avatar'] === 'mystery' ? 'https://avatar.example.test/mystery.png' : '');
    $GLOBALS['setae_fixture_attachments'] = array(601 => $photo . '&avatar=setae');
    if ($options['avatar'] === 'setae') { $GLOBALS['setae_fixture_user_meta'][31]['setae_user_avatar'] = 601; }
    $GLOBALS['setae_fixture_posts'][201]->post_title = 'C014';
    $GLOBALS['setae_fixture_posts'][301]->post_title = $options['long'] ? 'Typhochlaena seladonia “長い地域名と学名の折り返し検証 012345678901234567890123456789”' : 'Typhochlaena seladonia';
    $GLOBALS['setae_fixture_terms'][201] = array((object) array('slug' => $options['classification'], 'name' => $options['classification'] === 'plant' ? '植物' : 'タランチュラ'));
    $GLOBALS['setae_fixture_posts'][401] = (object) array('ID' => 401, 'post_type' => 'setae_log', 'post_status' => 'publish', 'post_author' => 31, 'post_name' => 'public-care248', 'post_title' => 'Public care248', 'post_date' => '2026-08-28 12:00:00', 'post_content' => 'PRIVATE_RAW_POST_CONTENT_248');
    $note = $options['long'] ? implode("\n", array_fill(0, 5, '給餌後の様子を長い本文として記録します。姿勢と糸の状態を観察し、落ち着いていることを確認しました。')) : '給餌を行いました。糸の上で落ち着いて過ごしています。';
    $GLOBALS['setae_fixture_meta'][401] = array(
        '_setae_log_spider_id' => 201, '_setae_log_type' => $options['log_type'], '_setae_log_date' => '2026-08-28', '_setae_log_shared' => '1',
        '_setae_log_image' => $options['photo'] ? $photo : '',
        '_setae_log_data' => array('note' => $options['note'] ? $note : '', 'prey_type' => 'D. hydei', 'size' => '2.4', 'refused' => false, 'is_best_shot' => true,
            'private_note' => 'PRIVATE_DATA_NOTE_248', 'email' => 'PRIVATE_DATA_EMAIL_248@example.test', 'enclosure_id' => 'PRIVATE_ENCLOSURE_248', 'care_tasks' => array('PRIVATE_TASK_248')),
        '_setae_care_reactions' => $options['reactions'] ? array('useful' => array(9182741, 9182742, 9182743, 9182744), 'photo' => array(9182751, 9182752), 'cheer' => array(9182761)) : array(),
        '_setae_internal_note' => 'PRIVATE_META_248',
    );
    for ($index = 0; $index < $options['comments']; $index++) {
        $date = '2026-08-' . (28 - $index) . ' 12:00:00';
        $GLOBALS['setae_fixture_comments'][] = (object) array('comment_ID' => 7788401 + $index, 'comment_post_ID' => 401, 'comment_type' => 'setae_care_feed', 'comment_approved' => '1', 'comment_author' => '公開コメント著者' . $index, 'comment_content' => ($options['long'] ? str_repeat('長いコメントでも段落と名前が読みやすいことを確認します。', 5) : '参考になる記録です。') . ' PUBLIC_COMMENT_' . $index,
            'comment_date' => $date, 'comment_date_gmt' => $date, 'comment_author_email' => 'PRIVATE_COMMENT_EMAIL_248@example.test', 'comment_author_IP' => '198.51.100.248', 'user_id' => 9282741 + $index);
    }
    foreach (array(array('0', 'setae_care_feed', 401), array('spam', 'setae_care_feed', 401), array('1', 'comment', 401), array('1', 'setae_care_feed', 999)) as $index => $row) {
        $GLOBALS['setae_fixture_comments'][] = (object) array('comment_ID' => 8888000 + $index, 'comment_post_ID' => $row[2], 'comment_type' => $row[1], 'comment_approved' => $row[0], 'comment_author' => 'PRIVATE_COMMENT_AUTHOR_248', 'comment_content' => 'PRIVATE_UNAPPROVED_OR_OTHER_COMMENT_248', 'comment_date' => '2099-09-19 12:00:00', 'comment_date_gmt' => '2099-09-19 12:00:00', 'comment_author_email' => 'PRIVATE_COMMENT_EMAIL_248@example.test', 'comment_author_IP' => '198.51.100.248', 'user_id' => 9999999);
    }
    return $options;
}

function setae_fixture_care($options = array(), $mutator = null)
{
    setae_fixture_care_seed($options);
    if ($mutator) { $mutator(); }
    $controller = new Setae_Public_Care_Share(SETAE_VERSION);
    $item = setae_fixture_invoke($controller, 'build_share_item', !empty($options['not_found']) ? 999999 : 401);
    $view = setae_fixture_invoke($controller, 'build_view_context', $item);
    setae_fixture_property($controller, 'current_item', $item);
    return array($controller, $view, $item);
}

function setae_fixture_surface_render($controller, $view, $surface)
{
    ob_start(); setae_fixture_invoke($controller, 'render_document', $view); return ob_get_clean();
}

function setae_fixture_partner($options = array())
{
    setae_fixture_seed($options);
    setae_fixture_surface_theme(!empty($options['theme']));
    $GLOBALS['setae_fixture_theme_reads'] = 0;
    $_GET = array('ref' => 'REF248', 'register' => '1');
    if (!empty($options['tracking'])) { $_GET['utm_source'] = 'fixture'; }
    $_SERVER['REQUEST_URI'] = '/setae-partner/?' . http_build_query($_GET);
    $controller = new Setae_Public_Partner(SETAE_VERSION);
    $view = setae_fixture_invoke($controller, 'build_view_context');
    if (!empty($options['long'])) {
        $view['copy_text'] .= "\n\n" . implode("\n", array_fill(0, 7, 'ご購入後の給餌・脱皮・観察の記録を個体ごとに残せます。長い案内文も選択して共有できることを確認するための追加文章です。'));
        $view['share']['copy_text'] = $view['copy_text'];
    }
    return array($controller, $view);
}
