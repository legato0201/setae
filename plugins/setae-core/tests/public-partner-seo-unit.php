<?php
require_once __DIR__ . '/helpers/public-surfaces-fixture.php';
foreach (array(array(), array('viewer' => 22), array('registration' => false)) as $options) {
    list($controller, $view) = setae_fixture_partner(array_merge($options, array('tracking' => true)));
    $html = setae_fixture_surface_render($controller, $view, 'partner');
    foreach (array('/assets/js/public-share.js', '/assets/js/public-partner.js', '/assets/js/public-registration.js') as $asset) { setae_fixture_assert(in_array($asset, $GLOBALS['setae_fixture_scripts'], true), 'Actual Partner enqueue includes ' . $asset); }
    foreach (array('/assets/css/public-foundation.css', '/assets/css/public-partner.css', '/assets/css/public-registration.css') as $asset) { setae_fixture_assert(in_array($asset, $GLOBALS['setae_fixture_styles'], true), 'Actual Partner enqueue includes ' . $asset); }
    setae_fixture_assert($view['seo']['canonical'] === 'https://setae.test/setae-partner/', 'Clean permanent Partner canonical.');
    setae_fixture_assert($view['registration']['referral_source'] === 'fixture', 'Incoming UTM attribution remains in existing registration context, not canonical.');
    setae_fixture_assert(strpos($html, 'property="og:type" content="website"') !== false, 'Partner retains Website metadata.');
    foreach (array('description', 'og:title', 'og:description', 'og:url', 'og:image', 'twitter:card') as $name) {
        setae_fixture_assert(preg_match('/<meta\b[^>]*(?:name|property)="' . preg_quote($name, '/') . '"[^>]*content="[^"]+"/', $html), 'Required Partner metadata: ' . $name);
    }
    setae_fixture_assert(!preg_match('/<meta[^>]*noindex/', $html), 'Partner index policy remains unchanged.');
    setae_fixture_assert($GLOBALS['setae_fixture_theme_reads'] === 0 && strpos($html, 'forbidden-theme') === false, 'Partner does not use a theme OG image.');
    setae_fixture_assert(!preg_match('/PRIVATE_|aggregateRating|priceCurrency|ratingValue|areaServed/', $html), 'No private account information or invented commercial claims.');
    setae_fixture_assert(strpos($html, 'readonly') !== false, 'Copy kit remains a selectable read-only field.');
}
list($controller, $view) = setae_fixture_partner();
$GLOBALS['setae_fixture_options']['permalink_structure'] = '';
$view = setae_fixture_invoke($controller, 'build_view_context');
setae_fixture_assert(strpos($view['seo']['canonical'], 'setae_partner=1') !== false, 'Existing query-var route remains in a plain-permalink canonical.');
setae_fixture_assert(!preg_match('/[?&](?:ref|referral_code|utm_source|register)=/', $view['seo']['canonical']), 'Canonical strips entry tracking fields.');
echo "Public Partner SEO tests passed (Website metadata, canonical/index policy, plugin fallback, no fabricated claims)\n";
