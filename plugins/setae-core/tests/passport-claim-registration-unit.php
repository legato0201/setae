<?php
require_once __DIR__ . '/helpers/claim-registration-fixture.php';

$checks = 0;
$test = function ($name, $callback) use (&$checks) {
    setae_claim_seed();
    $callback();
    $checks++;
};
$pending = function ($intent = true) { setae_claim_assert(Setae_QR_Manager::store_pending_claim(22, 'r4k7m', $intent), 'Synthetic claim should be stored'); };
$verify = function ($token = 'LOCAL_TEST_VERIFICATION_TOKEN') { return Setae_Claim_Registration::verification_redirect(22, $token); };
$clean = function ($url) {
    parse_str(parse_url($url, PHP_URL_QUERY) ?: '', $query);
    setae_claim_assert(!isset($query['token']) && !isset($query['uid']) && strpos($url, 'LOCAL_TEST') === false, 'Redirect must not contain bearer token or account id');
};

$test('fresh token authenticates once and requests only', function () use ($pending, $verify, $clean) {
    $pending(); $url = $verify(); $clean($url);
    setae_claim_assert(strpos($url, '/r4k7m/?verified=1&requested=1') !== false, 'Fresh claim returns to the permanent Passport');
    setae_claim_assert(get_current_user_id() === 22 && count($GLOBALS['setae_fixture_auth_cookies']) === 1, 'Only the verified account receives a session');
    setae_claim_assert(get_user_meta(22, '_setae_activation_token', true) === '' && (int) get_user_meta(22, '_setae_is_verified', true) === 1, 'Token is consumed before verified state');
    $requests = setae_claim_requests();
    setae_claim_assert(count($requests) === 1 && get_post_meta($requests[0]->ID, '_setae_transfer_status', true) === 'pending', 'Verification creates one pending request');
    setae_claim_assert((int) get_post(201)->post_author === 11, 'Verification must not approve or transfer ownership');
    setae_claim_assert(Setae_QR_Manager::get_pending_claim(22) === '' && !Setae_QR_Manager::pending_claim_has_intent(22), 'Successful request clears its pending state');
    $again = $verify(); $clean($again);
    setae_claim_assert($again === $url && count(setae_claim_requests()) === 1 && count($GLOBALS['setae_fixture_auth_cookies']) === 1, 'Same-session revisit only displays the existing request');
    wp_set_current_user(0); $anonymous = $verify(); $clean($anonymous);
    setae_claim_assert(strpos($anonymous, '/r4k7m/') === false && get_current_user_id() === 0 && count($GLOBALS['setae_fixture_auth_cookies']) === 1, 'Reused link cannot authenticate a logged-out browser');
});

$test('arbitrary token never authenticates an already verified user', function () use ($verify, $clean) {
    update_user_meta(22, '_setae_is_verified', 1);
    $url = $verify('arbitrary-nonempty-token'); $clean($url);
    setae_claim_assert(!$GLOBALS['setae_fixture_auth_cookies'] && !setae_claim_requests() && get_current_user_id() === 0, 'Already-verified API status is not authentication proof');
});

$test('invalid and non-scalar input fails safely', function () use ($pending, $verify, $clean) {
    $pending(); $url = $verify('wrong'); $clean($url);
    setae_claim_assert(strpos($url, 'verification_error=invalid_verification') !== false, 'Invalid token gives a safe error code');
    foreach (array(array(22, array('bad')), array(array(22), 'token'), array(999, 'token')) as $args) {
        $clean(Setae_Claim_Registration::verification_redirect($args[0], $args[1]));
    }
    setae_claim_assert(!$GLOBALS['setae_fixture_auth_cookies'] && !setae_claim_requests() && Setae_QR_Manager::get_pending_claim(22) === 'r4k7m', 'Invalid input cannot mutate authentication or pending state');
});

$test('failed compare-and-delete cannot establish verified state', function () use ($pending, $verify) {
    $pending(); $GLOBALS['setae_fixture_fail_token_consume'] = true; $verify();
    setae_claim_assert((int) get_user_meta(22, '_setae_is_verified', true) === 0 && !$GLOBALS['setae_fixture_auth_cookies'] && !setae_claim_requests(), 'Losing token-consumption race fails closed');
});

