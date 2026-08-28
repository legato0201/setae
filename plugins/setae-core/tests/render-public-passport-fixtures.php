<?php
/** Generate browser fixtures from real production renderers; never handwritten replicas. */
require_once __DIR__ . '/helpers/public-registration-fixture.php';
$destination = $argv[1] ?? (__DIR__ . '/fixtures/passport-v247');
if (!is_dir($destination) && !mkdir($destination, 0777, true)) { throw new RuntimeException('Cannot create fixture output directory'); }
$GLOBALS['setae_fixture_browser'] = true;
$GLOBALS['setae_fixture_origin'] = getenv('SETAE_QA_BASE') ?: 'http://127.0.0.1:8872';
if (!is_dir($destination . '/assets')) { mkdir($destination . '/assets', 0777, true); }
foreach (array('specimen.spider', 'specimen.generic') as $icon) {
    $standalone = new ReflectionMethod('Setae_Icon_Registry', 'standalone_svg');
    $standalone->setAccessible(true);
    file_put_contents($destination . '/assets/' . $icon . '.svg', $standalone->invoke(null, Setae_Icon_Registry::get($icon)));
}
$states = array(
    'private' => array('visibility' => 'private'),
    'private-owner' => array('visibility' => 'private', 'viewer' => 11),
    'transfer' => array('visibility' => 'private', 'transfer' => true),
    'transfer-logged-in' => array('visibility' => 'private', 'transfer' => true, 'viewer' => 22),
    'transfer-requested' => array('visibility' => 'private', 'transfer' => true, 'viewer' => 22, 'requested' => true),
    'basic' => array('visibility' => 'basic'),
    'life-history' => array('visibility' => 'life_history'),
    'owner-basic' => array('visibility' => 'basic', 'viewer' => 11),
    'owner' => array('visibility' => 'life_history', 'viewer' => 11),
    'no-photos' => array('photos' => 0),
    'one-photo' => array('photos' => 1),
    'nine-photos' => array('photos' => 9),
    'no-history' => array('history' => 0, 'photos' => 0),
    'one-history' => array('history' => 1, 'photos' => 1),
    'many-history' => array('history' => 35),
    'missing-species' => array('species' => false, 'photos' => 0),
    'long-identity' => array('long' => true),
    'undetermined' => array('gender' => 'unknown', 'stage' => 'undetermined'),
    'species-fallback' => array('image_source' => 'species'),
    'registration-disabled' => array('registration' => false),
);
$fixtures = array();
foreach ($states as $name => $options) {
    list($controller, $context) = setae_fixture_passport($options);
    $html = setae_fixture_render($controller, $context);
    $file = 'passport-' . $name . '.html';
    file_put_contents($destination . '/' . $file, $html);
    $fixtures[$name] = array('file' => $file, 'mode' => $context['mode'], 'visitor_mode' => $context['visitor_mode'], 'options' => $options, 'sha256' => hash('sha256', $html));
}
foreach (array('public_profile', 'public_care_share', 'public_partner') as $surface) {
    foreach (array('guest' => array(), 'logged-in' => array('viewer' => 22), 'disabled' => array('registration' => false)) as $state => $options) {
        $html = setae_fixture_registration_surface($surface, $options);
        $file = $surface . '-' . $state . '.html';
        file_put_contents($destination . '/' . $file, $html);
        $fixtures[$surface . '-' . $state] = array('file' => $file, 'surface' => $surface, 'options' => $options, 'sha256' => hash('sha256', $html));
    }
}
$sources = array();
foreach (array('includes/frontend/class-setae-public-qr.php', 'includes/frontend/class-setae-public-profile.php', 'includes/frontend/class-setae-public-care-share.php', 'includes/frontend/class-setae-public-partner.php', 'includes/frontend/class-setae-public-registration.php', 'includes/class-setae-qr-manager.php', 'tests/helpers/public-passport-fixture.php', 'tests/helpers/public-registration-fixture.php', 'tests/helpers/public-surfaces-fixture.php') as $file) { $sources[$file] = hash_file('sha256', SETAE_PLUGIN_DIR . $file); }
foreach (glob(SETAE_PLUGIN_DIR . 'templates/public/*.php') as $file) { $sources[str_replace(SETAE_PLUGIN_DIR, '', $file)] = hash_file('sha256', $file); }
foreach (array('assets/css/public-foundation.css', 'assets/css/public-passport.css', 'assets/css/public-profile.css', 'assets/css/public-registration.css', 'assets/css/public-care-share.css', 'assets/css/public-partner.css', 'assets/js/public-passport.js', 'assets/js/public-profile.js', 'assets/js/public-registration.js', 'assets/js/public-share.js', 'assets/js/public-care-share.js', 'assets/js/public-partner.js') as $file) { $sources[$file] = hash_file('sha256', SETAE_PLUGIN_DIR . $file); }
file_put_contents($destination . '/manifest.json', json_encode(array('generatedAt' => date(DATE_ATOM), 'sourceKind' => 'Actual production PHP controllers/templates and QR data layer; synthetic WordPress APIs and data. Not a live WordPress installation.', 'baseUrl' => $GLOBALS['setae_fixture_origin'], 'sources' => $sources, 'fixtures' => $fixtures), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
echo 'Generated ' . count($fixtures) . ' production-rendered public fixtures in ' . $destination . PHP_EOL;
