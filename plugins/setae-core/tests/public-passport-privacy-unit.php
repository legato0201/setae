<?php
require_once __DIR__ . '/helpers/public-passport-fixture.php';

function passport_excludes($text, $needles, $label)
{
    foreach ($needles as $needle) { setae_fixture_assert(strpos($text, $needle) === false, $label . ': leaked ' . $needle); }
}
function passport_includes($text, $needle, $label) { setae_fixture_assert(strpos($text, $needle) !== false, $label . ': missing ' . $needle); }

$cases = array(
    'private-guest' => array('options' => array('visibility' => 'private'), 'mode' => 'private'),
    'private-owner' => array('options' => array('visibility' => 'private', 'viewer' => 11), 'mode' => 'owner'),
    'transfer-guest' => array('options' => array('visibility' => 'private', 'transfer' => true), 'mode' => 'transfer'),
    'transfer-logged-in' => array('options' => array('visibility' => 'private', 'transfer' => true, 'viewer' => 22), 'mode' => 'transfer'),
    'transfer-requested' => array('options' => array('visibility' => 'private', 'transfer' => true, 'viewer' => 22, 'requested' => true), 'mode' => 'transfer'),
    'basic-public' => array('options' => array('visibility' => 'basic'), 'mode' => 'basic'),
    'life-history-public' => array('options' => array('visibility' => 'life_history'), 'mode' => 'life_history'),
    'owner-preview' => array('options' => array('visibility' => 'life_history', 'viewer' => 11), 'mode' => 'owner'),
);

foreach ($cases as $name => $case) {
    list($controller, $context, $data) = setae_fixture_passport($case['options']);
    setae_fixture_assert($context['mode'] === $case['mode'], $name . ': wrong mode');
    setae_fixture_assert(!array_key_exists('label', $context), $name . ': raw manager label must not cross template boundary');
    $reads_before = $GLOBALS['setae_fixture_meta_reads'];
    $query_count_before = count($GLOBALS['setae_fixture_queries']);
    $html = setae_fixture_render($controller, $context);
    setae_fixture_assert($reads_before === $GLOBALS['setae_fixture_meta_reads'], $name . ': templates must not re-fetch metadata');
    setae_fixture_assert($query_count_before === count($GLOBALS['setae_fixture_queries']), $name . ': templates must not query more records');
    passport_excludes($html, array('PRIVATE_RECORD_247', 'PRIVATE_RECORD_BODY_247', 'PRIVATE_PHOTO_247', 'UNSHARED_PHOTO_247', 'PRIVATE_INTERNAL_MEMO_247', 'PRIVATE_LOG_NOTE_247', 'PRIVATE_INTERNAL_NOTE_IN_PUBLIC_RECORD_247', 'PRIVATE_ENCLOSURE_247', '2099-09-19'), $name);
    if (empty($case['options']['viewer']) || $case['options']['viewer'] !== 11) {
        passport_excludes($html, array('PRIVATE_KEEPER_247', 'PRIVATE_REFERRAL_247', 'passport-247-private-avatar', '1981-01-', '1981.01.'), $name);
    }
    if ($name === 'private-guest') {
        passport_includes($html, '非公開の管理QRです', $name);
        passport_excludes($html . json_encode($context, JSON_UNESCAPED_UNICODE), array('SPECIMEN_ID_247', 'Phormingochilus', 'passport-247-photo', 'female', 'メス', 'instar_2', '2齢', 'PRIVATE_KEEPER'), $name);
        setae_fixture_assert(empty($context['identity']) && empty($context['gallery']) && empty($context['hero']), $name . ': private context is empty, not merely hidden');
    }
    if (strpos($name, 'transfer') === 0) {
        passport_includes($html, '引き継ぎ受付中', $name);
        passport_includes($html, '承認', $name);
        passport_includes($html, '申請だけでは所有権は移動しません', $name);
        setae_fixture_assert(empty($context['history']['items']), $name . ': transfer-only must not expose care history');
    }
    if ($name === 'transfer-logged-in') {
        passport_includes($html, 'name="setae_qr_claim"', $name);
        passport_includes($html, 'name="setae_qr_claim_nonce"', $name);
        passport_includes($html, 'fixture-nonce-setae_qr_claim_r4k7m', $name);
    }
    if ($name === 'transfer-requested') { passport_includes($html, '申請', $name); }
    if ($name === 'basic-public') {
        passport_includes($html, 'SPECIMEN_ID_247', $name);
        passport_includes($html, '公開個体・基本情報', $name);
        setae_fixture_assert(empty($context['history']['items']), $name . ': life history is empty');
        setae_fixture_assert(count($context['gallery']) <= 1, $name . ': only public primary identity photo is allowed');
        passport_excludes($html, array('2026.08.27', '2026-08-27'), $name);
    }
    if ($name === 'life-history-public') {
        passport_includes($html, '公開個体・生活史', $name);
        setae_fixture_assert(count($context['history']['items']) === 20, $name . ': actual manager cap must remain 20');
        setae_fixture_assert(count($context['gallery']) === 9, $name . ': primary plus eight explicitly shared photos');
        passport_includes($html, '20件', $name);
        passport_includes($html, '写真9点', $name);
    }
    if ($case['mode'] === 'owner') {
        passport_includes($html, '所有者だけに表示', $name);
        passport_includes($html, 'アプリで管理', $name);
        passport_includes($html, '公開設定', $name);
        passport_includes($html, 'QR設定', $name);
    }
    echo 'PASS ' . $name . PHP_EOL;
}

