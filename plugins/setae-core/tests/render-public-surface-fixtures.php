<?php
require_once __DIR__ . '/helpers/public-surfaces-fixture.php';
$destination = $argv[1] ?? (__DIR__ . '/fixtures/public-v248');
if (!is_dir($destination)) { mkdir($destination, 0777, true); }
if (!is_dir($destination . '/assets')) { mkdir($destination . '/assets', 0777, true); }
$GLOBALS['setae_fixture_browser'] = true;
$GLOBALS['setae_fixture_origin'] = getenv('SETAE_QA_BASE') ?: 'http://127.0.0.1:8872';
$GLOBALS['setae_fixture_asset_route'] = '/tests/fixtures/public-v248/assets/';
$GLOBALS['setae_fixture_harness'] = array('/tests/fixtures/public-passport-harness.js', '/tests/fixtures/public-surfaces-harness.js');
foreach (array('specimen.spider', 'specimen.generic') as $icon) {
    $method = new ReflectionMethod('Setae_Icon_Registry', 'standalone_svg'); $method->setAccessible(true);
    file_put_contents($destination . '/assets/' . $icon . '.svg', $method->invoke(null, Setae_Icon_Registry::get($icon)));
}
$states = array(
    'care-photo' => array(), 'care-no-photo' => array('photo' => false), 'care-no-note' => array('note' => false),
    'care-no-reactions' => array('reactions' => false), 'care-no-comments' => array('comments' => 0),
    'care-long' => array('long' => true), 'care-logged-in' => array('viewer' => 22), 'care-disabled' => array('registration' => false),
    'care-not-found' => array('not_found' => true), 'care-plant' => array('classification' => 'plant'),
    'care-avatar-setae' => array('avatar' => 'setae'), 'care-avatar-wordpress' => array('avatar' => 'wordpress'), 'care-avatar-mystery' => array('avatar' => 'mystery'),
    'care-theme-reset' => array('theme' => true),
    'partner-guest' => array(), 'partner-logged-in' => array('viewer' => 22), 'partner-disabled' => array('registration' => false), 'partner-long' => array('long' => true),
    'partner-theme-reset' => array('theme' => true)
);
$fixtures = array();
foreach ($states as $name => $options) {
    $surface = strpos($name, 'care-') === 0 ? 'care' : 'partner';
    list($controller, $view) = $surface === 'care' ? setae_fixture_care($options) : setae_fixture_partner($options);
    $html = setae_fixture_surface_render($controller, $view, $surface);
    $file = $name . '.html'; file_put_contents($destination . '/' . $file, $html);
    $fixtures[$name] = array('file' => $file, 'surface' => $surface, 'options' => $options, 'sha256' => hash('sha256', $html));
}
$sources = array();
foreach (array('includes/frontend/class-setae-public-care-share.php', 'includes/frontend/class-setae-public-partner.php', 'includes/frontend/class-setae-public-home.php', 'includes/frontend/class-setae-public-registration.php', 'includes/frontend/class-setae-public-visual.php', 'includes/class-setae-public-identity.php', 'tests/helpers/public-passport-fixture.php', 'tests/helpers/public-surfaces-fixture.php', 'tests/fixtures/public-passport-harness.js', 'tests/fixtures/public-surfaces-harness.js', 'tests/fixtures/public-theme-hostile-v248.css') as $file) { $sources[$file] = hash_file('sha256', SETAE_PLUGIN_DIR . $file); }
foreach (glob(SETAE_PLUGIN_DIR . 'templates/public/*.php') as $file) { $sources[str_replace(SETAE_PLUGIN_DIR, '', $file)] = hash_file('sha256', $file); }
foreach (array('assets/css/public-foundation.css', 'assets/css/public-registration.css', 'assets/css/public-care-share.css', 'assets/css/public-partner.css', 'assets/js/public-registration.js', 'assets/js/public-share.js', 'assets/js/public-care-share.js', 'assets/js/public-partner.js') as $file) { $sources[$file] = hash_file('sha256', SETAE_PLUGIN_DIR . $file); }
file_put_contents($destination . '/manifest.json', json_encode(array('generatedAt' => date(DATE_ATOM), 'sourceKind' => 'Actual production Care/Partner controller and template output; synthetic WordPress users/posts/comments, test artwork and mocked browser APIs. No live WordPress or physical-device verification.', 'baseUrl' => $GLOBALS['setae_fixture_origin'], 'sources' => $sources, 'fixtures' => $fixtures), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
echo 'Generated ' . count($fixtures) . ' actual public surface fixtures in ' . $destination . PHP_EOL;