$test('legacy code without informed intent never auto-requests', function () use ($pending, $verify) {
    $pending(false); $url = $verify();
    setae_claim_assert(strpos($url, 'claim=1') !== false && !setae_claim_requests() && Setae_QR_Manager::get_pending_claim(22) === 'r4k7m', 'Legacy code is a return address only');
    $_GET['claim'] = '1';
    $controller = new Setae_Public_QR(SETAE_VERSION);
    $redirect = $controller->redirect_pending_claim('https://setae.test/app/', '', get_userdata(22));
    setae_claim_assert(strpos($redirect, '/r4k7m/') !== false && Setae_QR_Manager::get_pending_claim(22) === 'r4k7m', 'A login redirect/page visit does not consume pending intent');
});

$test('existing request is reused', function () use ($pending, $verify) {
    $first = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
    $pending(); $verify();
    setae_claim_assert(count(setae_claim_requests()) === 1 && setae_claim_requests()[0]->ID === $first->ID, 'Existing valid pending request must be reused');
    setae_claim_assert(count(array_filter($GLOBALS['setae_fixture_events'], function ($event) { return $event['name'] === 'transfer_requested'; })) === 1, 'Request event is once per business request');
});

foreach (array('lock', 'insert') as $failure) {
    $test('temporary ' . $failure . ' preserves pending', function () use ($pending, $verify, $failure) {
        $pending();
        if ($failure === 'lock') { $GLOBALS['setae_fixture_lock_failure'] = true; } else { $GLOBALS['setae_fixture_insert_error'] = Setae_QR_Manager::TRANSFER_POST_TYPE; }
        $url = $verify();
        setae_claim_assert(strpos($url, 'claim_error=claim_unavailable') !== false && Setae_QR_Manager::pending_claim_has_intent(22) && !setae_claim_requests(), 'Transient failures retain explicit pending intent');
        $GLOBALS['setae_fixture_lock_failure'] = false; $GLOBALS['setae_fixture_insert_error'] = '';
        $verify();
        setae_claim_assert(!setae_claim_requests() && count($GLOBALS['setae_fixture_auth_cookies']) === 1, 'Retrying a consumed verification URL never silently resubmits');
        $request = Setae_QR_Manager::create_transfer_request(get_post(101), 22);
        setae_claim_assert(!is_wp_error($request) && count(setae_claim_requests()) === 1, 'Explicit claim retry can succeed');
    });
}

foreach (array('closed', 'archived', 'missing', 'receipt', 'own', 'lookup_failure') as $state) {
    $test('changed target ' . $state, function () use ($pending, $verify, $state) {
        $pending();
        if ($state === 'closed') { delete_post_meta(201, Setae_QR_Manager::TRANSFER_ENABLED_META); }
        if ($state === 'archived') { update_post_meta(201, '_setae_spider_archived', '1'); }
        if ($state === 'missing' || $state === 'lookup_failure') { unset($GLOBALS['setae_fixture_posts'][101]); }
        if ($state === 'lookup_failure') { $GLOBALS['wpdb']->last_error = 'Synthetic temporary lookup failure'; }
        if ($state === 'receipt') { update_post_meta(201, '_setae_transfer_receipt', '1'); }
        if ($state === 'own') { wp_update_post(array('ID' => 101, 'post_author' => 22)); wp_update_post(array('ID' => 201, 'post_author' => 22)); }
        $url = $verify();
        $expected = $state === 'own' ? 'claim_already_owned' : (in_array($state, array('closed', 'archived'), true) ? 'claim_closed' : 'claim_unavailable');
        setae_claim_assert(strpos($url, 'claim_error=' . $expected) !== false && !setae_claim_requests(), 'Changed target must give only an allowed safe state code');
        $keep = in_array($state, array('closed', 'archived', 'lookup_failure'), true);
        setae_claim_assert((Setae_QR_Manager::get_pending_claim(22) !== '') === $keep, 'Only successful or permanently invalid/owned claims clear pending');
    });
}

$test('completed request cannot replay', function () use ($pending, $verify) {
    $pending(); $verify(); $request = setae_claim_requests()[0];
    update_post_meta($request->ID, '_setae_transfer_status', 'approved');
    wp_update_post(array('ID' => 201, 'post_author' => 22)); wp_update_post(array('ID' => 101, 'post_author' => 22));
    $verify();
    setae_claim_assert(count(setae_claim_requests()) === 1 && count($GLOBALS['setae_fixture_auth_cookies']) === 1, 'Completed claim is not recreated or reauthenticated');
});