// An owner viewing Basic must not accidentally preview their expanded owner
// history as visitor content. Internal data has a separate labelled section.
list($controller, $context) = setae_fixture_passport(array('visibility' => 'basic', 'viewer' => 11));
setae_fixture_assert($context['visitor_mode'] === 'basic', 'Owner Basic keeps Basic visitor scope');
setae_fixture_assert(empty($context['history']['items']) && empty($context['summary']), 'Owner Basic has no public life-history summary');
setae_fixture_assert(!empty($context['owner']['history']) && count($context['owner']['history']) <= 6, 'Owner activity remains in the owner-only context');

// Basic remains restricted even if upstream data becomes richer in the future.
list($controller, $context) = setae_fixture_passport(array('visibility' => 'basic'), function ($data) {
    $data['life_history'] = array(array('date' => '2097-02-01', 'type' => 'molt', 'label' => 'BASIC_EXTRA_HISTORY_247'));
    $data['gallery'] = array(array('url' => '/BASIC_EXTRA_IMAGE_247.jpg', 'date' => '2097-02-01', 'type' => 'molt', 'label' => 'Photo'));
    return $data;
});
passport_excludes(setae_fixture_render($controller, $context) . json_encode($context), array('BASIC_EXTRA_', '2097-02-', '2097.02.'), 'Basic richer upstream data');

// The public manager's publish/shared boundaries are real queries, not a fixture filter.
list($controller, $context, $data) = setae_fixture_passport();
passport_excludes(json_encode($data), array('PRIVATE_PHOTO_247', 'UNSHARED_PHOTO_247', '2099-09-19'), 'manager data');
setae_fixture_assert(count($data['life_history']) === 20, 'Manager life-history cap changed');
setae_fixture_assert(count($data['recent_activity']) <= 6, 'Manager recent activity cap changed');
setae_fixture_assert(count($data['gallery']) === 8, 'Manager shared gallery cap changed');

// Defensive context allowlisting: private markers and extra memo fields must not
// leak even if a future caller accidentally supplies them in otherwise public data.
list($controller, $context) = setae_fixture_passport(array(), function ($data) {
    $data['owner'] = array('name' => 'INJECTED_OWNER_247', 'profile_url' => '/INJECTED_OWNER_URL_247/');
    $data['internal_memo'] = 'INJECTED_MEMO_247';
    $data['care_tasks'] = array(array('title' => 'INJECTED_TASK_247'));
    $data['enclosure'] = array('location' => 'INJECTED_LOCATION_247');
    array_unshift($data['life_history'], array('date' => '2098-01-01', 'type' => 'molt', 'label' => 'INJECTED_PRIVATE_HISTORY_247', 'private' => true));
    array_unshift($data['life_history'], array('date' => '2098-01-02', 'type' => 'growth', 'label' => 'INJECTED_FALSE_PUBLIC_247', '_is_public' => false));
    array_unshift($data['gallery'], array('url' => '/INJECTED_PRIVATE_IMAGE_247.jpg', 'date' => '2098-01-03', 'label' => 'Private photo', 'shared' => false));
    array_unshift($data['gallery'], array('url' => '/INJECTED_VISIBILITY_IMAGE_247.jpg', 'date' => '2098-01-04', 'label' => 'Private photo', 'visibility' => 'private'));
    return $data;
});
passport_excludes(setae_fixture_render($controller, $context) . json_encode($context), array('INJECTED_', '2098-01-', '2098.01.'), 'hostile mixed data');

foreach (array(0, 1, 9) as $photos) {
    list($controller, $context) = setae_fixture_passport(array('photos' => $photos));
    $html = setae_fixture_render($controller, $context);
    setae_fixture_assert(count($context['gallery']) === $photos, 'Photo count ' . $photos);
    setae_fixture_assert(substr_count($html, 'fetchpriority="high"') === ($photos ? 1 : 0), 'Only one main image can be high priority');
    if (!$photos) { passport_includes($html, 'setae-specimen-placeholder', 'No photo placeholder'); }
}
foreach (array(0, 1, 30) as $records) {
    list($controller, $context) = setae_fixture_passport(array('history' => $records, 'photos' => 0));
    setae_fixture_assert(count($context['history']['items']) === min(20, $records), 'History count ' . $records);
}

// Applying for transfer must not transfer ownership; a repeat is idempotent.
require_once __DIR__ . '/helpers/claim-registration-fixture.php';
setae_claim_seed(array('visibility' => 'private', 'viewer' => 22, 'transfer' => true));
$request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
setae_fixture_assert(!is_wp_error($request), 'Transfer request can be created');
setae_fixture_assert(get_post(201)->post_author === 11 && get_post(101)->post_author === 11, 'Request must preserve current owner');
setae_fixture_assert(get_post_meta($request->ID, '_setae_transfer_status', true) === 'pending', 'Request remains pending');
$repeated = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
setae_fixture_assert($repeated->ID === $request->ID, 'Repeat request reuses pending request');

echo "Public passport privacy tests passed (real manager/controller/templates; synthetic WP boundary)\n";
