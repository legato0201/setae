<?php
require_once __DIR__ . '/helpers/public-surfaces-fixture.php';

$private = array('PRIVATE_RAW_POST_CONTENT_248', 'PRIVATE_DATA_NOTE_248', 'PRIVATE_DATA_EMAIL_248', 'PRIVATE_ENCLOSURE_248', 'PRIVATE_TASK_248', 'PRIVATE_META_248', 'PRIVATE_AUTHOR_EMAIL_248', 'PRIVATE_INTERNAL_LOGIN_248', 'PRIVATE_COMMENT_EMAIL_248', 'PRIVATE_UNAPPROVED_OR_OTHER_COMMENT_248', 'PRIVATE_COMMENT_AUTHOR_248', '198.51.100.248', '9182741', '9282741', '7788401');
foreach (array(array(), array('photo' => false, 'note' => false, 'reactions' => false, 'comments' => 0), array('long' => true), array('viewer' => 22), array('registration' => false), array('classification' => 'plant')) as $options) {
    list($controller, $view, $item) = setae_fixture_care($options);
    setae_fixture_assert($view['found'] === true, 'A published explicitly shared log renders.');
    $reads = $GLOBALS['setae_fixture_meta_reads'];
    $queries = count($GLOBALS['setae_fixture_comment_queries']);
    $html = setae_fixture_surface_render($controller, $view, 'care');
    foreach (array('/assets/js/public-share.js', '/assets/js/public-care-share.js', '/assets/js/public-registration.js') as $asset) { setae_fixture_assert(in_array($asset, $GLOBALS['setae_fixture_scripts'], true), 'Actual Care enqueue includes ' . $asset); }
    foreach (array('/assets/css/public-foundation.css', '/assets/css/public-care-share.css', '/assets/css/public-registration.css') as $asset) { setae_fixture_assert(in_array($asset, $GLOBALS['setae_fixture_styles'], true), 'Actual Care enqueue includes ' . $asset); }
    setae_fixture_assert($reads === $GLOBALS['setae_fixture_meta_reads'] && $queries === count($GLOBALS['setae_fixture_comment_queries']), 'Templates must not retrieve additional private metadata/comments.');
    foreach ($private as $marker) { setae_fixture_assert(strpos($html . json_encode($view), $marker) === false, 'Private marker leaked: ' . $marker); }
    setae_fixture_assert(!isset($item['author']['id']) && !isset($item['spider']['id']), 'Internal author/specimen IDs do not enter the public item.');
    foreach ($item['comments'] as $comment) { setae_fixture_assert(!isset($comment['id']) && !isset($comment['author']['id']), 'Internal comment/author IDs are excluded.'); }
    setae_fixture_assert(count($item['comments']) === min(3, $options['comments'] ?? 5), 'Only latest three approved care comments.');
    setae_fixture_assert(!array_diff(array_keys($item['data']), array('note', 'prey_type', 'refused', 'size', 'is_best_shot')), 'Public log data is an explicit allowlist.');
    if (($options['comments'] ?? 5) > 3) {
        setae_fixture_assert(strpos($html, 'PUBLIC_COMMENT_0') < strpos($html, 'PUBLIC_COMMENT_1'), 'Comments are newest first.');
        setae_fixture_assert(strpos($html, 'PUBLIC_COMMENT_3') === false, 'Fourth comment is not shown.');
    }
    setae_fixture_assert(substr_count($html, 'fetchpriority="high"') <= 1, 'Only the main photo is high priority.');
    if (!empty($options['viewer']) || isset($options['registration']) && !$options['registration']) { setae_fixture_assert(strpos($html, 'data-public-registration') === false, 'No guest registration for authenticated/disabled state.'); }
}

foreach (array('setae', 'wordpress', 'initial', 'mystery') as $avatar) {
    list(, , $item) = setae_fixture_care(array('avatar' => $avatar));
    if (in_array($avatar, array('initial', 'mystery'), true)) { setae_fixture_assert($item['author']['avatar'] === '' && $item['author']['initial'] === '公', 'Missing/mystery avatar resolves to initial.'); }
    else { setae_fixture_assert(strpos($item['author']['avatar'], 'avatar=' . $avatar) !== false, 'Avatar priority selects ' . $avatar); }
}
foreach (array('0', 'false', 'yes', '2', 0, -1, null, false, array()) as $flag) {
    list($controller, $view, $item) = setae_fixture_care(array(), function () use ($flag) { $GLOBALS['setae_fixture_meta'][401]['_setae_log_shared'] = $flag; });
    setae_fixture_assert($item === null && $view['found'] === false, 'Only exact shared flag 1 permits public output.');
    $html = setae_fixture_surface_render($controller, $view, 'care');
    setae_fixture_assert(strpos($html, 'Typhochlaena') === false && strpos($html, 'C014') === false, 'Rejected log exposes no identity.');
}
foreach (array('1', 1, true) as $flag) {
    list(, $view) = setae_fixture_care(array(), function () use ($flag) { $GLOBALS['setae_fixture_meta'][401]['_setae_log_shared'] = $flag; });
    setae_fixture_assert($view['found'] === true, 'Existing explicit shared-flag forms remain accepted.');
}
foreach (array('private', 'draft', 'pending', 'future', 'trash') as $status) {
    list(, $view, $item) = setae_fixture_care(array(), function () use ($status) { $GLOBALS['setae_fixture_posts'][401]->post_status = $status; });
    setae_fixture_assert($item === null && !$view['found'], 'Unpublished log rejected: ' . $status);
}
foreach (array('post', 'setae_spider') as $type) {
    list(, $view, $item) = setae_fixture_care(array(), function () use ($type) { $GLOBALS['setae_fixture_posts'][401]->post_type = $type; });
    setae_fixture_assert($item === null && !$view['found'], 'Wrong post type rejected.');
}
list($controller) = setae_fixture_care();
foreach (array(801, 802, 999999) as $id) { setae_fixture_assert(setae_fixture_invoke($controller, 'build_share_item', $id) === null, 'Mixed private/unshared/missing fixtures remain inaccessible.'); }
ob_start(); setae_fixture_invoke($controller, 'render_not_found'); $not_found = ob_get_clean();
setae_fixture_assert($GLOBALS['setae_fixture_http_status'] === 404, 'Missing shared record preserves HTTP 404.');
setae_fixture_assert(strpos($not_found, '共有記録が見つかりません') !== false, 'Dedicated public 404 document.');
echo "Public care-share privacy tests passed (real controller/templates; synthetic mixed WordPress datastore)\n";