$test('actual registration persists explicit consent and safe events', function () {
    $result = Setae_App_Operations::register_user(array('email' => 'new@example.test', 'password' => 'LOCAL_TEST_PASSWORD', 'username' => 'fixture-new', 'terms_accepted' => '1', 'qr_claim_code' => 'r4k7m', 'qr_claim_intent' => 'request_after_verification', 'referral_source' => 'public_passport'));
    setae_claim_assert(!is_wp_error($result), 'Actual registration succeeds in the synthetic datastore');
    $id = $result['user_id'];
    setae_claim_assert(Setae_QR_Manager::pending_claim_has_intent($id) && count($GLOBALS['setae_fixture_mail']) === 1, 'Explicit intent survives until email verification');
    $events = json_encode($GLOBALS['setae_fixture_events']);
    setae_claim_assert(strpos($events, 'new@example.test') === false && strpos($events, 'LOCAL_TEST_PASSWORD') === false && strpos($events, get_user_meta($id, '_setae_activation_token', true)) === false, 'Events never contain credentials/token');
    setae_claim_assert($GLOBALS['setae_fixture_events']['registration:' . $id]['context']['partner_user_id'] === 11, 'QR attribution comes from the server target owner');
});

$test('code-only registration and terms remain compatible', function () {
    $input = array('email' => 'legacy@example.test', 'password' => 'LOCAL_TEST_PASSWORD', 'username' => 'fixture-legacy', 'qr_claim_code' => 'r4k7m');
    $denied = Setae_App_Operations::register_user($input);
    setae_claim_assert(is_wp_error($denied) && $denied->get_error_code() === 'terms_not_accepted', 'Terms remain mandatory');
    $input['terms_accepted'] = true;
    $result = Setae_App_Operations::register_user($input);
    setae_claim_assert(!is_wp_error($result) && !Setae_QR_Manager::pending_claim_has_intent($result['user_id']), 'Old clients do not acquire automatic-request consent');
});

$test('analytics outage does not change a successful verification/request', function () use ($pending, $verify) {
    $pending(); $GLOBALS['setae_fixture_event_failure'] = true; $url = $verify();
    setae_claim_assert(strpos($url, 'requested=1') !== false && count(setae_claim_requests()) === 1, 'Secondary event storage cannot roll back business success');
});

$test('Partner return destination is exact and does not start a trial', function () use ($clean) {
    $allowed = add_query_arg('setae_plan', 'breeder_trial', Setae_App_Shell::app_url());
    foreach (array('https://elsewhere.test/?setae_plan=breeder_trial', '//elsewhere.test/', $allowed . '&next=https://elsewhere.test/', array($allowed), '', 'javascript:alert(1)') as $url) {
        setae_claim_assert(!Setae_Claim_Registration::store_return_url(22, $url), 'Only the fixed plan confirmation destination may be stored');
    }
    $input = array('email' => 'partner@example.test', 'password' => 'LOCAL_TEST_PASSWORD', 'terms_accepted' => true, 'return_url' => $allowed, 'referral_source' => 'public_partner');
    $result = Setae_App_Operations::register_user($input);
    setae_claim_assert(!is_wp_error($result), 'Partner registration remains a normal registration');
    $id = $result['user_id'];
    setae_claim_assert(get_user_meta($id, Setae_Claim_Registration::RETURN_URL_META, true) === $allowed, 'The confirmation destination survives registration');
    $url = Setae_Claim_Registration::verification_redirect($id, get_user_meta($id, '_setae_activation_token', true)); $clean($url);
    setae_claim_assert($url === add_query_arg('verified', '1', $allowed), 'Fresh verification returns to plan confirmation');
    setae_claim_assert(!setae_claim_requests(), 'Partner entry alone never submits a specimen claim');
    foreach (array_keys($GLOBALS['setae_fixture_user_meta'][$id]) as $key) {
        setae_claim_assert(strpos($key, 'trial_') === false && strpos($key, 'stripe_') === false, 'Registration/verification does not activate a trial or billing');
    }
    update_user_meta($id, Setae_Claim_Registration::RETURN_URL_META, 'https://elsewhere.test/');
    $url = Setae_Claim_Registration::verification_redirect($id, 'used'); $clean($url);
    setae_claim_assert($url === add_query_arg('verified', '1', Setae_App_Shell::app_url()), 'A corrupted saved destination also fails closed');
});

