<?php

class WP_Error
{
    private $code;
    private $message;

    public function __construct($code, $message)
    {
        $this->code = $code;
        $this->message = $message;
    }

    public function get_error_message()
    {
        return $this->message;
    }

    public function get_error_code()
    {
        return $this->code;
    }
}

function is_wp_error($value)
{
    return $value instanceof WP_Error;
}

$GLOBALS['setae_test_options'] = array();

function get_option($key, $default = false)
{
    return array_key_exists($key, $GLOBALS['setae_test_options'])
        ? $GLOBALS['setae_test_options'][$key]
        : $default;
}

function update_option($key, $value, $autoload = null)
{
    $GLOBALS['setae_test_options'][$key] = $value;
    return true;
}

function home_url($path = '/')
{
    return 'https://setae.test' . $path;
}

function add_query_arg($key, $value, $url)
{
    return $url . (strpos($url, '?') === false ? '?' : '&') . rawurlencode($key) . '=' . rawurlencode($value);
}

function assert_true($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_same($expected, $actual, $message)
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . PHP_EOL . 'Expected: ' . var_export($expected, true) . PHP_EOL . 'Actual: ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

define('SETAE_PLUGIN_DIR', dirname(__DIR__) . '/');
define('SETAE_PLUGIN_URL', 'https://setae.test/wp-content/plugins/setae-core/');

require_once dirname(__DIR__) . '/includes/class-setae-icon-registry.php';

$definitions = Setae_Icon_Registry::definitions();
assert_same(69, count($definitions), 'Registry should contain 39 App, 23 Public, and 7 specimen definitions.');
assert_same(39, count(Setae_Icon_Registry::app_key_map()), 'All existing App icons must be mapped.');
assert_same(23, count(Setae_Icon_Registry::public_key_map()), 'All public QR icons must be mapped.');
assert_same(array(), get_option(Setae_Icon_Registry::OPTION_NAME, array()), 'Defaults must not be copied into the option.');

$icons_js = file_get_contents(dirname(__DIR__) . '/assets/app/components/icons.js');
foreach (Setae_Icon_Registry::app_key_map() as $name => $key) {
    $matched = preg_match('/^\s{2}' . preg_quote($name, '/') . ": '([^']*)'/m", $icons_js, $matches);
    assert_same(1, $matched, 'The bundled JS icon path is missing: ' . $name);
    assert_true(strpos($definitions[$key]['default_svg'], $matches[1]) !== false, 'PHP Registry default must preserve the v1.0.227 JS icon: ' . $name);
}

$default_collection = Setae_Icon_Registry::get_default('nav.collection');
assert_true(strpos($default_collection, '<rect') !== false, 'Collection default icon is missing.');
assert_same($default_collection, Setae_Icon_Registry::get('nav.collection'), 'Missing override should return the bundled default.');
assert_same(Setae_Icon_Registry::get_default('nav.records'), Setae_Icon_Registry::get('unknown.key'), 'Unknown keys should use the explicit records fallback.');

$fill_icon = '<svg viewBox="0 0 32 32" width="512" height="512" fill="#ff3366"><circle cx="16" cy="16" r="12"/></svg>';
$saved = Setae_Icon_Registry::save_override('nav.collection', $fill_icon);
assert_true(!is_wp_error($saved), 'A safe fill icon should be accepted.');
assert_true(strpos($saved, 'fill="#ff3366"') !== false, 'Fill icons must retain their fill.');
assert_true(strpos($saved, 'width="512"') === false && strpos($saved, 'height="512"') === false, 'Outer SVG dimensions must be removed.');
assert_same($saved, Setae_Icon_Registry::get('nav.collection'), 'Valid override should take precedence.');
assert_same($saved, Setae_Icon_Registry::get_frontend_overrides()['nav.collection'], 'App override payload should include the saved semantic key.');

Setae_Icon_Registry::reset_override('nav.collection');
assert_same($default_collection, Setae_Icon_Registry::get('nav.collection'), 'Single reset should restore the bundled default.');

$safe = '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2Z"/></svg>';
assert_true(!is_wp_error(Setae_Icon_Registry::sanitize_svg($safe)), 'Basic path SVG should be accepted.');
$standard_namespace = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';
$sanitized_namespace = Setae_Icon_Registry::sanitize_svg($standard_namespace);
assert_true(!is_wp_error($sanitized_namespace), 'The standard SVG namespace must be accepted.');
assert_true(strpos($sanitized_namespace, 'xmlns=') === false, 'The standard namespace should be removed from inline runtime SVG.');
$saved_namespace = Setae_Icon_Registry::save_override('nav.collection', $standard_namespace);
assert_same($sanitized_namespace, $saved_namespace, 'Saved SVG must use the same sanitizer output as preview/runtime.');
assert_same($saved_namespace, get_option(Setae_Icon_Registry::OPTION_NAME)['nav.collection'], 'The sanitized namespace SVG must be persisted.');
assert_same($saved_namespace, Setae_Icon_Registry::get_frontend_overrides()['nav.collection'], 'The namespace SVG must survive the frontend override pipeline.');
Setae_Icon_Registry::reset_override('nav.collection');

$standalone_method = new ReflectionMethod(Setae_Icon_Registry::class, 'standalone_svg');
$standalone_method->setAccessible(true);
$standalone_namespace = $standalone_method->invoke(null, $sanitized_namespace);
assert_true(strpos($standalone_namespace, '<svg xmlns="http://www.w3.org/2000/svg"') === 0, 'Standalone SVG must restore the standard namespace on the root element.');
assert_same(1, substr_count($standalone_namespace, 'xmlns="http://www.w3.org/2000/svg"'), 'Standalone SVG must contain the standard namespace exactly once.');
$standalone_default = $standalone_method->invoke(null, Setae_Icon_Registry::get_default('specimen.spider'));
assert_same(1, substr_count($standalone_default, 'xmlns="http://www.w3.org/2000/svg"'), 'Bundled specimen SVG must not receive a duplicate namespace.');

$invalid_namespace = Setae_Icon_Registry::sanitize_svg('<svg xmlns="https://example.com" viewBox="0 0 24 24"><path d="M0 0"/></svg>');
assert_true(is_wp_error($invalid_namespace), 'A non-standard namespace must be rejected.');
assert_same('unsafe_namespace', $invalid_namespace->get_error_code(), 'Invalid namespaces need a specific error code.');

$unsupported_clip = Setae_Icon_Registry::sanitize_svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><clipPath id="a"><path d="M0 0"/></clipPath></defs></svg>');
assert_true(is_wp_error($unsupported_clip), 'Unsupported SVG structures must be rejected.');
assert_true(strpos($unsupported_clip->get_error_message(), '<defs>') !== false, 'Unsupported element errors must identify the element.');
$invalid_cases = array(
    '<svg onload="alert(1)" viewBox="0 0 24 24"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 24 24"><foreignObject><div>unsafe</div></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><image href="https://example.test/a.png"/></svg>',
    '<svg viewBox="0 0 24 24"><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>',
    '<svg viewBox="0 0 24 24"><style>path{fill:red}</style></svg>',
    '<svg xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    '<svg><path d="M0 0"/></svg>',
);
foreach ($invalid_cases as $invalid) {
    assert_true(is_wp_error(Setae_Icon_Registry::sanitize_svg($invalid)), 'Unsafe or viewBox-less SVG should be rejected: ' . $invalid);
}

$import = Setae_Icon_Registry::import_payload(array(
    'schemaVersion' => 1,
    'icons' => array(
        'public.share' => $safe,
        'specimen.spider' => '<svg viewBox="0 0 160 120" fill="#222"><ellipse cx="80" cy="60" rx="40" ry="30"/></svg>',
    ),
));
assert_same(2, $import, 'Valid import should save every icon atomically.');
$export = Setae_Icon_Registry::export_payload();
assert_same(1, $export['schemaVersion'], 'Export schema version is incorrect.');
assert_true(isset($export['icons']['public.share'], $export['icons']['specimen.spider']), 'Export should contain valid overrides only.');
$stored_specimen = get_option(Setae_Icon_Registry::OPTION_NAME)['specimen.spider'];
assert_true(strpos($stored_specimen, 'xmlns=') === false, 'Stored specimen overrides should remain optimized for inline SVG.');
$standalone_specimen = $standalone_method->invoke(null, $stored_specimen);
$asset_url = Setae_Icon_Registry::asset_url('specimen.spider');
assert_true(strpos($asset_url, '/setae-icon/specimen.spider.svg?v=') !== false, 'Specimen assets should use the Registry endpoint.');
assert_same(substr(hash('sha256', $standalone_specimen), 0, 12), substr($asset_url, -12), 'Specimen asset URL version must hash the standalone response body.');
assert_same(1, substr_count($standalone_specimen, 'xmlns="http://www.w3.org/2000/svg"'), 'Custom specimen responses must contain one standard namespace.');

$bad_import = Setae_Icon_Registry::import_payload(array(
    'schemaVersion' => 1,
    'icons' => array('unknown.key' => $safe),
));
assert_true(is_wp_error($bad_import), 'Unknown import keys must be rejected.');

Setae_Icon_Registry::reset_all();
assert_same(array(), get_option(Setae_Icon_Registry::OPTION_NAME), 'Reset all should leave an empty override option.');
assert_same($default_collection, Setae_Icon_Registry::get('nav.collection'), 'Reset all should restore defaults.');

update_option(Setae_Icon_Registry::OPTION_NAME, array('nav.collection' => '<svg viewBox="0 0 24 24" onclick="alert(1)"><path d="M0 0"/></svg>'));
$overrides_property = new ReflectionProperty(Setae_Icon_Registry::class, 'overrides_cache');
$overrides_property->setAccessible(true);
$overrides_property->setValue(null, null);
$validated_property = new ReflectionProperty(Setae_Icon_Registry::class, 'validated_overrides_cache');
$validated_property->setAccessible(true);
$validated_property->setValue(null, array());
assert_same($default_collection, Setae_Icon_Registry::get('nav.collection'), 'Invalid stored overrides must fail safely to the default.');

echo "icon registry tests passed\n";