$test('actual registration template has three claim fields and explicit intent only while offered', function () {
    foreach (array(true, false) as $enabled) {
        update_post_meta(201, Setae_QR_Manager::TRANSFER_ENABLED_META, $enabled ? '1' : '');
        $data = Setae_QR_Manager::get_public_target_data(get_post(101), 0);
        $context = setae_fixture_invoke(new Setae_Public_QR(SETAE_VERSION), 'build_template_context', $data, 'r4k7m');
        $registration = $context['registration'];
        setae_claim_assert($registration['qr_claim_code'] === 'r4k7m', 'Legacy public Passport still carries its own QR code');
        setae_claim_assert($registration['qr_claim_intent'] === ($enabled ? 'request_after_verification' : ''), 'Code alone is never informed request intent');
        ob_start(); Setae_Public_Registration::render($registration); $html = ob_get_clean();
        preg_match_all('/<input\b[^>]*type="(?!hidden)([^"]+)"[^>]*name="([^"]+)"/', $html, $matches);
        setae_claim_assert($matches[2] === array('email', 'password', 'terms_accepted'), 'Claim registration asks only email, password and terms');
        setae_claim_assert(strpos($html, 'type="hidden" name="referral_code"') !== false && strpos($html, 'name="qr_claim_intent"') !== false, 'Referral/claim context are preserved without extra inputs');
        setae_claim_assert(strpos($html, '認証メールを送る') !== false && strpos($registration['description'], '所有者') !== false, 'Copy explains email verification and owner approval');
    }
});

$test('closed private target shows only a safe authenticated acquisition notice', function () use ($pending, $verify) {
    $pending();
    update_post_meta(201, Setae_QR_Manager::TRANSFER_ENABLED_META, '');
    update_post_meta(201, Setae_QR_Manager::PUBLIC_MODE_META, 'private');
    $url = $verify(); parse_str(parse_url($url, PHP_URL_QUERY), $_GET);
    $controller = new Setae_Public_QR(SETAE_VERSION);
    $data = Setae_QR_Manager::get_public_target_data(get_post(101), 22);
    $context = setae_fixture_invoke($controller, 'build_template_context', $data, 'r4k7m');
    setae_claim_assert($context['mode'] === 'private' && count($context['messages']) === 1, 'Authenticated closed claim receives a generic explanation');
    setae_claim_assert(!$context['identity'] && !$context['gallery'] && !$context['history']['items'] && !$context['registration']['enabled'], 'Error state does not loosen the private boundary');
    wp_set_current_user(0);
    $context = setae_fixture_invoke($controller, 'build_template_context', $data, 'r4k7m');
    setae_claim_assert(!$context['messages'], 'A forged error query gives anonymous visitors no claim/account state');
});

$test('partial request metadata failure retains pending intent and permits one explicit retry', function () use ($pending) {
    foreach (array('_setae_transfer_target_id', '_setae_transfer_spider_id', '_setae_transfer_from_user', '_setae_transfer_to_user', '_setae_transfer_status', '_setae_transfer_requested_at') as $failed_key) {
        setae_claim_seed(); $pending(); update_user_meta(22, '_setae_is_verified', 1);
        $hits = 0;
        $GLOBALS['setae_fixture_mutation_filter'] = function ($op, $id, $key) use ($failed_key, &$hits) { if ($key === $failed_key) { $hits++; return false; } return true; };
        $result = Setae_QR_Manager::request_pending_claim(22);
        setae_claim_assert($hits > 0 && is_wp_error($result) && !setae_claim_requests(), 'Partially saved request rolls back completely');
        setae_claim_assert(Setae_QR_Manager::get_pending_claim(22) === 'r4k7m' && Setae_QR_Manager::pending_claim_has_intent(22), 'Save failure never consumes pending claim intent');
        setae_claim_assert(!$GLOBALS['setae_fixture_events'] && !Setae_QR_Manager::get_notifications(11), 'Uncommitted request cannot notify or emit success');
        unset($GLOBALS['setae_fixture_mutation_filter']);
        $result = Setae_QR_Manager::request_pending_claim(22);
        setae_claim_assert(!is_wp_error($result) && count(setae_claim_requests()) === 1, 'Explicit retry creates exactly one complete request');
    }
});

$test('unsupported storage engine cannot consume a pending claim', function () use ($pending) {
    $pending(); update_user_meta(22, '_setae_is_verified', 1);
    $GLOBALS['setae_fixture_engine'] = 'MyISAM';
    $result = Setae_QR_Manager::request_pending_claim(22);
    setae_claim_assert(is_wp_error($result) && $result->get_error_code() === 'setae_transaction_unsupported', 'Unknown transaction safety fails closed');
    setae_claim_assert(!setae_claim_requests() && Setae_QR_Manager::pending_claim_has_intent(22), 'No half-request is created and pending state survives');
    setae_claim_assert(!in_array('START TRANSACTION', $GLOBALS['wpdb']->queries, true) && $GLOBALS['wpdb']->reconnect_retries === 5, 'Unsupported engine does not start writes and restores reconnect policy');
});

echo "Passport claim registration tests passed ($checks checks; synthetic WP, no SMTP or real sessions)\n";
